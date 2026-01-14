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

interface WatchBoxSelection {
    x: number;
    y: number;
    width: number;
    height: number;
    displayId: number;
}

interface TextBox {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export class ScreenTranslationWatchBoxManager {
    private static instance: ScreenTranslationWatchBoxManager | null = null;
    private boxSelectWindow: BrowserWindow | null = null;
    private currentSelection: WatchBoxSelection | null = null;
    private paddleService: PaddleOCRService | null = null;
    private translationService: TranslationServiceManager | null = null;
    private screenCaptureService: ScreenCaptureService;
    private overlayManager: ScreenTranslationOverlayManager | null = null;
    private sourceLanguage: string = 'auto';
    private targetLanguage: string = 'en';
    private isWatching: boolean = false;
    private watchInterval: NodeJS.Timeout | null = null;
    private previousTexts: Set<string> = new Set(); // Track previously seen text
    private watchIntervalMs: number = 3000; // Check every 3 seconds to allow time for overlays to display
    private lastOverlayShowTime: number = 0; // Track when overlays were last shown
    private isShowingOverlays: boolean = false; // Flag to prevent clearing overlays while they're being shown

    private constructor() {
        this.screenCaptureService = ScreenCaptureService.getInstance();
        this.setupIPCHandlers();
    }

    public static getInstance(): ScreenTranslationWatchBoxManager {
        if (!ScreenTranslationWatchBoxManager.instance) {
            ScreenTranslationWatchBoxManager.instance = new ScreenTranslationWatchBoxManager();
        }
        return ScreenTranslationWatchBoxManager.instance;
    }

    private setupIPCHandlers(): void {
        // Handle watch box selection
        ipcMain.on('screen-translation-watch-box-selected', async (_event, selection) => {
            console.log('Watch box selected:', selection);
            await this.handleBoxSelection(selection);
        });

        // Handle watch box selection cancel/close
        ipcMain.on('screen-translation-watch-box-close', () => {
            console.log('Watch box selection closed');
            this.closeBoxSelectWindow();
        });
    }

    public async showBoxSelector(sourceLanguage: string, targetLanguage: string): Promise<void> {
        // If already watching, stop watching first
        if (this.isWatching) {
            await this.stopWatching();
        }

        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;

        // Get cursor position to determine which display to show selector on
        const cursorPoint = screen.getCursorScreenPoint();
        const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);

