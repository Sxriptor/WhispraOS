// NOTE: ManagedApiRouter import removed to avoid circular dependency
// The router reference will be set by ManagedApiRouter after initialization
import { ManagedApiWarningBanner } from '../ui/components/ManagedApiWarningBanner';

/**
 * Error types for managed API
 */
export enum ManagedApiErrorType {
  USAGE_LIMIT_EXCEEDED = 'usage_limit_exceeded',
  SUBSCRIPTION_REQUIRED = 'subscription_required',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  AUTHENTICATION_FAILED = 'authentication_failed',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  RATE_LIMITED = 'rate_limited',
  INVALID_REQUEST = 'invalid_request',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Managed API error interface
 */
export interface ManagedApiError {
  type: ManagedApiErrorType;
  message: string;
  originalError?: Error;
  retryable: boolean;
  suggestedAction: string;
  fallbackToPersonal: boolean;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  fallbackToPersonal: boolean;
  showUserNotification: boolean;
}

/**
 * Handles errors and recovery for managed API services
 */
export class ManagedApiErrorHandler {
  private static instance: ManagedApiErrorHandler;
  private _managedApiRouter: any = null; // Will be set by ManagedApiRouter after initialization
  private retryAttempts: Map<string, number> = new Map();

  private constructor() {
    // managedApiRouter will be set externally to avoid circular dependency
  }

  /**
   * Set the managed API router reference (called by ManagedApiRouter to avoid circular dependency)
   */
  public set managedApiRouter(router: any) {
    this._managedApiRouter = router;
  }

  /**
   * Get the managed API router reference
   */
  public get managedApiRouter(): any {
    return this._managedApiRouter;
  }

  public static getInstance(): ManagedApiErrorHandler {
    if (!ManagedApiErrorHandler.instance) {
      ManagedApiErrorHandler.instance = new ManagedApiErrorHandler();
    }
    return ManagedApiErrorHandler.instance;
  }

  /**
   * Handle managed API error and determine recovery strategy
   */
  public handleError(error: any, context: string = 'unknown'): ManagedApiError {
    const managedError = this.classifyError(error);
    
    console.error(`🚨 Managed API Error [${context}]:`, {
      type: managedError.type,
      message: managedError.message,
      retryable: managedError.retryable,
      fallbackToPersonal: managedError.fallbackToPersonal
    });

    // Execute recovery strategy
    this.executeRecoveryStrategy(managedError, context);

    return managedError;
  }

  /**
   * Classify error and determine type
   */
  private classifyError(error: any): ManagedApiError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const statusCode = error?.status || error?.response?.status;

    // Usage limit exceeded
    if (errorMessage.includes('usage limit') || 
        errorMessage.includes('quota exceeded') ||
        statusCode === 429) {
      return {
        type: ManagedApiErrorType.USAGE_LIMIT_EXCEEDED,
        message: 'Monthly usage limit of $20 has been exceeded',
        originalError: error,
        retryable: false,
        suggestedAction: 'Wait for next billing period or switch to personal API keys',
        fallbackToPersonal: true
      };
    }

    // Subscription required/expired
    if (errorMessage.includes('subscription') || 
        errorMessage.includes('access denied') ||
        statusCode === 403) {
      return {
        type: ManagedApiErrorType.SUBSCRIPTION_REQUIRED,
        message: 'Active subscription required for managed API access',
        originalError: error,
        retryable: false,
        suggestedAction: 'Upgrade to a managed API plan or use personal API keys',
        fallbackToPersonal: true
      };
    }

    // Authentication failed
    if (errorMessage.includes('authentication') || 
        errorMessage.includes('unauthorized') ||
        statusCode === 401) {
      return {
        type: ManagedApiErrorType.AUTHENTICATION_FAILED,
        message: 'Authentication failed for managed API service',
        originalError: error,
        retryable: true,
        suggestedAction: 'Please sign in again or check your account status',
        fallbackToPersonal: false
      };
    }

