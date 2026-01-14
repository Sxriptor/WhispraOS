import { WhisperTranscriptionRequest, WhisperTranscriptionResponse } from './WhisperApiClient';
import { ConfigurationManager } from './ConfigurationManager';
import { ManagedApiErrorHandler, ManagedApiErrorType } from './ManagedApiErrorHandler';
import { WhispraWebSocketClient } from './WhispraWebSocketClient';
import { WhispraApiClient } from './WhispraApiClient';
import { 
  OpenSourceFeatures, 
  BackendConfig, 
  isManagedModeConfigured 
} from './OpenSourceConfig';

/**
 * API mode for routing requests
 */
export type ApiMode = 'managed' | 'personal';

/**
 * Configuration for managed API service
 */
export interface ManagedApiConfig {
  mode: ApiMode;
  lastModeSwitch: string;
  usageWarningsEnabled: boolean;
  autoSwitchOnLimit: boolean;
}

/**
 * Request format for managed API backend
 */
export interface ManagedApiRequest {
  service: 'openai' | 'elevenlabs';
  endpoint: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: any;
  userToken: string;
}

/**
 * Response format from managed API backend
 */
export interface ManagedApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    cost: number;
    remainingBalance: number;
    isLimitExceeded: boolean;
  };
  translatedText?: string; // For combined translate/speak endpoint
}

/**
 * OpenAI request types for managed routing
 */
export interface OpenAIRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * ElevenLabs request types for managed routing
 */
export interface ElevenLabsRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Routes API requests between managed backend and direct API calls
 * 
 * OPEN SOURCE NOTE: Managed mode is DISABLED by default.
 * The app runs in "personal mode" where users provide their own API keys.
 * To enable managed mode:
 * 1. Set OpenSourceFeatures.MANAGED_MODE_ENABLED = true
 * 2. Configure BackendConfig.MANAGED_API_URL
 * 3. Set up authentication backend
 */
export class ManagedApiRouter {
  private static instance: ManagedApiRouter;
  private configManager: ConfigurationManager;
  private managedApiBaseUrl: string;
  private currentMode: ApiMode = 'personal';
  private userToken: string | null = null;
  private errorHandler: ManagedApiErrorHandler;
  private wsClient: WhispraWebSocketClient;
  private restClient: WhispraApiClient;
  private preferWebSocket = true; // Prefer WebSocket over REST in managed mode
  private isManagedModeAvailableFlag: boolean = false;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.errorHandler = ManagedApiErrorHandler.getInstance();
    this.wsClient = WhispraWebSocketClient.getInstance();
    this.restClient = WhispraApiClient.getInstance();
    
    // Check if managed mode is available (configured in open-source settings)
    this.isManagedModeAvailableFlag = isManagedModeConfigured();
    this.managedApiBaseUrl = BackendConfig.MANAGED_API_URL || '';
    
