/**
 * Bidirectional UI Management
 * Handles DOM elements, event handlers, and UI updates for bidirectional mode
 */

import {
    bidirectionalKeybind,
    bidirectionalSourceLanguage,
    bidirectionalTargetLanguage,
    incomingVoiceId,
    selectedProcessName,
    bidirectionalOutputDeviceId,
    isBidirectionalActive,
    setBidirectionalKeybind,
    setIncomingVoiceId,
    setBidirectionalOutputDeviceId,
    setSelectedProcessName,
    setIsInitializingBidirectional,
    isInitializingBidirectional
} from './BidirectionalState.js';

import { updateBidirectionalKeybindDisplay } from '../translationHelpers.js';
import { getTranslatedBidirectionalButtonText } from '../translationHelpers.js';

// Platform detection
const isMac = (window as any).electronAPI?.platform === 'darwin';

// DOM Element References
let sidebarBidirectionalButton: HTMLButtonElement | null = null;
let bidirectionalPanel: HTMLDivElement | null = null;
let bidirectionalToggleButton: HTMLButtonElement | null = null;
let bidirectionalStatusIndicator: HTMLElement | null = null;
let bidirectionalRecordingDot: HTMLElement | null = null;
let bidirectionalStatusText: HTMLSpanElement | null = null;
let bidirectionalDetectedText: HTMLDivElement | null = null;
let bidirectionalRespokenText: HTMLDivElement | null = null;
let bidirectionalKeybindSpan: HTMLSpanElement | null = null;
let bidirectionalKeybindDisplay: HTMLElement | null = null;
let bidirectionalChangeKeybindBtn: HTMLButtonElement | null = null;
let bidirectionalOutputSelect: HTMLSelectElement | null = null;
let bidirectionalProcessSelect: HTMLSelectElement | null = null;
let bidirectionalRefreshProcessesBtn: HTMLButtonElement | null = null;
let bidirectionalSourceLanguageSelect: HTMLSelectElement | null = null;
let bidirectionalTargetLanguageSelect: HTMLSelectElement | null = null;
let incomingVoiceSelect: HTMLSelectElement | null = null;
let bidirectionalCaptionsToggle: HTMLButtonElement | null = null;
let bidirectionalCaptionsSettings: HTMLButtonElement | null = null;

// Shared state (injected from renderer)
let currentLanguage: string = 'en';

/**
 * Initialize bidirectional UI with DOM elements
 */
export function initializeBidirectionalUI(lang: string = 'en'): void {
    currentLanguage = lang;

    // Get all DOM elements
    sidebarBidirectionalButton = document.getElementById('sidebar-bidirectional-button') as HTMLButtonElement | null;
    bidirectionalPanel = document.getElementById('bidirectional-panel') as HTMLDivElement | null;
    bidirectionalToggleButton = document.getElementById('bidirectional-toggle-button') as HTMLButtonElement | null;
    bidirectionalStatusIndicator = document.getElementById('bidirectional-status-indicator') as HTMLElement | null;
    bidirectionalRecordingDot = document.getElementById('bidirectional-recording-dot') as HTMLElement | null;
    bidirectionalStatusText = document.getElementById('bidirectional-status') as HTMLSpanElement | null;
    bidirectionalDetectedText = document.getElementById('bidirectional-detected-text') as HTMLDivElement | null;
    bidirectionalRespokenText = document.getElementById('bidirectional-respoken-text') as HTMLDivElement | null;
    bidirectionalKeybindSpan = document.getElementById('bidirectional-current-keybind') as HTMLSpanElement | null;
    bidirectionalKeybindDisplay = document.getElementById('bidirectional-keybind-display') as HTMLElement | null;
    bidirectionalChangeKeybindBtn = document.getElementById('bidirectional-change-keybind-btn') as HTMLButtonElement | null;
    bidirectionalOutputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement | null;
    bidirectionalProcessSelect = document.getElementById('bidirectional-process-select') as HTMLSelectElement | null;
    bidirectionalRefreshProcessesBtn = document.getElementById('bidirectional-refresh-processes') as HTMLButtonElement | null;
    bidirectionalSourceLanguageSelect = document.getElementById('bidirectional-source-language') as HTMLSelectElement | null;
    bidirectionalTargetLanguageSelect = document.getElementById('bidirectional-target-language') as HTMLSelectElement | null;
    incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement | null;
    bidirectionalCaptionsToggle = document.getElementById('bidirectional-captions-toggle') as HTMLButtonElement | null;
    bidirectionalCaptionsSettings = document.getElementById('bidirectional-captions-settings') as HTMLButtonElement | null;

    // Apply Mac-specific styling (greyed out with coming soon)
    if (isMac) {
        applyMacBidirectionalRestrictions();
    }

    console.log('✅ Bidirectional UI initialized');
}

