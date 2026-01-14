/**
 * Soundboard Manager Module
 * Handles all soundboard functionality including sound pads, audio routing, hotkeys, and overlay integration
 */

// Type definitions
export interface SoundEntry {
    id: string;
    path: string;
    label: string;
    hotkey?: string;
    duration?: number;
    addedAt: number;
    slot?: number; // Optional for backward compatibility
}

export interface SoundboardSettings {
    outputDevice: string;
    masterVolume: number;
    headphonesVolume: number;
    polyphonyMode: boolean;
    hotkeysEnabled: boolean;
}

export class SoundboardManager {
    private soundPadGrid: HTMLElement | null = null;
    private outputSelect: HTMLSelectElement | null = null;
    private volumeSlider: HTMLInputElement | null = null;
    private volumeDisplay: HTMLSpanElement | null = null;
    private headphonesVolumeSlider: HTMLInputElement | null = null;
    private headphonesVolumeDisplay: HTMLSpanElement | null = null;
    private addSoundButton: HTMLButtonElement | null = null;
    private overlayButton: HTMLButtonElement | null = null;
    private stopAllButton: HTMLButtonElement | null = null;

    // Sound config overlay elements
    private configOverlay: HTMLElement | null = null;
    private soundNameInput: HTMLInputElement | null = null;
    private soundHotkeyInput: HTMLInputElement | null = null;
    private configSaveButton: HTMLButtonElement | null = null;
    private configCancelButton: HTMLButtonElement | null = null;
    private clearHotkeyButton: HTMLButtonElement | null = null;
    private configCloseButton: HTMLButtonElement | null = null;

    // Pending sound data
    private pendingSoundData: { filePath: string; targetPadId?: string } | null = null;

    private sounds: Map<string, SoundEntry> = new Map();
    private playingStates: Map<string, boolean> = new Map();
    private audioElements: Map<string, HTMLAudioElement> = new Map();
    private headphonesAudioElements: Map<string, HTMLAudioElement> = new Map();
    private overlayVbGainNode: GainNode | null = null;
    private overlayHeadphonesGainNode: GainNode | null = null;
    private browserViewVbGainNode: GainNode | null = null;
    private browserViewHeadphonesGainNode: GainNode | null = null;
    private settings: SoundboardSettings = {
        outputDevice: '',
        masterVolume: 0.75,
        headphonesVolume: 0.75,
        polyphonyMode: true,
        hotkeysEnabled: true
    };

    private keyboardListenerActive = false;
    private nextSlotId = 1;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log('Initializing soundboard...');

        // Get DOM elements
        this.soundPadGrid = document.getElementById('sound-pad-grid');
        this.outputSelect = document.getElementById('sound-board-output') as HTMLSelectElement;
        this.volumeSlider = document.getElementById('sound-board-volume') as HTMLInputElement;
        this.volumeDisplay = this.volumeSlider?.parentElement?.querySelector('span') || null;
        this.headphonesVolumeSlider = document.getElementById('sound-board-headphones-volume') as HTMLInputElement;
        this.headphonesVolumeDisplay = this.headphonesVolumeSlider?.parentElement?.querySelector('span') || null;
        this.addSoundButton = document.getElementById('add-sound-button') as HTMLButtonElement;
        this.overlayButton = document.getElementById('soundboard-overlay-button') as HTMLButtonElement;
        this.stopAllButton = document.getElementById('stop-all-sounds-button') as HTMLButtonElement;

        // Initialize config overlay elements
        this.configOverlay = document.getElementById('sound-config-overlay');
        this.soundNameInput = document.getElementById('sound-name-input') as HTMLInputElement;
        this.soundHotkeyInput = document.getElementById('sound-hotkey-input') as HTMLInputElement;
        this.configSaveButton = document.getElementById('sound-config-save') as HTMLButtonElement;
        this.configCancelButton = document.getElementById('sound-config-cancel') as HTMLButtonElement;
        this.clearHotkeyButton = document.getElementById('clear-hotkey') as HTMLButtonElement;
        this.configCloseButton = document.getElementById('sound-config-close') as HTMLButtonElement;

