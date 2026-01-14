/**
 * Update Notification Module
 * Handles app update notifications, download progress, and installation UI
 */

/**
 * Update Notification Manager Class
 * Displays a notification banner for available updates
 */
export class UpdateNotificationManager {
    private container: HTMLElement | null = null;
    private isVisible = false;
    private isDismissed = false;
    private currentStatus: any = { updateAvailable: false };

    constructor() {
        this.createNotification();
        this.setupEventListeners();
    }

    private createNotification(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'update-notification';
        this.container.innerHTML = `
            <div class="update-notification-content">
                <div class="update-notification-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12c0 1-1 1-1 1s-3 0-3-3 3-3 3-3 1 0 1 1"></path>
                        <path d="M3 12c0-1 1-1 1-1s3 0 3 3-3 3-3 3-1 0-1-1"></path>
                        <path d="M12 21c-1 0-1-1-1-1s0-3 3-3 3 3 3 3 0 1-1 1"></path>
                        <path d="M12 3c1 0 1 1 1 1s0 3-3 3-3-3-3-3 0-1 1-1"></path>
                    </svg>
                </div>
                <div class="update-notification-text">
                    <div class="update-notification-title">Update Available</div>
                    <div class="update-notification-description">A new version of Whispra is ready to install</div>
                    <div class="update-notification-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="progress-text">Downloading...</div>
                    </div>
                </div>
                <div class="update-notification-actions">
                    <button class="update-notification-btn update-notification-info" title="What's New">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4M12 8h.01"></path>
                        </svg>
                    </button>
                    <button class="update-notification-btn update-notification-install" title="Install Update">
                        Install
                    </button>
                    <button class="update-notification-btn update-notification-download" title="Download Update">
                        Download
                    </button>
                    <button class="update-notification-btn update-notification-close" title="Dismiss">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();

        // Hide initially
        this.container.style.display = 'none';

        // Append to body
        document.body.appendChild(this.container);
    }

    private addStyles(): void {
        if (document.getElementById('update-notification-styles')) {
            return; // Styles already added
        }

        const styles = document.createElement('style');
        styles.id = 'update-notification-styles';
        styles.textContent = `
            .update-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                animation: slideInUp 0.3s ease-out;
                backdrop-filter: blur(10px);
            }

