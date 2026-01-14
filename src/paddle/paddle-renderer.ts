/**
 * PaddlePaddle renderer integration for screen translation
 */

interface OCRTextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  translatedText?: string;
}

interface ScreenTranslationResult {
  success: boolean;
  textBoxes: OCRTextBox[];
  fullText: string;
  error?: string;
}

/**
 * Check PaddlePaddle installation before allowing screen translation
 */
export async function checkPaddlePaddleBeforeScreenTranslation(): Promise<void> {
  try {
    // Quick cached check - if Paddle was verified recently, skip the check entirely
    console.log('🏓 Quick check for PaddlePaddle installation (using cache)...');

    // Check if PaddlePaddle is already installed (using cache)
    const result = await window.electronAPI.paddle.checkInstallation();

    if (result.success && result.isInstalled && result.hasLanguagePacks) {
      console.log('🏓 PaddlePaddle already verified (cached), proceeding immediately with screen translation');
      return;
    }

    console.log('🏓 PaddlePaddle missing or incomplete, showing installation overlay');

    // Show the PaddlePaddle installation overlay
    window.electronAPI.paddle.showOverlay();

  } catch (error) {
    console.error('❌ Error checking PaddlePaddle before screen translation:', error);

    // Show a fallback error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to check PaddlePaddle installation: ${errorMessage}`);
  }
}

/**
 * Perform screen OCR using PaddleOCR
 * Takes a screenshot and extracts text (no translation)
 */
export async function performScreenOCR(
  targetLanguage: string = 'en',
  displayId: string = 'primary'
): Promise<ScreenTranslationResult> {
  try {
    console.log(`📺 Starting screen OCR for language: ${targetLanguage}`);
    console.log(`📺 Display ID: ${displayId}`);

    // Step 1: Take screenshot
    console.log('📸 Taking screenshot...');

    const screenshotResult = await (window as any).electronAPI.invoke('paddle:take-screenshot', {
      displayId
    });

    console.log('📸 Screenshot result:', screenshotResult);

    if (!screenshotResult.success) {
      throw new Error(`Screenshot failed: ${screenshotResult.error}`);
    }

    console.log(`✅ Screenshot saved: ${screenshotResult.imagePath}`);

    // Step 2: Run OCR
    console.log(`🔍 Running OCR with language: ${targetLanguage}...`);

    const ocrResult = await (window as any).electronAPI.invoke('paddle:run-ocr', {
      imagePath: screenshotResult.imagePath,
      language: targetLanguage
    });

    console.log('🔍 OCR result:', ocrResult);

    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }

    console.log(`✅ OCR found ${ocrResult.total_boxes || ocrResult.text_boxes?.length || 0} text boxes`);

    // Step 3: Update overlay with OCR results (no translation)
    const textBoxes = ocrResult.text_boxes || [];

    try {
      await (window as any).electronAPI.invoke('screen-translation:update-overlay', {
        displayId,
        textBoxes: textBoxes.map((box: OCRTextBox) => ({
          text: box.text,
          translatedText: box.text, // Just show original text for now
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          confidence: box.confidence
        }))
      });
      console.log('✅ Overlay updated with OCR results');
    } catch (overlayError) {
      console.warn('⚠️ Failed to update overlay:', overlayError);
    }

    return {
      success: true,
      textBoxes,
      fullText: ocrResult.full_text || ''
    };

  } catch (error) {
    console.error('❌ Screen OCR failed:', error);
    return {
      success: false,
      textBoxes: [],
      fullText: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


/**
 * Initialize PaddlePaddle renderer functionality
 */
export function initializePaddleRenderer(): void {
  console.log('🏓 Initializing PaddlePaddle renderer functionality...');

  // Set up any global event listeners for PaddlePaddle
  // This could include listening for installation progress updates

  console.log('🏓 PaddlePaddle renderer functionality initialized');
}

/**
 * Cleanup PaddlePaddle renderer functionality
 */
export function cleanupPaddleRenderer(): void {
  console.log('🏓 Cleaning up PaddlePaddle renderer functionality...');

  // Remove any event listeners or cleanup resources

  console.log('🏓 PaddlePaddle renderer functionality cleaned up');
}