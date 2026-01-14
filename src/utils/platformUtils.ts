/**
 * Platform utility functions
 * Provides OS-aware utilities for cross-platform compatibility
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

/**
 * Get the platform-specific embedded Python executable path
 * Uses the same robust path resolution as pythonPath.ts
 * Windows: python/python.exe
 * macOS: macpython/Python or macpython/bin/python3 (or python/python3/python)
 * Linux: python/python3 or python/python
 * Falls back to system Python if embedded not found
 */
export function getEmbeddedPythonPath(): string {
  const path = require('path');
  const fs = require('fs');
  
  // Import the robust Python path resolution
  const { resolveEmbeddedPythonExecutable } = require('./pythonPath');
  
  if (process.platform === 'win32') {
    // Use the robust resolution first
    const embeddedPython = resolveEmbeddedPythonExecutable();
    if (embeddedPython && fs.existsSync(embeddedPython)) {
      return embeddedPython;
    }
    
    // Fallback to old logic for compatibility
    const pythonDir = path.join(process.cwd(), 'python');
    return path.join(pythonDir, 'python.exe');
  } else if (process.platform === 'darwin') {
    // macOS: check macpython/bin folder first (actual executables), then Python file, then python folder
    const candidates = [
      path.join(process.cwd(), 'macpython', 'bin', 'python3'),
      path.join(process.cwd(), 'macpython', 'bin', 'python3.10'),
      path.join(process.cwd(), 'macpython', 'Python'),
      path.join(process.cwd(), 'python', 'python3'),
      path.join(process.cwd(), 'python', 'python')
    ];
    
    // Check resourcesPath locations for packaged apps
    if (process.resourcesPath) {
      candidates.unshift(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'macpython', 'bin', 'python3'),
        path.join(process.resourcesPath, 'macpython', 'bin', 'python3'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'python3'),
        path.join(process.resourcesPath, 'python', 'python3')
      );
    }
    
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // Fallback to system Python3
    return '/usr/bin/python3';
  } else {
    // Linux: try python3 first, then python
    const candidates = [
      path.join(process.cwd(), 'python', 'python3'),
      path.join(process.cwd(), 'python', 'python')
    ];
    
    // Check resourcesPath locations for packaged apps
    if (process.resourcesPath) {
      candidates.unshift(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'python3'),
        path.join(process.resourcesPath, 'python', 'python3'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'python'),
        path.join(process.resourcesPath, 'python', 'python')
      );
    }
    
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // Fallback to system python3
    return '/usr/bin/python3';
  }
}