        console.log(`Opening watch box selector on display ${targetDisplay.id} at cursor position`, cursorPoint);

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
                preload: path.join(__dirname, '../screen-translation-watch-box-select-preload.js')
            }
        });

        // Make window always on top but don't take focus
        this.boxSelectWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        
        // Enable mouse events on the overlay without stealing focus
        this.boxSelectWindow.setIgnoreMouseEvents(false);

        // Load the box selection UI (reuse the same HTML but with different IPC channel)
        await this.boxSelectWindow.loadFile(path.join(__dirname, '../screen-translation-watch-box-select.html'));

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

        console.log('Watch box selection set:', this.currentSelection);

        // Close the selection window
        this.closeBoxSelectWindow();

        // Start watching the region
        await this.startWatching();
    }

    private async startWatching(): Promise<void> {
        if (!this.currentSelection) {
            console.error('No selection to watch');
            return;
        }

        if (this.isWatching) {
            console.log('Already watching, stopping previous watch');
            await this.stopWatching();
        }

        console.log('👁️ Starting to watch region:', this.currentSelection);
        this.isWatching = true;
        this.previousTexts.clear(); // Reset tracked texts

        // Initialize services
        if (!this.paddleService) {
            this.paddleService = PaddleOCRService.getInstance();
        }
        if (!this.translationService) {
            this.translationService = new TranslationServiceManager(ConfigurationManager.getInstance());
        }
        if (!this.overlayManager) {
            this.overlayManager = ScreenTranslationOverlayManager.getInstance();
        }

        // Start overlay system if not already active
        if (!this.overlayManager.isOverlayActive()) {
            console.log('📺 Starting overlay system for watch box...');
            await this.overlayManager.startOverlay();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Notify renderer that watching has started
        sendToMainWindow('screen-translation:watch-box-started', {
            x: this.currentSelection.x,
            y: this.currentSelection.y,
            width: this.currentSelection.width,
            height: this.currentSelection.height
        });

        // Start periodic monitoring - SIMPLE FLOW: Check -> Translate -> Show -> Wait -> Clear -> Repeat
        const runCheckCycle = async () => {
            // CRITICAL: Check flag FIRST - stop immediately if watching was stopped
            if (!this.isWatching || !this.currentSelection) {
                console.log('🛑 Check cycle stopped - isWatching:', this.isWatching, 'currentSelection:', !!this.currentSelection);
                return;
            }

            try {
                // STEP 1: Check for new text, translate, and show overlays
                console.log('🔍 Checking for new text...');
                
                // Check flag again before expensive operations
                if (!this.isWatching) {
                    console.log('🛑 Stopped before checkForNewText');
                    return;
                }
                
                const hadNewText = await this.checkForNewText();
                
                // Check flag after checkForNewText
                if (!this.isWatching) {
                    console.log('🛑 Stopped after checkForNewText');
                    return;
                }
                
                if (hadNewText) {
                    console.log('✅ Overlays shown! Waiting 3 seconds before clearing...');
                    
                    // STEP 2: Wait 3 seconds for user to read translations
                    // BUT check flag periodically during wait to stop immediately
                    let waitTime = 0;
                    const checkInterval = 100; // Check every 100ms
                    while (waitTime < 3000 && this.isWatching) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        waitTime += checkInterval;
                    }
                    
                    // If stopped during wait, clear and exit immediately
                    if (!this.isWatching) {
                        console.log('🛑 Stopped during wait, clearing overlays immediately...');
                        if (this.overlayManager) {
                            await this.overlayManager.clearAllOverlays();
                        }
                        return;
                    }
                    
                    console.log('⏰ 3 seconds elapsed, now clearing overlays...');
                    
                    // STEP 3: Clear overlays after they've been visible
                    if (this.isWatching && this.overlayManager) {
                        console.log('🧹 Clearing overlays now...');
                        await this.overlayManager.clearAllOverlays();
                        console.log('✅ Overlays cleared. Waiting 1s before next check...');
                    }
                    
                    // Check flag before next wait
                    if (!this.isWatching) {
                        return;
                    }
                    
                    // STEP 4: Wait 1 second before next check (with periodic checks)
                    waitTime = 0;
                    while (waitTime < 1000 && this.isWatching) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        waitTime += checkInterval;
                    }
                } else {
                    // No new text found, wait 1 second before checking again (with periodic checks)
                    console.log('ℹ️ No new text found. Waiting 1s before next check...');
                    let waitTime = 0;
                    const checkInterval = 100;
                    while (waitTime < 1000 && this.isWatching) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        waitTime += checkInterval;
                    }
                }
                
                // STEP 5: Schedule next check cycle ONLY if still watching
                if (this.isWatching) {
                    console.log('🔄 Scheduling next check cycle...');
                    process.nextTick(() => {
                        if (this.isWatching) {
                            runCheckCycle();
                        }
                    });
                } else {
                    console.log('🛑 Not scheduling next cycle - watching stopped');
                }
                
            } catch (error) {
                console.error('❌ Error in check cycle:', error);
                // Schedule next check even on error, but only if still watching
                if (this.isWatching) {
                    setTimeout(() => {
                        if (this.isWatching) {
                            runCheckCycle();
                        }
                    }, 1000);
                }
            }
        };

        // Start the first cycle after overlay system initializes
        setTimeout(() => runCheckCycle(), 800);
    }

    public async stopWatching(): Promise<void> {
        if (!this.isWatching) {
            return;
        }

        console.log('🛑 Stopping watch box monitoring IMMEDIATELY');
        
        // CRITICAL: Set flag FIRST to stop recursive cycle immediately
        this.isWatching = false;

        // Clear interval if it exists
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }

        // Clear tracked texts
        this.previousTexts.clear();
        this.lastOverlayShowTime = 0;
        this.isShowingOverlays = false;

        // IMMEDIATELY clear all translation overlays
        if (this.overlayManager) {
            try {
                console.log('🧹 Clearing all overlays immediately...');
                await this.overlayManager.clearAllOverlays();
                console.log('✅ Cleared watch box translation overlays');
            } catch (error) {
                console.error('⚠️ Error clearing overlays:', error);
            }
        }

        // Notify renderer that watching has stopped
        sendToMainWindow('screen-translation:watch-box-stopped');

        console.log('✅ Watch box stopped completely');
        
        // Note: We don't close the overlay system here as it might be used by other features
    }

    private async checkForNewText(): Promise<boolean> {
        if (!this.currentSelection || !this.isWatching) {
            return false;
        }

        try {
            // Capture the display
            const captureResult = await this.screenCaptureService.captureDisplay(this.currentSelection.displayId);

            if (!captureResult || !captureResult.buffer) {
                console.error('Failed to capture screen for watch box');
                return false;
            }

            // Perform OCR on the full screen (we'll filter to the region afterwards)
            const ocrLanguage = this.sourceLanguage === 'auto' ? 'en' : this.sourceLanguage;
            const ocrResult = await this.paddleService!.extractText(captureResult.buffer, ocrLanguage);

            if (!ocrResult || !ocrResult.boundingBoxes || ocrResult.boundingBoxes.length === 0) {
                return false; // No text found
            }

            // Filter boxes that overlap with the selected region
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

                return overlaps;
            });

            if (boxesInRegion.length === 0) {
                return false; // No text in region
            }

            // Map to our format
            const boxesWithAdjustedCoords = boxesInRegion.map(box => ({
                text: box.text.trim(),
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height
            }));

            // Filter to only new text (text we haven't seen before)
            const newBoxes = boxesWithAdjustedCoords.filter(box => {
                const textKey = `${box.text}`;
                if (this.previousTexts.has(textKey)) {
                    return false; // Already seen this text
                }
                // Add to seen texts
                this.previousTexts.add(textKey);
                return true; // New text
            });

            if (newBoxes.length === 0) {
                return false; // No new text
            }

            console.log(`🆕 Found ${newBoxes.length} new text box(es) in watch region`);

            // Translate new text boxes
            const translatedResults = [];
            for (const box of newBoxes) {
                // Only translate if the text is in the selected source language
                // For now, we'll translate all new text. Language detection could be added later.
                console.log(`🌐 Watch Box Translation: "${box.text}" from ${this.sourceLanguage} to ${this.targetLanguage}`);
                
                const translationResult = await this.translationService!.translate(
                    box.text,
                    this.targetLanguage,
                    this.sourceLanguage === 'auto' ? undefined : this.sourceLanguage
                );

                const translatedText = typeof translationResult === 'string' 
                    ? translationResult 
                    : (translationResult?.translatedText || box.text);

                console.log(`Translated "${box.text}" -> "${translatedText}"`);

                translatedResults.push({
                    text: box.text,
                    translatedText: translatedText,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height
                });
            }

            // Display translations
            if (translatedResults.length > 0) {
                console.log(`📺 About to show ${translatedResults.length} translation overlay(s)`);
                await this.showTranslationOverlay(translatedResults, this.currentSelection.displayId);
                console.log(`📺 Finished showing translation overlays`);
                return true; // Indicate that overlays were shown
            } else {
                console.log('⚠️ No translated results to display');
                return false;
            }

        } catch (error) {
            console.error('Error in checkForNewText:', error);
            return false;
        }
    }

    private async showTranslationOverlay(results: any[], displayId: number): Promise<void> {
        // Get overlay manager instance - EXACTLY like box selector
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
        // EXACTLY like box selector does
        if (!this.overlayManager.isOverlayActive()) {
            console.log('📺 Starting overlay system for watch box results...');
            await this.overlayManager.startOverlay();
            // Give overlays time to fully initialize - EXACTLY like box selector
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Format results for overlay - EXACTLY like box selector format
        const textBoxes = results.map(result => ({
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
            text: result.text,
            translatedText: result.translatedText,
            confidence: 1.0
        }));

        console.log(`📺 Sending ${textBoxes.length} translated boxes to overlay on display ${displayId}:`, textBoxes);

        // Update overlay with translated text boxes - EXACTLY like box selector
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

    public isWatchingActive(): boolean {
        return this.isWatching;
    }

    public closeBoxSelector(): void {
        console.log('📦 Closing watch box selector...');
        this.closeBoxSelectWindow();
    }

    public cleanup(): void {
        this.stopWatching();
        this.closeBoxSelectWindow();
        this.currentSelection = null;
    }
}

