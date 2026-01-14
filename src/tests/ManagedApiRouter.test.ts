import { ManagedApiRouter, ApiMode } from '../services/ManagedApiRouter';
import { ConfigurationManager } from '../services/ConfigurationManager';

// Mock dependencies
jest.mock('../services/ConfigurationManager');
jest.mock('../services/SupabaseService');
jest.mock('../services/WhispraApiClient');

describe('ManagedApiRouter', () => {
  let router: ManagedApiRouter;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  beforeEach(() => {
    // Reset singleton
    (ManagedApiRouter as any).instance = undefined;
    
    // Create mocks
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        managedApiConfig: {
          mode: 'personal',
          lastModeSwitch: new Date().toISOString(),
          usageWarningsEnabled: true,
          autoSwitchOnLimit: false
        }
      }),
      updateConfig: jest.fn()
    } as any;

    (ConfigurationManager.getInstance as jest.Mock).mockReturnValue(mockConfigManager);

    router = ManagedApiRouter.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mode Management', () => {
    test('should initialize with personal mode by default', () => {
      expect(router.getMode()).toBe('personal');
    });

    test('should switch to managed mode when valid', async () => {
      // Mock successful validation
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);

      await router.setMode('managed');
      
      expect(router.getMode()).toBe('managed');
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith({
        managedApiConfig: expect.objectContaining({
          mode: 'managed'
        })
      });
    });

    test('should reject switch to managed mode when invalid', async () => {
      // Mock failed validation
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(false);

      await expect(router.setMode('managed')).rejects.toThrow(
        'Cannot switch to managed mode: Invalid subscription or usage limit exceeded'
      );
      
      expect(router.getMode()).toBe('personal');
    });

    test('should allow switch to personal mode without validation', async () => {
      await router.setMode('personal');
      
      expect(router.getMode()).toBe('personal');
      expect(mockConfigManager.updateConfig).toHaveBeenCalled();
    });
  });

  describe('API Request Routing', () => {
    test('should return null for personal mode OpenAI requests', async () => {
      router.setUserToken('test-token');
      
      const result = await router.routeOpenAIRequest({
        endpoint: '/chat/completions',
        method: 'POST',
        body: { model: 'gpt-3.5-turbo' }
      });

      expect(result).toBeNull();
    });

    test('should route managed mode requests to backend', async () => {
      // Switch to managed mode
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');
      
      router.setUserToken('test-token');

      // Mock successful API call
      const mockResponse = { success: true, data: { choices: [] } };
      jest.spyOn(router as any, 'callManagedApi').mockResolvedValue(mockResponse);

      const result = await router.routeOpenAIRequest({
        endpoint: '/chat/completions',
        method: 'POST',
        body: { model: 'gpt-3.5-turbo' }
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Token Management', () => {
    test('should set and store user token', () => {
      const token = 'test-jwt-token';
      router.setUserToken(token);
      
      // Token should be stored internally
      expect((router as any).userToken).toBe(token);
    });

    test('should validate managed access with token', async () => {
      const token = 'test-jwt-token';
      router.setUserToken(token);

      // Mock SupabaseService
      const mockSupabaseService = {
        setUserToken: jest.fn(),
        checkUserAccess: jest.fn().mockResolvedValue({
          hasAccess: true,
          hasActiveSubscription: true
        })
      };

      // Mock WhispraApiClient
      const mockWhispraClient = {
        setUserToken: jest.fn(),
        checkSubscriptionStatus: jest.fn().mockResolvedValue({
          hasAccess: true,
          subscriptionActive: true
        })
      };

      // Mock dynamic imports
      jest.doMock('../services/SupabaseService', () => ({
        SupabaseService: {
          getInstance: () => mockSupabaseService
        }
      }));

      jest.doMock('../services/WhispraApiClient', () => ({
        WhispraApiClient: {
          getInstance: () => mockWhispraClient
        }
      }));

      const isValid = await router.validateManagedAccess();
      
      expect(isValid).toBe(true);
      expect(mockSupabaseService.setUserToken).toHaveBeenCalledWith(token);
    });
  });

  describe('Configuration Persistence', () => {
    test('should load configuration on initialization', () => {
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });

    test('should save configuration when mode changes', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      
      await router.setMode('managed');
      
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith({
        managedApiConfig: expect.objectContaining({
          mode: 'managed',
          lastModeSwitch: expect.any(String),
          usageWarningsEnabled: true,
          autoSwitchOnLimit: false
        })
      });
    });

    test('should return current managed API config', () => {
      const config = router.getManagedApiConfig();
      
      expect(config).toEqual({
        mode: 'personal',
        lastModeSwitch: expect.any(String),
        usageWarningsEnabled: true,
        autoSwitchOnLimit: false
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors gracefully', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockRejectedValue(new Error('Network error'));

      const isAvailable = await router.isManagedModeAvailable();
      
      expect(isAvailable).toBe(false);
    });

    test('should handle missing user token', async () => {
      // Don't set user token
      const isValid = await router.validateManagedAccess();
      
      expect(isValid).toBe(false);
    });
  });
});