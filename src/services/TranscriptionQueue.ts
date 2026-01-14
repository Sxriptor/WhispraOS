import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';
import { TranscriptionResult } from '../interfaces/SpeechToTextService';
import { SpeechToTextService } from './SpeechToTextService';

export interface QueueItem {
  id: string;
  segment: AudioSegment;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface QueueConfig {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  defaultPriority: number;
  retryDelay: number;
  maxRetries: number;
  rateLimitDelay: number;
}

export interface QueueStats {
  totalItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageProcessingTime: number;
  queueLength: number;
}

export class TranscriptionQueue extends EventEmitter {
  private sttService: SpeechToTextService;
  private config: QueueConfig;
  private queue: QueueItem[] = [];
  private processing = new Map<string, QueueItem>();
  private completed = new Map<string, { item: QueueItem; result: TranscriptionResult; processingTime: number }>();
  private failed = new Map<string, { item: QueueItem; error: Error; processingTime: number }>();
  private isRunning = false;
  private lastProcessTime = 0;

  constructor(sttService: SpeechToTextService, config: Partial<QueueConfig> = {}) {
    super();
    this.sttService = sttService;
    this.config = {
      maxConcurrentJobs: 3,
      maxQueueSize: 50,
      defaultPriority: 1,
      retryDelay: 2000,
      maxRetries: 3,
      rateLimitDelay: 1000,
      ...config
    };
  }

  async addSegment(
    segment: AudioSegment,
    priority: number = this.config.defaultPriority,
    maxRetries: number = this.config.maxRetries
  ): Promise<string> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full (max ${this.config.maxQueueSize} items)`);
    }

    const item: QueueItem = {
      id: `queue_${segment.id}_${Date.now()}`,
      segment,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries
    };

    // Insert item in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(queueItem => queueItem.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.emit('itemAdded', { item, queueLength: this.queue.length });

    // Start processing if not already running
    if (!this.isRunning) {
      this.startProcessing();
    }

    return item.id;
  }

  private async startProcessing(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('processingStarted');

    while (this.queue.length > 0 || this.processing.size > 0) {
      // Start new jobs if we have capacity and items in queue
      while (this.processing.size < this.config.maxConcurrentJobs && this.queue.length > 0) {
        const item = this.queue.shift()!;
        this.processItem(item);
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isRunning = false;
    this.emit('processingCompleted');
  }

  private async processItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    
    this.processing.set(item.id, item);
    this.emit('itemProcessingStarted', { item });

    try {
      // Apply rate limiting
      const timeSinceLastProcess = Date.now() - this.lastProcessTime;
      if (timeSinceLastProcess < this.config.rateLimitDelay) {
        await new Promise(resolve => 
          setTimeout(resolve, this.config.rateLimitDelay - timeSinceLastProcess)
        );
      }

      this.lastProcessTime = Date.now();

      // Process transcription
      const result = await this.sttService.transcribe(item.segment);
      const processingTime = Date.now() - startTime;

      // Move to completed
      this.processing.delete(item.id);
      this.completed.set(item.id, { item, result, processingTime });

      this.emit('itemCompleted', { item, result, processingTime });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.processing.delete(item.id);

      // Check if we should retry
      if (item.retryCount < item.maxRetries && this.shouldRetry(error as Error)) {
        item.retryCount++;
        
        this.emit('itemRetrying', { 
          item, 
          error, 
          retryCount: item.retryCount, 
          maxRetries: item.maxRetries 
        });

        // Add back to queue with delay
        setTimeout(() => {
          // Re-add to queue (maintain priority)
          const insertIndex = this.queue.findIndex(queueItem => queueItem.priority < item.priority);
          if (insertIndex === -1) {
            this.queue.push(item);
          } else {
            this.queue.splice(insertIndex, 0, item);
          }
        }, this.config.retryDelay * Math.pow(2, item.retryCount - 1)); // Exponential backoff

      } else {
        // Move to failed
        this.failed.set(item.id, { item, error: error as Error, processingTime });
        this.emit('itemFailed', { item, error, processingTime });
      }
    }
  }

  private shouldRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Don't retry on authentication errors
    if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('api key')) {
      return false;
    }

    // Don't retry on validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid audio')) {
      return false;
    }

    // Retry on rate limits, timeouts, and network errors
    if (errorMessage.includes('429') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('network') ||
        errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503')) {
      return true;
    }

    // Default to retry for unknown errors
    return true;
  }

  getQueueStats(): QueueStats {
    const completedItems = Array.from(this.completed.values());
    const averageProcessingTime = completedItems.length > 0
      ? completedItems.reduce((sum, item) => sum + item.processingTime, 0) / completedItems.length
      : 0;

    return {
      totalItems: this.queue.length + this.processing.size + this.completed.size + this.failed.size,
      processingItems: this.processing.size,
      completedItems: this.completed.size,
      failedItems: this.failed.size,
      averageProcessingTime: Math.round(averageProcessingTime),
      queueLength: this.queue.length
    };
  }

  getQueuedItems(): QueueItem[] {
    return [...this.queue];
  }

  getProcessingItems(): QueueItem[] {
    return Array.from(this.processing.values());
  }

  getCompletedResults(): Array<{ item: QueueItem; result: TranscriptionResult; processingTime: number }> {
    return Array.from(this.completed.values());
  }

  getFailedItems(): Array<{ item: QueueItem; error: Error; processingTime: number }> {
    return Array.from(this.failed.values());
  }

  getItemStatus(itemId: string): 'queued' | 'processing' | 'completed' | 'failed' | 'not_found' {
    if (this.queue.some(item => item.id === itemId)) return 'queued';
    if (this.processing.has(itemId)) return 'processing';
    if (this.completed.has(itemId)) return 'completed';
    if (this.failed.has(itemId)) return 'failed';
    return 'not_found';
  }

  getResult(itemId: string): TranscriptionResult | null {
    const completed = this.completed.get(itemId);
    return completed ? completed.result : null;
  }

  removeItem(itemId: string): boolean {
    // Remove from queue if present
    const queueIndex = this.queue.findIndex(item => item.id === itemId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      this.emit('itemRemoved', { itemId, location: 'queue' });
      return true;
    }

    // Cannot remove items that are currently processing
    if (this.processing.has(itemId)) {
      return false;
    }

    // Remove from completed/failed
    if (this.completed.delete(itemId)) {
      this.emit('itemRemoved', { itemId, location: 'completed' });
      return true;
    }

    if (this.failed.delete(itemId)) {
      this.emit('itemRemoved', { itemId, location: 'failed' });
      return true;
    }

    return false;
  }

  clearQueue(): void {
    this.queue = [];
    this.emit('queueCleared');
  }

  clearCompleted(): void {
    this.completed.clear();
    this.emit('completedCleared');
  }

  clearFailed(): void {
    this.failed.clear();
    this.emit('failedCleared');
  }

  clearAll(): void {
    this.clearQueue();
    this.clearCompleted();
    this.clearFailed();
    this.emit('allCleared');
  }

  pauseProcessing(): void {
    this.isRunning = false;
    this.emit('processingPaused');
  }

  resumeProcessing(): void {
    if (!this.isRunning && (this.queue.length > 0 || this.processing.size > 0)) {
      this.startProcessing();
    }
  }

  updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): QueueConfig {
    return { ...this.config };
  }

  dispose(): void {
    this.pauseProcessing();
    this.clearAll();
    this.removeAllListeners();
  }
}