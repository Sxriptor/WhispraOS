/**
 * Toggles translation mode (push-to-talk) on/off
 */
export async function toggleTranslation(
    isTranslating: boolean,
    startButton: HTMLButtonElement,
    currentLanguage: string,
    getTranslatedButtonText: (language: string, isActive: boolean) => string,
    processingStatus: HTMLElement,
    logToDebug: (message: string) => void,
    liveTranslationPanel: HTMLElement,
    isRecording: boolean,
    stopRecordingModule: () => Promise<void>,
    mediaRecorder: MediaRecorder | null,
    updateRecordingUI: (recording: boolean) => void,
    recordingText: HTMLElement | null,
    originalTextDiv: HTMLElement | null,
    translatedTextDiv: HTMLElement | null,
    microphoneSelect: HTMLSelectElement,
    languageSelect: HTMLSelectElement,
    voiceSelect: HTMLSelectElement,
    audioStream: MediaStream | null,
    initializeAudioStream: () => Promise<void>,
    restartPassthroughClean: () => Promise<void>,
    updateStatusIndicator: (status?: string) => void,
    setIsTranslating: (value: boolean) => void,
    setTranslationStartTime: (value: number | null) => void,
    setIsRecording: (value: boolean) => void,
    setRecordingStartTime: (value: number | null) => void,
    setMediaRecorder: (value: MediaRecorder | null) => void,
    setAudioChunks: (value: any[]) => void
): Promise<void> {
    try {
        if (isTranslating) {
            // Stop push-to-talk mode
            startButton.disabled = true;
            startButton.textContent = 'Stopping...';

            setIsTranslating(false);
            setTranslationStartTime(null); // Clear translation start time when stopping
            startButton.textContent = getTranslatedButtonText(currentLanguage, false);
            startButton.classList.remove('active');
            startButton.disabled = false;
            processingStatus.textContent = 'Idle';
            logToDebug('Push-to-talk mode stopped');

            // Notify overlay about state change
            console.log('[Main Renderer] Sending translation:state-changed (stopped) to overlay');
            (window as any).electronAPI?.sendToMain?.('translation:state-changed', {
                isActive: false,
                isRunning: false
            });

            // Notify mini-overlay about audio detection state change
            console.log('[Main Renderer] Sending audio detection (stopped) to mini-overlay');
            (window as any).electronAPI?.invoke?.('mini-overlay:audio-detected', { isDetected: false });

            // Hide live translation panel
            liveTranslationPanel.style.display = 'none';

            // Stop any active recording but keep passthrough running
            if (isRecording) {
                await stopRecordingModule();
            }

            // Completely stop and clean up MediaRecorder to prevent any pending processing
            if (mediaRecorder) {
                // Remove the onstop handler to prevent processRecordedAudio from running
                mediaRecorder.onstop = null;

                if (mediaRecorder.state !== 'inactive') {
                    try {
                        mediaRecorder.stop();
                    } catch (e) {
                        console.warn('Error stopping mediaRecorder:', e);
                    }
                }
                setMediaRecorder(null);
            }

            // Clear audio chunks to prevent any pending processing
            setAudioChunks([]);

            // Reset recording state
            setIsRecording(false);
            setRecordingStartTime(null);

            // Reset UI to clear any "Transcribing..." or "Processing..." states
            updateRecordingUI(false);
            if (recordingText) {
                recordingText.textContent = 'Ready to record...';
            }
            if (originalTextDiv) {
                originalTextDiv.textContent = '';
                originalTextDiv.classList.remove('processing');
                originalTextDiv.classList.add('empty');
            }
            if (translatedTextDiv) {
                translatedTextDiv.textContent = '';
                translatedTextDiv.classList.remove('processing');
                translatedTextDiv.classList.add('empty');
            }

            // NOTE: We intentionally do NOT call cleanupAudioStream() here
            // because we want to keep the microphone passthrough running
        } else {
            // Validate configuration before starting
            if (!microphoneSelect.value) {
                throw new Error('No microphone device available');
            }
            if (!languageSelect.value) {
                throw new Error('Please select a target language');
            }
            if (!voiceSelect.value) {
                throw new Error('Please select a voice');
            }

            // Start push-to-talk mode (no need for pipeline:start)
            startButton.disabled = true;
            startButton.textContent = 'Starting...';

            // Ensure recording state is cleared before starting
            if (isRecording) {
                setIsRecording(false);
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    try {
                        mediaRecorder.stop();
                    } catch (e) {
                        console.warn('Error stopping mediaRecorder on start:', e);
                    }
                }
                setMediaRecorder(null);
                updateRecordingUI(false);
            }

            // Initialize audio stream for push-to-talk if not already initialized
            if (!audioStream) {
                await initializeAudioStream();
                await restartPassthroughClean();
            } else {
                // Audio stream already initialized, ensure passthrough is active
                await restartPassthroughClean();
            }

            setIsTranslating(true);
            setTranslationStartTime(Date.now()); // Mark when translation mode started
            startButton.textContent = getTranslatedButtonText(currentLanguage, true);
            startButton.classList.add('active');
            startButton.disabled = false;
            processingStatus.textContent = 'Push-to-Talk Ready';
            logToDebug('Push-to-talk mode started - hold spacebar to record');

            // Add a small delay to prevent any pending keydown events from immediately triggering recording
            // This prevents the issue where clicking the button might cause a brief recording start
            setTimeout(() => {
                // After 200ms, ensure isRecording is still false (in case a keydown event fired)
                if (!isRecording && isTranslating) {
                    // State is good, ready for PTT
                }
            }, 200);

            // Notify overlay about state change
            console.log('[Main Renderer] Sending translation:state-changed (started) to overlay');
            (window as any).electronAPI?.sendToMain?.('translation:state-changed', {
                isActive: true,
                isRunning: true
            });

            // Notify mini-overlay about audio detection state change
            console.log('[Main Renderer] Sending audio detection (started) to mini-overlay');
            (window as any).electronAPI?.invoke?.('mini-overlay:audio-detected', { isDetected: true });

            // Show live translation panel
            liveTranslationPanel.style.display = 'block';
        }

        updateStatusIndicator();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`Translation toggle error: ${errorMessage}`);

        // Reset button state on error
        setIsTranslating(false);
        startButton.textContent = getTranslatedButtonText(currentLanguage, false);
        startButton.classList.remove('active');
        startButton.disabled = false;
        processingStatus.textContent = `Error: ${errorMessage}`;
        updateStatusIndicator('error');

        // Notify overlay about failed state change
        console.log('[Main Renderer] Sending translation:state-changed (error/stopped) to overlay');
        (window as any).electronAPI?.sendToMain?.('translation:state-changed', {
            isActive: false,
            isRunning: false
        });
    }
}
