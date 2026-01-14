/**
 * Shows the caption settings modal for configuring caption appearance
 */
import { setCaptionsSettings } from '../bidirectional/BidirectionalState.js';

export async function showCaptionsSettingsModal(
    captionsSettings: {
        enabled?: boolean;
        textColor: 'white' | 'black';
        background: 'none' | 'white' | 'black';
        fontSize: 'small' | 'medium' | 'large' | 'xlarge';
        captionsOnly?: boolean;
    }
): Promise<void> {
    console.log('🔥🔥🔥 MODAL RECEIVED captionsSettings:', JSON.stringify(captionsSettings, null, 2));
    console.log('🔥 textColor:', captionsSettings.textColor);
    console.log('🔥 background:', captionsSettings.background);
    console.log('🔥 fontSize:', captionsSettings.fontSize);
    console.log('🔥 captionsOnly:', captionsSettings.captionsOnly);

    // Show captions overlay temporarily for positioning
    try {
        await (window as any).electronAPI.invoke('captions:showForSettings', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {}
        });
    } catch (error) {
        console.error('❌ Failed to show captions overlay:', error);
    }

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        color: var(--text);
    `;

    modalContent.innerHTML = `
        <h3 style="margin: 0 0 1.5rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="settings" style="width: 20px; height: 20px;"></i>
            Captions Settings
        </h3>

        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Text Color</label>
            <select id="captions-text-color" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text);">
                <option value="white">White</option>
                <option value="black">Black</option>
            </select>
        </div>

        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Background</label>
            <select id="captions-background" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text);">
                <option value="none">No Background</option>
                <option value="white">White Background</option>
                <option value="black">Black Background</option>
            </select>
        </div>

        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Font Size</label>
            <select id="captions-font-size" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text);">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
            </select>
        </div>

        <div style="margin-bottom: 2rem; padding: 1rem; background: var(--hover); border-radius: 8px; opacity: 0.7;">
            <label style="display: flex; align-items: center; cursor: not-allowed; user-select: none;">
                <input type="checkbox" id="captions-only" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: not-allowed;" disabled checked>
                <div>
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">Captions Only Mode <span style="font-size: 0.75rem; background: rgba(255,165,0,0.3); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">TTS Coming Soon</span></div>
                    <div style="font-size: 0.85rem; opacity: 0.8;">TTS for bidirectional is temporarily disabled due to an audio looping issue - stay tuned!</div>
                </div>
            </label>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="captions-cancel" style="padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text); cursor: pointer;">
                Cancel
            </button>
            <button id="captions-save" style="padding: 0.5rem 1rem; border: 1px solid var(--focus); border-radius: 6px; background: var(--focus); color: var(--text-on-focus); cursor: pointer;">
                Save
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Set current values
    const textColorSelect = modal.querySelector('#captions-text-color') as HTMLSelectElement;
    const backgroundSelect = modal.querySelector('#captions-background') as HTMLSelectElement;
    const fontSizeSelect = modal.querySelector('#captions-font-size') as HTMLSelectElement;
    const captionsOnlyCheckbox = modal.querySelector('#captions-only') as HTMLInputElement;

    if (textColorSelect) textColorSelect.value = captionsSettings.textColor;
    if (backgroundSelect) backgroundSelect.value = captionsSettings.background;
    if (fontSizeSelect) fontSizeSelect.value = captionsSettings.fontSize;
    // Always force captionsOnly to true - TTS for bidirectional is coming soon
    if (captionsOnlyCheckbox) captionsOnlyCheckbox.checked = true;

    // Re-initialize Lucide icons
    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }

    // Handle save
    const saveButton = modal.querySelector('#captions-save') as HTMLButtonElement;
    saveButton?.addEventListener('click', async () => {
        if (textColorSelect && backgroundSelect && fontSizeSelect && captionsOnlyCheckbox) {
            // Validate and get values with defaults
            const textColor = textColorSelect.value || 'white';
            const background = backgroundSelect.value || 'none';
            const fontSize = fontSizeSelect.value || 'medium';

            // Preserve ALL existing settings and only update the changed values
            // Always force captionsOnly to true - TTS for bidirectional is coming soon
            const newSettings = {
                ...captionsSettings, // Keep all existing properties (position, etc.)
                enabled: captionsSettings.enabled !== undefined ? captionsSettings.enabled : false,
                textColor: textColor as 'white' | 'black',
                background: background as 'none' | 'white' | 'black',
                fontSize: fontSize as 'small' | 'medium' | 'large' | 'xlarge',
                captionsOnly: true // Always true - TTS coming soon
            };

            // Update the passed-in settings object to reflect changes
            // This ensures the reference is updated for the caller
            console.log('💾 BEFORE Object.assign - captionsSettings:', JSON.stringify(captionsSettings, null, 2));
            console.log('💾 BEFORE Object.assign - newSettings:', JSON.stringify(newSettings, null, 2));
            Object.assign(captionsSettings, newSettings);
            console.log('💾 AFTER Object.assign - captionsSettings:', JSON.stringify(captionsSettings, null, 2));

            console.log('💾 Saving captions settings (preserving all properties):', newSettings);
            console.log('💾 captionsSettings parameter after Object.assign:', JSON.stringify(captionsSettings, null, 2));

            // Immediately update the state to ensure captionsOnly change takes effect right away
            // This is important so that TTS resumes immediately when captionsOnly is turned off
            setCaptionsSettings(newSettings);
            console.log('✅ Captions settings updated in state immediately (captionsOnly:', newSettings.captionsOnly, ')');

            // Update captions overlay
            try {
                await (window as any).electronAPI.invoke('captions:updateSettings', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: newSettings
                });
            } catch (error) {
                console.error('❌ Failed to update captions overlay:', error);
            }

            // Save to configuration
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        uiSettings: {
                            captionsSettings: newSettings
                        }
                    }
                });
                console.log('💾 Captions settings saved to config:', newSettings);
            } catch (error) {
                console.error('❌ Failed to save captions settings:', error);
            }
        }
        document.body.removeChild(modal);
    });

    // Handle cancel
    const cancelButton = modal.querySelector('#captions-cancel') as HTMLButtonElement;
    cancelButton?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Handle click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}