/**
 * Apply Mac-specific restrictions to bidirectional feature
 * Greys out the sidebar button and shows "Coming Soon" message
 */
function applyMacBidirectionalRestrictions(): void {
    // Grey out sidebar button
    if (sidebarBidirectionalButton) {
        sidebarBidirectionalButton.style.opacity = '0.5';
        sidebarBidirectionalButton.style.cursor = 'not-allowed';
        sidebarBidirectionalButton.title = 'Bidirectional - Coming Soon on macOS';
        
        // Add "Coming Soon" badge to the button
        const label = sidebarBidirectionalButton.querySelector('.label');
        if (label) {
            label.innerHTML = 'Bidirectional <span style="font-size: 9px; background: rgba(255,165,0,0.3); padding: 1px 4px; border-radius: 3px; margin-left: 4px;">Soon</span>';
        }
    }

    // Add coming soon overlay to the panel
    if (bidirectionalPanel) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'bidirectional-mac-overlay';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: inherit;
            backdrop-filter: blur(4px);
        `;
        overlay.innerHTML = `
            <div style="text-align: center; color: white; padding: 2rem;">
                <div style="font-size: 48px; margin-bottom: 1rem;">🚧</div>
                <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600;">Coming Soon on macOS</h2>
                <p style="margin: 0; opacity: 0.8; font-size: 0.95rem; max-width: 300px;">
                    Bidirectional translation is currently only available on Windows. 
                    macOS support is in development.
                </p>
            </div>
        `;

        // Make panel position relative for overlay positioning
        bidirectionalPanel.style.position = 'relative';
        bidirectionalPanel.appendChild(overlay);
    }

    // Disable the toggle button
    if (bidirectionalToggleButton) {
        bidirectionalToggleButton.disabled = true;
        bidirectionalToggleButton.style.opacity = '0.5';
        bidirectionalToggleButton.style.cursor = 'not-allowed';
    }

    console.log('🍎 Mac bidirectional restrictions applied');
}

/**
 * Check if bidirectional is available on current platform
 */
export function isBidirectionalAvailable(): boolean {
    return !isMac;
}

/**
 * Update current language for UI translations
 */
export function updateUILanguage(lang: string): void {
    currentLanguage = lang;
}

/**
 * Get DOM element references for use by other modules
 */
export function getBidirectionalDOMElements() {
    return {
        sidebarBidirectionalButton,
        bidirectionalPanel,
        bidirectionalToggleButton,
        bidirectionalStatusIndicator,
        bidirectionalRecordingDot,
        bidirectionalStatusText,
        bidirectionalDetectedText,
        bidirectionalRespokenText,
        bidirectionalKeybindSpan,
        bidirectionalKeybindDisplay,
        bidirectionalChangeKeybindBtn,
        bidirectionalOutputSelect,
        bidirectionalProcessSelect,
        bidirectionalRefreshProcessesBtn,
        bidirectionalSourceLanguageSelect,
        bidirectionalTargetLanguageSelect,
        incomingVoiceSelect,
        bidirectionalCaptionsToggle,
        bidirectionalCaptionsSettings
    };
}

/**
 * Get the selected source language for bidirectional mode
 */
export function getBidirectionalSourceLanguage(): string {
    if (!bidirectionalSourceLanguageSelect) return bidirectionalSourceLanguage;
    const selectedValue = bidirectionalSourceLanguageSelect.value;
    return selectedValue === 'auto' ? 'auto' : selectedValue;
}

/**
 * Get the selected target language for bidirectional mode
 */
export function getBidirectionalTargetLanguage(): string {
    if (!bidirectionalTargetLanguageSelect) return bidirectionalTargetLanguage;
    return bidirectionalTargetLanguageSelect.value || bidirectionalTargetLanguage;
}

/**
 * Set bidirectional status and update UI indicators
 */
export function setBidirectionalStatus(active: boolean): void {
    console.log('🔄 Setting bidirectional status:', active, 'Language:', currentLanguage);

    if (bidirectionalStatusIndicator) {
        bidirectionalStatusIndicator.classList.toggle('active', active);
    }
    if (bidirectionalRecordingDot) {
        bidirectionalRecordingDot.classList.toggle('active', active);
    }
    if (bidirectionalStatusText) {
        // Use translated status messages
        const translations = {
            'en': { status: { listening: 'Listening...', idle: 'Idle' } },
            'es': { status: { listening: 'Escuchando...', idle: 'Inactivo' } },
            'ru': { status: { listening: 'Прослушивание...', idle: 'Ожидание' } },
            'zh': { status: { listening: '正在监听...', idle: '空闲' } },
            'ja': { status: { listening: '聴取中...', idle: '待機中' } }
        };
        const langTranslations = translations[currentLanguage as keyof typeof translations] || translations['en'];
        const newStatusText = active ? langTranslations.status.listening : langTranslations.status.idle;
        console.log('📝 Setting status text to:', newStatusText);
        bidirectionalStatusText.textContent = newStatusText;
    }
    // Update whispra bidirectional status on glass card
    const whispraBidirectionalStatus = document.getElementById('whispra-bidirectional-status') as HTMLSpanElement | null;
    if (whispraBidirectionalStatus) {
        whispraBidirectionalStatus.textContent = active ? 'Running' : 'Idle';
    }
    if (bidirectionalToggleButton) {
        bidirectionalToggleButton.textContent = getTranslatedBidirectionalButtonText(currentLanguage, active);
        if (!active) bidirectionalToggleButton.classList.remove('active');
        else bidirectionalToggleButton.classList.add('active');
    }
}

/**
 * Show keybind change modal
 */
export function showBidirectionalKeybindModal(): void {
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex;align-items:center;justify-content:center; z-index:1000;`;
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:1.5rem;border-radius:8px;max-width:90%;width:380px;text-align:center;color:black;';
    content.innerHTML = `<h3 style="margin:0 0 1rem">Change Bidirectional Keybind</h3><p>Press <strong>Alt</strong> + <strong>any key</strong></p><p style="font-size:0.9rem;color:#555;">Press Escape to cancel</p>`;
    modal.appendChild(content);
    document.body.appendChild(modal);

    const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handler);
            return;
        }
        if (e.altKey && e.code && e.code.startsWith('Key')) {
            e.preventDefault();
            const newKeybind = e.code;
            setBidirectionalKeybind(newKeybind);

            // Update UI
            updateBidirectionalKeybindDisplay(newKeybind, bidirectionalKeybindSpan, bidirectionalKeybindDisplay);

            // Save to config
            (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { uiSettings: { bidirectionalKeybind: newKeybind } }
            }).catch((err: any) => console.error('Failed to save bidirectional keybind:', err));

            document.body.removeChild(modal);
            document.removeEventListener('keydown', handler);
        }
    };
    document.addEventListener('keydown', handler);
}

