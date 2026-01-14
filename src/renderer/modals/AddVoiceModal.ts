/**
 * Shows modal for adding custom ElevenLabs voice
 */
export async function showAddVoiceModal(
    logToDebug: (message: string) => void,
    isValidVoiceId: (voiceId: string) => boolean,
    addCustomVoiceToList: (voiceId: string, displayName: string) => Promise<void>,
    voiceSelect: HTMLSelectElement
): Promise<void> {
    logToDebug('Opening add custom voice modal...');

    // Create modal for adding custom voice
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        width: 500px;
        max-width: 90%;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    modalContent.innerHTML = `
        <h2 style="margin-bottom: 1rem; color: #333;">➕ Add Custom Voice</h2>
        <p style="margin-bottom: 1.5rem; color: #666; line-height: 1.5;">
            Enter a custom ElevenLabs voice ID to add it to your voice list. You can find voice IDs in your ElevenLabs account or use public voice IDs.
        </p>

        <div style="margin-bottom: 1rem;">
            <label for="voice-id-input" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Voice ID:</label>
            <input type="text" id="voice-id-input" placeholder="e.g., pNInz6obpgDQGcFmaJgB"
                   class="voice-modal-input" style="width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 1rem;">
            <small style="color: #666; margin-top: 0.25rem; display: block;">
                Voice ID should be a 20-character alphanumeric string
            </small>
        </div>

        <div style="margin-bottom: 1.5rem;">
            <label for="voice-name-input" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Display Name (optional):</label>
            <input type="text" id="voice-name-input" placeholder="e.g., My Custom Voice"
                   class="voice-modal-input" style="width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 1rem;">
            <small style="color: #666; margin-top: 0.25rem; display: block;">
                If not provided, the voice ID will be used as the name
            </small>
        </div>

        <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="test-voice-checkbox" style="margin-right: 0.5rem;">
                <span>Test voice before adding</span>
            </label>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="cancel-voice-btn" class="voice-modal-button" style="padding: 0.75rem 1.5rem; border: 2px solid #ddd; background: white; border-radius: 8px; cursor: pointer;">
                Cancel
            </button>
            <button id="test-voice-btn" class="voice-modal-button" style="padding: 0.75rem 1.5rem; border: 2px solid #667eea; background: white; color: #667eea; border-radius: 8px; cursor: pointer;">
                🧪 Test Voice
            </button>
            <button id="add-voice-btn" class="voice-modal-button" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer;">
                ➕ Add Voice
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const voiceIdInput = modalContent.querySelector('#voice-id-input') as HTMLInputElement;
    const voiceNameInput = modalContent.querySelector('#voice-name-input') as HTMLInputElement;
    const testVoiceCheckbox = modalContent.querySelector('#test-voice-checkbox') as HTMLInputElement;
    const testVoiceBtn = modalContent.querySelector('#test-voice-btn') as HTMLButtonElement;
    const addVoiceBtn = modalContent.querySelector('#add-voice-btn') as HTMLButtonElement;
    const cancelBtn = modalContent.querySelector('#cancel-voice-btn') as HTMLButtonElement;

    // Focus on voice ID input
    voiceIdInput.focus();

    // Handle test voice
    testVoiceBtn.addEventListener('click', async () => {
        const voiceId = voiceIdInput.value.trim();
        if (!voiceId) {
            alert('Please enter a voice ID first');
            return;
        }

        if (!isValidVoiceId(voiceId)) {
            alert('Please enter a valid voice ID (20-character alphanumeric string)');
            return;
        }

        try {
            testVoiceBtn.disabled = true;
            testVoiceBtn.textContent = '🧪 Testing...';

            logToDebug(`Testing custom voice ID: ${voiceId}`);

            // Test the voice with a sample text
            const response = await (window as any).electronAPI.invoke('pipeline:test', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    text: 'Hello, this is a test of your custom voice.',
                    targetLanguage: 'en', // Test in English
                    voiceId: voiceId,
                    outputToHeadphones: true
                }
            });

            if (response.success) {
                logToDebug('✅ Custom voice test successful');
                alert('Voice test successful! You should have heard the test audio.');
                testVoiceCheckbox.checked = true;
            } else {
                throw new Error(response.error || 'Voice test failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logToDebug(`❌ Custom voice test failed: ${errorMessage}`);
            alert(`Voice test failed: ${errorMessage}`);
        } finally {
            testVoiceBtn.disabled = false;
            testVoiceBtn.textContent = '🧪 Test Voice';
        }
    });

    // Handle add voice
    addVoiceBtn.addEventListener('click', async () => {
        const voiceId = voiceIdInput.value.trim();
        const voiceName = voiceNameInput.value.trim();

        if (!voiceId) {
            alert('Please enter a voice ID');
            return;
        }

        if (!isValidVoiceId(voiceId)) {
            alert('Please enter a valid voice ID (20-character alphanumeric string)');
            return;
        }

        // If test is required and not done, prompt user
        if (testVoiceCheckbox.checked && !testVoiceCheckbox.dataset.tested) {
            alert('Please test the voice first by clicking "Test Voice"');
            return;
        }

        try {
            addVoiceBtn.disabled = true;
            addVoiceBtn.textContent = '➕ Adding...';

            const displayName = voiceName || `Custom Voice (${voiceId.substring(0, 8)}...)`;

            // Add the voice to the dropdown
            await addCustomVoiceToList(voiceId, displayName);

            logToDebug(`✅ Custom voice added: ${displayName} (${voiceId})`);

            // Close modal
            document.body.removeChild(modal);

            // Select the newly added voice
            voiceSelect.value = voiceId;

            // Save the selection
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { selectedVoice: voiceId }
            });

            logToDebug(`Voice "${displayName}" added and selected successfully`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logToDebug(`❌ Failed to add custom voice: ${errorMessage}`);
            alert(`Failed to add voice: ${errorMessage}`);
        } finally {
            addVoiceBtn.disabled = false;
            addVoiceBtn.textContent = '➕ Add Voice';
        }
    });

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Handle click outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // Handle Enter key in inputs
    [voiceIdInput, voiceNameInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addVoiceBtn.click();
            }
        });
    });
}
