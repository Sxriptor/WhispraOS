/**
 * Bidirectional Audio Enhancement
 * Provides mild noise filtering - main gain boost happens in WASAPI PCM processing
 * Note: Heavy gain is NOT applied here to avoid distortion. Adaptive gain is applied
 * to the WASAPI PCM data in renderer.ts feedWasapiPcmToWorklet()
 */

export interface AudioEnhancementNodes {
    highpassFilter: BiquadFilterNode;
    lowpassFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    gainNode: GainNode;
    makeupGainNode: GainNode;
    limiter: DynamicsCompressorNode;
    outputNode: AudioNode;
}

/**
 * Create audio enhancement pipeline with mild filtering
 * Main gain boost is applied adaptively in the WASAPI PCM handler
 * @param audioContext The audio context to use
 * @param sourceNode The source node to enhance
 * @param gainBoost Multiplier for audio gain (kept low to avoid distortion)
 * @returns Object containing the enhancement nodes
 */
export function createAudioEnhancement(
    audioContext: AudioContext,
    sourceNode: MediaStreamAudioSourceNode,
    gainBoost: number = 1.0 // Minimal gain here - adaptive gain applied to WASAPI PCM
): AudioEnhancementNodes {
    // Stage 1: High-pass filter to remove low-frequency rumble / HVAC noise
    const highpassFilter = audioContext.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = 80;
    highpassFilter.Q.value = 0.5;

    // Stage 2: Low-pass filter to reduce high-frequency hiss
    const lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = 6000;
    lowpassFilter.Q.value = 0.5;

    // Stage 3: Minimal gain (main boost happens in WASAPI PCM processing)
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gainBoost;

    // Stage 4: Light compression for level normalization
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -30; // Moderate threshold
    compressor.knee.value = 20;
    compressor.ratio.value = 4; // Light compression
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;

    // Stage 5: Minimal makeup gain
    const makeupGainNode = audioContext.createGain();
    makeupGainNode.gain.value = 1.5; // Slight makeup

    // Stage 6: Limiter to prevent clipping
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    // Connect: source -> highpass -> lowpass -> gain -> compressor -> makeup -> limiter
    sourceNode.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(makeupGainNode);
    makeupGainNode.connect(limiter);

    console.log(`🔊 Audio enhancement: mild filtering (main adaptive gain in WASAPI PCM handler)`);

    return {
        highpassFilter,
        lowpassFilter,
        compressor,
        gainNode,
        makeupGainNode,
        limiter,
        outputNode: limiter
    };
}

/**
 * Reset noise profile (call when audio environment changes)
 */
export function resetNoiseProfile(): void {
    // This will be handled by the processor node's internal state
    // The noise profile will be re-estimated on next audio processing
}

