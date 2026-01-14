/**
 * Mini overlay renderer - handles basic overlay communication and status indicators
 */
class MiniOverlayRenderer {
  private audioIndicator: HTMLElement | null = null;
  private voiceIndicator: HTMLElement | null = null;
  private screenIndicator: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;

  constructor() {
    try {
      this.initializeElements();
      this.setupIPCListeners();
      console.log('Mini overlay renderer initialized');
    } catch (error) {
      console.error('Error initializing mini overlay renderer:', error);
    }
  }

  /**
   * Initialize DOM element references
   */
  private initializeElements(): void {
    this.audioIndicator = document.getElementById('audio-indicator');
    this.voiceIndicator = document.getElementById('voice-indicator');
    this.screenIndicator = document.getElementById('screen-indicator');
    this.statusText = document.querySelector('.status-text');
  }

  /**
   * Setup IPC listeners for communication with main process
   */
  private setupIPCListeners(): void {
    console.log('📡 Setting up mini overlay IPC listeners...');

    // Listen for audio detection state
    if ((window as any).electronAPI?.onAudioDetected) {
      (window as any).electronAPI.onAudioDetected((isDetected: boolean) => {
        console.log('🔴 Received audio detection event:', isDetected);
        this.updateAudioIndicator(isDetected);
      });
      console.log('✅ Audio detection listener registered');
    } else {
      console.error('❌ onAudioDetected not available');
    }

    // Listen for voice translation state
    if ((window as any).electronAPI?.onVoiceTranslation) {
      (window as any).electronAPI.onVoiceTranslation((isActive: boolean) => {
        console.log('🔵 Received voice translation event:', isActive);
        this.updateVoiceIndicator(isActive);
      });
      console.log('✅ Voice translation listener registered');
    } else {
      console.error('❌ onVoiceTranslation not available');
    }

    // Listen for screen translation state
    if ((window as any).electronAPI?.onScreenTranslation) {
      (window as any).electronAPI.onScreenTranslation((state: 'off' | 'processing' | 'showing') => {
        console.log('🟠 Received screen translation event:', state);
        this.updateScreenIndicator(state);
      });
      console.log('✅ Screen translation listener registered');
    } else {
      console.error('❌ onScreenTranslation not available');
    }

    // Listen for status text updates
    (window as any).electronAPI?.onStatusUpdate?.((status: string) => {
      this.updateStatusText(status);
    });

    // Listen for ping health checks - pong is sent automatically by preload
    (window as any).electronAPI?.onPing?.(() => {
      console.log('Mini overlay ping received, responding with pong');
    });

    // Listen for cleanup requests
    (window as any).electronAPI?.onCleanupResources?.(() => {
      this.cleanup();
    });
  }

  /**
   * Update audio detection indicator
   */
  private updateAudioIndicator(isActive: boolean): void {
    console.log('🔴 Mini overlay: Audio indicator update:', isActive);
    if (!this.audioIndicator) {
      console.error('🔴 Audio indicator element not found!');
      return;
    }

    if (isActive) {
      this.audioIndicator.classList.add('audio-active');
    } else {
      this.audioIndicator.classList.remove('audio-active');
    }
  }

  /**
   * Update voice translation indicator
   */
  private updateVoiceIndicator(isActive: boolean): void {
    console.log('🔵 Mini overlay: Voice indicator update:', isActive);
    if (!this.voiceIndicator) {
      console.error('🔵 Voice indicator element not found!');
      return;
    }

    if (isActive) {
      this.voiceIndicator.classList.add('voice-active');
    } else {
      this.voiceIndicator.classList.remove('voice-active');
    }
  }

  /**
   * Update screen translation indicator
   */
  private updateScreenIndicator(state: 'off' | 'processing' | 'showing'): void {
    console.log('🟠 Mini overlay: Screen indicator update:', state);
    if (!this.screenIndicator) {
      console.error('🟠 Screen indicator element not found!');
      return;
    }

    // Remove all screen classes first
    this.screenIndicator.classList.remove('screen-active', 'screen-processing');

    if (state === 'processing') {
      this.screenIndicator.classList.add('screen-processing');
    } else if (state === 'showing') {
      this.screenIndicator.classList.add('screen-active');
    }
    // If 'off', no classes are added
  }

  /**
   * Update status text
   */
  private updateStatusText(status: string): void {
    if (!this.statusText) return;
    this.statusText.textContent = status;
  }

  /**
   * Cleanup renderer resources
   */
  private cleanup(): void {
    try {
      // Reset all indicators
      this.updateAudioIndicator(false);
      this.updateVoiceIndicator(false);
      this.updateScreenIndicator('off');
      this.updateStatusText('Ready');
      console.log('Mini overlay renderer cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Initialize mini overlay renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MiniOverlayRenderer();
});

// Export for potential external use
(window as any).MiniOverlayRenderer = MiniOverlayRenderer;
