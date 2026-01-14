import { AudioCaptureService } from '../services/AudioCaptureService';
import { VoiceActivityDetector, VoiceActivity } from '../services/VoiceActivityDetector';
import { AudioProcessingPipeline } from '../services/AudioProcessingPipeline';

export interface AudioLevelData {
  volume: number;
  peak: number;
  average: number;
}

export class AudioCaptureControls {
  private captureService: AudioCaptureService;
  private voiceDetector: VoiceActivityDetector;
  private processingPipeline: AudioProcessingPipeline;
  
  private startButton!: HTMLButtonElement;
  private stopButton!: HTMLButtonElement;
  private statusIndicator!: HTMLElement;
  private levelMeter!: HTMLElement;
  private levelBar!: HTMLElement;
  private voiceIndicator!: HTMLElement;
  
  private isRecording = false;
  private audioLevels: number[] = [];
  private animationFrame: number | null = null;

  constructor(
    captureService: AudioCaptureService,
    voiceDetector: VoiceActivityDetector,
    processingPipeline: AudioProcessingPipeline,
    containerId: string
  ) {
    this.captureService = captureService;
    this.voiceDetector = voiceDetector;
    this.processingPipeline = processingPipeline;
    
    this.createUI(containerId);
    this.setupEventListeners();
  }

  private createUI(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }

    container.innerHTML = `
      <div class="audio-capture-controls">
        <div class="control-buttons">
          <button id="start-capture" class="capture-button start-button">
            <i class="icon-microphone"></i>
            <span>Start Recording</span>
          </button>
          <button id="stop-capture" class="capture-button stop-button" disabled>
            <i class="icon-stop"></i>
            <span>Stop Recording</span>
          </button>
        </div>
        
        <div class="audio-status">
          <div id="status-indicator" class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Ready to record</span>
          </div>
          
          <div id="voice-indicator" class="voice-indicator">
            <i class="icon-voice"></i>
            <span class="voice-text">No voice detected</span>
          </div>
        </div>
        
        <div class="audio-levels">
          <label class="level-label">Audio Level:</label>
          <div id="level-meter" class="level-meter">
            <div id="level-bar" class="level-bar"></div>
            <div class="level-markers">
              <span class="marker low">Low</span>
              <span class="marker medium">Medium</span>
              <span class="marker high">High</span>
            </div>
          </div>
          <div class="level-info">
            <span id="level-value" class="level-value">0%</span>
            <span id="peak-value" class="peak-value">Peak: 0%</span>
          </div>
        </div>
      </div>
    `;

