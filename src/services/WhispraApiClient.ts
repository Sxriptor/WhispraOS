import { BackendConfig } from './OpenSourceConfig';

/**
 * Client for communicating with the managed API backend
 * 
 * OPEN SOURCE NOTE: This client requires a configured backend.
 * Set BackendConfig.MANAGED_API_URL to enable managed API requests.
 */
export class WhispraApiClient {
  private static instance: WhispraApiClient;
  private baseUrl: string;
  private userToken: string | null = null;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second base delay

  private constructor() {
    this.baseUrl = BackendConfig.MANAGED_API_URL || '';
  }

  public static getInstance(): WhispraApiClient {
    if (!WhispraApiClient.instance) {
      WhispraApiClient.instance = new WhispraApiClient();
    }
    return WhispraApiClient.instance;
  }

  /**
   * Set the user authentication token
   */
  public setUserToken(token: string): void {
    this.userToken = token;
  }

  /**
   * Clear the user authentication token
   */
  public clearUserToken(): void {
    this.userToken = null;
  }

  /**
   * Check if the client is configured
   */
  public isConfigured(): boolean {
    return !!this.baseUrl;
  }

  /**
   * Make OpenAI API request through managed backend
   */
  public async openaiRequest(endpoint: string, method: 'GET' | 'POST', body?: any, headers?: Record<string, string>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Managed API not configured. Please use personal mode with your own API keys.');
    }
    return await this.makeRequest('openai', endpoint, method, body, headers);
  }

  /**
   * Make ElevenLabs API request through managed backend
   */
  public async elevenlabsRequest(endpoint: string, method: 'GET' | 'POST', body?: any, headers?: Record<string, string>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Managed API not configured. Please use personal mode with your own API keys.');
    }
    return await this.makeRequest('elevenlabs', endpoint, method, body, headers);
  }

  /**
   * Get current usage statistics
   */
  public async getCurrentUsage(): Promise<UsageData> {
    const response = await this.makeRequest('usage', '/current', 'GET');
    return {
      totalCost: response.totalCost || 0,
      remainingBalance: response.remainingBalance || 0,
      billingPeriodStart: response.billingPeriodStart || '',
      billingPeriodEnd: response.billingPeriodEnd || '',
      lastUpdated: response.lastUpdated || new Date().toISOString(),
      isLimitExceeded: response.isLimitExceeded || false
    };
  }

  /**
   * Check subscription status for managed API access
   */
  public async checkSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    const response = await this.makeRequest('subscription', '/status', 'GET');
    
    // The response data might be nested under 'data' property
    console.log('🔍 Processing subscription status response:', response);
    
    // Handle both direct response and nested data response
    const subscriptionData = response.data || response;
    
    return {
      hasAccess: subscriptionData.hasAccess || false,
      subscriptionActive: subscriptionData.subscriptionActive || false,
      planName: subscriptionData.planName || '',
      expiresAt: subscriptionData.expiresAt || ''
    };
  }

  /**
   * Make authenticated request to managed API backend
   */
  private async makeRequest(service: string, endpoint: string, method: 'GET' | 'POST', body?: any, headers?: Record<string, string>): Promise<any> {
    if (!this.userToken) {
      throw new Error('No authentication token available for managed API request');
    }

    const url = `${this.baseUrl}/${service}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const requestOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.userToken}`,
            ...headers
          }
        };

        if (body && method === 'POST') {
          requestOptions.body = JSON.stringify(body);
        }

        console.log(`🌐 Whispra API Request (attempt ${attempt}):`, {
          url,
          method,
          hasBody: !!body,
          headers: Object.keys(requestOptions.headers || {})
        });

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          const errorText = await response.text();
          
          // Handle specific error cases
          if (response.status === 401) {
            throw new Error('Authentication failed - invalid or expired token');
          } else if (response.status === 403) {
            throw new Error('Access denied - subscription required or usage limit exceeded');
          } else if (response.status === 429) {
            // Rate limiting - wait and retry
            const waitTime = this.retryDelay * Math.pow(2, attempt - 1);
            console.warn(`⏱️ Rate limited, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (response.status >= 500) {
            // Server error - retry
            const waitTime = this.retryDelay * Math.pow(2, attempt - 1);
            console.warn(`🔄 Server error (${response.status}), retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          throw new Error(`Whispra API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Whispra API Response:`, {
          success: data.success,
          hasData: !!data.data,
          hasUsage: !!data.usage,
          rawResponse: data
        });

        // Handle different response formats
        if (data.success === false) {
          throw new Error(data.error || 'API request failed');
        }

        // If success field is missing but we have data, assume success
        if (data.success === undefined && (data.data || Object.keys(data).length > 0)) {
          console.log('📝 API response missing success field, assuming success based on data presence');
          return { success: true, data, usage: data.usage };
        }

        // If success is explicitly true or undefined with data, return the response
        if (data.success === true || data.success === undefined) {
          return data;
        }

        throw new Error(data.error || 'Unknown API error');

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication or permission errors
        if (lastError.message.includes('Authentication failed') || 
            lastError.message.includes('Access denied')) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Wait before retrying
        const waitTime = this.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Request failed, retrying in ${waitTime}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Test connection to managed API backend
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.checkSubscriptionStatus();
      return true;
    } catch (error) {
      console.error('Managed API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get base URL for the managed API
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set base URL for the managed API (for testing)
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

/**
 * Usage data interface
 */
export interface UsageData {
  totalCost: number;
  remainingBalance: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  lastUpdated: string;
  isLimitExceeded: boolean;
}

/**
 * Subscription status response interface
 */
export interface SubscriptionStatusResponse {
  hasAccess: boolean;
  subscriptionActive: boolean;
  planName: string;
  expiresAt: string;
}