/**
 * Quick Translate Hotkey Service
 * Handles global hotkey for quick translation with clipboard integration
 */

import { clipboard } from 'electron';
import { QuickTranslateService } from './QuickTranslateService';
import { ConfigurationManager } from './ConfigurationManager';
import { TranslationServiceManager } from './TranslationServiceManager';
import { getProcessingModeFromConfig, getModelConfigFromConfig } from '../types/ConfigurationTypes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GlobalKeyboardListener } = require('node-global-key-listener');

export interface QuickTranslateHotkeyConfig {
  enabled: boolean;
  hotkey: string;
  targetLanguage: string;
  sourceLanguage?: string; // Source language for Argos (optional, defaults to 'en')
  provider: 'openai' | 'deepinfra' | 'argos-translate';
  showOverlay: boolean;
}

export class QuickTranslateHotkeyService {
  private static instance: QuickTranslateHotkeyService;
  private globalKeyListener: any;
  private quickTranslateService: QuickTranslateService;
  private translationServiceManager: TranslationServiceManager | null = null;
  private configManager: ConfigurationManager;
  private isEnabled = false;
  private isProcessing = false;
  private config: QuickTranslateHotkeyConfig;
  private overlayWindow: any = null;
  private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };

  private constructor() {
    this.quickTranslateService = new QuickTranslateService();
    this.configManager = ConfigurationManager.getInstance();
    this.config = this.loadConfig();
    this.initializeKeyListener();
  }

  private async getTranslationServiceManager(): Promise<TranslationServiceManager> {
    if (!this.translationServiceManager) {
      this.translationServiceManager = new TranslationServiceManager(this.configManager);
    }
    return this.translationServiceManager;
  }

  public static getInstance(): QuickTranslateHotkeyService {
    if (!QuickTranslateHotkeyService.instance) {
      QuickTranslateHotkeyService.instance = new QuickTranslateHotkeyService();
    }
    return QuickTranslateHotkeyService.instance;
  }

  private loadConfig(): QuickTranslateHotkeyConfig {
    const config = this.configManager.getConfig();
    
    // Use helper function to determine processing mode from modelConfig
    const processingMode = getProcessingModeFromConfig(config);
    const modelConfig = getModelConfigFromConfig(config);
    
    // Get the main translation provider from modelConfig
    const mainTranslationProvider = modelConfig?.gptModel;
    
    console.log(`[QuickTranslate] Config check: processingMode=${processingMode}`);
    console.log(`[QuickTranslate] modelConfig.gptModel=${mainTranslationProvider}`);
    console.log(`[QuickTranslate] quickTranslate.provider=${config.quickTranslate?.provider}`);
    
    // Map main provider to quickTranslate provider format
    let effectiveProvider: 'openai' | 'deepinfra' | 'argos-translate' = 'openai';
    
    if (mainTranslationProvider === 'argos') {
      effectiveProvider = 'argos-translate';
      console.log(`[QuickTranslate] ✅ Using Argos from main config`);
    } else if (mainTranslationProvider === 'deepinfra') {
      effectiveProvider = 'deepinfra';
      console.log(`[QuickTranslate] Using DeepInfra from main config`);
    } else if (mainTranslationProvider === 'openai') {
      effectiveProvider = 'openai';
      console.log(`[QuickTranslate] Using OpenAI from main config`);
    } else {
      console.log(`[QuickTranslate] Main provider not recognized (${mainTranslationProvider}), defaulting to openai`);
    }
    
    // If the explicit quickTranslate.provider doesn't match the main provider, log a warning
    if (config.quickTranslate?.provider && config.quickTranslate.provider !== effectiveProvider) {
      console.log(`[QuickTranslate] ⚠️ Overriding explicit quickTranslate.provider=${config.quickTranslate.provider} with main config provider=${effectiveProvider}`);
    }
    
    const quickTranslateConfig = {
      enabled: config.quickTranslate?.enabled || false,
      hotkey: config.quickTranslate?.hotkey || 'Alt+C',
      targetLanguage: config.quickTranslate?.targetLanguage || 'en',
      sourceLanguage: config.quickTranslate?.sourceLanguage, // Load source language if set
      provider: effectiveProvider, // Always use the main config provider
      showOverlay: config.quickTranslate?.showOverlay !== false
    };
    
    // Set initial enabled state from saved config
    this.isEnabled = quickTranslateConfig.enabled;

    console.log(`[QuickTranslate] Final config: provider=${quickTranslateConfig.provider}, enabled=${quickTranslateConfig.enabled}, sourceLanguage=${quickTranslateConfig.sourceLanguage || 'not set'}`);

    return quickTranslateConfig;
  }

  private saveConfig(): void {
    this.configManager.setValue('quickTranslate', this.config);
  }

  private initializeKeyListener(): void {
    try {
      this.globalKeyListener = new GlobalKeyboardListener();

      this.globalKeyListener.addListener((e: any, down: any) => {
        // Early exit: Only process if it's the C key or ALT modifier
        const nameUpper = (e.name || e.key || '').toString().toUpperCase();
        const isRelevantKey = nameUpper === 'C' ||
                             nameUpper === 'LEFT ALT' ||
                             nameUpper === 'RIGHT ALT' ||
                             nameUpper === 'ALT';

        if (!isRelevantKey) {
          return; // Not a key we care about for Alt+C hotkey
        }

        // Check if Alt+C is pressed
        if (e.state === 'DOWN' && down['LEFT ALT'] && down['C']) {
          this.handleHotkey();
        }
      });

      console.log('⚡ Quick Translate hotkey listener initialized');
    } catch (error) {
      console.error('Failed to initialize quick translate hotkey listener:', error);
    }
  }

  private async handleHotkey(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Reload config to ensure we have the latest provider setting
    this.config = this.loadConfig();

    // If overlay is already shown, just close it and return
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      const modifierKey = process.platform === 'darwin' ? 'Option' : 'Alt';
      console.log(`⚡ Closing existing overlay (press ${modifierKey}+C again to translate new selection)`);
      this.overlayWindow.close();
      this.overlayWindow = null;
      return;
    }

    // Prevent multiple simultaneous translations
    if (this.isProcessing) {
      console.log('⚡ Translation already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      // Capture cursor position at the moment hotkey is pressed
      const { screen } = require('electron');
      const cursorPoint = screen.getCursorScreenPoint();

      // Get selected text
      const selectedText = await this.getSelectedText();

      if (!selectedText || selectedText.trim().length === 0) {
        this.showTranslationOverlay('No text selected', 'Please select some text first', 'error');
        return;
      }
      
      // Show processing overlay
      if (this.config.showOverlay) {
        this.showTranslationOverlay('Translating...', selectedText, 'processing');
      }

      // Translate the text
      // Always use TranslationServiceManager which handles provider selection from main config
      // This ensures consistency with the main app's translation provider
      console.log(`⚡ Quick translate request: target=${this.config.targetLanguage}, provider=${this.config.provider}`);
      
      // Check if we should use Argos (either explicitly set or detected from main config)
      const shouldUseArgos = this.config.provider === 'argos-translate';
      let result: any;
      
      if (shouldUseArgos) {
        // Use TranslationServiceManager which supports Argos and reads from main config
        console.log(`⚡ Using TranslationServiceManager for Argos translation`);
        const translationManager = await this.getTranslationServiceManager();
        
        // For Argos, always use 'auto' for language detection (will default to 'en' in service)
        const sourceLanguage = 'auto';
        
        console.log(`⚡ Argos translation: from=${sourceLanguage}, to=${this.config.targetLanguage}`);
        
        const translationResult = await translationManager.translate(
          selectedText,
          this.config.targetLanguage,
          sourceLanguage
        );
        
        result = {
          success: true,
          translatedText: translationResult.translatedText,
          sourceLanguage: translationResult.sourceLanguage || 'auto',
          targetLanguage: this.config.targetLanguage,
          provider: 'argos-translate',
          timestamp: Date.now()
        };
      } else {
        // Use QuickTranslateService for cloud providers (openai/deepinfra)
        const provider = this.config.provider as 'openai' | 'deepinfra';
        console.log(`⚡ Using QuickTranslateService for ${provider}`);
        result = await this.quickTranslateService.translate(selectedText, {
          to: this.config.targetLanguage,
          provider
        });
      }

      if (result.success && result.translatedText) {
        // Check if translation actually occurred or if same language was detected
        const wasSameLanguage = result.translatedText === selectedText;
        if (wasSameLanguage) {
          console.log(`✅ Same language detected, text returned as-is`);
        } else {
          console.log(`✅ Translation completed: ${result.sourceLanguage} → ${result.targetLanguage}`);
        }

        // Copy translation to clipboard
        clipboard.writeText(result.translatedText);

        // Update existing overlay with result instead of creating new one
        if (this.config.showOverlay && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.updateOverlayContent(result.translatedText, selectedText, 'success');
        } else if (this.config.showOverlay) {
          this.showTranslationOverlay(result.translatedText, selectedText, 'success');
        }

        // Send to main app if window is available
        this.sendToMainApp(selectedText, result.translatedText);

      } else {
        console.error('Translation failed:', result.error);
        if (this.config.showOverlay && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.updateOverlayContent(`Translation failed: ${result.error}`, selectedText, 'error');
        } else if (this.config.showOverlay) {
          this.showTranslationOverlay(`Translation failed: ${result.error}`, selectedText, 'error');
        }
      }

    } catch (error: any) {
      console.error('⚡ Quick translate error:', error);
      if (this.config.showOverlay) {
        this.showTranslationOverlay(`Error: ${error.message}`, 'Translation error', 'error');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async getSelectedText(): Promise<string> {
    try {
      console.log('[QuickTranslate] Starting getSelectedText...');
      
      // Save current clipboard content
      const originalClipboard = clipboard.readText();
      console.log(`[QuickTranslate] Original clipboard: "${originalClipboard?.substring(0, 30)}..."`);

      // Use a unique marker to detect if Ctrl+C actually copied something new
      // Write a unique timestamp-based marker to clipboard
      const marker = `__QUICK_TRANSLATE_MARKER_${Date.now()}__`;
      clipboard.writeText(marker);
      
      // Give the system a moment to ensure focus is on the right window
      // This is critical when we just closed an overlay - the focus transfer can be slow
      await new Promise(resolve => setTimeout(resolve, 100));

      const { exec } = require('child_process');
      const platform = process.platform;
      
      // Platform-specific copy command
      let copyCommand: string;
      if (platform === 'darwin') {
        // macOS: Use AppleScript to copy selected text (Cmd+C)
        // We need to activate the frontmost application first to ensure the copy goes to the right place
        copyCommand = `osascript -e 'tell application "System Events" to keystroke "c" using command down'`;
      } else if (platform === 'win32') {
        // Windows: Use PowerShell
        copyCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`;
      } else {
        // Linux: Use xdotool
        copyCommand = `xdotool key ctrl+c`;
        console.warn('[QuickTranslate] Linux platform detected, copy command may not work reliably');
      }

      // Try sending copy command multiple times with polling
      let selectedText = '';
      const maxAttempts = 5;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Send copy command
        console.log(`[QuickTranslate] Attempt ${attempt + 1}/${maxAttempts}: Sending copy command (${platform})...`);
        
        await new Promise<void>((resolve) => {
          exec(copyCommand, (error: any) => {
            if (error && platform !== 'linux') {
              console.error(`[QuickTranslate] Copy command error:`, error);
            }
            resolve();
          });
        });
        
        // Wait a bit for the clipboard to update
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Check clipboard
        selectedText = clipboard.readText();
        console.log(`[QuickTranslate] Clipboard after attempt ${attempt + 1}: "${selectedText?.substring(0, 50)}${selectedText && selectedText.length > 50 ? '...' : ''}"`);

        // If clipboard changed from our marker to something else, copy succeeded!
        if (selectedText && selectedText !== marker && selectedText.trim().length > 0) {
          console.log(`[QuickTranslate] ✅ Got text on attempt ${attempt + 1}: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`);
          return selectedText;
        }
      }

      // No text was selected - restore original clipboard
      console.log('[QuickTranslate] ❌ No text was copied after all attempts, restoring original clipboard');
      if (originalClipboard && originalClipboard !== marker) {
        clipboard.writeText(originalClipboard);
      }
      return '';
    } catch (error) {
      console.error('Failed to get selected text:', error);
      return '';
    }
  }

  private showTranslationOverlay(translatedText: string, originalText: string, type: 'success' | 'error' | 'processing'): void {
    try {
      // Import BrowserWindow and screen dynamically
      const { BrowserWindow, screen } = require('electron');
      
      // Safety check - should not happen if hotkey logic is working correctly
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        return;
      }

      // Get current cursor position and screen info
      const cursorPoint = screen.getCursorScreenPoint();
      const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);

      // Position overlay near cursor with screen boundary checks
      let windowX = cursorPoint.x + 20;
      let windowY = cursorPoint.y + 20;
      
      const overlayWidth = 400;
      const overlayHeight = 250;
      
      // Ensure overlay stays within screen bounds
      if (windowX + overlayWidth > currentDisplay.workArea.x + currentDisplay.workArea.width) {
        windowX = cursorPoint.x - overlayWidth - 20;
      }
      if (windowY + overlayHeight > currentDisplay.workArea.y + currentDisplay.workArea.height) {
        windowY = cursorPoint.y - overlayHeight - 20;
      }
      
      // Ensure overlay doesn't go off the left or top edge
      windowX = Math.max(windowX, currentDisplay.workArea.x);
      windowY = Math.max(windowY, currentDisplay.workArea.y);

      // Update last mouse position for future reference
      this.lastMousePosition = { x: windowX, y: windowY };

      // Create overlay window
      this.overlayWindow = new BrowserWindow({
        width: overlayWidth,
        height: overlayHeight,
        x: windowX,
        y: windowY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      // Generate HTML content
      const html = this.generateOverlayHTML(translatedText, originalText, type);
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Save position when window is moved
      this.overlayWindow.on('moved', () => {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          const [x, y] = this.overlayWindow.getPosition();
          this.lastMousePosition = { x, y };
        }
      });

      // Handle window close
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });

    } catch (error) {
      console.error('Failed to show translation overlay:', error);
    }
  }

  private generateOverlayHTML(translatedText: string, originalText: string, type: 'success' | 'error' | 'processing'): string {
    const isProcessing = type === 'processing';
    const isError = type === 'error';
    const modifierKey = process.platform === 'darwin' ? 'Option' : 'Alt';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: transparent;
            padding: 10px;
            -webkit-app-region: no-drag;
          }
          .overlay-container {
            background: rgba(255, 255, 255, 0.98);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid ${isError ? 'rgba(231, 76, 60, 0.3)' : isProcessing ? 'rgba(33, 150, 243, 0.3)' : 'rgba(0, 122, 204, 0.3)'};
          }
          .titlebar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            -webkit-app-region: drag;
            cursor: move;
          }
          .header {
            font-size: 12px;
            font-weight: 600;
            color: ${isError ? '#e74c3c' : isProcessing ? '#2196f3' : '#007acc'};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
          }
          .spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(33, 150, 243, 0.3);
            border-radius: 50%;
            border-top-color: #2196f3;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .close-btn {
            width: 20px;
            height: 20px;
            background: #e74c3c;
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 14px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            -webkit-app-region: no-drag;
          }
          .close-btn:hover {
            background: #c0392b;
          }
          .translation {
            font-size: 16px;
            color: ${isError ? '#e74c3c' : '#2c3e50'};
            line-height: 1.5;
            margin-bottom: 16px;
            max-height: 120px;
            overflow-y: auto;
            word-wrap: break-word;
          }
          .original {
            font-size: 12px;
            color: #7f8c8d;
            padding-top: 12px;
            border-top: 1px solid #e1e5e9;
            font-style: italic;
          }
          .footer {
            font-size: 10px;
            color: #95a5a6;
            text-align: center;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="overlay-container">
          <div class="titlebar">
            <div class="header">
              ${isProcessing ? '<div class="spinner"></div>' : ''}
              ${isError ? 'Error' : isProcessing ? 'Translating' : 'Translation'}
            </div>
            <button class="close-btn" onclick="window.close()" title="Close (${modifierKey}+C or Esc)">×</button>
          </div>
          <div class="translation">${this.escapeHtml(translatedText)}</div>
          <div class="original">Original: ${this.escapeHtml(originalText.substring(0, 100))}${originalText.length > 100 ? '...' : ''}</div>
          <div class="footer">${isError ? `Press ${modifierKey}+C or Esc to close` : isProcessing ? 'Processing...' : `Copied to clipboard • Press ${modifierKey}+C or Esc to close`}</div>
        </div>
        <script>
          // Handle Esc key
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              window.close();
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private updateOverlayContent(translatedText: string, originalText: string, type: 'success' | 'error' | 'processing'): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return;
    }

    try {
      const html = this.generateOverlayHTML(translatedText, originalText, type);
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    } catch (error) {
      console.error('Failed to update overlay content:', error);
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private sendToMainApp(originalText: string, translatedText: string): void {
    try {
      // Send IPC message to main app to update the quick translate panel
      const { BrowserWindow } = require('electron');
      const mainWindow = BrowserWindow.getAllWindows().find((win: any) => !win.isDestroyed());
      
      if (mainWindow) {
        mainWindow.webContents.send('quick-translate:hotkey-result', {
          originalText,
          translatedText,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to send to main app:', error);
    }
  }

  // Public methods
  public enable(): void {
    this.isEnabled = true;
    this.config.enabled = true;
    this.saveConfig();
  }

  public disable(): void {
    this.isEnabled = false;
    this.config.enabled = false;
    this.saveConfig();
  }

  public isHotkeyEnabled(): boolean {
    return this.isEnabled;
  }

  public setTargetLanguage(language: string): void {
    this.config.targetLanguage = language;
    this.saveConfig();
  }

  public setProvider(provider: 'openai' | 'deepinfra' | 'argos-translate'): void {
    this.config.provider = provider;
    this.saveConfig();
    // Reset translation service manager when provider changes to ensure correct initialization
    if (provider === 'argos-translate') {
      this.translationServiceManager = null;
    }
  }

  public setShowOverlay(show: boolean): void {
    this.config.showOverlay = show;
    this.saveConfig();
  }

  public getConfig(): QuickTranslateHotkeyConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<QuickTranslateHotkeyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isEnabled = this.config.enabled;
    this.saveConfig();
  }

  public cleanup(): void {
    try {
      if (this.globalKeyListener) {
        this.globalKeyListener.kill();
      }
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}