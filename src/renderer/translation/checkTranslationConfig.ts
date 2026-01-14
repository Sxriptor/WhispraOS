/**
 * Check if translation configuration is properly set up
 * Returns true if configured, false if missing (and shows overlay)
 */

import { TranslationSetupOverlay } from '../../ui/TranslationSetupOverlay.js';

/**
 * Check if translation is properly configured
 * @returns Promise<boolean> - true if configured, false if missing
 */
export async function checkTranslationConfig(): Promise<boolean> {
  try {
    // Get current configuration
    const response = await (window as any).electronAPI.invoke('config:get', {
      id: Date.now().toString(),
      timestamp: Date.now(),
      payload: null
    });

    if (!response.success || !response.payload) {
      console.warn('[TranslationConfig] Failed to get config');
      showOverlay();
      return false;
    }

    const config = response.payload;
    const currentMode = config.managedApiConfig?.mode || 'personal';

    // If user is in managed mode, they don't need API keys or local models
    if (currentMode !== 'personal') {
      console.log('[TranslationConfig] User is in managed mode - skipping personal API/model check');
      return true;
    }

    // User is in personal mode - check for API keys or local models
    const modelConfig = config.modelConfig || config.cloudModelConfig;
    const translationProvider = modelConfig?.gptModel; // 'openai', 'deepinfra', or 'argos'

    console.log(`[TranslationConfig] Checking translation provider in personal mode: ${translationProvider}`);

    // Check based on selected provider
    if (translationProvider === 'openai') {
      // Check if OpenAI API key exists
      const hasOpenAI = await checkApiKey('openai');
      if (!hasOpenAI) {
        console.warn('[TranslationConfig] OpenAI selected but no API key found');
        showOverlay();
        return false;
      }
      return true;
    } else if (translationProvider === 'deepinfra') {
      // Check if DeepInfra API key exists
      const hasDeepInfra = await checkApiKey('deepinfra');
      if (!hasDeepInfra) {
        console.warn('[TranslationConfig] DeepInfra selected but no API key found');
        showOverlay();
        return false;
      }
      return true;
    } else if (translationProvider === 'argos') {
      // Check if local Argos model is available with retry logic
      const argosAvailable = await checkLocalArgosWithRetry();
      if (!argosAvailable) {
        console.warn('[TranslationConfig] Argos selected but not available after retries');
        showOverlay();
        return false;
      }
      return true;
    } else {
      // No provider explicitly selected (or default) - check if BOTH API keys missing AND local Argos missing
      const hasOpenAI = await checkApiKey('openai');
      const hasDeepInfra = await checkApiKey('deepinfra');
      const argosAvailable = await checkLocalArgosWithRetry();

      if (!hasOpenAI && !hasDeepInfra && !argosAvailable) {
        console.warn('[TranslationConfig] No translation configuration found (no API keys and no local model)');
        showOverlay();
        return false;
      }

      // At least one option is available
      return true;
    }
  } catch (error) {
    console.error('[TranslationConfig] Error checking configuration:', error);
    // On error, show overlay to be safe
    showOverlay();
    return false;
  }
}

/**
 * Check if an API key exists for a service
 */
async function checkApiKey(service: 'openai' | 'deepinfra'): Promise<boolean> {
  try {
    const response = await (window as any).electronAPI.invoke('secure-api-keys:get', {
      id: Date.now().toString(),
      timestamp: Date.now(),
      payload: null
    });

    if (!response.success || !response.payload) {
      return false;
    }

    const apiKeys = response.payload;
    const apiKey = apiKeys[service] || '';
    return apiKey.trim().length > 0;
  } catch (error) {
    console.error(`[TranslationConfig] Error checking ${service} API key:`, error);
    return false;
  }
}

/**
 * Check if local Argos model is available with retry logic
 * This is needed because Argos initialization can take time, especially in packaged apps
 */
async function checkLocalArgosWithRetry(maxRetries: number = 8, delayMs: number = 2000): Promise<boolean> {
  console.log('[TranslationConfig] Checking Argos availability with retry logic...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TranslationConfig] Argos check attempt ${attempt}/${maxRetries}`);
      
      // First, try to trigger Argos initialization if it hasn't started
      if (attempt === 1) {
        try {
          console.log('[TranslationConfig] Triggering local processing initialization...');
          // Trigger LocalProcessingManager initialization
          const initResponse = await (window as any).electronAPI.invoke('local:initialize', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {}
          });
          console.log(`[TranslationConfig] Init response: ${JSON.stringify(initResponse)}`);
        } catch (error) {
          console.log(`[TranslationConfig] Failed to trigger local initialization: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Wait a bit longer on first few attempts to allow initialization
      const waitTime = attempt <= 3 ? delayMs * 1.5 : delayMs;
      
      const response = await (window as any).electronAPI.invoke('local:get-model-status', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {}
      });

      if (!response.success || !response.payload) {
        console.log(`[TranslationConfig] Attempt ${attempt}: No response from local model status`);
        if (attempt < maxRetries) {
          console.log(`[TranslationConfig] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        return false;
      }

      const status = response.payload;
      const isAvailable = status?.argosAvailable === true;
      
      console.log(`[TranslationConfig] Attempt ${attempt}: Argos available = ${isAvailable}`);
      console.log(`[TranslationConfig] Status details:`, status);
      
      if (isAvailable) {
        console.log(`[TranslationConfig] ✅ Argos became available on attempt ${attempt}`);
        return true;
      }
      
      // If not available and we have more attempts, wait and retry
      if (attempt < maxRetries) {
        console.log(`[TranslationConfig] Argos not ready, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
    } catch (error) {
      console.error(`[TranslationConfig] Attempt ${attempt} error:`, error);
      if (attempt < maxRetries) {
        const waitTime = attempt <= 3 ? delayMs * 1.5 : delayMs;
        console.log(`[TranslationConfig] Error occurred, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.log(`[TranslationConfig] ❌ Argos not available after ${maxRetries} attempts`);
  return false;
}

/**
 * Check if local Argos model is available (single attempt)
 */
async function checkLocalArgos(): Promise<boolean> {
  try {
    const response = await (window as any).electronAPI.invoke('local:get-model-status', {
      id: Date.now().toString(),
      timestamp: Date.now(),
      payload: {}
    });

    if (!response.success || !response.payload) {
      return false;
    }

    const status = response.payload;
    return status?.argosAvailable === true;
  } catch (error) {
    console.error('[TranslationConfig] Error checking local Argos:', error);
    return false;
  }
}

/**
 * Show the translation setup overlay
 */
function showOverlay(): void {
  const overlay = TranslationSetupOverlay.getInstance();
  overlay.show();
}

