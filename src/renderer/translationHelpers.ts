/**
 * Translation helper functions for renderer process UI
 * Provides localized text for buttons and controls
 */

import { getModifierKeyName } from '../utils/platformUtils-renderer.js';

// Translation data
const translations = {
    'en': {
        controls: {
            startTranslation: 'Start Translation',
            stopTranslation: 'Stop Translation',
            startBidirectional: 'Start Bidirectional',
            stopBidirectional: 'Stop Bidirectional'
        }
    },
    'es': {
        controls: {
            startTranslation: 'Iniciar Traducción',
            stopTranslation: 'Detener Traducción',
            startBidirectional: 'Iniciar Bidireccional',
            stopBidirectional: 'Detener Bidireccional'
        }
    },
    'ru': {
        controls: {
            startTranslation: 'Начать Перевод',
            stopTranslation: 'Остановить Перевод',
            startBidirectional: 'Начать Двунаправленный',
            stopBidirectional: 'Остановить Двунаправленный'
        }
    },
    'zh': {
        controls: {
            startTranslation: '开始翻译',
            stopTranslation: '停止翻译',
            startBidirectional: '开始双向翻译',
            stopBidirectional: '停止双向翻译'
        }
    },
    'ja': {
        controls: {
            startTranslation: '翻訳を開始',
            stopTranslation: '翻訳を停止',
            startBidirectional: '双方向を開始',
            stopBidirectional: '双方向を停止'
        }
    }
};

/**
 * Get translated text for translation button
 */
export function getTranslatedButtonText(currentLanguage: string, isRunning: boolean): string {
    const langTranslations = translations[currentLanguage as keyof typeof translations] || translations['en'];
    if (isRunning) {
        return langTranslations.controls.stopTranslation;
    } else {
        return langTranslations.controls.startTranslation;
    }
}

/**
 * Get translated text for bidirectional button
 */
export function getTranslatedBidirectionalButtonText(currentLanguage: string, isRunning: boolean): string {
    const langTranslations = translations[currentLanguage as keyof typeof translations] || translations['en'];
    if (isRunning) {
        return langTranslations.controls.stopBidirectional;
    } else {
        return langTranslations.controls.startBidirectional;
    }
}

/**
 * Update PTT keybind display elements
 */
export function updatePTTKeybindDisplay(
    keybind: string | undefined,
    currentKeybindSpan: HTMLSpanElement | null,
    translationKeybindDisplay: HTMLElement | null
): void {
    // Handle undefined keybind - try to get from DOM or use default
    if (!keybind) {
        // Try to get current keybind from DOM element if available
        if (currentKeybindSpan?.textContent) {
            const existingText = currentKeybindSpan.textContent.trim();
            // If DOM already has a value, keep it
            if (translationKeybindDisplay && !translationKeybindDisplay.textContent) {
                translationKeybindDisplay.textContent = existingText;
            }
            return;
        }
        // If no keybind available, skip update
        console.warn('updatePTTKeybindDisplay: keybind is undefined, skipping update');
        return;
    }

    const displayKey = keybind === 'Space' ? 'Space' :
        keybind.startsWith('Key') ? keybind.substring(3) :
            keybind;

    // Update the overlay keybind display (if it exists)
    if (currentKeybindSpan) {
        currentKeybindSpan.textContent = displayKey;
    }

    // Update the translation tab keybind display
    if (translationKeybindDisplay) {
        translationKeybindDisplay.textContent = displayKey;
    }

    console.log('Updated PTT keybind display to:', displayKey);
}

/**
 * Update bidirectional keybind display elements
 */
