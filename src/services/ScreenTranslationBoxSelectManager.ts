import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { PaddleOCRService } from './PaddleOCRService';
import { TranslationServiceManager } from './TranslationServiceManager';
import { ScreenCaptureService } from './ScreenCaptureService';
import { ScreenTranslationOverlayManager } from './ScreenTranslationOverlayManager';
import { ConfigurationManager } from './ConfigurationManager';

// Helper function to send message to main window
function sendToMainWindow(channel: string, data?: any): void {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        !win.isDestroyed() && win.getTitle() === 'Whispra'
    );
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

interface BoxSelection {
    x: number;
    y: number;
    width: number;
    height: number;
    displayId: number;
}

export class ScreenTranslationBoxSelectManager {
    private static instance: ScreenTranslationBoxSelectManager | null = null;
    private boxSelectWindow: BrowserWindow | null = null;
    private currentSelection: BoxSelection | null = null;
    private paddleService: PaddleOCRService | null = null;
    private translationService: TranslationServiceManager | null = null;
    private screenCaptureService: ScreenCaptureService;
    private overlayManager: ScreenTranslationOverlayManager | null = null;
    private sourceLanguage: string = 'auto';
    private targetLanguage: string = 'en';
    private warmupPromise: Promise<void> | null = null;

    private constructor() {
        this.screenCaptureService = ScreenCaptureService.getInstance();
        this.setupIPCHandlers();
    }

    public static getInstance(): ScreenTranslationBoxSelectManager {
        if (!ScreenTranslationBoxSelectManager.instance) {
            ScreenTranslationBoxSelectManager.instance = new ScreenTranslationBoxSelectManager();
        }
        return ScreenTranslationBoxSelectManager.instance;
    }

    private setupIPCHandlers(): void {
        // Handle box selection
        ipcMain.on('screen-translation-box-selected', async (_event, selection) => {
            console.log('Box selected:', selection);
            await this.handleBoxSelection(selection);
        });

        // Handle box selection cancel/close
        ipcMain.on('screen-translation-box-close', () => {
            console.log('Box selection closed');
            this.closeBoxSelectWindow();
        });
    }

    public async showBoxSelector(sourceLanguage: string, targetLanguage: string): Promise<void> {
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;

        // Pre-initialize Paddle service immediately so it's warm when box is selected
        // BUT don't wait for it - start it in background and proceed immediately
        console.log('🏓 Pre-initializing Paddle service for box selection (non-blocking)...');
        if (!this.paddleService) {
            this.paddleService = PaddleOCRService.getInstance();
        }
        
        // Start warming up the OCR service in the background (don't await - non-blocking)
        // This ensures the persistent Python process is started and models are loaded while user draws box
        this.warmupPromise = this.paddleService.warmupService(sourceLanguage).catch(err => {
            console.error('⚠️ Paddle warmup failed (will retry on actual OCR):', err);
            return Promise.resolve(); // Always resolve so it doesn't block
        });
        
        console.log('🏓 Paddle warmup started in background, opening box selector immediately...');

        // Get cursor position to determine which display to show selector on
        const cursorPoint = screen.getCursorScreenPoint();
        const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);

        console.log(`Opening box selector on display ${targetDisplay.id} at cursor position`, cursorPoint);

        // Close existing window if any
        this.closeBoxSelectWindow();