    if (!this.isManagedModeAvailableFlag) {
      console.log('ℹ️ ManagedApiRouter: Managed mode disabled - running in personal mode only');
      console.log('   Users must provide their own API keys for OpenAI, ElevenLabs, etc.');
      this.currentMode = 'personal';
    } else {
      // Set circular reference after both are initialized
      this.errorHandler.managedApiRouter = this;
      this.loadConfiguration();
      // Initialize user token from stored auth
      this.initializeUserToken();
    }
  }

  /**
   * Initialize user token from stored authentication
   */
  private async initializeUserToken(): Promise<void> {
    // Skip if managed mode is not available
    if (!this.isManagedModeAvailableFlag) return;

    try {
      const { AuthManager } = await import('./AuthManager');
      const authManager = AuthManager.getInstance();
      const token = await authManager.getToken();
      
      if (token) {
        this.userToken = token;
        this.wsClient.setToken(token);
        this.restClient.setUserToken(token);
        console.log(`🔑 ManagedApiRouter initialized with stored user token`);
        
        // Check if we should connect WebSocket on startup
        await this.initializeWebSocketConnection();
      } else {
        console.log(`🔑 No stored user token found for ManagedApiRouter`);
      }
    } catch (error) {
      console.warn('Failed to initialize user token for ManagedApiRouter:', error);
    }
  }

  /**
   * Initialize WebSocket connection if conditions are met
   */
  private async initializeWebSocketConnection(): Promise<void> {
    // Skip if managed mode is not available
    if (!this.isManagedModeAvailableFlag) return;

    try {
      // Only connect if in managed mode AND fast mode is enabled
      if (this.currentMode === 'managed' && this.isFastModeEnabled()) {
        console.log('🔌 Initializing WebSocket connection (managed mode + fast mode)...');
        await this.wsClient.connect();
        console.log('✅ WebSocket connected on startup');
      } else {
        console.log(`⏸️ Skipping WebSocket connection on startup (mode: ${this.currentMode}, fast mode: ${this.isFastModeEnabled()})`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize WebSocket connection:', error);
    }
  }

  public static getInstance(): ManagedApiRouter {
    if (!ManagedApiRouter.instance) {
      ManagedApiRouter.instance = new ManagedApiRouter();
    }
    return ManagedApiRouter.instance;
  }

  /**
   * Check if managed mode is available in this deployment
   */
  public isManagedModeAvailable(): boolean {
    return this.isManagedModeAvailableFlag;
  }

  /**
   * Set the current API mode
   */
  public async setMode(mode: ApiMode): Promise<void> {
    console.log(`🔄 ManagedApiRouter.setMode called with mode: ${mode}, current mode: ${this.currentMode}`);
    
    if (mode === 'managed') {
      // Check if managed mode is available in this deployment
      if (!this.isManagedModeAvailableFlag) {
        console.warn('⚠️ Cannot switch to managed mode: Not configured in this deployment');
        throw new Error('Managed mode is not available. This is an open-source deployment running in personal mode only.');
      }

      console.log('🔍 Validating managed access...');
      const isValid = await this.validateManagedAccess();
      console.log(`🔍 Managed access validation result: ${isValid}`);
      if (!isValid) {
        throw new Error('Cannot switch to managed mode: Invalid subscription or usage limit exceeded');
      }

      // Check if fast mode is enabled before connecting WebSocket
      const isFastMode = this.isFastModeEnabled();
      if (isFastMode) {
        try {
          console.log('🔌 Connecting WebSocket for managed mode with fast mode enabled...');
          await this.wsClient.connect();
          console.log('✅ WebSocket connected successfully');
        } catch (error) {
          console.warn('⚠️ WebSocket connection failed, will use REST fallback:', error);
          // Don't throw - REST fallback will be used
        }
      } else {
        console.log('⏸️ Fast mode not enabled, skipping WebSocket connection');
      }
    } else {
      // Disconnect WebSocket when leaving managed mode
      console.log('🔌 Disconnecting WebSocket for personal mode...');
      this.wsClient.disconnect();
    }

    // Update current mode first
    console.log(`🔄 Updating current mode from ${this.currentMode} to ${mode}`);
    this.currentMode = mode;
    
    // Save to configuration
    await this.saveManagedApiConfig({
      mode,
      lastModeSwitch: new Date().toISOString(),
      usageWarningsEnabled: true,
      autoSwitchOnLimit: false
    });

    console.log(`🔄 API mode switched to: ${mode}`);
    
    // Notify subscription cache that managed mode changed
    try {
      const { SubscriptionCacheService } = await import('./SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onManagedModeChanged();
      console.log('✅ Notified subscription cache of mode change');
    } catch (error) {
      console.warn('Failed to notify subscription cache of mode change:', error);
    }
    
    // Broadcast mode change to all services that might need to know
    console.log(`📢 Broadcasting API mode change to ${mode}`);
  }

  /**
   * Get the current API mode
   */
  public getMode(): ApiMode {
    return this.currentMode;
  }

  /**
   * Check if fast mode is enabled in configuration
   */
  private isFastModeEnabled(): boolean {
    try {
      const config = this.configManager.getConfig();
      const optimization = config.uiSettings?.bidirectionalOptimization;
      return optimization?.translationSpeed === 'fast';
    } catch (error) {
      console.warn('Failed to check fast mode status:', error);
      return false;
    }
  }

  /**
   * Handle fast mode toggle - connect/disconnect WebSocket accordingly
   */
  public async onFastModeChanged(isFastMode: boolean): Promise<void> {
    console.log(`🔄 Fast mode changed to: ${isFastMode}, current mode: ${this.currentMode}`);
    
    // Only manage WebSocket if in managed mode
    if (this.currentMode !== 'managed') {
      console.log('⏸️ Not in managed mode, ignoring fast mode change');
      return;
    }

    if (isFastMode) {
      // Connect WebSocket when fast mode is enabled
      if (!this.wsClient.isConnected()) {
        try {
          console.log('🔌 Connecting WebSocket for fast mode...');
          await this.wsClient.connect();
          console.log('✅ WebSocket connected successfully');
        } catch (error) {
          console.warn('⚠️ WebSocket connection failed, will use REST fallback:', error);
        }
      } else {
        console.log('✅ WebSocket already connected');
      }
    } else {
      // Disconnect WebSocket when fast mode is disabled
      if (this.wsClient.isConnected()) {
        console.log('🔌 Disconnecting WebSocket (fast mode disabled)...');
        this.wsClient.disconnect();
      }
    }
  }

  /**
   * Set user authentication token
   */
  public setUserToken(token: string): void {
    this.userToken = token;
    this.wsClient.setToken(token);
    this.restClient.setUserToken(token);
  }

  /**
   * Route OpenAI API requests
   */
  public async routeOpenAIRequest(request: OpenAIRequest): Promise<any> {
    // Always check current mode to ensure we respect user's choice
    if (this.currentMode === 'managed') {
      // Validate managed access before routing
      const hasAccess = await this.validateManagedAccess();
      if (!hasAccess) {
        console.log('🔄 Managed access validation failed, falling back to personal mode');
        // Fall back to personal mode if managed access is not available
        return null;
      }
      
      // Try WebSocket first, fallback to REST
      return await this.callManagedApiWithFallback({
        service: 'openai',
        endpoint: request.endpoint,
        method: request.method,
        headers: request.headers || {},
        body: request.body,
        userToken: this.userToken || ''
      });
    } else {
      // Return null to indicate personal mode - calling service should handle direct API call
      console.log('🔑 Using personal mode for OpenAI request');
      return null;
    }
  }

  /**
   * Route ElevenLabs API requests
   */
  public async routeElevenLabsRequest(request: ElevenLabsRequest): Promise<any> {
    // Always check current mode to ensure we respect user's choice
    if (this.currentMode === 'managed') {
      // Validate managed access before routing
      const hasAccess = await this.validateManagedAccess();
      if (!hasAccess) {
        console.log('🔄 Managed access validation failed, falling back to personal mode for ElevenLabs');
        // Fall back to personal mode if managed access is not available
        return null;
      }
      
      // Try WebSocket first, fallback to REST
      return await this.callManagedApiWithFallback({
        service: 'elevenlabs',
        endpoint: request.endpoint,
        method: request.method,
        headers: request.headers || {},
        body: request.body,
        userToken: this.userToken || ''
      });
    } else {
      // Return null to indicate personal mode - calling service should handle direct API call
      console.log('🔑 Using personal mode for ElevenLabs request');
      return null;
    }
  }

  /**
   * Validate managed API access (subscription and usage limits)
   */
  public async validateManagedAccess(): Promise<boolean> {
    try {
      if (!this.userToken) {
        console.warn('❌ No user token available for managed API validation');
        return false;
      }

      // Use cached subscription data instead of making fresh API calls
      const { SubscriptionCacheService } = await import('./SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      const cachedData = subscriptionCache.getCachedData();
      
      if (!cachedData) {
        console.warn('❌ No cached subscription data available for managed API validation');
        return false;
      }
      
      console.log(`🔍 Validating managed access with cached data: hasAccess=${cachedData.hasAccess}, hasActiveSubscription=${cachedData.hasActiveSubscription}, hasManagedAPI=${cachedData.hasManagedAPI}`);
      
      // User must have access (either trial or subscription)
      if (!cachedData.hasAccess) {
        console.warn('❌ User does not have access (no trial or subscription)');
        return false;
      }

      // User must have managed API access (trial users, pro with managed_api_access, or ultra)
      if (!cachedData.hasManagedAPI) {
        console.warn('❌ User does not have managed API access');
        return false;
      }

      // The cached data already includes managed API backend validation
      // (done during cache refresh), so we can trust it
      console.log('✅ Managed API access validated successfully using cached data');
      return true;

    } catch (error) {
      console.error('Failed to validate managed API access:', error);
      return false;
    }
  }

  /**
   * Check if user has managed API subscription (not just trial)
   */
  public async hasManagedApiSubscription(): Promise<boolean> {
    try {
      if (!this.userToken) {
        return false;
      }

      // Use cached subscription data directly
      const { SubscriptionCacheService } = await import('./SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      const cachedData = subscriptionCache.getCachedData();
      
      if (!cachedData) {
        console.warn('No cached subscription data available');
        return false;
      }
      
      // For managed API, we require an active subscription with managed API access
      return cachedData.hasActiveSubscription && cachedData.hasManagedAPI;
    } catch (error) {
      console.error('Failed to check managed API subscription:', error);
      return false;
    }
  }

  /**
   * Call managed API with WebSocket first, fallback to REST
   */
  private async callManagedApiWithFallback(request: ManagedApiRequest): Promise<ManagedApiResponse> {
    // Try WebSocket first if connected and preferred
    if (this.preferWebSocket && this.wsClient.isConnected()) {
      try {
        console.log(`🔌 Using WebSocket for ${request.service}${request.endpoint}`);
        return await this.callManagedApiViaWebSocket(request);
      } catch (error) {
        console.warn(`⚠️ WebSocket request failed, falling back to REST:`, error);
        // Fall through to REST
      }
    }

    // Fallback to REST
    console.log(`🌐 Using REST for ${request.service}${request.endpoint}`);
    return await this.callManagedApi(request);
  }

  /**
   * Call managed API via WebSocket
   */
  private async callManagedApiViaWebSocket(request: ManagedApiRequest): Promise<ManagedApiResponse> {
    const endpoint = request.endpoint;
    const body = request.body;

    // Map REST endpoints to WebSocket message types
    if (request.service === 'openai') {
      // Whisper transcription
      if (endpoint.includes('/audio/transcriptions')) {
        const result = await this.wsClient.transcribe(body.file, {
          model: body.model,
          language: body.language,
          prompt: body.prompt
        });
        return {
          success: true,
          data: result.data,
          usage: result.usage
        };
      }
      
      // Chat completion / Translation
      if (endpoint.includes('/chat/completions')) {
        const result = await this.wsClient.chat(body.messages, {
          model: body.model
        });
        return {
          success: true,
          data: result.data,
          usage: result.usage
        };
      }

      // TTS
      if (endpoint.includes('/audio/speech')) {
        const audioBuffer = await this.wsClient.textToSpeech(body.input, {
          voice: body.voice,
          model: body.model,
          provider: 'openai'
        });
        return {
          success: true,
          data: audioBuffer,
          usage: undefined // Usage will be in headers if available
        };
      }
    }

    if (request.service === 'elevenlabs') {
      // ElevenLabs TTS
      if (endpoint.includes('/text-to-speech')) {
        const voiceId = endpoint.split('/')[2]; // Extract voice ID from path
        const audioBuffer = await this.wsClient.textToSpeech(body.text, {
          voice: voiceId,
          model: body.model_id,
          provider: 'elevenlabs'
        });
        return {
          success: true,
          data: audioBuffer,
          usage: undefined
        };
      }
    }

    // If we can't map the endpoint, throw error to trigger REST fallback
    throw new Error(`Unsupported WebSocket endpoint: ${request.service}${endpoint}`);
  }

  /**
   * Call the managed API backend with error handling and retry logic
   */
  private async callManagedApi(request: ManagedApiRequest): Promise<ManagedApiResponse> {
    const context = `${request.service}${request.endpoint}`;
    let lastError: any = null;

    // Debug logging
    console.log(`🔄 Making managed API call to ${request.service}${request.endpoint}`);
    console.log(`🔑 User token present: ${!!request.userToken}`);
    console.log(`🔑 User token length: ${request.userToken?.length || 0}`);
    
    if (!request.userToken) {
      throw new Error('No user token provided for managed API call');
    }

    // Retry loop
    while (true) {
      try {
        const url = `${this.managedApiBaseUrl}/${request.service}${request.endpoint}`;
        
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: {
            'Authorization': `Bearer ${request.userToken}`,
            ...request.headers
          }
        };

        // Handle different body types
        if (request.body) {
          if (request.body instanceof FormData) {
            // For FormData, don't set Content-Type - let browser set it with boundary
            fetchOptions.body = request.body;
          } else {
            // For other body types, stringify and set JSON content type
            fetchOptions.headers = {
              'Content-Type': 'application/json',
              ...fetchOptions.headers
            };
            fetchOptions.body = JSON.stringify(request.body);
          }
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Managed API error: ${response.status} ${response.statusText} - ${errorText}`);
          (error as any).status = response.status;
          throw error;
        }

        // Check if response is binary (audio) or JSON
        const contentType = response.headers.get('content-type') || '';
        const isBinary = contentType.includes('audio/') || contentType.includes('application/octet-stream');
        
        let data: any;
        let usage: any;
        let translatedText: string | undefined;
        
        if (isBinary) {
          // For binary responses (like TTS audio), return the raw ArrayBuffer
          data = await response.arrayBuffer();
          
          // Try to get usage from headers if available
          const usageCost = response.headers.get('X-Usage-Cost');
          const totalCost = response.headers.get('X-Total-Cost');
          const remainingBalance = response.headers.get('X-Remaining-Balance');
          const limitExceeded = response.headers.get('X-Limit-Exceeded');
          
          // Get translation metadata from headers (for combined translate/speak endpoint)
          translatedText = response.headers.get('X-Translated-Text') || undefined;
          
          if (usageCost || totalCost) {
            usage = {
              cost: usageCost ? parseFloat(usageCost) : undefined,
              totalCost: totalCost ? parseFloat(totalCost) : undefined,
              remainingBalance: remainingBalance ? parseFloat(remainingBalance) : undefined,
              isLimitExceeded: limitExceeded === 'true'
            };
          }
        } else {
          // For JSON responses, parse as usual
          const jsonData = await response.json();
          data = jsonData.data || jsonData;
          usage = jsonData.usage;
        }
        
        // Success - reset retry attempts
        this.errorHandler.resetRetryAttempts(context);
        
        return {
          success: true,
          data: data,
          usage: usage,
          translatedText: translatedText
        };

      } catch (error) {
        lastError = error;
        
        // Handle the error and determine if we should retry
        const managedError = this.errorHandler.handleError(error, context);
        
        if (!managedError.retryable || !this.errorHandler.shouldRetry(context, managedError.type)) {
          // No more retries, return error
          return {
            success: false,
            error: managedError.message
          };
        }

        // Increment retry attempt and wait before retrying
        this.errorHandler.incrementRetryAttempt(context);
        const retryDelay = this.errorHandler.getRetryDelay(
          managedError.type, 
          this.errorHandler['retryAttempts'].get(context) || 0
        );

        console.log(`🔄 Retrying managed API call in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Reload configuration from ConfigurationManager
   */
  public reloadConfiguration(): void {
    this.loadConfiguration();
  }

  /**
   * Load managed API configuration
   */
  private loadConfiguration(): void {
    const config = this.configManager.getConfig();
    const managedApiConfig = config.managedApiConfig as ManagedApiConfig | undefined;
    
    if (managedApiConfig) {
      this.currentMode = managedApiConfig.mode;
    } else {
      // Default to personal mode
      this.currentMode = 'personal';
    }

    console.log(`📋 Loaded managed API configuration: mode=${this.currentMode}`);
  }

  /**
   * Save managed API configuration
   */
  private async saveManagedApiConfig(managedApiConfig: ManagedApiConfig): Promise<void> {
    try {
      this.configManager.updateConfig({
        managedApiConfig
      });
      console.log('💾 Saved managed API configuration');
    } catch (error) {
      console.error('Failed to save managed API configuration:', error);
      throw error;
    }
  }

  /**
   * Get managed API configuration
   */
  public getManagedApiConfig(): ManagedApiConfig {
    const config = this.configManager.getConfig();
    return config.managedApiConfig as ManagedApiConfig || {
      mode: 'personal',
      lastModeSwitch: new Date().toISOString(),
      usageWarningsEnabled: true,
      autoSwitchOnLimit: false
    };
  }

  /**
   * Check if managed mode is available (user has subscription)
   * Note: The sync version checks configuration, async version validates access
   */
  public async validateManagedModeAvailable(): Promise<boolean> {
    return await this.validateManagedAccess();
  }

  /**
   * Get WebSocket connection state
   */
  public getWebSocketState(): string {
    return this.wsClient.getConnectionState();
  }

  /**
   * Check if WebSocket is connected
   */
  public isWebSocketConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Get WebSocket client instance
   */
  public getWebSocketClient(): WhispraWebSocketClient {
    return this.wsClient;
  }

  /**
   * Manually reconnect WebSocket (if in managed mode)
   */
  public async reconnectWebSocket(): Promise<void> {
    if (this.currentMode === 'managed') {
      console.log('🔄 Manually reconnecting WebSocket...');
      await this.wsClient.connect();
    } else {
      console.warn('Cannot reconnect WebSocket in personal mode');
    }
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    mode: ApiMode;
    wsState: string;
    wsConnected: boolean;
    wsStats: any;
  } {
    return {
      mode: this.currentMode,
      wsState: this.wsClient.getConnectionState(),
      wsConnected: this.wsClient.isConnected(),
      wsStats: this.wsClient.getStats()
    };
  }
}