// Soundboard Overlay Renderer Process
console.log('Soundboard overlay renderer starting...');

// Theme detection and application
function detectAndApplyTheme(): void {
  try {
    // Try to get theme from localStorage first (fallback)
    const savedTheme = localStorage.getItem('whispra-theme');
    
    // Try to get theme from main process config
    (window as any).electronAPI?.invoke('config:get', {
      id: Date.now().toString(),
      timestamp: Date.now()
    }).then((response: any) => {
      let theme = 'default';
      
      if (response?.success && response?.payload?.uiSettings?.theme) {
        theme = response.payload.uiSettings.theme;
      } else if (savedTheme) {
        theme = savedTheme;
      }
      
      console.log('Detected theme:', theme);
      document.documentElement.setAttribute('data-theme', theme);
      
      // Save to localStorage for future use
      localStorage.setItem('whispra-theme', theme);
    }).catch((error: any) => {
      console.error('Failed to get theme from config:', error);
      
      // Fallback to localStorage or default
      const fallbackTheme = savedTheme || 'default';
      console.log('Using fallback theme:', fallbackTheme);
      document.documentElement.setAttribute('data-theme', fallbackTheme);
    });
  } catch (error) {
    console.error('Theme detection error:', error);
    
    // Final fallback to default theme
    const fallbackTheme = localStorage.getItem('whispra-theme') || 'default';
    console.log('Using final fallback theme:', fallbackTheme);
    document.documentElement.setAttribute('data-theme', fallbackTheme);
  }
}

// Apply theme on load
detectAndApplyTheme();

// Listen for theme changes from main window
window.addEventListener('storage', (e) => {
  if (e.key === 'whispra-theme' && e.newValue) {
    console.log('Theme changed via storage to:', e.newValue);
    document.documentElement.setAttribute('data-theme', e.newValue);
  }
});

// Also try to detect theme changes via IPC if available
try {
  (window as any).electronAPI?.on?.('theme-changed', (theme: string) => {
    console.log('Theme changed via IPC to:', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('whispra-theme', theme);
  });
} catch (error) {
  console.log('IPC theme listener not available:', error);
}

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen') as HTMLDivElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;
const browserFrame = document.getElementById('browser-frame') as any; // webview element
const urlBar = document.getElementById('url-bar') as HTMLInputElement;
const customUrlInput = document.getElementById('custom-url') as HTMLInputElement;
const audioIndicator = document.getElementById('audio-indicator') as HTMLDivElement;

// Navigation buttons
const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
const forwardBtn = document.getElementById('forward-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const homeBtn = document.getElementById('home-btn') as HTMLButtonElement;

// Header buttons
const audioToggleBtn = document.getElementById('audio-toggle') as HTMLButtonElement;
const minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;

// Quick links
const quickLinks = document.querySelectorAll('.quick-link');

// State
let isAudioRouted = true;
let currentUrl = '';
let webviewReady = false;
let pendingUrl = '';
let dimensionObserver: MutationObserver | null = null;

// Helper function to send messages to main process (same pattern as expanded overlay)
function sendToMain(channel: string, data?: any): void {
  try {
    (window as any).electronAPI?.sendToMain(channel, data);
  } catch (error) {
    console.error('Error sending message to main process:', error);
  }
}

// Initialize the overlay
function initializeOverlay(): void {
  console.log('Initializing soundboard overlay...');
  
  // Setup event listeners
  setupEventListeners();
  
  // Using BrowserView in main; webview setup not needed
  
  // Show welcome screen initially
  showWelcomeScreen();
}

function setupEventListeners(): void {
  // Navigation controls
  backBtn.addEventListener('click', () => {
    (window as any).electronAPI?.navigateBack?.();
  });

  forwardBtn.addEventListener('click', () => {
    (window as any).electronAPI?.navigateForward?.();
  });

  refreshBtn.addEventListener('click', () => {
    (window as any).electronAPI?.refresh?.();
  });

  homeBtn.addEventListener('click', () => {
    showWelcomeScreen();
  });

  // URL bar
  urlBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const url = urlBar.value.trim();
      if (url) {
        navigateToUrl(url);
      }
    }
  });

  // Custom URL input
  customUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const url = customUrlInput.value.trim();
      if (url) {
        navigateToUrl(url);
      }
    }
  });

  // Quick links
  quickLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (link as HTMLElement).dataset.url;
      if (url) {
        navigateToUrl(url);
      }
    });
  });

  // Header controls
  audioToggleBtn.addEventListener('click', () => {
    toggleAudioRouting();
  });

  minimizeBtn.addEventListener('click', () => {
    try {
      console.log('Minimize button clicked');
      sendToMain('soundboard-overlay:minimize', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    } catch (error) {
      console.error('Failed to minimize overlay:', error);
    }
  });

  closeBtn.addEventListener('click', () => {
    try {
      console.log('Close button clicked');
      sendToMain('soundboard-overlay:close', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    } catch (error) {
      console.error('Failed to close overlay:', error);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      console.log('Escape key pressed, closing overlay');
      sendToMain('soundboard-overlay:close', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    }
  });

  // Window resize handling
  const resizeHandle = document.querySelector('.resize-handle') as HTMLElement;
  if (resizeHandle) {
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = window.innerWidth;
      startHeight = window.innerHeight;
      
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
      e.preventDefault();
    });

    function handleResize(e: MouseEvent): void {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newWidth = Math.max(400, startWidth + deltaX);
      const newHeight = Math.max(300, startHeight + deltaY);
      
      (window as any).electronAPI?.updateSettings({
        width: newWidth,
        height: newHeight
      });
    }

    function stopResize(): void {
      isResizing = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    }
  }
}

