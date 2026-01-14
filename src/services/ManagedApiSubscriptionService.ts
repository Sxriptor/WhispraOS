import { ManagedApiRouter } from './ManagedApiRouter';
import { UsageMonitorService } from './UsageMonitorService';
import { SubscriptionCacheService } from './SubscriptionCacheService';

/**
 * Service to handle subscription integration for managed API features
 */
export class ManagedApiSubscriptionService {
  private static instance: ManagedApiSubscriptionService;
  private managedApiRouter: ManagedApiRouter;
  private usageMonitor: UsageMonitorService;
  private subscriptionCache: SubscriptionCacheService;
  private isInitialized = false;

  private constructor() {
    this.managedApiRouter = ManagedApiRouter.getInstance();
    this.usageMonitor = UsageMonitorService.getInstance();
    this.subscriptionCache = SubscriptionCacheService.getInstance();
  }

  public static getInstance(): ManagedApiSubscriptionService {
    if (!ManagedApiSubscriptionService.instance) {
      ManagedApiSubscriptionService.instance = new ManagedApiSubscriptionService();
    }
    return ManagedApiSubscriptionService.instance;
  }

  /**
   * Initialize the subscription service
   */
  public async initialize(userToken: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🔧 Initializing ManagedApiSubscriptionService...');

    // Set user tokens
    this.managedApiRouter.setUserToken(userToken);
    this.usageMonitor.setUserToken(userToken);

    // Check initial subscription status and set appropriate mode using cached data
    console.log('🔄 Checking and updating API mode during initialization...');
    await this.checkAndUpdateMode();

    this.isInitialized = true;
    console.log('✅ ManagedApiSubscriptionService initialized');
  }

