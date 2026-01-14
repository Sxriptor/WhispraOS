/**
 * Centralized subscription cache service that manages all subscription state
 * and eliminates redundant authentication checks during startup.
 * 
 * This service follows the new subscription check rules:
 * 1. Check subscription ONCE at app startup
 * 2. Re-check ONLY when necessary (token change, expiration, manual refresh)
 * 3. Never check during normal app operations
 */

import { SupabaseService } from './SupabaseService';
import { WhispraApiClient } from './WhispraApiClient';
import { AuthManager } from './AuthManager';

export interface SubscriptionCacheData {
  hasAccess: boolean;
  hasActiveSubscription: boolean;
  hasManagedAPI: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  planTier: string;
  expiresAt: string | null;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  lastChecked: number;
  userToken: string;
}

export class SubscriptionCacheService {
  private static instance: SubscriptionCacheService;
  private cache: SubscriptionCacheData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private expirationTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  // Refresh interval: 45 minutes (configurable)
  private readonly REFRESH_INTERVAL_MS = 45 * 60 * 1000;
  
  // Cache validity: 60 minutes
  private readonly CACHE_VALIDITY_MS = 60 * 60 * 1000;

  private constructor() {}

  public static getInstance(): SubscriptionCacheService {
    if (!SubscriptionCacheService.instance) {
      SubscriptionCacheService.instance = new SubscriptionCacheService();
    }
    return SubscriptionCacheService.instance;
  }

  /**
   * Initialize subscription cache on app startup
   * This is the ONLY place where subscription checks should happen automatically
   */
  public async initialize(): Promise<void> {
    console.log('🔄 Initializing subscription cache...');
    
    // Clear any existing cache first
    this.clearCache();
    
    try {
      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();
      
      if (!userToken) {
        console.log('❌ No user token found - skipping subscription cache initialization');
        return;
      }

      await this.refreshCache(userToken);
      this.schedulePeriodicRefresh();
      
      // Initialize ManagedApiSubscriptionService with the user token
      try {
        const { ManagedApiSubscriptionService } = await import('./ManagedApiSubscriptionService');
        const managedApiService = ManagedApiSubscriptionService.getInstance();
        await managedApiService.initialize(userToken);
        console.log('✅ ManagedApiSubscriptionService initialized with subscription cache');
      } catch (error) {
        console.warn('⚠️ Failed to initialize ManagedApiSubscriptionService:', error);
      }
      
      console.log('✅ Subscription cache initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize subscription cache:', error);
    }
  }

