// ===== Virtual Output Detection & Passthrough =====

// Context interface for dependencies from renderer.ts
export interface AudioPassthroughContext {
    // State variables (getters/setters)
    get audioStream(): MediaStream | null;
    get virtualOutputDeviceId(): string | null;
    set virtualOutputDeviceId(value: string | null);
    get outputToVirtualDevice(): boolean;
    get isRecording(): boolean;
    get microphoneSelect(): HTMLSelectElement;
    
    // Audio nodes and elements
    get passThroughAudioEl(): HTMLAudioElement | null;
    set passThroughAudioEl(value: HTMLAudioElement | null);
    get passThroughAudioElVirtual(): HTMLAudioElement | null;
    set passThroughAudioElVirtual(value: HTMLAudioElement | null);
    get passthroughCtx(): AudioContext | null;
    set passthroughCtx(value: AudioContext | null);
    get passthroughSourceNode(): MediaStreamAudioSourceNode | null;
    set passthroughSourceNode(value: MediaStreamAudioSourceNode | null);
    get passthroughGainNode(): GainNode | null;
    set passthroughGainNode(value: GainNode | null);
    get passthroughCtxVirtual(): AudioContext | null;
    set passthroughCtxVirtual(value: AudioContext | null);
    get passthroughSourceNodeVirtual(): MediaStreamAudioSourceNode | null;
    set passthroughSourceNodeVirtual(value: MediaStreamAudioSourceNode | null);
    get passthroughGainNodeVirtual(): GainNode | null;
    set passthroughGainNodeVirtual(value: GainNode | null);
    get passthroughDestinationVirtual(): MediaStreamAudioDestinationNode | null;
    set passthroughDestinationVirtual(value: MediaStreamAudioDestinationNode | null);
    
    // Bidirectional state
    get bidirectionalInputDeviceId(): string | null;
    set bidirectionalInputDeviceId(value: string | null);
    get bidirectionalUseDisplayAudio(): boolean;
    set bidirectionalUseDisplayAudio(value: boolean);
    
    // Functions
    logToDebug: (message: string) => void;
    initializeAudioStream: () => Promise<void>;
    restartPassthroughClean: () => Promise<void>;
    startPerAppMediaStream: (pid: number) => Promise<MediaStream>;
    setBidirectionalInputDeviceId: (id: string | null) => void;
    setBidirectionalUseDisplayAudio: (value: boolean) => void;
}

let ctx: AudioPassthroughContext | null = null;

// Initialize the module with context
export function initializeAudioPassthrough(context: AudioPassthroughContext): void {
    ctx = context;
}

async function detectVirtualOutputDevice(): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        // Prefer VB-CABLE playback device label "CABLE Input" on Windows
        const preferredCableInput = outputs.find(d => /cable\s*input/i.test(d.label));
        const preferredGeneric = outputs.find(d => /vb-audio|virtual|cable/i.test(d.label));
        const chosen = preferredCableInput || preferredGeneric || null;
        ctx.virtualOutputDeviceId = chosen?.deviceId || null;
        if (chosen) {
            ctx.logToDebug(`🎚️ Virtual output detected: ${chosen.label || ctx.virtualOutputDeviceId}`);
        } else {
            ctx.logToDebug('ℹ️ No VB-CABLE output detected. Will use default system output for playback.');
        }
    } catch (e) {
        ctx.logToDebug('⚠️ Failed to enumerate audio outputs');
    }
}