            @keyframes slideInUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutDown {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(100%);
                    opacity: 0;
                }
            }

            .update-notification.hiding {
                animation: slideOutDown 0.3s ease-in forwards;
            }

            .update-notification-content {
                padding: 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .update-notification-icon {
                color: #4ade80;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .update-notification-text {
                flex: 1;
                min-width: 0;
            }

            .update-notification-title {
                font-weight: 600;
                margin-bottom: 2px;
                color: #fff;
            }

            .update-notification-description {
                color: #a1a1aa;
                line-height: 1.4;
                margin-bottom: 8px;
            }

            .update-notification-progress {
                margin-top: 8px;
            }

            .progress-bar {
                background: #374151;
                border-radius: 4px;
                height: 6px;
                overflow: hidden;
                margin-bottom: 4px;
            }

            .progress-fill {
                background: #4ade80;
                height: 100%;
                width: 0%;
                transition: width 0.3s ease;
            }

            .progress-text {
                font-size: 12px;
                color: #a1a1aa;
            }

            .update-notification-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-shrink: 0;
            }

            .update-notification-btn {
                background: none;
                border: 1px solid #374151;
                color: #fff;
                border-radius: 4px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }

            .update-notification-btn:hover {
                background: #374151;
                border-color: #4b5563;
            }

            .update-notification-install {
                background: #4ade80;
                border-color: #4ade80;
                color: #000;
                font-weight: 500;
            }

            .update-notification-install:hover {
                background: #22c55e;
                border-color: #22c55e;
            }

            .update-notification-install:disabled {
                background: #6b7280;
                border-color: #6b7280;
                color: #9ca3af;
                cursor: not-allowed;
            }

            .update-notification-download {
                background: #3b82f6;
                border-color: #3b82f6;
                color: #fff;
            }

            .update-notification-download:hover {
                background: #2563eb;
                border-color: #2563eb;
            }

            .update-notification-download:disabled {
                background: #6b7280;
                border-color: #6b7280;
                color: #9ca3af;
                cursor: not-allowed;
            }

            .update-notification-info {
                padding: 6px;
                min-width: auto;
                background: #8b5cf6;
                border-color: #8b5cf6;
            }

            .update-notification-info:hover {
                background: #7c3aed;
                border-color: #7c3aed;
            }

            .update-notification-close {
                padding: 6px;
                min-width: auto;
            }

            .update-notification-close:hover {
                background: #ef4444;
                border-color: #ef4444;
            }

            @media (max-width: 480px) {
                .update-notification {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }

                .update-notification-content {
                    padding: 12px;
                }

                .update-notification-btn {
                    padding: 4px 8px;
                    font-size: 11px;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    private setupEventListeners(): void {
        if (!this.container) return;

        // Install button
        const installBtn = this.container.querySelector('.update-notification-install') as HTMLButtonElement;
        installBtn?.addEventListener('click', () => {
            this.installUpdate();
        });

        // Download button
        const downloadBtn = this.container.querySelector('.update-notification-download') as HTMLButtonElement;
        downloadBtn?.addEventListener('click', () => {
            this.downloadUpdate();
        });

        // Info button (What's New)
        const infoBtn = this.container.querySelector('.update-notification-info') as HTMLButtonElement;
        infoBtn?.addEventListener('click', () => {
            this.showWhatsNew();
        });

        // Close button
        const closeBtn = this.container.querySelector('.update-notification-close') as HTMLButtonElement;
        closeBtn?.addEventListener('click', () => {
            this.dismiss();
        });

        // Listen for update status changes from main process
        if ((window as any).electronAPI) {
            (window as any).electronAPI.onUpdateStatus((data: any) => {
                this.handleUpdateStatus(data);
            });
        }
    }

    private handleUpdateStatus(data: any): void {
        const { event, data: status } = data;

        switch (event) {
            case 'update-available':
                this.currentStatus = status;
                this.showUpdateAvailable();
                break;
            case 'download-progress':
                this.currentStatus = status;
                this.updateDownloadProgress(status.downloadProgress || 0);
                break;
            case 'update-downloaded':
                this.currentStatus = status;
                this.showUpdateReady();
                break;
            case 'update-error':
                this.currentStatus = status;
                this.showError(status.error || 'Update failed');
                break;
            case 'update-not-available':
                this.hide();
                break;
        }
    }

    private showUpdateAvailable(): void {
        if (this.isDismissed) return;

        const title = this.container?.querySelector('.update-notification-title');
        const description = this.container?.querySelector('.update-notification-description');
        const downloadBtn = this.container?.querySelector('.update-notification-download') as HTMLButtonElement;
        const installBtn = this.container?.querySelector('.update-notification-install') as HTMLButtonElement;
        const progressContainer = this.container?.querySelector('.update-notification-progress') as HTMLElement;

        if (title) title.textContent = 'Update Available';
        if (description) description.textContent = 'A new version of Whispra is ready to download';
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;
        }
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }

        this.show();
    }

    private updateDownloadProgress(progress: number): void {
        const progressContainer = this.container?.querySelector('.update-notification-progress') as HTMLElement;
        const progressFill = this.container?.querySelector('.progress-fill') as HTMLElement;
        const progressText = this.container?.querySelector('.progress-text');
        const downloadBtn = this.container?.querySelector('.update-notification-download') as HTMLButtonElement;

        if (progressContainer) progressContainer.style.display = 'block';
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `Downloading... ${Math.round(progress)}%`;
        if (downloadBtn) downloadBtn.disabled = true;
    }

    private showUpdateReady(): void {
        const title = this.container?.querySelector('.update-notification-title');
        const description = this.container?.querySelector('.update-notification-description');
        const downloadBtn = this.container?.querySelector('.update-notification-download') as HTMLButtonElement;
        const installBtn = this.container?.querySelector('.update-notification-install') as HTMLButtonElement;
        const progressContainer = this.container?.querySelector('.update-notification-progress') as HTMLElement;

        if (title) title.textContent = 'Update Ready';
        if (description) description.textContent = 'Update downloaded successfully. Restart to install the new version';
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (installBtn) {
            installBtn.style.display = 'block';
            installBtn.disabled = false;
            installBtn.textContent = 'Restart & Install';
        }
        if (progressContainer) progressContainer.style.display = 'none';
    }

    private showError(error: string): void {
        const title = this.container?.querySelector('.update-notification-title');
        const description = this.container?.querySelector('.update-notification-description');
        const downloadBtn = this.container?.querySelector('.update-notification-download') as HTMLButtonElement;
        const installBtn = this.container?.querySelector('.update-notification-install') as HTMLButtonElement;
        const progressContainer = this.container?.querySelector('.update-notification-progress') as HTMLElement;

        if (title) title.textContent = 'Update Error';
        if (description) description.textContent = error;
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Retry';
        }
        if (installBtn) installBtn.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';
    }

    private async downloadUpdate(): Promise<void> {
        if (!(window as any).electronAPI) return;

        try {
            await (window as any).electronAPI.downloadUpdate();
        } catch (error) {
            console.error('Failed to download update:', error);
        }
    }

    private async installUpdate(): Promise<void> {
        if (!(window as any).electronAPI) return;

        try {
            await (window as any).electronAPI.installUpdate();
        } catch (error) {
            console.error('Failed to install update:', error);
        }
    }

    private async showWhatsNew(): Promise<void> {
        if (!(window as any).electronAPI) return;

        try {
            // Pass the version from update info if available
            const version = this.currentStatus?.updateInfo?.version;
            await (window as any).electronAPI.showWhatsNew(version);
        } catch (error) {
            console.error('Failed to show what\'s new:', error);
        }
    }

    private show(): void {
        if (!this.container || this.isVisible) return;

        this.container.style.display = 'block';
        this.isVisible = true;
        this.isDismissed = false;

        // Remove any existing hiding class
        this.container.classList.remove('hiding');
    }

    private hide(): void {
        if (!this.container || !this.isVisible) return;

        this.container.classList.add('hiding');

        setTimeout(() => {
            if (this.container) {
                this.container.style.display = 'none';
                this.container.classList.remove('hiding');
            }
            this.isVisible = false;
        }, 300);
    }

    private dismiss(): void {
        this.isDismissed = true;
        this.hide();
    }
}

