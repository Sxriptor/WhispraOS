/**
 * Quick Translate Panel UI Controller
 * Handles the UI interactions for the quick translate feature
 */

// Import translations helper
import { getTranslations } from '../renderer/i18n.js';

export class QuickTranslatePanel {
  private isTranslating = false;
  private cacheSize = 0;
  private debounceTimer: NodeJS.Timeout | null = null;
  private autoTranslateEnabled = true; // Default to enabled
  private readonly DEBOUNCE_DELAY = 800; // milliseconds to wait after user stops typing

  // UI Elements
  private targetLangSelect: HTMLSelectElement | null = null;
  private inputTextarea: HTMLTextAreaElement | null = null;
  private translateBtn: HTMLButtonElement | null = null;
  private translateBtnText: HTMLSpanElement | null = null;
  private translateSpinner: HTMLDivElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private outputTextarea: HTMLTextAreaElement | null = null;
  private infoDiv: HTMLDivElement | null = null;
  private cacheSizeSpan: HTMLSpanElement | null = null;
  private clearCacheBtn: HTMLButtonElement | null = null;
  private autoTranslateToggle: HTMLDivElement | null = null;
  private autoTranslateSwitch: HTMLDivElement | null = null;
  private autoTranslateInfo: HTMLSpanElement | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.updateCacheSize();
  }

  /**
   * Get Quick Translate panel translations for current language
   */
  private getQuickTranslateTranslations(): any {
    const currentLang = (window as any).currentLanguage || 'en';
    const translations = getTranslations(currentLang);
    return translations.quickTranslatePanel || {};
  }

  private initializeElements(): void {
    this.targetLangSelect = document.getElementById('quick-translate-target-lang') as HTMLSelectElement;
    this.inputTextarea = document.getElementById('quick-translate-input') as HTMLTextAreaElement;
    this.translateBtn = document.getElementById('quick-translate-btn') as HTMLButtonElement;
    this.translateBtnText = document.getElementById('quick-translate-btn-text') as HTMLSpanElement;
    this.translateSpinner = document.getElementById('quick-translate-spinner') as HTMLDivElement;
    this.clearBtn = document.getElementById('quick-translate-clear-btn') as HTMLButtonElement;
    this.copyBtn = document.getElementById('quick-translate-copy-btn') as HTMLButtonElement;
    this.outputTextarea = document.getElementById('quick-translate-output') as HTMLTextAreaElement;
    this.infoDiv = document.getElementById('quick-translate-info') as HTMLDivElement;
    this.cacheSizeSpan = document.getElementById('quick-translate-cache-size') as HTMLSpanElement;
    this.clearCacheBtn = document.getElementById('quick-translate-clear-cache-btn') as HTMLButtonElement;
    this.autoTranslateToggle = document.getElementById('quick-translate-auto-toggle') as HTMLDivElement;
    this.autoTranslateSwitch = document.getElementById('quick-translate-auto-switch') as HTMLDivElement;
    this.autoTranslateInfo = document.getElementById('quick-translate-auto-info') as HTMLSpanElement;
  }

  private setupEventListeners(): void {
    // Translate button
    if (this.translateBtn) {
      this.translateBtn.addEventListener('click', () => {
        this.handleTranslate();
      });
    }

    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clearInputs();
      });
    }

    // Copy button
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => {
        this.copyResult();
      });
    }

    // Clear cache button
    if (this.clearCacheBtn) {
      this.clearCacheBtn.addEventListener('click', () => {
        this.clearCache();
      });
    }

    // Input textarea - enable translate button and trigger real-time translation
    if (this.inputTextarea) {
      // Real-time translation with debouncing and word completion detection
      this.inputTextarea.addEventListener('input', (e: Event) => {
        this.updateTranslateButton();
        
        // Clear existing timer
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        
        const text = this.inputTextarea!.value.trim();
        if (text.length > 0) {
          // Only auto-translate if the toggle is enabled
          if (this.autoTranslateEnabled) {
            // Check if the last character is a word boundary (space, punctuation)
            const lastChar = this.inputTextarea!.value[this.inputTextarea!.value.length - 1];
            const isWordBoundary = /[\s,.!?;:]/.test(lastChar);
            
            // If word is complete (ended with space/punctuation), translate immediately
            if (isWordBoundary && text.length > 0) {
              const t = this.getQuickTranslateTranslations();
              this.updateInfo(t.translatingWord || 'Translating word...');
              this.handleTranslate();
            } else {
              // Otherwise, show "typing..." and wait for debounce
              const t = this.getQuickTranslateTranslations();
              this.updateInfo(t.typingDots || 'Typing...');
              
              // Set new timer to trigger translation after user stops typing
              this.debounceTimer = setTimeout(() => {
                this.handleTranslate();
              }, this.DEBOUNCE_DELAY);
            }
          } else {
            // Auto-translate is off, just update the ready state
            const t = this.getQuickTranslateTranslations();
            this.updateInfo(t.readyToTranslate || 'Ready to translate');
          }
        } else {
          // Clear output if input is empty
          if (this.outputTextarea) {
            this.outputTextarea.value = '';
          }
          if (this.copyBtn) {
            this.copyBtn.disabled = true;
          }
          const t = this.getQuickTranslateTranslations();
          this.updateInfo(t.readyToTranslate || 'Ready to translate');
        }
      });

      // Allow Enter+Ctrl to trigger translation immediately
      this.inputTextarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          // Clear debounce timer and translate immediately
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }
          this.handleTranslate();
        }
      });
    }
    
    // Re-translate when target language changes
    if (this.targetLangSelect) {
      this.targetLangSelect.addEventListener('change', () => {
        // Re-translate if there's text
        if (this.inputTextarea && this.inputTextarea.value.trim().length > 0) {
          // Clear debounce timer and translate immediately
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }
          this.handleTranslate();
        }
      });
    }

    // Auto-translate toggle
    if (this.autoTranslateToggle) {
      this.autoTranslateToggle.addEventListener('click', () => {
        this.toggleAutoTranslate();
      });
    }
  }

  private toggleAutoTranslate(): void {
    this.autoTranslateEnabled = !this.autoTranslateEnabled;
    const t = this.getQuickTranslateTranslations();
    
    if (this.autoTranslateSwitch) {
      this.autoTranslateSwitch.classList.toggle('active', this.autoTranslateEnabled);
    }
    
    if (this.autoTranslateInfo) {
      this.autoTranslateInfo.textContent = this.autoTranslateEnabled 
        ? (t.translatesAsYouType || 'Translates as you type')
        : (t.clickTranslateOrPress || 'Click Translate or press Ctrl+Enter');
    }
    
    this.updateInfo(this.autoTranslateEnabled 
      ? (t.autoTranslateEnabled || 'Auto-translate enabled')
      : (t.autoTranslateDisabled || 'Auto-translate disabled - Click Translate to translate'));
  }

  private async handleTranslate(): Promise<void> {
    if (this.isTranslating || !this.inputTextarea || !this.outputTextarea) return;
    const t = this.getQuickTranslateTranslations();

    const text = this.inputTextarea.value.trim();
    if (!text) {
      this.updateInfo(t.pleaseEnterText || 'Please enter text to translate');
      return;
    }

    this.setTranslating(true);
    this.updateInfo(t.translating || 'Translating...');

    try {
      // Get the provider from settings instead of UI selection
      const config = await (window as any).electronAPI.invoke('quick-translate-hotkey:get-config');
      const provider = config?.provider || 'openai';

      const options = {
        to: this.targetLangSelect?.value || 'en',
        from: 'auto', // Always auto-detect source language
        provider: provider
      };

      const result = await (window as any).electronAPI.invoke('quick-translate:translate', { text, options });

      if (result.success && result.translatedText) {
        this.outputTextarea.value = result.translatedText;
        this.copyBtn!.disabled = false;

        const cacheInfo = result.cached ? ' (cached)' : '';
        const providerInfo = ` via ${result.provider}`;
        this.updateInfo(`${t.translationCompleted || 'Translation completed'}${providerInfo}${cacheInfo}`);
      } else {
        this.outputTextarea.value = '';
        this.copyBtn!.disabled = true;
        this.updateInfo(`${t.translationFailed || 'Translation failed'}: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      this.outputTextarea.value = '';
      this.copyBtn!.disabled = true;
      this.updateInfo(`Error: ${error.message}`);
    } finally {
      this.setTranslating(false);
      this.updateCacheSize();
    }
  }

  private setTranslating(translating: boolean): void {
    this.isTranslating = translating;
    const t = this.getQuickTranslateTranslations();
    
    if (this.translateBtn) {
      this.translateBtn.disabled = translating;
    }
    
    if (this.translateBtnText) {
      this.translateBtnText.textContent = translating 
        ? (t.translating || 'Translating...') 
        : (t.translate || 'Translate');
    }
    
    if (this.translateSpinner) {
      this.translateSpinner.style.display = translating ? 'inline-block' : 'none';
    }
  }

  private updateTranslateButton(): void {
    if (!this.translateBtn || !this.inputTextarea) return;
    
    const hasText = this.inputTextarea.value.trim().length > 0;
    this.translateBtn.disabled = !hasText || this.isTranslating;
  }

  private clearInputs(): void {
    const t = this.getQuickTranslateTranslations();
    if (this.inputTextarea) {
      this.inputTextarea.value = '';
    }
    if (this.outputTextarea) {
      this.outputTextarea.value = '';
    }
    if (this.copyBtn) {
      this.copyBtn.disabled = true;
    }
    this.updateInfo(t.readyToTranslate || 'Ready to translate');
    this.updateTranslateButton();
  }

  private async copyResult(): Promise<void> {
    if (!this.outputTextarea || !this.outputTextarea.value) return;
    const t = this.getQuickTranslateTranslations();

    try {
      await navigator.clipboard.writeText(this.outputTextarea.value);
      this.updateInfo(t.copiedToClipboard || 'Translation copied to clipboard');
    } catch (error) {
      // Fallback for older browsers
      this.outputTextarea.select();
      document.execCommand('copy');
      this.updateInfo(t.copiedToClipboard || 'Translation copied to clipboard');
    }
  }

  private async clearCache(): Promise<void> {
    try {
      await (window as any).electronAPI.invoke('quick-translate:clear-cache');
      this.updateCacheSize();
      this.updateInfo('Translation cache cleared');
    } catch (error: any) {
      this.updateInfo(`Failed to clear cache: ${error.message}`);
    }
  }

  private async updateCacheSize(): Promise<void> {
    try {
      const result = await (window as any).electronAPI.invoke('quick-translate:get-cache-size');
      this.cacheSize = result.size || 0;
      if (this.cacheSizeSpan) {
        this.cacheSizeSpan.textContent = `${this.cacheSize} cached translation${this.cacheSize !== 1 ? 's' : ''}`;
      }
    } catch (error) {
      console.error('Failed to get cache size:', error);
      if (this.cacheSizeSpan) {
        this.cacheSizeSpan.textContent = '0 cached translations';
      }
    }
  }

  private updateInfo(message: string): void {
    if (this.infoDiv) {
      this.infoDiv.textContent = message;
    }
  }

  // Public method to set text programmatically (for future hotkey integration)
  public setInputText(text: string): void {
    if (this.inputTextarea) {
      this.inputTextarea.value = text;
      this.updateTranslateButton();
    }
  }

  // Public method to get the current translation result
  public getTranslationResult(): string {
    return this.outputTextarea?.value || '';
  }
}