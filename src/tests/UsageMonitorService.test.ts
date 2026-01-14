import { UsageMonitorService, UsageThreshold } from '../services/UsageMonitorService';
import { WhispraApiClient, UsageData } from '../services/WhispraApiClient';

// Mock dependencies
jest.mock('../services/WhispraApiClient');

describe('UsageMonitorService', () => {
  let usageMonitor: UsageMonitorService;
  let mockWhispraClient: jest.Mocked<WhispraApiClient>;

  beforeEach(() => {
    // Reset singleton
    (UsageMonitorService as any).instance = undefined;
    
    // Create mock WhispraApiClient
    mockWhispraClient = {
      setUserToken: jest.fn(),
      clearUserToken: jest.fn(),
      getCurrentUsage: jest.fn()
    } as any;

    (WhispraApiClient.getInstance as jest.Mock).mockReturnValue(mockWhispraClient);

    usageMonitor = UsageMonitorService.getInstance();
  });

  afterEach(() => {
    usageMonitor.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('Usage Data Management', () => {
    test('should fetch current usage data', async () => {
      const mockUsage: UsageData = {
        totalCost: 5.50,
        remainingBalance: 4.50,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      mockWhispraClient.getCurrentUsage.mockResolvedValue(mockUsage);

      const usage = await usageMonitor.getCurrentUsage();
      
      expect(usage).toEqual(mockUsage);
      expect(mockWhispraClient.getCurrentUsage).toHaveBeenCalled();
    });

    test('should return default usage when no data available', async () => {
      const usage = await usageMonitor.getCurrentUsage();
      
      expect(usage).toEqual({
        totalCost: 0,
        remainingBalance: 10,
        billingPeriodStart: '',
        billingPeriodEnd: '',
        lastUpdated: expect.any(String),
        isLimitExceeded: false
      });
    });

    test('should cache usage data', async () => {
      const mockUsage: UsageData = {
        totalCost: 3.25,
        remainingBalance: 6.75,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      mockWhispraClient.getCurrentUsage.mockResolvedValue(mockUsage);

      // First call should fetch from API
      await usageMonitor.getCurrentUsage();
      
      // Second call should use cached data
      const cachedUsage = usageMonitor.getCachedUsage();
      
      expect(cachedUsage).toEqual(mockUsage);
      expect(mockWhispraClient.getCurrentUsage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Usage Thresholds', () => {
    test('should return safe threshold for low usage', () => {
      // Set cached usage data
      (usageMonitor as any).currentUsage = {
        totalCost: 2.00,
        remainingBalance: 8.00,
        isLimitExceeded: false
      };

      const threshold = usageMonitor.checkUsageThresholds();
      
      expect(threshold.level).toBe('safe');
      expect(threshold.percentage).toBe(20);
      expect(threshold.message).toContain('20.0%');
    });

    test('should return warning threshold at 80%', () => {
      (usageMonitor as any).currentUsage = {
        totalCost: 8.00,
        remainingBalance: 2.00,
        isLimitExceeded: false
      };

      const threshold = usageMonitor.checkUsageThresholds();
      
      expect(threshold.level).toBe('warning');
      expect(threshold.percentage).toBe(80);
      expect(threshold.message).toContain('Warning');
    });

    test('should return critical threshold at 95%', () => {
      (usageMonitor as any).currentUsage = {
        totalCost: 9.50,
        remainingBalance: 0.50,
        isLimitExceeded: false
      };

      const threshold = usageMonitor.checkUsageThresholds();
      
      expect(threshold.level).toBe('critical');
      expect(threshold.percentage).toBe(95);
      expect(threshold.message).toContain('Critical');
    });

    test('should return exceeded threshold when limit reached', () => {
      (usageMonitor as any).currentUsage = {
        totalCost: 10.00,
        remainingBalance: 0.00,
        isLimitExceeded: true
      };

      const threshold = usageMonitor.checkUsageThresholds();
      
      expect(threshold.level).toBe('exceeded');
      expect(threshold.percentage).toBe(100);
      expect(threshold.message).toContain('exceeded');
    });

    test('should handle no usage data gracefully', () => {
      const threshold = usageMonitor.checkUsageThresholds();
      
      expect(threshold.level).toBe('safe');
      expect(threshold.percentage).toBe(0);
      expect(threshold.message).toContain('not available');
    });
  });

  describe('Monitoring Lifecycle', () => {
    test('should start monitoring with periodic updates', () => {
      jest.useFakeTimers();
      
      usageMonitor.startMonitoring();
      
      expect(usageMonitor.isMonitoring()).toBe(true);
      
      // Fast-forward time to trigger interval
      jest.advanceTimersByTime(15000);
      
      expect(mockWhispraClient.getCurrentUsage).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should stop monitoring', () => {
      usageMonitor.startMonitoring();
      expect(usageMonitor.isMonitoring()).toBe(true);
      
      usageMonitor.stopMonitoring();
      expect(usageMonitor.isMonitoring()).toBe(false);
    });

    test('should handle refresh errors gracefully', async () => {
      mockWhispraClient.getCurrentUsage.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(usageMonitor.refreshUsage()).resolves.toBeUndefined();
    });
  });

  describe('Subscription Management', () => {
    test('should manage update callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      usageMonitor.subscribeToUsageUpdates(callback1);
      usageMonitor.subscribeToUsageUpdates(callback2);

      // Simulate usage update
      const mockUsage: UsageData = {
        totalCost: 1.00,
        remainingBalance: 9.00,
        billingPeriodStart: '',
        billingPeriodEnd: '',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      (usageMonitor as any).currentUsage = mockUsage;
      (usageMonitor as any).updateCallbacks.forEach((cb: any) => cb(mockUsage));

      expect(callback1).toHaveBeenCalledWith(mockUsage);
      expect(callback2).toHaveBeenCalledWith(mockUsage);

      // Unsubscribe one callback
      usageMonitor.unsubscribeFromUsageUpdates(callback1);
      
      (usageMonitor as any).updateCallbacks.forEach((cb: any) => cb(mockUsage));
      
      expect(callback1).toHaveBeenCalledTimes(1); // Not called again
      expect(callback2).toHaveBeenCalledTimes(2); // Called again
    });

    test('should call callback immediately with current data', () => {
      const mockUsage: UsageData = {
        totalCost: 2.50,
        remainingBalance: 7.50,
        billingPeriodStart: '',
        billingPeriodEnd: '',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      (usageMonitor as any).currentUsage = mockUsage;

      const callback = jest.fn();
      usageMonitor.subscribeToUsageUpdates(callback);

      expect(callback).toHaveBeenCalledWith(mockUsage);
    });
  });

  describe('Configuration', () => {
    test('should allow setting usage limit', () => {
      usageMonitor.setUsageLimit(15);
      
      expect(usageMonitor.getUsageLimit()).toBe(15);
    });

    test('should allow setting refresh interval', () => {
      usageMonitor.setRefreshInterval(30000);
      
      expect(usageMonitor.getRefreshInterval()).toBe(30000);
    });

    test('should restart monitoring when interval changes', () => {
      jest.spyOn(usageMonitor, 'stopMonitoring');
      jest.spyOn(usageMonitor, 'startMonitoring');

      usageMonitor.startMonitoring();
      usageMonitor.setRefreshInterval(30000);

      expect(usageMonitor.stopMonitoring).toHaveBeenCalled();
      expect(usageMonitor.startMonitoring).toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    test('should set user token on WhispraApiClient', () => {
      const token = 'test-token';
      
      usageMonitor.setUserToken(token);
      
      expect(mockWhispraClient.setUserToken).toHaveBeenCalledWith(token);
    });

    test('should clear user token and cache', () => {
      usageMonitor.clearUserToken();
      
      expect(mockWhispraClient.clearUserToken).toHaveBeenCalled();
      expect(usageMonitor.getCachedUsage()).toBeNull();
    });
  });
});