import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { 
  OpenSourceFeatures, 
  BackendConfig, 
  isBackendConfigured 
} from './OpenSourceConfig';

export interface SubscriptionStatus {
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status?: string;
  plan_name?: string;
  monthly_usage_limit?: number;
  display_usage_limit?: number;
  current_period_end?: string;
  managed_api_access?: boolean;
}

export interface UserAccessStatus {
  hasAccess: boolean;
  isTrialActive: boolean;
  trialEndsAt?: string;
  trialDaysRemaining?: number;
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  planTier?: 'pro' | 'ultra';
  hasManagedAPI?: boolean;
  subscriptionEndsAt?: string;
  subscriptionDaysRemaining?: number;
  error?: string;
}

export class SupabaseService {
  private static instance: SupabaseService;
  public supabase: SupabaseClient | null = null; // Made public for token refresh, null if not configured
  private checkInterval: NodeJS.Timeout | null = null;
  private userToken: string | null = null;
  private lastKnownPlan: string | null = null;
  private isConfigured: boolean = false;

  private constructor() {
    // Only initialize Supabase if properly configured
    if (isBackendConfigured() && BackendConfig.SUPABASE_URL && BackendConfig.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        BackendConfig.SUPABASE_URL,
        BackendConfig.SUPABASE_ANON_KEY
      );
      this.isConfigured = true;
      console.log('✅ SupabaseService initialized with configured backend');
    } else {
      console.log('ℹ️ SupabaseService: No backend configured - running in local-only mode');
      console.log('   To enable auth/subscription features, configure SUPABASE_URL and SUPABASE_ANON_KEY');
    }
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Set the user's JWT token for authenticated requests
   */
  public async setUserToken(token: string, refreshToken?: string): Promise<void> {
    // Skip if not configured
    if (!this.isConfigured || !this.supabase) {
      console.log('ℹ️ SupabaseService.setUserToken: Skipped - no backend configured');
      return;
    }

    this.userToken = token;
    // Set the session for the Supabase client
    try {
      // Get the refresh token from stored token data if not provided
      let actualRefreshToken = refreshToken;
      if (!actualRefreshToken) {
        const keytar = await import('keytar');
        const stored = await keytar.getPassword('VoiceTranslationVoiceMod', 'auth_token');
        if (stored) {
          try {
            const tokenData = JSON.parse(stored);
            actualRefreshToken = tokenData.refreshToken;
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Only set session if we have both access token and refresh token
      // Don't use access token as fallback for refresh token - this causes issues
      if (actualRefreshToken) {
        await this.supabase.auth.setSession({
          access_token: token,
          refresh_token: actualRefreshToken
        });
      } else {
        console.warn('⚠️ No refresh token available - Supabase session not set (token refresh will not be available)');
      }
    } catch (error) {
      console.error('Failed to set Supabase session:', error);
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'SupabaseService',
        context: { action: 'setUserToken' }
      });
    }
  }

  /**
   * Clear the user's token
   */
  public clearUserToken(): void {
    this.userToken = null;
    this.isChecking = false;
    this.lastKnownPlan = null;
    // Clear cached user ID when token is cleared
    import('./TokenUtils').then(({ TokenUtils }) => {
      TokenUtils.clearCache();
    }).catch(() => {});
    if (this.supabase) {
      this.supabase.auth.signOut();
    }
  }

  /**
   * Get the current authenticated user ID for debugging
   */
  public async getCurrentUserId(): Promise<string | null> {
    try {
      const { TokenUtils } = await import('./TokenUtils');
      return await TokenUtils.extractUserId();
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      return null;
    }
  }

  /**
   * Check if the service is configured and available
   */
  public isServiceConfigured(): boolean {
    return this.isConfigured && this.supabase !== null;
  }

  /**
   * Check subscription status for the authenticated user
   * Returns null with full access if not configured (open-source mode)
   */
  public async checkSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    // In open-source mode without backend, return null (no subscription needed)
    if (!this.isConfigured || !this.supabase) {
      return null;
    }

    try {
      if (!this.userToken) {
        return null;
      }

      // Get user ID to filter subscription
      const { TokenUtils } = await import('./TokenUtils');
      const userId = await TokenUtils.extractUserId();

      if (!userId) {
        console.warn('⚠️ Could not extract user ID for subscription check');
        return null;
      }

      const { data, error } = await this.supabase
        .from('user_subscription_details')
        .select('user_id, stripe_customer_id, stripe_subscription_id, status, plan_name, monthly_usage_limit, display_usage_limit, current_period_end, managed_api_access')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Only log if it's not a "not found" error (which is expected for users without subscriptions)
        if (error.code !== 'PGRST116') {
          console.error('❌ Supabase subscription check error:', error);
          ErrorReportingService.getInstance().captureError(new Error(error.message), {
            code: error.code,
            category: ErrorCategory.API,
            severity: ErrorSeverity.MEDIUM,
            component: 'SupabaseService',
            context: { action: 'checkSubscriptionStatus', errorCode: error.code }
          });
        }
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        component: 'SupabaseService',
        context: { action: 'checkSubscriptionStatus' }
      });
      return null;
    }
  }

  /**
   * Check if the authenticated user has active subscription
   * In open-source mode without backend, returns true (no subscription needed)
   */
  public async hasActiveSubscription(): Promise<boolean> {
    // In open-source mode without backend, grant full access
    if (!this.isConfigured || !this.supabase) {
      return true;
    }

    const subscription = await this.checkSubscriptionStatus();

    if (!subscription) {
      return false;
    }

    // Check if status is explicitly active or trialing (matches SQL logic)
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return true;
    }

    // Check if subscription is valid based on Stripe data
    if (subscription.stripe_subscription_id && subscription.current_period_end) {
      const currentPeriodEnd = new Date(subscription.current_period_end);
      const now = new Date();
      return currentPeriodEnd > now;
    }

    return false;
  }

  /**
   * Check comprehensive user access (trial + subscription)
   * In open-source mode without backend, returns full access
   */
  public async checkUserAccess(): Promise<UserAccessStatus> {
    // In open-source mode without backend, grant full access
    if (!this.isConfigured || !this.supabase) {
      return {
        hasAccess: true,
        isTrialActive: false,
        hasActiveSubscription: true, // Grant full access in open-source mode
        subscriptionStatus: 'open_source',
        subscriptionPlan: 'Open Source',
        planTier: 'ultra', // Grant highest tier in open-source mode
        hasManagedAPI: false // Managed API requires backend
      };
    }

    try {
      if (!this.userToken) {
        return {
          hasAccess: false,
          isTrialActive: false,
          hasActiveSubscription: false,
          error: 'No user token'
        };
      }

      // Get user ID (cached, so no repeated parsing)
      const { TokenUtils } = await import('./TokenUtils');
      const userId = await TokenUtils.extractUserId();

      if (!userId) {
        // Report detailed error for debugging
        ErrorReportingService.getInstance().captureError(new Error('Could not extract user ID from token'), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.HIGH,
          component: 'SupabaseService',
          context: {
            action: 'checkUserAccess',
            reason: 'user_id_extraction_failed',
            hasToken: !!this.userToken,
            tokenLength: this.userToken?.length || 0
          }
        });
        return {
          hasAccess: false,
          isTrialActive: false,
          hasActiveSubscription: false,
          error: 'Could not extract user ID from token'
        };
      }

      // Query the profiles table to get trial information
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('id, created_at, trial_ends_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        // Check if it's an auth error (session not ready)
        const errorMsg = profileError.message || String(profileError);
        const isAuthError = errorMsg.includes('JWT') ||
                           errorMsg.includes('session') ||
                           errorMsg.includes('auth') ||
                           errorMsg.includes('unauthorized');

        if (isAuthError) {
          console.warn('⚠️ Authentication error during profile fetch - session may not be ready yet');
        }

        return {
          hasAccess: false,
          isTrialActive: false,
          hasActiveSubscription: false,
          error: `Database error: ${errorMsg}`
        };
      }

      if (!profile) {
        return {
          hasAccess: false,
          isTrialActive: false,
          hasActiveSubscription: false,
          error: 'No profile found for user'
        };
      }

      // Check trial status - is trial_ends_at in the future?
      let isTrialActive = false;
      let trialEndsAt: string | undefined;
      let trialDaysRemaining: number | undefined;

      if (profile?.trial_ends_at) {
        const trialEnd = new Date(profile.trial_ends_at);
        const now = new Date();
        isTrialActive = trialEnd > now;

        trialEndsAt = profile.trial_ends_at;
        const msRemaining = trialEnd.getTime() - now.getTime();
        trialDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      }

      // Check subscription status
      const subscription = await this.checkSubscriptionStatus();
      
      // Calculate subscription expiration info
      let subscriptionEndsAt: string | undefined;
      let subscriptionDaysRemaining: number | undefined;
      let subscriptionPeriodValid = false;

      if (subscription?.current_period_end) {
        subscriptionEndsAt = subscription.current_period_end;
        const subscriptionEnd = new Date(subscription.current_period_end);
        const now = new Date();
        subscriptionPeriodValid = subscriptionEnd > now;
        const msRemaining = subscriptionEnd.getTime() - now.getTime();
        subscriptionDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      }

      // Subscription is active only if:
      // 1. Status is 'active' or 'trialing' (not expired, canceled, past_due, incomplete, etc.) AND
      // 2. Subscription period hasn't ended (if current_period_end exists)
      // Explicitly check for expired status and other inactive statuses
      const isStatusActive = subscription?.status === 'active' || subscription?.status === 'trialing';
      const isStatusExpired = subscription?.status === 'expired' || 
                              subscription?.status === 'canceled' || 
                              subscription?.status === 'past_due' ||
                              subscription?.status === 'incomplete' ||
                              subscription?.status === 'incomplete_expired';
      
      const hasActiveSubscription = isStatusActive && !isStatusExpired
        ? (subscription?.current_period_end ? subscriptionPeriodValid : true)
        : false;

      // Update last known plan if we have subscription data
      if (subscription?.plan_name) {
        this.lastKnownPlan = subscription.plan_name;
      }

      // User has access if they have either an active trial OR an active subscription
      const hasAccess = isTrialActive || hasActiveSubscription;

      // Detect plan tier (Ultra vs Pro)
      const planTier = this.detectPlanTier(subscription?.plan_name);
      
      // Managed API access: trial users get it, OR users with managed_api_access=true in DB, OR Ultra plan users
      const hasManagedAPI = isTrialActive || this.hasManagedAPIAccess(subscription);

      console.log(`🔍 User access check: hasAccess=${hasAccess}, isTrialActive=${isTrialActive}, trialDaysRemaining=${trialDaysRemaining}, hasActiveSubscription=${hasActiveSubscription}, subscriptionStatus=${subscription?.status}, planTier=${planTier}, hasManagedAPI=${hasManagedAPI}, managed_api_access_db=${subscription?.managed_api_access}`);

      return {
        hasAccess,
        isTrialActive,
        trialEndsAt,
        trialDaysRemaining,
        hasActiveSubscription,
        subscriptionStatus: subscription?.status,
        subscriptionPlan: subscription?.plan_name,
        planTier,
        hasManagedAPI
      };
    } catch (error) {
      console.error('❌ Error checking user access:', error);
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'SupabaseService',
        context: { action: 'checkUserAccess' }
      });
      return {
        hasAccess: false,
        isTrialActive: false,
        hasActiveSubscription: false,
        error: String(error)
      };
    }
  }

  /**
   * Check if user has managed API access
   * Checks both plan name (Ultra) and database field (managed_api_access)
   */
  public hasManagedAPIAccess(subscription?: SubscriptionStatus | null): boolean {
    if (!subscription) return false;
    
    // Check database field first (most reliable)
    if (subscription.managed_api_access === true) {
      return true;
    }
    
    // Fallback to plan name check for Ultra
    if (subscription.plan_name && subscription.plan_name.toLowerCase() === 'ultra') {
      return true;
    }
    
    return false;
  }

  /**
   * Detect plan tier based on plan name
   * Returns 'ultra' only for Ultra plan, 'pro' for everything else
   */
  private detectPlanTier(planName?: string): 'pro' | 'ultra' {
    if (!planName) return 'pro';
    return planName.toLowerCase() === 'ultra' ? 'ultra' : 'pro';
  }

  /**
   * Update the user's app version in the database
   * This should be called when the user signs in or when the app starts
   */
  public async updateUserVersion(version: string): Promise<boolean> {
    try {
      if (!this.userToken) {
        console.error('❌ No user token set for version update');
        return false;
      }

      // Get user ID
      const { TokenUtils } = await import('./TokenUtils');
      const userId = await TokenUtils.extractUserId();

      console.log(`📱 Updating user ${userId} app version to: ${version}`);

      // Skip if not configured
      if (!this.supabase) {
        console.log('ℹ️ Skipping version update - no backend configured');
        return true;
      }

      // Update the profiles table with the current app version
      const { error } = await this.supabase
        .from('profiles')
        .update({
          app_version: version,
          last_version_update: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Failed to update user version:', error);
        return false;
      }

      console.log(`✅ Successfully updated user ${userId} app version to ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating user version:', error);
      return false;
    }
  }

  private isChecking: boolean = false;

  /**
   * Start periodic subscription checking for the authenticated user
   * @param intervalMinutes - Interval between checks in minutes
   * @param checkImmediately - Whether to check immediately or wait for first interval
   */
  public startPeriodicCheck(intervalMinutes: number = 60, checkImmediately: boolean = true): void {
    console.log(`🔄 Starting periodic subscription check every ${intervalMinutes} minutes`);
    
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Check immediately if requested (defer by 2 seconds on startup to let app load)
    if (checkImmediately) {
      setTimeout(() => {
        this.checkSubscriptionAndHandle();
      }, 2000);
    }

    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkSubscriptionAndHandle();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic subscription checking
   */
  public stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Stopped periodic subscription checking');
    }
  }

  /**
   * Refresh subscription status (call this when user updates plan)
   * This will check current status and update without signing out
   */
  public async refreshSubscriptionStatus(): Promise<UserAccessStatus | null> {
    try {
      if (!this.userToken) {
        return null;
      }

      const accessStatus = await this.checkUserAccess();
      
      // Detect plan changes
      if (accessStatus.subscriptionPlan && accessStatus.subscriptionPlan !== this.lastKnownPlan) {
        if (this.lastKnownPlan) {
          console.log(`🔄 Plan updated: ${this.lastKnownPlan} → ${accessStatus.subscriptionPlan}`);
        }
        this.lastKnownPlan = accessStatus.subscriptionPlan;
      }

      return accessStatus;
    } catch (error) {
      console.error('❌ Error refreshing subscription status:', error);
      return null;
    }
  }

  /**
   * Force a subscription check and sign out if expired (call this from settings, etc.)
   * This will actually check and sign out if needed
   */
  public async forceSubscriptionCheck(): Promise<UserAccessStatus | null> {
    console.log('🔍 [Force Check] Forcing subscription check...');
    try {
      if (!this.userToken) {
        console.log('🔍 [Force Check] No user token');
        return null;
      }

      // Use the same check that periodic checks use - this will sign out if expired
      await this.checkSubscriptionAndHandle();
      
      // Return the access status for information
      return await this.checkUserAccess();
    } catch (error) {
      console.error('❌ [Force Check] Error forcing subscription check:', error);
      return null;
    }
  }

  /**
   * Check subscription/trial status and sign out if canceled or expired
   * Always fetches fresh data from Supabase (no cache)
   */
  private async checkSubscriptionAndHandle(): Promise<void> {
    // Prevent multiple simultaneous checks
    if (this.isChecking) {
      console.log('🔍 [Subscription Check] Already checking, skipping duplicate check...');
      return;
    }

    this.isChecking = true;
    try {
      console.log('🔍 [Subscription Check] ========== STARTING SUBSCRIPTION CHECK ==========');

      // Token refresh is now handled only when token is actually expired (not proactively)
      // This prevents hitting Supabase refresh token limits on Windows 11
      
      // Always fetch fresh subscription data (no cache)
      const accessStatus = await this.checkUserAccess();
      console.log('🔍 [Subscription Check] Fetched access status from Supabase:', {
        hasAccess: accessStatus.hasAccess,
        isTrialActive: accessStatus.isTrialActive,
        hasActiveSubscription: accessStatus.hasActiveSubscription,
        subscriptionStatus: accessStatus.subscriptionStatus,
        subscriptionDaysRemaining: accessStatus.subscriptionDaysRemaining,
        trialDaysRemaining: accessStatus.trialDaysRemaining,
        error: accessStatus.error
      });
      
      // Detect plan changes
      if (accessStatus.subscriptionPlan && accessStatus.subscriptionPlan !== this.lastKnownPlan) {
        if (this.lastKnownPlan) {
          console.log(`🔄 Plan updated: ${this.lastKnownPlan} → ${accessStatus.subscriptionPlan}`);
          // Notify windows about plan update (without signing out)
          const { BrowserWindow } = await import('electron');
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('subscription:plan-updated', {
                oldPlan: this.lastKnownPlan,
                newPlan: accessStatus.subscriptionPlan,
                subscriptionEndsAt: accessStatus.subscriptionEndsAt,
                subscriptionDaysRemaining: accessStatus.subscriptionDaysRemaining
              });
            }
          }
        }
        this.lastKnownPlan = accessStatus.subscriptionPlan;
      }

      // If there's an error extracting user ID or validating token, sign out
      if (accessStatus.error) {
        if (accessStatus.error.includes('Could not extract user ID') || 
            accessStatus.error.includes('No user token') ||
            accessStatus.error.includes('No profile found')) {
          console.error(`❌ User validation failed (${accessStatus.error}) - signing out`);
          await this.handleAccessExpired(accessStatus);
          return;
        }
        // For network/database errors, keep user signed in
        console.warn(`⚠️ Could not verify subscription (${accessStatus.error}) - user remains signed in`);
        return;
      }

      // If access is denied (subscription canceled, expired, OR trial ended), sign user out
      if (!accessStatus.hasAccess) {
        console.log('🚪 [Subscription Check] Access denied - checking reason...');
        let reason = '';
        if (!accessStatus.isTrialActive && !accessStatus.hasActiveSubscription) {
          // Both trial and subscription are inactive
          if (accessStatus.subscriptionStatus === 'expired') {
            reason = 'subscription expired';
          } else if (accessStatus.subscriptionStatus === 'canceled') {
            reason = 'subscription canceled';
          } else if (accessStatus.subscriptionStatus === 'past_due') {
            reason = 'subscription past due';
          } else if (accessStatus.subscriptionDaysRemaining !== undefined && accessStatus.subscriptionDaysRemaining < 0) {
            reason = `subscription expired ${Math.abs(accessStatus.subscriptionDaysRemaining)} days ago`;
          } else if (accessStatus.trialDaysRemaining !== undefined && accessStatus.trialDaysRemaining < 0) {
            reason = `trial expired ${Math.abs(accessStatus.trialDaysRemaining)} days ago`;
          } else {
            reason = 'subscription canceled or trial ended';
          }
        } else if (!accessStatus.isTrialActive && accessStatus.hasActiveSubscription) {
          reason = 'trial expired (subscription may still be active)';
        } else if (accessStatus.isTrialActive && !accessStatus.hasActiveSubscription) {
          reason = 'subscription inactive (trial may still be active)';
        } else {
          reason = 'access denied';
        }
        
        console.log(`🚪 [Subscription Check] Access denied (${reason}) - SIGNING OUT USER NOW`);
        await this.handleAccessExpired(accessStatus);
        return;
      }
      
      // Check if subscription status is explicitly 'expired' AND trial is not active
      // NOTE: If trial is active, user should stay signed in even if subscription is expired
      if (accessStatus.subscriptionStatus === 'expired' && !accessStatus.isTrialActive) {
        console.log(`🚪 [Subscription Check] Subscription status is expired and trial is not active - SIGNING OUT USER NOW`);
        await this.handleAccessExpired(accessStatus);
        return;
      }

      // Also check if subscription period has expired even if status says active
      if (accessStatus.hasActiveSubscription && 
          accessStatus.subscriptionDaysRemaining !== undefined && 
          accessStatus.subscriptionDaysRemaining < 0) {
        console.log(`🚪 Subscription period expired ${Math.abs(accessStatus.subscriptionDaysRemaining)} days ago - signing out user`);
        await this.handleAccessExpired(accessStatus);
        return;
      }

      // User has access - log status with expiration info
      let statusMsg = '';
      if (accessStatus.isTrialActive) {
        statusMsg = `Trial active (${accessStatus.trialDaysRemaining} days remaining)`;
      } else if (accessStatus.hasActiveSubscription) {
        if (accessStatus.subscriptionDaysRemaining !== undefined) {
          if (accessStatus.subscriptionDaysRemaining < 0) {
            statusMsg = `⚠️ Subscription expired ${Math.abs(accessStatus.subscriptionDaysRemaining)} days ago`;
          } else if (accessStatus.subscriptionDaysRemaining <= 7) {
            statusMsg = `⚠️ Subscription expires in ${accessStatus.subscriptionDaysRemaining} day${accessStatus.subscriptionDaysRemaining !== 1 ? 's' : ''}`;
          } else {
            statusMsg = `Subscription active (expires in ${accessStatus.subscriptionDaysRemaining} days)`;
          }
        } else {
          statusMsg = 'Subscription active';
        }
      } else {
        statusMsg = 'Access granted';
      }
      console.log(`✅ ${statusMsg}`);
      
      // Log detailed subscription info if subscription is active
      if (accessStatus.hasActiveSubscription && accessStatus.subscriptionEndsAt) {
        const endDate = new Date(accessStatus.subscriptionEndsAt);
        console.log(`📅 Subscription ends: ${endDate.toLocaleDateString()} (${accessStatus.subscriptionDaysRemaining} days remaining)`);
      }
    } catch (error) {
      console.error('❌ Error during access check:', error);
      console.warn('⚠️ User remains signed in due to check error (will retry later)');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'SupabaseService',
        context: { action: 'checkSubscriptionAndHandle' }
      });
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Handle access expiration (trial or subscription) by logging out user
   */
  private async handleAccessExpired(accessStatus: UserAccessStatus): Promise<void> {
    try {
      console.log('🚪 [Handle Expired] ========== STARTING SIGN-OUT PROCESS ==========');
      console.log('🚪 [Handle Expired] Access status:', {
        hasAccess: accessStatus.hasAccess,
        isTrialActive: accessStatus.isTrialActive,
        hasActiveSubscription: accessStatus.hasActiveSubscription,
        subscriptionStatus: accessStatus.subscriptionStatus,
        subscriptionDaysRemaining: accessStatus.subscriptionDaysRemaining,
        trialDaysRemaining: accessStatus.trialDaysRemaining,
        error: accessStatus.error
      });
      
      // Import AuthManager to clear token
      const { AuthManager } = await import('./AuthManager');
      const authManager = AuthManager.getInstance();

      // Clear the stored token
      console.log('🚪 [Handle Expired] Clearing auth token...');
      await authManager.clearToken();
      console.log('🚪 [Handle Expired] Auth token cleared successfully');

      // Notify all windows to redirect to signin
      const { BrowserWindow } = await import('electron');
      const windows = BrowserWindow.getAllWindows();
      console.log(`🚪 [Handle Expired] Found ${windows.length} window(s) to notify`);

      const message = accessStatus.isTrialActive
        ? 'Your trial has expired. Please subscribe to continue.'
        : accessStatus.hasActiveSubscription
        ? 'Your access has expired. Please renew your subscription.'
        : 'Your trial and subscription have expired. Please subscribe to continue.';

      console.log(`🚪 [Handle Expired] Sign-out message: ${message}`);

      for (const win of windows) {
        if (!win.isDestroyed()) {
          console.log(`🚪 [Handle Expired] Sending access-expired event to window: ${win.getTitle()}`);
          win.webContents.send('access-expired', {
            message,
            reason: 'access_expired',
            isTrialActive: accessStatus.isTrialActive,
            hasActiveSubscription: accessStatus.hasActiveSubscription,
            trialDaysRemaining: accessStatus.trialDaysRemaining
          });
          console.log(`🚪 [Handle Expired] Event sent to window: ${win.getTitle()}`);
        } else {
          console.log(`🚪 [Handle Expired] Window ${win.getTitle()} is destroyed, skipping`);
        }
      }

      console.log('🚪 [Handle Expired] ========== SIGN-OUT PROCESS COMPLETE ==========');
    } catch (error) {
      console.error('❌ [Handle Expired] ERROR handling access expiration:', error);
      console.error('❌ [Handle Expired] Error stack:', error instanceof Error ? error.stack : 'No stack');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.CRITICAL,
        component: 'SupabaseService',
        context: { action: 'handleAccessExpired', accessStatus }
      });
    }
  }

  /**
   * Clean up resources (stops checks but keeps user signed in)
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up SupabaseService...');
    this.stopPeriodicCheck();
    // Don't clear user token - let them stay signed in across app restarts
    console.log('✅ SupabaseService cleanup completed');
  }
}