  /**
   * Get cached subscription data without triggering a refresh
   * This should be used by all modules that need subscription info
   */
  public getCachedData(): SubscriptionCacheData | null {
    if (!this.cache) {
      console.warn('⚠️ Subscription cache not initialized - returning null');
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    const cacheAge = now - this.cache.lastChecked;
    
    if (cacheAge > this.CACHE_VALIDITY_MS) {
      console.warn('⚠️ Subscription cache is stale - consider refreshing');
    }

    return this.cache;
  }

  /**
   * Force refresh subscription data
   * Should only be called in specific scenarios (token change, manual refresh, etc.)
   */
  public async forceRefresh(reason: string): Promise<SubscriptionCacheData | null> {
    console.log(`🔄 Force refreshing subscription cache - reason: ${reason}`);
    
    try {
      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();
      
      if (!userToken) {
        console.log('❌ No user token found - clearing cache');
        this.clearCache();
        return null;
      }

      return await this.refreshCache(userToken);
    } catch (error) {
      console.error('❌ Failed to force refresh subscription cache:', error);
      return null;
    }
  }

  /**
   * Handle token change - refresh cache with new token
   */
  public async onTokenChange(newToken: string | null): Promise<void> {
    if (!newToken) {
      console.log('🧹 Token cleared - clearing subscription cache');
      this.clearCache();
      return;
    }

    // Only refresh if token actually changed
    if (this.cache && this.cache.userToken === newToken) {
      console.log('🔄 Token unchanged - skipping cache refresh');
      return;
    }

    // Clear cache before refreshing with new token
    this.clearCache();
    await this.forceRefresh('token change');
  }

  /**
   * Handle API key changes - refresh cache to check managed API status
   */
  public async onApiKeysChanged(): Promise<void> {
    await this.forceRefresh('API keys changed');
    
    // Trigger mode check in ManagedApiSubscriptionService
    try {
      const { ManagedApiSubscriptionService } = await import('./ManagedApiSubscriptionService');
      const managedApiService = ManagedApiSubscriptionService.getInstance();
      await managedApiService.checkAndUpdateMode();
      console.log('✅ Triggered mode check after API key change');
    } catch (error) {
      console.warn('⚠️ Failed to trigger mode check after API key change:', error);
    }
  }

  /**
   * Handle managed mode toggle - refresh cache to update managed API status
   */
  public async onManagedModeChanged(): Promise<void> {
    await this.forceRefresh('managed mode changed');
    
    // Trigger mode check in ManagedApiSubscriptionService
    try {
      const { ManagedApiSubscriptionService } = await import('./ManagedApiSubscriptionService');
      const managedApiService = ManagedApiSubscriptionService.getInstance();
      await managedApiService.checkAndUpdateMode();
      console.log('✅ Triggered mode check after managed mode change');
    } catch (error) {
      console.warn('⚠️ Failed to trigger mode check after managed mode change:', error);
    }
  }

  /**
   * Clear all cached data and stop timers
   */
  public clearCache(): void {
    console.log('🧹 Clearing subscription cache');
    
    // Cleanup ManagedApiSubscriptionService
    try {
      const { ManagedApiSubscriptionService } = require('./ManagedApiSubscriptionService');
      const managedApiService = ManagedApiSubscriptionService.getInstance();
      managedApiService.cleanup();
      console.log('✅ ManagedApiSubscriptionService cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup ManagedApiSubscriptionService:', error);
    }
    
    this.cache = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  /**
   * Cleanup on app shutdown
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up subscription cache service');
    this.clearCache();
  }

  /**
   * Internal method to refresh cache data
   */
  private async refreshCache(userToken: string): Promise<SubscriptionCacheData | null> {
    if (this.isRefreshing) {
      console.log('🔄 Cache refresh already in progress - skipping');
      return this.cache;
    }

    this.isRefreshing = true;
    
    try {
      console.log('🔄 Refreshing subscription cache data...');
      
      // Get Supabase subscription data
      const supabaseService = SupabaseService.getInstance();
      await supabaseService.setUserToken(userToken);
      const accessStatus = await supabaseService.checkUserAccess();

      // Check managed API status if user has managed API plan
      let managedApiActive = false;
      console.log(`🔍 Checking managed API status: accessStatus.hasManagedAPI = ${accessStatus.hasManagedAPI}`);
      
      if (accessStatus.hasManagedAPI) {
        console.log('🔍 User has managed API access, checking Whispra API status...');
        try {
          const whispraClient = WhispraApiClient.getInstance();
          whispraClient.setUserToken(userToken);
          console.log('🔍 Calling whispraClient.checkSubscriptionStatus()...');
          const managedStatus = await whispraClient.checkSubscriptionStatus();
          console.log('🔍 Whispra API managed status:', JSON.stringify(managedStatus, null, 2));
          console.log(`🔍 managedStatus.hasAccess: ${managedStatus.hasAccess}`);
          console.log(`🔍 managedStatus.subscriptionActive: ${managedStatus.subscriptionActive}`);
          managedApiActive = managedStatus.hasAccess && managedStatus.subscriptionActive;
          console.log(`🔍 Final managedApiActive: ${managedApiActive}`);
        } catch (error) {
          console.warn('⚠️ Failed to check managed API status:', error);
          console.warn('⚠️ Error details:', error);
        }
      } else {
        console.log('🔍 accessStatus.hasManagedAPI is false, skipping Whispra API check');
      }

      // Build cache data
      const cacheData: SubscriptionCacheData = {
        hasAccess: accessStatus.hasAccess ?? false,
        hasActiveSubscription: accessStatus.hasActiveSubscription ?? false,
        hasManagedAPI: (accessStatus.hasManagedAPI ?? false) && managedApiActive,
        subscriptionPlan: accessStatus.subscriptionPlan ?? 'none',
        subscriptionStatus: accessStatus.subscriptionStatus ?? 'inactive',
        planTier: accessStatus.planTier ?? 'pro',
        expiresAt: null, // TODO: Add expiresAt to UserAccessStatus interface
        isTrialActive: accessStatus.isTrialActive ?? false,
        trialDaysRemaining: accessStatus.trialDaysRemaining ?? 0,
        lastChecked: Date.now(),
        userToken
      };

      this.cache = cacheData;
      
      // Schedule expiration check if we have an expiration date
      this.scheduleExpirationCheck();
      
      console.log('✅ Subscription cache refreshed successfully');
      console.log(`📊 Cache data: hasAccess=${cacheData.hasAccess}, hasSubscription=${cacheData.hasActiveSubscription}, hasManagedAPI=${cacheData.hasManagedAPI}`);
      
      // Trigger mode check in ManagedApiSubscriptionService after cache refresh
      try {
        const { ManagedApiSubscriptionService } = await import('./ManagedApiSubscriptionService');
        const managedApiService = ManagedApiSubscriptionService.getInstance();
        if (managedApiService) {
          await managedApiService.checkAndUpdateMode();
          console.log('✅ Triggered mode check after cache refresh');
        }
      } catch (error) {
        console.warn('⚠️ Failed to trigger mode check after cache refresh:', error);
      }
      
      return cacheData;
      
    } catch (error) {
      console.error('❌ Failed to refresh subscription cache:', error);
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Schedule periodic cache refresh
   */
  private schedulePeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(async () => {
      await this.forceRefresh('periodic refresh');
      this.schedulePeriodicRefresh(); // Schedule next refresh
    }, this.REFRESH_INTERVAL_MS);

    console.log(`⏰ Scheduled next subscription cache refresh in ${this.REFRESH_INTERVAL_MS / 60000} minutes`);
  }

  /**
   * Schedule expiration check based on subscription expiration date
   */
  private scheduleExpirationCheck(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    if (!this.cache?.expiresAt) {
      return;
    }

    try {
      const expirationTime = new Date(this.cache.expiresAt).getTime();
      const now = Date.now();
      const timeUntilExpiration = expirationTime - now;

      // Schedule refresh 5 minutes before expiration
      const refreshTime = Math.max(0, timeUntilExpiration - (5 * 60 * 1000));

      if (refreshTime > 0) {
        this.expirationTimer = setTimeout(async () => {
          await this.forceRefresh('approaching expiration');
        }, refreshTime);

        console.log(`⏰ Scheduled expiration refresh in ${refreshTime / 60000} minutes`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to schedule expiration check:', error);
    }
  }

  /**
   * Convenience methods for common checks
   */
  public hasAccess(): boolean {
    return this.cache?.hasAccess ?? false;
  }

  public hasActiveSubscription(): boolean {
    return this.cache?.hasActiveSubscription ?? false;
  }

  public hasManagedAPI(): boolean {
    return this.cache?.hasManagedAPI ?? false;
  }

  public isTrialActive(): boolean {
    return this.cache?.isTrialActive ?? false;
  }

  public getSubscriptionPlan(): string {
    return this.cache?.subscriptionPlan ?? 'none';
  }

  public getTrialDaysRemaining(): number {
    return this.cache?.trialDaysRemaining ?? 0;
  }
}