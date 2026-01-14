/**
 * Restarts audio passthrough cleanly, switching between virtual device and headphones/default output
 */
export async function restartPassthroughClean(
    audioStream: MediaStream | null,
    logToDebug: (message: string) => void,
    passThroughAudioElVirtual: HTMLAudioElement | null,
    passthroughGainNode: GainNode | null,
    passthroughSourceNode: MediaStreamAudioSourceNode | null,
    passthroughCtx: AudioContext | null,
    passThroughAudioEl: HTMLAudioElement | null,
    outputToVirtualDevice: boolean,
    virtualOutputDeviceId: string | null,
    passthroughGainNodeVirtual: GainNode | null,
    passthroughSourceNodeVirtual: MediaStreamAudioSourceNode | null,
    passthroughDestinationVirtual: MediaStreamAudioDestinationNode | null,
    passthroughCtxVirtual: AudioContext | null,
    MASTER_AUDIO_VOLUME: number,
    setPassThroughAudioElVirtual: (value: HTMLAudioElement | null) => void,
    setPassthroughGainNode: (value: GainNode | null) => void,
    setPassthroughSourceNode: (value: MediaStreamAudioSourceNode | null) => void,
    setPassthroughCtx: (value: AudioContext | null) => void,
    setPassThroughAudioEl: (value: HTMLAudioElement | null) => void,
    setPassthroughGainNodeVirtual: (value: GainNode | null) => void,
    setPassthroughSourceNodeVirtual: (value: MediaStreamAudioSourceNode | null) => void,
    setPassthroughDestinationVirtual: (value: MediaStreamAudioDestinationNode | null) => void,
    setPassthroughCtxVirtual: (value: AudioContext | null) => void
): Promise<void> {
    if (!audioStream) {
        logToDebug('ℹ️ No audio stream available to restart passthrough');
        return;
    }
    try {
        // Small delay to ensure TTS element fully releases device/output
        await new Promise(resolve => setTimeout(resolve, 50));

        // First, stop ALL existing passthroughs (both virtual and headphones)
        // This ensures clean switching between modes
        try {
            if (passThroughAudioElVirtual) {
                passThroughAudioElVirtual.pause();
                (passThroughAudioElVirtual as any).srcObject = null;
            }
        } catch { }

        try {
            if (passthroughGainNode) passthroughGainNode.disconnect();
        } catch { }
        try {
            if (passthroughSourceNode) passthroughSourceNode.disconnect();
        } catch { }
        try {
            if (passthroughCtx && passthroughCtx.state !== 'closed') {
                // Close the AudioContext completely when switching away from headphones
                await passthroughCtx.close();
            }
        } catch { }

        // Also clean up HTMLAudio fallback element
        try {
            if (passThroughAudioEl) {
                passThroughAudioEl.pause();
                (passThroughAudioEl as any).srcObject = null;
            }
        } catch { }

        // Now set up the correct passthrough based on current setting
        if (outputToVirtualDevice && virtualOutputDeviceId) {
            // Virtual device passthrough using Web Audio API for proper volume control
            try {
                // Cleanup previous virtual passthrough if any
                try { if (passthroughGainNodeVirtual) passthroughGainNodeVirtual.disconnect(); } catch { }
                try { if (passthroughSourceNodeVirtual) passthroughSourceNodeVirtual.disconnect(); } catch { }
                try { if (passthroughDestinationVirtual) passthroughDestinationVirtual.disconnect(); } catch { }

                // Create or reuse audio context
                let ctxVirtual = passthroughCtxVirtual;
                if (!ctxVirtual || ctxVirtual.state === 'closed') {
                    ctxVirtual = new AudioContext();
                    setPassthroughCtxVirtual(ctxVirtual);
                }
                if (ctxVirtual.state === 'suspended') {
                    await ctxVirtual.resume();
                }

                // Create Web Audio graph
                const sourceNodeVirtual = ctxVirtual.createMediaStreamSource(audioStream as MediaStream);
                const gainNodeVirtual = ctxVirtual.createGain();
                gainNodeVirtual.gain.value = MASTER_AUDIO_VOLUME;
                const destinationVirtual = ctxVirtual.createMediaStreamDestination();

                setPassthroughSourceNodeVirtual(sourceNodeVirtual);
                setPassthroughGainNodeVirtual(gainNodeVirtual);
                setPassthroughDestinationVirtual(destinationVirtual);

                // Connect: source -> gain -> destination
                sourceNodeVirtual
                    .connect(gainNodeVirtual)
                    .connect(destinationVirtual);

                // Route to virtual device
                const audioElVirtual = new Audio();
                audioElVirtual.srcObject = destinationVirtual.stream;
                audioElVirtual.volume = 1.0; // Already controlled by gain node
                setPassThroughAudioElVirtual(audioElVirtual);

                if ('setSinkId' in audioElVirtual) {
                    await (audioElVirtual as any).setSinkId(virtualOutputDeviceId);
                    logToDebug('🔁 Passthrough restarted → VB-CABLE (WebAudio, 1% gain)');
                }
                await audioElVirtual.play();
                return;
            } catch (error) {
                logToDebug(`⚠️ WebAudio passthrough restart failed: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
        }

        // Headphones/default: rebuild WebAudio graph fresh
        try {
            if (passthroughCtx && passthroughCtx.state !== 'closed') {
                await passthroughCtx.close();
            }
        } catch { }
        const newCtx = new AudioContext();
        setPassthroughCtx(newCtx);
        if (newCtx.state === 'suspended') {
            try {
                await newCtx.resume();
            } catch { }
        }
        try {
            const sourceNode = newCtx.createMediaStreamSource(audioStream as MediaStream);
            const gainNode = newCtx.createGain();
            gainNode.gain.value = MASTER_AUDIO_VOLUME;
            setPassthroughSourceNode(sourceNode);
            setPassthroughGainNode(gainNode);
            sourceNode.connect(gainNode).connect(newCtx.destination);
            logToDebug('🔊 Passthrough restarted → Default output (WebAudio, 1% gain)');
        } catch (e) {
            logToDebug('⚠️ WebAudio restart failed, attempting HTMLAudio fallback');
            // Fallback to HTMLAudio element
            try {
                if (passThroughAudioEl) {
                    passThroughAudioEl.pause();
                    (passThroughAudioEl as any).srcObject = null;
                }
            } catch { }
            const audioEl = new Audio();
            (audioEl as any).autoplay = true;
            (audioEl as any).playsInline = true;
            (audioEl as any).srcObject = audioStream as any;
            audioEl.volume = MASTER_AUDIO_VOLUME;
            setPassThroughAudioEl(audioEl);
            try {
                audioEl.muted = true;
                await audioEl.play();
                audioEl.muted = false;
                logToDebug('🔊 Passthrough restarted → Default output (HTMLAudio, 1% volume)');
            } catch { }
        }
    } catch (e) {
        console.warn('Passthrough restart failed:', e);
    }
}
