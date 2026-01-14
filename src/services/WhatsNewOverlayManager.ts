import { BrowserWindow } from 'electron';
import * as path from 'path';
import axios from 'axios';

export interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
}

export class WhatsNewOverlayManager {
  private static instance: WhatsNewOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private cachedRelease: ReleaseInfo | null = null;

  // GitHub repo info from package.json publish config
  private readonly GITHUB_OWNER = 'Sxriptor';
  private readonly GITHUB_REPO = 'Whispra-Download';

  public static getInstance(): WhatsNewOverlayManager {
    if (!WhatsNewOverlayManager.instance) {
      WhatsNewOverlayManager.instance = new WhatsNewOverlayManager();
    }
    return WhatsNewOverlayManager.instance;
  }

  constructor() {}

  /**
   * Fetch the latest release info from GitHub
   */
  public async fetchLatestRelease(): Promise<ReleaseInfo | null> {
    try {
      const url = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`;
      console.log('📦 Fetching latest release from:', url);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Whispra-App'
        },
        timeout: 10000
      });

      const release = response.data;
      this.cachedRelease = {
        version: release.tag_name || release.name,
        name: release.name || release.tag_name,
        body: release.body || 'No release notes available.',
        publishedAt: release.published_at,
        htmlUrl: release.html_url
      };

      console.log('📦 Fetched release:', this.cachedRelease.version);
      return this.cachedRelease;
    } catch (error) {
      console.error('❌ Failed to fetch release info:', error);
      return null;
    }
  }

  /**
   * Fetch release info for a specific version
   */
  public async fetchReleaseByTag(tag: string): Promise<ReleaseInfo | null> {
    try {
      const url = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/tags/${tag}`;
      console.log('📦 Fetching release for tag:', tag);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Whispra-App'
        },
        timeout: 10000
      });

      const release = response.data;
      return {
        version: release.tag_name || release.name,
        name: release.name || release.tag_name,
        body: release.body || 'No release notes available.',
        publishedAt: release.published_at,
        htmlUrl: release.html_url
      };
    } catch (error) {
      console.error('❌ Failed to fetch release by tag:', error);
      return null;
    }
  }

  /**
   * Get cached release info
   */
  public getCachedRelease(): ReleaseInfo | null {
    return this.cachedRelease;
  }

  /**
   * Show the What's New overlay
   */
  public async showWhatsNewOverlay(version?: string): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('📦 Creating What\'s New overlay window');

    this.overlayWindow = new BrowserWindow({
      width: 700,
      height: 600,
      minWidth: 500,
      minHeight: 400,
      title: 'What\'s New - Whispra',
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      center: true,
      show: false,
      icon: path.join(__dirname, '../assets/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      }
    });

    // Load the What's New overlay HTML
    const overlayPath = path.join(__dirname, '../whats-new-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Show window when ready and send release data
    this.overlayWindow.once('ready-to-show', async () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
        console.log('📦 What\'s New overlay window shown');

        // Fetch and send release info
        let releaseInfo: ReleaseInfo | null = null;
        if (version) {
          releaseInfo = await this.fetchReleaseByTag(version);
        }
        if (!releaseInfo) {
          releaseInfo = await this.fetchLatestRelease();
        }

        if (releaseInfo && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.webContents.send('whats-new:release-info', releaseInfo);
        }
      }
    });

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      console.log('📦 What\'s New overlay window closed');
      this.overlayWindow = null;
    });

    // Prevent navigation
    this.overlayWindow.webContents.on('will-navigate', (event) => {
      event.preventDefault();
    });

    // Prevent new window creation
    this.overlayWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  /**
   * Close the What's New overlay
   */
  public closeWhatsNewOverlay(): void {
    console.log('📦 WhatsNewOverlayManager.closeWhatsNewOverlay() called');

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('📦 Closing What\'s New overlay window...');
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  /**
   * Check if the overlay window is currently open
   */
  public isOverlayOpen(): boolean {
    return this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }
}
