import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { QuickTranslateService } from '../../services/QuickTranslateService';
import { QuickTranslateHotkeyService } from '../../services/QuickTranslateHotkeyService';

// Quick Translate Service instance
let quickTranslateService: QuickTranslateService | null = null;

function getQuickTranslateService(): QuickTranslateService {
  if (!quickTranslateService) {
    quickTranslateService = new QuickTranslateService();
  }
  return quickTranslateService;
}

// Quick Translate Hotkey Service instance
let quickTranslateHotkeyService: QuickTranslateHotkeyService | null = null;

function getQuickTranslateHotkeyService(): QuickTranslateHotkeyService {
  if (!quickTranslateHotkeyService) {
    quickTranslateHotkeyService = QuickTranslateHotkeyService.getInstance();
  }
  return quickTranslateHotkeyService;
}

/**
 * Register Quick Translate IPC handlers
 */
export function registerQuickTranslateHandlers(): void {
  // Quick translate handlers
  try { ipcMain.removeHandler('quick-translate:translate'); } catch {}
  ipcMain.handle('quick-translate:translate', async (
    event: IpcMainInvokeEvent,
    request: { text: string; options?: { to?: string; from?: string; provider?: 'openai' | 'deepinfra' | 'argos-translate' } }
  ): Promise<{ success: boolean; translatedText?: string; error?: string; cached?: boolean; provider?: string }> => {
    try {
      const configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();
      
      // Determine the effective provider from main config if not provided
      let effectiveProvider = request.options?.provider;
      
      if (!effectiveProvider) {
        // Get translation provider from unified config (with backward compatibility)
        const modelConfig = (config as any).modelConfig 
          || (config as any).cloudModelConfig 
          || {};
        
        const gptModel = modelConfig?.gptModel;
        
        // Determine provider based on model selection
        if (gptModel === 'argos') {
          effectiveProvider = 'argos-translate';
          console.log('[QuickTranslate] Using Argos Translate');
        } else if (gptModel === 'deepinfra') {
          effectiveProvider = 'deepinfra';
          console.log('[QuickTranslate] Using DeepInfra');
        } else {
          effectiveProvider = 'openai';
          console.log('[QuickTranslate] Using OpenAI');
        }
      }
      
      // Use TranslationServiceManager for Argos, QuickTranslateService for cloud providers
      if (effectiveProvider === 'argos-translate') {
        console.log('[QuickTranslate] Using TranslationServiceManager for Argos');
        const { TranslationServiceManager } = await import('../../services/TranslationServiceManager');
        const translationManager = new TranslationServiceManager(configManager);
        
        // For Argos, default to 'en' instead of 'auto' if source language is not provided
        // Argos doesn't support 'auto' language detection
        const sourceLanguage = request.options?.from && request.options.from !== 'auto'
          ? request.options.from
          : 'en';
        
        console.log(`[QuickTranslate] Argos translation: from=${sourceLanguage}, to=${request.options?.to || 'en'}`);
        
        const translationResult = await translationManager.translate(
          request.text,
          request.options?.to || 'en',
          sourceLanguage
        );
        
        return {
          success: true,
          translatedText: translationResult.translatedText,
          cached: false,
          provider: 'argos-translate'
        };
      } else {
        // Use QuickTranslateService for cloud providers
        const provider = effectiveProvider as 'openai' | 'deepinfra';
        console.log(`[QuickTranslate] Using QuickTranslateService for ${provider}`);
        const service = getQuickTranslateService();
        const result = await service.translate(request.text, {
          ...request.options,
          provider
        });
        
        return {
          success: result.success,
          translatedText: result.translatedText || undefined,
          error: result.error,
          cached: result.cached,
          provider: result.provider
        };
      }
    } catch (error: any) {
      console.error('Quick translate error:', error);
      return {
        success: false,
        error: error.message || 'Translation failed'
      };
    }
  });

  try { ipcMain.removeHandler('quick-translate:test-api-key'); } catch {}
  ipcMain.handle('quick-translate:test-api-key', async (
    event: IpcMainInvokeEvent,
    request: { provider: 'openai' | 'deepinfra'; apiKey?: string }
  ): Promise<{ valid: boolean }> => {
    try {
      const service = getQuickTranslateService();
      const isValid = await service.testApiKey(request.provider, request.apiKey);
      
      return { valid: isValid };
    } catch (error: any) {
      console.error('Quick translate API key test error:', error);
      return { valid: false };
    }
  });

  try { ipcMain.removeHandler('quick-translate:clear-cache'); } catch {}
  ipcMain.handle('quick-translate:clear-cache', async (
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean }> => {
    try {
      const service = getQuickTranslateService();
      service.clearCache();
      
      return { success: true };
    } catch (error: any) {
      console.error('Quick translate clear cache error:', error);
      return { success: false };
    }
  });

  try { ipcMain.removeHandler('quick-translate:get-cache-size'); } catch {}
  ipcMain.handle('quick-translate:get-cache-size', async (
    event: IpcMainInvokeEvent
  ): Promise<{ size: number }> => {
    try {
      const service = getQuickTranslateService();
      const size = service.getCacheSize();
      
      return { size };
    } catch (error: any) {
      console.error('Quick translate get cache size error:', error);
      return { size: 0 };
    }
  });

  // Quick translate hotkey handlers
  try { ipcMain.removeHandler('quick-translate-hotkey:enable'); } catch {}
  ipcMain.handle('quick-translate-hotkey:enable', async (
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean }> => {
    try {
      const service = getQuickTranslateHotkeyService();
      service.enable();
      return { success: true };
    } catch (error: any) {
      console.error('Quick translate hotkey enable error:', error);
      return { success: false };
    }
  });

  try { ipcMain.removeHandler('quick-translate-hotkey:disable'); } catch {}
  ipcMain.handle('quick-translate-hotkey:disable', async (
    event: IpcMainInvokeEvent
  ): Promise<{ success: boolean }> => {
    try {
      const service = getQuickTranslateHotkeyService();
      service.disable();
      return { success: true };
    } catch (error: any) {
      console.error('Quick translate hotkey disable error:', error);
      return { success: false };
    }
  });

  try { ipcMain.removeHandler('quick-translate-hotkey:is-enabled'); } catch {}
  ipcMain.handle('quick-translate-hotkey:is-enabled', async (
    event: IpcMainInvokeEvent
  ): Promise<{ enabled: boolean }> => {
    try {
      const service = getQuickTranslateHotkeyService();
      return { enabled: service.isHotkeyEnabled() };
    } catch (error: any) {
      console.error('Quick translate hotkey is-enabled error:', error);
      return { enabled: false };
    }
  });

  try { ipcMain.removeHandler('quick-translate-hotkey:get-config'); } catch {}
  ipcMain.handle('quick-translate-hotkey:get-config', async (
    event: IpcMainInvokeEvent
  ): Promise<{ config: any }> => {
    try {
      const service = getQuickTranslateHotkeyService();
      return { config: service.getConfig() };
    } catch (error: any) {
      console.error('Quick translate hotkey get-config error:', error);
      return { config: null };
    }
  });

  try { ipcMain.removeHandler('quick-translate-hotkey:update-config'); } catch {}
  ipcMain.handle('quick-translate-hotkey:update-config', async (
    event: IpcMainInvokeEvent,
    request: { config: any }
  ): Promise<{ success: boolean }> => {
    try {
      const service = getQuickTranslateHotkeyService();
      service.updateConfig(request.config);
      return { success: true };
    } catch (error: any) {
      console.error('Quick translate hotkey update-config error:', error);
      return { success: false };
    }
  });
}