    // Service unavailable
    if (errorMessage.includes('service unavailable') || 
        errorMessage.includes('server error') ||
        statusCode >= 500) {
      return {
        type: ManagedApiErrorType.SERVICE_UNAVAILABLE,
        message: 'Managed API service is temporarily unavailable',
        originalError: error,
        retryable: true,
        suggestedAction: 'Please try again in a few moments or use personal API keys',
        fallbackToPersonal: true
      };
    }

    // Rate limited
    if (errorMessage.includes('rate limit') || statusCode === 429) {
      return {
        type: ManagedApiErrorType.RATE_LIMITED,
        message: 'Too many requests to managed API service',
        originalError: error,
        retryable: true,
        suggestedAction: 'Please wait a moment before trying again',
        fallbackToPersonal: false
      };
    }

    // Network error
    if (errorMessage.includes('network') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('connection')) {
      return {
        type: ManagedApiErrorType.NETWORK_ERROR,
        message: 'Network error connecting to managed API service',
        originalError: error,
        retryable: true,
        suggestedAction: 'Check your internet connection and try again',
        fallbackToPersonal: true
      };
    }

    // Invalid request
    if (statusCode >= 400 && statusCode < 500) {
      return {
        type: ManagedApiErrorType.INVALID_REQUEST,
        message: 'Invalid request to managed API service',
        originalError: error,
        retryable: false,
        suggestedAction: 'Please try a different request or use personal API keys',
        fallbackToPersonal: true
      };
    }

    // Unknown error
    return {
      type: ManagedApiErrorType.UNKNOWN_ERROR,
      message: errorMessage,
      originalError: error,
      retryable: true,
      suggestedAction: 'Please try again or switch to personal API keys',
      fallbackToPersonal: true
    };
  }

  /**
   * Execute recovery strategy based on error type
   */
  private executeRecoveryStrategy(error: ManagedApiError, context: string): void {
    const strategy = this.getRecoveryStrategy(error.type);
    
    switch (error.type) {
      case ManagedApiErrorType.USAGE_LIMIT_EXCEEDED:
        this.handleUsageLimitExceeded();
        break;
        
      case ManagedApiErrorType.SUBSCRIPTION_REQUIRED:
      case ManagedApiErrorType.SUBSCRIPTION_EXPIRED:
        this.handleSubscriptionRequired();
        break;
        
      case ManagedApiErrorType.AUTHENTICATION_FAILED:
        this.handleAuthenticationFailed();
        break;
        
      case ManagedApiErrorType.SERVICE_UNAVAILABLE:
        this.handleServiceUnavailable(context);
        break;
        
      default:
        if (strategy.showUserNotification) {
          this.showErrorNotification(error);
        }
        break;
    }
  }

  /**
   * Get recovery strategy for error type
   */
  private getRecoveryStrategy(errorType: ManagedApiErrorType): ErrorRecoveryStrategy {
    const strategies: Record<ManagedApiErrorType, ErrorRecoveryStrategy> = {
      [ManagedApiErrorType.USAGE_LIMIT_EXCEEDED]: {
        maxRetries: 0,
        retryDelay: 0,
        exponentialBackoff: false,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.SUBSCRIPTION_REQUIRED]: {
        maxRetries: 0,
        retryDelay: 0,
        exponentialBackoff: false,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.SUBSCRIPTION_EXPIRED]: {
        maxRetries: 0,
        retryDelay: 0,
        exponentialBackoff: false,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.AUTHENTICATION_FAILED]: {
        maxRetries: 1,
        retryDelay: 2000,
        exponentialBackoff: false,
        fallbackToPersonal: false,
        showUserNotification: true
      },
      [ManagedApiErrorType.SERVICE_UNAVAILABLE]: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.RATE_LIMITED]: {
        maxRetries: 2,
        retryDelay: 5000,
        exponentialBackoff: true,
        fallbackToPersonal: false,
        showUserNotification: false
      },
      [ManagedApiErrorType.NETWORK_ERROR]: {
        maxRetries: 3,
        retryDelay: 2000,
        exponentialBackoff: true,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.INVALID_REQUEST]: {
        maxRetries: 0,
        retryDelay: 0,
        exponentialBackoff: false,
        fallbackToPersonal: true,
        showUserNotification: true
      },
      [ManagedApiErrorType.UNKNOWN_ERROR]: {
        maxRetries: 1,
        retryDelay: 1000,
        exponentialBackoff: false,
        fallbackToPersonal: true,
        showUserNotification: true
      }
    };

