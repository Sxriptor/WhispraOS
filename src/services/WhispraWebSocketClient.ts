import WebSocket from 'ws';
import { BackendConfig } from './OpenSourceConfig';

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'transcribe' | 'translate' | 'tts' | 'chat';

/**
 * WebSocket request message
 */
export interface WebSocketRequest {
  id: string;
  type: WebSocketMessageType;
  data: any;
}

/**
 * WebSocket response message
 */
export interface WebSocketResponse {
  id: string;
  type: 'success' | 'error' | 'connection';
  data?: any;
  error?: string;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * WebSocket connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * WebSocket client for persistent connection to managed API backend
 * 
 * OPEN SOURCE NOTE: This client requires a configured backend.
 * Set BackendConfig.MANAGED_API_WS_URL to enable WebSocket connections.
 */
export class WhispraWebSocketClient {
  private static instance: WhispraWebSocketClient;
  private ws: WebSocket | null = null;
  private jwtToken: string | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private baseUrl: string;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private requestTimeout = 30000; // 30 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs = 30000; // 30 seconds
  private connectionPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();

  private constructor() {
    // Use configured WebSocket URL or derive from API URL
    this.baseUrl = BackendConfig.MANAGED_API_WS_URL || 
      (BackendConfig.MANAGED_API_URL ? BackendConfig.MANAGED_API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws' : '');
  }

  public static getInstance(): WhispraWebSocketClient {
    if (!WhispraWebSocketClient.instance) {
      WhispraWebSocketClient.instance = new WhispraWebSocketClient();
    }
    return WhispraWebSocketClient.instance;
  }

  /**
   * Set JWT token for authentication
   */
  public setToken(token: string): void {
    this.jwtToken = token;
  }

  /**
   * Clear JWT token
   */
  public clearToken(): void {
    this.jwtToken = null;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Add connection state change listener
   */
  public onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(state: ConnectionState): void {
    this.connectionState = state;
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    // If already connecting, return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected, return immediately
    if (this.isConnected()) {
      return Promise.resolve();
    }

    this.connectionPromise = this._connect();
    
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Internal connect implementation
   */
  private async _connect(): Promise<void> {
    if (!this.jwtToken) {
      throw new Error('No JWT token available for WebSocket connection');
    }

    return new Promise((resolve, reject) => {
      try {
        this.notifyStateChange('connecting');
        this.shouldReconnect = true;

        const url = `${this.baseUrl}?token=${this.jwtToken}`;
        console.log('🔌 Connecting to Whispra WebSocket...');

        this.ws = new WebSocket(url);

        // Connection opened
        this.ws.on('open', () => {
          console.log('✅ WebSocket connected to Whispra API');
          this.notifyStateChange('connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();
        });

        // Message received
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const response: WebSocketResponse = JSON.parse(data.toString());
            
            // Handle connection confirmation
            if (response.id === 'connection') {
              console.log('✅ WebSocket connection confirmed:', response.data);
              resolve();
              return;
            }

            // Handle response for pending request
            const pending = this.pendingRequests.get(response.id);
            if (pending) {
              clearTimeout(pending.timeout);
              
              if (response.type === 'success') {
                pending.resolve(response.data);
              } else if (response.type === 'error') {
                pending.reject(new Error(response.error || 'Unknown error'));
              }
              
              this.pendingRequests.delete(response.id);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        // Connection error
        this.ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          
          if (this.connectionState === 'connecting') {
            reject(error);
          }
        });

        // Connection closed
        this.ws.on('close', (code, reason) => {
          console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`);
          this.stopHeartbeat();
          
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection closed'));
          }
          this.pendingRequests.clear();

          // Attempt reconnection if appropriate
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          } else {
            this.notifyStateChange('disconnected');
          }
        });

        // Set connection timeout
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            reject(new Error('WebSocket connection timeout'));
            this.ws?.close();
          }
        }, 10000); // 10 second connection timeout

      } catch (error) {
        this.notifyStateChange('failed');
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.notifyStateChange('reconnecting');
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
          this.notifyStateChange('failed');
        }
      }
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.notifyStateChange('disconnected');
  }

  /**
   * Send request through WebSocket
   */
  public async sendRequest(type: WebSocketMessageType, data: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      const request: WebSocketRequest = { id, type, data };
      
      try {
        this.ws!.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Transcribe audio through WebSocket
   */
  public async transcribe(audioBlob: Blob, options?: {
    model?: string;
    language?: string;
    prompt?: string;
  }): Promise<any> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = this.arrayBufferToBase64(arrayBuffer);

    return await this.sendRequest('transcribe', {
      audio: base64Audio,
      model: options?.model || 'whisper-1',
      language: options?.language,
      prompt: options?.prompt
    });
  }

  /**
   * Translate text through WebSocket
   */
  public async translate(text: string, targetLanguage: string, options?: {
    sourceLanguage?: string;
    model?: string;
  }): Promise<any> {
    return await this.sendRequest('translate', {
      text,
      targetLanguage,
      sourceLanguage: options?.sourceLanguage,
      model: options?.model || 'gpt-4'
    });
  }

  /**
   * Text-to-speech through WebSocket
   */
  public async textToSpeech(text: string, options?: {
    voice?: string;
    model?: string;
    provider?: 'openai' | 'elevenlabs';
  }): Promise<ArrayBuffer> {
    const result = await this.sendRequest('tts', {
      text,
      voice: options?.voice || 'alloy',
      model: options?.model || 'tts-1',
      provider: options?.provider || 'openai'
    });

    // Convert base64 to ArrayBuffer
    return this.base64ToArrayBuffer(result.audio);
  }

  /**
   * Chat completion through WebSocket
   */
  public async chat(messages: Array<{ role: string; content: string }>, options?: {
    model?: string;
  }): Promise<any> {
    return await this.sendRequest('chat', {
      messages,
      model: options?.model || 'gpt-4'
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.ping();
        } catch (error) {
          console.error('Heartbeat ping failed:', error);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    state: ConnectionState;
    reconnectAttempts: number;
    pendingRequests: number;
  } {
    return {
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      pendingRequests: this.pendingRequests.size
    };
  }
}
