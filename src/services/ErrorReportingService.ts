import { app } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { 
  OpenSourceFeatures, 
  BackendConfig, 
  isErrorReportingConfigured 
} from './OpenSourceConfig';

/**
 * Internal error report structure for queuing
 */
interface QueuedError {
  message: string;
  code?: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  component: string;
  context?: Record<string, any>;
  timestamp: number;
  processType: string;
}

/**
 * API payload structure matching backend expectations
 * POST to configured ERROR_REPORTING_URL
 */
interface ErrorReportPayload {
  appVersion: string;
  platform: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  context?: Record<string, any>;
  timestamp: string;
}

/**
 * Options for capturing an error
 */
export interface CaptureErrorOptions {
  /** Error code if available */
  code?: string;
  /** Error category */
  category?: ErrorCategory;
  /** Error severity */
  severity?: ErrorSeverity;
  /** Component/service name */
  component?: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Process type */
  processType?: 'main' | 'renderer' | 'overlay';
}

/**
 * Service for reporting errors to the backend
 * 
 * OPEN SOURCE NOTE: Remote error reporting is DISABLED by default.
 * Errors are only logged locally unless a backend is configured.
 * To enable remote reporting:
 * 1. Set OpenSourceFeatures.ERROR_REPORTING_ENABLED = true
 * 2. Configure BackendConfig.ERROR_REPORTING_URL
 */
export class ErrorReportingService {
  private static instance: ErrorReportingService;

  private readonly MAX_QUEUE_SIZE = 100;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 5000;

  private errorQueue: QueuedError[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private appVersion: string = 'unknown';
  private userId?: string;
  private userEmail?: string;
  private isInitialized = false;
  private isSending = false;
  private queueFilePath: string;
  private isRemoteReportingEnabled: boolean = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.queueFilePath = path.join(app.getPath('userData'), 'error-queue.json');
    
    // Check if remote error reporting is configured
    this.isRemoteReportingEnabled = isErrorReportingConfigured();
    
    if (!this.isRemoteReportingEnabled) {
      console.log('ℹ️ ErrorReportingService: Remote reporting disabled - errors logged locally only');
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * Initialize the error reporting service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get app version
      try {
        const packageJsonPath = app.isPackaged
          ? path.join(process.resourcesPath, 'app.asar', 'package.json')
          : path.join(__dirname, '..', '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        this.appVersion = packageJson.version || 'unknown';
      } catch {
        this.appVersion = app.getVersion() || 'unknown';
      }

      // Only load queue and start timer if remote reporting is enabled
      if (this.isRemoteReportingEnabled) {
        // Load any queued errors from disk
        await this.loadQueueFromDisk();

        // Start batch processing timer
        this.startBatchTimer();
      }

      this.isInitialized = true;
      console.log(`📊 ErrorReportingService initialized (remote: ${this.isRemoteReportingEnabled ? 'enabled' : 'disabled'})`);
    } catch (error) {
      console.error('Failed to initialize ErrorReportingService:', error);
    }
  }

  /**
   * Set the current user ID for error attribution
   */
  public setUserId(userId: string | undefined): void {
    this.userId = userId;
  }

  /**
   * Set the current user email for error attribution
   */
  public setUserEmail(email: string | undefined): void {
    this.userEmail = email;
    if (email) {
      console.log('📊 User email set for error reporting:', email);
    } else {
      console.log('📊 User email cleared for error reporting');
    }
  }

  /**
   * Set both user ID and email from token
   */
  public async setUserFromToken(): Promise<void> {
    try {
      const { TokenUtils } = await import('./TokenUtils');
      const userId = await TokenUtils.extractUserId();
      const email = await TokenUtils.extractUserEmail();
      this.userId = userId || undefined;
      this.userEmail = email || undefined;
      console.log('📊 User info set for error reporting - userId:', userId, 'email:', email);
    } catch (error) {
      console.warn('Failed to set user info for error reporting:', error);
    }
  }

  /**
   * Clear user info (on sign out)
   */
  public clearUserInfo(): void {
    this.userId = undefined;
    this.userEmail = undefined;
  }

  /**
   * Capture and queue an error for reporting
   */
  public captureError(error: Error | string, options: CaptureErrorOptions = {}): void {
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // Extract error code if available (e.g., from Node.js errors)
      const errorCode = options.code || (errorObj as any).code || undefined;

      const queuedError: QueuedError = {
        message: errorObj.message,
        code: errorCode,
        stack: errorObj.stack,
        category: options.category || ErrorCategory.UNKNOWN,
        severity: options.severity || ErrorSeverity.MEDIUM,
        component: options.component || 'unknown',
        context: options.context,
        timestamp: Date.now(),
        processType: options.processType || 'main'
      };

      this.queueError(queuedError);
    } catch (captureError) {
      console.error('Failed to capture error:', captureError);
    }
  }

  /**
   * Capture an error from the renderer process
   */
  public captureRendererError(errorData: {
    message: string;
    code?: string;
    stack?: string;
    category?: string;
    severity?: string;
    component?: string;
    context?: Record<string, any>;
    processType?: string;
  }): void {
    try {
      const queuedError: QueuedError = {
        message: errorData.message,
        code: errorData.code,
        stack: errorData.stack,
        category: (errorData.category as ErrorCategory) || ErrorCategory.UI,
        severity: (errorData.severity as ErrorSeverity) || ErrorSeverity.MEDIUM,
        component: errorData.component || 'renderer',
        context: errorData.context,
        timestamp: Date.now(),
        processType: errorData.processType || 'renderer'
      };

      this.queueError(queuedError);
    } catch (captureError) {
      console.error('Failed to capture renderer error:', captureError);
    }
  }

