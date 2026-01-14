import * as http from 'http';
import { URL } from 'url';
import * as keytar from 'keytar';
import { app, BrowserWindow, shell } from 'electron';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { 
  OpenSourceFeatures, 
  BackendConfig, 
  isAuthConfigured 
} from './OpenSourceConfig';

/**
 * Auth manager to support external-browser sign-in with a localhost callback.
 * Stores the access token securely using keytar under the app service name.
 * 
 * OPEN SOURCE NOTE: Authentication is DISABLED by default.
 * The app runs without sign-in in open-source mode.
 * To enable authentication:
 * 1. Set OpenSourceFeatures.AUTH_ENABLED = true
 * 2. Configure BackendConfig.ACCOUNT_PORTAL_URL
 * 3. Configure BackendConfig.SUPABASE_URL and SUPABASE_ANON_KEY
 */
export class AuthManager {
  private static instance: AuthManager;
  private readonly serviceName = 'VoiceTranslationVoiceMod';
  private readonly accountName = 'auth_token';
  private server: http.Server | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private isAuthEnabled: boolean = false;

  private constructor() {
    this.isAuthEnabled = isAuthConfigured();
    if (!this.isAuthEnabled) {
      console.log('ℹ️ AuthManager: Authentication disabled - running in local-only mode');
    }
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Check if authentication is enabled in this deployment
   */
  public isEnabled(): boolean {
    return this.isAuthEnabled;
  }

  public async hasToken(): Promise<boolean> {
    // In open-source mode without auth, always return false
    if (!this.isAuthEnabled) {
      return false;
    }

    try {
      const token = await keytar.getPassword(this.serviceName, this.accountName);
      return !!token && token.trim().length > 0;
    } catch (error) {
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.MEDIUM,
        component: 'AuthManager',
        context: { action: 'hasToken' }
      });
      return false;
    }
  }

  public async hasValidToken(): Promise<boolean> {
    try {
      const stored = await keytar.getPassword(this.serviceName, this.accountName);
      if (!stored) return false;

      // Try to parse as JSON first (new format)
      try {
        const tokenData = JSON.parse(stored);
        if (!tokenData.accessToken) return false;

        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (tokenData.expiresAt && tokenData.expiresAt < now) {
          const timeExpired = now - tokenData.expiresAt;
          console.log(`⏰ Token has expired ${timeExpired}s ago, attempting to refresh...`);

          // Attempt to refresh the token if we have a refresh token
          if (tokenData.refreshToken) {
            const refreshed = await this.refreshToken(tokenData.refreshToken);
            if (refreshed) {
              console.log('✅ Token refreshed successfully - user will stay signed in');
              return true;
            }
          }

          // Token expired and refresh failed - sign user out
          console.log('❌ Token expired and could not be refreshed - signing user out');
          ErrorReportingService.getInstance().captureError(new Error('Token expired and refresh failed - user signed out'), {
            category: ErrorCategory.API,
            severity: ErrorSeverity.HIGH,
            component: 'AuthManager',
            context: {
              action: 'hasValidToken',
              reason: 'token_expired_refresh_failed',
              expiresAt: tokenData.expiresAt,
              currentTime: now,
              timeExpired,
              expirationISO: new Date(tokenData.expiresAt * 1000).toISOString(),
              currentTimeISO: new Date(now * 1000).toISOString(),
              userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              timezoneOffset: new Date().getTimezoneOffset(),
              hasTrialInfo: !!tokenData.trialInfo,
              trialInfo: tokenData.trialInfo
            }
          });

          // Clear the expired token
          await this.clearToken();
          return false;
        }

        // Token is valid and not expired
        console.log(`✅ Token found and valid - user will stay signed in`);

        // Set up the token for subscription checking (but don't start checks here)
        // Subscription checks will be started in main.ts after window creation
        try {
          const { SupabaseService } = await import('./SupabaseService');
          const supabaseService = SupabaseService.getInstance();
          await supabaseService.setUserToken(tokenData.accessToken, tokenData.refreshToken);
        } catch (error) {
          console.warn('⚠️ Could not set token for subscription service:', error);
        }

        return true;
      } catch {
        // Fallback to old format (plain string) - consider it valid
        return !!stored.trim();
      }
    } catch {
      return false;
    }
  }


  public async getToken(): Promise<string> {
    try {
      const stored = await keytar.getPassword(this.serviceName, this.accountName);
      if (!stored) return '';

      // Try to parse as JSON first (new format)
      try {
        const tokenData = JSON.parse(stored);
        return tokenData.accessToken || '';
      } catch {
        // Fallback to old format (plain string)
        return stored;
      }
    } catch {
      return '';
    }
  }

  public async getTrialInfo(): Promise<{
    hasAccess?: boolean;
    isTrialActive?: boolean;
    trialEndsAt?: string;
    trialDaysRemaining?: number;
  } | null> {
    try {
      const stored = await keytar.getPassword(this.serviceName, this.accountName);
      if (!stored) return null;

      try {
        const tokenData = JSON.parse(stored);
        return tokenData.trialInfo || null;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Refresh an expired JWT token using the refresh token
   * @param refreshToken The refresh token to use
   * @returns true if refresh succeeded, false otherwise
   */
  public async refreshToken(refreshToken: string): Promise<boolean> {
    // Prevent concurrent refresh attempts - reuse existing promise
    if (this.refreshPromise) {
      console.log('🔄 Refresh already in progress, waiting for existing attempt...');
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefreshToken(refreshToken);
    
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      // Don't attempt refresh if refresh token is missing or invalid
      if (!refreshToken || refreshToken.trim().length === 0) {
        console.warn('⚠️ Cannot refresh token - no refresh token available');
        return false;
      }

      console.log('🔄 Attempting to refresh JWT token...');

      const { SupabaseService } = await import('./SupabaseService');
      const supabaseService = SupabaseService.getInstance();

      // Check if Supabase is configured for token refresh
      if (!supabaseService.isServiceConfigured() || !supabaseService.supabase) {
        console.warn('⚠️ Cannot refresh token - no auth backend configured');
        console.log('   In open-source mode, token refresh requires a configured auth provider');
        return false;
      }

      // Use Supabase's refreshSession method
      const { data, error } = await supabaseService.supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        console.error('❌ Failed to refresh token:', error.message);
        
        // Check if it's a refresh token reuse error
        const isReuseError = error.message?.toLowerCase().includes('already used') || 
                            error.message?.toLowerCase().includes('reuse');
        
        ErrorReportingService.getInstance().captureError(new Error(error.message), {
          code: error.code || 'REFRESH_FAILED',
          category: ErrorCategory.API,
          severity: isReuseError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
          component: 'AuthManager',
          context: { 
            action: 'refreshToken', 
            errorCode: error.code,
            isReuseError,
            errorMessage: error.message
          }
        });
        return false;
      }

      if (!data.session) {
        console.error('❌ No session returned from refresh');
        ErrorReportingService.getInstance().captureError(new Error('No session returned from token refresh'), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.HIGH,
          component: 'AuthManager',
          context: { action: 'refreshToken', reason: 'no_session' }
        });
        return false;
      }

      const session = data.session;
      
      // CRITICAL: Supabase ALWAYS returns a new refresh token - never reuse the old one
      if (!session.refresh_token) {
        console.error('❌ No refresh token in session response - this should never happen');
        ErrorReportingService.getInstance().captureError(new Error('No refresh token in session response'), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.CRITICAL,
          component: 'AuthManager',
          context: { action: 'refreshToken', reason: 'missing_new_refresh_token' }
        });
        return false;
      }

      console.log('✅ Token refresh successful, storing new tokens');

      // Get existing trial info to preserve it
      const existingTrialInfo = await this.getTrialInfo();

      // Store the new token with updated expiration - MUST use new refresh token
      await this.storeToken(
        session.access_token,
        session.expires_at ? Math.floor(new Date(session.expires_at).getTime() / 1000).toString() : undefined,
        session.refresh_token, // ALWAYS use the new refresh token
        existingTrialInfo || undefined
      );

      // Update Supabase service with the new token
      await supabaseService.setUserToken(session.access_token, session.refresh_token);

      console.log('✅ Token refreshed and stored successfully');
      return true;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'AuthManager',
        context: { action: 'refreshToken' }
      });
      return false;
    }
  }

  public async clearToken(): Promise<void> {
    console.log('🧹 Clearing local app authentication data...');

    try {
      // Delete the stored password/token from the app
      await keytar.deletePassword(this.serviceName, this.accountName);
      console.log('✅ Local app token deleted');
    } catch (error) {
      console.error('Error deleting local token:', error);
    }

    // Clear cached user ID
    try {
      const { TokenUtils } = await import('./TokenUtils');
      TokenUtils.clearCache();
    } catch (error) {
      // Ignore errors clearing cache
    }

    // Clear user info from error reporting
    try {
      ErrorReportingService.getInstance().clearUserInfo();
      console.log('📊 Cleared user info from error reporting');
    } catch (error) {
      // Ignore errors
    }

    // Notify subscription cache that token was cleared
    try {
      const { SubscriptionCacheService } = await import('./SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onTokenChange(null);
      console.log('✅ Notified subscription cache of token clearance');
    } catch (error) {
      console.error('Failed to notify subscription cache:', error);
    }

    console.log('✅ Local app data cleared - user stays signed in on website');
  }


  public async storeToken(
    token: string,
    expiresAt?: string,
    refreshToken?: string,
    trialInfo?: {
      hasAccess?: boolean;
      isTrialActive?: boolean;
      trialEndsAt?: string;
      trialDaysRemaining?: number;
    }
  ): Promise<void> {
    // Extract expiration from JWT token if not provided or if it looks truncated
    let finalExpiresAt: number;

    console.log(`🔐 storeToken called with expiresAt: ${expiresAt}`);

    // Try to extract from JWT token first (most reliable source)
    let jwtExpiresAt: number | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        // Add padding if needed for base64 decoding
        let base64 = parts[1];
        while (base64.length % 4 !== 0) {
          base64 += '=';
        }
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        if (payload.exp && typeof payload.exp === 'number') {
          jwtExpiresAt = payload.exp;
          console.log(`📅 Extracted expiration from JWT: ${new Date(payload.exp * 1000).toISOString()}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to extract expiration from JWT:`, error);
      // Don't report this as an error yet - we'll try the provided expiresAt
    }

    // Now decide which expiration to use
    if (jwtExpiresAt && jwtExpiresAt > 1700000000) {
      // JWT expiration is valid, use it
      finalExpiresAt = jwtExpiresAt;
      console.log(`✅ Using JWT expiration: ${new Date(finalExpiresAt * 1000).toISOString()}`);
    } else if (expiresAt) {
      const parsedExpiresAt = parseInt(expiresAt, 10);
      
      // Check if it's a valid Unix timestamp (10 digits, after year 2023)
      if (parsedExpiresAt > 1700000000 && parsedExpiresAt < 2000000000) {
        finalExpiresAt = parsedExpiresAt;
        console.log(`✅ Using provided expiresAt: ${new Date(finalExpiresAt * 1000).toISOString()}`);
      } else {
        // Invalid timestamp - log warning and use default
        console.warn(`⚠️ Provided expiresAt (${expiresAt}) is not a valid Unix timestamp (parsed as ${parsedExpiresAt})`);
        ErrorReportingService.getInstance().captureError(new Error(`Invalid expiresAt format: ${expiresAt}`), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.MEDIUM,
          component: 'AuthManager',
          context: { 
            action: 'storeToken', 
            providedExpiresAt: expiresAt,
            parsedValue: parsedExpiresAt,
            reason: 'invalid_timestamp_format',
            jwtExpiresAt: jwtExpiresAt || 'none'
          }
        });
        finalExpiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // Default 24h
      }
    } else {
      // No expiration provided at all
      console.warn(`⚠️ No expiration provided, using default 24h`);
      finalExpiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // Default 24h
    }

    // Detect potential timezone/clock sync issues
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = finalExpiresAt - now;
    
    console.log(`📅 Token expiration: ${new Date(finalExpiresAt * 1000).toISOString()} (${timeUntilExpiry}s from now)`);
    
    if (timeUntilExpiry < 0) {
      // Check if subscription/trial is still valid as a fallback
      let canContinue = false;
      let continueReason = '';
      
      if (trialInfo) {
        // Check trial expiration
        if (trialInfo.isTrialActive && trialInfo.trialEndsAt) {
          try {
            const trialEndsAt = new Date(trialInfo.trialEndsAt);
            const nowDate = new Date();
            const daysRemaining = Math.ceil((trialEndsAt.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining > 0) {
              canContinue = true;
              continueReason = `trial active (${daysRemaining} days remaining)`;
            }
          } catch (error) {
            console.warn('⚠️ Could not parse trial expiration date:', error);
          }
        }
        
        // Check if user has access (paid subscription)
        if (trialInfo.hasAccess === true) {
          canContinue = true;
          continueReason = 'active subscription';
        }
      }
      
      if (canContinue) {
        console.warn(`⚠️ Token expiration is in the past, but user has ${continueReason} - allowing sign-in`);
        
        // Report to Discord - JWT should ideally not be expired on sign-in
        ErrorReportingService.getInstance().captureError(new Error(`Token expired on sign-in but ${continueReason} - user allowed to continue`), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.MEDIUM,
          component: 'AuthManager',
          context: { 
            action: 'storeToken_fallback',
            reason: 'token_expired_on_signin_using_subscription_fallback',
            continueReason,
            finalExpiresAt,
            currentTime: now,
            timeUntilExpiry,
            expirationISO: new Date(finalExpiresAt * 1000).toISOString(),
            currentTimeISO: new Date(now * 1000).toISOString(),
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            trialInfo
          }
        });
      } else {
        console.error(`❌ Token expiration is in the past! This indicates a timezone or clock sync issue.`);
        ErrorReportingService.getInstance().captureError(new Error('Token expiration is in the past'), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.HIGH,
          component: 'AuthManager',
          context: { 
            action: 'storeToken',
            finalExpiresAt,
            currentTime: now,
            timeUntilExpiry,
            expirationISO: new Date(finalExpiresAt * 1000).toISOString(),
            currentTimeISO: new Date(now * 1000).toISOString(),
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            reason: 'token_expired_on_storage',
            hasTrialInfo: !!trialInfo,
            trialInfo
          }
        });
      }
    } else if (timeUntilExpiry > 86400) {
      // More than 24 hours - unusual but not necessarily wrong
      console.warn(`⚠️ Token expiration is more than 24 hours in the future (${Math.floor(timeUntilExpiry / 3600)} hours)`);
    }

    const tokenData = {
      accessToken: token,
      tokenType: 'Bearer',
      expiresAt: finalExpiresAt,
      refreshToken: refreshToken || undefined,
      signinTimestamp: Date.now(), // Store the signin time in milliseconds
      trialInfo: trialInfo || undefined
    };

    await keytar.setPassword(this.serviceName, this.accountName, JSON.stringify(tokenData));
    
    // Notify subscription cache that token changed
    try {
      const { SubscriptionCacheService } = await import('./SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onTokenChange(token);
      console.log('✅ Notified subscription cache of token change');
    } catch (error) {
      console.error('Failed to notify subscription cache:', error);
    }
    
    // Clear cached user ID when token changes
    try {
      const { TokenUtils } = await import('./TokenUtils');
      TokenUtils.clearCache();
    } catch (error) {
      // Ignore errors clearing cache
    }
  }

  /**
   * Starts a loopback server on an available port in 8080-8090 range and opens the external
   * account site with redirect_uri pointing back to the loopback callback.
   * Sends 'auth:signed-in' to all windows on success.
   */
  public async beginExternalSignIn(): Promise<{ port: number; url: string }>
  {
    // Check if auth is enabled
    if (!this.isAuthEnabled) {
      throw new Error('Authentication is not enabled in this deployment. Running in local-only mode.');
    }

    const accountPortalUrl = BackendConfig.ACCOUNT_PORTAL_URL;
    if (!accountPortalUrl) {
      throw new Error('Account portal URL not configured. Please set ACCOUNT_PORTAL_URL environment variable.');
    }

    const port = await this.findOpenPort(8080, 8090);
    console.log(`🔐 Starting auth callback server on port ${port}`);
    await this.startCallbackServer(port);

    const redirectUri = `http://localhost:${port}/callback`;
    const url = `${accountPortalUrl}?source=ide&redirect_uri=${encodeURIComponent(redirectUri)}`;

    console.log(`🌐 Opening browser to: ${url}`);
    console.log(`🔐 Waiting for callback at: ${redirectUri}`);
    
    // Set a timeout to detect if callback never comes
    setTimeout(() => {
      if (this.server) {
        console.log(`⚠️ Auth timeout - no callback received after 2 minutes`);
        console.log(`🔍 Expected callback URL: ${redirectUri}`);
        console.log(`🔍 Make sure your account page redirects to this URL after sign-in`);
      }
    }, 120000); // 2 minutes

    await shell.openExternal(url);
    return { port, url };
  }

  private async findOpenPort(start: number, end: number): Promise<number> {
    const tryListen = (port: number) => new Promise<boolean>(resolve => {
      const srv = http.createServer(() => {});
      srv.once('error', () => resolve(false));
      srv.once('listening', () => {
        srv.close(() => resolve(true));
      });
      srv.listen(port, '127.0.0.1');
    });

    for (let p = start; p <= end; p++) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryListen(p);
      if (ok) return p;
    }
    const error = new Error('No open port available for auth callback');
    ErrorReportingService.getInstance().captureError(error, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      component: 'AuthManager',
      context: { action: 'findOpenPort', startPort: start, endPort: end }
    });
    throw error;
  }

  private async startCallbackServer(port: number): Promise<void> {
    if (this.server) {
      try { this.server.close(); } catch {}
      this.server = null;
    }

    this.server = http.createServer(async (req, res) => {
      console.log(`🔐 Auth callback received: ${req.method} ${req.url}`);
      try {
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        console.log(`🔐 Full callback URL: ${url.toString()}`);
        console.log(`🔐 URL pathname: ${url.pathname}`);
        console.log(`🔐 All URL params:`, Object.fromEntries(url.searchParams.entries()));
        
        if (url.pathname !== '/callback') {
          console.log(`❌ Invalid callback path: ${url.pathname}`);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const token = url.searchParams.get('token') || url.searchParams.get('access_token');
        const expiresAt = url.searchParams.get('expires_at');
        const refreshToken = url.searchParams.get('refresh_token');
        const error = url.searchParams.get('error');
        const message = url.searchParams.get('message');
        const subscriptionStatus = url.searchParams.get('subscription_status');
        const hasAccess = url.searchParams.get('has_access');
        const isTrialActive = url.searchParams.get('is_trial_active');
        const trialEndsAt = url.searchParams.get('trial_ends_at');
        const trialDaysRemaining = url.searchParams.get('trial_days_remaining');

        console.log(`🔐 Callback params - token: ${token ? 'present' : 'missing'}, expires_at: ${expiresAt || 'none'}, refresh_token: ${refreshToken ? 'present' : 'missing'}, error: ${error || 'none'}, message: ${message || 'none'}, subscription_status: ${subscriptionStatus || 'none'}, has_access: ${hasAccess || 'none'}, is_trial_active: ${isTrialActive || 'none'}, trial_days_remaining: ${trialDaysRemaining || 'none'}`);

        // Handle access denied (only if no trial access and no subscription)
        // If has_access is true, allow sign-in even if there's a subscription_required or access_required error
        if ((error === 'subscription_required' || error === 'access_required') && hasAccess !== 'true') {
          const errorMessage = 'You need to upgrade your membership';
          console.log(`❌ Access denied: ${errorMessage}`);
          const html = this.subscriptionErrorHtml(errorMessage);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(html);
          this.notifySubscriptionRequired(errorMessage, subscriptionStatus || undefined);
          return;
        }

        // Allow sign-in if we have a token, even if there's a subscription_required or access_required error but has_access is true
        if (token && (!error || ((error === 'subscription_required' || error === 'access_required') && hasAccess === 'true'))) {
          console.log(`✅ Storing auth token and notifying app`);
          await this.storeToken(
            token,
            expiresAt || undefined,
            refreshToken || undefined,
            {
              hasAccess: hasAccess === 'true',
              isTrialActive: isTrialActive === 'true',
              trialEndsAt: trialEndsAt || undefined,
              trialDaysRemaining: trialDaysRemaining ? parseInt(trialDaysRemaining, 10) : undefined
            }
          );
          
          // Update user's app version in the database
          try {
            const { SupabaseService } = await import('./SupabaseService');
            const supabaseService = SupabaseService.getInstance();
            await supabaseService.setUserToken(token, refreshToken || undefined);

            const packageJson = require('../../package.json');
            const appVersion = packageJson.version || 'unknown';
            await supabaseService.updateUserVersion(appVersion);
            console.log(`📱 User app version updated on sign-in: ${appVersion}`);
          } catch (versionError) {
            console.warn('⚠️ Could not update user app version on sign-in:', versionError);
          }
          
          const html = this.successHtml(isTrialActive === 'true', trialDaysRemaining);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
          this.notifySignedIn();
        } else {
          const errorMessage = error || 'Sign-in failed. No token received.';
          console.log(`❌ Auth failed: ${errorMessage}`);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(this.errorHtml(errorMessage));
          this.notifySignInError(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Sign-in failed due to an internal error.';
        console.error(`❌ Auth callback error:`, err);
        ErrorReportingService.getInstance().captureError(err as Error, {
          category: ErrorCategory.API,
          severity: ErrorSeverity.CRITICAL,
          component: 'AuthManager',
          context: { action: 'authCallback', port }
        });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        this.notifySignInError(errorMessage);
      } finally {
        // Close after first request (success or failure)
        setTimeout(() => {
          console.log(`🔐 Closing auth callback server`);
          try { this.server?.close(); } catch {}
          this.server = null;
        }, 500);
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, '127.0.0.1', () => resolve());
    });
  }

  private async notifySignedIn(): Promise<void> {
    console.log(`🔐 Notifying app of successful sign-in`);
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) win.webContents.send('auth:signed-in');
    }

    // Set user info for error reporting
    try {
      await ErrorReportingService.getInstance().setUserFromToken();
      console.log('📊 User info set for error reporting');
    } catch (error) {
      console.warn('⚠️ Could not set user info for error reporting:', error);
    }

    // Set up Supabase subscription checking
    try {
      const { SupabaseService } = await import('./SupabaseService');
      const supabaseService = SupabaseService.getInstance();
      const userToken = await this.getToken();

      if (userToken) {
        // Get refresh token from stored token data
        const keytar = await import('keytar');
        const stored = await keytar.getPassword(this.serviceName, this.accountName);
        let refreshToken: string | undefined;
        if (stored) {
          try {
            const tokenData = JSON.parse(stored);
            refreshToken = tokenData.refreshToken;
          } catch {
            // Ignore parse errors
          }
        }

        await supabaseService.setUserToken(userToken, refreshToken);
        // Stop any existing checks first to prevent duplicates
        supabaseService.stopPeriodicCheck();
        // Check every 10 minutes - check immediately on sign-in
        supabaseService.startPeriodicCheck(10, true);
        console.log('🔄 Started subscription monitoring for signed-in user (checks every 10 minutes)');
      }
    } catch (error) {
      console.error('Failed to start subscription monitoring:', error);
    }

    // Trigger device check after a longer delay to allow main window to fully load
    setTimeout(() => {
      this.triggerDeviceCheck();
    }, 2000);
  }

  private async triggerDeviceCheck(): Promise<void> {
    try {
      console.log('🔍 Triggering device check after sign-in...');
      
      // Import the device check overlay manager
      const { DeviceCheckOverlayManager } = await import('./DeviceCheckOverlayManager');
      const deviceCheckManager = DeviceCheckOverlayManager.getInstance();
      
      // Check if overlay is already shown
      if (deviceCheckManager.isOverlayShown()) {
        console.log('🔍 Device check overlay already shown, skipping...');
        return;
      }
      
      // Show the device check overlay
      await deviceCheckManager.showDeviceCheckOverlay();
      
    } catch (error) {
      console.error('Failed to trigger device check:', error);
      // Don't block sign-in if device check fails
    }
  }

  private notifySubscriptionRequired(message: string, subscriptionStatus?: string): void {
    console.log(`🔐 Notifying app of subscription required: ${message}`);
    ErrorReportingService.getInstance().captureError(new Error(message), {
      category: ErrorCategory.API,
      severity: ErrorSeverity.MEDIUM,
      component: 'AuthManager',
      context: { action: 'subscriptionRequired', subscriptionStatus }
    });
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('auth:subscription-required', { message, subscriptionStatus });
      }
    }
  }

  private notifySignInError(message: string): void {
    console.log(`🔐 Notifying app of sign-in error: ${message}`);
    ErrorReportingService.getInstance().captureError(new Error(message), {
      category: ErrorCategory.API,
      severity: ErrorSeverity.HIGH,
      component: 'AuthManager',
      context: { action: 'signInError' }
    });
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('auth:sign-in-error', { message });
      }
    }
  }

  private successHtml(isTrialActive?: boolean, trialDaysRemaining?: string | null): string {
    const trialMessage = isTrialActive && trialDaysRemaining
      ? `<div class="trial-info">Trial Active: ${trialDaysRemaining} days remaining</div>`
      : '';

    const accountUrl = BackendConfig.ACCOUNT_PORTAL_URL;
    const dashboardUrl = accountUrl ? (accountUrl.endsWith('/') ? `${accountUrl}dashboard` : `${accountUrl}/dashboard`) : '';
    const redirectMeta = dashboardUrl ? `<meta http-equiv="refresh" content="3;url=${dashboardUrl}">` : '';
    const redirectMessage = dashboardUrl 
      ? `<div class="redirect">Redirecting to your account dashboard in 3 seconds...</div><div class="muted" style="margin-top:10px;font-size:12px">If you're not redirected automatically, <a href="${dashboardUrl}" style="color:#0066cc">click here</a>.</div>`
      : '<div class="muted" style="margin-top:10px">You can close this window now.</div>';

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Signed in</title>
${redirectMeta}
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;height:100vh;margin:0} .card{max-width:520px;text-align:center} .title{font-weight:700;font-size:22px;margin-bottom:8px;color:#28a745} .muted{color:#333;margin-bottom:20px} .trial-info{color:#0066cc;font-weight:600;margin:12px 0} .redirect{color:#0066cc;margin-top:20px;font-size:14px}</style>
</head><body><div class="card"><div class="title">Sign-in complete</div><div class="muted">You can return to the app. This window can be closed.</div>${trialMessage}${redirectMessage}</div></body></html>`;
  }

  private errorHtml(message: string): string {
    const safe = (message || '').toString().substring(0, 500);
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign-in error</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;height:100vh;margin:0} .card{max-width:520px;text-align:center} .title{font-weight:700;font-size:22px;margin-bottom:8px} .err{color:#b00020;margin-top:12px;word-break:break-word}</style>
</head><body><div class="card"><div class="title">Sign-in failed</div><div>Please close this window and try again.</div><div class="err">${safe}</div></div></body></html>`;
  }

  private subscriptionErrorHtml(message: string): string {
    const safe = (message || 'You need to upgrade your membership').toString().substring(0, 500);
    const accountUrl = BackendConfig.ACCOUNT_PORTAL_URL;
    const dashboardUrl = accountUrl ? (accountUrl.endsWith('/') ? `${accountUrl}dashboard` : `${accountUrl}/dashboard`) : '';
    const redirectMeta = dashboardUrl ? `<meta http-equiv="refresh" content="3;url=${dashboardUrl}">` : '';
    const redirectMessage = dashboardUrl 
      ? `<div class="redirect">Redirecting to your account dashboard in 3 seconds...</div><div class="muted" style="margin-top:10px;font-size:12px">If you're not redirected automatically, <a href="${dashboardUrl}" style="color:#0066cc">click here</a>.</div>`
      : '<div class="muted" style="margin-top:10px">You can close this window now.</div>';

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Membership Upgrade Required</title>
${redirectMeta}
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;height:100vh;margin:0} .card{max-width:520px;text-align:center} .title{font-weight:700;font-size:22px;margin-bottom:8px;color:#b00020} .muted{color:#333;margin-bottom:20px} .err{color:#b00020;margin-top:12px;word-break:break-word;font-size:18px;font-weight:600} .redirect{color:#0066cc;margin-top:20px;font-size:14px}</style>
</head><body><div class="card"><div class="title">Membership Upgrade Required</div><div class="muted">Please close this window and upgrade your membership to continue.</div><div class="err">${safe}</div>${redirectMessage}</div></body></html>`;
  }
}