/**
 * Initialize update notification
 */
export function initializeUpdateNotification(): UpdateNotificationManager | null {
    try {
        const instance = new UpdateNotificationManager();
        console.log('✅ Update notification initialized');
        return instance;
    } catch (error) {
        console.error('❌ Failed to initialize update notification:', error);
        return null;
    }
}

// ================================
// UPDATE PAGE FUNCTIONS
// ================================

/**
 * Initialize update page
 */
export function initializeUpdatePage(): void {
    const currentVersionSpan = document.getElementById('current-version') as HTMLSpanElement | null;
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;

    // Display current version
    if (currentVersionSpan) {
        // Get version from package.json or electron API
        if ((window as any).electronAPI && (window as any).electronAPI.versions) {
            const electronVersion = (window as any).electronAPI.versions.electron;
            currentVersionSpan.textContent = `1.0.0 (Electron ${electronVersion})`;
        } else {
            currentVersionSpan.textContent = '1.0.0';
        }
    }

    // Set initial status
    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'Ready to check for updates';
    }

    // Get current update status
    getCurrentUpdateStatus();
}

/**
 * Get current update status
 */
export async function getCurrentUpdateStatus(): Promise<void> {
    if (!(window as any).electronAPI) return;

    try {
        const result = await (window as any).electronAPI.getUpdateStatus();
        if (result.success && result.data) {
            handleUpdateStatusChange({ event: 'update-status', data: result.data });
        }
    } catch (error) {
        console.error('Failed to get update status:', error);
    }
}

/**
 * Manually check for updates
 */
