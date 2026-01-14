import { OverlayMode, OverlayState } from './types/ConfigurationTypes';

/**
 * Overlay renderer process logic
 */
class OverlayRenderer {
  private currentMode: OverlayMode = OverlayMode.CLOSED;
  private currentState: OverlayState | null = null;

  constructor() {
    try {
      this.initializeElements();
      this.setupEventListeners();
      this.setupIPCListeners();
      this.setupErrorHandling();
    } catch (error) {
      console.error('Error initializing overlay renderer:', error);
      this.reportError('Overlay renderer initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Initialize DOM elements and references
   */
  private initializeElements(): void {
    // Get DOM elements
    const elements = {
      minimalHud: document.getElementById('minimal-hud'),
      expandedOverlay: document.getElementById('expanded-overlay'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      languageLabels: document.getElementById('language-labels'),
      sourceLang: document.getElementById('source-lang'),
      targetLang: document.getElementById('target-lang'),
      micActivity: document.getElementById('mic-activity'),
      bidirectionalIndicator: document.getElementById('bidirectional-indicator'),
      closeButton: document.getElementById('close-button'),
      translationTab: document.getElementById('translation-tab'),
      bidirectionalTab: document.getElementById('bidirectional-tab'),
      translationContent: document.getElementById('translation-content'),
      bidirectionalContent: document.getElementById('bidirectional-content')
    };

    // Store references for later use
    (window as any).overlayElements = elements;

    // Apply Mac-specific restrictions for bidirectional
    this.applyMacBidirectionalRestrictions(elements);
  }

  /**
   * Apply Mac-specific restrictions to bidirectional feature
   */
  private applyMacBidirectionalRestrictions(elements: any): void {
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (!isMac) return;

    console.log('[Overlay] 🍎 Applying Mac bidirectional restrictions');

    // Grey out bidirectional tab
    if (elements.bidirectionalTab) {
      elements.bidirectionalTab.style.opacity = '0.5';
      elements.bidirectionalTab.style.cursor = 'not-allowed';
      elements.bidirectionalTab.title = 'Coming Soon on macOS';
    }

    // Add coming soon overlay to bidirectional content
    if (elements.bidirectionalContent) {
      elements.bidirectionalContent.style.position = 'relative';
      
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        backdrop-filter: blur(3px);
      `;
      overlay.innerHTML = `
        <div style="text-align: center; color: white; padding: 1.5rem;">
          <div style="font-size: 36px; margin-bottom: 0.75rem;">🚧</div>
          <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 600;">Coming Soon on macOS</h3>
          <p style="margin: 0; opacity: 0.8; font-size: 0.85rem;">
            Bidirectional translation is currently Windows-only.
          </p>
        </div>
      `;
      elements.bidirectionalContent.appendChild(overlay);
    }

    // Disable start button
    const startBtn = document.getElementById('start-bidirectional-button');
    if (startBtn) {
      (startBtn as HTMLButtonElement).disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'not-allowed';
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  private setupEventListeners(): void {
    const elements = (window as any).overlayElements;

    // Close button
    elements.closeButton?.addEventListener('click', () => {
      this.sendToMain('overlay:close');
    });

    // Tab switching
    elements.translationTab?.addEventListener('click', () => {
      this.switchTab('translation');
    });

    elements.bidirectionalTab?.addEventListener('click', () => {
      this.switchTab('bidirectional');
    });

    // Setting controls
    this.setupSettingControls();

    // Load gameoverlay markdown asynchronously to not block initialization
    setTimeout(() => {
      this.loadGameOverlayContent().catch(() => {});
    }, 100);
  }

  /**
   * Setup IPC listeners for communication with main process
   */
  private setupIPCListeners(): void {
    // Listen for mode changes
    (window as any).electronAPI?.onModeChange((mode: OverlayMode) => {
      try {
        this.setMode(mode);
      } catch (error) {
        console.error('Error handling mode change:', error);
      }
    });

    // Listen for state updates
    (window as any).electronAPI?.onStateUpdate((state: OverlayState) => {
      try {
        this.updateState(state);
      } catch (error) {
        console.error('Error handling state update:', error);
      }
    });

    // Listen for mic state updates
    (window as any).electronAPI?.onMicStateUpdate((micState: any) => {
      try {
        this.updateMicrophoneState(micState);
      } catch (error) {
        console.error('Error handling mic state update:', error);
      }
    });

    // Listen for bidirectional state updates
    (window as any).electronAPI?.onBidirectionalStateUpdate((bidiState: any) => {
      try {
        this.updateBidirectionalState(bidiState);
      } catch (error) {
        console.error('Error handling bidirectional state update:', error);
      }
    });

    // Listen for translation results
    (window as any).electronAPI?.onTranslationResult((result: any) => {
      try {
        this.updateTranslationResult(result);
      } catch (error) {
        console.error('Error handling translation result:', error);
      }
    });

    // Listen for ping health checks - pong is sent automatically by preload
    (window as any).electronAPI?.onPing?.(() => {
      // Ping received, pong is automatically sent by preload script
      console.log('Overlay ping received, responding with pong');
    });

    // Listen for cleanup requests
    (window as any).electronAPI?.onCleanupResources?.(() => {
      this.cleanup();
    });
  }

  /**
   * Load gameoverlay.md content and render into translation tab
   */
  private async loadGameOverlayContent(): Promise<void> {
    try {
      const res = await (window as any).electronAPI?.invoke('overlay:get-gameoverlay', { id: Date.now().toString(), timestamp: Date.now(), payload: null });
      const md: string = res?.success ? (res.payload?.markdown || '') : '';
      if (!md) return;
      const container = document.getElementById('translation-content');
      if (!container) return;
      // Simple markdown to HTML minimal conversion (headers and paragraphs)
      const html = md
        .split('\n')
        .map(line => {
          if (/^#\s+/.test(line)) return `<h3>${line.replace(/^#\s+/, '')}</h3>`;
          if (/^##\s+/.test(line)) return `<h4>${line.replace(/^##\s+/, '')}</h4>`;
          if (/^###\s+/.test(line)) return `<h5>${line.replace(/^###\s+/, '')}</h5>`;
          if (/^-\s+/.test(line)) return `<li>${line.replace(/^-\s+/, '')}</li>`;
          if (line.trim() === '') return '';
          return `<p>${line}</p>`;
        })
        .join('');
      // Wrap list items if any
      const finalHtml = html.includes('<li>') ? `<ul>${html}</ul>` : html;
      container.innerHTML = finalHtml + container.innerHTML;
    } catch {}
  }

  /**
   * Setup setting control event listeners
   */
  private setupSettingControls(): void {
    // Target language (HTML uses 'language-select' for target language)
    const targetLanguage = document.getElementById('language-select') as HTMLSelectElement;
    targetLanguage?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendToMain('overlay:setting-change', {
        setting: 'targetLanguage',
        value: target.value
      });
    });

    // Voice selection
    const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
    voiceSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendToMain('overlay:setting-change', {
        setting: 'voiceId',
        value: target.value
      });
    });

    // Toggle switches
    this.setupToggleSwitch('ptt-toggle', 'pttEnabled');
    this.setupToggleSwitch('bidi-toggle', 'bidirectionalEnabled');
    this.setupToggleSwitch('auto-detect-toggle', 'autoDetectLanguage');

    // Bidirectional output device selector
    const bidirectionalOutputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
    bidirectionalOutputSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('🔊 Bidirectional output device changed to:', target.value);
      this.sendToMain('overlay:setting-change', {
        setting: 'bidirectionalOutputDeviceId',
        value: target.value
      });
    });

    // Incoming voice selector
    const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
    incomingVoiceSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendToMain('overlay:setting-change', {
        setting: 'incomingVoiceId',
        value: target.value
      });
    });

    // Screen/window capture source selector
    const captureSourceSelect = document.getElementById('bidi-capture-source') as HTMLSelectElement;
    captureSourceSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendToMain('overlay:setting-change', {
        setting: 'captureSource',
        value: target.value
      });
    });

    // Refresh capture sources button
    const refreshSourcesBtn = document.getElementById('bidi-refresh-sources');
    refreshSourcesBtn?.addEventListener('click', () => {
      this.loadCaptureSources();
    });

    // Start bidirectional button
    const startBidirectionalBtn = document.getElementById('start-bidirectional-button');
    startBidirectionalBtn?.addEventListener('click', () => {
      // Check if on Mac - bidirectional not available
      const isMac = (window as any).electronAPI?.platform === 'darwin';
      if (isMac) {
        console.log('[Overlay] 🍎 Bidirectional mode is not available on macOS');
        return;
      }

      this.sendToMain('bidirectional:start', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    });

    // Overlay hotkey selector
    const overlayHotkey = document.getElementById('overlay-hotkey') as HTMLSelectElement;
    overlayHotkey?.addEventListener('change', (e) => {
      const key = (e.target as HTMLSelectElement).value;
      (window as any).electronAPI?.invoke('config:set', {
        id: Date.now().toString(), timestamp: Date.now(), payload: {
          uiSettings: { overlaySettings: { toggleHotkey: { ctrl: false, alt: false, shift: false, key } } }
        }
      }).then(() => {
        // Update in-memory hotkey immediately
        (window as any).electronAPI?.invoke('hotkeys:update', { overlayHotkey: { ctrl: false, alt: false, shift: false, key } }).catch(() => {});
      }).catch(() => {});
    });

    // Add device change listener to refresh device lists when devices change
    navigator.mediaDevices.addEventListener('devicechange', () => {
      console.log('🔄 Media devices changed, refreshing device lists...');
      this.loadBidirectionalOutputDevices();
    });

    // GPU mode toggle - Check GPU status and setup toggle
    this.setupGPUModeToggle();

    // Load initial data asynchronously to not block initialization
    setTimeout(() => {
      this.loadBidirectionalData();
    }, 200);
  }

  /**
   * Setup GPU mode toggle for screen translation speed
   */
  private async setupGPUModeToggle(): Promise<void> {
    try {
      const gpuModeToggle = document.getElementById('gpu-mode-toggle');
      const gpuModeLabel = document.getElementById('gpu-mode-label');

      if (!gpuModeToggle || !gpuModeLabel) {
        return;
      }

      // Check GPU Paddle status
      const status = await (window as any).electronAPI?.gpuPaddle.checkStatus();
      const hasGPUPaddle = status?.success && status.hasGPUPaddle;

      // Get current GPU mode
      const modeResult = await (window as any).electronAPI?.gpuPaddle.getGpuMode();
      const currentMode = modeResult?.mode || 'normal';

      // Set initial toggle state
      if (currentMode === 'fast' && hasGPUPaddle) {
        gpuModeToggle.classList.add('active');
        gpuModeLabel.textContent = 'Fast (GPU)';
      } else {
        gpuModeToggle.classList.remove('active');
        gpuModeLabel.textContent = hasGPUPaddle ? 'Normal (CPU)' : 'Not Installed';
      }

      // Add click handler for toggle
      gpuModeToggle.addEventListener('click', async () => {
        // Re-check status in case it changed
        const currentStatus = await (window as any).electronAPI?.gpuPaddle.checkStatus();
        const isInstalled = currentStatus?.success && currentStatus.hasGPUPaddle;

        if (!isInstalled) {
          // GPU Paddle not installed - open installation overlay
          console.log('⚡ GPU Paddle not installed, opening installation overlay');
          try {
            await (window as any).electronAPI?.gpuPaddle.showOverlay();
          } catch (error) {
            console.error('Failed to show GPU installation overlay:', error);
          }
          return;
        }

        // GPU Paddle is installed - toggle mode
        const isActive = gpuModeToggle.classList.contains('active');
        const newMode = isActive ? 'normal' : 'fast';

        try {
          // Update mode
          await (window as any).electronAPI?.gpuPaddle.setGpuMode(newMode);

          // Toggle UI
          if (newMode === 'fast') {
            gpuModeToggle.classList.add('active');
            gpuModeLabel.textContent = 'Fast (GPU)';
          } else {
            gpuModeToggle.classList.remove('active');
            gpuModeLabel.textContent = 'Normal (CPU)';
          }

          console.log(`⚡ GPU mode changed to: ${newMode}`);
        } catch (error) {
          console.error('Failed to change GPU mode:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup GPU mode toggle:', error);
    }
  }

  /**
   * L)
   */
  private async loadBidirectionalData(): Promise<void> {
    try {
      // Load output devices
      await this.loadBidirectionalOutputDevices();
      
      // Load voices for incoming voice selection
      await this.loadIncomingVoices();
      
      // Load capture sources
      await this.loadCaptureSources();
    } catch (error) {
      console.error('Error loading bidirectional data:', error);
    }
  }

  /**
   * Load bidirectional output devices
   */
  private async loadBidirectionalOutputDevices(): Promise<void> {
    try {
      console.log('🔊 Loading bidirectional output devices for overlay...');

      const response = await (window as any).electronAPI?.invoke('audio:get-output-devices', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      if (!outputSelect || !response?.success) {
        console.warn('🔊 Output select element not found or response failed');
        return;
      }

      outputSelect.innerHTML = '<option value="">Select output device...</option>';

      if (response.payload?.devices) {
        console.log('🔊 Found', response.payload.devices.length, 'output devices via IPC');
        response.payload.devices.forEach((device: any) => {
          const option = document.createElement('option');
          option.value = device.deviceId;
          option.textContent = device.label || device.deviceId;
          outputSelect.appendChild(option);
          console.log('🔊 Added output device option:', device.label || device.deviceId);
        });
      }

      // Set default value if available
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.uiSettings?.bidirectionalOutputDeviceId) {
        console.log('🔊 Setting bidirectional output device from config:', configResponse.payload.uiSettings.bidirectionalOutputDeviceId);
        outputSelect.value = configResponse.payload.uiSettings.bidirectionalOutputDeviceId;

        // If the configured device doesn't exist in the list, clear the selection
        if (outputSelect.value !== configResponse.payload.uiSettings.bidirectionalOutputDeviceId) {
          console.warn('🔊 Configured output device not found in device list, clearing selection');
          outputSelect.value = '';
        }
      } else {
        console.log('🔊 No bidirectional output device configured in config');
      }

      console.log('🔊 Bidirectional output device loading completed');
    } catch (error) {
      console.error('🔊 Error loading bidirectional output devices:', error);
      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      if (outputSelect) {
        outputSelect.innerHTML = '<option value="">Output device access needed</option>';
      }
    }
  }

  /**
   * Load incoming voices
   */
  private async loadIncomingVoices(): Promise<void> {
    try {
      const response = await (window as any).electronAPI?.invoke('voices:get-available', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      const voiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
      if (!voiceSelect || !response?.success) return;

      voiceSelect.innerHTML = '<option value="">Select incoming voice...</option>';
      
      if (response.payload?.voices) {
        response.payload.voices.forEach((voice: any) => {
          const option = document.createElement('option');
          option.value = voice.voice_id;
          option.textContent = voice.name || voice.voice_id;
          voiceSelect.appendChild(option);
        });
      }

      // Set default value if available
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.incomingVoiceId) {
        voiceSelect.value = configResponse.payload.incomingVoiceId;
      }
    } catch (error) {
      console.error('Error loading incoming voices:', error);
    }
  }

  /**
   * Load capture sources (screens and windows with PIDs)
   */
  private async loadCaptureSources(): Promise<void> {
    try {
      const response = await (window as any).electronAPI?.invoke('get-desktop-sources', ['screen', 'window']);

      const captureSelect = document.getElementById('bidi-capture-source') as HTMLSelectElement;
      if (!captureSelect) return;

      captureSelect.innerHTML = '<option value="">Select screen or window...</option>';
      
      if (response && Array.isArray(response)) {
        response.forEach((source: any) => {
          const option = document.createElement('option');
          option.value = source.id;
          
          // Format display text to show PIDs for windows
          let displayText = source.name;
          if (source.id.startsWith('window:')) {
            const parts = source.id.split(':');
            const pid = parts.length >= 3 ? parts[2] : 'Unknown';
            displayText = `${source.name} (PID: ${pid})`;
          } else if (source.id.startsWith('screen:')) {
            displayText = `${source.name} (Screen)`;
          }
          
          option.textContent = displayText;
          captureSelect.appendChild(option);
        });
      }

      // Set default value if available
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.captureSource) {
        captureSelect.value = configResponse.payload.captureSource;
      }
    } catch (error) {
      console.error('Error loading capture sources:', error);
    }
  }

  /**
   * Setup toggle switch functionality
   */
  private setupToggleSwitch(elementId: string, settingName: string): void {
    const toggle = document.getElementById(elementId);
    toggle?.addEventListener('click', () => {
      const isActive = toggle.classList.contains('active');
      toggle.classList.toggle('active');
      
      this.sendToMain('overlay:setting-change', {
        setting: settingName,
        value: !isActive
      });
    });
  }

  /**
   * Set overlay mode and update UI
   */
  private setMode(mode: OverlayMode): void {
    this.currentMode = mode;
    const elements = (window as any).overlayElements;

    switch (mode) {
      case OverlayMode.MINIMAL:
        elements.minimalHud?.classList.remove('hidden');
        elements.expandedOverlay?.classList.add('hidden');
        (elements.expandedOverlay as HTMLElement | null)?.style.setProperty('display', 'none');
        break;

      case OverlayMode.EXPANDED:
        elements.minimalHud?.classList.add('hidden');
        elements.expandedOverlay?.classList.remove('hidden');
        (elements.expandedOverlay as HTMLElement | null)?.style.setProperty('display', 'block');
        break;

      case OverlayMode.CLOSED:
      default:
        elements.minimalHud?.classList.add('hidden');
        elements.expandedOverlay?.classList.add('hidden');
        (elements.expandedOverlay as HTMLElement | null)?.style.setProperty('display', 'none');
        break;
    }
  }

  /**
   * Update overlay state
   */
  private updateState(state: OverlayState): void {
    this.currentState = state;
    this.updateUI();
    this.syncSettingsWithState();
  }

  /**
   * Sync UI settings with current state
   */
  private syncSettingsWithState(): void {
    if (!this.currentState) return;

    // Update expanded overlay settings to match current state
    const targetLanguage = document.getElementById('language-select') as HTMLSelectElement;
    const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
    const bidiToggle = document.getElementById('bidi-toggle');
    const overlayHotkey = document.getElementById('overlay-hotkey') as HTMLSelectElement;

    // Update language selections (these would come from main app config)
    // For now, we'll just ensure the UI reflects the current translation result
    if (this.currentState.translationResult) {
      const { sourceLanguage: srcLang, targetLanguage: tgtLang } = this.currentState.translationResult;
      // Note: sourceLanguage is auto-detected, only update targetLanguage
      if (targetLanguage && targetLanguage.value !== tgtLang) {
        targetLanguage.value = tgtLang;
      }
    }

    // Update bidirectional toggle
    if (bidiToggle) {
      if (this.currentState.bidirectionalState.isEnabled) {
        bidiToggle.classList.add('active');
      } else {
        bidiToggle.classList.remove('active');
      }
    }

    // Populate overlay hotkey from config via IPC (once)
    if (overlayHotkey) {
      (window as any).electronAPI?.invoke('overlay:get-config', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
        .then((res: any) => {
          const key = res?.success ? (res.payload?.toggleHotkey?.key || 'F11') : 'F11';
          overlayHotkey.value = key;
        }).catch(() => {});
    }
  }

  /**
   * Update microphone state
   */
  private updateMicrophoneState(micState: any): void {
    if (!this.currentState) return;
    
    this.currentState.microphoneState = micState;
    this.updateStatusIndicator();
  }

  /**
   * Update bidirectional state
   */
  private updateBidirectionalState(bidiState: any): void {
    if (!this.currentState) return;
    
    this.currentState.bidirectionalState = bidiState;
    this.updateStatusIndicator();
  }

  /**
   * Update translation result
   */
  private updateTranslationResult(result: any): void {
    if (!this.currentState) return;
    
    this.currentState.translationResult = result;
    this.updateLanguageLabels();
  }

  /**
   * Update status indicator based on current state
   */
  private updateStatusIndicator(): void {
    const elements = (window as any).overlayElements;
    const indicator = elements.statusIndicator;
    const statusText = elements.statusText;
    const micActivity = elements.micActivity;
    const bidirectionalIndicator = elements.bidirectionalIndicator;

    if (!this.currentState || !indicator || !statusText) return;

    const { microphoneState, bidirectionalState, connectionStatus } = this.currentState;

    // Determine status based on current activity
    let status = 'idle';
    let text = 'Ready';

    if (connectionStatus === 'disconnected') {
      status = 'disconnected';
      text = 'Disconnected';
    } else if (microphoneState.isRecording) {
      status = 'recording';
      text = 'Recording';
    } else if (bidirectionalState.isProcessingAudio) {
      status = 'translating';
      text = 'Translating';
    } else if (microphoneState.isActive || bidirectionalState.isEnabled) {
      status = 'idle';
      text = 'Active';
    }

    // Update indicator class and text
    indicator.className = `status-indicator ${status}`;
    statusText.textContent = text;

    // Update microphone activity indicator
    if (micActivity) {
      if (microphoneState.isActive && microphoneState.level > 10) {
        micActivity.classList.add('active');
        // Scale the glow based on microphone level
        const glowIntensity = Math.min(1, microphoneState.level / 100);
        micActivity.style.boxShadow = `0 0 ${8 * glowIntensity}px rgba(16, 185, 129, ${0.6 * glowIntensity})`;
      } else {
        micActivity.classList.remove('active');
        micActivity.style.boxShadow = '';
      }
    }

    // Update bidirectional indicator
    if (bidirectionalIndicator) {
      if (bidirectionalState.isEnabled) {
        bidirectionalIndicator.classList.add('active');
      } else {
        bidirectionalIndicator.classList.remove('active');
      }
    }

    // Add visual feedback for status indicator based on microphone activity
    if (microphoneState.isActive && microphoneState.level > 0) {
      const opacity = Math.min(1, 0.5 + (microphoneState.level / 100) * 0.5);
      indicator.style.opacity = opacity.toString();
    } else {
      indicator.style.opacity = '1';
    }
  }

  /**
   * Update language labels
   */
  private updateLanguageLabels(): void {
    const elements = (window as any).overlayElements;
    const languageLabels = elements.languageLabels;
    const sourceLang = elements.sourceLang;
    const targetLang = elements.targetLang;

    if (!this.currentState?.translationResult) {
      languageLabels?.classList.add('hidden');
      return;
    }

    const { sourceLanguage, targetLanguage } = this.currentState.translationResult;
    
    // Map language codes to readable names
    const languageNames: Record<string, string> = {
      'en': 'EN',
      'ru': 'RU',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT',
      'ja': 'JP',
      'ko': 'KR',
      'zh': 'CN',
      'ar': 'AR',
      'hi': 'HI',
      'tr': 'TR',
      'pl': 'PL',
      'nl': 'NL'
    };
    
    const sourceDisplay = languageNames[sourceLanguage] || sourceLanguage.toUpperCase();
    const targetDisplay = languageNames[targetLanguage] || targetLanguage.toUpperCase();
    
    if (sourceLang) sourceLang.textContent = sourceDisplay;
    if (targetLang) targetLang.textContent = targetDisplay;
    
    languageLabels?.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      languageLabels?.classList.add('hidden');
    }, 5000);
  }

  /**
   * Switch between tabs in expanded mode
   */
  private switchTab(tab: 'translation' | 'bidirectional'): void {
    const elements = (window as any).overlayElements;

    // Update tab buttons
    elements.translationTab?.classList.toggle('active', tab === 'translation');
    elements.bidirectionalTab?.classList.toggle('active', tab === 'bidirectional');

    // Update tab content
    elements.translationContent?.classList.toggle('hidden', tab !== 'translation');
    elements.bidirectionalContent?.classList.toggle('hidden', tab !== 'bidirectional');
  }

  /**
   * Update UI based on current state
   */
  private updateUI(): void {
    this.updateStatusIndicator();
    this.updateLanguageLabels();
    // Additional UI updates can be added here
  }

  /**
   * Send message to main process
   */
  private sendToMain(channel: string, data?: any): void {
    try {
      (window as any).electronAPI?.sendToMain(channel, data);
    } catch (error) {
      console.error('Error sending message to main process:', error);
    }
  }

  /**
   * Cleanup renderer resources
   */
  private cleanup(): void {
    try {
      // Clear any timers or intervals
      // Reset state
      this.currentMode = OverlayMode.CLOSED;
      this.currentState = null;
      console.log('Overlay renderer cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Recover from renderer errors
   */
  private recoverFromError(): void {
    try {
      console.log('Attempting overlay renderer recovery...');
      // Reinitialize elements
      this.initializeElements();
      // Reset mode to closed
      this.setMode(OverlayMode.CLOSED);
      console.log('Overlay renderer recovery completed');
    } catch (error) {
      console.error('Error during renderer recovery:', error);
      this.reportError('Overlay renderer recovery failed: ' + (error as Error).message);
      // If recovery fails, reload the entire renderer
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {}
      }, 1000);
    }
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Uncaught error in overlay:', event.error);
      this.reportError('Uncaught error: ' + event.error?.message || 'Unknown error');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection in overlay:', event.reason);
      this.reportError('Unhandled promise rejection: ' + event.reason?.message || 'Unknown error');
    });
  }

  /**
   * Report error to main process
   */
  private reportError(errorMessage: string): void {
    try {
      (window as any).electronAPI?.reportError?.(errorMessage);
    } catch (error) {
      console.error('Failed to report error to main process:', error);
    }
  }
}

// Initialize overlay renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OverlayRenderer();
});

// Export for potential external use
(window as any).OverlayRenderer = OverlayRenderer;