        // Create transparent overlay for box selection
        this.boxSelectWindow = new BrowserWindow({
            x: targetDisplay.bounds.x,
            y: targetDisplay.bounds.y,
            width: targetDisplay.bounds.width,
            height: targetDisplay.bounds.height,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            focusable: false, // Don't steal focus from games
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../screen-translation-box-select-preload.js')
            }
        });

        // Make window always on top but don't take focus
        this.boxSelectWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        
        // Enable mouse events on the overlay without stealing focus
        this.boxSelectWindow.setIgnoreMouseEvents(false);

        // Load the box selection UI
        await this.boxSelectWindow.loadFile(path.join(__dirname, '../screen-translation-box-select.html'));

        // Store display ID for later use
        this.currentSelection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            displayId: targetDisplay.id
        };

        // Handle window close
        this.boxSelectWindow.on('closed', () => {
            this.boxSelectWindow = null;
        });
    }

    private async handleBoxSelection(selection: { x: number; y: number; width: number; height: number }): Promise<void> {
        if (!this.currentSelection) {
            console.error('No display info stored');
            return;
        }

        // Update selection with coordinates
        this.currentSelection.x = selection.x;
        this.currentSelection.y = selection.y;
        this.currentSelection.width = selection.width;
        this.currentSelection.height = selection.height;

        console.log('Processing box selection:', this.currentSelection);

        // Close the selection window
        this.closeBoxSelectWindow();

        // Notify renderer that box processing is starting
        sendToMainWindow('screen-translation:box-processing-start');

        // Process the selected region
        await this.processSelectedRegion();
    }

    private async processSelectedRegion(): Promise<void> {
        if (!this.currentSelection) {
            console.error('No selection to process');
            return;
        }

        try {
            // Wait for warmup to complete if still running (with timeout to prevent hanging)
            if (this.warmupPromise) {
                console.log('⏳ Waiting for Paddle warmup to complete...');
                try {
                    await Promise.race([
                        this.warmupPromise,
                        new Promise((resolve) => setTimeout(() => {
                            console.log('⚠️ Warmup wait timed out after 10s, proceeding anyway...');
                            resolve(null);
                        }, 10000))
                    ]);
                } catch (error) {
                    console.error('⚠️ Warmup wait error:', error);
                }
                this.warmupPromise = null;
                console.log('✅ Warmup wait completed, proceeding with OCR');
            }

            // Initialize services if needed
            if (!this.paddleService) {
                this.paddleService = PaddleOCRService.getInstance();
            }
            if (!this.translationService) {
                this.translationService = new TranslationServiceManager(ConfigurationManager.getInstance());
            }

            // Capture the display
            console.log(`Capturing display ${this.currentSelection.displayId}`);
            const captureResult = await this.screenCaptureService.captureDisplay(this.currentSelection.displayId);

            if (!captureResult || !captureResult.buffer) {
                console.error('Failed to capture screen');
                return;
            }

            console.log(`Screen captured: ${captureResult.buffer.length} bytes`);

            // For simplicity, pass the full buffer and adjust coordinates later
            // In production, you would crop using Sharp here
            const ocrLanguage = this.sourceLanguage === 'auto' ? 'en' : this.sourceLanguage;
            console.log(`📖 Using OCR language: ${ocrLanguage} (source: ${this.sourceLanguage})`);
            const ocrResult = await this.paddleService.extractText(captureResult.buffer, ocrLanguage);

            if (!ocrResult || !ocrResult.boundingBoxes || ocrResult.boundingBoxes.length === 0) {
                console.log('No text found');
                return;
            }

            console.log(`Found ${ocrResult.boundingBoxes.length} text boxes`);
            console.log(`Selection region:`, {
                x: this.currentSelection!.x,
                y: this.currentSelection!.y,
                width: this.currentSelection!.width,
                height: this.currentSelection!.height
            });

            // Filter boxes that overlap with the selected region (not just completely inside)
            const boxesInRegion = ocrResult.boundingBoxes.filter(box => {
                // Check if box overlaps with selection (use intersection test)
                const boxRight = box.x + box.width;
                const boxBottom = box.y + box.height;
                const selectionRight = this.currentSelection!.x + this.currentSelection!.width;
                const selectionBottom = this.currentSelection!.y + this.currentSelection!.height;

                const overlaps = !(boxRight < this.currentSelection!.x ||
                                  box.x > selectionRight ||
                                  boxBottom < this.currentSelection!.y ||
                                  box.y > selectionBottom);

                if (ocrResult.boundingBoxes.length <= 10) {
                    // Debug first few boxes
                    console.log(`Box ${box.text.substring(0, 20)}:`, {
                        box: { x: box.x, y: box.y, width: box.width, height: box.height },
                        overlaps
                    });
                }

                return overlaps;
            });

            console.log(`Filtered to ${boxesInRegion.length} boxes within/overlapping selection`);

            if (boxesInRegion.length === 0) {
                console.log('No text found in selected region');
                // Show first few boxes for debugging
                console.log('Sample of all boxes found:', ocrResult.boundingBoxes.slice(0, 3).map(b => ({
                    text: b.text.substring(0, 30),
                    x: b.x,
                    y: b.y,
                    width: b.width,
                    height: b.height
                })));
                return;
            }

            // Translate the text with streaming updates
            const translatedResults = [];
            for (const box of boxesInRegion) {
                console.log(`🌐 Box Selector Translation: "${box.text}" from ${this.sourceLanguage} to ${this.targetLanguage}`);
                
                const translationResult = await this.translationService.translate(
                    box.text,
                    this.targetLanguage,  // Fixed: target language goes second
                    this.sourceLanguage === 'auto' ? undefined : this.sourceLanguage  // Fixed: source language goes third
                );

                // Extract the translated text string from the result object
                const translatedText = typeof translationResult === 'string' 
                    ? translationResult 
                    : (translationResult?.translatedText || box.text);

                console.log(`Translated "${box.text}" -> "${translatedText}"`);

                const translatedBox = {
                    text: box.text,
                    translatedText: translatedText,  // Use the extracted string, not the whole object
                    coordinates: [
                        { x: box.x, y: box.y },
                        { x: box.x + box.width, y: box.y },
                        { x: box.x + box.width, y: box.y + box.height },
                        { x: box.x, y: box.y + box.height }
                    ]
                };

                translatedResults.push(translatedBox);

                // Stream update: Show this translation immediately
                await this.showTranslationOverlay(translatedResults, this.currentSelection.displayId);
                console.log(`🔄 Box Selector Streamed update: ${translatedResults.length} boxes now showing`);
            }

            // Final update is no longer needed since we stream updates in the loop

            // Notify renderer that box processing is complete
            sendToMainWindow('screen-translation:box-processing-complete');

        } catch (error) {
            console.error('Error processing selected region:', error);
            // Notify renderer that box processing failed
            sendToMainWindow('screen-translation:box-processing-complete');
        }
    }

    private async showTranslationOverlay(results: any[], displayId: number): Promise<void> {
        // Get overlay manager instance
        if (!this.overlayManager) {
            this.overlayManager = ScreenTranslationOverlayManager.getInstance();
        }

        console.log(`Displaying ${results.length} translated boxes on display ${displayId}`);

        // Get the display object
        const { screen } = require('electron');
        const displays = screen.getAllDisplays();
        const targetDisplay = displays.find((d: any) => d.id === displayId);
        
        if (!targetDisplay) {
            console.error(`Display ${displayId} not found`);
            return;
        }

        // Start overlay system if not already active
        // This creates overlays for ALL displays and makes the system active
        if (!this.overlayManager.isOverlayActive()) {
            console.log('📺 Starting overlay system for box selection results...');
            await this.overlayManager.startOverlay();
            // Give overlays time to fully initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Format results for overlay
        const textBoxes = results.map(result => ({
            x: result.coordinates[0].x,
            y: result.coordinates[0].y,
            width: result.coordinates[1].x - result.coordinates[0].x,
            height: result.coordinates[2].y - result.coordinates[0].y,
            text: result.text,
            translatedText: result.translatedText,
            confidence: 1.0
        }));

        console.log(`📺 Sending ${textBoxes.length} translated boxes to overlay on display ${displayId}:`, textBoxes);

        // Update overlay with translated text boxes
        await this.overlayManager.updateOverlay({
            textBoxes,
            displayId: displayId.toString(),
            captureDPR: 1.0,
            displayDPR: targetDisplay.scaleFactor,
            displayBounds: targetDisplay.bounds
        });

        console.log(`✅ Overlay update command sent for ${textBoxes.length} translated boxes`);
    }

    private closeBoxSelectWindow(): void {
        if (this.boxSelectWindow && !this.boxSelectWindow.isDestroyed()) {
            this.boxSelectWindow.close();
            this.boxSelectWindow = null;
        }
    }

    public isBoxSelectorOpen(): boolean {
        return this.boxSelectWindow !== null && !this.boxSelectWindow.isDestroyed();
    }

    public closeBoxSelector(): void {
        console.log('📦 Closing box selector...');
        this.closeBoxSelectWindow();
    }

    public cleanup(): void {
        this.closeBoxSelectWindow();
        this.currentSelection = null;
    }
}