export async function manualCheckForUpdates(): Promise<void> {
    const checkUpdatesButton = document.getElementById('check-updates-button') as HTMLButtonElement | null;
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;
    const updateProgressDot = document.getElementById('update-progress-dot') as HTMLSpanElement | null;

    if (!checkUpdatesButton || !(window as any).electronAPI) return;

    // Disable button and show progress
    checkUpdatesButton.disabled = true;
    checkUpdatesButton.innerHTML = '<span class="icon">🔄</span>Checking...';

    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'Checking for updates...';
    }

    if (updateProgressDot) {
        updateProgressDot.style.display = 'inline-block';
        updateProgressDot.classList.add('recording');
    }

    try {
        await (window as any).electronAPI.checkForUpdates();

        // Wait a moment for the response
        setTimeout(() => {
            checkUpdatesButton.disabled = false;
            checkUpdatesButton.innerHTML = '<span class="icon">🔍</span>Check for Updates';

            if (updateProgressDot) {
                updateProgressDot.style.display = 'none';
                updateProgressDot.classList.remove('recording');
            }
        }, 2000);

    } catch (error) {
        console.error('Failed to check for updates:', error);
        checkUpdatesButton.disabled = false;
        checkUpdatesButton.innerHTML = '<span class="icon">🔍</span>Check for Updates';

        if (updateStatusSpan) {
            updateStatusSpan.textContent = 'Failed to check for updates';
        }

        if (updateProgressDot) {
            updateProgressDot.style.display = 'none';
            updateProgressDot.classList.remove('recording');
        }
    }
}

/**
 * Manually download update
 */
export async function manualDownloadUpdate(): Promise<void> {
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;

    if (!downloadUpdateButton || !(window as any).electronAPI) return;

    downloadUpdateButton.disabled = true;
    downloadUpdateButton.innerHTML = '<span class="icon">⏳</span>Downloading...';

    try {
        await (window as any).electronAPI.downloadUpdate();
    } catch (error) {
        console.error('Failed to download update:', error);
        downloadUpdateButton.disabled = false;
        downloadUpdateButton.innerHTML = '<span class="icon">⬇️</span>Download Update';
    }
}

/**
 * Manually install update
 */
export async function manualInstallUpdate(): Promise<void> {
    const installUpdateButton = document.getElementById('install-update-button') as HTMLButtonElement | null;

    if (!installUpdateButton || !(window as any).electronAPI) return;

    installUpdateButton.disabled = true;
    installUpdateButton.innerHTML = '<span class="icon">⏳</span>Installing...';

    try {
        await (window as any).electronAPI.installUpdate();
    } catch (error) {
        console.error('Failed to install update:', error);
        installUpdateButton.disabled = false;
        installUpdateButton.innerHTML = '<span class="icon">🔄</span>Install & Restart';
    }
}

/**
 * Open release notes
 */
export function openReleaseNotes(): void {
    if ((window as any).electronAPI && (window as any).electronAPI.openExternal) {
        (window as any).electronAPI.openExternal('https://github.com/whispra/whispra/releases');
    } else {
        window.open('https://github.com/whispra/whispra/releases', '_blank');
    }
}

/**
 * Open update settings
 */
export function openUpdateSettings(): void {
    // For now, just show an alert - this could be expanded to show update preferences
    alert('Update Settings\n\nAutomatic updates: Enabled\nCheck frequency: Every 6 hours\nDownload automatically: No\n\nUpdate settings can be configured in the main application menu.');
}

/**
 * Handle update status change
 */
export function handleUpdateStatusChange(data: any): void {
    const { event, data: status } = data;

    switch (event) {
        case 'update-available':
            showUpdateAvailable(status);
            break;
        case 'download-progress':
            showDownloadProgress(status);
            break;
        case 'update-downloaded':
            showUpdateReady(status);
            break;
        case 'update-error':
            showUpdateError(status);
            break;
        case 'update-not-available':
            showNoUpdatesAvailable();
            break;
        case 'update-status':
            showCurrentStatus(status);
            break;
    }
}

/**
 * Show update available
 */
function showUpdateAvailable(status: any): void {
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;
    const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement | null;
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;
    const installUpdateButton = document.getElementById('install-update-button') as HTMLButtonElement | null;
    const updateDetailsContainer = document.getElementById('update-details-container') as HTMLDivElement | null;
    const updateDetails = document.getElementById('update-details') as HTMLDivElement | null;

    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'Update available!';
        updateStatusSpan.style.color = '#4ade80';
    }

    if (updateProgressText) {
        updateProgressText.textContent = 'New version ready to download';
    }

    // Show download button, hide install button
    if (downloadUpdateButton) {
        downloadUpdateButton.style.display = 'inline-flex';
        downloadUpdateButton.disabled = false;
    }
    if (installUpdateButton) {
        installUpdateButton.style.display = 'none';
    }

    // Show update details
    if (updateDetailsContainer && updateDetails) {
        updateDetailsContainer.style.display = 'block';
        updateDetails.innerHTML = `
            <div>Version: ${status.updateInfo?.version || 'Unknown'}</div>
            <div>Release Date: ${status.updateInfo?.releaseDate || 'Unknown'}</div>
            <div>Size: ${formatBytes(status.updateInfo?.files?.[0]?.size || 0)}</div>
        `;
    }
}