  /**
   * Cleanup the subscription service
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up ManagedApiSubscriptionService...');
    
    this.usageMonitor.clearUserToken();
    this.managedApiRouter.setUserToken('');
    
    this.isInitialized = false;
    console.log('✅ ManagedApiSubscriptionService cleanup completed');
  }

  /**
   * Check subscription status and update API mode accordingly
   */
  public async checkAndUpdateMode(): Promise<void> {
    if (!this.isInitialized) {
      console.log('⚠️ ManagedApiSubscriptionService not initialized, skipping mode check');
      return;
    }
    
    try {
      const currentMode = this.managedApiRouter.getMode();
      
      // Use cached subscription data instead of making fresh API calls
      const cachedData = this.subscriptionCache.getCachedData();
      const hasManagedSubscription = cachedData?.hasManagedAPI ?? false;

      console.log(`📊 Subscription check (cached): currentMode=${currentMode}, hasManagedSubscription=${hasManagedSubscription}`);

      // Respect user's choice - do not automatically switch to managed mode
      // Users with managed subscriptions can choose to use personal mode if they prefer
      if (hasManagedSubscription && currentMode === 'personal') {
        console.log('✅ User has managed subscription but chose personal mode - respecting their choice');
        console.log('🔑 User will continue using their personal API keys instead of managed backend');
      } else if (hasManagedSubscription && currentMode === 'managed') {
        console.log('✅ User has managed subscription and chose managed mode - using managed backend');
      } else if (!hasManagedSubscription && currentMode === 'personal') {
        console.log('📋 User does not have managed subscription - using personal mode');
      }

      // If user is in managed mode but doesn't have subscription, switch to personal
      if (currentMode === 'managed' && !hasManagedSubscription) {
        console.warn('⚠️ User in managed mode but no active subscription, switching to personal mode');
        await this.managedApiRouter.setMode('personal');
        
        // Send IPC event to update UI
        try {
          const { BrowserWindow } = require('electron');
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('managed-api-mode-changed', { 
              mode: 'personal',
              reason: 'subscription_expired'
            });
          }
        } catch (error) {
          console.warn('Failed to send mode change event to renderer:', error);
        }
      }

    } catch (error) {
      console.error('Failed to check and update API mode:', error);
    }
  }

  /**
   * Handle subscription status changes
   */
  public async handleSubscriptionChange(subscriptionStatus: any): Promise<void> {
    try {
      console.log('📢 Handling subscription change:', subscriptionStatus);

      // Check if managed API access is affected
      const hasManagedAccess = await this.managedApiRouter.validateManagedAccess();
      const currentMode = this.managedApiRouter.getMode();

      if (currentMode === 'managed' && !hasManagedAccess) {
        // Subscription expired or canceled while in managed mode
        console.warn('🚫 Managed API access lost, switching to personal mode');
        
        await this.managedApiRouter.setMode('personal');
        
        // Show notification to user
        this.showSubscriptionExpiredNotification();
        
        // Send IPC event to update UI
        try {
          const { BrowserWindow } = require('electron');
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('managed-api-mode-changed', { 
              mode: 'personal',
              reason: 'subscription_lost'
            });
          }
        } catch (error) {
          console.warn('Failed to send mode change event to renderer:', error);
        }
      }

    } catch (error) {
      console.error('Failed to handle subscription change:', error);
    }
  }



  /**
   * Show notification when subscription expires
   */
  private showSubscriptionExpiredNotification(): void {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #F44336;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      line-height: 1.4;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 16px;">⚠️</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">Subscription Required</div>
          <div style="font-size: 13px; opacity: 0.9;">
            Your managed API access has expired. Switched to personal API keys mode.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Get current subscription status for managed API
   */
  public async getManagedApiSubscriptionStatus(): Promise<{
    hasAccess: boolean;
    hasActiveSubscription: boolean;
    hasManagedApiPlan: boolean;
    planName?: string;
    expiresAt?: string;
  }> {
    try {
      // Use cached subscription data instead of making fresh API calls
      const cachedData = this.subscriptionCache.getCachedData();
      
      if (!cachedData) {
        console.warn('⚠️ No cached subscription data available');
        return {
          hasAccess: false,
          hasActiveSubscription: false,
          hasManagedApiPlan: false
        };
      }
      
      console.log(`🔍 Managed API subscription check (cached): hasActiveSubscription=${cachedData.hasActiveSubscription}, hasManagedAPI=${cachedData.hasManagedAPI}, planName=${cachedData.subscriptionPlan}`);
      
      return {
        hasAccess: cachedData.hasAccess,
        hasActiveSubscription: cachedData.hasActiveSubscription,
        hasManagedApiPlan: cachedData.hasManagedAPI,
        planName: cachedData.subscriptionPlan,
        expiresAt: cachedData.expiresAt || ''
      };
    } catch (error) {
      console.error('Failed to get managed API subscription status:', error);
      return {
        hasAccess: false,
        hasActiveSubscription: false,
        hasManagedApiPlan: false
      };
    }
  }

  /**
   * Check if a plan includes managed API access
   */
  private isManagedApiPlan(planName?: string): boolean {
    if (!planName) return false;
    
    // Define which plans include managed API access
    const managedApiPlans = [
      'whispra-pro',
      'whispra-premium', 
      'whispra-managed',
      'pro-monthly',
      'pro-yearly',
      'premium-monthly',
      'premium-yearly',
      'ultra',
      'whispra-ultra'
    ];
    
    return managedApiPlans.some(plan => 
      planName.toLowerCase().includes(plan.toLowerCase())
    );
  }

  /**
   * Check if user should be offered managed API upgrade
   */
  public async shouldOfferManagedApiUpgrade(): Promise<boolean> {
    try {
      const status = await this.getManagedApiSubscriptionStatus();
      
      // Offer upgrade if user has active subscription but not managed API plan
      return status.hasActiveSubscription && !status.hasManagedApiPlan;
    } catch (error) {
      console.error('Failed to check upgrade eligibility:', error);
      return false;
    }
  }

  /**
   * Get managed API plan pricing info
   */
  public getManagedApiPlanInfo(): {
    monthlyPrice: number;
    yearlyPrice: number;
    usageLimit: number;
    features: string[];
  } {
    return {
      monthlyPrice: 20,
      yearlyPrice: 200, // $16.67/month when billed yearly
      usageLimit: 10, // $10 usage limit
      features: [
        'No API key setup required',
        '$20 monthly usage included',
        'OpenAI and ElevenLabs access',
        'Usage tracking and limits',
        'Priority support'
      ]
    };
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}