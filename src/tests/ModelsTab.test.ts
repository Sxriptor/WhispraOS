import { ModelsTab } from '../ui/settings/tabs/ModelsTab';

// Mock DOM environment
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: jest.fn()
  }
});

Object.defineProperty(window, 'currentLanguage', {
  value: 'en',
  writable: true
});

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn((tagName: string) => ({
    tagName: tagName.toUpperCase(),
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    style: {},
    type: '',
    value: '',
    min: '',
    max: '',
    step: '',
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    }
  }))
});

Object.defineProperty(document, 'getElementById', {
  value: jest.fn(() => ({
    value: '0.7',
    textContent: '0.7',
    disabled: false
  }))
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    disabled: false,
    textContent: 'Test Voice'
  }))
});

describe('ModelsTab', () => {
  let modelsTab: ModelsTab;
  let mockElectronAPI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    modelsTab = new ModelsTab();
  });

  describe('Tab Properties', () => {
    it('should have correct tab properties', () => {
      expect(modelsTab.id).toBe('models');
      expect(modelsTab.title).toBe('Models');
      expect(modelsTab.icon).toBe('🤖');
      expect(modelsTab.order).toBe(2);
    });
  });

  describe('Model Configuration Loading', () => {
    it('should load model configuration from storage', async () => {
      const mockConfig = {
        whisperModel: 'whisper-1',
        gptModel: 'gpt-4',
        voiceId: 'test-voice-id',
        modelParameters: {
          temperature: 0.8,
          maxTokens: 200,
          stability: 0.6,
          similarityBoost: 0.7,
          speed: 1.2
        }
      };

      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: mockConfig
      });

      await (modelsTab as any).loadModelConfig();

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
      expect((modelsTab as any).modelConfig.whisperModel).toBe('whisper-1');
      expect((modelsTab as any).modelConfig.gptModel).toBe('gpt-4');
      expect((modelsTab as any).modelConfig.voiceModel).toBe('test-voice-id');
      expect((modelsTab as any).modelConfig.modelParameters.temperature).toBe(0.8);
    });

    it('should use defaults when loading fails', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('Load failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (modelsTab as any).loadModelConfig();

      expect((modelsTab as any).modelConfig.whisperModel).toBe('whisper-1');
      expect((modelsTab as any).modelConfig.gptModel).toBe('gpt-3.5-turbo');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading model configuration:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Voice Loading', () => {
    it('should load voices successfully', async () => {
      const mockVoices = [
        { id: 'voice-1', name: 'Voice 1' },
        { id: 'voice-2', name: 'Voice 2' }
      ];

      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: { voices: mockVoices }
      });

      const mockSelect = {
        innerHTML: '',
        appendChild: jest.fn()
      };

      await (modelsTab as any).loadVoices(mockSelect);

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('voice:get-voices', expect.any(Object));
      expect(mockSelect.appendChild).toHaveBeenCalledTimes(2);
    });

    it('should handle voice loading failure', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('Voice loading failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockSelect = {
        innerHTML: ''
      };

      await (modelsTab as any).loadVoices(mockSelect);

      expect(mockSelect.innerHTML).toBe('<option value="">Error loading voices</option>');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading voices:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Voice Testing', () => {
    it('should test voice successfully', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await (modelsTab as any).testVoice({
        buttons: { testVoice: 'Test Voice' },
        messages: { 
          testingVoice: 'Testing...', 
          voiceTestComplete: 'Test complete' 
        }
      });

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('tts:synthesize-only', expect.any(Object));
      expect(consoleSpy).toHaveBeenCalledWith('Voice test completed successfully');
      expect(alertSpy).toHaveBeenCalledWith('Test complete');

      alertSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle voice test failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ 
        success: false, 
        error: 'TTS failed' 
      });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (modelsTab as any).testVoice({
        buttons: { testVoice: 'Test Voice' },
        messages: { 
          testingVoice: 'Testing...', 
          voiceTestFailed: 'Test failed' 
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('Voice test failed:', 'TTS failed');
      expect(alertSpy).toHaveBeenCalledWith('Test failed');

      alertSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Validation', () => {
    it('should validate parameters within ranges', () => {
      // Set valid parameters
      (modelsTab as any).modelConfig.modelParameters = {
        temperature: 1.0,
        maxTokens: 200,
        stability: 0.5,
        similarityBoost: 0.5,
        speed: 1.0
      };

      const isValid = modelsTab.validate();
      const errors = modelsTab.getValidationErrors();

      expect(isValid).toBe(true);
      expect(errors).toEqual([]);
    });

    it('should detect invalid temperature', () => {
      (modelsTab as any).modelConfig.modelParameters.temperature = 3.0; // Above max

      const isValid = modelsTab.validate();
      const errors = modelsTab.getValidationErrors();

      expect(isValid).toBe(false);
      expect(errors).toContain('Temperature must be between 0.0 and 2.0');
    });

    it('should detect invalid max tokens', () => {
      (modelsTab as any).modelConfig.modelParameters.maxTokens = 1000; // Above max

      const isValid = modelsTab.validate();
      const errors = modelsTab.getValidationErrors();

      expect(isValid).toBe(false);
      expect(errors).toContain('Max tokens must be between 50 and 500');
    });

    it('should detect multiple validation errors', () => {
      (modelsTab as any).modelConfig.modelParameters = {
        temperature: -1.0, // Below min
        maxTokens: 10,     // Below min
        stability: 2.0,    // Above max
        similarityBoost: -0.5, // Below min
        speed: 5.0         // Above max
      };

      const errors = modelsTab.getValidationErrors();

      expect(errors).toHaveLength(5);
      expect(errors).toContain('Temperature must be between 0.0 and 2.0');
      expect(errors).toContain('Max tokens must be between 50 and 500');
      expect(errors).toContain('Voice stability must be between 0.0 and 1.0');
      expect(errors).toContain('Similarity boost must be between 0.0 and 1.0');
      expect(errors).toContain('Speech speed must be between 0.25 and 4.0');
    });
  });

  describe('Save Functionality', () => {
    it('should save model configuration successfully', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      const result = await modelsTab.onSave();

      expect(result).toBe(true);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:set', expect.objectContaining({
        payload: expect.objectContaining({
          whisperModel: expect.any(String),
          gptModel: expect.any(String),
          voiceId: expect.any(String),
          modelParameters: expect.any(Object)
        })
      }));
    });

    it('should handle save failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: false });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await modelsTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save model configuration');

      consoleSpy.mockRestore();
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset configuration when confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      // Change some values first
      (modelsTab as any).modelConfig.whisperModel = 'custom-model';
      (modelsTab as any).modelConfig.modelParameters.temperature = 1.5;

      (modelsTab as any).resetToDefaults({
        messages: {
          resetConfirm: 'Reset?',
          resetComplete: 'Reset complete'
        }
      });

      expect(confirmSpy).toHaveBeenCalledWith('Reset?');
      expect((modelsTab as any).modelConfig.whisperModel).toBe('whisper-1');
      expect((modelsTab as any).modelConfig.modelParameters.temperature).toBe(0.7);
      expect(alertSpy).toHaveBeenCalledWith('Reset complete');

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('should not reset when not confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      // Change some values first
      (modelsTab as any).modelConfig.whisperModel = 'custom-model';

      (modelsTab as any).resetToDefaults({
        messages: { resetConfirm: 'Reset?' }
      });

      expect(confirmSpy).toHaveBeenCalledWith('Reset?');
      expect((modelsTab as any).modelConfig.whisperModel).toBe('custom-model'); // Should not change

      confirmSpy.mockRestore();
    });
  });
});