// Mic passthrough: route current microphone stream to VB-CABLE (or default output)
async function startPassThrough(): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        if (!ctx.audioStream) {
            ctx.logToDebug('ℹ️ No audio stream available for passthrough');
            return;
        }

        // Prefer routing to virtual device when enabled - use WebAudio for proper volume control
        if (ctx.outputToVirtualDevice && ctx.virtualOutputDeviceId) {
            try {
                // Cleanup previous virtual passthrough if any
                try { if (ctx.passthroughGainNodeVirtual) ctx.passthroughGainNodeVirtual.disconnect(); } catch { }
                try { if (ctx.passthroughSourceNodeVirtual) ctx.passthroughSourceNodeVirtual.disconnect(); } catch { }
                try { if (ctx.passthroughDestinationVirtual) ctx.passthroughDestinationVirtual.disconnect(); } catch { }

                // Create or reuse audio context
                if (!ctx.passthroughCtxVirtual || ctx.passthroughCtxVirtual.state === 'closed') {
                    ctx.passthroughCtxVirtual = new AudioContext();
                }
                if (ctx.passthroughCtxVirtual.state === 'suspended') {
                    await ctx.passthroughCtxVirtual.resume();
                }

                // Create Web Audio graph: source -> gain -> destination
                ctx.passthroughSourceNodeVirtual = ctx.passthroughCtxVirtual.createMediaStreamSource(ctx.audioStream as MediaStream);
                ctx.passthroughGainNodeVirtual = ctx.passthroughCtxVirtual.createGain();

                // Set a very low gain value to prevent blasting (1% = 0.01)
                ctx.passthroughGainNodeVirtual.gain.value = 0.005;

                // Create a destination node to get the processed stream
                ctx.passthroughDestinationVirtual = ctx.passthroughCtxVirtual.createMediaStreamDestination();

                // Connect: source -> gain -> destination
                ctx.passthroughSourceNodeVirtual
                    .connect(ctx.passthroughGainNodeVirtual)
                    .connect(ctx.passthroughDestinationVirtual);

                // Create audio element and route to virtual device
                if (!ctx.passThroughAudioElVirtual) {
                    ctx.passThroughAudioElVirtual = new Audio();
                }
                ctx.passThroughAudioElVirtual.srcObject = ctx.passthroughDestinationVirtual.stream;
                ctx.passThroughAudioElVirtual.volume = 1.0; // Already controlled by gain node

                if ('setSinkId' in ctx.passThroughAudioElVirtual) {
                    await (ctx.passThroughAudioElVirtual as any).setSinkId(ctx.virtualOutputDeviceId);
                    ctx.logToDebug('🔁 Mic passthrough → VB-CABLE (WebAudio, 1% gain)');
                }
                await ctx.passThroughAudioElVirtual.play().catch(() => { });
                return;
            } catch (error) {
                ctx.logToDebug(`⚠️ WebAudio passthrough to VB-CABLE failed: ${error instanceof Error ? error.message : 'Unknown'}`);
                console.warn('Virtual cable passthrough failed:', error);
            }
        }

        // Fallback: route to default/headphones output using WebAudio (more reliable)
        try {
            // Cleanup previous graph if any
            try { if (ctx.passthroughGainNode) ctx.passthroughGainNode.disconnect(); } catch { }
            try { if (ctx.passthroughSourceNode) ctx.passthroughSourceNode.disconnect(); } catch { }
            if (!ctx.passthroughCtx || ctx.passthroughCtx.state === 'closed') {
                ctx.passthroughCtx = new AudioContext();
            }
            if (ctx.passthroughCtx.state === 'suspended') {
                await ctx.passthroughCtx.resume();
            }
            ctx.passthroughSourceNode = ctx.passthroughCtx.createMediaStreamSource(ctx.audioStream as MediaStream);
            ctx.passthroughGainNode = ctx.passthroughCtx.createGain();
            // Reduce gain to 30% to prevent blasting
            ctx.passthroughGainNode.gain.value = 0.3;
            ctx.passthroughSourceNode.connect(ctx.passthroughGainNode).connect(ctx.passthroughCtx.destination);
            ctx.logToDebug('🔊 Mic passthrough → Default output (WebAudio, 30% gain)');
        } catch (playError) {
            ctx.logToDebug('⚠️ WebAudio passthrough failed for default output');
            console.warn('Passthrough WebAudio failed:', playError);
        }
    } catch (e) {
        ctx.logToDebug('⚠️ Failed to start mic passthrough');
        console.warn('Mic passthrough failed:', e);
    }
}

async function stopPassThrough(): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        if (ctx.passThroughAudioEl) { try { ctx.passThroughAudioEl.pause(); } catch { } }
        if (ctx.passThroughAudioElVirtual) { try { ctx.passThroughAudioElVirtual.pause(); } catch { } }

        // Cleanup WebAudio passthrough for headphones
        try { if (ctx.passthroughGainNode) ctx.passthroughGainNode.disconnect(); } catch { }
        try { if (ctx.passthroughSourceNode) ctx.passthroughSourceNode.disconnect(); } catch { }
        try { if (ctx.passthroughCtx && ctx.passthroughCtx.state === 'running') await ctx.passthroughCtx.suspend(); } catch { }

        // Cleanup WebAudio passthrough for virtual cable
        try { if (ctx.passthroughGainNodeVirtual) ctx.passthroughGainNodeVirtual.disconnect(); } catch { }
        try { if (ctx.passthroughSourceNodeVirtual) ctx.passthroughSourceNodeVirtual.disconnect(); } catch { }
        try { if (ctx.passthroughDestinationVirtual) ctx.passthroughDestinationVirtual.disconnect(); } catch { }
        try { if (ctx.passthroughCtxVirtual && ctx.passthroughCtxVirtual.state === 'running') await ctx.passthroughCtxVirtual.suspend(); } catch { }

        ctx.logToDebug('Mic passthrough paused');
    } catch {
        // no-op
    }
}

