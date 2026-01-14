import { EventEmitter } from 'events';

export interface DeviceCheckResult {
  hasCableInput: boolean;
  hasCableOutput: boolean;
  isComplete: boolean;
  detectedDevices: {
    inputs: string[];
    outputs: string[];
  };
  windowsVersion?: string;
}

export class DeviceCheckService extends EventEmitter {
  private static instance: DeviceCheckService;
  private isChecking = false;

  public static getInstance(): DeviceCheckService {
    if (!DeviceCheckService.instance) {
      DeviceCheckService.instance = new DeviceCheckService();
    }
    return DeviceCheckService.instance;
  }

  /**
   * Check for virtual audio devices (VB-Audio on Windows, BlackHole on macOS)
   */
  public async checkVirtualCableDevices(): Promise<DeviceCheckResult> {
    if (this.isChecking) {
      throw new Error('Device check already in progress');
    }

    this.isChecking = true;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');

      // Platform-specific detection patterns
      const isMac = process.platform === 'darwin';

      // macOS: Check for BlackHole
      // Windows: Check for VB-Audio Virtual Cable
      const cableInputPatterns = isMac ? [
        'blackhole',
        'black hole',
        'blackhole 2ch',
        'blackhole 16ch',
        'blackhole 64ch'
      ] : [
        'cable input',
        'vb-audio virtual cable',
        'vb-cable',
        'vb audio cable',
        'virtual cable input',
        'cable-input',
        'vbaudio cable',
        // Windows 11 specific patterns
        'cable input (vb-audio virtual cable)',
        'vb-audio cable input',
        'virtual audio cable input'
      ];

      const cableOutputPatterns = isMac ? [
        'blackhole',
        'black hole',
        'blackhole 2ch',
        'blackhole 16ch',
        'blackhole 64ch'
      ] : [
        'cable output',
        'vb-audio virtual cable',
        'vb-cable',
        'vb audio cable',
        'virtual cable output',
        'cable-output',
        'vbaudio cable',
        // Windows 11 specific patterns
        'cable output (vb-audio virtual cable)',
        'vb-audio cable output',
        'virtual audio cable output'
      ];

      // Get device names for debugging
      const inputNames = audioInputDevices.map(d => d.label);
      const outputNames = audioOutputDevices.map(d => d.label);

      const deviceType = isMac ? 'BlackHole' : 'VB-Audio Virtual Cable';
      console.log(`🔍 Available audio input devices (checking for ${deviceType}):`, inputNames);
      console.log(`🔍 Available audio output devices (checking for ${deviceType}):`, outputNames);

      const hasCableInput = audioInputDevices.some(device => {
        const label = device.label.toLowerCase().trim();
        return cableInputPatterns.some(pattern => label.includes(pattern));
      });

      const hasCableOutput = audioOutputDevices.some(device => {
        const label = device.label.toLowerCase().trim();
        return cableOutputPatterns.some(pattern => label.includes(pattern));
      });

      // Detect Windows version for better compatibility (Windows only)
      const windowsVersion = isMac ? undefined : await this.detectWindowsVersion();

      const result: DeviceCheckResult = {
        hasCableInput,
        hasCableOutput,
        isComplete: hasCableInput && hasCableOutput,
        detectedDevices: {
          inputs: inputNames,
          outputs: outputNames
        },
        windowsVersion
      };

      console.log(`🔍 ${deviceType} check result:`, {
        hasCableInput,
        hasCableOutput,
        isComplete: result.isComplete,
        windowsVersion,
        totalInputs: inputNames.length,
        totalOutputs: outputNames.length
      });

      this.emit('deviceCheckComplete', result);
      return result;
    } catch (error) {
      console.error('Failed to check virtual cable devices:', error);
      this.emit('deviceCheckError', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Detect Windows version for compatibility adjustments
   */
  private async detectWindowsVersion(): Promise<string> {
    try {
      // Use user agent as a fallback method
      const userAgent = navigator.userAgent;
      
      if (userAgent.includes('Windows NT 10.0')) {
        // Windows 10 and 11 both report as NT 10.0
        // Try to distinguish between them
        if (userAgent.includes('Windows NT 10.0; Win64; x64')) {
          // Additional checks could be added here for Windows 11 detection
          return 'Windows 10/11';
        }
        return 'Windows 10';
      } else if (userAgent.includes('Windows NT 6.3')) {
        return 'Windows 8.1';
      } else if (userAgent.includes('Windows NT 6.1')) {
        return 'Windows 7';
      }
      
      return 'Unknown Windows Version';
    } catch (error) {
      console.warn('Could not detect Windows version:', error);
      return 'Unknown';
    }
  }

  /**
   * Start monitoring for device changes
   */
  public startDeviceMonitoring(): void {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      console.log('Device change detected, rechecking virtual cable devices...');
      try {
        await this.checkVirtualCableDevices();
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
