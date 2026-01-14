import { ManagedApiErrorHandler, ManagedApiErrorType } from '../services/ManagedApiErrorHandler';

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    style: {},
    innerHTML: '',
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn()
  }))
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
});

describe('ManagedApiErrorHandler', () => {
  let errorHandler: ManagedApiErrorHandler;

  beforeEach(() => {
    // Reset singleton
    (ManagedApiErrorHandler as any).instance = undefined;
    errorHandler = ManagedApiErrorHandler.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Error Classification', () => {
    test('should classify usage limit exceeded error', () => {
      const error = new Error('usage limit exceeded');
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.USAGE_LIMIT_EXCEEDED);
      expect(managedError.retryable).toBe(false);
      expect(managedError.fallbackToPersonal).toBe(true);
      expect(managedError.message).toContain('Monthly usage limit');
    });

    test('should classify subscription required error', () => {
      const error = { status: 403, message: 'subscription required' };
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.SUBSCRIPTION_REQUIRED);
      expect(managedError.retryable).toBe(false);
      expect(managedError.fallbackToPersonal).toBe(true);
    });

    test('should classify authentication failed error', () => {
      const error = { status: 401, message: 'unauthorized' };
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.AUTHENTICATION_FAILED);
      expect(managedError.retryable).toBe(true);
      expect(managedError.fallbackToPersonal).toBe(false);
    });

    test('should classify service unavailable error', () => {
      const error = { status: 500, message: 'internal server error' };
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.SERVICE_UNAVAILABLE);
      expect(managedError.retryable).toBe(true);
      expect(managedError.fallbackToPersonal).toBe(true);
    });

    test('should classify rate limited error', () => {
      const error = { status: 429, message: 'too many requests' };
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.RATE_LIMITED);
      expect(managedError.retryable).toBe(true);
      expect(managedError.fallbackToPersonal).toBe(false);
    });

    test('should classify network error', () => {
      const error = new Error('fetch failed');
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.NETWORK_ERROR);
      expect(managedError.retryable).toBe(true);
      expect(managedError.fallbackToPersonal).toBe(true);
    });

    test('should classify unknown error', () => {
      const error = new Error('something went wrong');
      
      const managedError = errorHandler.handleError(error, 'test-context');
      
      expect(managedError.type).toBe(ManagedApiErrorType.UNKNOWN_ERROR);
      expect(managedError.retryable).toBe(true);
      expect(managedError.fallbackToPersonal).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    test('should allow retries for retryable errors', () => {
      const context = 'test-retry';
      
      // First attempt should be allowed
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      
      // Increment attempts
      errorHandler.incrementRetryAttempt(context);
      errorHandler.incrementRetryAttempt(context);
      errorHandler.incrementRetryAttempt(context);
      
      // Should still allow retries (max is 3 for service unavailable)
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      
      // One more increment should exceed limit
      errorHandler.incrementRetryAttempt(context);
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(false);
    });

    test('should not allow retries for non-retryable errors', () => {
      const context = 'test-no-retry';
      
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.USAGE_LIMIT_EXCEEDED)).toBe(false);
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SUBSCRIPTION_REQUIRED)).toBe(false);
    });

    test('should reset retry attempts', () => {
      const context = 'test-reset';
      
      errorHandler.incrementRetryAttempt(context);
      errorHandler.incrementRetryAttempt(context);
      
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      
      errorHandler.resetRetryAttempts(context);
      
      // Should be back to 0 attempts
      expect(errorHandler.shouldRetry(context, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
    });

    test('should calculate retry delay with exponential backoff', () => {
      const baseDelay = errorHandler.getRetryDelay(ManagedApiErrorType.SERVICE_UNAVAILABLE, 0);
      const secondDelay = errorHandler.getRetryDelay(ManagedApiErrorType.SERVICE_UNAVAILABLE, 1);
      const thirdDelay = errorHandler.getRetryDelay(ManagedApiErrorType.SERVICE_UNAVAILABLE, 2);
      
      expect(secondDelay).toBe(baseDelay * 2);
      expect(thirdDelay).toBe(baseDelay * 4);
    });

    test('should calculate retry delay without exponential backoff', () => {
      const baseDelay = errorHandler.getRetryDelay(ManagedApiErrorType.AUTHENTICATION_FAILED, 0);
      const secondDelay = errorHandler.getRetryDelay(ManagedApiErrorType.AUTHENTICATION_FAILED, 1);
      
      expect(secondDelay).toBe(baseDelay); // No exponential backoff
    });
  });

  describe('User Notifications', () => {
    test('should show usage limit modal', () => {
      const error = new Error('usage limit exceeded');
      
      errorHandler.handleError(error, 'test-context');
      
      // Should create modal element
      expect(document.createElement).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should show authentication failed modal', () => {
      const error = { status: 401, message: 'unauthorized' };
      
      errorHandler.handleError(error, 'test-context');
      
      // Should create modal element
      expect(document.createElement).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should show notification for other errors', () => {
      const error = { status: 500, message: 'server error' };
      
      errorHandler.handleError(error, 'test-context');
      
      // Should create notification element
      expect(document.createElement).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('Recovery Strategies', () => {
    test('should get correct recovery strategy for each error type', () => {
      const usageLimitStrategy = (errorHandler as any).getRecoveryStrategy(ManagedApiErrorType.USAGE_LIMIT_EXCEEDED);
      expect(usageLimitStrategy.maxRetries).toBe(0);
      expect(usageLimitStrategy.fallbackToPersonal).toBe(true);
      
      const authStrategy = (errorHandler as any).getRecoveryStrategy(ManagedApiErrorType.AUTHENTICATION_FAILED);
      expect(authStrategy.maxRetries).toBe(1);
      expect(authStrategy.fallbackToPersonal).toBe(false);
      
      const serviceStrategy = (errorHandler as any).getRecoveryStrategy(ManagedApiErrorType.SERVICE_UNAVAILABLE);
      expect(serviceStrategy.maxRetries).toBe(3);
      expect(serviceStrategy.exponentialBackoff).toBe(true);
    });

    test('should execute appropriate recovery strategy', () => {
      // Mock the specific recovery methods
      const handleUsageLimitSpy = jest.spyOn(errorHandler as any, 'handleUsageLimitExceeded');
      const handleSubscriptionSpy = jest.spyOn(errorHandler as any, 'handleSubscriptionRequired');
      const handleAuthSpy = jest.spyOn(errorHandler as any, 'handleAuthenticationFailed');
      
      // Test usage limit error
      errorHandler.handleError(new Error('usage limit exceeded'), 'test');
      expect(handleUsageLimitSpy).toHaveBeenCalled();
      
      // Test subscription error
      errorHandler.handleError({ status: 403, message: 'subscription required' }, 'test');
      expect(handleSubscriptionSpy).toHaveBeenCalled();
      
      // Test auth error
      errorHandler.handleError({ status: 401, message: 'unauthorized' }, 'test');
      expect(handleAuthSpy).toHaveBeenCalled();
    });
  });

  describe('Error Context Tracking', () => {
    test('should track retry attempts per context', () => {
      const context1 = 'context-1';
      const context2 = 'context-2';
      
      errorHandler.incrementRetryAttempt(context1);
      errorHandler.incrementRetryAttempt(context1);
      errorHandler.incrementRetryAttempt(context2);
      
      // Context 1 should have 2 attempts
      expect(errorHandler.shouldRetry(context1, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      
      // Context 2 should have 1 attempt
      expect(errorHandler.shouldRetry(context2, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      
      // Add more attempts to context 1 to exceed limit
      errorHandler.incrementRetryAttempt(context1);
      errorHandler.incrementRetryAttempt(context1);
      
      expect(errorHandler.shouldRetry(context1, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(false);
      expect(errorHandler.shouldRetry(context2, ManagedApiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
    });
  });
});