// Track if user has interacted to enable audio playback
let hasUserInteracted = false;

// Initialize automatic passthrough when app starts
async function initializeAutomaticPassthrough(): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        // Only start if microphone is selected
        if (!ctx.microphoneSelect.value) {
            ctx.logToDebug('ℹ️ No microphone selected, skipping automatic passthrough');
            return;
        }

        ctx.logToDebug('🎙️ Initializing automatic microphone passthrough...');

        // Initialize audio stream first
        await ctx.initializeAudioStream();

        // Start passthrough immediately
        await ctx.restartPassthroughClean();

        ctx.logToDebug('✅ Automatic microphone passthrough started');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ctx.logToDebug(`⚠️ Failed to initialize automatic passthrough: ${errorMessage}`);
        console.warn('Automatic passthrough failed:', error);
    }
}

// Retry passthrough on user interaction if it was blocked
async function retryPassthroughOnInteraction(): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    if (hasUserInteracted || !ctx.audioStream || ctx.outputToVirtualDevice) return;

    if (ctx.passThroughAudioEl && ctx.passThroughAudioEl.paused) {
        try {
            await ctx.passThroughAudioEl.play();
            ctx.logToDebug('🔊 Mic passthrough activated after user interaction');
            hasUserInteracted = true;
        } catch (error) {
            console.warn('Still blocked:', error);
        }
    }
}

// Health check to ensure passthrough stays active
let passthroughHealthCheckInterval: number | null = null;

function startPassthroughHealthCheck(): void {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    // Run health check every 30 seconds
    passthroughHealthCheckInterval = window.setInterval(async () => {
        try {
            // Only check if microphone is selected and we're not recording
            if (!ctx!.microphoneSelect.value || ctx!.isRecording) return;

            // Check if we should have passthrough running
            const shouldHavePassthrough = ctx!.audioStream && !ctx!.isRecording;
            if (!shouldHavePassthrough) return;

            // Check VB Cable passthrough
            const vbPassthroughRunning = ctx!.passThroughAudioElVirtual &&
                !ctx!.passThroughAudioElVirtual.paused &&
                ctx!.passThroughAudioElVirtual.srcObject;

            // Check headphones/default passthrough
            const headphonesPassthroughRunning = (ctx!.passthroughCtx &&
                ctx!.passthroughCtx.state === 'running' &&
                ctx!.passthroughSourceNode &&
                ctx!.passthroughGainNode) ||
                (ctx!.passThroughAudioEl && !ctx!.passThroughAudioEl.paused && ctx!.passThroughAudioEl.srcObject);

            // If neither output is working, restart passthrough
            if (!vbPassthroughRunning && !headphonesPassthroughRunning) {
                ctx!.logToDebug('🏥 Health check: Passthrough not running, attempting restart...');
                await ctx!.restartPassthroughClean();
            }
        } catch (error) {
            // Silent failure - health check shouldn't spam logs
        }
    }, 30000); // 30 second interval

    ctx.logToDebug('🏥 Passthrough health check started (30s interval)');
}

function stopPassthroughHealthCheck(): void {
    if (passthroughHealthCheckInterval) {
        clearInterval(passthroughHealthCheckInterval);
        passthroughHealthCheckInterval = null;
        if (ctx) {
            ctx.logToDebug('🏥 Passthrough health check stopped');
        }
    }
}

