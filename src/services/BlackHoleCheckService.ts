import { EventEmitter } from 'events';

export interface BlackHoleCheckResult {
  hasBlackHoleInput: boolean;
  hasBlackHoleOutput: boolean;
  isComplete: boolean;
  detectedDevices: {
    inputs: string[];
    outputs: string[];
  };
  macosVersion?: string;
}

export class BlackHoleCheckService extends EventEmitter {
  private static instance: BlackHoleCheckService;
  private isChecking = false;

  public static getInstance(): BlackHoleCheckService {
    if (!BlackHoleCheckService.instance) {
      BlackHoleCheckService.instance = new BlackHoleCheckService();
    }
    return BlackHoleCheckService.instance;
  }

  /**
   * Check for BlackHole audio devices on macOS
   */
  public async checkBlackHoleDevices(): Promise<BlackHoleCheckResult> {
    if (this.isChecking) {
      throw new Error('Device check already in progress');
    }

    this.isChecking = true;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');

      // BlackHole detection patterns for macOS
      const blackHoleInputPatterns = [
        'blackhole',
        'black hole',
        'blackhole 2ch',
        'blackhole 16ch',
        'blackhole 64ch'
      ];

      const blackHoleOutputPatterns = [
        'blackhole',
        'black hole',
        'blackhole 2ch',
        'blackhole 16ch',
        'blackhole 64ch'
      ];

      // Get device names for debugging
      const inputNames = audioInputDevices.map(d => d.label);
      const outputNames = audioOutputDevices.map(d => d.label);

      console.log('🔍 Available audio input devices (macOS):', inputNames);
      console.log('🔍 Available audio output devices (macOS):', outputNames);

      const hasBlackHoleInput = audioInputDevices.some(device => {
        const label = device.label.toLowerCase().trim();
        return blackHoleInputPatterns.some(pattern => label.includes(pattern));
      });

      const hasBlackHoleOutput = audioOutputDevices.some(device => {
        const label = device.label.toLowerCase().trim();
        return blackHoleOutputPatterns.some(pattern => label.includes(pattern));
      });

      // Detect macOS version
      const macosVersion = await this.detectMacOSVersion();

      const result: BlackHoleCheckResult = {
        hasBlackHoleInput,
        hasBlackHoleOutput,
        isComplete: hasBlackHoleInput && hasBlackHoleOutput,
        detectedDevices: {
          inputs: inputNames,
          outputs: outputNames
        },
        macosVersion
      };

      console.log('🔍 BlackHole check result:', {
        hasBlackHoleInput,
        hasBlackHoleOutput,
        isComplete: result.isComplete,
        macosVersion,
        totalInputs: inputNames.length,
        totalOutputs: outputNames.length
      });

      this.emit('blackHoleCheckComplete', result);
      return result;
    } catch (error) {
      console.error('Failed to check BlackHole devices:', error);
      this.emit('blackHoleCheckError', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Detect macOS version
   */
  private async detectMacOSVersion(): Promise<string> {
    try {
      const userAgent = navigator.userAgent;

      // Parse macOS version from user agent
      // Example: "... Mac OS X 10_15_7 ..." or "... Macintosh; Intel Mac OS X 14_0 ..."
      const macMatch = userAgent.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);

      if (macMatch) {
        const major = macMatch[1];
        const minor = macMatch[2];
        const patch = macMatch[3] || '0';
        return `macOS ${major}.${minor}.${patch}`;
      }

      return 'macOS (Unknown Version)';
    } catch (error) {
      console.warn('Could not detect macOS version:', error);
      return 'Unknown';
    }
  }

  /**
   * Start monitoring for device changes
   */
  public startDeviceMonitoring(): void {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      console.log('Device change detected, rechecking BlackHole devices...');
      try {
        await this.checkBlackHoleDevices();
      } catch (error) {
        console.error('Error during device change check:', error);
      }
    });
  }

  /**
   * Stop monitoring for device changes
   */
  public stopDeviceMonitoring(): void {
    // Note: MediaDevices API doesn't provide a way to remove devicechange listeners
    // This is a limitation of the Web API
  }
}
