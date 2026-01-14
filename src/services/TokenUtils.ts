/**
 * Utility functions for working with authentication tokens
 */
export class TokenUtils {
  private static cachedUserId: string | null = null;
  private static cachedEmail: string | null = null;
  private static cachedToken: string | null = null;

  /**
   * Extract user ID from stored token data
   * This handles JWT tokens from account.whispra.xyz
   * Uses caching to avoid repeated JWT parsing
   */
  public static async extractUserId(): Promise<string | null> {
    try {
      const { AuthManager } = await import('./AuthManager');
      const authManager = AuthManager.getInstance();
      const token = await authManager.getToken();
      
      if (!token) {
        // Clear cache if no token
        this.cachedUserId = null;
        this.cachedToken = null;
        console.warn('⚠️ extractUserId: No token available');
        return null;
      }
      
      // Return cached user ID if token hasn't changed
      if (this.cachedUserId && this.cachedToken === token) {
        return this.cachedUserId;
      }
      
      // Try to parse token as JWT to extract user ID
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          // Common JWT fields for user ID
          let userId = payload.sub || payload.user_id || payload.id || payload.userId || payload.uid;
          
          // Additional GitHub-specific field handling
          if (!userId) {
            // GitHub often uses 'id' as a number
            if (payload.id) {
              userId = String(payload.id);
            }
            // GitHub 'login' field as fallback
            else if (payload.login) {
              userId = payload.login;
            }
            // GitHub node_id as another fallback
            else if (payload.node_id) {
              userId = payload.node_id;
            }
          }
          
          // Handle GitHub 'sub' format like 'github|12345678'
          if (userId && typeof userId === 'string' && userId.startsWith('github|')) {
            userId = userId.split('|')[1];
          }
          
          if (userId) {
            // Cache the result
            this.cachedUserId = String(userId);
            this.cachedToken = token;
            console.log('✅ User ID extracted from JWT:', this.cachedUserId);
            return this.cachedUserId;
          } else {
            // Log available fields for debugging (no sensitive data)
            console.warn('⚠️ extractUserId: No user ID field found in JWT. Available fields:', Object.keys(payload));
            // Report to error service for debugging
            const { ErrorReportingService } = await import('./ErrorReportingService');
            const { ErrorCategory, ErrorSeverity } = await import('../types/ErrorTypes');
            ErrorReportingService.getInstance().captureError(new Error('JWT missing user ID field'), {
              category: ErrorCategory.API,
              severity: ErrorSeverity.HIGH,
              component: 'TokenUtils',
              context: {
                action: 'extractUserId',
                availableFields: Object.keys(payload),
                hasEmail: !!payload.email,
                hasSub: !!payload.sub,
                hasId: !!payload.id,
                hasLogin: !!payload.login,
                hasNodeId: !!payload.node_id,
                tokenLength: token.length,
                tokenParts: parts.length
              }
            });
          }
        } else {
          console.warn('⚠️ extractUserId: Token is not a valid JWT (expected 3 parts, got', parts.length, ')');
        }
      } catch (jwtError) {
        console.warn('⚠️ extractUserId: Failed to parse token as JWT:', jwtError instanceof Error ? jwtError.message : String(jwtError));
      }
      
      // If not a JWT, try to extract from token data structure
      try {
        const tokenData = JSON.parse(token);
        let userId = tokenData.userId || tokenData.user_id || tokenData.id || tokenData.uid;
        
        // Additional GitHub-specific field handling for JSON tokens
        if (!userId) {
          if (tokenData.id) {
            userId = String(tokenData.id);
          } else if (tokenData.login) {
            userId = tokenData.login;
          } else if (tokenData.node_id) {
            userId = tokenData.node_id;
          }
        }
        
        if (userId) {
          // Cache the result
          this.cachedUserId = String(userId);
          this.cachedToken = token;
          console.log('✅ User ID extracted from JSON token:', this.cachedUserId);
          return this.cachedUserId;
        }
      } catch (parseError) {
        // Token is not JSON, treating as plain string
      }
      
      // Clear cache on failure
      this.cachedUserId = null;
      this.cachedToken = null;
      return null;
    } catch (error) {
      console.error('❌ Failed to extract user ID from token:', error);
      this.cachedUserId = null;
      this.cachedToken = null;
      return null;
    }
  }

  /**
   * Clear the cached user ID and email (call when token changes)
   */
  public static clearCache(): void {
    this.cachedUserId = null;
    this.cachedEmail = null;
    this.cachedToken = null;
  }

  /**
   * Extract user email from stored token data
   * This handles JWT tokens from account.whispra.xyz
   * Uses caching to avoid repeated JWT parsing
   */
  public static async extractUserEmail(): Promise<string | null> {
    try {
      const { AuthManager } = await import('./AuthManager');
      const authManager = AuthManager.getInstance();
      const token = await authManager.getToken();
      
      if (!token) {
        this.cachedEmail = null;
        return null;
      }
      
      // Return cached email if token hasn't changed
      if (this.cachedEmail && this.cachedToken === token) {
        return this.cachedEmail;
      }
      
      // Try to parse token as JWT to extract email
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          // Common JWT fields for email
          const email = payload.email || payload.user_email || payload.mail;
          if (email) {
            this.cachedEmail = email;
            this.cachedToken = token;
            console.log('✅ User email extracted from token:', email);
            return email;
          } else {
            console.warn('⚠️ No email field found in JWT payload. Available fields:', Object.keys(payload));
          }
        } else {
          console.warn('⚠️ Token does not have 3 parts (JWT format). Parts:', parts.length);
        }
      } catch (jwtError) {
        console.warn('⚠️ Failed to parse token as JWT:', jwtError instanceof Error ? jwtError.message : String(jwtError));
        // Token is not a JWT, try other formats
      }
      
      this.cachedEmail = null;
      return null;
    } catch (error) {
      console.error('❌ Failed to extract user email from token:', error);
      this.cachedEmail = null;
      return null;
    }
  }
  
  /**
   * Get user ID from token or return a default
   */
  public static async getUserIdOrDefault(): Promise<string> {
    const userId = await this.extractUserId();
    return userId || 'unknown_user';
  }
}
