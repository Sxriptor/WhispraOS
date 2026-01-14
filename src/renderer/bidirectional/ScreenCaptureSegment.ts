/**
 * Finalizes and processes a screen capture audio segment for bidirectional translation
 */
export async function finalizeScreenCaptureSegment(
    wasapiIsRecording: boolean,
    wasapiCurrentSegment: (Buffer | Blob)[],
    getBidirectionalTargetLanguage: () => string,
    bidirectionalDetectedText: HTMLDivElement | null,
    updateCaptions: (text: string) => Promise<void>,
    applyAccentTag: (text: string) => string,
    incomingVoiceId: string | null,
    accentEnabled: boolean,
    playAudioInRenderer: (audioBuffer: number[]) => Promise<void>
): Promise<{ shouldContinue: boolean; updatedSegment: (Buffer | Blob)[] }> {
    if (!wasapiIsRecording || wasapiCurrentSegment.length === 0) {
        return { shouldContinue: false, updatedSegment: wasapiCurrentSegment };
    }

    const segmentChunks = [...wasapiCurrentSegment];

    try {
        console.log('[renderer] 🔄 Screen Capture: Processing', segmentChunks.length, 'audio chunks for Whisper');

        // For screen capture, we have MediaRecorder blobs, not WAV chunks
        // Combine all blobs into a single blob
        const combinedBlob = new Blob(segmentChunks as Blob[], { type: (segmentChunks[0] as any)?.type || 'audio/webm' });

        console.log('[renderer] 🎵 Screen Capture: Converting', combinedBlob.size, 'bytes from', combinedBlob.type, 'to WAV');

        // Convert WebM/Opus to WAV using Web Audio API
        let audioArray: number[];
        let contentType = 'audio/wav';

        try {
            // Create audio context for conversion
            const audioContext = new AudioContext();
            const arrayBuffer = await combinedBlob.arrayBuffer();

            // Decode the audio data (works with WebM, MP4, etc.)
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Extract PCM data from the first channel
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            console.log('[renderer] 🔧 Audio decoded:', channelData.length, 'samples at', sampleRate, 'Hz');

            // Convert float32 PCM to int16 PCM
            const int16Data = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                int16Data[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767));
            }

            // Create WAV header
            const wavHeader = new ArrayBuffer(44);
            const view = new DataView(wavHeader);

            // WAV header
            view.setUint32(0, 0x46464952, false); // "RIFF"
            view.setUint32(4, 36 + int16Data.length * 2, true); // File size - 8
            view.setUint32(8, 0x45564157, false); // "WAVE"
            view.setUint32(12, 0x20746d66, false); // "fmt "
            view.setUint32(16, 16, true); // PCM header size
            view.setUint16(20, 1, true); // PCM format
            view.setUint16(22, 1, true); // Mono
            view.setUint32(24, sampleRate, true); // Sample rate
            view.setUint32(28, sampleRate * 2, true); // Byte rate
            view.setUint16(32, 2, true); // Block align
            view.setUint16(34, 16, true); // Bits per sample
            view.setUint32(36, 0x61746164, false); // "data"
            view.setUint32(40, int16Data.length * 2, true); // Data size

            // Combine header and data
            const wavBuffer = new ArrayBuffer(44 + int16Data.length * 2);
            const wavView = new Uint8Array(wavBuffer);
            wavView.set(new Uint8Array(wavHeader), 0);
            wavView.set(new Uint8Array(int16Data.buffer), 44);

            audioArray = Array.from(wavView);
            console.log('[renderer] ✅ WAV conversion complete:', audioArray.length, 'bytes');

        } catch (conversionError) {
            console.warn('[renderer] ⚠️ WAV conversion failed, sending original format:', conversionError);
            // Fallback to original blob
            const arrayBuffer = await combinedBlob.arrayBuffer();
            audioArray = Array.from(new Uint8Array(arrayBuffer));
            contentType = combinedBlob.type;
        }

        console.log('[renderer] 📤 Screen Capture: Sending', audioArray.length, 'bytes to Whisper API as', contentType);

        // Send to Whisper API
        const response = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                audioData: audioArray,
                language: 'auto',
                contentType: contentType
            }
        });

        if (response.success && response.payload.text) {
            const transcription = response.payload.text.trim();
            const detectedLang = response.payload.language || 'unknown';

            console.log('[Bidirectional] Whisper result:', transcription);
            console.log('[Bidirectional] Detected language:', detectedLang);
            console.log('🎬 DEBUG: finalizeScreenCaptureSegment - About to process transcription for captions');

            // Log to bidirectional system
            try {
                await (window as any).electronAPI.invoke('bidirectional:log', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        level: 'info',
                        message: 'Screen capture transcription success',
                        data: { text: transcription, language: detectedLang }
                    }
                });
            } catch { }

            // Check if this needs translation
            const targetLang = getBidirectionalTargetLanguage();
            if (detectedLang !== targetLang && transcription.length > 0) {
                console.log('[Bidirectional] 🌐 Non-target language detected, starting translation pipeline');
                console.log('[Bidirectional] 📝 Original:', transcription, '(' + detectedLang + ')');

                // Update UI with original text (no language indicator)
                if (bidirectionalDetectedText) {
                    bidirectionalDetectedText.textContent = transcription;
                    bidirectionalDetectedText.classList.remove('empty');
                }

                try {
                    // Step 1: Translate the text
                    console.log('[Bidirectional] 🔄 Translating to', targetLang + '...');
                    const translationResponse = await (window as any).electronAPI.invoke('translation:translate', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: {
                            text: transcription,
                            sourceLanguage: detectedLang,
                            targetLanguage: targetLang
                        }
                    });

                    if (translationResponse.success && translationResponse.payload.translatedText) {
                        const translatedText = translationResponse.payload.translatedText;
                        console.log('[Bidirectional] ✅ Translation:', translatedText);

                        // Update captions overlay with streaming text
                        await updateCaptions(translatedText);

                        // Update UI with translation
                        if (bidirectionalDetectedText) {
                            bidirectionalDetectedText.textContent = `${translatedText} (${targetLang})`;
                        }

                        // Step 2: Convert to speech
                        console.log('[Bidirectional] 🔊 Converting to speech...');
                        const ttsResponse = await (window as any).electronAPI.invoke('tts:synthesize', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: {
                                text: applyAccentTag(translatedText),
                                voiceId: incomingVoiceId || 'pNInz6obpgDQGcFmaJgB', // Default ElevenLabs voice
                                // Force ElevenLabs v3 model when accent is enabled
                                ...(accentEnabled && { modelId: 'eleven_v3' })
                            }
                        });

                        if (ttsResponse.success && ttsResponse.payload?.audioBuffer) {
                            console.log('[Bidirectional] 🎵 Audio synthesis complete, playing...');

                            // Play the translated audio through the selected output device
                            await playAudioInRenderer(ttsResponse.payload.audioBuffer);
                            console.log('[Bidirectional] 🔊 Translated audio playback complete');

                            // Log success
                            try {
                                await (window as any).electronAPI.invoke('bidirectional:log', {
                                    id: Date.now().toString(),
                                    timestamp: Date.now(),
                                    payload: {
                                        level: 'info',
                                        message: 'Translation complete',
                                        data: {
                                            original: transcription,
                                            translated: translatedText,
                                            sourceLang: detectedLang,
                                            targetLang: targetLang
                                        }
                                    }
                                });
                            } catch { }

                        } else {
                            console.error('[Bidirectional] ❌ TTS failed:', ttsResponse.error);
                        }

                    } else {
                        console.error('[Bidirectional] ❌ Translation failed:', translationResponse.error);
                    }

                } catch (error) {
                    console.error('[Bidirectional] ❌ Translation pipeline error:', error);
                }

            } else {
                console.log('[Bidirectional] 🚫 Same language detected (' + detectedLang + ' = ' + targetLang + '), no translation needed');

                // Update captions overlay with original text (no translation needed)
                await updateCaptions(transcription);

                // Update UI to show that no translation was needed
                if (bidirectionalDetectedText) {
                    bidirectionalDetectedText.textContent = `${transcription} (no translation needed)`;
                    bidirectionalDetectedText.classList.remove('empty');
                }
            }

        } else {
            console.error('[Bidirectional] Whisper API failed:', response.error);
            console.error('[Bidirectional] Full response:', response);
        }

    } catch (error) {
        console.error('[Bidirectional] Error processing screen capture segment:', error);
    }

    return { shouldContinue: true, updatedSegment: [] };
}