function setupWebview(): void {
  if (!browserFrame) {
    console.error('browserFrame not found!');
    return;
  }

  console.log('Setting up webview with element:', browserFrame);

  // Set webview properties before adding event listeners
  browserFrame.setAttribute('allowpopups', 'true');
  browserFrame.setAttribute('webpreferences', 'allowRunningInsecureContent=true,webSecurity=false');
  browserFrame.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('Webview attributes set');

  // Webview event listeners
  browserFrame.addEventListener('dom-ready', () => {
    console.log('Webview DOM ready');
    webviewReady = true;
    hideLoadingOverlay();
    // Don't show webview yet - wait for content to actually load
    updateNavigationButtons();
    
    // Load pending URL if there is one
    if (pendingUrl) {
      console.log('Loading pending URL:', pendingUrl);
      loadUrlInWebview(pendingUrl);
      pendingUrl = '';
    }
  });

  // Add a timeout fallback in case dom-ready doesn't fire
  setTimeout(() => {
    if (!webviewReady) {
      console.log('Webview dom-ready timeout, forcing ready state');
      webviewReady = true;
      if (pendingUrl) {
        console.log('Loading pending URL after timeout:', pendingUrl);
        loadUrlInWebview(pendingUrl);
        pendingUrl = '';
      }
    }
  }, 2000);

  // Only show loading overlay for top-level navigations, not every subresource
  browserFrame.addEventListener('did-start-navigation', (event: any) => {
    try {
      const isMain = event?.isMainFrame !== false; // default to true if unknown
      const isInPlace = event?.isInPlace === true; // hash/SPA navigations
      if (isMain && !isInPlace) {
        console.log('Top-level navigation started');
        
        // Preserve dimensions during navigation
        const parentContainer = browserFrame.parentElement;
        if (parentContainer) {
          const containerRect = parentContainer.getBoundingClientRect();
          const containerWidth = containerRect.width - 2;
          const containerHeight = containerRect.height - 2;
          
          console.log('Preserving webview dimensions during navigation:', containerWidth, 'x', containerHeight);
          
          // Lock dimensions before hiding
          browserFrame.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: ${containerWidth}px !important;
            height: ${containerHeight}px !important;
            min-width: ${containerWidth}px !important;
            min-height: ${containerHeight}px !important;
            max-width: ${containerWidth}px !important;
            max-height: ${containerHeight}px !important;
            display: none !important;
            border: none !important;
            background: #0a0a0a !important;
            border-radius: 8px !important;
          `;
          
          browserFrame.setAttribute('width', containerWidth.toString());
          browserFrame.setAttribute('height', containerHeight.toString());
        }
        
        showLoadingOverlay();
      }
    } catch (_) {
      // Fallback behavior
      showLoadingOverlay();
      try { browserFrame.style.display = 'none'; } catch (_) {}
    }
  });

  browserFrame.addEventListener('did-stop-loading', () => {
    console.log('Webview stopped loading');
    hideLoadingOverlay();
    
    // Force dimensions before showing
    const parentContainer = browserFrame.parentElement;
    if (parentContainer) {
      const containerRect = parentContainer.getBoundingClientRect();
      const containerWidth = containerRect.width - 2;
      const containerHeight = containerRect.height - 2;
      
      console.log('Enforcing webview dimensions:', containerWidth, 'x', containerHeight);
      
      // Set explicit dimensions with !important
      browserFrame.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: ${containerWidth}px !important;
        height: ${containerHeight}px !important;
        min-width: ${containerWidth}px !important;
        min-height: ${containerHeight}px !important;
        max-width: ${containerWidth}px !important;
        max-height: ${containerHeight}px !important;
        display: block !important;
        border: none !important;
        background: #0a0a0a !important;
        border-radius: 8px !important;
      `;
      
      browserFrame.setAttribute('width', containerWidth.toString());
      browserFrame.setAttribute('height', containerHeight.toString());
    }
    
    // Only show webview after content has fully loaded and rendered
    setTimeout(() => {
      try { 
        browserFrame.style.display = 'block'; 
        console.log('Webview now visible after load completion');
        
        // Debug: Check webview dimensions
        const rect = browserFrame.getBoundingClientRect();
        console.log('Final webview dimensions after load:', {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        });
      } catch (_) {}
    }, 100);
    
    updateNavigationButtons();
    updateUrlBar();
  });

  // Additional safety: hide overlay when load finishes
  browserFrame.addEventListener('did-finish-load', () => {
    console.log('Webview finished load');
    hideLoadingOverlay();
    // Don't show webview here - let did-stop-loading handle it
    
    // Inject CSS to ensure proper background and remove any dark overlays
    try {
      browserFrame.executeJavaScript(`
        (() => {
          // Force body and html to have proper background
          document.body.style.backgroundColor = '';
          document.documentElement.style.backgroundColor = '';
          
          // Remove any potential dark overlays or background elements
          const darkElements = document.querySelectorAll('[style*="background"][style*="000"], [style*="background"][style*="0a0a0a"], [style*="background"][style*="black"]');
          darkElements.forEach(el => {
            if (el.style.backgroundColor && (el.style.backgroundColor.includes('000') || el.style.backgroundColor.includes('0a0a0a'))) {
              el.style.backgroundColor = '';
            }
          });
          
          // Ensure main content areas are visible
          const mainContent = document.querySelector('main, [role="main"], .main-content, #main-content');
          if (mainContent) {
            mainContent.style.backgroundColor = '';
            mainContent.style.display = 'block';
          }
          
          console.log('CSS injection completed - removed dark backgrounds');
        })();
      `);
    } catch (error) {
      console.warn('Failed to inject CSS:', error);
    }
  });

  browserFrame.addEventListener('did-navigate', () => {
    console.log('Webview navigated');
    updateNavigationButtons();
    updateUrlBar();
  });

  browserFrame.addEventListener('did-navigate-in-page', () => {
    console.log('Webview navigated in page');
    updateNavigationButtons();
    updateUrlBar();
  });

  // Audio detection
  browserFrame.addEventListener('media-started-playing', () => {
    console.log('Media started playing in webview');
    showAudioIndicator();
    if (isAudioRouted) {
      routeAudioToSoundboard();
    }
  });

  browserFrame.addEventListener('media-paused', () => {
    console.log('Media paused in webview');
    hideAudioIndicator();
  });

  // Error handling
  browserFrame.addEventListener('did-fail-load', (event: any) => {
    console.error('Webview failed to load:', event);
    hideLoadingOverlay();
    // Show error message or fallback content
  });

  browserFrame.addEventListener('crashed', () => {
    console.error('Webview crashed');
    hideLoadingOverlay();
    showWelcomeScreen();
  });

  // Set additional webview properties (moved above for better initialization)
  browserFrame.setAttribute('partition', 'persist:soundboard-overlay');
  
  // Start watching for dimension changes
  startDimensionObserver();
}

function loadUrlInWebview(url: string): void {
  if (!browserFrame || !webviewReady) {
    console.log('Webview not ready, storing URL for later:', url);
    pendingUrl = url;
    return;
  }

  try {
    console.log('Loading URL in webview:', url);
    if (browserFrame.loadURL) {
      browserFrame.loadURL(url);
    } else {
      // Fallback: set src attribute directly
      console.log('Using src attribute fallback for webview');
      browserFrame.src = url;
    }
  } catch (error) {
    console.error('Failed to load URL in webview:', error);
    hideLoadingOverlay();
  }
}

function navigateToUrl(url: string): void {
  if (!url) return;

  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it looks like a domain
    if (url.includes('.') && !url.includes(' ')) {
      url = 'https://' + url;
    } else {
      // Treat as search query
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  }

  console.log('Navigating to:', url);
  currentUrl = url;
  
  // Hide welcome screen (BrowserView will be shown by main)
  hideWelcomeScreen();
  
  // Ask main to navigate BrowserView
  (window as any).electronAPI?.navigateToUrl?.(url);

  // Ensure BrowserView is attached when leaving homescreen
  (window as any).electronAPI?.attachView?.();
  
  // Update URL bar
  urlBar.value = url;
}

function showWelcomeScreen(): void {
  welcomeScreen.style.display = 'flex';
  if (browserFrame) browserFrame.style.display = 'none';
  hideLoadingOverlay();
  hideAudioIndicator();
  
  // Detach BrowserView so the homescreen is fully clickable
  (window as any).electronAPI?.detachView?.();

  // Stop dimension observer
  stopDimensionObserver();
  
  // Clear URL bar and state
  urlBar.value = '';
  currentUrl = '';
  webviewReady = false;
  pendingUrl = '';
  
  // Update navigation buttons
  updateNavigationButtons();
}

function hideWelcomeScreen(): void {
  welcomeScreen.style.display = 'none';
}

function showWebview(): void {
  // No-op: BrowserView is managed in main process
}

function showLoadingOverlay(): void {
  loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay(): void {
  loadingOverlay.style.display = 'none';
}

function showAudioIndicator(): void {
  audioIndicator.classList.add('active');
}

function hideAudioIndicator(): void {
  audioIndicator.classList.remove('active');
}

function updateNavigationButtons(canGoBack?: boolean, canGoForward?: boolean): void {
  if (typeof canGoBack === 'boolean') backBtn.disabled = !canGoBack;
  if (typeof canGoForward === 'boolean') forwardBtn.disabled = !canGoForward;
}

function updateUrlBar(url?: string): void {
  if (!url) return;
  if (url && url !== 'about:blank') {
    urlBar.value = url;
    currentUrl = url;
  }
}

function toggleAudioRouting(): void {
  isAudioRouted = !isAudioRouted;

  if (isAudioRouted) {
    audioToggleBtn.textContent = '🔊';
    audioToggleBtn.title = 'Audio Routing: ON';
    routeAudioToSoundboard();
  } else {
    audioToggleBtn.textContent = '🔇';
    audioToggleBtn.title = 'Audio Routing: OFF';
    stopAudioRouting();
  }

  console.log('Audio routing toggled:', isAudioRouted);
}

function startDimensionObserver(): void {
  if (!browserFrame) return;
  
  // Stop existing observer
  if (dimensionObserver) {
    dimensionObserver.disconnect();
  }
  
  dimensionObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'style' || mutation.attributeName === 'width' || mutation.attributeName === 'height')) {
        
        const rect = browserFrame.getBoundingClientRect();
        const parentRect = browserFrame.parentElement?.getBoundingClientRect();
        
        if (parentRect && rect.height < parentRect.height * 0.8) {
          console.log('Dimension observer detected unwanted resize, fixing...');
          enforceDimensions();
        }
      }
    });
  });
  
  dimensionObserver.observe(browserFrame, {
    attributes: true,
    attributeFilter: ['style', 'width', 'height']
  });
}

