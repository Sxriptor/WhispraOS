import { OverlayMode, OverlayState } from '../types/ConfigurationTypes';
import { SplitOverlayWindowManager } from './SplitOverlayWindowManager';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Manages overlay state transitions and logic
 */
export class OverlayStateManager {
  private static instance: OverlayStateManager;
  private windowManager: SplitOverlayWindowManager;
  private configManager: ConfigurationManager;
  private currentState: OverlayState;
  private stateChangeCallbacks: ((state: OverlayState) => void)[] = [];
  private healthMonitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.windowManager = SplitOverlayWindowManager.getInstance();
    this.configManager = ConfigurationManager.getInstance();
    
    // Initialize default state
    this.currentState = {
      mode: OverlayMode.CLOSED,
      position: { x: 100, y: 100 },
      microphoneState: {
        isActive: false,
        isRecording: false,
        deviceId: '',
        level: 0
      },
      bidirectionalState: {
        isEnabled: false,
        inputDevice: '',
        outputDevice: '',
        isProcessingAudio: false
      },
      translationResult: null,
      connectionStatus: 'connected'
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OverlayStateManager {
    if (!OverlayStateManager.instance) {
      OverlayStateManager.instance = new OverlayStateManager();
    }
    return OverlayStateManager.instance;
  }

  /**
   * Get current overlay state
   */
  public getCurrentState(): OverlayState {
    return { ...this.currentState };
  }

  /**
   * Set overlay state
   */
  public setState(newState: Partial<OverlayState>): void {
    this.currentState = { ...this.currentState, ...newState };
    this.notifyStateChange();
  }

  /**
   * Subscribe to state changes
   */
  public subscribeToStateChanges(callback: (state: OverlayState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Unsubscribe from state changes
   */
  public unsubscribeFromStateChanges(callback: (state: OverlayState) => void): void {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Handle overlay toggle (main state machine logic)
   */
  public async handleToggle(): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      const overlaySettings = config.uiSettings.overlaySettings;

      if (!overlaySettings?.enabled) {
        console.log('Overlay is disabled in settings');
        return;
      }

      // Quick check if overlay windows exist, skip responsiveness check during toggle for speed
      if (this.currentState.mode !== OverlayMode.CLOSED && !this.windowManager.getMiniOverlayWindow() && !this.windowManager.getExpandedOverlayWindow()) {
        console.warn('Overlay windows missing, will recreate...');
      }

      switch (this.currentState.mode) {
        case OverlayMode.CLOSED:
          await this.showMinimal();
          break;

        case OverlayMode.MINIMAL:
          await this.showExpanded();
          break;

        case OverlayMode.EXPANDED:
          await this.close();
          break;

        default:
          // If we're in an unknown state, close and reset
          console.warn('Overlay in unknown state, resetting to closed');
          await this.close();
          break;
      }
    } catch (error) {
      console.error('Error handling overlay toggle:', error);
      await this.handleError(error as Error);
    }
  }

  /**
   * Handle overlay hold-to-close (2 second hold)
   */
  public async handleHoldClose(): Promise<void> {
    if (this.currentState.mode === OverlayMode.MINIMAL) {
      // Skip expanded mode and close directly
      await this.close();
    }
  }

  /**
   * Show overlay in minimal mode
   */
  public async showMinimal(): Promise<void> {
    try {
      // Create mini overlay window if it doesn't exist
      if (!this.windowManager.getMiniOverlayWindow()) {
        await this.windowManager.createMiniOverlay();
      }

      // Hide expanded and show mini
      this.windowManager.hideExpandedOverlay();
      this.windowManager.showMiniOverlay();
      
      // Update state
      this.setState({ mode: OverlayMode.MINIMAL });
      
      console.log('Overlay shown in minimal mode');
    } catch (error) {
      console.error('Failed to show minimal overlay:', error);
      this.setState({ connectionStatus: 'disconnected' });
    }
  }

  /**
   * Show overlay in expanded mode
   */
  public async showExpanded(): Promise<void> {
    try {
      // Create both overlay windows if they don't exist
      if (!this.windowManager.getMiniOverlayWindow()) {
        await this.windowManager.createMiniOverlay();
      }
      if (!this.windowManager.getExpandedOverlayWindow()) {
        await this.windowManager.createExpandedOverlay();
      }

      // Show both overlays simultaneously
      this.windowManager.showBothOverlays();
      
      // Update state
      this.setState({ mode: OverlayMode.EXPANDED });
      
      console.log('Overlay shown in expanded mode (both mini and expanded visible)');
    } catch (error) {
      console.error('Failed to show expanded overlay:', error);
      this.setState({ connectionStatus: 'disconnected' });
    }
  }

  /**
   * Close overlay
   */
  public async close(): Promise<void> {
    try {
      this.windowManager.hideBothOverlays();
      // Also hide/minimize the web overlay when user closes overlays via hotkey
      try {
        const { getSoundboardOverlayManager } = require('../soundboard/soundboard-overlay-ipc');
        const webOverlayManager = getSoundboardOverlayManager?.();
        const webOverlayWindow = webOverlayManager?.getWindow?.();
        if (webOverlayWindow && !webOverlayWindow.isDestroyed()) {
          // Use hide() to keep audio routing state consistent (minimize-like behavior)
          webOverlayManager.hide();
        }
      } catch (e) {
        // Non-fatal: web overlay may not be initialized
      }
      
      // Update state
      this.setState({ mode: OverlayMode.CLOSED });
      
      console.log('Overlay closed');
    } catch (error) {
      console.error('Failed to close overlay:', error);
    }
  }

  /**
   * Update microphone state
   */
  public updateMicrophoneState(micState: Partial<OverlayState['microphoneState']>): void {
    this.setState({
      microphoneState: { ...this.currentState.microphoneState, ...micState }
    });
  }

  /**
   * Update bidirectional state
   */
  public updateBidirectionalState(bidiState: Partial<OverlayState['bidirectionalState']>): void {
    this.setState({
      bidirectionalState: { ...this.currentState.bidirectionalState, ...bidiState }
    });
  }

  /**
   * Update translation result
   */
  public updateTranslationResult(result: OverlayState['translationResult']): void {
    this.setState({ translationResult: result });
  }

  /**
   * Update connection status
   */
  public updateConnectionStatus(status: OverlayState['connectionStatus']): void {
    this.setState({ connectionStatus: status });
  }

  /**
   * Sync with main application state
   */
  public async syncWithMainApp(): Promise<void> {
    try {
      // This would typically fetch current state from main app services
      // For now, we'll just update connection status
      this.setState({ connectionStatus: 'connected' });
    } catch (error) {
      console.error('Failed to sync with main app:', error);
      this.setState({ connectionStatus: 'disconnected' });
    }
  }

  /**
   * Initialize overlay state manager
   */
  public async initialize(): Promise<void> {
    try {
      await this.syncWithMainApp();
      console.log('OverlayStateManager initialized');
    } catch (error) {
      console.error('Failed to initialize OverlayStateManager:', error);
    }
  }

  /**
   * Cleanup overlay state manager
   */
  public cleanup(): void {
    // Clear health monitoring interval
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = null;
    }

    // Destroy overlay windows
    this.windowManager.destroyOverlays();
    this.stateChangeCallbacks = [];
    console.log('OverlayStateManager cleaned up');
  }

  /**
   * Force cleanup overlay state manager (for emergency situations)
   */
  public forceCleanup(): void {
    console.log('Starting force cleanup of OverlayStateManager...');

    try {
      // Step 1: Clear health monitoring interval
      console.log('Clearing health monitoring interval...');
      if (this.healthMonitoringInterval) {
        clearInterval(this.healthMonitoringInterval);
        this.healthMonitoringInterval = null;
        console.log('Health monitoring interval cleared');
      } else {
        console.log('No health monitoring interval to clear');
      }

      // Step 2: Force destroy overlay windows
      console.log('Force destroying overlay windows...');
      this.windowManager.destroyOverlays();

      // Step 3: Clear all state change callbacks
      console.log('Clearing state change callbacks...');
      this.stateChangeCallbacks = [];

      console.log('OverlayStateManager force cleanup completed successfully');
    } catch (error) {
      console.error('Error during force cleanup of OverlayStateManager:', error);
      // Try to at least destroy the window
      try {
        this.windowManager.destroyOverlays();
      } catch (windowError) {
        console.error('Failed to destroy overlay windows during error recovery:', windowError);
      }
    }
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(this.getCurrentState());
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });

    // Send state update to both overlay windows
    this.windowManager.sendToBothOverlays('state-update', this.getCurrentState());
  }

  /**
   * Get overlay mode as string for external use
   */
  public getCurrentModeString(): string {
    return this.currentState.mode;
  }

  /**
   * Check if overlay is currently visible
   */
  public isVisible(): boolean {
    return this.currentState.mode !== OverlayMode.CLOSED;
  }

  /**
   * Force overlay to specific mode (for external control)
   */
  public async setMode(mode: OverlayMode): Promise<void> {
    switch (mode) {
      case OverlayMode.MINIMAL:
        await this.showMinimal();
        break;
      case OverlayMode.EXPANDED:
        await this.showExpanded();
        break;
      case OverlayMode.CLOSED:
      default:
        await this.close();
        break;
    }
  }

  /**
   * Handle overlay errors and attempt recovery
   */
  public async handleError(error: Error): Promise<void> {
    console.error('Overlay error occurred:', error);
    
    try {
      // Update connection status
      this.setState({ connectionStatus: 'disconnected' });
      
      // Attempt to recover based on error type
      if (error.message.includes('window') || error.message.includes('destroyed')) {
        // Window-related error - try to recreate overlays
        console.log('Attempting to recreate overlay windows...');
        this.windowManager.destroyOverlays();
        
        // Wait a bit before recreating
        setTimeout(async () => {
          try {
            await this.windowManager.createMiniOverlay();
            await this.windowManager.createExpandedOverlay();
            this.setState({ connectionStatus: 'connected' });
            console.log('Overlay windows recreated successfully');
          } catch (recreateError) {
            console.error('Failed to recreate overlay windows:', recreateError);
            this.setState({ connectionStatus: 'disconnected' });
          }
        }, 1000);
      } else if (error.message.includes('IPC') || error.message.includes('communication')) {
        // IPC-related error - try to reconnect
        console.log('Attempting to reconnect IPC...');
        this.setState({ connectionStatus: 'reconnecting' });
        
        setTimeout(() => {
          this.syncWithMainApp().then(() => {
            console.log('IPC reconnected successfully');
          }).catch((reconnectError) => {
            console.error('Failed to reconnect IPC:', reconnectError);
            this.setState({ connectionStatus: 'disconnected' });
          });
        }, 2000);
      } else {
        // Generic error - just update status
        this.setState({ connectionStatus: 'disconnected' });
        
        // Try to recover after a delay
        setTimeout(() => {
          this.syncWithMainApp().catch(console.error);
        }, 5000);
      }
    } catch (handlingError) {
      console.error('Error while handling overlay error:', handlingError);
      this.setState({ connectionStatus: 'disconnected' });
    }
  }

  /**
   * Check overlay health and recover if needed
   */
  public async checkHealth(): Promise<boolean> {
    try {
      // Check if both windows exist and are responsive
      const responsiveness = await this.windowManager.checkResponsiveness();
      
      if (!responsiveness.mini && !responsiveness.expanded) {
        throw new Error('Both overlay windows are unresponsive');
      }
      
      // Update connection status if at least one is healthy
      if (this.currentState.connectionStatus !== 'connected') {
        this.setState({ connectionStatus: 'connected' });
      }
      
      return responsiveness.mini || responsiveness.expanded;
    } catch (error) {
      console.error('Overlay health check failed:', error);
      await this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  public startHealthMonitoring(): void {
    // Clear any existing interval first
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
    }

    // Check health every 30 seconds to reduce overhead
    this.healthMonitoringInterval = setInterval(() => {
      // Only check if overlay is visible to avoid unnecessary work
      if (this.currentState.mode !== OverlayMode.CLOSED) {
        this.checkHealth().catch(console.error);
      }
    }, 30000);
  }
}