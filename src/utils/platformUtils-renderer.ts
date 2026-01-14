/**
 * Platform utility functions - Renderer process wrapper
 * This file ensures ES module exports for renderer process imports
 */

/**
 * Get the modifier key name based on the platform
 * Returns "Option" for macOS, "Alt" for other platforms
 */
export function getModifierKeyName(): string {
  // Check if we're in the renderer process (browser context)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.platform) {
    return (window as any).electronAPI.platform === 'darwin' ? 'Option' : 'Alt';
  }
  
  // Check if we're in the main process (Node.js context)
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'darwin' ? 'Option' : 'Alt';
  }
  
  // Fallback to Alt if platform cannot be determined
  return 'Alt';
}

/**
 * Check if the current platform is macOS
 */
export function isMacOS(): boolean {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.platform) {
    return (window as any).electronAPI.platform === 'darwin';
  }
  
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'darwin';
  }
  
  return false;
}