/**
 * OpenAI Real-Time API Client
 * Handles streaming STT, translation, and TTS in a single connection
 * Note: Uses ws package for Node.js WebSocket support
 */

import { ApiKeyManager } from './ApiKeyManager';
import { EventEmitter } from 'events';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

// Use ws package for Node.js WebSocket support
let WebSocketClass: any;
let isNodeWebSocket = false;
try {
  WebSocketClass = require('ws');
  isNodeWebSocket = true;
} catch {
  // Fallback to global WebSocket if available (Electron renderer)
  WebSocketClass = (global as any).WebSocket;
  if (!WebSocketClass) {
    throw new Error('WebSocket not available. Please install ws package: npm install ws');
  }
}

export interface RealTimeConfig {
  apiKey?: string;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
  temperature?: number;
  maxResponseOutputTokens?: number;
  modalities?: ('text' | 'audio')[];
  inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
}

export interface RealTimeSession {
  sessionId: string;
  expiresAt: number;
}

export interface RealTimeEvent {
  type: 'session.created' | 'input_audio_buffer.speech_started' | 'input_audio_buffer.speech_stopped' | 
        'conversation.item.input_audio_transcription.completed' | 'response.audio_transcript.delta' |
        'response.audio_transcript.done' | 'response.audio.delta' | 'response.audio.done' |
        'response.done' | 'error' | 'ping' | 'pong';
  event_id?: string;
  data?: any;
}

export class OpenAIRealTimeClient extends EventEmitter {
  private apiKeyManager: ApiKeyManager;
  private config: RealTimeConfig;
  private ws: any = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;

  constructor(apiKeyManager: ApiKeyManager, config: Partial<RealTimeConfig> = {}) {
    super();
    this.apiKeyManager = apiKeyManager;
    this.config = {
      model: 'gpt-4o-realtime-preview-2024-10-01',
      voice: 'alloy',
      temperature: 0.8,
      maxResponseOutputTokens: 4096,
      modalities: ['text', 'audio'],
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
      ...config
    };
  }

  /**
   * Create a real-time session
   */
  async createSession(): Promise<RealTimeSession> {
    const apiKey = await this.apiKeyManager.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/realtime', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        voice: this.config.voice,
        instructions: this.config.instructions || 'You are a real-time translation assistant. Translate speech from the source language to the target language accurately and naturally.',
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxResponseOutputTokens,
        modalities: this.config.modalities,
        input_audio_format: this.config.inputAudioFormat,
        output_audio_format: this.config.outputAudioFormat
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Failed to create real-time session: ${response.status} ${errorText}`);
      ErrorReportingService.getInstance().captureError(error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'OpenAIRealTimeClient',
        context: { action: 'createSession', status: response.status }
      });
      throw error;
    }

    const data = await response.json();
    return {
      sessionId: data.id,
      expiresAt: data.expires_at
    };
  }

  /**
   * Connect to real-time WebSocket
   */
  async connect(sessionId?: string): Promise<void> {
    if (this.isConnected && this.ws) {
      return;
    }

    try {
      // Create session if not provided
      if (!sessionId) {
        const session = await this.createSession();
        sessionId = session.sessionId;
      }

      this.sessionId = sessionId;
      const apiKey = await this.apiKeyManager.getApiKey('openai');
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      // Connect to WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
      
      // For Node.js ws package, use different constructor
      if (isNodeWebSocket) {
        // Node.js ws package
        this.ws = new WebSocketClass(wsUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });
        
        // Node.js ws uses .on() method
        this.ws.on('open', () => {
          this.handleOpen();
        });

        this.ws.on('message', (data: Buffer | string) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[OpenAI Real-Time] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          this.handleClose();
        });
      } else {
        // Browser WebSocket (Electron renderer)
        this.ws = new WebSocketClass(wsUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        } as any);
        
        // Browser WebSocket uses event listeners
        this.ws.onopen = () => {
          this.handleOpen();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error: Event) => {
          console.error('[OpenAI Real-Time] WebSocket error:', error);
          this.emit('error', error);
        };

        this.ws.onclose = () => {
          this.handleClose();
        };
      }

    } catch (error) {
      console.error('[OpenAI Real-Time] Connection error:', error);
      ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'OpenAIRealTimeClient',
        context: { action: 'connect', sessionId }
      });
      throw error;
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('[OpenAI Real-Time] WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
    
    // Send session configuration
    this.send({
      type: 'session.update',
      session: {
        modalities: this.config.modalities,
        input_audio_format: this.config.inputAudioFormat,
        output_audio_format: this.config.outputAudioFormat,
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: [],
        tool_choice: 'auto',
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxResponseOutputTokens
      }
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(data: Buffer | string): void {
    try {
      const text = typeof data === 'string' ? data : data.toString();
      const event = JSON.parse(text);
      this.processEvent(event);
    } catch (error) {
      console.error('[OpenAI Real-Time] Error parsing message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(): void {
    console.log('[OpenAI Real-Time] WebSocket closed');
    this.isConnected = false;
    this.emit('disconnected');
    
    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`[OpenAI Real-Time] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect(this.sessionId || undefined);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private processEvent(event: RealTimeEvent): void {
    switch (event.type) {
      case 'session.created':
        console.log('[OpenAI Real-Time] Session created:', event.data);
        this.emit('sessionCreated', event.data);
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('speechStarted');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('speechStopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const transcription = event.data?.transcript;
        if (transcription) {
          this.emit('transcription', transcription);
        }
        break;

      case 'response.audio_transcript.delta':
        const delta = event.data?.delta;
        if (delta) {
          this.emit('transcriptDelta', delta);
        }
        break;

      case 'response.audio_transcript.done':
        const transcript = event.data?.transcript;
        if (transcript) {
          this.emit('transcriptDone', transcript);
        }
        break;

      case 'response.audio.delta':
        const audioDelta = event.data?.delta;
        if (audioDelta) {
          this.emit('audioDelta', audioDelta);
        }
        break;

      case 'response.audio.done':
        this.emit('audioDone');
        break;

      case 'response.done':
        this.emit('responseDone', event.data);
        break;

      case 'error':
        console.error('[OpenAI Real-Time] Error:', event.data);
        ErrorReportingService.getInstance().captureError(new Error(event.data?.message || 'Real-time API error'), {
          category: ErrorCategory.API,
          severity: ErrorSeverity.HIGH,
          component: 'OpenAIRealTimeClient',
          context: { action: 'processEvent', eventType: event.type, eventData: event.data }
        });
        this.emit('error', event.data);
        break;

      case 'ping':
        this.send({ type: 'pong' });
        break;

      default:
        console.log('[OpenAI Real-Time] Unhandled event:', event.type);
    }
  }

  /**
   * Send message to WebSocket
   */
  send(message: any): void {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const json = JSON.stringify(message);
    if (this.ws.send) {
      this.ws.send(json);
    } else {
      throw new Error('WebSocket send method not available');
    }
  }

  /**
   * Send audio data
   */
  sendAudio(audioData: ArrayBuffer): void {
    // Convert to base64
    const base64 = Buffer.from(audioData).toString('base64');
    
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64
    });
  }

  /**
   * Commit audio buffer (trigger processing)
   */
  commitAudio(): void {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  /**
   * Cancel current response
   */
  cancelResponse(): void {
    this.send({
      type: 'response.cancel'
    });
  }

  /**
   * Interrupt current response
   */
  interrupt(): void {
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Interrupt and stop speaking immediately.'
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
  }

  /**
   * Check if connected
   */
  isConnectedToRealTime(): boolean {
    return this.isConnected;
  }
}
