import { AudioDeviceService, AudioDeviceInfo } from '../services/AudioDeviceService';
import { ConfigurationManager } from '../services/ConfigurationManager';

export class AudioDeviceSelector {
  private deviceService: AudioDeviceService;
  private configManager: ConfigurationManager;
  private selectElement!: HTMLSelectElement;
  private refreshButton!: HTMLButtonElement;
  private statusIndicator!: HTMLElement;

  constructor(
    deviceService: AudioDeviceService,
    configManager: ConfigurationManager,
    containerId: string
  ) {
    this.deviceService = deviceService;
    this.configManager = configManager;
    
    this.createUI(containerId);
    this.setupEventListeners();
    this.loadSavedDevice();
  }

  private createUI(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }

    container.innerHTML = `
      <div class="audio-device-selector">
        <label for="device-select" class="device-label">
          <i class="icon-microphone"></i>
          Microphone Device:
        </label>
        <div class="device-controls">
          <select id="device-select" class="device-select">
            <option value="">Loading devices...</option>
          </select>
          <button id="refresh-devices" class="refresh-button" title="Refresh device list">
            <i class="icon-refresh"></i>
          </button>
          <div id="device-status" class="device-status">
            <span class="status-indicator"></span>
            <span class="status-text">Not connected</span>
          </div>
        </div>
      </div>
    `;