function stopDimensionObserver(): void {
  if (dimensionObserver) {
    dimensionObserver.disconnect();
    dimensionObserver = null;
  }
}

function enforceDimensions(): void {
  if (!browserFrame || browserFrame.style.display === 'none') return;
  
  const parentContainer = browserFrame.parentElement;
  if (parentContainer) {
    const containerRect = parentContainer.getBoundingClientRect();
    const containerWidth = containerRect.width - 2;
    const containerHeight = containerRect.height - 2;
    
    console.log('Enforcing dimensions:', containerWidth, 'x', containerHeight);
    
    browserFrame.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: ${containerWidth}px !important;
      height: ${containerHeight}px !important;
      min-width: ${containerWidth}px !important;
      min-height: ${containerHeight}px !important;
      max-width: ${containerWidth}px !important;
      max-height: ${containerHeight}px !important;
      display: block !important;
      border: none !important;
      background: #0a0a0a !important;
      border-radius: 8px !important;
    `;
    
    browserFrame.setAttribute('width', containerWidth.toString());
    browserFrame.setAttribute('height', containerHeight.toString());
  }
}

function routeAudioToSoundboard(): void {
  if (!isAudioRouted || !browserFrame) return;

  console.log('🎵 Signaling overlay audio start to main app...');

  // Simply signal that audio has started playing in the overlay
  // The main app will handle creating the appropriate audio routing
  browserFrame.executeJavaScript(`
    (async () => {
      try {
        console.log('🎵 Overlay audio detected, signaling main app');

        // Check if there are any playing media elements
        const mediaElements = document.querySelectorAll('audio, video');
        const hasPlayingMedia = Array.from(mediaElements).some(el => !el.paused && !el.muted);

        if (hasPlayingMedia || mediaElements.length > 0) {
          console.log('🎵 Found playing media, signaling audio start');
          // Signal to main app that overlay audio has started
          if (window.electronAPI?.routeAudio) {
            window.electronAPI.routeAudio();
          }
          return true;
        } else {
          console.log('🎵 No active media found');
          return false;
        }
      } catch (error) {
        console.error('Failed to check for overlay audio:', error);
        return false;
      }
    })();
  `).then((result: any) => {
    console.log('🎵 Overlay audio signal result:', result);
  }).catch((error: any) => {
    console.error('🎵 Failed to signal overlay audio:', error);
  });
}

function stopAudioRouting(): void {
  if (!browserFrame) return;

  console.log('Stopping audio routing in overlay...');

  // Signal to main app that overlay audio has stopped
  if ((window as any).electronAPI?.invoke) {
    (window as any).electronAPI.invoke('soundboard-overlay:stop-audio').catch((error: any) => {
      console.warn('Failed to signal overlay audio stop:', error);
    });
  }

  // Execute JavaScript to stop audio capture and disconnect sources
  browserFrame.executeJavaScript(`
    (async () => {
      try {
        // Stop any audio contexts we might have created
        if (window.audioContextsForSoundboard) {
          window.audioContextsForSoundboard.forEach(ctx => {
            try {
              ctx.close();
            } catch (e) {
              console.warn('Failed to close audio context:', e);
            }
          });
          window.audioContextsForSoundboard = [];
        }

        // Disconnect any media sources we created
        if (window.mediaSourcesForSoundboard) {
          window.mediaSourcesForSoundboard.forEach(source => {
            try {
              source.disconnect();
            } catch (e) {
              console.warn('Failed to disconnect media source:', e);
            }
          });
          window.mediaSourcesForSoundboard = [];
        }

        // Stop any media streams we created
        if (window.mediaStreamsForSoundboard) {
          window.mediaStreamsForSoundboard.forEach(stream => {
            try {
              stream.getTracks().forEach(track => track.stop());
            } catch (e) {
              console.warn('Failed to stop media track:', e);
            }
          });
          window.mediaStreamsForSoundboard = [];
        }

        // Also try to pause any playing media elements to stop them from continuing
        const mediaElements = document.querySelectorAll('audio, video');
        mediaElements.forEach(element => {
          try {
            if (!element.paused) {
              element.pause();
              console.log('Paused media element in overlay:', element.src || element.currentSrc);
            }
          } catch (e) {
            console.warn('Failed to pause media element:', e);
          }
        });

        console.log('Audio routing cleanup completed in overlay');
        return true;
      } catch (error) {
        console.error('Failed to stop audio routing in overlay:', error);
        return false;
      }
    })();
  `).catch((error: any) => {
    console.warn('Failed to execute audio cleanup script in overlay:', error);
  });
}

// Message listener removed - now using direct IPC from webview to main process

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOverlay);
} else {
  initializeOverlay();
}

// Handle electron API events
if ((window as any).electronAPI) {
  (window as any).electronAPI.on('soundboard-overlay:audio-started', () => {
    showAudioIndicator();
  });

  (window as any).electronAPI.on('soundboard-overlay:audio-stopped', () => {
    hideAudioIndicator();
  });

  (window as any).electronAPI.on('soundboard-overlay:navigation-updated', (event: any, data: any) => {
    updateNavigationButtons(data?.canGoBack, data?.canGoForward);
    updateUrlBar(data?.url);
  });
}

console.log('Soundboard overlay renderer initialized');