/**
 * Handle bidirectional process change
 */
export async function onBidirectionalProcessChange(): Promise<void> {
    if (!bidirectionalProcessSelect) return;
    const newProcessName = bidirectionalProcessSelect.value || null;
    setSelectedProcessName(newProcessName);
    console.log('🎯 Bidirectional process changed to:', newProcessName);
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { selectedProcessName: newProcessName } }
        });
    } catch (error) {
        console.error('❌ Failed to save selected process:', error);
    }
}

/**
 * Handle bidirectional output device change
 */
export async function onBidirectionalOutputChange(): Promise<void> {
    if (!bidirectionalOutputSelect) return;

    const newOutputDeviceId = bidirectionalOutputSelect.value || null;
    setBidirectionalOutputDeviceId(newOutputDeviceId);

    console.log('🔊 Bidirectional output changed to:', newOutputDeviceId);

    // If bidirectional is active, need to restart WASAPI with new output
    if (isBidirectionalActive) {
        console.log('🔄 Bidirectional is active, will need manual restart for output change to take effect');
    }

    // Don't save during initialization
    if (isInitializingBidirectional) {
        console.log('⏭️ Skipping save during initialization');
        return;
    }

    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalOutputDeviceId: newOutputDeviceId } }
        });
        console.log('💾 Bidirectional output device saved');
    } catch (error) {
        console.error('❌ Failed to save bidirectional output device:', error);
    }
}