export function updateBidirectionalKeybindDisplay(
    keybind: string | undefined,
    bidirectionalKeybindSpan: HTMLSpanElement | null,
    bidirectionalKeybindDisplay: HTMLElement | null
): void {
    // Handle undefined keybind
    if (!keybind) {
        console.warn('updateBidirectionalKeybindDisplay: keybind is undefined, skipping update');
        return;
    }

    // Convert KeyB format to just B for display
    const displayKey = keybind.startsWith('Key') ? keybind.substring(3) : keybind;
    const modifierKey = getModifierKeyName();

    // Update the main keybind span (overlay)
    if (bidirectionalKeybindSpan) {
        bidirectionalKeybindSpan.textContent = `${modifierKey} + ${displayKey}`;
    }

    // Update the bidirectional tab keybind display
    if (bidirectionalKeybindDisplay) {
        bidirectionalKeybindDisplay.textContent = `${modifierKey} + ${displayKey}`;
    }

    // Update the keybind info element in the panel (if it exists from old code)
    const bidirectionalKeybindInfo = document.querySelector('#bidirectional-panel .keybind-info span') as HTMLElement;
    if (bidirectionalKeybindInfo) {
        bidirectionalKeybindInfo.innerHTML = `Toggle with <kbd>${modifierKey} + ${displayKey}</kbd>`;
    }
}

/**
 * Update screen translation keybind display elements
 */
export function updateScreenTranslationKeybindDisplay(
    keybind: string | undefined,
    screenTranslationKeybindSpan: HTMLSpanElement | null,
    screenTranslationKeybindDisplay: HTMLElement | null
): void {
    // Handle undefined keybind
    if (!keybind) {
        console.warn('updateScreenTranslationKeybindDisplay: keybind is undefined, skipping update');
        return;
    }

    // Convert KeyT format to just T for display
    const displayKey = keybind.startsWith('Key') ? keybind.substring(3) : keybind;
    const modifierKey = getModifierKeyName();

    console.log(`🔄 Updating screen translation keybind display to: ${modifierKey} + ${displayKey}`);

    // Update the main keybind span (overlay)
    if (screenTranslationKeybindSpan) {
        screenTranslationKeybindSpan.textContent = `${modifierKey} + ${displayKey}`;
        console.log('✅ Updated screenTranslationKeybindSpan');
    }

    // Update the screen translation tab keybind display (try cached reference first)
    if (screenTranslationKeybindDisplay) {
        screenTranslationKeybindDisplay.textContent = `${modifierKey} + ${displayKey}`;
        console.log('✅ Updated screenTranslationKeybindDisplay (cached)');
    }

    // Also query directly to catch any missed elements
    const directQuery = document.getElementById('screen-translation-keybind-display') as HTMLElement;
    if (directQuery) {
        directQuery.textContent = `${modifierKey} + ${displayKey}`;
        console.log('✅ Updated screen-translation-keybind-display (direct query)');
    } else {
        console.warn('⚠️ Could not find screen-translation-keybind-display element');
    }

    // Update the keybind info element in the panel (if it exists)
    const screenTranslationKeybindInfo = document.querySelector('#screen-translation-panel .keybind-info kbd') as HTMLElement;
    if (screenTranslationKeybindInfo) {
        screenTranslationKeybindInfo.textContent = `${modifierKey} + ${displayKey}`;
        console.log('✅ Updated keybind-info kbd via querySelector');
    }
}

/**
 * Update label text while preserving icons
 */
export function updateLabelText(label: HTMLElement, text: string): void {
    // Find the icon element (if exists) - check for both <i> tags and converted SVG icons
    const icon = label.querySelector('i[data-lucide], svg.lucide');

    if (icon) {
        // If icon exists, preserve it and update only text
        // Clone the icon to preserve it
        const iconClone = icon.cloneNode(true) as HTMLElement;

        // Clear the label completely
        label.innerHTML = '';

        // Add icon back first
        label.appendChild(iconClone);

        // Add text after icon
        label.appendChild(document.createTextNode(' ' + text));

        // Re-initialize Lucide icons if library is loaded
        if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
            (window as any).lucide.createIcons();
        }
    } else {
        // No icon, just update text
        label.textContent = text;
    }
}
