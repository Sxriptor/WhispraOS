import { screen, nativeImage, desktopCapturer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CaptureOptions {
  format: 'png' | 'jpg';
  quality?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  display?: number;
}

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  timestamp: number;
}

/**
 * Screen Capture Service for taking screenshots
 * Supports full screen and region-based captures
 */
export class ScreenCaptureService {
  private static instance: ScreenCaptureService;

  private constructor() {}

  public static getInstance(): ScreenCaptureService {
    if (!ScreenCaptureService.instance) {
      ScreenCaptureService.instance = new ScreenCaptureService();
    }
    return ScreenCaptureService.instance;
  }

  /**
   * Capture the entire screen
   */
  public async captureFullScreen(options: CaptureOptions = { format: 'png' }): Promise<CaptureResult> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Use the primary display by default
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;

      // Get the screen source
      const screenSource = sources.find(source => source.name === 'Entire Screen' || source.name === 'Screen 1') || sources[0];
      
      // Use electron's built-in screen capture
      const image = await this.captureScreenSource(screenSource.id, { width, height });
      
      let buffer: Buffer;
      if (options.format === 'jpg') {
        buffer = image.toJPEG(options.quality || 80);
      } else {
        buffer = image.toPNG();
      }

      return {
        buffer,
        width: image.getSize().width,
        height: image.getSize().height,
        format: options.format,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw new Error(`Screen capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Capture a specific region of the screen
   */
  public async captureRegion(region: CaptureOptions['region'], options: CaptureOptions = { format: 'png' }): Promise<CaptureResult> {
    if (!region) {
      throw new Error('Region is required for region capture');
    }

    try {
      // First capture the full screen
      const fullCapture = await this.captureFullScreen(options);
      
      // Then crop to the specified region
      const fullImage = nativeImage.createFromBuffer(fullCapture.buffer);
      const croppedImage = fullImage.crop(region);

      let buffer: Buffer;
      if (options.format === 'jpg') {
        buffer = croppedImage.toJPEG(options.quality || 80);
      } else {
        buffer = croppedImage.toPNG();
      }

      return {
        buffer,
        width: region.width,
        height: region.height,
        format: options.format,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture region:', error);
      throw new Error(`Region capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save capture to file
   */
  public async saveCaptureToFile(capture: CaptureResult, filePath?: string): Promise<string> {
    try {
      if (!filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `screen-capture-${timestamp}.${capture.format}`;
        filePath = path.join(os.tmpdir(), filename);
      }

      fs.writeFileSync(filePath, capture.buffer);
      console.log(`Screenshot saved: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save capture:', error);
      throw new Error(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available displays
   */
  public getAvailableDisplays(): Electron.Display[] {
    return screen.getAllDisplays();
  }

  /**
   * Get primary display bounds
   */
  public getPrimaryDisplayBounds(): Electron.Rectangle {
    return screen.getPrimaryDisplay().bounds;
  }

  /**
   * Capture from a specific screen source
   */
  private async captureScreenSource(sourceId: string, size: { width: number; height: number }): Promise<Electron.NativeImage> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: size
      });

      const source = sources.find(s => s.id === sourceId);
      if (!source) {
        throw new Error(`Screen source not found: ${sourceId}`);
      }

      return source.thumbnail;
    } catch (error) {
      console.error('Failed to capture screen source:', error);
      throw error;
    }
  }

  /**
   * Quick screenshot for OCR processing
   * Optimized for speed and OCR accuracy
   */
  public async quickScreenshot(): Promise<CaptureResult> {
    return await this.captureFullScreen({ 
      format: 'png', // PNG is better for OCR
      quality: 100 
    });
  }

  /**
   * Capture a specific display by ID
   */
  public async captureDisplay(displayId: number | string, options: CaptureOptions = { format: 'png' }): Promise<CaptureResult> {
    try {
      // Get all displays and sort them consistently with UI
      const allDisplays = screen.getAllDisplays();
      const displays = allDisplays.sort((a, b) => {
        if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
        return a.bounds.y - b.bounds.y;
      });
      console.log(`📺 Available displays (sorted):`, displays.map(d => ({ id: d.id, bounds: d.bounds })));
      console.log(`🎯 Requested display ID: ${displayId}`);
      let targetDisplay;

      if (displayId === 'primary') {
        targetDisplay = screen.getPrimaryDisplay();
      } else {
        // Find display by ID
        const numericId = typeof displayId === 'string' ? parseInt(displayId) : displayId;
        targetDisplay = displays.find(display => display.id === numericId);
        
        if (!targetDisplay) {
          console.warn(`Display ${displayId} not found, using primary display`);
          targetDisplay = screen.getPrimaryDisplay();
        }
      }

      console.log(`✅ Selected display:`, { id: targetDisplay.id, bounds: targetDisplay.bounds });
      const { width, height } = targetDisplay.bounds;

      // Get screen sources
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      });

      console.log(`🖥️ Found ${sources.length} screen sources:`, sources.map(s => ({ id: s.id, name: s.name, display_id: s.display_id })));
      console.log(`📺 Available displays:`, displays.map(d => ({ id: d.id, bounds: d.bounds })));

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Try to find the matching source for this display
      let screenSource = sources[0]; // fallback

      // For multiple displays, try to match by display_id
      if (displays.length > 1 && displayId !== 'primary') {
        // Look for a source that matches the target display's ID
        const matchedSource = sources.find(s => s.display_id?.toString() === targetDisplay!.id.toString());

        if (matchedSource) {
          screenSource = matchedSource;
          console.log(`✅ Found matching screen source by display_id:`, { id: screenSource.id, name: screenSource.name, display_id: screenSource.display_id, targetDisplayId: targetDisplay!.id });
        } else {
          console.log(`⚠️ No source found for display ID ${targetDisplay!.id}, using fallback:`, { id: screenSource.id, name: screenSource.name });
          console.log(`🔍 Available display IDs in sources:`, sources.map(s => s.display_id));
        }
      } else {
        console.log(`📺 Using primary/fallback screen source:`, { id: screenSource.id, name: screenSource.name });
      }

      const image = await this.captureScreenSource(screenSource.id, { width, height });
      
      let buffer: Buffer;
      if (options.format === 'jpg') {
        buffer = image.toJPEG(options.quality || 80);
      } else {
        buffer = image.toPNG();
      }

      return {
        buffer,
        width: image.getSize().width,
        height: image.getSize().height,
        format: options.format,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to capture display:', error);
      throw new Error(`Display capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}