        if (!this.soundPadGrid || !this.outputSelect || !this.volumeSlider || !this.headphonesVolumeSlider || !this.configOverlay || !this.stopAllButton) {
            console.error('Failed to find soundboard UI elements');
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Setup overlay audio routing listener
        this.setupOverlayAudioListener();

        // Load initial data
        await this.loadSettings();
        await this.loadSounds();
        await this.loadAudioDevices();

        // Initialize slider fills after settings are loaded
        if (this.volumeSlider) {
            this.updateSliderFill(this.volumeSlider);
        }
        if (this.headphonesVolumeSlider) {
            this.updateSliderFill(this.headphonesVolumeSlider);
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup hotkeys toggle
        this.setupHotkeysToggle();

        // Listen for global soundboard hotkeys from main
        (window as any).electronAPI?.on?.('soundboard:global-hotkey', async (_event: any, data: any) => {
            try {
                if (!data) return;
                // Check if soundboard hotkeys are enabled
                if (!this.settings.hotkeysEnabled) return;

                const slot = Number(data.slot);
                if (!Number.isFinite(slot)) return;
                const padId = this.findPadIdBySlot(slot);
                if (padId) {
                    await this.handleSoundPadClick(padId);
                }
            } catch (err) {
                console.warn('Failed to handle global soundboard hotkey:', err);
            }
        });

        console.log('Soundboard initialized successfully');
    }


    private createSoundPad(id: string, hotkey?: string): HTMLButtonElement {
        const pad = document.createElement('button');
        pad.className = 'sound-pad';
        pad.dataset.soundId = id;
        pad.style.position = 'relative';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'sound-pad-label';
        labelDiv.textContent = `Sound ${id}`;

        const keyDiv = document.createElement('div');
        keyDiv.className = 'sound-pad-key';
        keyDiv.textContent = hotkey || '';

        // Create trash can button
        const trashButton = document.createElement('button');
        trashButton.className = 'sound-pad-delete';
        trashButton.innerHTML = '🗑️';
        trashButton.title = 'Remove sound';
        trashButton.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(220, 53, 69, 0.9);
            border: none;
            border-radius: 4px;
            width: 24px;
            height: 24px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            cursor: pointer;
            z-index: 10;
            color: white;
        `;

        // Show/hide trash can on hover
        pad.addEventListener('mouseenter', () => {
            trashButton.style.display = 'flex';
        });

        pad.addEventListener('mouseleave', () => {
            trashButton.style.display = 'none';
        });

        // Trash button click handler
        trashButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.removeSound(id);
        });

        pad.appendChild(labelDiv);
        pad.appendChild(keyDiv);
        pad.appendChild(trashButton);

        // Add event listeners
        pad.addEventListener('click', () => this.handleSoundPadClick(id));
        pad.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showSoundPadContextMenu(id, e.clientX, e.clientY);
        });

        this.soundPadGrid?.appendChild(pad);
        return pad;
    }

    private getDefaultHotkey(slot: number): string {
        const keyMap: { [key: number]: string } = {
            1: '1', 2: '2', 3: '3', 4: '4',
            5: 'Q', 6: 'W', 7: 'E', 8: 'R',
            9: 'A', 10: 'S', 11: 'D', 12: 'F'
        };
        return keyMap[slot] || '';
    }

    private addNewSoundPad(): string {
        const id = `sound_${this.nextSlotId++}`;
        this.createSoundPad(id);
        return id;
    }

    private findPadIdBySlot(slot: number): string | undefined {
        for (const [padId, sound] of this.sounds.entries()) {
            if (sound.slot === slot) {
                return padId;
            }
        }
        return undefined;
    }

    private setupEventListeners(): void {
        // Sound pad click handlers will be added dynamically when pads are created

        // Volume slider
        this.volumeSlider?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const volume = parseInt(target.value) / 100;
            this.updateVolume(volume);
            this.updateSliderFill(target);
            // Update percentage display
            if (this.volumeDisplay) {
                this.volumeDisplay.textContent = `${Math.round(parseInt(target.value))}%`;
            }
        });

        // Headphones volume slider
        this.headphonesVolumeSlider?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const volume = parseInt(target.value) / 100;
            this.updateHeadphonesVolume(volume);
            this.updateSliderFill(target);
            // Update percentage display
            if (this.headphonesVolumeDisplay) {
                this.headphonesVolumeDisplay.textContent = `${Math.round(parseInt(target.value))}%`;
            }
        });

        // Slider fills will be initialized after settings load

        // Output device selection - disabled (hardcoded to VB-Audio Virtual Cable)
        // this.outputSelect?.addEventListener('change', (e) => {
        //     const target = e.target as HTMLSelectElement;
        //     if (target.value) {
        //         console.log('🔊 Selected output device:', target.value);
        //         this.updateOutputDevice(target.value);
        //     }
        // });

        // Add sound button
        this.addSoundButton?.addEventListener('click', () => {
            this.showFilePicker();
        });

        // Overlay button
        this.overlayButton?.addEventListener('click', () => {
            console.log('Soundboard overlay button clicked');
            this.toggleSoundboardOverlay();
        });

        // Stop all sounds button
        this.stopAllButton?.addEventListener('click', () => {
            console.log('Stop all button clicked');
            this.stopAllSounds();
        });

        // Drag and drop
        this.setupDragAndDrop();

        // Config overlay event listeners
        this.setupConfigOverlay();

        // IPC event listeners
        this.setupIPCListeners();
    }

    private setupOverlayAudioListener(): void {
        // Listen for overlay audio signals
        if ((window as any).electronAPI) {
            (window as any).electronAPI.on('soundboard:overlay-audio-started', () => {
                console.log('🎵 Overlay audio started, creating test audio');
                this.handleOverlayAudioStart();
            });

            (window as any).electronAPI.on('soundboard:overlay-audio-stopped', () => {
                console.log('🎵 Overlay audio stopped, stopping test audio');
                this.handleOverlayAudioStop();
            });
        }
    }

    private async handleOverlayAudioStart(): Promise<void> {
        try {
            console.log('🎵 Handling overlay audio start - connecting to soundboard overlay audio');

            // Setup audio bridge with the soundboard overlay
            const audioStream = await this.getSoundboardOverlayAudio();

            if (audioStream === null) {
                // null means the overlay is handling its own routing directly
                console.log('🎵 Soundboard overlay is handling audio routing directly');
                return;
            } else if (!audioStream) {
                console.warn('🎵 No audio stream available from soundboard overlay, using fallback');
                // If we can't get the overlay audio, we'll fall back to the old behavior but with a notification
                await this.handleOverlayAudioFallback();
                return;
            }

            console.log('🎵 Got audio stream from soundboard overlay, setting up routing');

            // Create audio context for routing the overlay audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create source from the overlay audio stream
            const sourceNode = audioContext.createMediaStreamSource(audioStream);
            const vbGainNode = audioContext.createGain();
            const headphonesGainNode = audioContext.createGain();

            // Create destinations for VB Audio and headphones
            const vbDestination = audioContext.createMediaStreamDestination();
            const headphonesDestination = audioContext.createMediaStreamDestination();

            // Connect the audio graph - route the overlay audio to both outputs
            sourceNode.connect(vbGainNode);
            sourceNode.connect(headphonesGainNode);
            vbGainNode.connect(vbDestination);
            headphonesGainNode.connect(headphonesDestination);

            // Store references to gain nodes for volume updates
            this.overlayVbGainNode = vbGainNode;
            this.overlayHeadphonesGainNode = headphonesGainNode;

            // Set initial volumes
            vbGainNode.gain.value = this.settings.masterVolume;
            headphonesGainNode.gain.value = this.settings.headphonesVolume;

            // Create audio elements for both outputs
            const vbAudio = new Audio();
            vbAudio.srcObject = vbDestination.stream;

            const headphonesAudio = new Audio();
            headphonesAudio.srcObject = headphonesDestination.stream;

            // Set VB Audio output device if available
            if (this.settings.outputDevice && 'setSinkId' in vbAudio) {
                try {
                    await (vbAudio as any).setSinkId(this.settings.outputDevice);
                } catch (e) {
                    console.warn('Failed to set VB Audio output device for overlay:', e);
                }
            }

            // Start audio playback
            await vbAudio.play();
            await headphonesAudio.play();

            console.log('🎵 Soundboard overlay audio routing started successfully');

            // Store references for volume control and cleanup
            const overlayAudioId = `overlay_${Date.now()}`;
            this.audioElements.set(overlayAudioId, vbAudio);
            this.headphonesAudioElements.set(overlayAudioId, headphonesAudio);

            // Store audio context and nodes for cleanup
            (vbAudio as any)._audioContext = audioContext;
            (vbAudio as any)._sourceNode = sourceNode;
            (headphonesAudio as any)._audioContext = audioContext;
            (headphonesAudio as any)._sourceNode = sourceNode;

            // Clean up when audio ends or errors
            const cleanup = () => {
                console.log('🎵 Cleaning up soundboard overlay audio routing');
                this.audioElements.delete(overlayAudioId);
                this.headphonesAudioElements.delete(overlayAudioId);

                try {
                    audioContext.close();
                } catch (e) {
                    console.warn('Error stopping overlay audio:', e);
                }

                if (vbAudio.srcObject) {
                    vbAudio.srcObject = null;
                }
                if (headphonesAudio.srcObject) {
                    headphonesAudio.srcObject = null;
                }
            };

            vbAudio.addEventListener('ended', cleanup);
            headphonesAudio.addEventListener('ended', cleanup);
            vbAudio.addEventListener('error', cleanup);
            headphonesAudio.addEventListener('error', cleanup);

        } catch (error) {
            console.error('🎵 Error connecting to soundboard overlay audio:', error);
        }
    }

    private async getSoundboardOverlayAudio(): Promise<MediaStream | null> {
        try {
            console.log('🎵 Requesting to setup direct audio connection with soundboard overlay...');

            // Instead of trying to pass streams, we'll set up a direct audio connection
            // by asking the overlay to create its own audio routing that we can connect to
            const result = await (window as any).electronAPI.invoke('soundboard-overlay:setup-audio-bridge');

            if (result.success) {
                console.log('🎵 Audio bridge setup successful, creating connection...');
                // The overlay will now handle its own audio routing to both channels
                // We don't need to capture the stream - the overlay does the routing itself
                return null; // Signal that overlay is handling its own routing
            } else {
                console.warn('🎵 Failed to setup audio bridge:', result.error);
                return null;
            }

        } catch (error) {
            console.error('🎵 Error setting up soundboard overlay audio bridge:', error);
            return null;
        }
    }

    private async handleOverlayAudioFallback(): Promise<void> {
        console.log('🎵 Using fallback audio routing (no direct overlay connection available)');
        // For now, just log that we're falling back - in the future we could implement
        // a different strategy here, like using a placeholder tone or trying alternative methods
    }

    private handleOverlayAudioStop(): void {
        console.log('🎵 Stopping overlay audio streams');

        // Also signal the overlay to stop its own audio routing
        this.stopSoundboardOverlayAudio();

        // Find and stop overlay audio elements managed by main app
        const overlayAudioIds = Array.from(this.audioElements.keys()).filter(id => id.startsWith('overlay_'));

        overlayAudioIds.forEach(overlayAudioId => {
            const vbAudio = this.audioElements.get(overlayAudioId);
            const headphonesAudio = this.headphonesAudioElements.get(overlayAudioId);

            if (vbAudio) {
                try {
                    vbAudio.pause();
                    // Stop the oscillator/source and close audio context if they exist
                    if ((vbAudio as any)._oscillator) {
                        (vbAudio as any)._oscillator.stop();
                    }
                    if ((vbAudio as any)._sourceNode) {
                        // Disconnect the source node
                        (vbAudio as any)._sourceNode.disconnect();
                    }
                    if ((vbAudio as any)._audioContext) {
                        (vbAudio as any)._audioContext.close();
                    }
                    if (vbAudio.srcObject) {
                        vbAudio.srcObject = null;
                    }
                } catch (e) {
                    console.warn('Error stopping VB overlay audio:', e);
                }
                this.audioElements.delete(overlayAudioId);
            }

            if (headphonesAudio) {
                try {
                    headphonesAudio.pause();
                    if (headphonesAudio.srcObject) {
                        headphonesAudio.srcObject = null;
                    }
                } catch (e) {
                    console.warn('Error stopping headphones overlay audio:', e);
                }
                this.headphonesAudioElements.delete(overlayAudioId);
            }
        });

        console.log('🎵 Stopped', overlayAudioIds.length, 'overlay audio streams');
    }

    private async stopSoundboardOverlayAudio(): Promise<void> {
        try {
            console.log('🎵 Signaling soundboard overlay to stop audio routing');
            await (window as any).electronAPI.invoke('soundboard-overlay:stop-audio-bridge');
        } catch (error) {
            console.warn('🎵 Failed to stop soundboard overlay audio:', error);
        }
    }

    private setupDragAndDrop(): void {
        const soundBoardPanel = document.getElementById('sound-board-panel');
        if (!soundBoardPanel) return;

        soundBoardPanel.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
            soundBoardPanel.classList.add('drag-over');
        });

        soundBoardPanel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            soundBoardPanel.classList.remove('drag-over');
        });

        soundBoardPanel.addEventListener('drop', async (e) => {
            e.preventDefault();
            soundBoardPanel.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer!.files);
            const audioFiles = files.filter(file =>
                /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(file.name)
            );

            if (audioFiles.length === 1) {
                // Single file - show config overlay
                this.showConfigOverlay((audioFiles[0] as any).path);
            } else if (audioFiles.length > 1) {
                // Multiple files - add with default names
                await this.addSoundsFromFiles(audioFiles.map(f => (f as any).path));
            } else {
                this.showError('Please drop audio files (mp3, wav, ogg, aac, flac, m4a)');
            }
        });
    }

    private setupConfigOverlay(): void {
        // Close overlay buttons
        this.configCloseButton?.addEventListener('click', () => {
            this.hideConfigOverlay();
        });

        this.configCancelButton?.addEventListener('click', () => {
            this.hideConfigOverlay();
        });

        // Click outside to close
        this.configOverlay?.addEventListener('click', (e) => {
            if (e.target === this.configOverlay) {
                this.hideConfigOverlay();
            }
        });

        // Save button
        this.configSaveButton?.addEventListener('click', () => {
            this.saveSound();
        });

        // Clear hotkey button
        this.clearHotkeyButton?.addEventListener('click', () => {
            if (this.soundHotkeyInput) {
                this.soundHotkeyInput.value = '';
            }
        });

        // Hotkey capture
        this.soundHotkeyInput?.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.captureHotkey(e);
        });

        // Enter key to save
        this.soundNameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveSound();
            }
        });
    }

    private setupIPCListeners(): void {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.soundboard) return;

        electronAPI.soundboard.onSoundLoaded((sound: SoundEntry) => {
            // Find the pad ID for this sound by slot number
            const padId = this.findPadIdBySlot(sound.slot || 0);
            if (padId) {
                this.sounds.set(padId, sound);
                this.updateSoundPadUI(padId);
            }
        });

        electronAPI.soundboard.onSoundPlayed((data: { sound: SoundEntry, slot: number }) => {
            const padId = this.findPadIdBySlot(data.slot);
            if (padId) {
                this.playingStates.set(padId, true);
                this.updateSoundPadPlayingState(padId, true);
            }
        });

        electronAPI.soundboard.onSoundStopped((data: { slot?: number, all?: boolean }) => {
            if (data.all) {
                this.playingStates.clear();
                // Clear all playing states
                for (const padId of this.sounds.keys()) {
                    this.updateSoundPadPlayingState(padId, false);
                }
            } else if (data.slot) {
                const padId = this.findPadIdBySlot(data.slot);
                if (padId) {
                    this.playingStates.delete(padId);
                    this.updateSoundPadPlayingState(padId, false);
                }
            }
        });

        electronAPI.soundboard.onSoundError((error: any) => {
            this.showError(error.message || 'Sound error occurred');
        });

        electronAPI.soundboard.onDeviceChanged((deviceId: string) => {
            // Device changes are ignored - output is hardcoded to VB Audio INPUT Cable
            console.log('Device change detected:', deviceId, '- but output device is hardcoded to VB Audio INPUT Cable');
        });

        electronAPI.soundboard.onVolumeChanged((volume: number) => {
            this.settings.masterVolume = volume;
            if (this.volumeSlider) {
                this.volumeSlider.value = (volume * 100).toString();
                this.updateSliderFill(this.volumeSlider);
            }
            if (this.volumeDisplay) {
                this.volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            }
            // Update all active VB audio elements
            this.audioElements.forEach((audioElement) => {
                if (audioElement) {
                    audioElement.volume = volume;
                }
            });
            // Update overlay VB gain node if active
            if (this.overlayVbGainNode && this.overlayVbGainNode.gain) {
                this.overlayVbGainNode.gain.value = volume;
            }
            // Update browser view VB gain node if active
            if (this.browserViewVbGainNode && this.browserViewVbGainNode.gain) {
                this.browserViewVbGainNode.gain.value = volume;
            }
        });

        electronAPI.soundboard.onHeadphonesVolumeChanged((volume: number) => {
            this.settings.headphonesVolume = volume;
            if (this.headphonesVolumeSlider) {
                this.headphonesVolumeSlider.value = (volume * 100).toString();
                this.updateSliderFill(this.headphonesVolumeSlider);
            }
            if (this.headphonesVolumeDisplay) {
                this.headphonesVolumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            }
            // Update all active headphones audio elements
            this.headphonesAudioElements.forEach((audioElement) => {
                if (audioElement) {
                    audioElement.volume = volume;
                }
            });
            // Update overlay headphones gain node if active
            if (this.overlayHeadphonesGainNode && this.overlayHeadphonesGainNode.gain) {
                this.overlayHeadphonesGainNode.gain.value = volume;
            }
            // Update browser view headphones gain node if active
            if (this.browserViewHeadphonesGainNode && this.browserViewHeadphonesGainNode.gain) {
                this.browserViewHeadphonesGainNode.gain.value = volume;
            }
        });
    }

    private setupKeyboardShortcuts(): void {
        if (this.keyboardListenerActive) return;

        document.addEventListener('keydown', (e) => {
            // Only handle soundboard keys when soundboard tab is active
            const activeTab = document.querySelector('.control-panel:not([style*="display: none"])');
            if (activeTab?.id !== 'sound-board-panel') return;

            // Ignore if user is typing in an input or capturing a hotkey in the config overlay
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (document.activeElement && document.activeElement.id === 'sound-hotkey-input') return;

            // Check if soundboard hotkeys are enabled
            if (!this.settings.hotkeysEnabled) return;

            // One press acts as a click; ignore repeats while held down
            if ((e as KeyboardEvent).repeat) return;

            // Try to match against per-sound configured hotkeys first
            const formatted = this.formatHotkeyFromEvent(e);
            if (formatted) {
                for (const [padId, sound] of this.sounds.entries()) {
                    if (sound.hotkey && sound.hotkey === formatted) {
                        e.preventDefault();
                        this.handleSoundPadClick(padId);
                        return;
                    }
                }
            }

            // Fallback to default 12-key layout mapping, including numpad 1-4
            const key = e.key.toUpperCase();
            const code = (e as KeyboardEvent).code || '';
            const keyToSlot: { [key: string]: number } = {
                '1': 1, '2': 2, '3': 3, '4': 4,
                'Q': 5, 'W': 6, 'E': 7, 'R': 8,
                'A': 9, 'S': 10, 'D': 11, 'F': 12
            };

            let slot: number | undefined = keyToSlot[key];
            // Map numpad 1-4 to slots 1-4 as well (covers NumLock off cases too)
            if (slot === undefined && /^Numpad[0-9]$/.test(code)) {
                const digit = parseInt(code.replace('Numpad', ''), 10);
                if (digit >= 1 && digit <= 4) slot = digit;
            }
            if (slot) {
                e.preventDefault();
                const padId = this.findPadIdBySlot(slot);
                if (padId) {
                    this.handleSoundPadClick(padId);
                } else {
                    // Find the pad with this slot number (1-12) for initial pads
                    const initialPadId = slot.toString();
                    this.handleSoundPadClick(initialPadId);
                }
            }
        });

        this.keyboardListenerActive = true;
    }

    private setupHotkeysToggle(): void {
        const toggle = document.getElementById('soundboard-hotkeys-toggle');
        if (!toggle) return;

        // Set initial state
        if (this.settings.hotkeysEnabled) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }

        // Handle toggle click
        toggle.addEventListener('click', async () => {
            this.settings.hotkeysEnabled = !this.settings.hotkeysEnabled;

            if (this.settings.hotkeysEnabled) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }

            // Save setting
            try {
                await (window as any).electronAPI.soundboard.updateSettings({ hotkeysEnabled: this.settings.hotkeysEnabled });
            } catch (error) {
                console.error('Failed to save hotkeys setting:', error);
            }

            console.log('Soundboard hotkeys', this.settings.hotkeysEnabled ? 'enabled' : 'disabled');
        });
    }

    private async handleSoundPadClick(id: string): Promise<void> {
        try {
            console.log('🎵 Handling sound pad click for ID:', id);

            const sound = this.sounds.get(id);
            const isPlaying = this.playingStates.get(id);

            console.log('🎵 Sound found:', sound ? 'YES' : 'NO', 'Is playing:', isPlaying);

            if (sound && isPlaying) {
                // Stop the sound
                console.log('🎵 Stopping sound:', sound.label);
                this.stopSound(id);
            } else if (sound) {
                // Play the sound
                console.log('🎵 Playing sound:', sound.label, 'from:', sound.path);
                await this.playSound(id);
                console.log('🎵 Sound playback initiated');
            } else {
                // No sound assigned, show file picker for this specific pad
                console.log('🎵 No sound found for ID, showing file picker');
                await this.showFilePicker(id);
            }
        } catch (error) {
            console.error('🎵 Error handling sound pad click:', error);
            this.showError('Failed to play sound');
        }
    }

    private async playSound(id: string): Promise<void> {
        const sound = this.sounds.get(id);
        if (!sound) return;

        // Stop other sounds if polyphony is disabled
        if (!this.settings.polyphonyMode) {
            this.stopAllSoundsLocal();
        }

        try {
            // Create VB Audio stream
            let vbAudio = this.audioElements.get(id);
            if (!vbAudio) {
                vbAudio = new Audio();
                vbAudio.src = `file://${sound.path}`;
                vbAudio.volume = this.settings.masterVolume;

                // Try to set VB Audio Cable as output device
                if (this.settings.outputDevice && 'setSinkId' in vbAudio) {
                    try {
                        await (vbAudio as any).setSinkId(this.settings.outputDevice);
                    } catch (e) {
                        console.warn('Failed to set VB Audio output device:', e);
                    }
                }

                vbAudio.addEventListener('ended', () => {
                    this.playingStates.set(id, false);
                    this.updateSoundPadPlayingState(id, false);
                });

                this.audioElements.set(id, vbAudio);
            }

            // Create headphones audio stream
            let headphonesAudio = this.headphonesAudioElements.get(id);
            if (!headphonesAudio) {
                headphonesAudio = new Audio();
                headphonesAudio.src = `file://${sound.path}`;
                headphonesAudio.volume = this.settings.headphonesVolume;

                // Use default output device for headphones (user's headphones/speakers)
                // Don't set setSinkId for headphones - let it use default output

                this.headphonesAudioElements.set(id, headphonesAudio);
            }

            // Play both streams simultaneously
            vbAudio.currentTime = 0;
            headphonesAudio.currentTime = 0;

            await Promise.all([
                vbAudio.play(),
                headphonesAudio.play()
            ]);

            this.playingStates.set(id, true);
            this.updateSoundPadPlayingState(id, true);

        } catch (error) {
            console.error('Error playing sound:', error);
            this.showError('Failed to play sound');
        }
    }

    private stopSound(id: string): void {
        const vbAudio = this.audioElements.get(id);
        const headphonesAudio = this.headphonesAudioElements.get(id);

        if (this.playingStates.get(id)) {
            if (vbAudio) {
                vbAudio.pause();
                vbAudio.currentTime = 0;
            }
            if (headphonesAudio) {
                headphonesAudio.pause();
                headphonesAudio.currentTime = 0;
            }
            this.playingStates.set(id, false);
            this.updateSoundPadPlayingState(id, false);
        }
    }

    private stopAllSoundsLocal(): void {
        console.log('stopAllSoundsLocal called');
        console.log('VB Audio elements:', this.audioElements.size);
        console.log('Headphones audio elements:', this.headphonesAudioElements.size);
        console.log('Playing states:', Array.from(this.playingStates.entries()));

        // Stop all VB Audio elements (regardless of tracked state)
        for (const [id, vbAudio] of this.audioElements.entries()) {
            console.log(`Stopping VB Audio for sound ${id}`);
            vbAudio.pause();
            vbAudio.currentTime = 0;
            this.playingStates.set(id, false);
            this.updateSoundPadPlayingState(id, false);
        }

        // Stop all headphones audio elements (regardless of tracked state)
        for (const [id, headphonesAudio] of this.headphonesAudioElements.entries()) {
            console.log(`Stopping headphones audio for sound ${id}`);
            headphonesAudio.pause();
            headphonesAudio.currentTime = 0;
        }

        // Stop BrowserView audio streams (identified by "browserview_" prefix)
        const browserviewIds = Array.from(this.audioElements.keys()).filter(id => id.startsWith('browserview_'));
        for (const id of browserviewIds) {
            console.log(`Stopping BrowserView audio for ${id}`);
            const vbAudio = this.audioElements.get(id);
            const headphonesAudio = this.headphonesAudioElements.get(id);

            if (vbAudio) {
                vbAudio.pause();
                this.audioElements.delete(id);
            }

            if (headphonesAudio) {
                headphonesAudio.pause();
                this.headphonesAudioElements.delete(id);
            }

            // Close audio context if it exists
            if (vbAudio && (vbAudio as any)._audioContext) {
                try {
                    (vbAudio as any)._audioContext.close();
                } catch (e) {
                    console.warn(`Failed to close audio context for ${id}:`, e);
                }
            }
        }

        console.log('All audio elements stopped');
    }

    private async showFilePicker(targetPadId?: string): Promise<void> {
        try {
            const result = await (window as any).electronAPI.soundboard.showFilePicker();
            if (!result.canceled && result.filePaths.length > 0) {
                if (result.filePaths.length === 1) {
                    // Single file - show config overlay
                    const filePath = result.filePaths[0];
                    this.showConfigOverlay(filePath, targetPadId);
                } else {
                    // Multiple files - add with default names for now
                    // TODO: Could show batch config overlay in the future
                    await this.addSoundsFromFiles(result.filePaths);
                }
            }
        } catch (error) {
            console.error('Error showing file picker:', error);
            this.showError('Failed to open file picker');
        }
    }

    private async addSoundToPad(filePath: string, padId: string): Promise<void> {
        try {
            // Find next available slot number for backend compatibility
            let slot = 1;
            while (slot <= 1000) { // Support up to 1000 sounds
                const existingSound = Array.from(this.sounds.values()).find(s => s.slot === slot);
                if (!existingSound) break;
                slot++;
            }

            const sound = await (window as any).electronAPI.soundboard.addSound(filePath, slot);
            this.sounds.set(padId, sound);
            this.updateSoundPadUI(padId);
        } catch (error) {
            console.error('Error adding sound to pad:', error);
            this.showError(`Failed to add sound: ${(error as Error).message}`);
        }
    }

    private async addSoundsFromFiles(filePaths: string[]): Promise<void> {
        try {
            const addedSounds = [];
            const errors = [];

            for (const filePath of filePaths) {
                try {
                    // Create a new pad for each sound
                    const padId = this.addNewSoundPad();
                    await this.addSoundToPad(filePath, padId);
                    addedSounds.push(filePath);
                } catch (error) {
                    errors.push({ filePath, error: (error as Error).message });
                }
            }

            if (errors.length > 0) {
                const errorMsg = `Failed to add ${errors.length} file(s). First error: ${errors[0].error}`;
                this.showError(errorMsg);
            }

            if (addedSounds.length > 0) {
                this.showSuccess(`Successfully added ${addedSounds.length} sound(s)`);
            }
        } catch (error) {
            console.error('Error adding sounds from files:', error);
            this.showError('Failed to add sounds');
        }
    }

    private showSoundPadContextMenu(id: string, x: number, y: number): void {
        const sound = this.sounds.get(id);
        if (!sound) return;

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'sound-pad-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 4px 0;
            z-index: 10000;
            min-width: 120px;
        `;

        const menuItems = [
            { text: 'Rename', action: () => this.renameSoundPrompt(id) },
            { text: 'Remove', action: () => this.removeSoundPrompt(id) },
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                color: var(--text);
            `;
            menuItem.onmouseover = () => menuItem.style.backgroundColor = 'var(--focus)';
            menuItem.onmouseout = () => menuItem.style.backgroundColor = 'transparent';
            menuItem.onclick = () => {
                item.action();
                document.body.removeChild(menu);
            };
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Remove menu on outside click
        const removeMenu = () => {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', removeMenu);
        };
        setTimeout(() => document.addEventListener('click', removeMenu), 100);
    }

    private async renameSoundPrompt(id: string): Promise<void> {
        const sound = this.sounds.get(id);
        if (!sound) return;

        const newName = prompt('Enter new name:', sound.label);
        if (newName && newName.trim() !== sound.label) {
            try {
                await (window as any).electronAPI.soundboard.renameSound(sound.slot || 0, newName.trim());
                sound.label = newName.trim();
                this.updateSoundPadUI(id);
            } catch (error) {
                console.error('Error renaming sound:', error);
                this.showError('Failed to rename sound');
            }
        }
    }

    private async removeSoundPrompt(id: string): Promise<void> {
        const sound = this.sounds.get(id);
        if (!sound) return;

        if (confirm(`Remove "${sound.label}" from the soundboard?`)) {
            try {
                await (window as any).electronAPI.soundboard.removeSound(sound.slot || 0);
                this.sounds.delete(id);
                this.playingStates.delete(id);
                this.removeSoundPad(id);
            } catch (error) {
                console.error('Error removing sound:', error);
                this.showError('Failed to remove sound');
            }
        }
    }

    private async removeSound(id: string): Promise<void> {
        await this.removeSoundPrompt(id);
    }

    private removeSoundPad(id: string): void {
        const pad = this.soundPadGrid?.querySelector(`[data-sound-id="${id}"]`);
        if (pad) {
            pad.remove();
        }
    }

    private updateSoundPadUI(id: string): void {
        const pad = this.soundPadGrid?.querySelector(`[data-sound-id="${id}"]`) as HTMLElement;
        if (!pad) return;

        const sound = this.sounds.get(id);
        const labelElement = pad.querySelector('.sound-pad-label') as HTMLElement;
        const keyElement = pad.querySelector('.sound-pad-key') as HTMLElement;

        if (sound) {
            if (labelElement) {
                labelElement.textContent = sound.label;
                labelElement.title = `${sound.label} (${this.formatDuration(sound.duration)})`;
            }
            if (keyElement) {
                keyElement.textContent = sound.hotkey || '';
            }
            pad.classList.add('has-sound');
        } else {
            if (labelElement) {
                labelElement.textContent = `Sound ${id}`;
                labelElement.title = '';
            }
            if (keyElement) {
                keyElement.textContent = '';
            }
            pad.classList.remove('has-sound', 'playing');
        }
    }

    private updateSoundPadPlayingState(id: string, isPlaying: boolean): void {
        const pad = this.soundPadGrid?.querySelector(`[data-sound-id="${id}"]`) as HTMLElement;
        if (!pad) return;

        if (isPlaying) {
            pad.classList.add('playing');
        } else {
            pad.classList.remove('playing');
        }
    }

    private async loadSettings(): Promise<void> {
        try {
            this.settings = await (window as any).electronAPI.soundboard.getSettings();

            // Update VB Audio volume UI
            if (this.volumeSlider) {
                this.volumeSlider.value = (this.settings.masterVolume * 100).toString();
            }
            if (this.volumeDisplay) {
                this.volumeDisplay.textContent = `${Math.round(this.settings.masterVolume * 100)}%`;
            }

            // Update Headphones volume UI
            if (this.headphonesVolumeSlider) {
                this.headphonesVolumeSlider.value = (this.settings.headphonesVolume * 100).toString();
            }
            if (this.headphonesVolumeDisplay) {
                this.headphonesVolumeDisplay.textContent = `${Math.round(this.settings.headphonesVolume * 100)}%`;
            }
        } catch (error) {
            console.error('Error loading soundboard settings:', error);
        }
    }

    private async loadSounds(): Promise<void> {
        try {
            const sounds: SoundEntry[] = await (window as any).electronAPI.soundboard.getAllSounds();
            console.log('Loading sounds from backend:', sounds);

            this.sounds.clear();
            sounds.forEach((sound) => {
                // Use the actual sound ID from the backend
                const id = String(sound.id);
                console.log('Adding sound with ID:', id, 'label:', sound.label);
                this.sounds.set(id, sound);

                // Create or find existing pad
                let pad = this.soundPadGrid?.querySelector(`[data-sound-id="${id}"]`) as HTMLElement;
                if (!pad) {
                    // If we have more sounds than initial pads, create new ones
                    this.createSoundPad(id, sound.hotkey);
                }
                this.updateSoundPadUI(id);
            });

            console.log('Total sounds loaded:', this.sounds.size);
        } catch (error) {
            console.error('Error loading sounds:', error);
        }
    }

    public async loadAudioDevices(): Promise<void> {
        try {
            console.log('🔊 Soundboard output device hardcoded to VB-Audio INPUT Cable');

            // Output device is hardcoded to VB-Audio Virtual Cable
            // Find the VB Audio device ID for proper audio routing
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

            console.log(`📱 Found ${audioOutputs.length} audio output devices:`, audioOutputs);

            // Find VB Audio INPUT device (this is where we want to send soundboard audio)
            const vbAudioDevice = audioOutputs.find(device => 
                device.label.includes('CABLE Input') ||
                device.label.toLowerCase().includes('cable input (vb-audio virtual cable)') ||
                device.label.toLowerCase().includes('vb-audio cable input') ||
                device.label.toLowerCase().includes('virtual cable input')
            );

            if (vbAudioDevice) {
                this.settings.outputDevice = vbAudioDevice.deviceId;
                console.log('🎯 Found and set VB Audio INPUT device:', vbAudioDevice.label);
                
                // Update the backend settings with the correct device ID
                await this.updateOutputDevice(vbAudioDevice.deviceId);
            } else {
                console.warn('⚠️ VB Audio INPUT Cable not found in available devices');
                // Keep the hardcoded setting as fallback
                this.settings.outputDevice = 'CABLE Input (VB-Audio Virtual Cable)';
            }

            // Hide the output select dropdown since it's hardcoded
            if (this.outputSelect) {
                this.outputSelect.style.display = 'none';
                const parentRow = this.outputSelect.closest('.control-row');
                if (parentRow) {
                    (parentRow as HTMLElement).style.display = 'none';
                }
            }

        } catch (error) {
            console.error('❌ Error setting up hardcoded VB Audio device:', error);
            // Fallback to hardcoded setting
            this.settings.outputDevice = 'CABLE Input (VB-Audio Virtual Cable)';
        }
    }

    private async updateVolume(volume: number): Promise<void> {
        try {
            await (window as any).electronAPI.soundboard.updateSettings({ masterVolume: volume });
            this.settings.masterVolume = volume;

            // Update volume for all VB Audio elements
            for (const audio of this.audioElements.values()) {
                audio.volume = volume;
            }

            if (this.volumeDisplay) {
                this.volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            }
        } catch (error) {
            console.error('Error updating volume:', error);
        }
    }

    private async updateHeadphonesVolume(volume: number): Promise<void> {
        try {
            await (window as any).electronAPI.soundboard.updateSettings({ headphonesVolume: volume });
            this.settings.headphonesVolume = volume;

            // Update volume for all headphones audio elements
            for (const audio of this.headphonesAudioElements.values()) {
                audio.volume = volume;
            }

            if (this.headphonesVolumeDisplay) {
                this.headphonesVolumeDisplay.textContent = `${Math.round(volume * 100)}%`;
            }
        } catch (error) {
            console.error('Error updating headphones volume:', error);
        }
    }

    /**
     * Update slider fill to show blue bar from left to current value
     */
    private updateSliderFill(slider: HTMLInputElement): void {
        if (!slider) return;
        
        const value = parseInt(slider.value) || 0;
        const min = parseInt(slider.min) || 0;
        const max = parseInt(slider.max) || 100;
        const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
        
        // Get the blue color from CSS variable or use default
        const blueColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim() || '#3b82f6';
        const trackColor = 'rgba(255, 255, 255, 0.1)';
        
        // Set the background - inline styles take precedence over CSS
        slider.style.background = `linear-gradient(to right, ${blueColor} 0%, ${blueColor} ${percentage}%, ${trackColor} ${percentage}%, ${trackColor} 100%)`;
    }

    private async updateOutputDevice(deviceId: string): Promise<void> {
        try {
            await (window as any).electronAPI.soundboard.updateSettings({ outputDevice: deviceId });
            this.settings.outputDevice = deviceId;

            // Update output device for all audio elements
            for (const audio of this.audioElements.values()) {
                if ('setSinkId' in audio) {
                    try {
                        await (audio as any).setSinkId(deviceId);
                    } catch (e) {
                        console.warn('Failed to set audio output device:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating output device:', error);
        }
    }

    // Public methods for overlay remote control
    public async playSoundById(id: string): Promise<void> {
        return this.playSound(id);
    }

    public async showFilePickerPublic(targetPadId?: string): Promise<void> {
        return this.showFilePicker(targetPadId);
    }

    public async stopAllSoundsPublic(): Promise<void> {
        return this.stopAllSounds();
    }

    public async handleSoundPadClickFromOverlay(soundId?: any, slot?: number): Promise<void> {
        console.log('🎵 Remote control: Triggering sound pad click from overlay. ID:', soundId, 'Slot:', slot);

        const normalizedId: string | undefined = (soundId !== undefined && soundId !== null) ? String(soundId) : undefined;

        // Ensure sounds are loaded
        if (this.sounds.size === 0) {
            console.log('🎵 No sounds loaded yet, loading sounds...');
            await this.loadSounds();
        }

        let padIdToUse: string | undefined = undefined;

        // Prefer lookup by exact soundId if provided
        if (normalizedId && this.sounds.has(normalizedId)) {
            padIdToUse = normalizedId;
        }

        // Fallback: resolve by slot number
        if (!padIdToUse && typeof slot === 'number') {
            const foundPadId = this.findPadIdBySlot(slot);
            if (foundPadId) {
                padIdToUse = foundPadId;
            }
        }

        // If still not found, refresh sounds once and try ID again
        if (!padIdToUse) {
            console.warn('🎵 Could not resolve sound by ID or slot. Reloading sounds to retry...');
            await this.loadSounds();
            if (soundId && this.sounds.has(soundId)) {
                padIdToUse = soundId;
            }
        }

        if (!padIdToUse) {
            console.warn('🎵 Sound not found for remote control. Skipping without prompting add-sound.');
            return;
        }

        const sound = this.sounds.get(padIdToUse);
        console.log('🎵 Resolved pad ID:', padIdToUse, 'Found sound:', !!sound);
        if (!sound) {
            console.warn('🎵 Resolved pad ID has no sound. Skipping.');
            return;
        }

        await this.handleSoundPadClick(padIdToUse);
    }

    public getSoundById(id: string): SoundEntry | undefined {
        return this.sounds.get(id);
    }

    private async stopAllSounds(): Promise<void> {
        try {
            console.log('Stopping all sounds...');
            this.stopAllSoundsLocal();
        } catch (error) {
            console.error('Error stopping all sounds:', error);
            this.showError('Failed to stop all sounds');
        }
    }

    private async toggleSoundboardOverlay(): Promise<void> {
        try {
            console.log('Toggling soundboard overlay...');
            const result = await (window as any).electronAPI.invoke('soundboard-overlay:toggle');
            if (result.success) {
                console.log('Soundboard overlay toggled successfully');
            } else {
                console.error('Failed to toggle soundboard overlay');
                this.showError('Failed to toggle web overlay');
            }
        } catch (error) {
            console.error('Error toggling soundboard overlay:', error);
            this.showError('Failed to toggle web overlay');
        }
    }

    private formatDuration(duration?: number): string {
        if (!duration) return '0:00';
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private showError(message: string): void {
        // You can integrate with existing notification system if available
        console.error('Soundboard Error:', message);
        // For now, use alert - in production you might want a better notification system
        alert(`Soundboard Error: ${message}`);
    }

    private showSuccess(message: string): void {
        console.log('Soundboard Success:', message);
        // Could show a temporary success notification
    }

    private showConfigOverlay(filePath: string, targetPadId?: string): void {
        if (!this.configOverlay || !this.soundNameInput || !this.soundHotkeyInput) return;

        // Store pending data
        this.pendingSoundData = { filePath, targetPadId };

        // Reset form
        const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'New Sound';
        this.soundNameInput.value = fileName;
        this.soundHotkeyInput.value = '';

        // Show overlay
        this.configOverlay.style.display = 'flex';
        this.soundNameInput.focus();
        this.soundNameInput.select();
    }

    private hideConfigOverlay(): void {
        if (this.configOverlay) {
            this.configOverlay.style.display = 'none';
        }
        this.pendingSoundData = null;
    }

    private captureHotkey(e: KeyboardEvent): void {
        if (!this.soundHotkeyInput) return;

        const parts: string[] = [];

        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');

        let keyName = '';

        // Handle special keys
        if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' ||
            e.key === 'F5' || e.key === 'F6' || e.key === 'F7' || e.key === 'F8' ||
            e.key === 'F9' || e.key === 'F10' || e.key === 'F11' || e.key === 'F12') {
            keyName = e.key;
        }
        // Handle numpad
        else if (e.code.startsWith('Numpad')) {
            keyName = e.code.replace('Numpad', 'Num ');
        }
        else if (e.code.startsWith('Digit')) {
            keyName = e.key;
        }
        else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
            keyName = e.key.toUpperCase();
        }
        // Handle other special keys
        else if (e.key === 'Space') {
            keyName = 'Space';
        }
        else if (e.key === 'Enter') {
            keyName = 'Enter';
        }
        else if (e.key === 'Tab') {
            keyName = 'Tab';
        }
        else if (e.key === 'Escape') {
            keyName = 'Escape';
        }
        else {
            // Skip modifier-only keys
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                return;
            }
            keyName = e.key;
        }

        if (keyName) {
            parts.push(keyName);
            this.soundHotkeyInput.value = parts.join('+');
        }
    }

    private formatHotkeyFromEvent(e: KeyboardEvent): string | null {
        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');

        let keyName = '';

        // Function keys
        if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' ||
            e.key === 'F5' || e.key === 'F6' || e.key === 'F7' || e.key === 'F8' ||
            e.key === 'F9' || e.key === 'F10' || e.key === 'F11' || e.key === 'F12') {
            keyName = e.key;
        }
        // Numpad keys
        else if (e.code.startsWith('Numpad')) {
            keyName = e.code.replace('Numpad', 'Num ');
        }
        // Top row digits
        else if (e.code.startsWith('Digit')) {
            keyName = e.key;
        }
        // Letters and digits
        else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
            keyName = e.key.toUpperCase();
        }
        // Other named keys
        else if (e.key === 'Space' || e.code === 'Space') {
            keyName = 'Space';
        }
        else if (e.key === 'Enter' || e.code === 'Enter') {
            keyName = 'Enter';
        }
        else if (e.key === 'Tab' || e.code === 'Tab') {
            keyName = 'Tab';
        }
        else if (e.key === 'Escape' || e.code === 'Escape') {
            keyName = 'Escape';
        } else {
            // Ignore pure modifier keys and unknowns
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
            keyName = e.key;
        }

        if (!keyName) return null;
        parts.push(keyName);
        return parts.join('+');
    }

    private async saveSound(): Promise<void> {
        if (!this.pendingSoundData || !this.soundNameInput || !this.soundHotkeyInput) return;

        const soundName = this.soundNameInput.value.trim();
        if (!soundName) {
            this.showError('Please enter a sound name');
            return;
        }

        const hotkey = this.soundHotkeyInput.value.trim();

        try {
            // Check if hotkey is already in use (if provided)
            if (hotkey) {
                for (const sound of this.sounds.values()) {
                    if (sound.hotkey === hotkey) {
                        this.showError(`Hotkey "${hotkey}" is already in use by "${sound.label}"`);
                        return;
                    }
                }
            }

            const { filePath, targetPadId } = this.pendingSoundData;

            if (targetPadId) {
                // Add to specific pad
                await this.addSoundToPadWithConfig(filePath, targetPadId, soundName, hotkey);
            } else {
                // Add to new pad
                await this.addSoundWithConfig(filePath, soundName, hotkey);
            }

            this.hideConfigOverlay();
            this.showSuccess(`Sound "${soundName}" added successfully!`);

        } catch (error) {
            console.error('Error saving sound:', error);
            this.showError('Failed to save sound. Please try again.');
        }
    }

    private async addSoundWithConfig(filePath: string, name: string, hotkey: string): Promise<void> {
        try {
            // Find next available slot number
            let slot = 1;
            while (slot <= 1000) {
                const existingSound = Array.from(this.sounds.values()).find(s => s.slot === slot);
                if (!existingSound) break;
                slot++;
            }

            const sound = await (window as any).electronAPI.soundboard.addSound(filePath, slot);

            // Update the sound with custom name and hotkey
            if (sound) {
                await (window as any).electronAPI.soundboard.renameSound(slot, name);
                sound.label = name;
                sound.hotkey = hotkey;
                if (hotkey) {
                    try { await (window as any).electronAPI.soundboard.updateHotkey(slot, hotkey); } catch { }
                }

                const id = this.generateSoundPadId();
                this.sounds.set(id, sound);
                this.createSoundPad(id, hotkey);
                this.updateSoundPadUI(id);
            }

        } catch (error) {
            console.error('Error adding sound with config:', error);
            throw error;
        }
    }

    private async addSoundToPadWithConfig(filePath: string, padId: string, name: string, hotkey: string): Promise<void> {
        try {
            // Find slot for this pad or get next available
            let slot = parseInt(padId) || 1;
            while (slot <= 1000) {
                const existingSound = Array.from(this.sounds.values()).find(s => s.slot === slot);
                if (!existingSound) break;
                slot++;
            }

            const sound = await (window as any).electronAPI.soundboard.addSound(filePath, slot);

            // Update with custom config
            if (sound) {
                await (window as any).electronAPI.soundboard.renameSound(slot, name);
                sound.label = name;
                sound.hotkey = hotkey;
                if (hotkey) {
                    try { await (window as any).electronAPI.soundboard.updateHotkey(slot, hotkey); } catch { }
                }

                this.sounds.set(padId, sound);
                this.updateSoundPadUI(padId);
            }

        } catch (error) {
            console.error('Error adding sound to pad with config:', error);
            throw error;
        }
    }

    private generateSoundPadId(): string {
        return `sound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Route BrowserView audio through the soundboard's audio processing system
     */
    async routeBrowserViewAudio(audioStream: MediaStream, streamId: string): Promise<void> {
        try {
            console.log('🎵 Routing BrowserView audio through soundboard system:', streamId);

            // Create audio context for routing the BrowserView audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create source from the BrowserView audio stream
            const sourceNode = audioContext.createMediaStreamSource(audioStream);
            const vbGainNode = audioContext.createGain();
            const headphonesGainNode = audioContext.createGain();

            // Create destinations for VB Audio and headphones
            const vbDestination = audioContext.createMediaStreamDestination();
            const headphonesDestination = audioContext.createMediaStreamDestination();

            // Connect the audio graph - route the BrowserView audio to both outputs
            sourceNode.connect(vbGainNode);
            sourceNode.connect(headphonesGainNode);
            vbGainNode.connect(vbDestination);
            headphonesGainNode.connect(headphonesDestination);

            // Store references to gain nodes for volume updates
            this.browserViewVbGainNode = vbGainNode;
            this.browserViewHeadphonesGainNode = headphonesGainNode;

            // Set volumes from soundboard settings
            vbGainNode.gain.value = this.settings.masterVolume;
            headphonesGainNode.gain.value = this.settings.headphonesVolume;

            // Create audio elements for both outputs
            const vbAudio = new Audio();
            vbAudio.srcObject = vbDestination.stream;

            const headphonesAudio = new Audio();
            headphonesAudio.srcObject = headphonesDestination.stream;

            // VB volume can be full; we'll only play it if sink routing succeeds
            vbAudio.volume = 1.0;
            headphonesAudio.volume = 1.0;

            // Store references for cleanup
            this.audioElements.set(streamId, vbAudio);
            this.headphonesAudioElements.set(streamId, headphonesAudio);

            // Set audio context reference for cleanup
            (vbAudio as any)._audioContext = audioContext;
            (headphonesAudio as any)._audioContext = audioContext;

            // Set VB-Audio output device if available; only play VB if routing succeeds
            let vbReadyForPlayback = false;
            if (this.settings.outputDevice && 'setSinkId' in vbAudio) {
                try {
                    await (vbAudio as any).setSinkId(this.settings.outputDevice);
                    vbReadyForPlayback = true;
                    console.log('🎵 VB-Audio device set for BrowserView audio');
                } catch (e) {
                    console.warn('🎵 Failed to set VB-Audio output device:', e);
                }
            }

            // Start playback (VB only if properly routed)
            if (vbReadyForPlayback) {
                await vbAudio.play();
            }
            await headphonesAudio.play();

            console.log('🎵 BrowserView audio routed successfully through soundboard system');

        } catch (error) {
            console.error('🎵 Error routing BrowserView audio through soundboard:', error);
            throw error;
        }
    }
}

/**
 * Initialize soundboard manager when needed
 */
export function initializeSoundboardManager(): SoundboardManager | null {
    try {
        const manager = new SoundboardManager();
        console.log('✅ Soundboard manager initialized');
        return manager;
    } catch (error) {
        console.error('❌ Failed to initialize soundboard manager:', error);
        return null;
    }
}

/**
 * Setup soundboard event listeners for overlay remote control
 */
export function setupSoundboardOverlayListeners(soundboardManager: SoundboardManager | null): void {
    // Listen for soundboard commands from overlay (remote control behavior)
    (window as any).electronAPI?.on?.('soundboard:play-sound-from-overlay', async (_event: any, data: any) => {
        try {
            console.log('🎵 Remote control: Triggering sound pad click from overlay for sound ID:', data.soundId);

            // Soundboard manager should already be initialized during app startup
            if (!soundboardManager) {
                console.warn('🎵 Soundboard manager not initialized - initializing now');
                soundboardManager = initializeSoundboardManager();
            }

            if (soundboardManager) {
                // Trigger the same click handler that the main app's sound pad uses (pass id and slot)
                await soundboardManager.handleSoundPadClickFromOverlay(data.soundId, data.slot);
                console.log('🎵 Remote control: Sound pad click triggered successfully');
            }
        } catch (error) {
            console.error('🎵 Error triggering sound pad click from overlay:', error);
        }
    });

    (window as any).electronAPI?.on?.('soundboard:show-file-picker-from-overlay', (_event: any) => {
        try {
            console.log('🎵 Remote control: Showing file picker from overlay');
            // Trigger the add sound button click
            const addSoundButton = document.getElementById('add-sound-button') as HTMLButtonElement;
            if (addSoundButton) {
                console.log('🎵 Remote control: Clicking add sound button');
                addSoundButton.click();
            } else {
                console.warn('🎵 Remote control: Add sound button not found, using fallback');
                // Soundboard manager should already be initialized during app startup
                if (!soundboardManager) {
                    console.warn('🎵 Soundboard manager not initialized - initializing now');
                    soundboardManager = initializeSoundboardManager();
                }
                if (soundboardManager) {
                    soundboardManager.showFilePickerPublic();
                }
            }
        } catch (error) {
            console.error('🎵 Error showing file picker from overlay:', error);
        }
    });

    (window as any).electronAPI?.on?.('soundboard:stop-all-sounds-from-overlay', (_event: any) => {
        try {
            console.log('🎵 Remote control: Stopping all sounds from overlay');
            // Soundboard manager should already be initialized during app startup
            if (!soundboardManager) {
                console.warn('🎵 Soundboard manager not initialized - initializing now');
                soundboardManager = initializeSoundboardManager();
            }
            // Trigger the stop all button click
            const stopAllButton = document.getElementById('stop-all-sounds-button') as HTMLButtonElement;
            if (stopAllButton) {
                console.log('🎵 Remote control: Clicking stop all button');
                stopAllButton.click();
            } else {
                console.warn('🎵 Remote control: Stop all button not found, using fallback');
                if (soundboardManager) {
                    soundboardManager.stopAllSoundsPublic();
                }
            }
        } catch (error) {
            console.error('🎵 Error stopping sounds from overlay:', error);
        }
    });
}

/**
 * Inject soundboard CSS styles
 */
export function injectSoundboardCSS(): void {
    const soundboardCSS = `
.sound-pad.has-sound {
    border-color: var(--focus);
}

.sound-pad.playing {
    background: linear-gradient(45deg, var(--focus), var(--panel));
    animation: pulse 1s infinite alternate;
}

@keyframes pulse {
    from { opacity: 0.8; }
    to { opacity: 1; }
}

.drag-over {
    background: rgba(64, 192, 255, 0.1);
    border: 2px dashed var(--focus);
}

.sound-pad-context-menu {
    font-family: inherit;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.context-menu-item {
    transition: background-color 0.2s;
}

/* Scrollable sound pad container */
#sound-pad-container {
    scrollbar-width: thin;
    scrollbar-color: var(--focus) var(--panel);
}

#sound-pad-container::-webkit-scrollbar {
    width: 6px;
}

#sound-pad-container::-webkit-scrollbar-track {
    background: var(--panel);
    border-radius: 3px;
}

#sound-pad-container::-webkit-scrollbar-thumb {
    background: var(--focus);
    border-radius: 3px;
}

#sound-pad-container::-webkit-scrollbar-thumb:hover {
    background: #5a9fd4;
}
`;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = soundboardCSS;
    document.head.appendChild(style);
}
