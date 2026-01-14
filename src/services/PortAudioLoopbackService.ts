import { EventEmitter } from 'events';
import { SplitOverlayWindowManager } from './SplitOverlayWindowManager';

export interface LoopbackOptions {
  sampleRate?: number; // default 48000
  channels?: number;   // default 2
  frameSize?: number;  // default 1024
  /** Optional PortAudio device id (number) or exact string id; overrides auto-selection */
  deviceId?: number | string;
  /** Optional substring to match a device name (e.g., 'CABLE Output', 'Speakers (Realtek)') */
  deviceNameContains?: string;
}

export interface LoopbackDataEvent {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  timestampMs: number;
}

/**
 * PortAudio-based system loopback capture using naudiodon (WASAPI loopback on Windows).
 * This opens the default render device's loopback input and emits Float32 frames.
 */
export class PortAudioLoopbackService extends EventEmitter {
  private portAudio: any | null = null;
  private stream: any | null = null;
  private isCapturing = false;
  private audioDetectionThreshold = 0.01; // RMS threshold for audio detection
  private lastAudioDetectionUpdate = 0;
  private audioDetectionUpdateInterval = 250; // Update mini overlay every 250ms

  constructor() {
    super();
    // Lazy require to allow optional dependency
    try {
      // Some naudiodon builds pull in segfault-handler. Intercept and stub it to avoid ABI rebuild issues.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Module = require('module');
      const originalLoad = Module._load;
      Module._load = function(request: string, parent: any, isMain: boolean) {
        if (request === 'segfault-handler') {
          return { registerHandler: () => {} };
        }
        // @ts-ignore
        return originalLoad.apply(this, arguments as any);
      } as any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.portAudio = require('naudiodon');
      } finally {
        Module._load = originalLoad;
      }
    } catch (err) {
      throw new Error(`PortAudio (naudiodon) not available: ${String(err)}`);
    }
  }

  public start(options: LoopbackOptions = {}): void {
    if (this.isCapturing) return;
    if (!this.portAudio) throw new Error('PortAudio not initialized');

    const sampleRate = options.sampleRate ?? 48000;
    const requestedChannels = options.channels ?? 2;
    const frameSize = options.frameSize ?? 1024;

    const devices = (this.portAudio.getDevices?.() || []) as Array<any>;
    if (!devices || devices.length === 0) {
      throw new Error('No PortAudio devices found');
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGlobal = global as any;
      if (!anyGlobal.__pa_devices_logged) {
        anyGlobal.__pa_devices_logged = true;
        // eslint-disable-next-line no-console
        console.log('🎚️ All PortAudio devices:', devices.map((d: any, i: number) => ({
          idx: i,
          id: (d?.id ?? d?.deviceId ?? d?.index ?? d?.deviceIndex),
          name: d?.name,
          host: (d?.hostAPIName || d?.hostAPI),
          maxInputChannels: d?.maxInputChannels,
          maxOutputChannels: d?.maxOutputChannels
        })));
      }
    } catch {}

    // Find a WASAPI loopback input device (name usually contains "(loopback)")
    // If caller specified an explicit device, try to find it first (by id or name substring)
    let device: any | undefined = undefined;
    const getId = (d: any) => (d?.id ?? d?.deviceId ?? d?.index ?? d?.deviceIndex);
    const getHost = (d: any) => (d?.hostAPIName || d?.hostAPI || '').toString();
    const getName = (d: any) => (d?.name || '').toString();

    if (options.deviceId !== undefined && options.deviceId !== null) {
      device = devices.find(d => String(getId(d)) === String(options.deviceId));
    }
    if (!device && options.deviceNameContains) {
      const needle = options.deviceNameContains.toLowerCase();
      device = devices.find(d => getName(d).toLowerCase().includes(needle));
    }

    // If selected device is not WASAPI output, attempt to find a matching WASAPI output with similar name
    if (device && (!/wasapi/i.test(getHost(device)) || Number(device?.maxOutputChannels ?? 0) === 0)) {
      const base = getName(device).toLowerCase().replace(/\(.*?\)/g, '').trim();
      const wasapiMatch = devices.find(d => /wasapi/i.test(getHost(d)) && Number(d?.maxOutputChannels ?? 0) > 0 && getName(d).toLowerCase().includes(base.substring(0, Math.min(10, base.length))));
      if (wasapiMatch) device = wasapiMatch;
    }

    // Prefer explicit WASAPI loopback inputs, but fall back to the chosen output device if none detected.
    const loopbacks = device ? [device] : devices.filter(d => {
      const name = (d?.name || '').toString();
      const host = (d?.hostAPIName || d?.hostAPI || '').toString().toLowerCase();
      const maxIn = Number(d?.maxInputChannels ?? d?.maxInputChannels);
      const isLoop = /\(loopback\)/i.test(name) || /wasapi.*loopback/i.test(name.toLowerCase());
      return maxIn > 0 && (isLoop || host.includes('wasapi'));
    });
    device = loopbacks.find((d: any) => /\(loopback\)/i.test((d?.name || '').toString())) || loopbacks[0] || device;
    // Prefer known system mix sources if present
    if (!device) {
      const stereoMix = devices.find(d => /stereo\s*mix/i.test((d?.name || '').toString()) && Number(d?.maxInputChannels ?? 0) > 0);
      if (stereoMix) device = stereoMix;
    }
    if (!device) {
      const cableOut = devices.find(d => /cable\s*output/i.test((d?.name || '').toString()) && Number(d?.maxInputChannels ?? 0) > 0);
      if (cableOut) device = cableOut;
    }
    if (!device) {
      // Fallback: pick the output device matching the provided hint first (if any)
      if (options.deviceNameContains) {
        const needle = options.deviceNameContains.toLowerCase();
        const byNameOut = devices.find(d => Number(d?.maxOutputChannels ?? 0) > 0 && (d?.name || '').toString().toLowerCase().includes(needle));
        if (byNameOut) device = byNameOut;
      }
      if (!device && options.deviceId !== undefined && options.deviceId !== null) {
        const byIdOut = devices.find(d => Number(d?.maxOutputChannels ?? 0) > 0 && String(d?.id ?? d?.deviceId ?? d?.index ?? d?.deviceIndex) === String(options.deviceId));
        if (byIdOut) device = byIdOut;
      }
      // As a last resort, choose any WASAPI output device
      if (!device) {
        device = devices.find(d => Number(d?.maxOutputChannels ?? d?.maxOutputChannels) > 0 && /wasapi/i.test((d?.hostAPIName || d?.hostAPI || '').toString()));
      }
    }
    if (!device) {
      throw new Error('No WASAPI loopback input device found. Ensure Windows default playback is active and naudiodon supports loopback on this system.');
    }

    // Create input stream - support both naudiodon APIs (AudioInput vs AudioIO)
    const deviceId = (device.id ?? device.deviceId ?? device.index ?? device.deviceIndex);
    const sampleFormat = this.portAudio.SampleFormat32Bit || this.portAudio.SampleFormatFloat32 || 8; // fallback enum value
    const maxIn = Number(device?.maxInputChannels ?? 0);
    const maxOut = Number(device?.maxOutputChannels ?? 0);
    const hostName = (device?.hostAPIName || device?.hostAPI || '').toString();
    let channelCount = requestedChannels;
    // For WASAPI loopback using an output-only device (maxInputChannels == 0), many builds require channelCount = 1
    if (/wasapi/i.test(hostName) && maxIn === 0 && maxOut > 0) {
      channelCount = 1;
    } else if (maxIn > 0) {
      channelCount = Math.min(channelCount, maxIn);
    } else if (maxOut > 0) {
      channelCount = Math.min(channelCount, maxOut);
    } else {
      channelCount = 1; // conservative fallback
    }

    const tryStart = (ch: number) => {
      if (this.portAudio.AudioInput) {
        const s = new this.portAudio.AudioInput({
          deviceId: deviceId,
          channelCount: ch,
          sampleFormat,
          sampleRate,
          framesPerBuffer: frameSize
        });
        s.on('data', (buffer: Buffer) => this.forwardBuffer(buffer, sampleRate, ch));
        s.on('error', (_err: any) => { try { this.emit('error', _err); } catch {} });
        s.start();
        return s;
      } else if (this.portAudio.AudioIO) {
        const s = new this.portAudio.AudioIO({
          inOptions: {
            deviceId: deviceId,
            channelCount: ch,
            sampleFormat,
            sampleRate,
            framesPerBuffer: frameSize,
            closeOnError: true
          }
        });
        s.on('data', (buffer: Buffer) => this.forwardBuffer(buffer, sampleRate, ch));
        s.on('error', (_err: any) => { try { this.emit('error', _err); } catch {} });
        s.start();
        return s;
      }
      return null;
    };

    // Dynamic channel retry to satisfy device constraints
    const candidates: number[] = [];
    if (maxIn > 0) candidates.push(Math.min(requestedChannels, maxIn));
    if (maxOut > 0) candidates.push(Math.min(requestedChannels, maxOut));
    // Add common fallbacks
    [8, 6, 4, 2, 1].forEach(c => { if (!candidates.includes(c)) candidates.push(c); });
    let started = false;
    for (const ch of candidates) {
      if (ch <= 0) continue;
      try {
        const s = tryStart(ch);
        if (s) {
          this.stream = s;
          channelCount = ch;
          started = true;
          break;
        }
      } catch (e) {
        // try next candidate
      }
    }

    if (!started) {
      throw new Error('Failed to start PortAudio loopback stream after trying channel configurations');
    }

    // Surface chosen device for debugging
    try {
      // eslint-disable-next-line no-console
      console.log('🎛️ PortAudio loopback device:', { name: device.name, id: deviceId, host: (device.hostAPIName || device.hostAPI), maxInputChannels: device.maxInputChannels, maxOutputChannels: device.maxOutputChannels, channelCount });
    } catch {}

    this.isCapturing = true;
    this.emit('started');
  }

  public stop(): void {
    if (!this.isCapturing) return;
    try {
      if (this.stream) {
        try { this.stream.stop(); } catch {}
        try { this.stream.quit?.(); } catch {}
        try { this.stream.destroy?.(); } catch {}
      }
    } finally {
      this.stream = null;
      this.isCapturing = false;
      this.emit('stopped');
    }
  }

  public get active(): boolean {
    return this.isCapturing;
  }

  private forwardBuffer(buffer: Buffer, sampleRate: number, channels: number): void {
    try {
      const floatView = new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 4));
      const copy = new Float32Array(floatView.length);
      copy.set(floatView);
      const evt: LoopbackDataEvent = {
        samples: copy,
        sampleRate,
        channels,
        timestampMs: Date.now()
      };
      this.emit('data', evt);

      // Calculate RMS to detect audio activity
      this.detectAudioActivity(copy);
    } catch {}
  }

  /**
   * Detect audio activity and update mini overlay indicator
   */
  private detectAudioActivity(samples: Float32Array): void {
    // Calculate RMS (Root Mean Square) to measure audio level
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);

    // Update mini overlay indicator (throttled to avoid excessive updates)
    const now = Date.now();
    if (now - this.lastAudioDetectionUpdate >= this.audioDetectionUpdateInterval) {
      const hasAudio = rms > this.audioDetectionThreshold;
      try {
        const overlayManager = SplitOverlayWindowManager.getInstance();
        overlayManager.updateAudioDetected(hasAudio);
      } catch (error) {
        // Ignore errors if overlay not available
      }
      this.lastAudioDetectionUpdate = now;
    }
  }
}

export default PortAudioLoopbackService;