    this.selectElement = container.querySelector('#device-select') as HTMLSelectElement;
    this.refreshButton = container.querySelector('#refresh-devices') as HTMLButtonElement;
    this.statusIndicator = container.querySelector('#device-status') as HTMLElement;
  }

  private setupEventListeners(): void {
    // Device selection change
    this.selectElement.addEventListener('change', async (event) => {
      const target = event.target as HTMLSelectElement;
      const deviceId = target.value;
      
      if (deviceId) {
        await this.selectDevice(deviceId);
      }
    });

    // Refresh button
    this.refreshButton.addEventListener('click', async () => {
      await this.refreshDevices();
    });

    // Device service events
    this.deviceService.on('devicesUpdated', (devices: AudioDeviceInfo[]) => {
      this.updateDeviceList(devices);
    });

    this.deviceService.on('devicesAdded', (devices: AudioDeviceInfo[]) => {
      this.showNotification(`${devices.length} new audio device(s) detected`, 'info');
      this.updateDeviceList(this.deviceService.getAvailableDevices());
    });

    this.deviceService.on('devicesRemoved', (devices: AudioDeviceInfo[]) => {
      this.showNotification(`${devices.length} audio device(s) disconnected`, 'warning');
      this.updateDeviceList(this.deviceService.getAvailableDevices());
      
      // Check if selected device was removed
      const selectedDeviceId = this.selectElement.value;
      const removedIds = devices.map(d => d.deviceId);
      if (removedIds.includes(selectedDeviceId)) {
        this.handleDeviceDisconnection();
      }
    });

    this.deviceService.on('enumerationError', (error: Error) => {
      this.updateStatus('error', 'Failed to load devices');
      console.error('Device enumeration error:', error);
    });
  }

  private async loadSavedDevice(): Promise<void> {
    try {
      const config = await this.configManager.getConfiguration();
      const savedDeviceId = config.selectedMicrophone;
      
      // Load initial device list
      await this.refreshDevices();
      
      if (savedDeviceId) {
        const device = this.deviceService.getDeviceById(savedDeviceId);
        if (device) {
          this.selectElement.value = savedDeviceId;
          await this.testSelectedDevice();
        } else {
          // Saved device not found, select default
          await this.selectDefaultDevice();
        }
      } else {
        await this.selectDefaultDevice();
      }
    } catch (error) {
      console.error('Failed to load saved device:', error);
      await this.selectDefaultDevice();
    }
  }

  private async refreshDevices(): Promise<void> {
    this.refreshButton.disabled = true;
    this.updateStatus('loading', 'Refreshing devices...');
    
    try {
      await this.deviceService.refreshDevices();
    } catch (error) {
      this.updateStatus('error', 'Failed to refresh devices');
      console.error('Failed to refresh devices:', error);
    } finally {
      this.refreshButton.disabled = false;
    }
  }

  private updateDeviceList(devices: AudioDeviceInfo[]): void {
    const currentValue = this.selectElement.value;
    
    // Clear existing options
    this.selectElement.innerHTML = '';
    
    if (devices.length === 0) {
      this.selectElement.innerHTML = '<option value="">No microphones found</option>';
      this.updateStatus('error', 'No devices available');
      return;
    }

    // Add device options
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label;
      
      if (device.isDefault) {
        option.textContent += ' (Default)';
      }
      
      this.selectElement.appendChild(option);
    });

    // Restore selection if device still exists
    if (currentValue && devices.some(d => d.deviceId === currentValue)) {
      this.selectElement.value = currentValue;
    } else if (devices.length > 0) {
      // Select default or first device
      const defaultDevice = devices.find(d => d.isDefault) || devices[0];
      this.selectElement.value = defaultDevice.deviceId;
    }

    this.updateStatus('ready', `${devices.length} device(s) available`);
  }

  private async selectDevice(deviceId: string): Promise<void> {
    try {
      this.updateStatus('testing', 'Testing device...');
      
      const isWorking = await this.deviceService.testDevice(deviceId);
      
      if (isWorking) {
        // Save selection to configuration
        const config = await this.configManager.getConfiguration();
        config.selectedMicrophone = deviceId;
        await this.configManager.saveConfiguration(config);
        
        this.updateStatus('connected', 'Device ready');
        
        // Emit device selected event
        const device = this.deviceService.getDeviceById(deviceId);
        if (device) {
          this.dispatchEvent(new CustomEvent('deviceSelected', { detail: device }));
        }
      } else {
        this.updateStatus('error', 'Device test failed');
        this.showNotification('Selected device is not working properly', 'error');
      }
    } catch (error) {
      this.updateStatus('error', 'Device selection failed');
      console.error('Device selection error:', error);
    }
  }

  private async selectDefaultDevice(): Promise<void> {
    const defaultDevice = this.deviceService.getDefaultDevice();
    if (defaultDevice) {
      this.selectElement.value = defaultDevice.deviceId;
      await this.selectDevice(defaultDevice.deviceId);
    }
  }

  private async testSelectedDevice(): Promise<void> {
    const selectedDeviceId = this.selectElement.value;
    if (selectedDeviceId) {
      await this.selectDevice(selectedDeviceId);
    }
  }

  private handleDeviceDisconnection(): void {
    this.updateStatus('disconnected', 'Device disconnected');
    this.showNotification('Selected microphone was disconnected', 'warning');
    
    // Try to select a new default device
    setTimeout(async () => {
      await this.selectDefaultDevice();
    }, 1000);
  }

  private updateStatus(status: 'loading' | 'ready' | 'testing' | 'connected' | 'disconnected' | 'error', message: string): void {
    const indicator = this.statusIndicator.querySelector('.status-indicator') as HTMLElement;
    const text = this.statusIndicator.querySelector('.status-text') as HTMLElement;
    
    // Remove all status classes
    indicator.className = 'status-indicator';
    
    // Add current status class
    indicator.classList.add(`status-${status}`);
    text.textContent = message;
  }

  private showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
    // Create a simple notification (you might want to integrate with a proper notification system)
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  private dispatchEvent(event: CustomEvent): void {
    this.selectElement.dispatchEvent(event);
  }

  getSelectedDevice(): AudioDeviceInfo | null {
    const selectedId = this.selectElement.value;
    return selectedId ? this.deviceService.getDeviceById(selectedId) : null;
  }

  startMonitoring(): void {
    this.deviceService.startDeviceMonitoring();
  }

  stopMonitoring(): void {
    this.deviceService.stopDeviceMonitoring();
  }

  dispose(): void {
    this.stopMonitoring();
    this.deviceService.removeAllListeners();
  }
}