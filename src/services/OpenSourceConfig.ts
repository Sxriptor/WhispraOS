/**
 * Open Source Configuration
 * 
 * This file centralizes all external service configuration for the open-source version.
 * 
 * IMPORTANT: This is the open-source version of Whispra.
 * - No Whispra infrastructure is pre-configured
 * - All external services must be configured by the developer
 * - The app runs in "personal mode" by default (user provides their own API keys)
 * 
 * AUTHENTICATION PROVIDERS:
 * The default implementation uses Supabase, but you can use ANY auth provider:
 * - Supabase (default scaffolding)
 * - Auth0
 * - Firebase Auth
 * - Keycloak
 * - Custom OAuth2/OIDC provider
 * - Chinese providers (WeChat, Alipay, etc.)
 * 
 * To use a different auth provider:
 * 1. Implement your own AuthProvider interface (see src/interfaces/AuthProvider.ts)
 * 2. Replace SupabaseService with your implementation
 * 3. Configure your provider's URLs below
 * 
 * To enable backend features, developers must:
 * 1. Set up their own auth provider
 * 2. Deploy their own managed API backend (optional)
 * 3. Configure environment variables or modify this file
 */

/**
 * Feature flags for open-source deployment
 */
export const OpenSourceFeatures = {
  /**
   * Enable/disable authentication system
   * When disabled, app runs in local-only mode without sign-in
   */
  AUTH_ENABLED: false,

  /**
   * Enable/disable managed mode (backend API proxying)
   * When disabled, only personal mode (user's own API keys) is available
   */
  MANAGED_MODE_ENABLED: false,

  /**
   * Enable/disable remote error reporting
   * When disabled, errors are only logged locally
   */
  ERROR_REPORTING_ENABLED: false,

  /**
   * Enable/disable subscription checking
   * When disabled, all features are available without subscription
   */
  SUBSCRIPTION_CHECKING_ENABLED: false,

  /**
   * Enable/disable usage tracking and limits
   * When disabled, no usage limits are enforced
   */
  USAGE_TRACKING_ENABLED: false,

  /**
   * Enable/disable auto-updates from configured update server
   * When disabled, users must manually update
   */
  AUTO_UPDATE_ENABLED: false,
};

/**
 * Backend service URLs
 * 
 * These are placeholders - developers must configure their own endpoints
 * or leave them empty to disable the features.
 * 
 * PROVIDER-AGNOSTIC: These URLs work with any backend implementation.
 * You are NOT required to use Supabase - any auth/backend provider works.
 */
export const BackendConfig = {
  /**
   * Auth Provider Configuration
   * 
   * DEFAULT: Supabase (scaffolding provided)
   * ALTERNATIVES: Auth0, Firebase, Keycloak, custom OAuth2, WeChat, etc.
   * 
   * If using Supabase:
   *   SUPABASE_URL=https://your-project.supabase.co
   *   SUPABASE_ANON_KEY=your-anon-key
   * 
   * If using another provider:
   *   Leave these empty and implement your own AuthProvider
   *   See src/interfaces/AuthProvider.ts for the interface
   */
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  /**
   * Managed API Backend URL
   * Deploy your own backend to proxy API requests with usage tracking
   * Required for: Managed mode (users don't need their own API keys)
   */
  MANAGED_API_URL: process.env.MANAGED_API_URL || '',
  MANAGED_API_WS_URL: process.env.MANAGED_API_WS_URL || '',

  /**
   * Account/Auth Portal URL
   * Your authentication/account management web portal
   * This can be ANY web application that handles auth callbacks
   */
  ACCOUNT_PORTAL_URL: process.env.ACCOUNT_PORTAL_URL || '',

  /**
   * Error Reporting Endpoint
   * Your error collection service endpoint (Sentry, custom, etc.)
   */
  ERROR_REPORTING_URL: process.env.ERROR_REPORTING_URL || '',

  /**
   * Website URL (for help links, etc.)
   */
  WEBSITE_URL: process.env.WEBSITE_URL || 'https://github.com/user/whispra',
};

/**
 * Check if a backend feature is properly configured
 */
export function isBackendConfigured(): boolean {
  return !!(BackendConfig.SUPABASE_URL && BackendConfig.SUPABASE_ANON_KEY);
}

/**
 * Check if managed mode is available
 */
export function isManagedModeConfigured(): boolean {
  return !!(
    OpenSourceFeatures.MANAGED_MODE_ENABLED &&
    BackendConfig.MANAGED_API_URL &&
    isBackendConfigured()
  );
}

/**
 * Check if auth is available
 */
export function isAuthConfigured(): boolean {
  return !!(
    OpenSourceFeatures.AUTH_ENABLED &&
    BackendConfig.ACCOUNT_PORTAL_URL &&
    isBackendConfigured()
  );
}

/**
 * Check if error reporting is available
 */
export function isErrorReportingConfigured(): boolean {
  return !!(
    OpenSourceFeatures.ERROR_REPORTING_ENABLED &&
    BackendConfig.ERROR_REPORTING_URL
  );
}

/**
 * Get the appropriate URL for a service, with fallback behavior
 */
export function getServiceUrl(service: 'account' | 'api' | 'website' | 'error'): string {
  switch (service) {
    case 'account':
      return BackendConfig.ACCOUNT_PORTAL_URL || BackendConfig.WEBSITE_URL;
    case 'api':
      return BackendConfig.MANAGED_API_URL;
    case 'website':
      return BackendConfig.WEBSITE_URL;
    case 'error':
      return BackendConfig.ERROR_REPORTING_URL;
    default:
      return '';
  }
}

/**
 * Log the current configuration status (for debugging)
 */
export function logConfigurationStatus(): void {
  console.log('=== Open Source Configuration Status ===');
  console.log('Features:');
  console.log(`  Auth Enabled: ${OpenSourceFeatures.AUTH_ENABLED}`);
  console.log(`  Managed Mode Enabled: ${OpenSourceFeatures.MANAGED_MODE_ENABLED}`);
  console.log(`  Error Reporting Enabled: ${OpenSourceFeatures.ERROR_REPORTING_ENABLED}`);
  console.log(`  Subscription Checking: ${OpenSourceFeatures.SUBSCRIPTION_CHECKING_ENABLED}`);
  console.log(`  Usage Tracking: ${OpenSourceFeatures.USAGE_TRACKING_ENABLED}`);
  console.log(`  Auto Update: ${OpenSourceFeatures.AUTO_UPDATE_ENABLED}`);
  console.log('');
  console.log('Backend Configuration:');
  console.log(`  Supabase: ${BackendConfig.SUPABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`  Managed API: ${BackendConfig.MANAGED_API_URL ? 'Configured' : 'Not configured'}`);
  console.log(`  Account Portal: ${BackendConfig.ACCOUNT_PORTAL_URL ? 'Configured' : 'Not configured'}`);
  console.log(`  Error Reporting: ${BackendConfig.ERROR_REPORTING_URL ? 'Configured' : 'Not configured'}`);
  console.log('');
  console.log('Effective Status:');
  console.log(`  Auth Available: ${isAuthConfigured()}`);
  console.log(`  Managed Mode Available: ${isManagedModeConfigured()}`);
  console.log(`  Error Reporting Available: ${isErrorReportingConfigured()}`);
  console.log('==========================================');
}