    return strategies[errorType];
  }

  /**
   * Handle usage limit exceeded
   */
  private async handleUsageLimitExceeded(): Promise<void> {
    console.warn('🚫 Usage limit exceeded, offering fallback to personal keys');
    
    // Show modal with options
    this.showUsageLimitModal();
  }

  /**
   * Handle subscription required
   */
  private async handleSubscriptionRequired(): Promise<void> {
    console.warn('💳 Subscription required for managed API access');
    
    // Switch to personal mode if possible
    try {
      await this.managedApiRouter.setMode('personal');
      this.showSubscriptionRequiredNotification();
    } catch (error) {
      console.error('Failed to switch to personal mode:', error);
    }
  }

  /**
   * Handle authentication failed
   */
  private async handleAuthenticationFailed(): Promise<void> {
    console.warn('🔐 Authentication failed for managed API');
    
    // Clear tokens and show re-authentication prompt
    this.showAuthenticationFailedModal();
  }

  /**
   * Handle service unavailable
   */
  private async handleServiceUnavailable(context: string): Promise<void> {
    console.warn(`🔧 Managed API service unavailable [${context}]`);
    
    // Show temporary fallback notification
    this.showServiceUnavailableNotification();
  }

  /**
   * Show usage limit exceeded modal (main process - log only)
   */
  private showUsageLimitModal(): void {
    console.warn('🚨 Usage limit exceeded - UI modal should be shown in renderer process');
    // TODO: Send IPC message to renderer to show modal
  }

  /**
   * Show authentication failed modal (main process - log only)
   */
  private showAuthenticationFailedModal(): void {
    console.warn('🚨 Authentication failed - UI modal should be shown in renderer process');
    // TODO: Send IPC message to renderer to show modal
  }

  /**
   * Show simple notification
   */
  private showErrorNotification(error: ManagedApiError): void {
    this.showNotification(error.message, 'error');
  }

  private showSubscriptionRequiredNotification(): void {
    this.showNotification('Switched to personal API keys. Upgrade your subscription for managed API access.', 'warning');
  }

  private showServiceUnavailableNotification(): void {
    this.showNotification('Managed API service temporarily unavailable. Using personal keys as fallback.', 'warning');
  }

  private showSuccessNotification(message: string): void {
    this.showNotification(message, 'success');
  }

  /**
   * Show notification toast
   */
  private showNotification(message: string, type: 'success' | 'warning' | 'error'): void {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    console.log(`${icons[type]} ${type.toUpperCase()}: ${message}`);
    // TODO: Send IPC message to renderer to show notification
  }

  /**
   * Check if should retry based on attempt count
   */
  public shouldRetry(context: string, errorType: ManagedApiErrorType): boolean {
    const strategy = this.getRecoveryStrategy(errorType);
    const attempts = this.retryAttempts.get(context) || 0;
    
    return attempts < strategy.maxRetries;
  }

  /**
   * Increment retry attempt count
   */
  public incrementRetryAttempt(context: string): void {
    const attempts = this.retryAttempts.get(context) || 0;
    this.retryAttempts.set(context, attempts + 1);
  }

  /**
   * Reset retry attempt count
   */
  public resetRetryAttempts(context: string): void {
    this.retryAttempts.delete(context);
  }

  /**
   * Get retry delay for error type
   */
  public getRetryDelay(errorType: ManagedApiErrorType, attempt: number): number {
    const strategy = this.getRecoveryStrategy(errorType);
    
    if (strategy.exponentialBackoff) {
      return strategy.retryDelay * Math.pow(2, attempt);
    } else {
      return strategy.retryDelay;
    }
  }
}