/**
 * Handle bidirectional source language change
 */
export async function onBidirectionalSourceLanguageChange(): Promise<void> {
    if (!bidirectionalSourceLanguageSelect) return;

    // Don't save during initialization
    if (isInitializingBidirectional) {
        console.log('⏭️ Skipping save during initialization');
        return;
    }

    const newSourceLanguage = bidirectionalSourceLanguageSelect.value || 'auto';
    console.log('🌍 Bidirectional source language changed to:', newSourceLanguage);

    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalSourceLanguage: newSourceLanguage } }
        });
        console.log('💾 Bidirectional source language saved');
    } catch (error) {
        console.error('❌ Failed to save bidirectional source language:', error);
    }
}

/**
 * Handle bidirectional target language change
 */
export async function onBidirectionalTargetLanguageChange(): Promise<void> {
    if (!bidirectionalTargetLanguageSelect) return;

    // Don't save during initialization
    if (isInitializingBidirectional) {
        console.log('⏭️ Skipping save during initialization');
        return;
    }

    const newTargetLanguage = bidirectionalTargetLanguageSelect.value || 'en';
    console.log('🌍 Bidirectional target language changed to:', newTargetLanguage);

    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalTargetLanguage: newTargetLanguage } }
        });
        console.log('💾 Bidirectional target language saved');

        // Refresh incoming voices when target language changes
        console.log('🔄 Refreshing incoming voices for new target language...');
        if ((window as any).loadIncomingVoices) {
            await (window as any).loadIncomingVoices();
        }
        if ((window as any).loadWhispraBidirectionalIncomingVoices) {
            await (window as any).loadWhispraBidirectionalIncomingVoices();
        }
    } catch (error) {
        console.error('❌ Failed to save bidirectional target language:', error);
    }
}

/**
 * Handle incoming voice change
 */
export async function onIncomingVoiceChange(): Promise<void> {
    if (!incomingVoiceSelect) return;
    setIncomingVoiceId(incomingVoiceSelect.value || null);
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { incomingVoiceId: incomingVoiceSelect.value || null } }
        });
    } catch { }
}

/**
 * Setup event listeners for bidirectional UI elements
 * Should be called after DOM elements are initialized
 */
export function setupBidirectionalEventListeners(
    onToggleBidirectional: () => void,
    onRefreshProcesses: () => void,
    onCaptionsToggle: () => void,
    onCaptionsSettings: () => void
): void {
    // Toggle button
    if (bidirectionalToggleButton) {
        bidirectionalToggleButton.addEventListener('click', onToggleBidirectional);
    }

    // Change keybind button
    if (bidirectionalChangeKeybindBtn) {
        bidirectionalChangeKeybindBtn.addEventListener('click', showBidirectionalKeybindModal);
    }

    // Output device
    if (bidirectionalOutputSelect) {
        bidirectionalOutputSelect.addEventListener('change', onBidirectionalOutputChange);
    }

    // Process selection
    if (bidirectionalProcessSelect) {
        bidirectionalProcessSelect.addEventListener('change', onBidirectionalProcessChange);
    }

    // Refresh processes button
    if (bidirectionalRefreshProcessesBtn) {
        bidirectionalRefreshProcessesBtn.addEventListener('click', onRefreshProcesses);
    }

    // Language selects
    if (bidirectionalSourceLanguageSelect) {
        bidirectionalSourceLanguageSelect.addEventListener('change', onBidirectionalSourceLanguageChange);
    }

    if (bidirectionalTargetLanguageSelect) {
        bidirectionalTargetLanguageSelect.addEventListener('change', onBidirectionalTargetLanguageChange);
    }

    // Voice select
    if (incomingVoiceSelect) {
        incomingVoiceSelect.addEventListener('change', onIncomingVoiceChange);
    }

    // Captions
    if (bidirectionalCaptionsToggle) {
        bidirectionalCaptionsToggle.addEventListener('click', onCaptionsToggle);
    }

    if (bidirectionalCaptionsSettings) {
        bidirectionalCaptionsSettings.addEventListener('click', onCaptionsSettings);
    }

    console.log('✅ Bidirectional event listeners setup complete');
}
