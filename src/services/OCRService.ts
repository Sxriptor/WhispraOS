import * as path from 'path';
import * as fs from 'fs';

export interface OCRResult {
  text: string;
  boundingBoxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  confidence: number;
}

export interface OCRConfig {
  language: string;
  tessDataPath?: string;
  engineMode?: number;
  pageSegmentationMode?: number;
}

/**
 * OCR Service using Tesseract for text extraction from images
 * Supports multiple languages and provides bounding box information
 */
export class OCRService {
  private static instance: OCRService;
  private tesseract: any = null;
  private isInitialized = false;
  private config: OCRConfig;

  private constructor(config: OCRConfig = { language: 'eng' }) {
    this.config = config;
  }

  public static getInstance(config?: OCRConfig): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService(config);
    }
    return OCRService.instance;
  }

  /**
   * Initialize the OCR engine
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import to avoid issues if tesseract.js is not installed
      try {
        this.tesseract = require('tesseract.js');
      } catch (error) {
        console.warn('tesseract.js not installed, using fallback OCR');
        this.isInitialized = true;
        return;
      }

      console.log('OCR Service initialized with Tesseract.js');
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw new Error(`OCR initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from image buffer
   */
  public async extractText(imageBuffer: Buffer): Promise<OCRResult> {
    await this.initialize();

    if (!this.tesseract) {
      // Fallback for when tesseract.js is not available
      return this.fallbackOCR(imageBuffer);
    }

    try {
      const result = await this.tesseract.recognize(imageBuffer, this.config.language, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const boundingBoxes = this.extractBoundingBoxes(result.data);

      return {
        text: result.data.text,
        boundingBoxes,
        confidence: result.data.confidence || 0
      };
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from image file path
   */
  public async extractTextFromFile(imagePath: string): Promise<OCRResult> {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      const imageBuffer = fs.readFileSync(imagePath);
      return await this.extractText(imageBuffer);
    } catch (error) {
      console.error('Failed to extract text from file:', error);
      throw new Error(`File OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update OCR configuration
   */
  public updateConfig(newConfig: Partial<OCRConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    return [
      'eng', 'rus', 'spa', 'fra', 'deu', 'ita', 'por', 'jpn', 'kor', 'chi_sim', 'chi_tra',
      'ara', 'hin', 'tur', 'pol', 'nld', 'ces', 'dan', 'fin', 'hun', 'nor', 'swe'
    ];
  }

  /**
   * Extract bounding boxes from Tesseract result
   */
  private extractBoundingBoxes(data: any): Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }> {
    if (!data.words) return [];

    return data.words
      .filter((word: any) => word.text.trim().length > 0)
      .map((word: any) => ({
        text: word.text,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        confidence: word.confidence || 0
      }));
  }

  /**
   * Fallback OCR when Tesseract is not available
   */
  private async fallbackOCR(imageBuffer: Buffer): Promise<OCRResult> {
    console.warn('Using fallback OCR - text extraction will be limited');
    
    // This is a placeholder - in a real implementation, you might use:
    // - Windows OCR API
    // - Cloud OCR services
    // - Alternative OCR engines
    return {
      text: '[OCR Not Available - Please install tesseract.js]',
      boundingBoxes: [],
      confidence: 0
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.isInitialized = false;
    this.tesseract = null;
  }
}