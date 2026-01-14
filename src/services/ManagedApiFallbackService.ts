import { ManagedApiRouter } from './ManagedApiRouter';
import { ApiKeyManager } from './ApiKeyManager';

/**
 * Service to handle automatic fallback from managed API to personal keys
 */
export class ManagedApiFallbackService {
  private static instance: ManagedApiFallbackService;
  private managedApiRouter: ManagedApiRouter;
  private apiKeyManager: ApiKeyManager;
  private fallbackEnabled = true;
  private fallbackAttempts: Map<string, number> = new Map();
  private maxFallbackAttempts = 3;

  private constructor() {
    this.managedApiRouter = ManagedApiRouter.getInstance();
    this.apiKeyManager = ApiKeyManager.getInstance();
  }

  public static getInstance(): ManagedApiFallbackService {
    if (!ManagedApiFallbackService.instance) {
      ManagedApiFallbackService.instance = new ManagedApiFallbackService();
    }
    return ManagedApiFallbackService.instance;
  }

  /**
   * Enable or disable automatic fallback
   */
  public setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
    console.log(`🔄 Automatic fallback ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if fallback is available for a service
   */
  public async isFallbackAvailable(service: 'openai' | 'elevenlabs'): Promise<boolean> {
    if (!this.fallbackEnabled) {
      return false;
    }

    try {
      const apiKey = await this.apiKeyManager.getApiKey(service);
      return !!apiKey;
    } catch (error) {
      console.error(`Failed to check ${service} API key availability:`, error);
      return false;
    }
  }

  /**
   * Attempt to execute a request with automatic fallback
   */
  public async executeWithFallback<T>(
    service: 'openai' | 'elevenlabs',
    managedApiCall: () => Promise<T>,
    personalApiCall: () => Promise<T>,
    context: string = 'unknown'
  ): Promise<T> {
    const currentMode = this.managedApiRouter.getMode();
    
    // If already in personal mode, just use personal API
    if (currentMode === 'personal') {
      return await personalApiCall();
    }

    // Try managed API first
    try {
      const result = await managedApiCall();
      
      // Success - reset fallback attempts
      this.fallbackAttempts.delete(context);
      return result;
      
    } catch (error) {
      console.warn(`🔄 Managed API failed for ${service} [${context}]:`, error);
      
      // Check if we should attempt fallback
      if (await this.shouldAttemptFallback(service, context, error)) {
        console.log(`🔄 Attempting fallback to personal ${service} API...`);
        
        try {
          const result = await personalApiCall();
          
          // Show fallback notification
          this.showFallbackNotification(service);
          
          return result;
          
        } catch (fallbackError) {
          console.error(`❌ Fallback to personal ${service} API also failed:`, fallbackError);
          
          // Both managed and personal failed - throw original error
          throw error;
        }
      } else {
        // No fallback available or not appropriate
        throw error;
      }
    }
  }

  /**
   * Determine if fallback should be attempted
   */
  private async shouldAttemptFallback(
    service: 'openai' | 'elevenlabs',
    context: string,
    error: any
  ): Promise<boolean> {
    // Check if fallback is enabled
    if (!this.fallbackEnabled) {
      return false;
    }

    // Check if we've exceeded max fallback attempts for this context
    const attempts = this.fallbackAttempts.get(context) || 0;
    if (attempts >= this.maxFallbackAttempts) {
      console.warn(`⚠️ Max fallback attempts (${this.maxFallbackAttempts}) exceeded for ${context}`);
      return false;
    }

    // Check if personal API key is available
    const hasPersonalKey = await this.isFallbackAvailable(service);
    if (!hasPersonalKey) {
      console.warn(`⚠️ No personal ${service} API key available for fallback`);
      return false;
    }

    // Check error type - some errors shouldn't trigger fallback
    const errorMessage = error?.message || error?.toString() || '';
    
    // Don't fallback for authentication errors (user needs to fix their account)
    if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      return false;
    }

    // Don't fallback for usage limit errors (user should be aware of the limit)
    if (errorMessage.includes('usage limit') || errorMessage.includes('quota exceeded')) {
      return false;
    }

    // Increment fallback attempt count
    this.fallbackAttempts.set(context, attempts + 1);
    
    return true;
  }

  /**
   * Show notification when fallback is used
   */
  private showFallbackNotification(service: 'openai' | 'elevenlabs'): void {
    const serviceName = service === 'openai' ? 'OpenAI' : 'ElevenLabs';
    
    // Send IPC message to renderer process to show notification
    try {
      const { BrowserWindow } = require('electron');
      const mainWindow = BrowserWindow.getAllWindows()[0];
      
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('show-fallback-notification', {
          service,
          serviceName,
          message: `Managed ${serviceName} service unavailable. Switched to your personal API key.`
        });
      }
    } catch (error) {
      console.warn('Failed to send fallback notification to renderer:', error);
    }
  }

  /**
   * Reset fallback attempts for a context
   */
  public resetFallbackAttempts(context: string): void {
    this.fallbackAttempts.delete(context);
  }

  /**
   * Reset all fallback attempts
   */
  public resetAllFallbackAttempts(): void {
    this.fallbackAttempts.clear();
  }

  /**
   * Get fallback statistics
   */
  public getFallbackStats(): {
    totalContexts: number;
    activeContexts: string[];
    maxAttempts: number;
  } {
    return {
      totalContexts: this.fallbackAttempts.size,
      activeContexts: Array.from(this.fallbackAttempts.keys()),
      maxAttempts: this.maxFallbackAttempts
    };
  }

  /**
   * Set maximum fallback attempts per context
   */
  public setMaxFallbackAttempts(max: number): void {
    this.maxFallbackAttempts = Math.max(1, max);
    console.log(`🔧 Max fallback attempts set to ${this.maxFallbackAttempts}`);
  }
}