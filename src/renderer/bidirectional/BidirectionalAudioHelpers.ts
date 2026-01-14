/**
 * Bidirectional Audio Helper Functions
 * Utility functions for audio processing, resampling, and conversion
 */

import {
    pcmCaptureCtx,
    pcmProcessorNode,
    pcmCaptureSource,
    pcmCurrentFrames,
    pcmIsRecording,
    setPcmIsRecording,
    setPcmCurrentFrames,
    setPcmProcessorNode,
    setPcmCaptureSource,
    setPcmCaptureCtx
} from './BidirectionalState.js';

/**
 * Resample Float32 audio from one sample rate to another with anti-aliasing filter
 * Uses sinc interpolation with Lanczos windowing for high-quality downsampling
 * This prevents aliasing artifacts that degrade Whisper transcription quality
 */
export function resampleFloat32(input: Float32Array, inRate: number, outRate: number): Float32Array {
    if (inRate === outRate) return input;

    const ratio = inRate / outRate;
    const outLen = Math.floor(input.length / ratio);
    const output = new Float32Array(outLen);

    // For upsampling, use simple linear interpolation
    if (ratio < 1) {
        for (let i = 0; i < outLen; i++) {
            const sourceIndex = i * ratio;
            const idx = Math.floor(sourceIndex);
            const frac = sourceIndex - idx;
            const s0 = input[idx] ?? 0;
            const s1 = input[idx + 1] ?? s0;
            output[i] = s0 * (1 - frac) + s1 * frac;
        }
        return output;
    }

    // For downsampling, use windowed sinc interpolation (Lanczos)
    // This applies anti-aliasing filter to prevent high frequencies from folding back as distortion
    const a = 3; // Lanczos window size (a=3 is good balance of quality vs performance)

    for (let i = 0; i < outLen; i++) {
        const sourceIndex = i * ratio;
        let sum = 0;
        let weightSum = 0;

        // Sample surrounding points with sinc function
        const start = Math.max(0, Math.floor(sourceIndex - a));
        const end = Math.min(input.length - 1, Math.ceil(sourceIndex + a));

        for (let j = start; j <= end; j++) {
            const x = sourceIndex - j;
            if (x === 0) {
                sum += input[j];
                weightSum += 1;
            } else {
                // Lanczos kernel: L(x) = sinc(x) * sinc(x/a) for |x| < a
                const px = Math.PI * x;
                const sincX = Math.sin(px) / px;
                const sincXa = Math.sin(px / a) / (px / a);
                const weight = sincX * sincXa;

                sum += input[j] * weight;
                weightSum += weight;
            }
        }

        output[i] = weightSum > 0 ? sum / weightSum : 0;
    }

    return output;
}

/**
 * Convert Float32Array frames to a WAV Blob
 * Automatically downsamples to 16kHz mono for Whisper compatibility
 */
export function float32ToWavBlob(frames: Float32Array[], sampleRate: number): Blob {
    // Combine all frames
    let total = 0;
    for (const f of frames) total += f.length;
    const combined = new Float32Array(total);
    let off = 0;
    for (const f of frames) {
        combined.set(f, off);
        off += f.length;
    }

    // Downsample to 16kHz mono (Whisper requirement)
    const targetRate = 16000;
    const mono = resampleFloat32(combined, sampleRate, targetRate);

    // Build WAV file (16-bit PCM format)
    const length = mono.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    // WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Write PCM data (16-bit signed integers)
    let ptr = 44;
    for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, mono[i]));
        view.setInt16(ptr, s * 0x7FFF, true);
        ptr += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Finalize PCM capture segment and send to Whisper for transcription
 * Note: Currently disabled for stability - kept for reference
 */
export async function finalizePcmCaptureSegment(
    getBidirectionalSourceLanguage: () => string,
    getBidirectionalTargetLanguage: () => string
): Promise<void> {
    if (!pcmIsRecording || pcmCurrentFrames.length === 0 || !pcmCaptureCtx) return;

    setPcmIsRecording(false);
    const frames = [...pcmCurrentFrames];
    setPcmCurrentFrames([]);

    try {
        console.log('[renderer] 🔄 PCM Capture: Processing', frames.length, 'frames for Whisper');
        const wavBlob = float32ToWavBlob(frames, pcmCaptureCtx.sampleRate);
        const arrBuf = await wavBlob.arrayBuffer();
        const audioData = Array.from(new Uint8Array(arrBuf));
        console.log('[renderer] 📤 PCM Capture: Sending', audioData.length, 'bytes to Whisper API as audio/wav');

        const selectedLanguage = getBidirectionalSourceLanguage();
        const targetLanguage = getBidirectionalTargetLanguage();

        const response = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { audioData, language: selectedLanguage, targetLanguage: targetLanguage, contentType: 'audio/wav' }
        });

        if (!response.success) {
            console.warn('[renderer] PCM Capture transcription failed:', response.error);
        } else {
            console.log('[Bidirectional] PCM Whisper result:', (response.payload.text || '').trim());
        }
    } catch (e) {
        console.warn('[renderer] PCM Capture finalize error:', e);
    }
}

/**
 * Start PCM capture from a media stream
 * Note: Currently disabled for stability reasons
 */
export async function startPcmCapture(stream: MediaStream): Promise<void> {
    // Skip raw PCM capture to avoid renderer stability issues
    console.log('🎙️ Raw PCM capture disabled for stability');
}

/**
 * Stop PCM capture and clean up resources
 */
export async function stopPcmCapture(): Promise<void> {
    try {
        if (pcmProcessorNode) pcmProcessorNode.disconnect();
    } catch { }

    try {
        if (pcmCaptureSource) pcmCaptureSource.disconnect();
    } catch { }

    try {
        if (pcmCaptureCtx && pcmCaptureCtx.state !== 'closed') await pcmCaptureCtx.close();
    } catch { }

    setPcmProcessorNode(null);
    setPcmCaptureSource(null);
    setPcmCaptureCtx(null);
    setPcmIsRecording(false);
    setPcmCurrentFrames([]);
}

/**
 * Remove duplicate words at chunk boundaries caused by audio overlap
 * With 200ms overlap, we might get 2-7 words duplicated depending on speech speed
 */
export function removeDuplicateWords(previousText: string, currentText: string): string {
    const prevWords = previousText.trim().split(/\s+/);
    const currWords = currentText.trim().split(/\s+/);

    if (prevWords.length === 0 || currWords.length === 0) {
        return currentText;
    }

    // Find how many words match at the boundary
    // Check last N words of previous chunk against first N words of current chunk
    let maxOverlap = Math.min(prevWords.length, currWords.length, 7); // Check up to 7 words
    let overlapCount = 0;

    for (let i = 1; i <= maxOverlap; i++) {
        // Check if last i words of prev match first i words of curr
        const prevSlice = prevWords.slice(-i);
        const currSlice = currWords.slice(0, i);

        if (prevSlice.join(' ').toLowerCase() === currSlice.join(' ').toLowerCase()) {
            overlapCount = i;
        }
    }

    if (overlapCount > 0) {
        // Remove the duplicate words from the start of current text
        const deduplicated = currWords.slice(overlapCount).join(' ');
        console.log(`[Bidi] Removed ${overlapCount} duplicate word(s): "${currWords.slice(0, overlapCount).join(' ')}"`);
        return deduplicated;
    }

    return currentText;
}
