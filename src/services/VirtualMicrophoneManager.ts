import { VirtualMicrophoneService, VirtualDeviceInfo, AudioFormat } from '../interfaces/VirtualMicrophoneService';

/**
 * Manages virtual microphone output for translated audio
 */
export class VirtualMicrophoneManager implements VirtualMicrophoneService {
    private audioContext: AudioContext | null = null;
    private outputNode: AudioNode | null = null;
    private isConnected: boolean = false;
    private fallbackAudio: HTMLAudioElement | null = null;
    private isStreamActive: boolean = false;
    private audioFormat: AudioFormat = {
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
        encoding: 'pcm'
    };

    constructor() {
        this.initializeAudioContext();
    }

    private async initializeAudioContext(): Promise<void> {
        try {
            this.audioContext = new AudioContext();
            
            // Create a gain node for output control
            this.outputNode = this.audioContext.createGain();
            this.outputNode.connect(this.audioContext.destination);
            
        } catch (error) {
            console.warn('Failed to initialize audio context:', error);
        }
    }

    async initialize(): Promise<void> {
        await this.initializeAudioContext();
    }

    async sendAudio(audioBuffer: ArrayBuffer): Promise<void> {
        // Auto-connect if not connected
        if (!this.isConnected) {
            await this.startStream();
        }

        // Check if we're in a browser environment (renderer process)
        const isBrowserEnvironment = typeof window !== 'undefined' && typeof AudioContext !== 'undefined';
        
        if (!isBrowserEnvironment) {
            console.log('🔊 Virtual microphone output skipped - running in main process (Node.js environment)');
            console.log('   For real-time mode, audio would be sent to virtual microphone in renderer process');
            // For now, play audio in the app like test translation does
            await this.playAudio({ audioBuffer });
            return;
        }

        try {
            await this.playAudioBuffer(audioBuffer);
        } catch (error) {
            // Fallback to system audio output
            console.warn('Virtual microphone output failed, using fallback:', error);
            await this.playAudioFallback(audioBuffer);
        }
    }

    isAvailable(): boolean {
        return !!this.audioContext;
    }

    getDeviceInfo(): VirtualDeviceInfo {
        return {
            name: 'Virtual Microphone Output',
            id: 'virtual-mic-output',
            connected: this.isConnected,
            status: this.isConnected ? 'ready' : 'unavailable',
            supportedFormats: [this.audioFormat]
        };
    }

    async startStream(): Promise<void> {
        this.isStreamActive = true;
        this.isConnected = true;
    }

    stopStream(): void {
        this.isStreamActive = false;
        this.isConnected = false;
    }

    isStreaming(): boolean {
        return this.isStreamActive;
    }

    setAudioFormat(format: AudioFormat): void {
        this.audioFormat = format;
    }

    getAudioFormat(): AudioFormat {
        return this.audioFormat;
    }

