/**
 * Overlay renderer process logic
 */
class OverlayRenderer {
  constructor() {
    this.currentMode = 'closed';
    this.currentState = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupIPCListeners();
    
    // Removed debug state cycling to prevent unintended UI state flips
  }

  /**
   * Initialize DOM elements and references
   */
  initializeElements() {
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
    window.overlayElements = elements;
  }

  // Debug state cycling removed

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    const elements = window.overlayElements;

    // Close button
    if (elements.closeButton) {
      elements.closeButton.addEventListener('click', () => {
        this.sendToMain('overlay:close');
      });
    }

    // Tab switching
    if (elements.translationTab) {
      elements.translationTab.addEventListener('click', () => {
        this.switchTab('translation');
      });
    }

    if (elements.bidirectionalTab) {
      elements.bidirectionalTab.addEventListener('click', () => {
        this.switchTab('bidirectional');
      });
    }

    const settingsTabBtn = document.getElementById('overlay-settings-tab');
    if (settingsTabBtn) {
      settingsTabBtn.addEventListener('click', () => {
        this.switchTab('settings');
      });
    }

    // Setting controls
    this.setupSettingControls();
  }

  /**
   * Setup IPC listeners for communication with main process
   */
  setupIPCListeners() {
    if (!window.electronAPI) return;

    // Listen for mode changes
    window.electronAPI.onModeChange((mode) => {
      this.setMode(mode);
    });

    // Listen for state updates
    window.electronAPI.onStateUpdate((state) => {
      this.updateState(state);
    });

    // Listen for mic state updates
    window.electronAPI.onMicStateUpdate((micState) => {
      this.updateMicrophoneState(micState);
    });

    // Listen for bidirectional state updates
    window.electronAPI.onBidirectionalStateUpdate((bidiState) => {
      this.updateBidirectionalState(bidiState);
    });

    // Listen for translation results
    window.electronAPI.onTranslationResult((result) => {
      this.updateTranslationResult(result);
    });

    // Listen for cleanup requests
    if (window.electronAPI.onCleanupResources) {
      window.electronAPI.onCleanupResources(() => {
        this.cleanupResources();
      });
    }

    // Listen for live config updates to mirror main app
    if (window.electronAPI.onConfigUpdated) {
      window.electronAPI.onConfigUpdated((cfg) => {
        try {
          const micSel = document.getElementById('microphone-select') || document.getElementById('translation-input-device');
          if (micSel && cfg.selectedMicrophone) {
            micSel.value = cfg.selectedMicrophone;
          }
          const langSel = document.getElementById('language-select') || document.getElementById('target-language');
          if (langSel && cfg.targetLanguage) {
            langSel.value = cfg.targetLanguage;
          }
          const voiceSel = document.getElementById('voice-select');
          if (voiceSel && cfg.voiceId) {
            // If the voice option is present, set it; otherwise leave for next populate
            const opt = Array.from(voiceSel.options).find(o => o.value === cfg.voiceId);
            if (opt) voiceSel.value = cfg.voiceId;
          }
          
          // Bidirectional settings sync
          const bidiOutputSel = document.getElementById('bidirectional-output-select');
          if (bidiOutputSel && cfg.uiSettings && cfg.uiSettings.bidirectionalOutputDevice) {
            const opt = Array.from(bidiOutputSel.options).find(o => o.value === cfg.uiSettings.bidirectionalOutputDevice);
            if (opt) bidiOutputSel.value = cfg.uiSettings.bidirectionalOutputDevice;
          }
          
          const incomingVoiceSel = document.getElementById('incoming-voice-select');
          if (incomingVoiceSel && cfg.uiSettings && cfg.uiSettings.incomingVoiceId) {
            const opt = Array.from(incomingVoiceSel.options).find(o => o.value === cfg.uiSettings.incomingVoiceId);
            if (opt) incomingVoiceSel.value = cfg.uiSettings.incomingVoiceId;
          }
          
          const captureSourceSel = document.getElementById('bidi-capture-source');
          if (captureSourceSel && cfg.uiSettings && cfg.uiSettings.captureSource) {
            const opt = Array.from(captureSourceSel.options).find(o => o.value === cfg.uiSettings.captureSource);
            if (opt) captureSourceSel.value = cfg.uiSettings.captureSource;
          }
          
          const ptt = (cfg.uiSettings && cfg.uiSettings.pttHotkey) || null;
          if (ptt) {
            const pttSel = document.getElementById('ptt-hotkey-select');
            const pttCtrl = document.getElementById('ptt-ctrl');
            const pttAlt = document.getElementById('ptt-alt');
            const pttShift = document.getElementById('ptt-shift');
            if (pttSel) pttSel.value = ptt.key || 'Space';
            if (pttCtrl) pttCtrl.checked = !!ptt.ctrl;
            if (pttAlt) pttAlt.checked = !!ptt.alt;
            if (pttShift) pttShift.checked = !!ptt.shift;
          }
          const bidi = (cfg.uiSettings && cfg.uiSettings.bidirectionalHotkey) || null;
          if (bidi) {
            const bidiSel = document.getElementById('bidi-hotkey-select');
            const bidiCtrl = document.getElementById('bidi-ctrl');
            const bidiAlt = document.getElementById('bidi-alt');
            const bidiShift = document.getElementById('bidi-shift');
            const bidiCurrentKeybind = document.getElementById('bidi-current-keybind');
            if (bidiSel) bidiSel.value = bidi.key || 'B';
            if (bidiCtrl) bidiCtrl.checked = !!bidi.ctrl;
            if (bidiAlt) bidiAlt.checked = !!bidi.alt;
            if (bidiShift) bidiShift.checked = !!bidi.shift;
            if (bidiCurrentKeybind) bidiCurrentKeybind.textContent = bidi.key || 'B';
          }
        } catch {}
      });
    }

    // Listen for translation state changes to update button states
    if (window.electronAPI.onTranslationStateChanged) {
      window.electronAPI.onTranslationStateChanged((state) => {
        try {
          const startButton = document.getElementById('start-button');
          if (startButton) {
            if (state.isActive) {
              startButton.textContent = '⏹️ Stop Translation';
              startButton.style.background = '#dc3545';
            } else {
              startButton.textContent = '▶️ Start Translation';
              startButton.style.background = '#28a745';
            }
          }
        } catch {}
      });
    }
  }

  /**
   * Setup setting control event listeners
   */
  setupSettingControls() {
    // Source language
    const sourceLanguage = document.getElementById('source-language');
    if (sourceLanguage) {
      sourceLanguage.addEventListener('change', (e) => {
        this.sendToMain('overlay:setting-change', {
          setting: 'sourceLanguage',
          value: e.target.value
        });
      });
    }

    // Initialize from main config (target language/voice/mic and hotkeys)
    if (window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
        .then((res) => {
          if (!res || !res.success || !res.payload) return;
          const cfg = res.payload;
          const tgt = document.getElementById('language-select') || document.getElementById('target-language');
          const vsel = document.getElementById('voice-select');
          if (tgt) tgt.value = (cfg.targetLanguage || 'en');
          if (vsel) vsel.setAttribute('data-desired-voice', cfg.voiceId || '');
          const micSel = document.getElementById('microphone-select');
          if (micSel && cfg.selectedMicrophone) micSel.setAttribute('data-desired-mic', cfg.selectedMicrophone);
          // Populate hotkeys
          const ptt = (cfg.uiSettings && cfg.uiSettings.pttHotkey) || { ctrl:false, alt:false, shift:false, key:'Space' };
          const bidi = (cfg.uiSettings && cfg.uiSettings.bidirectionalHotkey) || { ctrl:false, alt:true, shift:false, key:'B' };
          const pttSel = document.getElementById('ptt-hotkey-select');
          const pttCtrl = document.getElementById('ptt-ctrl');
          const pttAlt = document.getElementById('ptt-alt');
          const pttShift = document.getElementById('ptt-shift');
          if (pttSel) pttSel.value = ptt.key || 'Space';
          if (pttCtrl) pttCtrl.checked = !!ptt.ctrl;
          if (pttAlt) pttAlt.checked = !!ptt.alt;
          if (pttShift) pttShift.checked = !!ptt.shift;
          const bidiSel = document.getElementById('bidi-hotkey-select');
          const bidiCtrl = document.getElementById('bidi-ctrl');
          const bidiAlt = document.getElementById('bidi-alt');
          const bidiShift = document.getElementById('bidi-shift');
          const bidiCurrentKeybind = document.getElementById('bidi-current-keybind');
          if (bidiSel) bidiSel.value = bidi.key || 'B';
          if (bidiCtrl) bidiCtrl.checked = !!bidi.ctrl;
          if (bidiAlt) bidiAlt.checked = !!bidi.alt;
          if (bidiShift) bidiShift.checked = !!bidi.shift;
          if (bidiCurrentKeybind) bidiCurrentKeybind.textContent = bidi.key || 'B';
        }).catch(() => {});
    }

    // Translation input microphone (mirror main app)
    const translationInput = document.getElementById('microphone-select') || document.getElementById('translation-input-device');
    if (translationInput) {
      let currentSelectedMic = '';
      
      const loadMicrophones = async () => {
        try {
          console.log('Loading microphones for overlay...');
          
          // Request microphone permission first (same as main app)
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop the stream immediately, we just needed permission
          stream.getTracks().forEach(track => track.stop());
          
          // Get available devices directly from Web API (same as main app)
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          
          console.log('Found audio input devices:', audioInputs);
          
          // Clear and populate dropdown (same as main app)
          translationInput.innerHTML = '<option value="">Select microphone...</option>';
          
          audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${index + 1}`;
            
            if (device.deviceId === 'default') {
              option.textContent += ' (Default)';
            }
            
            translationInput.appendChild(option);
          });
          
          // Set selected value from current stored value
          if (currentSelectedMic) {
            translationInput.value = currentSelectedMic;
            console.log('Set microphone to stored:', currentSelectedMic);
          }
          
          console.log(`Found ${audioInputs.length} audio input devices in overlay`);
          
        } catch (error) {
          console.error('Error loading microphones in overlay:', error);
          translationInput.innerHTML = '<option value="">Microphone access denied - please allow microphone access</option>';
        }
      };
      
      // Get initial config to set the selected microphone
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            if (res && res.success && res.payload && res.payload.selectedMicrophone) {
              currentSelectedMic = res.payload.selectedMicrophone;
              console.log('Got initial selected microphone:', currentSelectedMic);
            }
            // Load devices after we have the selected microphone
            loadMicrophones();
          }).catch((error) => {
            console.error('Error getting initial config:', error);
            // Load devices even if config fails
            loadMicrophones();
          });
      } else {
        // Load devices even without electronAPI
        loadMicrophones();
      }
      
      translationInput.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Microphone changed to:', val);
        currentSelectedMic = val;
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { selectedMicrophone: val }
          }).then(() => {
            console.log('Updated main app microphone selection:', val);
          }).catch((error) => {
            console.error('Error updating main app microphone:', error);
          });
        }
      });
    }

    // Output toggle button (mirror main app)
    const outputToggleButton = document.getElementById('output-toggle-button');
    if (outputToggleButton) {
      let outputToVirtualDevice = true; // Default to virtual device
      
      const updateOutputToggleButton = () => {
        outputToggleButton.textContent = outputToVirtualDevice
          ? '🔀 Output: Virtual Device'
          : '🔀 Output: App/Headphones';
      };
      
      // Get initial output preference from config
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            if (res && res.success && res.payload?.uiSettings?.outputToVirtualDevice !== undefined) {
              outputToVirtualDevice = !!res.payload.uiSettings.outputToVirtualDevice;
              updateOutputToggleButton();
              console.log('Loaded output preference:', outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones');
            }
          }).catch((error) => {
            console.error('Error loading output preference:', error);
          });
      }
      
      outputToggleButton.addEventListener('click', () => {
        outputToVirtualDevice = !outputToVirtualDevice;
        updateOutputToggleButton();
        console.log('Output toggle changed to:', outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones');
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { outputToVirtualDevice } }
          }).then(() => {
            console.log('Updated main app output preference:', outputToVirtualDevice);
          }).catch((error) => {
            console.error('Error updating main app output preference:', error);
          });
        }
      });
    }

    // Target language (mirror main app)
    const targetLanguage = document.getElementById('language-select') || document.getElementById('target-language');
    if (targetLanguage) {
      // Populate with full language list from main app
      const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'es', name: 'Spanish', flag: '🇪🇸' },
        { code: 'fr', name: 'French', flag: '🇫🇷' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
        { code: 'it', name: 'Italian', flag: '🇮🇹' },
        { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
        { code: 'ru', name: 'Russian', flag: '🇷🇺' },
        { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
        { code: 'ko', name: 'Korean', flag: '🇰🇷' },
        { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
        { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
        { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        { code: 'th', name: 'Thai', flag: '🇹🇭' },
        { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
        { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
        { code: 'pl', name: 'Polish', flag: '🇵🇱' },
        { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
        { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
        { code: 'da', name: 'Danish', flag: '🇩🇰' },
        { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
      ];

      // Clear existing options
      targetLanguage.innerHTML = '';

      // Add language options
      languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language.code;
        option.textContent = `${language.flag} ${language.name}`;
        targetLanguage.appendChild(option);
      });

      // Set from config if available
      if (this.currentState && this.currentState.targetLanguage) {
        targetLanguage.value = this.currentState.targetLanguage;
      }

      targetLanguage.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Target language changed to:', val);
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { targetLanguage: val }
          }).then(() => {
            console.log('Updated main app target language:', val);
          }).catch((error) => {
            console.error('Error updating main app target language:', error);
          });
        }
      });
    }

    // Voice selection
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
      // Populate voices
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('voice:get-voices', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            const voices = res && res.success ? (res.payload || []) : [];
            const desired = voiceSelect.getAttribute('data-desired-voice') || '';
            voiceSelect.innerHTML = '<option value="">Select Voice</option>' + voices.map(v => `<option value="${v.id}">${v.name || v.id}</option>`).join('');
            if (desired) voiceSelect.value = desired;
          }).catch(() => {});
      }
      voiceSelect.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Voice changed to:', val);
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { voiceId: val }
          }).then(() => {
            console.log('Updated main app voice selection:', val);
          }).catch((error) => {
            console.error('Error updating main app voice:', error);
          });
        }
      });
    }

    // Toggle switches
    this.setupToggleSwitch('ptt-toggle', 'pttEnabled');
    this.setupToggleSwitch('bidi-toggle', 'bidirectionalEnabled');
    this.setupToggleSwitch('auto-detect-toggle', 'autoDetectLanguage');

    // Device selectors
    const inputDevice = document.getElementById('input-device');
    if (inputDevice) {
      let currentSelectedBidiInput = '';
      
      const loadBidiInputDevices = async () => {
        try {
          console.log('Loading bidirectional input devices for overlay...');
          
          // Use same approach as main app and translation microphone
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          
          console.log('Found bidirectional input devices:', audioInputs);
          
          // Clear and populate dropdown
          inputDevice.innerHTML = '<option value="">Select input device...</option>';
          
          audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Input Device ${index + 1}`;
            
            if (device.deviceId === 'default') {
              option.textContent += ' (Default)';
            }
            
            inputDevice.appendChild(option);
          });
          
          // Set from current stored value
          if (currentSelectedBidiInput) {
            inputDevice.value = currentSelectedBidiInput;
            console.log('Set bidirectional input to stored:', currentSelectedBidiInput);
          }
          
        } catch (error) {
          console.error('Error loading bidirectional input devices:', error);
          inputDevice.innerHTML = '<option value="">Microphone access denied</option>';
        }
      };
      
      // Get initial config for bidirectional input
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            if (res && res.success && res.payload) {
              // Look for bidirectional input device setting
              currentSelectedBidiInput = res.payload.bidirectionalInputDevice || res.payload.selectedMicrophone || '';
              console.log('Got initial bidirectional input:', currentSelectedBidiInput);
            }
            loadBidiInputDevices();
          }).catch((error) => {
            console.error('Error getting initial bidirectional config:', error);
            loadBidiInputDevices();
          });
      } else {
        loadBidiInputDevices();
      }
      
      inputDevice.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Bidirectional input changed to:', val);
        currentSelectedBidiInput = val;
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { bidirectionalInputDevice: val }
          }).then(() => {
            console.log('Updated main app bidirectional input selection:', val);
          }).catch((error) => {
            console.error('Error updating main app bidirectional input:', error);
          });
        }
      });
    }

    const outputDevice = document.getElementById('output-device');
    if (outputDevice) {
      outputDevice.addEventListener('change', (e) => {
        this.sendToMain('overlay:setting-change', {
          setting: 'outputDevice',
          value: e.target.value
        });
      });
    }

    // Capture source list (screen/window) for bidirectional
    const captureSelect = document.getElementById('bidi-capture-source');
    const refreshBtn = document.getElementById('bidi-refresh-sources');
    const loadSources = () => {
      if (!window.electronAPI || !window.electronAPI.getDesktopSources) return;
      window.electronAPI.getDesktopSources(['screen','window']).then((sources) => {
        if (!captureSelect) return;
        captureSelect.innerHTML = '<option value="">Select screen or window...</option>';
        
        sources.forEach(source => {
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
        
        // Set default value if available
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
            .then((res) => {
              if (res && res.success && res.payload && res.payload.uiSettings && res.payload.uiSettings.captureSource) {
                captureSelect.value = res.payload.uiSettings.captureSource;
              }
            }).catch(() => {});
        }
      }).catch(() => {});
    };
    if (refreshBtn) refreshBtn.addEventListener('click', loadSources);
    if (captureSelect) {
      captureSelect.addEventListener('change', (e) => {
        const id = e.target.value || '';
        
        // Remove glow effect when user makes a selection
        captureSelect.style.boxShadow = '';
        captureSelect.style.borderColor = '';
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { captureSource: id } }
          }).then(() => {
            // Configuration updated successfully
          }).catch((error) => {
            console.error('Error updating main app capture source:', error);
          });
        }
        
        // Only meaningful when bidirectional is active and overlay visible
        // We send a state/log message for now; actual capture start is in main/bidi flow
        if (id) {
          if (window.electronAPI && window.electronAPI.invoke) {
            window.electronAPI.invoke('bidirectional:state', { id: Date.now().toString(), timestamp: Date.now(), payload: { action: 'capture-source-selected', details: { sourceId: id } } }).catch(() => {});
          }
        }
      });
    }

    // Initialize capture sources if overlay expanded (best-effort)
    loadSources();

    // Start/Stop translation button
    const startButton = document.getElementById('start-button');
    if (startButton) {
      let isTranslationActive = false;
      
      // Check initial state
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('pipeline:get-status', { 
          id: Date.now().toString(), 
          timestamp: Date.now(), 
          payload: null 
        }).then((res) => {
          if (res && res.success && res.payload && res.payload.isActive) {
            isTranslationActive = true;
            startButton.textContent = '⏹️ Stop Translation';
            startButton.style.background = '#dc3545';
          }
        }).catch(() => {});
      }
      
      startButton.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.invoke) {
          if (!isTranslationActive) {
            // Start translation by sending control command to main app
            window.electronAPI.invoke('overlay:control-translation', { 
              id: Date.now().toString(), 
              timestamp: Date.now(), 
              payload: { action: 'start' } 
            }).then((res) => {
              if (res && res.success) {
                isTranslationActive = true;
                startButton.textContent = '⏹️ Stop Translation';
                startButton.style.background = '#dc3545';
              }
            }).catch((error) => {
              console.error('Error starting translation:', error);
            });
          } else {
            // Stop translation by sending control command to main app
            window.electronAPI.invoke('overlay:control-translation', { 
              id: Date.now().toString(), 
              timestamp: Date.now(), 
              payload: { action: 'stop' } 
            }).then((res) => {
              if (res && res.success) {
                isTranslationActive = false;
                startButton.textContent = '▶️ Start Translation';
                startButton.style.background = '#28a745';
              }
            }).catch((error) => {
              console.error('Error stopping translation:', error);
            });
          }
        }
      });
    }

    // Start/Stop bidirectional button
    const startBidiButton = document.getElementById('start-bidirectional-button');
    if (startBidiButton) {
      let isBidirectionalActive = false;
      const self = this; // Store reference to this
      
      // Check initial state
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('bidirectional:state', { 
          id: Date.now().toString(), 
          timestamp: Date.now(), 
          payload: { action: 'get-status' } 
        }).then((res) => {
          if (res && res.success && res.payload && res.payload.isActive) {
            isBidirectionalActive = true;
            startBidiButton.textContent = '⏹️ Stop Bidirectional';
            startBidiButton.style.background = '#dc3545';
          }
        }).catch(() => {});
      }
      
      startBidiButton.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.invoke) {
          if (!isBidirectionalActive) {
            
            // First, try to get desktop sources to populate the dropdown
            try {
              if (window.electronAPI && window.electronAPI.getDesktopSources) {
                const sources = await window.electronAPI.getDesktopSources(['screen', 'window']);
                
                // Update the capture source dropdown with the sources
                const captureSelect = document.getElementById('bidi-capture-source');
                if (captureSelect && sources && sources.length > 0) {
                  captureSelect.innerHTML = '<option value="">Select screen or window...</option>';
                  
                  // Smart auto-selection keywords
                  const gameKeywords = ['game', 'steam', 'epic', 'uplay', 'origin', 'battlenet', 'minecraft', 'valorant', 'csgo', 'dota', 'league', 'overwatch', 'fortnite', 'apex', 'warzone', 'wow', 'ffxiv'];
                  const mediaKeywords = ['chrome', 'firefox', 'edge', 'safari', 'vlc', 'spotify', 'discord', 'youtube', 'twitch', 'obs'];
                  
                  let bestGameOption = null;
                  let bestMediaOption = null;
                  
                  sources.forEach(source => {
                    const option = document.createElement('option');
                    option.value = source.id;
                    
                    // Format display text to show PIDs for windows
                    let displayText = source.name;
                    if (source.id.startsWith('window:')) {
                      const parts = source.id.split(':');
                      const pid = parts.length >= 3 ? parts[2] : 'Unknown';
                      displayText = `${source.name} (PID: ${pid})`;
                      
                      // Check for smart auto-selection
                      const sourceName = source.name.toLowerCase();
                      if (!bestGameOption && gameKeywords.some(keyword => sourceName.includes(keyword))) {
                        bestGameOption = option;
                      } else if (!bestMediaOption && mediaKeywords.some(keyword => sourceName.includes(keyword))) {
                        bestMediaOption = option;
                      }
                    } else if (source.id.startsWith('screen:')) {
                      displayText = `${source.name} (Screen)`;
                    }
                    
                    option.textContent = displayText;
                    captureSelect.appendChild(option);
                  });
                  
                  // Auto-select the best option (prioritize games over media apps)
                  if (bestGameOption) {
                    captureSelect.value = bestGameOption.value;
                    console.log('🎮 Auto-selected game application:', bestGameOption.textContent);
                  } else if (bestMediaOption) {
                    captureSelect.value = bestMediaOption.value;
                    console.log('🎵 Auto-selected media application:', bestMediaOption.textContent);
                  }
                  
                  // Add glowing effect to the dropdown
                  captureSelect.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
                  captureSelect.style.borderColor = '#3b82f6';
                  
                  // Remove glow after 3 seconds
                  setTimeout(() => {
                    captureSelect.style.boxShadow = '';
                    captureSelect.style.borderColor = '';
                  }, 3000);
                }
                              } else {
                  // Try alternative method using IPC
                  if (window.electronAPI && window.electronAPI.invoke) {
                    const res = await window.electronAPI.invoke('get-desktop-sources', ['screen', 'window']);
                    
                    if (res && Array.isArray(res)) {
                      const sources = res;
                      const captureSelect = document.getElementById('bidi-capture-source');
                      if (captureSelect && sources && sources.length > 0) {
                        captureSelect.innerHTML = '<option value="">Select screen or window...</option>';
                        
                        // Smart auto-selection keywords
                        const gameKeywords = ['game', 'steam', 'epic', 'uplay', 'origin', 'battlenet', 'minecraft', 'valorant', 'csgo', 'dota', 'league', 'overwatch', 'fortnite', 'apex', 'warzone', 'wow', 'ffxiv'];
                        const mediaKeywords = ['chrome', 'firefox', 'edge', 'safari', 'vlc', 'spotify', 'discord', 'youtube', 'twitch', 'obs'];
                        
                        let bestGameOption = null;
                        let bestMediaOption = null;
                        
                        sources.forEach(source => {
                          const option = document.createElement('option');
                          option.value = source.id;
                          
                          // Format display text to show PIDs for windows
                          let displayText = source.name;
                          if (source.id.startsWith('window:')) {
                            const parts = source.id.split(':');
                            const pid = parts.length >= 3 ? parts[2] : 'Unknown';
                            displayText = `${source.name} (PID: ${pid})`;
                            
                            // Check for smart auto-selection
                            const sourceName = source.name.toLowerCase();
                            if (!bestGameOption && gameKeywords.some(keyword => sourceName.includes(keyword))) {
                              bestGameOption = option;
                            } else if (!bestMediaOption && mediaKeywords.some(keyword => sourceName.includes(keyword))) {
                              bestMediaOption = option;
                            }
                          } else if (source.id.startsWith('screen:')) {
                            displayText = `${source.name} (Screen)`;
                          }
                          
                          option.textContent = displayText;
                          captureSelect.appendChild(option);
                        });
                        
                        // Auto-select the best option (prioritize games over media apps)
                        if (bestGameOption) {
                          captureSelect.value = bestGameOption.value;
                          console.log('🎮 Auto-selected game application:', bestGameOption.textContent);
                        } else if (bestMediaOption) {
                          captureSelect.value = bestMediaOption.value;
                          console.log('🎵 Auto-selected media application:', bestMediaOption.textContent);
                        }
                        
                        // Add glowing effect to the dropdown
                        captureSelect.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
                        captureSelect.style.borderColor = '#3b82f6';
                        
                        // Remove glow after 3 seconds
                        setTimeout(() => {
                          captureSelect.style.boxShadow = '';
                          captureSelect.style.borderColor = '';
                        }, 3000);
                      }
                    }
                  }
                }
            } catch (error) {
              console.error('Error getting desktop sources:', error);
            }
            
            // Get the currently selected source
            const captureSelect = document.getElementById('bidi-capture-source');
            const selectedSourceId = captureSelect ? captureSelect.value : '';
            console.log('Overlay: selectedSourceId =', selectedSourceId);
            
            const selectedSource = selectedSourceId ? { id: selectedSourceId, name: captureSelect.options[captureSelect.selectedIndex]?.text || selectedSourceId } : null;
            console.log('Overlay: selectedSource =', selectedSource);
            
            // Now start bidirectional mode with the selected source
            const payload = { 
              action: 'start',
              selectedSource: selectedSource
            };
            console.log('Overlay: sending payload =', payload);
            
            window.electronAPI.invoke('overlay:control-bidirectional', { 
              id: Date.now().toString(), 
              timestamp: Date.now(), 
              payload: payload
            }).then((res) => {
              if (res && res.success) {
                isBidirectionalActive = true;
                startBidiButton.textContent = '⏹️ Stop Bidirectional';
                startBidiButton.style.background = '#dc3545';
              }
            }).catch((error) => {
              console.error('Error starting bidirectional:', error);
            });
          } else {
            // Stop bidirectional by sending control command to main app
            window.electronAPI.invoke('overlay:control-bidirectional', { 
              id: Date.now().toString(), 
              timestamp: Date.now(), 
              payload: { action: 'stop' } 
            }).then((res) => {
              if (res && res.success) {
                isBidirectionalActive = false;
                startBidiButton.textContent = '▶️ Start Bidirectional';
                startBidiButton.style.background = '#28a745';
              }
            }).catch((error) => {
              console.error('Error stopping bidirectional:', error);
            });
          }
        } else {
          console.error('electronAPI not available!');
        }
      });
    }

    // Bidirectional current keybind display
    const bidiCurrentKeybind = document.getElementById('bidi-current-keybind');
    if (bidiCurrentKeybind && window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
        .then((res) => {
          if (res && res.success && res.payload && res.payload.uiSettings && res.payload.uiSettings.bidirectionalHotkey) {
            const bidi = res.payload.uiSettings.bidirectionalHotkey;
            bidiCurrentKeybind.textContent = bidi.key || 'B';
          }
        }).catch(() => {});
    }

    // Overlay hotkey selector
    const overlayHotkey = document.getElementById('overlay-hotkey');
    if (overlayHotkey && window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('overlay:get-config', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
        .then((res) => {
          const key = res && res.success ? ((res.payload && res.payload.toggleHotkey && res.payload.toggleHotkey.key) || 'F11') : 'F11';
          overlayHotkey.value = key;
        }).catch(() => {});
      overlayHotkey.addEventListener('change', (e) => {
        const key = e.target.value;
        window.electronAPI.invoke('config:set', {
          id: Date.now().toString(), timestamp: Date.now(), payload: {
            uiSettings: { overlaySettings: { toggleHotkey: { ctrl: false, alt: false, shift: false, key } } }
          }
        }).then(() => {
          window.electronAPI.invoke('hotkeys:update', { overlayHotkey: { ctrl: false, alt: false, shift: false, key } }).catch(() => {});
        }).catch(() => {});
      });
    }

    // PTT hotkey
    const pttSel = document.getElementById('ptt-hotkey-select');
    const pttCtrl = document.getElementById('ptt-ctrl');
    const pttAlt = document.getElementById('ptt-alt');
    const pttShift = document.getElementById('ptt-shift');
    const savePtt = () => {
      const selectedKey = (pttSel && pttSel.value) || 'Space';
      // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
      let hotkey = { 
        ctrl: !!(pttCtrl && pttCtrl.checked), 
        alt: !!(pttAlt && pttAlt.checked), 
        shift: !!(pttShift && pttShift.checked), 
        key: selectedKey 
      };
      
      // If Space bar is selected, force Ctrl and remove Alt/Shift
      if (selectedKey === 'Space') {
        hotkey.ctrl = true;
        hotkey.alt = false;
        hotkey.shift = false;
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
        // Update checkbox to reflect this
        if (pttCtrl) pttCtrl.checked = true;
        if (pttAlt) pttAlt.checked = false;
        if (pttShift) pttShift.checked = false;
      } else {
        // ENFORCE: Non-function keys (except Space) MUST have Alt
        const isFunctionKey = (key) => /^F\d{1,2}$/.test(key);
        if (!isFunctionKey(selectedKey)) {
          hotkey.alt = true;
          hotkey.ctrl = false;
          hotkey.shift = false;
          console.log(`🚫 ${selectedKey} requires Alt for PTT - enforcing Alt+${selectedKey}`);
          // Update checkbox to reflect this
          if (pttAlt) pttAlt.checked = true;
          if (pttCtrl) pttCtrl.checked = false;
          if (pttShift) pttShift.checked = false;
        }
      }
      
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:set', { id: Date.now().toString(), timestamp: Date.now(), payload: { uiSettings: { pttHotkey: hotkey } } }).catch(() => {});
        window.electronAPI.invoke('hotkeys:update', { pttHotkey: hotkey }).catch(() => {});
      }
    };
    if (pttSel) pttSel.addEventListener('change', savePtt);
    if (pttCtrl) pttCtrl.addEventListener('change', savePtt);
    if (pttAlt) pttAlt.addEventListener('change', savePtt);
    if (pttShift) pttShift.addEventListener('change', savePtt);

    // Bidirectional hotkey
    const bidiSel = document.getElementById('bidi-hotkey-select');
    const bidiCtrl = document.getElementById('bidi-ctrl');
    const bidiAlt = document.getElementById('bidi-alt');
    const bidiShift = document.getElementById('bidi-shift');
    const saveBidi = () => {
      const hotkey = { ctrl: !!(bidiCtrl && bidiCtrl.checked), alt: !!(bidiAlt && bidiAlt.checked), shift: !!(bidiShift && bidiShift.checked), key: (bidiSel && bidiSel.value) || 'B' };
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:set', { id: Date.now().toString(), timestamp: Date.now(), payload: { uiSettings: { bidirectionalHotkey: hotkey } } }).catch(() => {});
        window.electronAPI.invoke('hotkeys:update', { bidirectionalHotkey: hotkey }).catch(() => {});
      }
    };
    if (bidiSel) bidiSel.addEventListener('change', saveBidi);
    if (bidiCtrl) bidiCtrl.addEventListener('change', saveBidi);
    if (bidiAlt) bidiAlt.addEventListener('change', saveBidi);
    if (bidiShift) bidiShift.addEventListener('change', saveBidi);

    // Bidirectional output device selector (mirror main app)
    const bidirectionalOutputSelect = document.getElementById('bidirectional-output-select');
    if (bidirectionalOutputSelect) {
      let currentSelectedOutput = '';
      
      const loadOutputDevices = async () => {
        try {
          console.log('Loading output devices for overlay...');
          
          // Use same approach as main app
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter(d => d.kind === 'audiooutput');
          
          console.log('Found audio output devices:', outputs);
          
          // Clear and populate dropdown (same as main app)
          bidirectionalOutputSelect.innerHTML = '';
          
          if (outputs.length === 0) {
            // Add a fallback option if no output devices found
            const fallbackOpt = document.createElement('option');
            fallbackOpt.value = '';
            fallbackOpt.textContent = 'No output devices found';
            bidirectionalOutputSelect.appendChild(fallbackOpt);
            console.log('No audio output devices found');
          } else {
            outputs.forEach((d) => {
              const opt = document.createElement('option');
              opt.value = d.deviceId;
              opt.textContent = d.label || 'Output Device';
              bidirectionalOutputSelect.appendChild(opt);
            });
            
            // Set from current stored value or default to first device
            if (currentSelectedOutput) {
              bidirectionalOutputSelect.value = currentSelectedOutput;
              console.log('Set output device to stored:', currentSelectedOutput);
            } else if (outputs.length > 0) {
              currentSelectedOutput = outputs[0].deviceId;
              bidirectionalOutputSelect.value = currentSelectedOutput;
              console.log('Set output device to default:', currentSelectedOutput);
            }
          }
          
          console.log(`Loaded ${outputs.length} audio output devices for overlay`);
          
        } catch (error) {
          console.error('Error loading output devices:', error);
          bidirectionalOutputSelect.innerHTML = '<option value="">Error loading devices</option>';
        }
      };
      
      // Get initial config for bidirectional output
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            if (res && res.success && res.payload && res.payload.uiSettings && res.payload.uiSettings.bidirectionalOutputDevice) {
              currentSelectedOutput = res.payload.uiSettings.bidirectionalOutputDevice;
              console.log('Got initial bidirectional output:', currentSelectedOutput);
            }
            loadOutputDevices();
          }).catch((error) => {
            console.error('Error getting initial bidirectional output config:', error);
            loadOutputDevices();
          });
      } else {
        loadOutputDevices();
      }
      
      bidirectionalOutputSelect.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Bidirectional output changed to:', val);
        currentSelectedOutput = val;
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalOutputDevice: val } }
          }).then(() => {
            console.log('Updated main app bidirectional output selection:', val);
          }).catch((error) => {
            console.error('Error updating main app bidirectional output:', error);
          });
        }
      });
    }

    // Incoming voice selector (mirror main app)
    const incomingVoiceSelect = document.getElementById('incoming-voice-select');
    if (incomingVoiceSelect) {
      let currentSelectedVoice = '';
      
      const loadIncomingVoices = async () => {
        try {
          console.log('Loading incoming voices for overlay...');
          
          // Use same approach as main app
          incomingVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';
          const response = await window.electronAPI.invoke('voice:get-voices', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
          });
          let voices = [];
          if (response.success && response.payload) {
            voices = response.payload;
          } else {
            voices = [
              { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)' },
              { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)' }
            ];
          }
          incomingVoiceSelect.innerHTML = '';
          
          if (voices.length === 0) {
            // Add a fallback option if no voices found
            const fallbackOpt = document.createElement('option');
            fallbackOpt.value = '';
            fallbackOpt.textContent = 'No voices available';
            incomingVoiceSelect.appendChild(fallbackOpt);
            console.log('No voices found');
          } else {
            voices.forEach(v => {
              const opt = document.createElement('option');
              opt.value = v.id;
              opt.textContent = v.name;
              incomingVoiceSelect.appendChild(opt);
            });
            
            // Set from current stored value or default to first voice
            if (currentSelectedVoice) {
              incomingVoiceSelect.value = currentSelectedVoice;
              console.log('Set incoming voice to stored:', currentSelectedVoice);
            } else if (voices.length > 0) {
              currentSelectedVoice = voices[0].id;
              incomingVoiceSelect.value = currentSelectedVoice;
              console.log('Set incoming voice to default:', currentSelectedVoice);
            }
          }
          
          console.log(`Loaded ${voices.length} voices for overlay`);
          
        } catch (error) {
          console.error('Error loading incoming voices:', error);
          incomingVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
        }
      };
      
      // Get initial config for incoming voice
      if (window.electronAPI && window.electronAPI.invoke) {
        window.electronAPI.invoke('config:get', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
          .then((res) => {
            if (res && res.success && res.payload && res.payload.uiSettings && res.payload.uiSettings.incomingVoiceId) {
              currentSelectedVoice = res.payload.uiSettings.incomingVoiceId;
              console.log('Got initial incoming voice:', currentSelectedVoice);
            }
            loadIncomingVoices();
          }).catch((error) => {
            console.error('Error getting initial incoming voice config:', error);
            loadIncomingVoices();
          });
      } else {
        loadIncomingVoices();
      }
      
      incomingVoiceSelect.addEventListener('change', (e) => {
        const val = e.target.value || '';
        console.log('Incoming voice changed to:', val);
        currentSelectedVoice = val;
        
        // Update the main app's configuration
        if (window.electronAPI && window.electronAPI.invoke) {
          window.electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { incomingVoiceId: val } }
          }).then(() => {
            console.log('Updated main app incoming voice selection:', val);
          }).catch((error) => {
            console.error('Error updating main app incoming voice:', error);
          });
        }
      });
    }

    // Initialize capture sources if overlay expanded (best-effort)
    loadSources();
  }

  /**
   * Setup toggle switch functionality
   */
  setupToggleSwitch(elementId, settingName) {
    const toggle = document.getElementById(elementId);
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isActive = toggle.classList.contains('active');
        toggle.classList.toggle('active');
        
        this.sendToMain('overlay:setting-change', {
          setting: settingName,
          value: !isActive
        });
      });
    }
  }

  /**
   * Set overlay mode and update UI
   */
  setMode(mode) {
    this.currentMode = mode;
    const elements = window.overlayElements;

    switch (mode) {
      case 'minimal':
        if (elements.minimalHud) elements.minimalHud.classList.remove('hidden');
        if (elements.expandedOverlay) {
          elements.expandedOverlay.classList.add('hidden');
          elements.expandedOverlay.style.display = 'none';
        }
        break;

      case 'expanded':
        if (elements.minimalHud) elements.minimalHud.classList.add('hidden');
        if (elements.expandedOverlay) {
          elements.expandedOverlay.classList.remove('hidden');
          elements.expandedOverlay.style.display = 'block';
          // If content overflows after resizing, ensure scroll container exists
          const sc = elements.expandedOverlay.querySelector('.content-scroll');
          if (sc) {
            // no-op; CSS handles scrolling
          }
        }
        break;

      case 'closed':
      default:
        if (elements.minimalHud) elements.minimalHud.classList.add('hidden');
        if (elements.expandedOverlay) {
          elements.expandedOverlay.classList.add('hidden');
          elements.expandedOverlay.style.display = 'none';
        }
        break;
    }
  }

  /**
   * Update overlay state
   */
  updateState(state) {
    this.currentState = state;
    this.updateUI();
    this.syncSettingsWithState();
  }

  /**
   * Update microphone state
   */
  updateMicrophoneState(micState) {
    // Initialize state if it doesn't exist
    if (!this.currentState) {
      this.currentState = {
        microphoneState: {
          isActive: false,
          isRecording: false,
          deviceId: '',
          level: 0
        },
        bidirectionalState: {
          isEnabled: false,
          inputDevice: '',
          outputDevice: '',
          isProcessingAudio: false
        },
        translationResult: null,
        connectionStatus: 'connected'
      };
    }
    
    // Debug: Log received microphone state updates
    console.log('🎧 Overlay received mic state:', micState);
    
    this.currentState.microphoneState = micState;
    this.updateStatusIndicator();
  }

  /**
   * Update bidirectional state
   */
  updateBidirectionalState(bidiState) {
    if (!this.currentState) return;
    
    this.currentState.bidirectionalState = bidiState;
    this.updateStatusIndicator();
  }

  /**
   * Update translation result
   */
  updateTranslationResult(result) {
    if (!this.currentState) return;
    
    this.currentState.translationResult = result;
    this.updateLanguageLabels();
  }

  /**
   * Update status indicator based on current state
   */
  updateStatusIndicator() {
    const elements = window.overlayElements;
    const indicator = elements.statusIndicator;
    const statusText = elements.statusText;
    const micActivity = elements.micActivity;
    const bidirectionalIndicator = elements.bidirectionalIndicator;
    const minimalHud = elements.minimalHud;

    if (!this.currentState || !indicator || !statusText) return;

    const { microphoneState, bidirectionalState, connectionStatus } = this.currentState;

    // Determine status based on current activity
    let status = 'idle';
    let text = 'Ready';

    if (connectionStatus === 'disconnected') {
      status = 'disconnected';
      text = 'Disconnected';
    } else if (bidirectionalState.isProcessingAudio) {
      status = 'translating';
      text = 'Translating';
    } else if (microphoneState.isRecording && microphoneState.level > 10) {
      status = 'listening';
      text = 'Listening';
    } else if (bidirectionalState.isEnabled) {
      status = 'bidirectional';
      text = 'Bidirectional';
    } else if (microphoneState.isActive) {
      status = 'idle';
      text = 'Ready';
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

    // Toggle HUD speaking state for visual emphasis
    if (minimalHud) {
      const isActive = status === 'recording' || status === 'bidirectional' || status === 'translating';
      minimalHud.classList.toggle('speaking', isActive);
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
  updateLanguageLabels() {
    const elements = window.overlayElements;
    const languageLabels = elements.languageLabels;
    const sourceLang = elements.sourceLang;
    const targetLang = elements.targetLang;

    if (!this.currentState?.translationResult) {
      if (languageLabels) languageLabels.classList.add('hidden');
      return;
    }

    const { sourceLanguage, targetLanguage } = this.currentState.translationResult;
    
    // Map language codes to readable names
    const languageNames = {
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
    
    if (languageLabels) languageLabels.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (languageLabels) languageLabels.classList.add('hidden');
    }, 5000);
  }

  /**
   * Switch between tabs in expanded mode
   */
  switchTab(tab) {
    const elements = window.overlayElements;

    // Update tab buttons
    if (elements.translationTab) {
      elements.translationTab.classList.toggle('active', tab === 'translation');
    }
    if (elements.bidirectionalTab) {
      elements.bidirectionalTab.classList.toggle('active', tab === 'bidirectional');
    }
    const settingsTabBtn = document.getElementById('overlay-settings-tab');
    if (settingsTabBtn) {
      settingsTabBtn.classList.toggle('active', tab === 'settings');
    }

    // Update tab content
    const translationContent = document.getElementById('translation-content');
    const bidirectionalContent = document.getElementById('bidirectional-content');
    const settingsContent = document.getElementById('overlay-settings-content');
    if (translationContent) translationContent.classList.toggle('hidden', tab !== 'translation');
    if (bidirectionalContent) bidirectionalContent.classList.toggle('hidden', tab !== 'bidirectional');
    if (settingsContent) settingsContent.classList.toggle('hidden', tab !== 'settings');
  }

  /**
   * Update UI based on current state
   */
  updateUI() {
    this.updateStatusIndicator();
    this.updateLanguageLabels();
  }

  /**
   * Sync UI settings with current state
   */
  syncSettingsWithState() {
    if (!this.currentState) return;

    // Update expanded overlay settings to match current state
    const sourceLanguage = document.getElementById('source-language');
    const targetLanguage = document.getElementById('language-select') || document.getElementById('target-language');
    const voiceSelect = document.getElementById('voice-select');
    const inputDevice = document.getElementById('input-device');
    const outputDevice = document.getElementById('output-device');
    const bidiToggle = document.getElementById('bidi-toggle');

    // Update language selections
    if (this.currentState.translationResult) {
      const { sourceLanguage: srcLang, targetLanguage: tgtLang } = this.currentState.translationResult;
      if (sourceLanguage && sourceLanguage.value !== srcLang) {
        sourceLanguage.value = srcLang;
      }
      if (targetLanguage && targetLanguage.value !== tgtLang) {
        targetLanguage.value = tgtLang;
      }
    }

    // Update device selections
    if (inputDevice && this.currentState.microphoneState.deviceId) {
      inputDevice.value = this.currentState.microphoneState.deviceId;
    }

    // Update bidirectional toggle
    if (bidiToggle) {
      if (this.currentState.bidirectionalState.isEnabled) {
        bidiToggle.classList.add('active');
      } else {
        bidiToggle.classList.remove('active');
      }
    }
  }

  /**
   * Show visual screen/window selection overlay with glowing borders
   */
  async showVisualSourceSelection() {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Showing visual source selection overlay...');
        
        // Get desktop sources
        if (!window.electronAPI || !window.electronAPI.getDesktopSources) {
          throw new Error('Desktop sources API not available');
        }
        
        const sources = await window.electronAPI.getDesktopSources(['screen', 'window']);
        if (!sources || sources.length === 0) {
          throw new Error('No desktop sources available');
        }
        
        // Create the visual selection overlay
        const overlay = document.createElement('div');
        overlay.id = 'visual-source-selection-overlay';
        overlay.style.cssText = `
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483646;
          backdrop-filter: blur(5px);
        `;
        
        // Create the selection modal
        const modal = document.createElement('div');
        modal.style.cssText = `
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 24px;
          max-width: 90vw;
          width: 500px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
          margin-bottom: 20px;
          text-align: center;
        `;
        header.innerHTML = `
          <h3 style="color: white; margin: 0 0 8px 0; font-size: 18px;">Select Screen or Window</h3>
          <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 14px;">
            Choose what to capture for bidirectional audio
          </p>
        `;
        modal.appendChild(header);
        
        // Sources list
        const sourcesList = document.createElement('div');
        sourcesList.style.cssText = `
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 20px;
        `;
        
        sources.forEach((source, index) => {
          const sourceItem = document.createElement('div');
          sourceItem.style.cssText = `
            margin-bottom: 8px;
            border-radius: 8px;
            overflow: hidden;
            transition: all 0.2s ease;
          `;
          
          const sourceButton = document.createElement('button');
          sourceButton.style.cssText = `
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: white;
            font-size: 14px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 12px;
          `;
          
          // Format display text with PIDs
          let displayText = source.name;
          let icon = '🖥️';
          if (source.id.startsWith('window:')) {
            const parts = source.id.split(':');
            const pid = parts.length >= 3 ? parts[2] : 'Unknown';
            displayText = `${source.name} (PID: ${pid})`;
            icon = '🪟';
          } else if (source.id.startsWith('screen:')) {
            displayText = `${source.name} (Screen)`;
            icon = '🖥️';
          }
          
          sourceButton.innerHTML = `
            <span style="font-size: 16px;">${icon}</span>
            <span>${displayText}</span>
          `;
          
          // Hover effects
          sourceButton.onmouseenter = () => {
            sourceButton.style.background = 'rgba(59, 130, 246, 0.3)';
            sourceButton.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            sourceButton.style.transform = 'translateY(-1px)';
            sourceButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          };
          
          sourceButton.onmouseleave = () => {
            sourceButton.style.background = 'rgba(255, 255, 255, 0.1)';
            sourceButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            sourceButton.style.transform = 'translateY(0)';
            sourceButton.style.boxShadow = 'none';
          };
          
          // Click handler
          sourceButton.onclick = () => {
            console.log('Source selected:', source.name, 'ID:', source.id);
            
            // Add selection animation
            sourceButton.style.background = 'rgba(34, 197, 94, 0.3)';
            sourceButton.style.borderColor = 'rgba(34, 197, 94, 0.5)';
            sourceButton.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.5)';
            
            // Remove overlay after short delay
            setTimeout(() => {
              document.body.removeChild(overlay);
              resolve(source);
            }, 300);
          };
          
          sourceItem.appendChild(sourceButton);
          sourcesList.appendChild(sourceItem);
        });
        
        modal.appendChild(sourcesList);
        
        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.style.cssText = `
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        `;
        cancelButton.textContent = 'Cancel';
        
        cancelButton.onmouseenter = () => {
          cancelButton.style.background = 'rgba(239, 68, 68, 0.3)';
          cancelButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        };
        
        cancelButton.onmouseleave = () => {
          cancelButton.style.background = 'rgba(255, 255, 255, 0.1)';
          cancelButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        };
        
        cancelButton.onclick = () => {
          document.body.removeChild(overlay);
          reject(new Error('User cancelled source selection'));
        };
        
        modal.appendChild(cancelButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Auto-focus first source
        const firstButton = sourcesList.querySelector('button');
        if (firstButton) {
          firstButton.focus();
        }
        
      } catch (error) {
        console.error('Error creating visual source selection:', error);
        reject(error);
      }
    });
  }

  /**
   * Send message to main process
   */
  sendToMain(channel, data) {
    if (window.electronAPI && window.electronAPI.sendToMain) {
      window.electronAPI.sendToMain(channel, data);
    }
  }

  /**
   * Optimize rendering performance
   */
  optimizeRendering() {
    // Throttle UI updates to prevent excessive redraws
    if (this.updateThrottle) {
      clearTimeout(this.updateThrottle);
    }
    
    this.updateThrottle = setTimeout(() => {
      this.updateUI();
    }, 16); // ~60fps
  }

  /**
   * Clean up resources when requested
   */
  cleanupResources() {
    // Clear any timers
    if (this.updateThrottle) {
      clearTimeout(this.updateThrottle);
      this.updateThrottle = null;
    }

    // Clear any cached data
    this.currentState = null;
    
    // Remove event listeners if needed
    // (They will be re-added when overlay is shown again)
  }

  // Load gameoverlay.md content and render into translation tab
  async loadGameOverlayContent() {
    try {
      if (!window.electronAPI || !window.electronAPI.invoke) return;
      const res = await window.electronAPI.invoke('overlay:get-gameoverlay', { id: Date.now().toString(), timestamp: Date.now(), payload: null });
      const md = res && res.success ? (res.payload && res.payload.markdown) || '' : '';
      if (!md) return;
      const container = document.getElementById('translation-content');
      if (!container) return;
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
      const finalHtml = html.includes('<li>') ? `<ul>${html}</ul>` : html;
      container.innerHTML = finalHtml + container.innerHTML;
    } catch {}
  }
}

// Initialize overlay renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OverlayRenderer();
});

// Export for potential external use
window.OverlayRenderer = OverlayRenderer;