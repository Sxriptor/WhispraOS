/**
 * Example usage of the Screen Translation Overlay System
 *
 * This example shows how to integrate the overlay with OCR and translation pipeline
 */

import { ScreenTranslationOverlayManager } from './ScreenTranslationOverlayManager';
import { screen } from 'electron';

interface OCRResult {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  confidence?: number;
}

export class ScreenTranslationExample {
  private overlayManager: ScreenTranslationOverlayManager;
  private isActive: boolean = false;

  constructor() {
    this.overlayManager = ScreenTranslationOverlayManager.getInstance();
  }

  /**
   * Start the screen translation system
   */
  async start(): Promise<void> {
    console.log('🚀 Starting screen translation system...');

    try {
      await this.overlayManager.startOverlay();
      this.isActive = true;
      console.log('✅ Screen translation system started');
    } catch (error) {
      console.error('❌ Failed to start screen translation system:', error);
      throw error;
    }
  }

  /**
   * Stop the screen translation system
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping screen translation system...');

    try {
      await this.overlayManager.stopOverlay();
      this.isActive = false;
      console.log('✅ Screen translation system stopped');
    } catch (error) {
      console.error('❌ Failed to stop screen translation system:', error);
      throw error;
    }
  }

  /**
   * Process OCR results and update overlay
   * This would typically be called from your OCR pipeline
   */
  async processOCRResults(
    ocrResults: OCRResult[],
    displayId: string,
    captureDPR: number = window.devicePixelRatio
  ): Promise<void> {
    if (!this.isActive) {
      console.warn('⚠️ Screen translation system not active');
      return;
    }

    try {
      // Get display information
      const display = screen.getAllDisplays().find(d => d.id.toString() === displayId);
      if (!display) {
        console.warn(`⚠️ Display ${displayId} not found`);
        return;
      }

      const displayDPR = display.scaleFactor || 1;

      // Translate texts (example using a mock translation function)
      const translatedResults = await Promise.all(
        ocrResults.map(async (ocr) => {
          const translation = await this.translateText(ocr.text);
          return {
            x: ocr.bbox.x,
            y: ocr.bbox.y,
            width: ocr.bbox.width,
            height: ocr.bbox.height,
            text: ocr.text,
            translatedText: translation.translatedText,
            confidence: ocr.confidence
          };
        })
      );

      // Update overlay
      await this.overlayManager.updateOverlay({
        textBoxes: translatedResults,
        displayId: displayId,
        captureDPR: captureDPR,
        displayDPR: displayDPR,
        displayBounds: display.bounds
      });

      console.log(`📺 Updated overlay with ${translatedResults.length} translations`);
    } catch (error) {
      console.error('❌ Error processing OCR results:', error);
    }
  }

  /**
   * Mock translation function - replace with your actual translation service
   */
  private async translateText(text: string): Promise<TranslationResult> {
    // This is a mock implementation
    // Replace with your actual translation service (OpenAI, Google Translate, etc.)

    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate API delay

    return {
      originalText: text,
      translatedText: `[Translated] ${text}`,
      confidence: 0.95
    };
  }

  /**
   * Clear all translations from overlay
   */
  async clearTranslations(): Promise<void> {
    if (!this.isActive) {
      console.warn('⚠️ Screen translation system not active');
      return;
    }

    try {
      await this.overlayManager.clearAllOverlays();
      console.log('🧹 Cleared all translations');
    } catch (error) {
      console.error('❌ Error clearing translations:', error);
    }
  }

  /**
   * Example of integrating with screen capture pipeline
   */
  async processScreenCapture(
    screenshotPath: string,
    displayId: string,
    captureDPR: number
  ): Promise<void> {
    try {
      // 1. Run OCR on the screenshot (example)
      const ocrResults = await this.runOCR(screenshotPath);

      // 2. Process the results and update overlay
      await this.processOCRResults(ocrResults, displayId, captureDPR);

    } catch (error) {
      console.error('❌ Error processing screen capture:', error);
    }
  }

  /**
   * Mock OCR function - replace with your actual OCR implementation
   */
  private async runOCR(imagePath: string): Promise<OCRResult[]> {
    // This is a mock implementation
    // Replace with your actual OCR service (PaddleOCR, Tesseract, etc.)

    console.log(`🔍 Running OCR on ${imagePath}...`);

    // Mock OCR results
    return [
      {
        text: "Hello World",
        bbox: { x: 100, y: 50, width: 120, height: 30 },
        confidence: 0.98
      },
      {
        text: "Welcome to the app",
        bbox: { x: 100, y: 100, width: 200, height: 25 },
        confidence: 0.95
      }
    ];
  }

  /**
   * Get system status
   */
  getStatus(): { isActive: boolean; overlayActive: boolean } {
    return {
      isActive: this.isActive,
      overlayActive: this.overlayManager.isOverlayActive()
    };
  }
}

// Example usage:
/*
const screenTranslation = new ScreenTranslationExample();

// Start the system
await screenTranslation.start();

// Process some OCR results
await screenTranslation.processOCRResults([
  {
    text: "Button",
    bbox: { x: 200, y: 300, width: 80, height: 30 },
    confidence: 0.98
  }
], "primary-display", 2.0);

// Stop the system when done
await screenTranslation.stop();
*/