async function setupDesktopAudioPassthrough(audioStream: MediaStream): Promise<void> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        // 1) Default/headphones playback
        if (!ctx.passThroughAudioEl) {
            ctx.passThroughAudioEl = new Audio();
        }
        ctx.passThroughAudioEl.srcObject = audioStream as any;
        ctx.passThroughAudioEl.volume = 1.0;

        // 2) VB-CABLE playback on separate element using setSinkId
        if (ctx.outputToVirtualDevice && ctx.virtualOutputDeviceId) {
            if (!ctx.passThroughAudioElVirtual) {
                ctx.passThroughAudioElVirtual = new Audio();
            }
            ctx.passThroughAudioElVirtual.srcObject = audioStream as any;
            ctx.passThroughAudioElVirtual.volume = 1.0;
            if ('setSinkId' in ctx.passThroughAudioElVirtual) {
                try {
                    await (ctx.passThroughAudioElVirtual as any).setSinkId(ctx.virtualOutputDeviceId);
                    ctx.logToDebug('🔁 Desktop audio passthrough → VB-CABLE');
                } catch (e) {
                    ctx.logToDebug('⚠️ Could not route desktop audio to VB-CABLE, using default output only');
                }
            }
        }

        // Start playback(s)
        await Promise.all([
            ctx.passThroughAudioEl.play().catch(() => { }),
            ctx.passThroughAudioElVirtual ? ctx.passThroughAudioElVirtual.play().catch(() => { }) : Promise.resolve()
        ]);
        console.log('✅ Desktop audio passthrough active - headphones and VB-CABLE (if available)');

    } catch (e) {
        ctx.logToDebug('⚠️ Failed to start desktop audio passthrough');
        console.warn('Desktop audio passthrough failed:', e);
    }
}


// Request display/system audio using custom overlay (no getDisplayMedia upfront)
async function requestDisplayAudioWithOverlay(): Promise<{ stream: MediaStream | null; processName: string | null }> {
    if (!ctx) {
        console.error('[renderer] ❌ AudioPassthroughContext not initialized');
        throw new Error('AudioPassthroughContext not initialized');
    }
    
    const isMacOS = (window as any).electronAPI?.platform === 'darwin' || 
                    (typeof process !== 'undefined' && process.platform === 'darwin');
    const addonName = isMacOS ? 'CoreAudio' : 'WASAPI';
    
    console.log(`[renderer] 🔄 Bypassing screen selection overlay - going directly to system-wide ${addonName} capture`);
    console.log(`[renderer] 🔍 Platform check: isMacOS=${isMacOS}, navigator.platform=${navigator.platform}`);

    // Skip all overlay selection and auto-detection logic
    // Go directly to system-wide capture (PID 0)
    try {
        console.log(`[renderer] 🖥️ Starting direct system-wide ${addonName} capture for bidirectional mode (PID 0)...`);
        console.log(`[renderer] 🔍 ctx.startPerAppMediaStream exists:`, typeof ctx.startPerAppMediaStream === 'function');
        
        const pickedStream = await ctx.startPerAppMediaStream(0); // PID 0 = system-wide capture
        
        console.log(`[renderer] ✅ Direct system-wide ${addonName} capture started successfully`);
        console.log(`[renderer] 📊 Stream details: id=${pickedStream?.id}, tracks=${pickedStream?.getAudioTracks()?.length || 0}`);
        
        if (!pickedStream) {
            throw new Error('Stream is null after capture');
        }
        
        return { stream: pickedStream, processName: null }; // Return object with stream and processName
    } catch (e) {
        console.error(`[renderer] ❌ Direct system-wide ${addonName} capture failed:`, e);
        console.error(`[renderer] ❌ Error stack:`, e instanceof Error ? e.stack : 'No stack');
        throw new Error(`System-wide ${addonName} capture failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function fallbackToVBCableIfAvailable(currentDeviceId: string | null): Promise<string | null> {
    if (!ctx) throw new Error('AudioPassthroughContext not initialized');
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cable = devices.find(d => d.kind === 'audioinput' && /vb-?audio|cable input/i.test(d.label));
        if (!cable) return null;
        
        const newDeviceId = cable.deviceId;
        
        // Update both local and shared state
        ctx.bidirectionalInputDeviceId = newDeviceId;
        ctx.setBidirectionalInputDeviceId(newDeviceId);
        ctx.bidirectionalUseDisplayAudio = false;
        ctx.setBidirectionalUseDisplayAudio(false);
        
        // bidirectionalInputSelect value setting removed - now hardcoded
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalInputDeviceId: newDeviceId, bidirectionalUseDisplayAudio: false } }
        });
        console.log('↩️ Falling back to VB-CABLE input device automatically');
        return newDeviceId;
    } catch (error) {
        console.error('Error in fallback to VB-CABLE:', error);
        return null;
    }
}

// Export all functions
export {
    detectVirtualOutputDevice,
    startPassThrough,
    stopPassThrough,
    initializeAutomaticPassthrough,
    retryPassthroughOnInteraction,
    startPassthroughHealthCheck,
    stopPassthroughHealthCheck,
    setupDesktopAudioPassthrough,
    requestDisplayAudioWithOverlay,
    fallbackToVBCableIfAvailable
};
