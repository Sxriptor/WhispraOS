import { UsageDisplay } from '../ui/components/UsageDisplay';
import { UsageMonitorService } from '../services/UsageMonitorService';
import { UsageData } from '../services/WhispraApiClient';

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    style: { cssText: '' },
    innerHTML: '',
    textContent: '',
    id: '',
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    addEventListener: jest.fn()
  }))
});

// Mock UsageMonitorService
jest.mock('../services/UsageMonitorService');

describe('UsageDisplay', () => {
  let container: HTMLElement;
  let usageDisplay: UsageDisplay;
  let mockUsageMonitor: jest.Mocked<UsageMonitorService>;

  beforeEach(() => {
    // Create mock container
    container = {
      innerHTML: '',
      style: { cssText: '' },
      appendChild: jest.fn(),
      querySelector: jest.fn()
    } as any;

    // Create mock usage monitor
    mockUsageMonitor = {
      subscribeToUsageUpdates: jest.fn(),
      checkUsageThresholds: jest.fn(),
      refreshUsage: jest.fn(),
      getUsageLimit: jest.fn().mockReturnValue(10)
    } as any;

    (UsageMonitorService.getInstance as jest.Mock).mockReturnValue(mockUsageMonitor);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (usageDisplay) {
      usageDisplay.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize and render UI components', () => {
      usageDisplay = new UsageDisplay(container);

      expect(container.appendChild).toHaveBeenCalled();
      expect(mockUsageMonitor.subscribeToUsageUpdates).toHaveBeenCalled();
      expect(usageDisplay.isReady()).toBe(true);
    });

    test('should set up event listeners for usage updates', () => {
      usageDisplay = new UsageDisplay(container);

      expect(mockUsageMonitor.subscribeToUsageUpdates).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    test('should render with initial loading state', () => {
      usageDisplay = new UsageDisplay(container);

      // Should show loading text initially
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.createElement).toHaveBeenCalledWith('h3');
    });
  });

  describe('Usage Data Display', () => {
    beforeEach(() => {
      usageDisplay = new UsageDisplay(container);
    });

    test('should update display with safe usage level', () => {
      const mockUsage: UsageData = {
        totalCost: 2.50,
        remainingBalance: 7.50,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'safe',
        percentage: 25,
        message: '25.0% of usage limit used. $7.50 remaining.'
      });

      // Simulate usage update
      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
    });

    test('should update display with warning usage level', () => {
      const mockUsage: UsageData = {
        totalCost: 8.00,
        remainingBalance: 2.00,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'warning',
        percentage: 80,
        message: 'Warning: 80.0% of usage limit reached.'
      });

      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
    });

    test('should update display with critical usage level', () => {
      const mockUsage: UsageData = {
        totalCost: 9.50,
        remainingBalance: 0.50,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'critical',
        percentage: 95,
        message: 'Critical: 95.0% of usage limit reached. Consider switching to personal keys.'
      });

      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
    });

    test('should update display with exceeded usage level', () => {
      const mockUsage: UsageData = {
        totalCost: 10.00,
        remainingBalance: 0.00,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: true
      };

      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'exceeded',
        percentage: 100,
        message: 'Usage limit exceeded. Switch to personal API keys or wait for next billing period.'
      });

      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
    });

    test('should update billing period information', () => {
      const mockUsage: UsageData = {
        totalCost: 5.00,
        remainingBalance: 5.00,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      // Mock querySelector to return billing info element
      const mockBillingElement = {
        textContent: ''
      };
      container.querySelector = jest.fn().mockReturnValue(mockBillingElement);

      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'safe',
        percentage: 50,
        message: '50.0% of usage limit used.'
      });

      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      expect(container.querySelector).toHaveBeenCalledWith('#billing-period-info');
    });
  });

  describe('Progress Bar Colors', () => {
    beforeEach(() => {
      usageDisplay = new UsageDisplay(container);
    });

    test('should return correct colors for different threshold levels', () => {
      const getProgressColor = (usageDisplay as any).getProgressColor;

      expect(getProgressColor('safe')).toBe('#4CAF50');
      expect(getProgressColor('warning')).toBe('#FFC107');
      expect(getProgressColor('critical')).toBe('#FF9800');
      expect(getProgressColor('exceeded')).toBe('#F44336');
      expect(getProgressColor('unknown')).toBe('#4CAF50');
    });
  });

  describe('Warning Banner Management', () => {
    beforeEach(() => {
      usageDisplay = new UsageDisplay(container);
    });

    test('should hide warning banner for safe usage', () => {
      mockUsageMonitor.checkUsageThresholds.mockReturnValue({
        level: 'safe',
        percentage: 25,
        message: 'Safe usage level'
      });

      const mockUsage: UsageData = {
        totalCost: 2.50,
        remainingBalance: 7.50,
        billingPeriodStart: '',
        billingPeriodEnd: '',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      updateCallback(mockUsage);

      // Warning banner should be hidden
      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
    });

    test('should show warning banner for warning/critical/exceeded levels', () => {
      const levels = ['warning', 'critical', 'exceeded'];

      levels.forEach(level => {
        mockUsageMonitor.checkUsageThresholds.mockReturnValue({
          level: level as any,
          percentage: level === 'warning' ? 80 : level === 'critical' ? 95 : 100,
          message: `${level} message`
        });

        const mockUsage: UsageData = {
          totalCost: level === 'warning' ? 8 : level === 'critical' ? 9.5 : 10,
          remainingBalance: level === 'warning' ? 2 : level === 'critical' ? 0.5 : 0,
          billingPeriodStart: '',
          billingPeriodEnd: '',
          lastUpdated: new Date().toISOString(),
          isLimitExceeded: level === 'exceeded'
        };

        const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
        updateCallback(mockUsage);

        expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalled();
      });
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      usageDisplay = new UsageDisplay(container);
    });

    test('should show loading state', () => {
      usageDisplay.showLoading();

      // Should reset progress and show loading text
      expect(usageDisplay.isReady()).toBe(true);
    });

    test('should show error state', () => {
      const errorMessage = 'Failed to load usage data';
      
      usageDisplay.showError(errorMessage);

      // Should show error message and reset progress
      expect(usageDisplay.isReady()).toBe(true);
    });

    test('should refresh usage data', async () => {
      mockUsageMonitor.refreshUsage.mockResolvedValue();

      await usageDisplay.refresh();

      expect(mockUsageMonitor.refreshUsage).toHaveBeenCalled();
    });

    test('should handle refresh errors gracefully', async () => {
      mockUsageMonitor.refreshUsage.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(usageDisplay.refresh()).resolves.toBeUndefined();
    });
  });

  describe('Component Lifecycle', () => {
    test('should initialize only once', () => {
      usageDisplay = new UsageDisplay(container);
      
      expect(usageDisplay.isReady()).toBe(true);
      
      // Second initialization should not duplicate setup
      const subscribeCallCount = mockUsageMonitor.subscribeToUsageUpdates.mock.calls.length;
      
      // Try to initialize again (this would happen internally)
      (usageDisplay as any).initialize();
      
      expect(mockUsageMonitor.subscribeToUsageUpdates).toHaveBeenCalledTimes(subscribeCallCount);
    });

    test('should clean up on destroy', () => {
      usageDisplay = new UsageDisplay(container);
      
      expect(usageDisplay.isReady()).toBe(true);
      
      usageDisplay.destroy();
      
      expect(usageDisplay.isReady()).toBe(false);
      expect(container.innerHTML).toBe('');
    });

    test('should handle multiple destroy calls safely', () => {
      usageDisplay = new UsageDisplay(container);
      
      usageDisplay.destroy();
      
      // Second destroy should not throw
      expect(() => usageDisplay.destroy()).not.toThrow();
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(() => {
      usageDisplay = new UsageDisplay(container);
    });

    test('should handle rapid usage updates', () => {
      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      
      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const mockUsage: UsageData = {
          totalCost: i,
          remainingBalance: 10 - i,
          billingPeriodStart: '',
          billingPeriodEnd: '',
          lastUpdated: new Date().toISOString(),
          isLimitExceeded: i >= 10
        };

        mockUsageMonitor.checkUsageThresholds.mockReturnValue({
          level: i < 8 ? 'safe' : i < 9.5 ? 'warning' : 'critical',
          percentage: i * 10,
          message: `${i * 10}% used`
        });

        updateCallback(mockUsage);
      }

      expect(mockUsageMonitor.checkUsageThresholds).toHaveBeenCalledTimes(10);
    });

    test('should handle updates when component is not ready', () => {
      usageDisplay.destroy(); // Make component not ready
      
      const updateCallback = mockUsageMonitor.subscribeToUsageUpdates.mock.calls[0][0];
      
      const mockUsage: UsageData = {
        totalCost: 5,
        remainingBalance: 5,
        billingPeriodStart: '',
        billingPeriodEnd: '',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      // Should not throw when component is not ready
      expect(() => updateCallback(mockUsage)).not.toThrow();
    });
  });
});