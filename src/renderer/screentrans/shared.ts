/**
 * Shared context for screen translation modules
 * This file exports getters/setters to access renderer.ts variables
 */

// Access variables from window object where renderer.ts will attach them
export const ctx = {
    // Variables
    get isInitializingScreenTranslation(): boolean {
        return (window as any).__screenTransCtx?.isInitializingScreenTranslation ?? false;
    },
    set isInitializingScreenTranslation(value: boolean) {
        if ((window as any).__screenTransCtx) {
            (window as any).__screenTransCtx.isInitializingScreenTranslation = value;
        }
    },

    get isScreenTranslationProcessing(): boolean {
        return (window as any).__screenTransCtx?.isScreenTranslationProcessing ?? false;
    },
    set isScreenTranslationProcessing(value: boolean) {
        if ((window as any).__screenTransCtx) {
            (window as any).__screenTransCtx.isScreenTranslationProcessing = value;
        }
    },

    get screenTranslationKeybind(): string {
        return (window as any).__screenTransCtx?.screenTranslationKeybind ?? 'KeyT';
    },
    set screenTranslationKeybind(value: string) {
        if ((window as any).__screenTransCtx) {
            (window as any).__screenTransCtx.screenTranslationKeybind = value;
        }
    },

    get isPaddleWarmupEnabled(): boolean {
        return (window as any).__screenTransCtx?.isPaddleWarmupEnabled ?? false;
    },
    set isPaddleWarmupEnabled(value: boolean) {
        if ((window as any).__screenTransCtx) {
            (window as any).__screenTransCtx.isPaddleWarmupEnabled = value;
        }
    },

    // DOM elements
    get screenTranslationTriggerButton(): HTMLButtonElement | null {
        return (window as any).__screenTransCtx?.screenTranslationTriggerButton ?? null;
    },
    get screenTranslationSourceLang(): HTMLSelectElement | null {
        return (window as any).__screenTransCtx?.screenTranslationSourceLang ?? null;
    },
    get screenTranslationTargetLang(): HTMLSelectElement | null {
        return (window as any).__screenTransCtx?.screenTranslationTargetLang ?? null;
    },
    get screenTranslationDisplaySelect(): HTMLSelectElement | null {
        return (window as any).__screenTransCtx?.screenTranslationDisplaySelect ?? null;
    },
    get screenTranslationDisplaySelector(): HTMLDivElement | null {
        return (window as any).__screenTransCtx?.screenTranslationDisplaySelector ?? null;
    },
    get whispraScreenDisplaySelector(): HTMLDivElement | null {
        return (window as any).__screenTransCtx?.whispraScreenDisplaySelector ?? null;
    },
    get screenTranslationProcessingDot(): HTMLElement | null {
        return (window as any).__screenTransCtx?.screenTranslationProcessingDot ?? null;
    },
    get screenTranslationStatus(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.screenTranslationStatus ?? null;
    },
    get whispraScreenProcessingDot(): HTMLElement | null {
        return (window as any).__screenTransCtx?.whispraScreenProcessingDot ?? null;
    },
    get whispraScreenStatus(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.whispraScreenStatus ?? null;
    },
    get totalTextBlocksSpan(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.totalTextBlocksSpan ?? null;
    },
    get successfulTranslationsSpan(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.successfulTranslationsSpan ?? null;
    },
    get processingTimeSpan(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.processingTimeSpan ?? null;
    },
    get screenTranslationKeybindSpan(): HTMLSpanElement | null {
        return (window as any).__screenTransCtx?.screenTranslationKeybindSpan ?? null;
    },
    get screenTranslationKeybindDisplay(): HTMLElement | null {
        return (window as any).__screenTransCtx?.screenTranslationKeybindDisplay ?? null;
    },

    // Functions
    logToDebug(message: string): void {
        (window as any).__screenTransCtx?.logToDebug?.(message);
    },

    async checkPaddlePaddleBeforeScreenTranslation(): Promise<void> {
        return (window as any).__screenTransCtx?.checkPaddlePaddleBeforeScreenTranslation?.();
    },

    async loadAvailableDisplays(): Promise<void> {
        return (window as any).__screenTransCtx?.loadAvailableDisplays?.();
    },

    updateScreenTranslationKeybindDisplay(code: string, keybindSpan: HTMLSpanElement | null, keybindDisplay: HTMLElement | null): void {
        (window as any).__screenTransCtx?.updateScreenTranslationKeybindDisplay?.(code, keybindSpan, keybindDisplay);
    }
};
