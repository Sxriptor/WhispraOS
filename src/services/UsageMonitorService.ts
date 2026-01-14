import { WhispraApiClient, UsageData } from './WhispraApiClient';

/**
 * Usage threshold levels
 */
export interface UsageThreshold {
  level: 'safe' | 'warning' | 'critical' | 'exceeded';
  percentage: number;
  message: string;
}

/**
 * Usage update callback type
 */
export type UsageUpdateCallback = (usage: UsageData) => void;

/**
 * Monitors and tracks API usage for managed services
 */
export class UsageMonitorService {
  private static instance: UsageMonitorService;
  private whispraClient: WhispraApiClient;
  private currentUsage: UsageData | null = null;
  private updateCallbacks: Set<UsageUpdateCallback> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshIntervalMs = 15000; // 15 seconds
  private usageLimit = 10.00; // $10 limit

  private constructor() {
    this.whispraClient = WhispraApiClient.getInstance();
  }

  public static getInstance(): UsageMonitorService {
    if (!UsageMonitorService.instance) {
      UsageMonitorService.instance = new UsageMonitorService();
    }
    return UsageMonitorService.instance;
  }

  /**
   * Start monitoring usage with periodic updates
   */
  public startMonitoring(): void {
    console.log('📊 Starting usage monitoring...');
    
    // Initial fetch
    this.refreshUsage();

    // Set up periodic refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.refreshUsage();
    }, this.refreshIntervalMs);
  }

  /**
   * Stop monitoring usage
   */
  public stopMonitoring(): void {
    console.log('🛑 Stopping usage monitoring...');
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Get current usage data
   */
  public async getCurrentUsage(): Promise<UsageData> {
    if (!this.currentUsage) {
      await this.refreshUsage();
    }
    
    return this.currentUsage || {
      totalCost: 0,
      remainingBalance: this.usageLimit,
      billingPeriodStart: '',
      billingPeriodEnd: '',
      lastUpdated: new Date().toISOString(),
      isLimitExceeded: false
    };
  }

  /**
   * Subscribe to usage updates
   */
  public subscribeToUsageUpdates(callback: UsageUpdateCallback): void {
    this.updateCallbacks.add(callback);
    
    // Immediately call with current data if available
    if (this.currentUsage) {
      callback(this.currentUsage);
    }
  }

  /**
   * Unsubscribe from usage updates
   */
  public unsubscribeFromUsageUpdates(callback: UsageUpdateCallback): void {
    this.updateCallbacks.delete(callback);
  }

  /**
   * Check usage thresholds and return current level
   */
  public checkUsageThresholds(): UsageThreshold {
    if (!this.currentUsage) {
      return {
        level: 'safe',
        percentage: 0,
        message: 'Usage data not available'
      };
    }

    const percentage = (this.currentUsage.totalCost / this.usageLimit) * 100;

    if (this.currentUsage.isLimitExceeded || percentage >= 100) {
      return {
        level: 'exceeded',
        percentage: Math.min(percentage, 100),
        message: 'Usage limit exceeded. Switch to personal API keys or wait for next billing period.'
      };
    } else if (percentage >= 95) {
      return {
        level: 'critical',
        percentage,
        message: `Critical: ${percentage.toFixed(1)}% of usage limit reached. Consider switching to personal keys.`
      };
    } else if (percentage >= 80) {
      return {
        level: 'warning',
        percentage,
        message: `Warning: ${percentage.toFixed(1)}% of usage limit reached.`
      };
    } else {
      return {
        level: 'safe',
        percentage,
        message: `${percentage.toFixed(1)}% of usage limit used. $${this.currentUsage.remainingBalance.toFixed(2)} remaining.`
      };
    }
  }

  /**
   * Refresh usage data from backend
   */
  public async refreshUsage(): Promise<void> {
    try {
      console.log('🔄 Refreshing usage data...');
      
      const usage = await this.whispraClient.getCurrentUsage();
      const previousUsage = this.currentUsage;
      this.currentUsage = usage;

      console.log('📊 Usage data updated:', {
        totalCost: usage.totalCost,
        remainingBalance: usage.remainingBalance,
        isLimitExceeded: usage.isLimitExceeded,
        lastUpdated: usage.lastUpdated
      });

      // Notify all subscribers
      this.updateCallbacks.forEach(callback => {
        try {
          callback(usage);
        } catch (error) {
          console.error('Error in usage update callback:', error);
        }
      });

      // Check for threshold changes and log warnings
      const threshold = this.checkUsageThresholds();
      if (threshold.level === 'warning' || threshold.level === 'critical') {
        console.warn(`⚠️ Usage threshold: ${threshold.message}`);
      } else if (threshold.level === 'exceeded') {
        console.error(`🚫 Usage limit exceeded: ${threshold.message}`);
      }

    } catch (error) {
      console.error('Failed to refresh usage data:', error);
      
      // If we can't fetch usage data, don't update current usage
      // This prevents false "no usage" states during network issues
    }
  }

  /**
   * Get usage limit
   */
  public getUsageLimit(): number {
    return this.usageLimit;
  }

  /**
   * Set usage limit (for testing or configuration changes)
   */
  public setUsageLimit(limit: number): void {
    this.usageLimit = limit;
  }

  /**
   * Set refresh interval
   */
  public setRefreshInterval(intervalMs: number): void {
    this.refreshIntervalMs = intervalMs;
    
    // Restart monitoring with new interval if currently running
    if (this.refreshInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Get refresh interval
   */
  public getRefreshInterval(): number {
    return this.refreshIntervalMs;
  }

  /**
   * Check if monitoring is active
   */
  public isMonitoring(): boolean {
    return this.refreshInterval !== null;
  }

  /**
   * Get cached usage data without refreshing
   */
  public getCachedUsage(): UsageData | null {
    return this.currentUsage;
  }

  /**
   * Clear cached usage data
   */
  public clearCache(): void {
    this.currentUsage = null;
  }

  /**
   * Set user token for API calls
   */
  public setUserToken(token: string): void {
    this.whispraClient.setUserToken(token);
  }

  /**
   * Clear user token
   */
  public clearUserToken(): void {
    this.whispraClient.clearUserToken();
    this.clearCache();
  }
}