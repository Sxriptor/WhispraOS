import { ScreenTranslationOverlayManager } from './ScreenTranslationOverlayManager';
import { PaddleOCRService, OCRResult } from './PaddleOCRService';
import { TranslationServiceManager } from './TranslationServiceManager';
import { ConfigurationManager } from './ConfigurationManager';
import { ScreenCaptureService } from './ScreenCaptureService';
import { SplitOverlayWindowManager } from './SplitOverlayWindowManager';
import { screen } from 'electron';

export interface ScreenTranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
  isActive: boolean;
  autoTranslate: boolean;
  overlayEnabled: boolean;
}

export interface TranslatedTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  originalText: string;
  translatedText: string;
  confidence: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export class ScreenTranslationManager {
  private static instance: ScreenTranslationManager;
  private overlayManager: ScreenTranslationOverlayManager;
  private ocrService: PaddleOCRService;
  private translationService: TranslationServiceManager;
  private configManager: ConfigurationManager;
  private screenCaptureService: ScreenCaptureService;
  private isActive: boolean = false;
  private settings: ScreenTranslationSettings;
  private processingQueue: Map<string, boolean> = new Map();
  private shouldAbort: boolean = false; // Flag to abort processing immediately
  private isProcessing: boolean = false; // Flag to track if actively processing a capture

  private constructor() {
    this.overlayManager = ScreenTranslationOverlayManager.getInstance();
    this.ocrService = PaddleOCRService.getInstance();
    this.translationService = new TranslationServiceManager(ConfigurationManager.getInstance());
    this.configManager = ConfigurationManager.getInstance();
    this.screenCaptureService = ScreenCaptureService.getInstance();

    // Initialize settings from config - use screenTranslation specific config
    this.settings = {
      sourceLanguage: (this.configManager.getValue('screenTranslation.sourceLanguage') as string) || 'auto',
      targetLanguage: (this.configManager.getValue('screenTranslation.targetLanguage') as string) || 'en',
      isActive: false,
      autoTranslate: true,  // Enable OpenAI translation by default
      overlayEnabled: true
    };
    
    console.log('📺 ScreenTranslationManager initialized with settings:', {
      sourceLanguage: this.settings.sourceLanguage,
      targetLanguage: this.settings.targetLanguage,
      configSource: 'screenTranslation namespace',
      rawConfigValues: {
        sourceFromConfig: this.configManager.getValue('screenTranslation.sourceLanguage'),
        targetFromConfig: this.configManager.getValue('screenTranslation.targetLanguage')
      }
    });
  }

  /**
   * Update mini overlay screen translation indicator
   */
  private updateMiniOverlayIndicator(state: 'off' | 'processing' | 'showing'): void {
    try {
      const overlayManager = SplitOverlayWindowManager.getInstance();
      overlayManager.updateScreenTranslation(state);
    } catch (error) {
      console.error('Failed to update mini overlay indicator:', error);
    }
  }

  public static getInstance(): ScreenTranslationManager {
    if (!ScreenTranslationManager.instance) {
      ScreenTranslationManager.instance = new ScreenTranslationManager();
    }
    return ScreenTranslationManager.instance;
  }

  /**
   * Start screen translation with current settings
   */
  public async startScreenTranslation(): Promise<void> {
    if (this.isActive) {
      console.log('📺 Screen translation already active');
      return;
    }

    console.log('📺 Starting screen translation...');
    console.log(`📺 Settings: ${this.settings.sourceLanguage} → ${this.settings.targetLanguage}`);

    try {
      // Initialize OCR for source language (the language of text on screen)
      const ocrLanguage = this.settings.sourceLanguage === 'auto' ? 'ja' : this.settings.sourceLanguage;
      await this.initializeOCRForLanguage(ocrLanguage);

      // Start overlay system
      if (this.settings.overlayEnabled) {
        await this.overlayManager.startOverlay();
      }

      this.isActive = true;
      this.settings.isActive = true;

      // Update mini overlay indicator to processing
      this.updateMiniOverlayIndicator('processing');

      console.log('📺 Screen translation started successfully');
    } catch (error) {
      console.error('📺 Failed to start screen translation:', error);
      throw new Error(`Failed to start screen translation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop screen translation
   */
  public async stopScreenTranslation(): Promise<void> {
    if (!this.isActive) {
      console.log('📺 Screen translation already inactive');
      return;
    }

    console.log('📺 Stopping screen translation IMMEDIATELY...');

    try {
      // SET ABORT FLAG FIRST - this stops any ongoing processing loops
      this.shouldAbort = true;
      
      // Immediately set inactive to prevent further processing
      this.isActive = false;
      this.settings.isActive = false;

      // Update mini overlay indicator to off
      this.updateMiniOverlayIndicator('off');

      // Clear processing queue immediately
      this.processingQueue.clear();

      // Cancel all active OCR requests IMMEDIATELY - kill Python processes
      this.ocrService.cancelAllActiveRequests();

      // KILL Python OCR processes IMMEDIATELY - but keep persistent service alive
      this.ocrService.cleanup(true); // Keep persistent service running

      // Stop overlay system with force cleanup
      await this.overlayManager.forceCleanup();

      // Clear any cached data
      this.ocrService.clearCache();

      console.log('📺 Screen translation stopped successfully');
    } catch (error) {
      console.error('📺 Failed to stop screen translation:', error);
    } finally {
      // Reset abort flag
      this.shouldAbort = false;
    }
  }

  /**
   * Update translation settings and reinitialize if needed
   */
  public async updateSettings(newSettings: Partial<ScreenTranslationSettings>): Promise<void> {
    const oldTargetLanguage = this.settings.targetLanguage;
    const oldSourceLanguage = this.settings.sourceLanguage;

    // Update settings
    this.settings = { ...this.settings, ...newSettings };

    // Save to configuration - use screenTranslation specific config
    this.configManager.setValue('screenTranslation.sourceLanguage', this.settings.sourceLanguage);
    this.configManager.setValue('screenTranslation.targetLanguage', this.settings.targetLanguage);

    console.log(`📺 Settings updated: ${this.settings.sourceLanguage} → ${this.settings.targetLanguage}`);
    console.log(`📺 Updated settings details:`, {
      oldSource: oldSourceLanguage,
      newSource: this.settings.sourceLanguage,
      oldTarget: oldTargetLanguage,
      newTarget: this.settings.targetLanguage,
      receivedSettings: newSettings
    });

    // If source language changed and system is active, reinitialize OCR
    if (this.isActive && oldSourceLanguage !== this.settings.sourceLanguage) {
      console.log('📺 Source language changed, reinitializing OCR...');
      const ocrLanguage = this.settings.sourceLanguage === 'auto' ? 'ja' : this.settings.sourceLanguage;
      await this.initializeOCRForLanguage(ocrLanguage);
    }

    // Clear overlays when language changes
    if (this.isActive && (oldTargetLanguage !== this.settings.targetLanguage || oldSourceLanguage !== this.settings.sourceLanguage)) {
      await this.overlayManager.clearAllOverlays();
    }
  }

  /**
   * Process screen capture for OCR and translation
   */
  public async processScreenCapture(displayId: string): Promise<TranslatedTextBox[]> {
    if (!this.isActive || this.shouldAbort) {
      console.log('📺 Screen translation not active or abort requested');
      return [];
    }

    // Check if already processing this display
    if (this.processingQueue.get(displayId)) {
      console.log(`📺 Already processing capture for display ${displayId}`);
      return [];
    }

    this.processingQueue.set(displayId, true);
    this.isProcessing = true;

    try {
      console.log(`📺 Processing screen capture for display ${displayId}`);

      // ABORT CHECK
      if (this.shouldAbort) {
        console.log('🛑 ABORT: Processing stopped before display lookup');
        return [];
      }

      // Get display information and sort consistently
      const allDisplays = screen.getAllDisplays();
      const displays = allDisplays.sort((a, b) => {
        if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
        return a.bounds.y - b.bounds.y;
      });
      const targetDisplay = displays.find(d => d.id.toString() === displayId);
      if (!targetDisplay) {
        throw new Error(`Display ${displayId} not found`);
      }

      // ABORT CHECK
      if (this.shouldAbort) {
        console.log('🛑 ABORT: Processing stopped before screen capture');
        return [];
      }

      // Capture screen
      const captureResult = await this.screenCaptureService.captureDisplay(targetDisplay.id);
      if (!captureResult.buffer) {
        throw new Error('Failed to capture screen');
      }

      // ABORT CHECK
      if (this.shouldAbort) {
        console.log('🛑 ABORT: Processing stopped before OCR');
        return [];
      }

      // Perform OCR
      const ocrLanguage = this.settings.sourceLanguage === 'auto' ? 'ja' : this.settings.sourceLanguage;
      console.log(`📖 Performing OCR with language: ${ocrLanguage} (source: ${this.settings.sourceLanguage})`);
      
      // ABORT CHECK before starting OCR
      if (this.shouldAbort) {
        console.log('🛑 ABORT: Processing stopped before OCR');
        return [];
      }
      
      let ocrResult: OCRResult;
      try {
        ocrResult = await this.ocrService.extractText(
          captureResult.buffer,
          ocrLanguage
        );
      } catch (error) {
        // If OCR was cancelled, check abort flag
        if (this.shouldAbort || (error instanceof Error && error.message.includes('cancelled'))) {
          console.log('🛑 ABORT: OCR was cancelled');
          return [];
        }
        throw error;
      }

      // ABORT CHECK after OCR
      if (this.shouldAbort) {
        console.log('🛑 ABORT: Processing stopped after OCR');
        return [];
      }

      // Process text boxes - merge nearby boxes first, then translate if enabled
      const translatedBoxes: TranslatedTextBox[] = [];
      if (ocrResult.boundingBoxes.length > 0) {
        // Merge nearby text boxes before translation
        const mergedBoxes = this.mergeNearbyTextBoxes(ocrResult.boundingBoxes);
        console.log(`📦 Merged ${ocrResult.boundingBoxes.length} boxes into ${mergedBoxes.length} groups`);

        if (this.settings.autoTranslate) {
          console.log(`🌐 Translating ${mergedBoxes.length} merged text boxes`);
        } else {
          console.log(`📝 Showing original OCR text for ${mergedBoxes.length} merged text boxes`);
        }

        for (const box of mergedBoxes) {
          // ABORT CHECK - check at the start of each box iteration
          if (this.shouldAbort) {
            console.log('🛑 ABORT: Translation loop stopped mid-processing');
            break;
          }

          console.log(`📝 Processing OCR text: "${box.text}" (confidence: ${box.confidence})`);

          // Skip if text is too short or likely not meaningful
          if (box.text.trim().length < 2) {
            console.log(`⏭️ Skipping short text: "${box.text}"`);
            continue;
          }

          if (this.settings.autoTranslate) {
            try {
              // ABORT CHECK before translation
              if (this.shouldAbort) {
                console.log('🛑 ABORT: Stopped before translation');
                break;
              }

              // Force refresh settings from config before translation to ensure we have latest values
              const freshSourceLanguage = (this.configManager.getValue('screenTranslation.sourceLanguage') as string) || 'auto';
              const freshTargetLanguage = (this.configManager.getValue('screenTranslation.targetLanguage') as string) || 'en';
              
              // Update settings if they differ from config
              if (freshSourceLanguage !== this.settings.sourceLanguage || freshTargetLanguage !== this.settings.targetLanguage) {
                console.log(`🔄 Settings mismatch detected, updating from config:`, {
                  oldSource: this.settings.sourceLanguage,
                  newSource: freshSourceLanguage,
                  oldTarget: this.settings.targetLanguage,
                  newTarget: freshTargetLanguage
                });
                this.settings.sourceLanguage = freshSourceLanguage;
                this.settings.targetLanguage = freshTargetLanguage;
              }

              console.log(`🌐 Translating: "${box.text}" from ${this.settings.sourceLanguage} to ${this.settings.targetLanguage}`);
              
              const sourceParam = this.settings.sourceLanguage === 'auto' ? undefined : this.settings.sourceLanguage;
              console.log(`📋 Translation parameters:`, {
                text: box.text,
                targetLanguage: this.settings.targetLanguage,
                sourceLanguage: sourceParam,
                settingsSource: this.settings.sourceLanguage,
                settingsTarget: this.settings.targetLanguage,
                freshFromConfig: { freshSourceLanguage, freshTargetLanguage }
              });

              const translationResult = await this.translationService.translate(
                box.text,
                this.settings.targetLanguage,
                sourceParam
              );

              // ABORT CHECK after translation
              if (this.shouldAbort) {
                console.log('🛑 ABORT: Stopped after translation');
                break;
              }

              console.log(`✅ Translation result:`, {
                original: box.text,
                translated: translationResult.translatedText,
                sourceLanguage: translationResult.sourceLanguage,
                targetLanguage: translationResult.targetLanguage
              });

              const translatedBox = {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                originalText: box.text,
                translatedText: translationResult.translatedText,
                confidence: box.confidence,
                sourceLanguage: translationResult.sourceLanguage || this.settings.sourceLanguage,
                targetLanguage: this.settings.targetLanguage
              };

              translatedBoxes.push(translatedBox);

              console.log(`📝 "${box.text}" → "${translationResult.translatedText}"`);

              // Stream update: Show this translation immediately
              if (this.settings.overlayEnabled) {
                await this.updateOverlayWithTranslations(displayId, targetDisplay, translatedBoxes);
                console.log(`🔄 Streamed update: ${translatedBoxes.length} boxes now showing`);
              }
            } catch (translationError) {
              console.warn(`⚠️ Translation failed for "${box.text}":`, translationError);
              // Include untranslated text
              const fallbackBox = {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                originalText: box.text,
                translatedText: box.text, // Use original text as fallback
                confidence: box.confidence,
                sourceLanguage: this.settings.sourceLanguage,
                targetLanguage: this.settings.targetLanguage
              };

              translatedBoxes.push(fallbackBox);

              // Stream update: Show this box immediately even if translation failed
              if (this.settings.overlayEnabled) {
                await this.updateOverlayWithTranslations(displayId, targetDisplay, translatedBoxes);
                console.log(`🔄 Streamed update (fallback): ${translatedBoxes.length} boxes now showing`);
              }
            }
          } else {
            // No translation - show original OCR text
            const ocrBox = {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              originalText: box.text,
              translatedText: box.text, // Use original text as display text
              confidence: box.confidence,
              sourceLanguage: this.settings.sourceLanguage,
              targetLanguage: this.settings.targetLanguage
            };

            translatedBoxes.push(ocrBox);

            console.log(`📝 OCR text: "${box.text}"`);

            // Stream update: Show OCR text immediately (no translation mode)
            if (this.settings.overlayEnabled) {
              await this.updateOverlayWithTranslations(displayId, targetDisplay, translatedBoxes);
              console.log(`🔄 Streamed update (OCR only): ${translatedBoxes.length} boxes now showing`);
            }
          }
        }
      }

      // Final update is no longer needed since we stream updates in the loop
      // The overlay is already up-to-date with all translations

      console.log(`📺 Processed ${translatedBoxes.length} translated text boxes for display ${displayId}`);
      return translatedBoxes;

    } catch (error) {
      console.error(`📺 Error processing screen capture for display ${displayId}:`, error);
      throw error;
    } finally {
      this.processingQueue.delete(displayId);
      this.isProcessing = false;
    }
  }

  /**
   * Merge nearby text boxes that are likely part of the same line or paragraph
   */
  private mergeNearbyTextBoxes(boxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>): Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }> {
    if (boxes.length === 0) return [];

    // Sort boxes by y position (top to bottom), then x position (left to right)
    const sortedBoxes = [...boxes].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > a.height * 0.5) {
        // Different lines if y difference is more than half the height
        return yDiff;
      }
      // Same line, sort by x
      return a.x - b.x;
    });

    const merged: Array<{
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
    }> = [];

    let currentGroup: typeof sortedBoxes = [];

    for (let i = 0; i < sortedBoxes.length; i++) {
      const box = sortedBoxes[i];

      if (currentGroup.length === 0) {
        currentGroup.push(box);
        continue;
      }

      const lastBox = currentGroup[currentGroup.length - 1];

      // Check if boxes are on the same line (similar y position)
      const yOverlap = Math.abs(box.y - lastBox.y) < Math.max(box.height, lastBox.height) * 0.5;

      // Check horizontal proximity (close enough to be part of same text)
      const horizontalGap = box.x - (lastBox.x + lastBox.width);
      const avgWidth = (box.width + lastBox.width) / 2;
      const isNearby = horizontalGap < avgWidth * 1.5; // Merge if gap is less than 1.5x average character width

      if (yOverlap && isNearby) {
        // Add to current group
        currentGroup.push(box);
      } else {
        // Finalize current group and start new one
        if (currentGroup.length > 0) {
          merged.push(this.mergeGroup(currentGroup));
        }
        currentGroup = [box];
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      merged.push(this.mergeGroup(currentGroup));
    }

    return merged;
  }

  /**
   * Merge a group of text boxes into a single box
   */
  private mergeGroup(boxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>): {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  } {
    if (boxes.length === 1) return boxes[0];

    // Combine text with spaces
    const text = boxes.map(b => b.text).join(' ');

    // Calculate bounding box that encompasses all boxes
    const minX = Math.min(...boxes.map(b => b.x));
    const minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.width));
    const maxY = Math.max(...boxes.map(b => b.y + b.height));

    // Average confidence
    const avgConfidence = boxes.reduce((sum, b) => sum + b.confidence, 0) / boxes.length;

    return {
      text,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      confidence: avgConfidence
    };
  }

  /**
   * Initialize OCR for a specific language
   */
  private async initializeOCRForLanguage(language: string): Promise<void> {
    try {
      console.log(`📖 Initializing OCR for language: ${language}`);
      await this.ocrService.initializeForLanguage(language);
      console.log(`✅ OCR initialized successfully for language: ${language}`);
    } catch (error) {
      console.error(`❌ Failed to initialize OCR for language ${language}:`, error);
      throw new Error(`OCR initialization failed for ${language}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update overlay with translated text boxes
   */
  private async updateOverlayWithTranslations(
    displayId: string,
    display: Electron.Display,
    translatedBoxes: TranslatedTextBox[]
  ): Promise<void> {
    const overlayData = {
      textBoxes: translatedBoxes.map(box => ({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: box.originalText, // Original OCR text
        translatedText: box.translatedText, // Either translated text or original text
        confidence: box.confidence
      })),
      displayId: displayId,
      captureDPR: 1.0, // Default DPR
      displayDPR: display.scaleFactor,
      displayBounds: display.bounds
    };

    await this.overlayManager.updateOverlay(overlayData);

    // Update mini overlay indicator to showing (steady orange)
    if (translatedBoxes.length > 0) {
      this.updateMiniOverlayIndicator('showing');
      // After 3 seconds, go back to processing (blinking)
      setTimeout(() => {
        if (this.isActive) {
          this.updateMiniOverlayIndicator('processing');
        }
      }, 3000);
    }
  }

  /**
   * Reload settings from configuration
   */
  public reloadSettings(): void {
    const oldSettings = { ...this.settings };
    
    this.settings.sourceLanguage = (this.configManager.getValue('screenTranslation.sourceLanguage') as string) || 'auto';
    this.settings.targetLanguage = (this.configManager.getValue('screenTranslation.targetLanguage') as string) || 'en';
    
    console.log('📺 Settings reloaded from config:', {
      oldSource: oldSettings.sourceLanguage,
      newSource: this.settings.sourceLanguage,
      oldTarget: oldSettings.targetLanguage,
      newTarget: this.settings.targetLanguage
    });
  }

  /**
   * Debug method to check current configuration values
   */
  public debugConfiguration(): any {
    const configValues = {
      fromConfigManager: {
        sourceLanguage: this.configManager.getValue('screenTranslation.sourceLanguage'),
        targetLanguage: this.configManager.getValue('screenTranslation.targetLanguage')
      },
      fromSettings: {
        sourceLanguage: this.settings.sourceLanguage,
        targetLanguage: this.settings.targetLanguage
      },
      fullConfig: this.configManager.getConfig()
    };
    
    console.log('🔍 Screen Translation Configuration Debug:', configValues);
    return configValues;
  }

  /**
   * Get current settings
   */
  public getSettings(): ScreenTranslationSettings {
    return { ...this.settings };
  }

  /**
   * Check if screen translation is active
   */
  public isScreenTranslationActive(): boolean {
    return this.isActive;
  }

  /**
   * Check if currently processing a screen capture
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Cancel ongoing processing without closing overlays
   */
  public cancelProcessing(): void {
    console.log('📺 Cancelling ongoing screen translation processing IMMEDIATELY...');
    
    // Set abort flag FIRST to stop processing loops
    this.shouldAbort = true;
    this.isProcessing = false;
    this.processingQueue.clear();

    // Cancel all active OCR requests IMMEDIATELY - kill Python processes
    this.ocrService.cancelAllActiveRequests();

    // Reset abort flag after a short delay
    setTimeout(() => {
      this.shouldAbort = false;
      console.log('📺 Processing cancelled, ready for next capture');
    }, 100);
  }

  /**
   * Get supported OCR languages
   */
  public getSupportedOCRLanguages(): string[] {
    return this.ocrService.getSupportedLanguages();
  }

  /**
   * Get supported translation languages
   */
  public getSupportedTranslationLanguages(): string[] {
    return this.translationService.getSupportedLanguages();
  }

  /**
   * Get OCR model download status
   */
  public getOCRDownloadStatus() {
    return this.ocrService.getDownloadStatus();
  }

  /**
   * Check if OCR is initialized for a language
   */
  public isOCRInitializedForLanguage(language: string): boolean {
    return this.ocrService.isLanguageInitialized(language);
  }

  /**
   * Clear all overlays manually
   */
  public async clearOverlays(): Promise<void> {
    await this.overlayManager.clearAllOverlays();
  }

  /**
   * Force reinitialize OCR for current source language
   */
  public async reinitializeOCR(): Promise<void> {
    if (this.isActive) {
      const ocrLanguage = this.settings.sourceLanguage === 'auto' ? 'ja' : this.settings.sourceLanguage;
      await this.initializeOCRForLanguage(ocrLanguage);
    }
  }

  /**
   * Cleanup method to stop screen translation and clean up resources
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up ScreenTranslationManager');
    try {
      await this.stopScreenTranslation();
      console.log('✅ ScreenTranslationManager cleanup completed');
    } catch (error) {
      console.error('❌ Error during ScreenTranslationManager cleanup:', error);
    }
  }
}