import { ManagedApiRouter } from '../services/ManagedApiRouter';
import { WhisperApiClient } from '../services/WhisperApiClient';
import { ElevenLabsClient } from '../services/ElevenLabsClient';
import { OpenAITranslationClient } from '../services/OpenAITranslationClient';
import { UsageMonitorService } from '../services/UsageMonitorService';
import { ManagedApiFallbackService } from '../services/ManagedApiFallbackService';
import { ApiKeyManager } from '../services/ApiKeyManager';

// Mock fetch globally
global.fetch = jest.fn();

describe('Managed API Integration Tests', () => {
  let router: ManagedApiRouter;
  let whisperClient: WhisperApiClient;
  let elevenLabsClient: ElevenLabsClient;
  let translationClient: OpenAITranslationClient;
  let usageMonitor: UsageMonitorService;
  let fallbackService: ManagedApiFallbackService;
  let apiKeyManager: ApiKeyManager;

  beforeEach(() => {
    // Reset singletons
    (ManagedApiRouter as any).instance = undefined;
    (UsageMonitorService as any).instance = undefined;
    (ManagedApiFallbackService as any).instance = undefined;
    (ApiKeyManager as any).instance = undefined;

    // Create instances
    router = ManagedApiRouter.getInstance();
    usageMonitor = UsageMonitorService.getInstance();
    fallbackService = ManagedApiFallbackService.getInstance();
    apiKeyManager = ApiKeyManager.getInstance();

    // Create API clients
    whisperClient = new WhisperApiClient(apiKeyManager);
    elevenLabsClient = new ElevenLabsClient('test-elevenlabs-key');
    translationClient = new OpenAITranslationClient('test-openai-key');

    // Setup router
    router.setUserToken('test-jwt-token');

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    usageMonitor.stopMonitoring();
  });

  describe('End-to-End API Routing', () => {
    test('should route Whisper requests through managed API when in managed mode', async () => {
      // Mock successful managed API validation
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock successful managed API response
      const mockResponse = {
        success: true,
        data: {
          text: 'Hello world',
          language: 'en',
          duration: 2.5
        },
        usage: {
          cost: 0.006,
          remainingBalance: 9.994,
          isLimitExceeded: false
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      // Create test audio blob
      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      const result = await whisperClient.transcribe({
        audio: audioBlob,
        model: 'whisper-1'
      });

      expect(result.text).toBe('Hello world');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.whispra.xyz/v1/whispra/openai/audio/transcriptions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-jwt-token'
          })
        })
      );
    });

    test('should use personal API keys when in personal mode', async () => {
      // Ensure we're in personal mode
      await router.setMode('personal');

      // Mock personal API key
      jest.spyOn(apiKeyManager, 'getApiKey').mockResolvedValue('sk-test-personal-key');

      // Mock successful OpenAI response
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          text: 'Personal API response',
          language: 'en'
        })
      });

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      const result = await whisperClient.transcribe({
        audio: audioBlob,
        model: 'whisper-1'
      });

      expect(result.text).toBe('Personal API response');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.openai.com/v1/audio/transcriptions'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-personal-key'
          })
        })
      );
    });

    test('should route ElevenLabs requests through managed API', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock successful managed API response with audio data
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        success: true,
        data: mockAudioBuffer,
        usage: {
          cost: 0.02,
          remainingBalance: 9.98,
          isLimitExceeded: false
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await elevenLabsClient.synthesize('Hello world', 'voice-id-123');

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.whispra.xyz/v1/whispra/elevenlabs/text-to-speech'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-jwt-token'
          })
        })
      );
    });

    test('should route translation requests through managed API', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      const mockResponse = {
        success: true,
        data: {
          choices: [{
            message: {
              content: 'Hola mundo'
            }
          }]
        },
        usage: {
          cost: 0.001,
          remainingBalance: 9.999,
          isLimitExceeded: false
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await translationClient.translate('Hello world', 'es', 'en');

      expect(result.translatedText).toBe('Hola mundo');
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('es');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.whispra.xyz/v1/whispra/openai/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-jwt-token'
          })
        })
      );
    });
  });

  describe('Fallback Mechanism Integration', () => {
    test('should fallback to personal keys when managed API fails', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock personal API key availability
      jest.spyOn(apiKeyManager, 'getApiKey').mockResolvedValue('sk-personal-fallback-key');

      // First call fails (managed API)
      // Second call succeeds (personal API)
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Managed API service unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            text: 'Fallback response',
            language: 'en'
          })
        });

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      const result = await whisperClient.transcribe({
        audio: audioBlob,
        model: 'whisper-1'
      });

      expect(result.text).toBe('Fallback response');
      
      // Should have called both managed and personal APIs
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(1, 
        expect.stringContaining('api.whispra.xyz'),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenNthCalledWith(2, 
        expect.stringContaining('api.openai.com'),
        expect.any(Object)
      );
    });

    test('should not fallback when personal keys are not available', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // No personal API key available
      jest.spyOn(apiKeyManager, 'getApiKey').mockResolvedValue(null);

      // Managed API fails
      (fetch as jest.Mock).mockRejectedValue(new Error('Managed API service unavailable'));

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      await expect(whisperClient.transcribe({
        audio: audioBlob,
        model: 'whisper-1'
      })).rejects.toThrow('Managed API service unavailable');

      // Should only have tried managed API
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle usage limit exceeded without fallback', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock usage limit exceeded error
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Usage limit exceeded')
      });

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      await expect(whisperClient.transcribe({
        audio: audioBlob,
        model: 'whisper-1'
      })).rejects.toThrow();

      // Should not attempt fallback for usage limit errors
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Usage Monitoring Integration', () => {
    test('should update usage data after managed API calls', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      const mockUsageData = {
        totalCost: 5.50,
        remainingBalance: 4.50,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      // Mock managed API response with usage data
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { text: 'Test response' },
            usage: {
              cost: 0.006,
              remainingBalance: 4.494,
              isLimitExceeded: false
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsageData)
        });

      // Set up usage monitoring
      usageMonitor.setUserToken('test-jwt-token');

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });
      await whisperClient.transcribe({ audio: audioBlob });

      // Fetch current usage
      const usage = await usageMonitor.getCurrentUsage();

      expect(usage.totalCost).toBe(5.50);
      expect(usage.remainingBalance).toBe(4.50);
    });

    test('should trigger usage threshold warnings', async () => {
      const mockUsageData = {
        totalCost: 8.50, // 85% of $10 limit
        remainingBalance: 1.50,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
        lastUpdated: new Date().toISOString(),
        isLimitExceeded: false
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUsageData)
      });

      usageMonitor.setUserToken('test-jwt-token');
      
      // Set cached usage data
      (usageMonitor as any).currentUsage = mockUsageData;

      const threshold = usageMonitor.checkUsageThresholds();

      expect(threshold.level).toBe('warning');
      expect(threshold.percentage).toBe(85);
      expect(threshold.message).toContain('Warning');
    });
  });

  describe('Mode Switching Integration', () => {
    test('should validate subscription when switching to managed mode', async () => {
      // Mock subscription validation
      const mockSupabaseService = {
        setUserToken: jest.fn(),
        checkUserAccess: jest.fn().mockResolvedValue({
          hasAccess: true,
          hasActiveSubscription: true
        })
      };

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

      await router.setMode('managed');

      expect(router.getMode()).toBe('managed');
      expect(mockSupabaseService.setUserToken).toHaveBeenCalledWith('test-jwt-token');
    });

    test('should reject mode switch when subscription is invalid', async () => {
      // Mock failed subscription validation
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(false);

      await expect(router.setMode('managed')).rejects.toThrow(
        'Cannot switch to managed mode: Invalid subscription or usage limit exceeded'
      );

      expect(router.getMode()).toBe('personal');
    });

    test('should update API clients when mode changes', async () => {
      // Start in personal mode
      expect(router.getMode()).toBe('personal');

      // Mock successful validation and switch to managed
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      expect(router.getMode()).toBe('managed');

      // Switch back to personal
      await router.setMode('personal');

      expect(router.getMode()).toBe('personal');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle authentication errors across all services', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock authentication error
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      await expect(whisperClient.transcribe({ audio: audioBlob })).rejects.toThrow();
      await expect(elevenLabsClient.synthesize('test', 'voice-id')).rejects.toThrow();
      await expect(translationClient.translate('test', 'es')).rejects.toThrow();
    });

    test('should handle network errors with retry logic', async () => {
      jest.spyOn(router, 'validateManagedAccess').mockResolvedValue(true);
      await router.setMode('managed');

      // Mock network error followed by success
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { text: 'Retry success' }
          })
        });

      const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

      const result = await whisperClient.transcribe({ audio: audioBlob });

      expect(result.text).toBe('Retry success');
      expect(fetch).toHaveBeenCalledTimes(2); // Initial call + retry
    });
  });
});