import { EventEmitter } from 'events';

/**
 * macOS Screen Capture Audio Service
 * Uses Electron's desktopCapturer API to capture system audio
 * This is the standard way to capture system audio on macOS without virtual devices
 */
export class MacOSScreenCaptureAudio extends EventEmitter {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isCapturing = false;

  constructor() {
    super();
  }

  /**
   * Start capturing system audio via screen capture
   */
  public async start(): Promise<void> {
    if (this.isCapturing) {
      console.log('[MacOSScreenCaptureAudio] Already capturing');
      return;
    }

    try {
      console.log('[MacOSScreenCaptureAudio] Starting screen capture audio...');

      // Get desktop capturer sources (we need this to capture audio)
      const sources = await (window as any).electronAPI.getDesktopSources(['screen']);
      
      if (!sources || sources.length === 0) {
        throw new Error('No screen sources available for audio capture');
      }

      // Use the first screen source
      const screenSource = sources[0];
      console.log('[MacOSScreenCaptureAudio] Using screen source:', screenSource.name);

      // Request screen capture with audio
      // @ts-ignore - Electron-specific constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-ignore - Electron-specific constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        },
        video: {
          // @ts-ignore - Electron-specific constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id,
            maxWidth: 1,
            maxHeight: 1,
            maxFrameRate: 1
          }
        }
      });

      // We only care about audio, stop the video track
      const videoTracks = this.mediaStream.getVideoTracks();
      videoTracks.forEach(track => track.stop());

      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available from screen capture');
      }

      console.log('[MacOSScreenCaptureAudio] Audio track obtained:', audioTracks[0].label);

      // Create audio context for processing
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio data
      const bufferSize = 4096;
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Emit PCM data
        this.emit('data', Buffer.from(pcmData.buffer));
      };

      // Connect the audio graph
      audioSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.isCapturing = true;
      this.emit('started');
      console.log('[MacOSScreenCaptureAudio] ✅ Screen capture audio started successfully');

    } catch (error) {
      console.error('[MacOSScreenCaptureAudio] Failed to start screen capture audio:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop capturing audio
   */
  public stop(): void {
    if (!this.isCapturing) {
      return;
    }

    console.log('[MacOSScreenCaptureAudio] Stopping screen capture audio...');
    this.cleanup();
    this.isCapturing = false;
    this.emit('stopped');
    console.log('[MacOSScreenCaptureAudio] Screen capture audio stopped');
  }

  /**
   * Check if currently capturing
   */
  public get active(): boolean {
    return this.isCapturing;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
}

export default MacOSScreenCaptureAudio;