/**
 * Show download progress
 */
function showDownloadProgress(status: any): void {
    const progress = status.downloadProgress || 0;
    const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement | null;
    const downloadProgress = document.getElementById('download-progress') as HTMLDivElement | null;
    const updateProgressBar = document.getElementById('update-progress-bar') as HTMLDivElement | null;
    const updateProgressPercentage = document.getElementById('update-progress-percentage') as HTMLDivElement | null;
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;

    if (updateProgressText) {
        updateProgressText.textContent = `Downloading update... ${Math.round(progress)}%`;
    }

    if (downloadProgress) {
        downloadProgress.style.display = 'block';
    }

    if (updateProgressBar) {
        updateProgressBar.style.width = `${progress}%`;
    }

    if (updateProgressPercentage) {
        updateProgressPercentage.textContent = `${Math.round(progress)}%`;
    }

    if (downloadUpdateButton) {
        downloadUpdateButton.disabled = true;
        downloadUpdateButton.innerHTML = `<span class="icon">⏳</span>Downloading... ${Math.round(progress)}%`;
    }
}

/**
 * Show update ready
 */
function showUpdateReady(status: any): void {
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;
    const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement | null;
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;
    const installUpdateButton = document.getElementById('install-update-button') as HTMLButtonElement | null;
    const downloadProgress = document.getElementById('download-progress') as HTMLDivElement | null;

    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'Update ready to install!';
        updateStatusSpan.style.color = '#4ade80';
    }

    if (updateProgressText) {
        updateProgressText.textContent = 'Update downloaded successfully';
    }

    // Hide download button, show install button
    if (downloadUpdateButton) {
        downloadUpdateButton.style.display = 'none';
    }
    if (installUpdateButton) {
        installUpdateButton.style.display = 'inline-flex';
        installUpdateButton.disabled = false;
    }

    // Hide progress bar
    if (downloadProgress) {
        downloadProgress.style.display = 'none';
    }
}

/**
 * Show update error
 */
function showUpdateError(status: any): void {
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;
    const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement | null;
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;
    const installUpdateButton = document.getElementById('install-update-button') as HTMLButtonElement | null;
    const downloadProgress = document.getElementById('download-progress') as HTMLDivElement | null;

    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'Update failed';
        updateStatusSpan.style.color = '#ef4444';
    }

    if (updateProgressText) {
        updateProgressText.textContent = status.error || 'Update failed';
    }

    // Reset buttons
    if (downloadUpdateButton) {
        downloadUpdateButton.style.display = 'inline-flex';
        downloadUpdateButton.disabled = false;
        downloadUpdateButton.innerHTML = '<span class="icon">🔄</span>Retry';
    }
    if (installUpdateButton) {
        installUpdateButton.style.display = 'none';
    }

    // Hide progress bar
    if (downloadProgress) {
        downloadProgress.style.display = 'none';
    }
}

/**
 * Show no updates available
 */
function showNoUpdatesAvailable(): void {
    const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement | null;
    const updateProgressText = document.getElementById('update-progress-text') as HTMLSpanElement | null;
    const updateDetailsContainer = document.getElementById('update-details-container') as HTMLDivElement | null;

    if (updateStatusSpan) {
        updateStatusSpan.textContent = 'No updates available';
        updateStatusSpan.style.color = 'var(--muted)';
    }

    if (updateProgressText) {
        updateProgressText.textContent = 'You are running the latest version';
    }

    // Hide update details
    if (updateDetailsContainer) {
        updateDetailsContainer.style.display = 'none';
    }
}

/**
 * Show current status
 */
function showCurrentStatus(status: any): void {
    if (status.updateAvailable) {
        showUpdateAvailable(status);
    } else {
        showNoUpdatesAvailable();
    }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
