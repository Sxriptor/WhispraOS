/**
 * Local Models Setup Modal Overlay
 * Handles downloading and installing local AI models for offline processing
 */

type DownloadPhase = 'downloading' | 'extracting' | 'installing' | 'finalizing';

interface DownloadProgressPayload {
  modelKey: string;
  progress?: number;
  overallProgress?: number;
  downloaded: number;
  total: number;
  status?: string;
  phase?: DownloadPhase;
  phaseProgress?: number;
}

export class LocalModalOverlay {
  private modal: HTMLElement | null = null;
  private onClose?: () => void;

  /**
   * Show the local models setup modal
   */
  public show(onClose?: () => void): void {
    this.onClose = onClose;
    this.createModal();
    document.body.appendChild(this.modal!);
    this.modal!.style.display = 'flex';
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
    
    // Call the onClose callback if provided
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Create the modal HTML structure
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.className = 'local-modal-overlay';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const styles = `
      <style>
        .local-modal-overlay .download-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }

        .local-modal-overlay .download-button:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .local-modal-overlay .download-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .local-modal-overlay .download-button.downloading {
          background: #1d4ed8;
          cursor: progress;
        }

        .local-modal-overlay .download-button.installed,
        .local-modal-overlay .download-button.success {
          background: #10b981;
          cursor: default;
        }

        .local-modal-overlay .download-button.error {
          background: #ef4444;
        }

        .local-modal-overlay .progress-bar {
          width: 220px;
          height: 10px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          position: relative;
          display: none;
        }

        .local-modal-overlay .progress-bar.active {
          display: inline-flex;
        }

        .local-modal-overlay .progress-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
          transition: width 0.35s ease;
        }

        .local-modal-overlay .progress-bar.indeterminate .progress-fill {
          width: 40%;
          position: absolute;
          left: -40%;
          animation: progress-indeterminate 1.6s infinite ease-in-out;
        }

        @keyframes progress-indeterminate {
          0% {
            left: -40%;
          }
          100% {
            left: 100%;
          }
        }

        .local-modal-overlay .status-text {
          font-size: 14px;
          color: #6b7280;
          margin-left: 12px;
          transition: color 0.2s ease;
        }

        .local-modal-overlay .status-text.success {
          color: #10b981;
          font-weight: 600;
        }

        .local-modal-overlay .status-text.error {
          color: #ef4444;
          font-weight: 600;
        }
      </style>
    `;

    this.modal.innerHTML = `
      ${styles}
      <div style="
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        width: 800px;
        height: 600px;
        display: flex;
        flex-direction: column;
        position: relative;
      ">
        <div style="
          background: white;
          padding: 24px 24px 16px 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 80px;
          flex-shrink: 0;
          border-radius: 12px 12px 0 0;
          box-sizing: border-box;
        ">
          <h1 style="
            font-size: 24px;
            font-weight: 600;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 0;
          ">
            <span>🤖</span>
            Local Models Setup
          </h1>
          <button id="close-button" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 8px;
            border-radius: 6px;
            transition: all 0.2s;
          ">&times;</button>
        </div>
        
        <div style="
          padding: 24px;
          height: calc(100% - 160px);
          overflow-y: auto;
          background: white;
        ">
          <p style="
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.6;
          ">
            Download and install local AI models for offline processing. These models will be saved to your Whispra models directory.
          </p>

          <!-- Argos Translate Model -->
          <div style="
            margin-bottom: 32px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          ">
            <div style="
              background: #f9fafb;
              padding: 16px 20px;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              align-items: center;
              gap: 12px;
            ">
              <span style="font-size: 20px;">🌐</span>
              <div>
                <div style="font-size: 18px; font-weight: 600; color: #1f2937;">Argos Translate</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Neural machine translation model for text translation</div>
              </div>
            </div>
            <div style="padding: 20px;">
              <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 20px;
              ">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Size</div>
                  <div style="color: #1f2937; font-size: 14px;">~500MB</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Languages</div>
                  <div style="color: #1f2937; font-size: 14px;">English + 20+ languages</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Install Location</div>
                  <div style="color: #1f2937; font-size: 14px;">whispra/models/argos/</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
                  <div id="argos-status" style="color: #1f2937; font-size: 14px;">Not installed</div>
                </div>
              </div>
              <div style="display: flex; gap: 12px; align-items: center;">
                <button id="download-argos" class="download-button">
                  <span>📥</span>
                  Download Argos Translate
                </button>
                <div id="argos-progress" class="progress-bar">
                  <div id="argos-progress-fill" class="progress-fill"></div>
                </div>
                <div id="argos-status-text" class="status-text"></div>
              </div>
            </div>
          </div>

          <!-- Argos Extra Languages Pack -->
          <div style="
            margin-bottom: 32px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          ">
            <div style="
              background: #f9fafb;
              padding: 16px 20px;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              align-items: center;
              gap: 12px;
            ">
              <span style="font-size: 20px;">🌍</span>
              <div>
                <div style="font-size: 18px; font-weight: 600; color: #1f2937;">Argos Extra Languages</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Additional language packs including Hebrew, Arabic, and more</div>
              </div>
            </div>
            <div style="padding: 20px;">
              <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 20px;
              ">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Size</div>
                  <div style="color: #1f2937; font-size: 14px;">~300MB</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Languages</div>
                  <div style="color: #1f2937; font-size: 14px;">Hebrew, Arabic, Thai, and more</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Install Location</div>
                  <div style="color: #1f2937; font-size: 14px;">whispra/models/argos/</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
                  <div id="argos-extra-status" style="color: #1f2937; font-size: 14px;">Not installed</div>
                </div>
              </div>
              <div style="display: flex; gap: 12px; align-items: center;">
                <button id="download-argos-extra" class="download-button">
                  <span>📦</span>
                  Download Extra Languages
                </button>
                <div id="argos-extra-progress" class="progress-bar">
                  <div id="argos-extra-progress-fill" class="progress-fill"></div>
                </div>
                <div id="argos-extra-status-text" class="status-text"></div>
              </div>
            </div>
          </div>



          <!-- Fast Whisper Model -->
          <div style="
            margin-bottom: 32px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          ">
            <div style="
              background: #f9fafb;
              padding: 16px 20px;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              align-items: center;
              gap: 12px;
            ">
              <span style="font-size: 20px;">👂</span>
              <div>
                <div style="font-size: 18px; font-weight: 600; color: #1f2937;">Fast Whisper</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Optimized speech recognition model for audio transcription</div>
              </div>
            </div>
            <div style="padding: 20px;">
              <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 20px;
              ">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Size</div>
                  <div style="color: #1f2937; font-size: 14px;">~150MB</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Languages</div>
                  <div style="color: #1f2937; font-size: 14px;">English + multilingual</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Install Location</div>
                  <div style="color: #1f2937; font-size: 14px;">whispra/models/whisper/</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Status</div>
                  <div id="whisper-status" style="color: #1f2937; font-size: 14px;">Not installed</div>
                </div>
              </div>
              <div style="display: flex; gap: 12px; align-items: center;">
                <button id="download-whisper" class="download-button">
                  <span>📥</span>
                  Download Fast Whisper
                </button>
                <div id="whisper-progress" class="progress-bar">
                  <div id="whisper-progress-fill" class="progress-fill"></div>
                </div>
                <div id="whisper-status-text" class="status-text"></div>
              </div>
            </div>
          </div>

        </div>

        <div style="
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 24px;
          border-top: 1px solid #e5e7eb;
          background: white;
          border-radius: 0 0 12px 12px;
          height: 80px;
          flex-shrink: 0;
          align-items: center;
          box-sizing: border-box;
        ">
          <button id="cancel-button" style="
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">Cancel</button>
          <button id="done-button" style="
            background: #9ca3af;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            cursor: not-allowed;
            transition: all 0.2s;
          " disabled>Done</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners to the modal
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button handlers
    const closeButton = this.modal.querySelector('#close-button');
    const cancelButton = this.modal.querySelector('#cancel-button');
    const doneButton = this.modal.querySelector('#done-button');

    closeButton?.addEventListener('click', () => this.hide());
    cancelButton?.addEventListener('click', () => this.hide());
    doneButton?.addEventListener('click', () => this.hide());

    // Download button handlers
    const downloadArgos = this.modal.querySelector('#download-argos');
    const downloadArgosExtra = this.modal.querySelector('#download-argos-extra');
    const downloadWhisper = this.modal.querySelector('#download-whisper');

    downloadArgos?.addEventListener('click', () => this.downloadModel('argos'));
    downloadArgosExtra?.addEventListener('click', () => this.downloadModel('argos-extra'));
    downloadWhisper?.addEventListener('click', () => this.downloadModel('whisper'));

    // Listen for download progress updates
    if ((window as any).electronAPI) {
      (window as any).electronAPI.on('local-models:download-progress', (_event: any, data: DownloadProgressPayload) => {
        console.log('[LocalModalOverlay] Received progress update:', data);
        this.updateDownloadProgress(data);
      });

      // Listen for download error notifications
      (window as any).electronAPI.on('local-models:download-error', (_event: any, data: { modelKey: string, error: string }) => {
        console.log('[LocalModalOverlay] Received download error:', data);
        this.handleDownloadError(data.modelKey, data.error);
      });
    } else {
      console.warn('[LocalModalOverlay] electronAPI not available');
    }

    // Check existing installations
    this.checkExistingInstallations();
  }

  /**
   * Check if models are already installed
   */
  private async checkExistingInstallations(): Promise<void> {
    try {
      console.log('Checking existing installations...');
      
      // Call the main process to check if models exist
      const response = await (window as any).electronAPI.invoke('local-models:check-installations', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {}
      });

      if (response.success) {
        const modelStatuses = response.payload;
        
        // Update status indicators based on actual installation status
        this.updateModelStatus('argos', modelStatuses.argos ? 'Installed' : 'Not installed');
        this.updateModelStatus('argos-extra', modelStatuses['argos-extra'] ? 'Installed' : 'Not installed');
        this.updateModelStatus('whisper', modelStatuses.whisper ? 'Installed' : 'Not installed');
        
        // Update download buttons based on installation status
        this.updateDownloadButton('argos', modelStatuses.argos ? 'installed' : 'available', modelStatuses.argos ? 'Installed' : 'Download');
        this.updateDownloadButton('argos-extra', modelStatuses['argos-extra'] ? 'installed' : 'available', modelStatuses['argos-extra'] ? 'Installed' : 'Download Extra Languages');
        this.updateDownloadButton('whisper', modelStatuses.whisper ? 'installed' : 'available', modelStatuses.whisper ? 'Installed' : 'Download');
      } else {
        console.error('Failed to check installations:', response.error);
        // Fallback to not installed
        this.updateModelStatus('argos', 'Not installed');
        this.updateModelStatus('argos-extra', 'Not installed');
        this.updateModelStatus('whisper', 'Not installed');
      }
    } catch (error) {
      console.error('Error checking installations:', error);
      // Fallback to not installed
      this.updateModelStatus('argos', 'Not installed');
      this.updateModelStatus('argos-extra', 'Not installed');
      this.updateModelStatus('whisper', 'Not installed');
    }
  }

  /**
   * Download a model
   */
  private async downloadModel(modelKey: string): Promise<void> {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const button = this.modal?.querySelector(`#${config.buttonElement}`) as HTMLButtonElement;
    if (!button) return;

    // Don't proceed if button is disabled
    if (button.disabled) {
      return;
    }

    try {
      this.updateDownloadButton(modelKey, 'downloading', 'Downloading...');
      this.showProgress(modelKey, true);
      this.updateStatusText(modelKey, 'Starting download...');

      // Ensure handler is registered before calling (with retry)
      let response;
      let retries = 3;
      let lastError: Error | null = null;
      
      while (retries > 0) {
        try {
          // Call the main process to download the model
          response = await (window as any).electronAPI.invoke('local-models:download', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { modelKey, config }
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          // Check if it's a "no handler" error
          if (error?.message?.includes('No handler registered') && retries > 1) {
            console.warn(`[LocalModalOverlay] Handler not ready, retrying... (${retries - 1} attempts left)`);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            retries--;
          } else {
            // Not a handler error or out of retries, throw immediately
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error('Failed to get response after retries');
      }

      if (response.success) {
        this.updateDownloadButton(modelKey, 'success', 'Downloaded');
        this.updateModelStatus(modelKey, 'Installed');
        this.updateStatusText(modelKey, 'Download completed successfully!', 'success');
        this.checkAllDownloadsComplete();
        
        // Refresh the installation check to ensure UI is up to date
        await this.checkExistingInstallations();
        
        // Emit a custom event that other components can listen to
        window.dispatchEvent(new CustomEvent('local-model-downloaded', { 
          detail: { modelKey, modelType: modelKey === 'whisper' ? 'whisper' : 'argos' }
        }));
      } else {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      this.updateDownloadButton(modelKey, 'error', 'Retry');
      this.updateStatusText(modelKey, 'Download failed. Please try again.', 'error');
      console.error(`Error downloading ${config.name}:`, error);
    }
  }

  /**
   * Get model configuration
   */
  private getModelConfig(modelKey: string): any {
    const configs = {
      argos: {
        name: 'Argos Translate',
        url: (window as any).electronAPI?.platform === 'darwin'
          ? 'https://github.com/Sxriptor/Whispra-Download/releases/download/ArgosMac/argos.zip'
          : 'https://github.com/Sxriptor/Whispra-Download/releases/download/Argos/argos.zip',
        size: '500MB',
        installPath: 'whispra/models/argos/',
        statusElement: 'argos-status',
        buttonElement: 'download-argos',
        progressElement: 'argos-progress',
        progressFillElement: 'argos-progress-fill',
        statusTextElement: 'argos-status-text'
      },
      'argos-extra': {
        name: 'Argos Extra Languages',
        url: 'https://github.com/Sxriptor/Whispra-Download/releases/download/Argos/extrapack.zip',
        size: '300MB',
        installPath: 'whispra/models/argos/',
        statusElement: 'argos-extra-status',
        buttonElement: 'download-argos-extra',
        progressElement: 'argos-extra-progress',
        progressFillElement: 'argos-extra-progress-fill',
        statusTextElement: 'argos-extra-status-text'
      },

      whisper: {
        name: 'Fast Whisper',
        url: 'https://github.com/Sxriptor/Whispra-Download/releases/download/Whisper/whisper.zip',
        size: '150MB',
        installPath: 'whispra/models/whisper/',
        statusElement: 'whisper-status',
        buttonElement: 'download-whisper',
        progressElement: 'whisper-progress',
        progressFillElement: 'whisper-progress-fill',
        statusTextElement: 'whisper-status-text'
      }
    };

    return configs[modelKey as keyof typeof configs];
  }

  /**
   * Update download button state
   */
  private updateDownloadButton(modelKey: string, state: string, text: string): void {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const button = this.modal?.querySelector(`#${config.buttonElement}`) as HTMLButtonElement;
    if (!button) return;

    button.className = `download-button ${state}`;
    button.textContent = text;
    button.disabled = state === 'downloading' || state === 'installed';
  }

  /**
   * Update model status
   */
  private updateModelStatus(modelKey: string, status: string): void {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const statusElement = this.modal?.querySelector(`#${config.statusElement}`);
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  /**
   * Update status text
   */
  private updateStatusText(modelKey: string, text: string, type: string = ''): void {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const statusText = this.modal?.querySelector(`#${config.statusTextElement}`);
    if (statusText) {
      statusText.textContent = text;
      statusText.className = `status-text ${type}`;
    }
  }

  /**
   * Show/hide progress bar
   */
  private showProgress(modelKey: string, show: boolean): void {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const progressBar = this.modal?.querySelector(`#${config.progressElement}`) as HTMLElement;
    if (progressBar) {
      progressBar.classList.toggle('active', show);
      if (!show) {
        progressBar.classList.remove('indeterminate');
      }
    }
  }

  /**
   * Update download progress
   */
  private updateDownloadProgress(data: DownloadProgressPayload): void {
    console.log('[UI] Received progress update:', data);
    const config = this.getModelConfig(data.modelKey);
    if (!config) {
      console.warn('[UI] No config found for modelKey:', data.modelKey);
      {
      console.warn('[LocalModalOverlay] No config found for modelKey:', data.modelKey);
      return;
    }
    }

    const progressBar = this.modal?.querySelector(`#${config.progressElement}`) as HTMLElement;
    const progressFill = this.modal?.querySelector(`#${config.progressFillElement}`) as HTMLElement;
    const statusText = this.modal?.querySelector(`#${config.statusTextElement}`) as HTMLElement;

    console.log('[UI] Progress elements found:', {
      progressBar: !!progressBar,
      progressFill: !!progressFill,
      statusText: !!statusText
    });

    if (!progressBar || !progressFill) {
      console.warn('[LocalModalOverlay] Progress elements not found for modelKey:', data.modelKey);
      return;
    }

    const rawProgress = typeof data.overallProgress === 'number'
      ? data.overallProgress
      : typeof data.progress === 'number'
        ? data.progress
        : 0;
    const clampedProgress = Math.max(0, Math.min(100, rawProgress));

    console.log('[UI] Setting progress to:', clampedProgress + '%');

    console.log('[LocalModalOverlay] Updating progress for', data.modelKey, ':', clampedProgress, '%');

    if (progressFill) {
      progressFill.style.width = `${clampedProgress}%`;
    } else {
      console.warn('[UI] progressFill element not found!');
    }

    if (progressBar) {
      progressBar.classList.add('active');
      const hasPhaseProgress = typeof data.phaseProgress === 'number' && !Number.isNaN(data.phaseProgress);
      progressBar.classList.toggle('indeterminate', !hasPhaseProgress);
    } else {
      console.warn('[UI] progressBar element not found!');
    }

    if (!statusText) {
      console.warn('[UI] statusText element not found!');
      return;
    }

    if (data.status) {
      statusText.textContent = data.status;
      const statusLower = data.status.toLowerCase();
      if (statusLower.includes('error')) {
        statusText.classList.add('error');
        statusText.classList.remove('success');
      } else if (statusLower.includes('complete') || statusLower.includes('installed')) {
        statusText.classList.add('success');
        statusText.classList.remove('error');
      } else {
        statusText.classList.remove('success', 'error');
      }

      if (data.status === 'Installation complete!') {
        this.updateDownloadButton(data.modelKey, 'installed', 'Installed');
        this.updateModelStatus(data.modelKey, 'Installed');

        setTimeout(() => {
          if (statusText && statusText.textContent === data.status) {
            statusText.textContent = '';
            statusText.classList.remove('success');
          }
        }, 3000);
      }
      return;
    }

    if (data.phase === 'downloading' && data.total > 0) {
      const downloadedMB = (data.downloaded / (1024 * 1024)).toFixed(1);
      const totalMB = (data.total / (1024 * 1024)).toFixed(1);
      statusText.textContent = `Downloading... ${Math.round(clampedProgress)}% (${downloadedMB}MB / ${totalMB}MB)`;
      statusText.classList.remove('success', 'error');
    } else {
      statusText.textContent = '';
      statusText.classList.remove('success', 'error');
    }
  }

  /**
   * Handle download errors
   */
  private handleDownloadError(modelKey: string, error: string): void {
    const config = this.getModelConfig(modelKey);
    if (!config) return;

    const statusText = this.modal?.querySelector(`#${config.statusTextElement}`) as HTMLElement;
    const button = this.modal?.querySelector(`#download-${modelKey}`) as HTMLButtonElement;
    const progressBar = this.modal?.querySelector(`#${config.progressElement}`) as HTMLElement;
    const progressFill = this.modal?.querySelector(`#${config.progressFillElement}`) as HTMLElement;

    // Show error message
    if (statusText) {
      statusText.textContent = `Error: ${error}`;
      statusText.classList.add('error');
      statusText.classList.remove('success');
    }

    // Reset progress bar
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    // Hide progress bar
    if (progressBar) {
      progressBar.classList.remove('active', 'indeterminate');
    }

    // Re-enable download button
    if (button) {
      button.disabled = false;
    }

    // Clear error message after 5 seconds
    setTimeout(() => {
      if (statusText) {
        statusText.textContent = '';
        statusText.classList.remove('error');
      }
    }, 5000);
  }

  /**
   * Check if all downloads are complete
   */
  private checkAllDownloadsComplete(): void {
    // This would check if all models are downloaded
    // For now, we'll enable the done button
    const doneButton = this.modal?.querySelector('#done-button') as HTMLButtonElement;
    if (doneButton) {
      doneButton.disabled = false;
      doneButton.style.background = '#3b82f6';
      doneButton.style.cursor = 'pointer';
    }
  }
}