    // Legacy methods for compatibility
    async getAvailableDevices(): Promise<any[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            
            return audioOutputs.map(device => ({
                id: device.deviceId,
                name: device.label || 'Unknown Device',
                type: 'virtual',
                isConnected: true,
                isDefault: device.deviceId === 'default'
            }));

        } catch (error) {
            console.warn('Failed to enumerate audio devices:', error);
            return [{
                id: 'default',
                name: 'Default Audio Output',
                type: 'virtual',
                isConnected: true,
                isDefault: true
            }];
        }
    }

    async connectToDevice(deviceId: string): Promise<boolean> {
        try {
            await this.startStream();
            return true;
        } catch (error) {
            console.error('Failed to connect to virtual device:', error);
            return false;
        }
    }

    async playAudio(request: { audioBlob?: Blob; audioBuffer?: ArrayBuffer }): Promise<void> {
        // For playAudio, we always output to system speakers (headphones)
        // This is used for test mode and "hear yourself" functionality
        
        // Check if we're in a browser environment (renderer process)
        const isBrowserEnvironment = typeof window !== 'undefined' && typeof Audio !== 'undefined';
        
        if (!isBrowserEnvironment) {
            console.log('🔊 Audio playback skipped - running in main process (Node.js environment)');
            console.log('   Audio would be played in the renderer process during actual usage');
            return; // Don't fail, just skip audio playback in main process
        }
        
        try {
            if (request.audioBlob) {
                await this.playAudioBlob(request.audioBlob);
            } else if (request.audioBuffer) {
                await this.playAudioBuffer(request.audioBuffer);
            } else {
                throw new Error('No audio data provided');
            }
        } catch (error) {
            console.warn('Audio playback failed, trying fallback:', error);
            // Try fallback method
            if (request.audioBuffer) {
                await this.playAudioFallback(request.audioBuffer);
            } else if (request.audioBlob) {
                const arrayBuffer = await request.audioBlob.arrayBuffer();
                await this.playAudioFallback(arrayBuffer);
            }
        }
    }

    private async playAudioBlob(audioBlob: Blob): Promise<void> {
        // Check if we're in a browser environment
        if (typeof Audio === 'undefined' || typeof URL === 'undefined') {
            throw new Error('Browser APIs not available - cannot play audio blob');
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const url = URL.createObjectURL(audioBlob);
            
            audio.onended = () => {
                URL.revokeObjectURL(url);
                resolve();
            };
            
            audio.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(error);
            };
            
            audio.src = url;
            audio.play().catch(reject);
        });
    }

    private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
        if (!this.audioContext) {
            throw new Error('Audio context not available');
        }

        try {
            const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            
            if (this.outputNode) {
                source.connect(this.outputNode);
            } else {
                source.connect(this.audioContext.destination);
            }
            
            return new Promise((resolve, reject) => {
                source.onended = () => resolve();
                // AudioBufferSourceNode doesn't have onerror, handle errors in catch block
                source.start();
            });

        } catch (error) {
            throw new Error(`Failed to play audio buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async playAudioFallback(audioBuffer: ArrayBuffer): Promise<void> {
        try {
            // Check if we're in a browser environment
            if (typeof Audio === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
                throw new Error('Browser APIs not available - cannot use fallback audio');
            }

            const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

            // Use HTML5 audio element as fallback
            if (!this.fallbackAudio) {
                this.fallbackAudio = new Audio();
            }

            const url = URL.createObjectURL(audioBlob);
            this.fallbackAudio.src = url;
            
            return new Promise((resolve, reject) => {
                if (!this.fallbackAudio) {
                    reject(new Error('Fallback audio not available'));
                    return;
                }

                this.fallbackAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                
                this.fallbackAudio.onerror = (error) => {
                    URL.revokeObjectURL(url);
                    reject(error);
                };
                
                this.fallbackAudio.play().catch(reject);
            });

        } catch (error) {
            throw new Error(`Fallback audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.fallbackAudio) {
                this.fallbackAudio.pause();
                this.fallbackAudio.src = '';
            }

            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
            }

            this.isConnected = false;

        } catch (error) {
            console.warn('Error during disconnect:', error);
        }
    }

    isDeviceConnected(): boolean {
        return this.isConnected;
    }

    async getDeviceStatus(deviceId: string): Promise<string> {
        if (deviceId === 'default' && this.isConnected) {
            return 'connected';
        }
        return 'disconnected';
    }

    /**
     * Set output volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        if (this.outputNode && 'gain' in this.outputNode) {
            (this.outputNode as GainNode).gain.value = Math.max(0, Math.min(1, volume));
        }
        
        if (this.fallbackAudio) {
            this.fallbackAudio.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Test virtual microphone output
     */
    async testOutput(): Promise<boolean> {
        try {
            // Create a simple test tone
            if (!this.audioContext) {
                await this.initializeAudioContext();
            }

            if (!this.audioContext) {
                return false;
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 440; // A4 note
            gainNode.gain.value = 0.1; // Low volume
            
            oscillator.start();
            
            // Play for 200ms
            setTimeout(() => {
                oscillator.stop();
            }, 200);
            
            return true;

        } catch (error) {
            console.warn('Virtual microphone test failed:', error);
            return false;
        }
    }
}