    // Get references to UI elements
    this.startButton = container.querySelector('#start-capture') as HTMLButtonElement;
    this.stopButton = container.querySelector('#stop-capture') as HTMLButtonElement;
    this.statusIndicator = container.querySelector('#status-indicator') as HTMLElement;
    this.levelMeter = container.querySelector('#level-meter') as HTMLElement;
    this.levelBar = container.querySelector('#level-bar') as HTMLElement;
    this.voiceIndicator = container.querySelector('#voice-indicator') as HTMLElement;
  }

  private setupEventListeners(): void {
    // Button event listeners
    this.startButton.addEventListener('click', () => this.startRecording());
    this.stopButton.addEventListener('click', () => this.stopRecording());

    // Capture service events
    this.captureService.on('captureStarted', () => {
      this.updateRecordingState(true);
      this.startLevelMonitoring();
    });

    this.captureService.on('captureStopped', () => {
      this.updateRecordingState(false);
      this.stopLevelMonitoring();
    });

    this.captureService.on('audioData', (audioData: any) => {
      this.updateAudioLevels(audioData);
    });

    this.captureService.on('audioSegment', async (segment: any) => {
      // Process segment through pipeline and voice detection
      try {
        const processedSegment = await this.processingPipeline.processSegment(segment);
        const voiceActivity = this.voiceDetector.analyzeSegment(processedSegment);
        this.updateVoiceIndicator(voiceActivity);
      } catch (error) {
        console.error('Error processing audio segment:', error);
      }
    });

    // Voice detector events
    this.voiceDetector.on('voiceStarted', (event: any) => {
      this.updateVoiceStatus('Voice detected', 'active');
    });

    this.voiceDetector.on('voiceEnded', (event: any) => {
      this.updateVoiceStatus('Voice ended', 'inactive');
    });

    this.voiceDetector.on('activityUpdate', (activity: VoiceActivity) => {
      this.updateVoiceIndicator(activity);
    });

    // Keyboard shortcuts (use dynamic key from UI, fallback to Space)
    document.addEventListener('keydown', (event) => {
      const uiSpan = document.getElementById('current-keybind');
      const configured = (uiSpan?.textContent || 'SPACE').toUpperCase();
      const code = event.code;
      const isMatch = (configured === 'SPACE' && code === 'Space') || (configured.length === 1 && code === `Key${configured}`);
      if (isMatch && event.ctrlKey) {
        event.preventDefault();
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      }
    });
  }

  private async startRecording(): Promise<void> {
    try {
      this.updateStatus('Starting...', 'loading');
      this.startButton.disabled = true;
      
      // Send recording start to overlay
      this.sendRecordingStateToOverlay(true);
      
      await this.captureService.startCapture();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.updateStatus('Failed to start recording', 'error');
      this.startButton.disabled = false;
      
      // Send recording stop to overlay on error
      this.sendRecordingStateToOverlay(false);
      
      // Show user-friendly error message
      this.showErrorMessage(error as Error);
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      this.updateStatus('Stopping...', 'loading');
      this.stopButton.disabled = true;
      
      // Send recording stop to overlay
      this.sendRecordingStateToOverlay(false);
      
      await this.captureService.stopCapture();
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.updateStatus('Failed to stop recording', 'error');
    } finally {
      this.stopButton.disabled = false;
    }
  }

  private updateRecordingState(isRecording: boolean): void {
    this.isRecording = isRecording;
    
    this.startButton.disabled = isRecording;
    this.stopButton.disabled = !isRecording;
    
    if (isRecording) {
      this.updateStatus('Recording...', 'recording');
      this.startButton.classList.add('recording');
    } else {
      this.updateStatus('Ready to record', 'ready');
      this.startButton.classList.remove('recording');
      this.resetAudioLevels();
    }
  }

  private updateStatus(message: string, status: 'ready' | 'loading' | 'recording' | 'error'): void {
    const statusDot = this.statusIndicator.querySelector('.status-dot') as HTMLElement;
    const statusText = this.statusIndicator.querySelector('.status-text') as HTMLElement;
    
    // Remove all status classes
    statusDot.className = 'status-dot';
    
    // Add current status class
    statusDot.classList.add(`status-${status}`);
    statusText.textContent = message;
  }

  private updateVoiceStatus(message: string, status: 'active' | 'inactive'): void {
    const voiceText = this.voiceIndicator.querySelector('.voice-text') as HTMLElement;
    const voiceIcon = this.voiceIndicator.querySelector('i') as HTMLElement;
    
    voiceText.textContent = message;
    
    // Update voice indicator styling
    this.voiceIndicator.className = 'voice-indicator';
    this.voiceIndicator.classList.add(`voice-${status}`);
    
    if (status === 'active') {
      voiceIcon.className = 'icon-voice-active';
    } else {
      voiceIcon.className = 'icon-voice';
    }

    // Send voice activity to overlay
    this.sendVoiceActivityToOverlay(status === 'active');
  }

  private updateVoiceIndicator(activity: VoiceActivity): void {
    const confidence = Math.round(activity.confidence * 100);
    
    if (activity.isVoiceActive) {
      this.updateVoiceStatus(`Voice active (${confidence}%)`, 'active');
    } else {
      this.updateVoiceStatus('Listening...', 'inactive');
    }

    // Send detailed voice activity to overlay
    this.sendDetailedVoiceActivityToOverlay(activity);
  }

  private updateAudioLevels(audioData: { data: Float32Array; timestamp: number }): void {
    // Calculate volume level
    let sum = 0;
    for (let i = 0; i < audioData.data.length; i++) {
      sum += Math.abs(audioData.data[i]);
    }
    const volume = sum / audioData.data.length;
    
    // Add to recent levels for averaging
    this.audioLevels.push(volume);
    if (this.audioLevels.length > 10) {
      this.audioLevels.shift();
    }
    
    // Calculate average and peak
    const average = this.audioLevels.reduce((a, b) => a + b, 0) / this.audioLevels.length;
    const peak = Math.max(...this.audioLevels);
    
    this.updateLevelDisplay({ volume, peak, average });
  }

  private updateLevelDisplay(levels: AudioLevelData): void {
    const volumePercent = Math.min(100, levels.volume * 1000); // Scale for display
    const peakPercent = Math.min(100, levels.peak * 1000);
    
    // Update level bar
    this.levelBar.style.width = `${volumePercent}%`;
    
    // Update level bar color based on volume
    this.levelBar.className = 'level-bar';
    if (volumePercent > 70) {
      this.levelBar.classList.add('level-high');
    } else if (volumePercent > 30) {
      this.levelBar.classList.add('level-medium');
    } else {
      this.levelBar.classList.add('level-low');
    }
    
    // Update text displays
    const levelValue = document.getElementById('level-value');
    const peakValue = document.getElementById('peak-value');
    
    if (levelValue) levelValue.textContent = `${Math.round(volumePercent)}%`;
    if (peakValue) peakValue.textContent = `Peak: ${Math.round(peakPercent)}%`;
  }

  private startLevelMonitoring(): void {
    const updateLevels = () => {
      if (this.isRecording) {
        this.animationFrame = requestAnimationFrame(updateLevels);
      }
    };
    updateLevels();
  }

  private stopLevelMonitoring(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private resetAudioLevels(): void {
    this.audioLevels = [];
    this.updateLevelDisplay({ volume: 0, peak: 0, average: 0 });
  }

  private sendVoiceActivityToOverlay(isActive: boolean): void {
    try {
      // Send basic voice activity status to overlay
      (window as any).electronAPI?.sendToMain?.('overlay:voice-activity', {
        isActive,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to send voice activity to overlay:', error);
    }
  }

  private sendDetailedVoiceActivityToOverlay(activity: VoiceActivity): void {
    try {
      // Send detailed voice activity data to overlay for real-time updates
      const micLevel = Math.round(activity.volume * 100);
      (window as any).electronAPI?.sendToMain?.('overlay:mic-level-update', {
        isActive: activity.isVoiceActive,
        level: micLevel,
        confidence: activity.confidence,
        energy: activity.energy,
        timestamp: activity.timestamp
      });
    } catch (error) {
      console.warn('Failed to send detailed voice activity to overlay:', error);
    }
  }

  private sendRecordingStateToOverlay(isRecording: boolean): void {
    try {
      // Send recording state to overlay
      (window as any).electronAPI?.sendToMain?.('overlay:recording-state', {
        isRecording,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to send recording state to overlay:', error);
    }
  }

  private showErrorMessage(error: Error): void {
    let message = 'An unknown error occurred';
    
    if (error.message.includes('Permission denied')) {
      message = 'Microphone access denied. Please enable microphone permissions and try again.';
    } else if (error.message.includes('NotFound')) {
      message = 'No microphone found. Please connect a microphone and try again.';
    } else if (error.message.includes('NotReadable')) {
      message = 'Microphone is in use by another application. Please close other applications and try again.';
    } else {
      message = `Recording failed: ${error.message}`;
    }
    
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <i class="icon-error"></i>
        <span>${message}</span>
        <button class="close-notification">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Manual close
    const closeButton = notification.querySelector('.close-notification');
    closeButton?.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  dispose(): void {
    this.stopLevelMonitoring();
    this.captureService.removeAllListeners();
    this.voiceDetector.removeAllListeners();
  }
}