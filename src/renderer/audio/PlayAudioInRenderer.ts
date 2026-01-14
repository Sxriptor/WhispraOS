/**
 * Plays audio buffer in the renderer process with proper device routing
 */
export async function playAudioInRenderer(
    audioBufferArray: number[],
    passThroughAudioEl: HTMLAudioElement | null,
    passThroughAudioElVirtual: HTMLAudioElement | null,
    MASTER_AUDIO_VOLUME: number,
    outputToVirtualDevice: boolean,
    virtualOutputDeviceId: string | null,
    isTranslating: boolean,
    isRecording: boolean,
    audioStream: MediaStream | null,
    restartPassthroughClean: () => Promise<void>
): Promise<void> {
    try {
        console.log('🎵 Starting audio playback in renderer...');
        console.log(`📊 Input array length: ${audioBufferArray.length}`);

        // Ensure mic passthrough is paused during TTS playback to avoid overlap
        try {
            if (passThroughAudioEl && !passThroughAudioEl.paused) {
                passThroughAudioEl.pause();
            }
            if (passThroughAudioElVirtual && !passThroughAudioElVirtual.paused) {
                passThroughAudioElVirtual.pause();
            }
        } catch { }

        // Convert array back to ArrayBuffer
        const audioBuffer = new Uint8Array(audioBufferArray).buffer;
        console.log(`📊 ArrayBuffer size: ${audioBuffer.byteLength} bytes`);

        // Detect audio format from magic bytes
        const view = new Uint8Array(audioBuffer);
        let mimeType = 'audio/mpeg'; // default

        if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
            // RIFF header = WAV
            mimeType = 'audio/wav';
            console.log('🎵 Detected WAV format from RIFF header');
        } else if (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0) {
            // MP3 sync word
            mimeType = 'audio/mpeg';
            console.log('🎵 Detected MP3 format from sync word');
        } else if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
            // ID3 tag = MP3 with metadata
            mimeType = 'audio/mpeg';
            console.log('🎵 Detected MP3 format from ID3 tag');
        } else if (view[0] === 0x4F && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53) {
            // OggS header = Ogg
            mimeType = 'audio/ogg';
            console.log('🎵 Detected OGG format');
        }

        // Create audio blob with detected MIME type
        const audioBlob = new Blob([audioBuffer], { type: mimeType });
        console.log(`📊 Blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

        // Create audio element and play
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);
        console.log(`🔗 Audio URL created: ${url.substring(0, 50)}...`);

        // Estimate audio duration (rough estimate based on typical MP3 compression)
        const estimatedDurationMs = (audioBufferArray.length / 1000) * 8; // Rough estimate

        // Notify main process that TTS playback is starting
        try {
            await (window as any).electronAPI.notifyTtsPlaybackStart(estimatedDurationMs);
            console.log('📢 Notified main process of TTS playback start');
        } catch (e) {
            console.warn('[renderer] Failed to notify TTS playback start:', e);
        }

        return new Promise((resolve, reject) => {
            let resolved = false;

            audio.onloadeddata = () => {
                console.log('📥 Audio data loaded successfully');
            };

            audio.oncanplay = () => {
                console.log('Audio can start playing');
            };

            audio.onended = async () => {
                console.log('✅ Audio playback completed');
                URL.revokeObjectURL(url);
                // Notify main process that TTS playback has ended
                try {
                    await (window as any).electronAPI.notifyTtsPlaybackEnd();
                    console.log('📢 Notified main process of TTS playback end');
                } catch (e) {
                    console.warn('[renderer] Failed to notify TTS playback end:', e);
                }
                // Auto-resume mic passthrough for push-to-talk/headphones mode
                try {
                    if (isTranslating && !isRecording && audioStream) {
                        await restartPassthroughClean();
                    }
                } catch { }
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            audio.onerror = async (error) => {
                console.error('❌ Audio element error:', error);
                URL.revokeObjectURL(url);
                // Notify main process that TTS playback has ended (even on error)
                try {
                    await (window as any).electronAPI.notifyTtsPlaybackEnd();
                    console.log('📢 Notified main process of TTS playback end (error)');
                } catch (e) {
                    console.warn('[renderer] Failed to notify TTS playback end:', e);
                }
                // Attempt to resume passthrough even on error
                try {
                    if (isTranslating && !isRecording && audioStream) {
                        await restartPassthroughClean();
                    }
                } catch { }
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Audio playback error: ${error}`));
                }
            };

            audio.src = url;
            audio.volume = MASTER_AUDIO_VOLUME;
            if (outputToVirtualDevice && virtualOutputDeviceId && 'setSinkId' in audio) {
                (audio as any).setSinkId(virtualOutputDeviceId).then(() => {
                    console.log(`🔌 Routed TTS audio to virtual output: ${virtualOutputDeviceId} (1% volume)`);
                }).catch((err: any) => {
                    console.warn('⚠️ setSinkId failed, using default output', err);
                });
            }
            console.log('🎵 Starting audio.play() at 1% volume...');
            audio.play().catch(playError => {
                console.error('❌ Audio.play() failed:', playError);
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Audio play failed: ${playError.message || playError}`));
                }
            });
        });

    } catch (error) {
        console.error('❌ Audio renderer error:', error);
        throw new Error(`Failed to play audio in renderer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
