/**
 * Bidirectional Captions Management
 * Handles captions overlay display and settings for bidirectional mode
 */

import {
    bidirectionalCaptionsEnabled,
    captionsSettings,
    setBidirectionalCaptionsEnabled,
    setCaptionsSettings
} from './BidirectionalState.js';

import { showCaptionsSettingsModal as showCaptionsModalExtracted } from '../modals/CaptionsSettingsModal.js';

// DOM element references (injected from UI module)
let bidirectionalCaptionsToggle: HTMLButtonElement | null = null;
let bidirectionalCaptionsSettings: HTMLButtonElement | null = null;

/**
 * Initialize captions module with DOM element references
 */
export function initializeCaptionsModule(
    captionsToggleBtn: HTMLButtonElement | null,
    captionsSettingsBtn: HTMLButtonElement | null
): void {
    bidirectionalCaptionsToggle = captionsToggleBtn;
    bidirectionalCaptionsSettings = captionsSettingsBtn;
}

/**
 * Toggle bidirectional captions on/off
 */
export async function toggleBidirectionalCaptions(): Promise<void> {
    const newState = !bidirectionalCaptionsEnabled;
    setBidirectionalCaptionsEnabled(newState);

    // Update the enabled state in captionsSettings
    captionsSettings.enabled = newState;

    // Update captions overlay - send ONLY the enabled flag to avoid overwriting saved settings
    try {
        await (window as any).electronAPI.invoke('captions:updateSettings', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { enabled: newState }
        });
    } catch (error) {
        console.error('❌ Failed to update captions overlay:', error);
    }

    // Save the enabled state to config so it persists
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                uiSettings: {
                    captionsSettings: {
                        ...captionsSettings,
                        enabled: newState
                    }
                }
            }
        });
        console.log(`📺 Captions ${newState ? 'enabled' : 'disabled'} and saved to config`);
    } catch (error) {
        console.error('❌ Failed to save captions enabled state to config:', error);
    }

    updateBidirectionalCaptionsToggle();

    // Test captions when enabled
    if (newState) {
        // Reset chunks when enabling captions
        try {
            await (window as any).electronAPI.invoke('captions:resetChunks', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {}
            });
            console.log('📺 Captions chunks reset when enabling captions');
        } catch (error) {
            console.error('❌ Failed to reset captions chunks:', error);
        }

        console.log('🎬 Testing captions - sending test message');
        await updateCaptions('Test caption - captions are now enabled!');
    }
}

/**
 * Update captions toggle button appearance
 */
export function updateBidirectionalCaptionsToggle(): void {
    if (!bidirectionalCaptionsToggle || !bidirectionalCaptionsSettings) return;

    const iconHtml = '<i data-lucide="captions" style="width: 16px; height: 16px;"></i>';
    bidirectionalCaptionsToggle.innerHTML = `${iconHtml} Captions: ${bidirectionalCaptionsEnabled ? 'ON' : 'OFF'}`;

    // Update button styling based on state
    if (bidirectionalCaptionsEnabled) {
        bidirectionalCaptionsToggle.style.background = 'var(--focus)';
        bidirectionalCaptionsToggle.style.color = 'var(--text-on-focus)';
    } else {
        bidirectionalCaptionsToggle.style.background = 'var(--panel)';
        bidirectionalCaptionsToggle.style.color = 'var(--text)';
    }

    // Show/hide settings button
    bidirectionalCaptionsSettings.style.display = bidirectionalCaptionsEnabled ? 'block' : 'none';

    // Re-initialize Lucide icons for the updated content
    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }
    
    // Also update whispra translate captions toggle if it exists
    const whispraCaptionsToggle = document.getElementById('whispra-bidirectional-captions-toggle') as HTMLButtonElement;
    const whispraCaptionsSettings = document.getElementById('whispra-bidirectional-captions-settings') as HTMLButtonElement;
    
    if (whispraCaptionsToggle) {
        whispraCaptionsToggle.textContent = `Captions: ${bidirectionalCaptionsEnabled ? 'ON' : 'OFF'}`;
        
        // Update button styling based on state
        if (bidirectionalCaptionsEnabled) {
            whispraCaptionsToggle.style.background = 'var(--focus)';
            whispraCaptionsToggle.style.color = 'var(--text-on-focus)';
        } else {
            whispraCaptionsToggle.style.background = 'rgba(255, 255, 255, 0.05)';
            whispraCaptionsToggle.style.color = 'var(--text)';
        }
        
        // Show/hide settings button
        if (whispraCaptionsSettings) {
            whispraCaptionsSettings.style.display = bidirectionalCaptionsEnabled ? 'flex' : 'none';
        }
        
        // Re-initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
}

/**
 * Show captions settings modal
 * Delegates to the extracted modal component
 */
export async function showCaptionsSettingsModal(): Promise<void> {
    console.log('🎨 captionsSettings from state:', captionsSettings);

    // Guard against undefined captionsSettings
    if (!captionsSettings) {
        console.error('❌ captionsSettings is undefined! Bidirectional tab may not be initialized.');
        alert('Please switch to the Bidirectional tab first to initialize caption settings.');
        return;
    }

    console.log('🎨 Opening captions modal with settings:', JSON.stringify(captionsSettings, null, 2));
    console.log('🎨 textColor before modal:', captionsSettings.textColor);
    console.log('🎨 background before modal:', captionsSettings.background);
    console.log('🎨 fontSize before modal:', captionsSettings.fontSize);
    console.log('🎨 captionsOnly before modal:', captionsSettings.captionsOnly);

    await showCaptionsModalExtracted(captionsSettings);

    // After modal closes, reload settings from config to get the saved values
    console.log('🎨 Reloading caption settings from config after modal closed...');
    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload?.uiSettings?.captionsSettings) {
            const loadedSettings = response.payload.uiSettings.captionsSettings;
            console.log('🎨 Loaded settings from config:', JSON.stringify(loadedSettings, null, 2));

            // Update the state with the loaded settings
            setCaptionsSettings({
                enabled: captionsSettings.enabled, // Keep current enabled state
                textColor: loadedSettings.textColor || 'white',
                background: loadedSettings.background || 'none',
                fontSize: loadedSettings.fontSize || 'medium',
                captionsOnly: loadedSettings.captionsOnly || false
            });
            console.log('✅ Caption settings reloaded from config');
        }
    } catch (error) {
        console.error('❌ Failed to reload caption settings:', error);
    }
}

/**
 * Send text to captions overlay
 */
export async function updateCaptions(text: string): Promise<void> {
    console.log('🎬 updateCaptions called with:', text);
    console.log('🎬 bidirectionalCaptionsEnabled:', bidirectionalCaptionsEnabled);

    if (!bidirectionalCaptionsEnabled) {
        console.log('🎬 Captions disabled, skipping');
        return;
    }

    try {
        console.log('🎬 Sending captions to overlay manager');
        await (window as any).electronAPI.invoke('captions:updateText', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { text }
        });
        console.log('🎬 Captions sent successfully');
    } catch (error) {
        console.error('❌ Failed to update captions:', error);
    }
}

/**
 * Clear captions overlay
 */
export async function clearCaptions(): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('captions:clear', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {}
        });
    } catch (error) {
        console.error('❌ Failed to clear captions:', error);
    }
}