  /**
   * Queue an error report
   */
  private queueError(error: QueuedError): void {
    // Always log errors locally
    console.error(`[${error.category}/${error.severity}] ${error.component}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }

    // Only queue for remote reporting if enabled
    if (!this.isRemoteReportingEnabled) {
      return;
    }

    // Add to queue
    this.errorQueue.push(error);

    // Trim queue if too large
    if (this.errorQueue.length > this.MAX_QUEUE_SIZE) {
      this.errorQueue = this.errorQueue.slice(-this.MAX_QUEUE_SIZE);
    }

    // Save queue to disk for persistence
    this.saveQueueToDisk().catch(() => {});

    // If queue is full enough, send immediately
    if (this.errorQueue.length >= this.BATCH_SIZE) {
      this.sendBatch();
    }
  }

  /**
   * Start the batch processing timer
   */
  private startBatchTimer(): void {
    if (!this.isRemoteReportingEnabled) return;

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      if (this.errorQueue.length > 0) {
        this.sendBatch();
      }
    }, this.BATCH_INTERVAL_MS);
  }

  /**
   * Send a batch of errors to the backend
   */
  private async sendBatch(): Promise<void> {
    if (!this.isRemoteReportingEnabled) return;
    if (this.isSending || this.errorQueue.length === 0) return;

    this.isSending = true;

    try {
      const batch = this.errorQueue.splice(0, this.BATCH_SIZE);

      for (const error of batch) {
        await this.sendErrorReport(error);
      }

      // Save remaining queue to disk
      await this.saveQueueToDisk();
    } catch (error) {
      console.error('Failed to send error batch:', error);
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Convert internal error to API payload format
   */
  private buildPayload(error: QueuedError): ErrorReportPayload {
    // Build context with all additional info
    const context: Record<string, any> = {
      ...error.context,
      userId: this.userId,
      userEmail: this.userEmail,
      sessionId: this.sessionId,
      category: error.category,
      severity: error.severity,
      component: error.component,
      processType: error.processType,
      osVersion: os.release(),
      electronVersion: process.versions.electron || 'unknown',
      nodeVersion: process.versions.node || 'unknown'
    };

    // Remove undefined values from context
    Object.keys(context).forEach(key => {
      if (context[key] === undefined) {
        delete context[key];
      }
    });

    // Log if email is missing (for debugging)
    if (!this.userEmail && this.userId) {
      console.warn('⚠️ User ID present but email missing in error report - email extraction may have failed');
    }

    return {
      appVersion: this.appVersion,
      platform: process.platform,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context,
      timestamp: new Date(error.timestamp).toISOString()
    };
  }

  /**
   * Send a single error report to the backend
   */
  private async sendErrorReport(error: QueuedError, retryCount = 0): Promise<boolean> {
    // Skip if remote reporting is not enabled
    if (!this.isRemoteReportingEnabled) {
      return false;
    }

    const backendUrl = BackendConfig.ERROR_REPORTING_URL;
    if (!backendUrl) {
      return false;
    }

    try {
      const payload = this.buildPayload(error);

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return true;
      }

      // Retry on server errors
      if (response.status >= 500 && retryCount < this.MAX_RETRIES) {
        await this.delay(this.RETRY_DELAY_MS * (retryCount + 1));
        return this.sendErrorReport(error, retryCount + 1);
      }

      console.warn(`Failed to send error report: ${response.status}`);
      return false;
    } catch (err) {
      // Retry on network errors
      if (retryCount < this.MAX_RETRIES) {
        await this.delay(this.RETRY_DELAY_MS * (retryCount + 1));
        return this.sendErrorReport(error, retryCount + 1);
      }

      console.error('Failed to send error report after retries:', err);
      return false;
    }
  }

  /**
   * Save error queue to disk for persistence across restarts
   */
  private async saveQueueToDisk(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.queueFilePath,
        JSON.stringify(this.errorQueue),
        'utf-8'
      );
    } catch {
      // Silently fail - disk persistence is best-effort
    }
  }

  /**
   * Load error queue from disk
   */
  private async loadQueueFromDisk(): Promise<void> {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const data = await fs.promises.readFile(this.queueFilePath, 'utf-8');
        const savedQueue = JSON.parse(data);
        if (Array.isArray(savedQueue)) {
          this.errorQueue = savedQueue;
        }
        // Clear the file after loading
        await fs.promises.unlink(this.queueFilePath);
      }
    } catch {
      // Silently fail - disk persistence is best-effort
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Flush all pending errors immediately
   */
  public async flush(): Promise<void> {
    if (this.errorQueue.length > 0) {
      await this.sendBatch();
    }
  }

  /**
   * Cleanup service resources
   */
  public cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Try to send any remaining errors synchronously before shutdown
    if (this.errorQueue.length > 0) {
      this.saveQueueToDisk().catch(() => {});
    }

    console.log('📊 ErrorReportingService cleaned up');
  }
}
