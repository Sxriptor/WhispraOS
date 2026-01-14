/**
 * Keybinds tab implementation
 * Provides interface for managing global hotkeys and keybinds
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';
import { getModifierKeyName } from '../../../utils/platformUtils-renderer.js';
import { getTranslations } from '../../../renderer/i18n.js';

interface Keybind {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export class KeybindsTab extends BaseSettingsTab {
  public readonly id = 'keybinds';
  public readonly title = 'Keybinds';
  public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/><path d="M9 6v12"/></svg>';
  public readonly order = 5;

  private keybinds: {
    ptt: Keybind;
    bidirectional: Keybind;
    screenTranslation: Keybind;
    screenTranslationBox: Keybind;
    overlayToggle: Keybind;
  } = {
    ptt: { ctrl: false, alt: false, shift: false, key: 'Space' },
    bidirectional: { ctrl: false, alt: true, shift: false, key: 'B' },
    screenTranslation: { ctrl: false, alt: true, shift: false, key: 'T' },
    screenTranslationBox: { ctrl: false, alt: true, shift: false, key: 'Y' },
    overlayToggle: { ctrl: false, alt: false, shift: false, key: 'F11' }
  };

  private keybindDisplays: Map<string, HTMLElement> = new Map();
  private currentlyChangingKeybind: string | null = null;

  constructor() {
    super();
  }

  /**
   * Get translations for current language
   */
  private getKeybindsTranslations(): any {
    const currentLanguage = (window as any).currentLanguage || 'en';
    const t = getTranslations(currentLanguage);
    return t.settingsModal?.keybinds || {};
  }

  /**
   * Render the Keybinds tab content
   */
  public render(): HTMLElement {
    const container = this.createElement('div', 'keybinds-tab');
    container.style.cssText = `
      padding: var(--settings-spacing-lg);
    `;

    this.renderContent(container);
    return container;
  }

  /**
   * Called when tab becomes active
   */
  public async onActivate(): Promise<void> {
    super.onActivate();
    await this.loadKeybinds();
  }

  /**
   * Render the tab content
   */
  private renderContent(container: HTMLElement): void {
    const t = this.getKeybindsTranslations();
    const modifierKey = getModifierKeyName();
    
    container.innerHTML = '';

    // Header
    const header = this.createElement('div');
    header.style.cssText = `
      margin-bottom: var(--settings-spacing-xl);
    `;

    const title = this.createElement('h2');
    title.style.cssText = `
      margin: 0 0 var(--settings-spacing-sm) 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--settings-text-primary);
    `;
    title.textContent = t.title || 'Keybinds';
    header.appendChild(title);

    const description = this.createElement('p');
    description.style.cssText = `
      margin: 0;
      font-size: 0.875rem;
      color: var(--settings-text-secondary);
      line-height: 1.5;
    `;
    const descText = (t.description || 'Configure global hotkeys for various features. Bidirectional and screen translation use {modifier} + key. Click "Change" to set a new key.')
      .replace(/{modifier}/g, modifierKey);
    description.textContent = descText;
    header.appendChild(description);

    container.appendChild(header);

    // Keybinds Section
    const keybindsSection = this.createKeybindsSection();
    container.appendChild(keybindsSection);

    // Info tip
    const infoTip = this.createInfoTip();
    container.appendChild(infoTip);
  }

  /**
   * Create keybinds section
   */
  private createKeybindsSection(): HTMLElement {
    const t = this.getKeybindsTranslations();
    const modifierKey = getModifierKeyName();
    
    const section = this.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--settings-spacing-lg);
    `;

    // Push-to-Talk
    section.appendChild(this.createKeybindRow(
      'ptt',
      `🗣️ ${t.ptt || 'Push-to-Talk'}`,
      (t.pttDesc || 'Hold this key to speak (default: Space, no Alt needed)').replace(/{modifier}/g, modifierKey)
    ));

    // Bidirectional Toggle
    section.appendChild(this.createKeybindRow(
      'bidirectional',
      `🔁 ${t.bidirectional || 'Toggle Bidirectional'}`,
      (t.bidirectionalDesc || 'Press {modifier} + this key to toggle bidirectional mode (default: B)').replace(/{modifier}/g, modifierKey)
    ));

    // Screen Translation
    section.appendChild(this.createKeybindRow(
      'screenTranslation',
      `🖥️ ${t.screenTranslation || 'Screen Translation'}`,
      (t.screenTranslationDesc || 'Press {modifier} + this key to capture screen (default: T)').replace(/{modifier}/g, modifierKey)
    ));

    // Screen Translation Box Select
    section.appendChild(this.createKeybindRow(
      'screenTranslationBox',
      `📦 ${t.screenTranslationBox || 'Screen Translation Box'}`,
      (t.screenTranslationBoxDesc || 'Press {modifier} + this key to select box area for translation (default: Y)').replace(/{modifier}/g, modifierKey)
    ));

    // Overlay Toggle
    section.appendChild(this.createKeybindRow(
      'overlayToggle',
      `🌐 ${t.overlayToggle || 'Toggle Overlay'}`,
      (t.overlayToggleDesc || 'Press this key to toggle overlay (default: F11, no Alt needed)').replace(/{modifier}/g, modifierKey)
    ));

    // Quick Translation (locked)
    section.appendChild(this.createLockedKeybindRow(
      `⚡ ${t.quickTranslation || 'Quick Translation'}`,
      `${modifierKey} + C`,
      t.quickTranslationLocked || 'This hotkey is fixed and cannot be changed'
    ));

    return section;
  }

  /**
   * Create a keybind row
   */
  private createKeybindRow(id: string, label: string, description: string): HTMLElement {
    const t = this.getKeybindsTranslations();
    
    const row = this.createElement('div');
    row.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--settings-spacing-xs);
      padding: var(--settings-spacing-md);
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
    `;

    // Label and description container
    const labelContainer = this.createElement('div');
    labelContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const labelElem = this.createElement('label');
    labelElem.style.cssText = `
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--settings-text-primary);
    `;
    labelElem.textContent = label;
    labelContainer.appendChild(labelElem);

    const desc = this.createElement('span');
    desc.style.cssText = `
      font-size: 0.75rem;
      color: var(--settings-text-secondary);
    `;
    desc.textContent = description;
    labelContainer.appendChild(desc);

    row.appendChild(labelContainer);

    // Keybind display and change button container
    const inputContainer = this.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      gap: var(--settings-spacing-sm);
      align-items: center;
    `;

    // Keybind display
    const keybindDisplay = this.createElement('div');
    keybindDisplay.style.cssText = `
      flex: 1;
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      background: var(--settings-background);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-sm);
      color: var(--settings-text-primary);
      font-size: 0.875rem;
      font-family: 'Courier New', monospace;
      min-height: 36px;
      display: flex;
      align-items: center;
    `;
    keybindDisplay.innerHTML = `<kbd>${this.formatKeybindDisplay(this.keybinds[id as keyof typeof this.keybinds])}</kbd>`;
    this.keybindDisplays.set(id, keybindDisplay);
    inputContainer.appendChild(keybindDisplay);

    // Change button
    const changeButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    changeButton.style.cssText = `
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      font-size: 0.875rem;
      white-space: nowrap;
      min-width: 80px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #3b82f6;
      border-radius: var(--settings-radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    changeButton.textContent = t.change || 'Change';
    changeButton.addEventListener('click', () => this.handleChangeKeybind(id, label));
    changeButton.addEventListener('mouseenter', () => {
      changeButton.style.background = 'rgba(59, 130, 246, 0.2)';
      changeButton.style.borderColor = 'rgba(59, 130, 246, 0.5)';
    });
    changeButton.addEventListener('mouseleave', () => {
      changeButton.style.background = 'rgba(59, 130, 246, 0.1)';
      changeButton.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    });
    inputContainer.appendChild(changeButton);

    row.appendChild(inputContainer);

    return row;
  }

  /**
   * Create a locked keybind row (non-editable)
   */
  private createLockedKeybindRow(label: string, keybind: string, description: string): HTMLElement {
    const t = this.getKeybindsTranslations();
    
    const row = this.createElement('div');
    row.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--settings-spacing-xs);
      padding: var(--settings-spacing-md);
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      opacity: 0.7;
    `;

    // Label and description container
    const labelContainer = this.createElement('div');
    labelContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const labelElem = this.createElement('label');
    labelElem.style.cssText = `
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--settings-text-primary);
    `;
    labelElem.textContent = label;
    labelContainer.appendChild(labelElem);

    const desc = this.createElement('span');
    desc.style.cssText = `
      font-size: 0.75rem;
      color: var(--settings-text-secondary);
    `;
    desc.textContent = description;
    labelContainer.appendChild(desc);

    row.appendChild(labelContainer);

    // Keybind display and locked button container
    const inputContainer = this.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      gap: var(--settings-spacing-sm);
      align-items: center;
    `;

    // Keybind display
    const keybindDisplay = this.createElement('div');
    keybindDisplay.style.cssText = `
      flex: 1;
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      background: var(--settings-background);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-sm);
      color: var(--settings-text-primary);
      font-size: 0.875rem;
      font-family: 'Courier New', monospace;
      min-height: 36px;
      display: flex;
      align-items: center;
    `;
    keybindDisplay.innerHTML = `<kbd>${keybind}</kbd>`;
    inputContainer.appendChild(keybindDisplay);

    // Locked button
    const lockedButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    lockedButton.style.cssText = `
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      font-size: 0.875rem;
      white-space: nowrap;
      min-width: 80px;
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      color: var(--settings-text-secondary);
      border-radius: var(--settings-radius-sm);
      cursor: not-allowed;
      opacity: 0.5;
    `;
    lockedButton.textContent = t.locked || 'Locked';
    lockedButton.disabled = true;
    inputContainer.appendChild(lockedButton);

    row.appendChild(inputContainer);

    return row;
  }

  /**
   * Create info tip
   */
  private createInfoTip(): HTMLElement {
    const t = this.getKeybindsTranslations();
    const modifierKey = getModifierKeyName();
    
    const tip = this.createElement('div');
    tip.style.cssText = `
      margin-top: var(--settings-spacing-lg);
      padding: var(--settings-spacing-md);
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: var(--settings-radius-md);
    `;

    const tipText = this.createElement('p');
    tipText.style.cssText = `
      margin: 0;
      color: var(--settings-text-secondary);
      font-size: 0.75rem;
      line-height: 1.4;
    `;
    const tipContent = (t.tip || 'Push-to-talk and overlay toggle don\'t need {modifier}. Bidirectional and screen translation require {modifier} + key. Press ESC to cancel.')
      .replace(/{modifier}/g, modifierKey);
    tipText.innerHTML = `<strong>💡 Tip:</strong> ${tipContent}`;
    tip.appendChild(tipText);

    return tip;
  }

  /**
   * Load keybinds from config
   */
  private async loadKeybinds(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (!configResponse?.success) {
        console.warn('Failed to load config for keybinds');
        return;
      }

      const cfg = configResponse.payload;

      // Load PTT hotkey
      if (cfg.uiSettings?.pttHotkey) {
        this.keybinds.ptt = cfg.uiSettings.pttHotkey;
      }

      // Load bidirectional hotkey
      if (cfg.uiSettings?.bidirectionalHotkey) {
        this.keybinds.bidirectional = cfg.uiSettings.bidirectionalHotkey;
      }

      // Load screen translation hotkey
      if (cfg.uiSettings?.screenTranslationHotkey) {
        this.keybinds.screenTranslation = cfg.uiSettings.screenTranslationHotkey;
      }

      // Load screen translation box hotkey
      if (cfg.uiSettings?.screenTranslationBoxHotkey) {
        this.keybinds.screenTranslationBox = cfg.uiSettings.screenTranslationBoxHotkey;
      }

      // Load overlay toggle hotkey
      if (cfg.uiSettings?.overlaySettings?.toggleHotkey) {
        this.keybinds.overlayToggle = cfg.uiSettings.overlaySettings.toggleHotkey;
      }

      // Update displays
      this.updateAllDisplays();
    } catch (error) {
      console.error('Failed to load keybinds:', error);
    }
  }

  /**
   * Update all keybind displays
   */
  private updateAllDisplays(): void {
    for (const [id, element] of this.keybindDisplays.entries()) {
      const keybind = this.keybinds[id as keyof typeof this.keybinds];
      element.innerHTML = `<kbd>${this.formatKeybindDisplay(keybind)}</kbd>`;
    }
  }

  /**
   * Format keybind for display
   */
  private formatKeybindDisplay(keybind: Keybind): string {
    const parts: string[] = [];
    const modifierKey = getModifierKeyName();

    if (keybind.ctrl) parts.push('Ctrl');
    if (keybind.alt) parts.push(modifierKey);
    if (keybind.shift) parts.push('Shift');

    let key = keybind.key;
    if (key === 'Space') {
      key = 'SPACE';
    } else if (key.startsWith('Key') && key.length === 4) {
      // KeyA-KeyZ format - should already be converted but handle just in case
      key = key.substring(3).toUpperCase();
    } else if (key.startsWith('Digit')) {
      key = key.substring(5);
    } else if (key.startsWith('Numpad')) {
      key = 'Numpad ' + key.substring(6);
    } else if (/^[a-z]$/i.test(key)) {
      // Single letter - uppercase it
      key = key.toUpperCase();
    }
    // Function keys (F1-F12) stay as is

    parts.push(key);

    return parts.join(' + ');
  }

  /**
   * Handle keybind change request
   */
  private handleChangeKeybind(id: string, label: string): void {
    this.currentlyChangingKeybind = id;

    // Create modal for keybind capture, passing whether this keybind requires Alt
    const requiresAlt = id !== 'overlayToggle' && id !== 'ptt'; // PTT and overlay toggle don't need Alt, everything else uses Alt
    this.createKeybindModal(label, requiresAlt, async (newKeybind: Keybind) => {
      // Update the keybind
      this.keybinds[id as keyof typeof this.keybinds] = newKeybind;

      // Update display
      const display = this.keybindDisplays.get(id);
      if (display) {
        display.innerHTML = `<kbd>${this.formatKeybindDisplay(newKeybind)}</kbd>`;
      }

      // Save immediately
      await this.saveKeybind(id, newKeybind);

      this.currentlyChangingKeybind = null;
    });
  }

  /**
   * Save a specific keybind immediately
   */
  private async saveKeybind(id: string, keybind: Keybind): Promise<void> {
    try {
      console.log(`[KeybindsTab] Saving keybind: ${id}`, keybind);

      const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
      };

      // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
      if (id === 'ptt' && keybind.key === 'Space' && !keybind.ctrl) {
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
        keybind.ctrl = true;
        keybind.alt = false;
        keybind.shift = false;
      }
      
      // ENFORCE: Non-function keys (except Space) MUST have Alt for PTT - hardcode it
      if (id === 'ptt' && keybind.key !== 'Space' && !isFunctionKey(keybind.key) && !keybind.alt) {
        console.log(`🚫 ${keybind.key} requires Alt for PTT - enforcing Alt+${keybind.key}`);
        keybind.alt = true;
        keybind.ctrl = false;
        keybind.shift = false;
      }

      // Prepare config payload based on keybind type
      let configPayload: any = {};

      switch (id) {
        case 'ptt':
          configPayload = {
            uiSettings: {
              pttHotkey: keybind
            }
          };
          break;
        case 'bidirectional':
          configPayload = {
            uiSettings: {
              bidirectionalHotkey: keybind
            }
          };
          break;
        case 'screenTranslation':
          configPayload = {
            uiSettings: {
              screenTranslationHotkey: keybind
            }
          };
          break;
        case 'screenTranslationBox':
          configPayload = {
            uiSettings: {
              screenTranslationBoxHotkey: keybind
            }
          };
          break;
        case 'overlayToggle':
          configPayload = {
            uiSettings: {
              overlaySettings: {
                toggleHotkey: keybind
              }
            }
          };
          break;
      }

      // Save to config
      console.log(`[KeybindsTab] Saving to config:`, configPayload);
      const configResponse = await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: configPayload
      });
      console.log(`[KeybindsTab] Config save response:`, configResponse);

      // Update active hotkeys in main process
      const hotkeyUpdate: any = {};
      if (id === 'ptt') {
        hotkeyUpdate.pttHotkey = keybind;
      } else if (id === 'bidirectional') {
        hotkeyUpdate.bidirectionalHotkey = keybind;
      } else if (id === 'screenTranslation') {
        hotkeyUpdate.screenTranslationHotkey = keybind;
      } else if (id === 'screenTranslationBox') {
        hotkeyUpdate.screenTranslationBoxHotkey = keybind;
      } else if (id === 'overlayToggle') {
        hotkeyUpdate.overlayHotkey = keybind;
      }

      if (Object.keys(hotkeyUpdate).length > 0) {
        console.log(`[KeybindsTab] Updating hotkeys in main process:`, hotkeyUpdate);
        const hotkeyResponse = await (window as any).electronAPI.invoke('hotkeys:update', hotkeyUpdate);
        console.log(`[KeybindsTab] Hotkey update response:`, hotkeyResponse);
      }

      console.log(`[KeybindsTab] ✅ Keybind saved successfully: ${id}`, keybind);
    } catch (error) {
      console.error(`[KeybindsTab] ❌ Failed to save keybind ${id}:`, error);
    }
  }

  /**
   * Create keybind capture modal
   */
  private createKeybindModal(label: string, requiresAlt: boolean, onKeybindSet: (keybind: Keybind) => void): void {
    const t = this.getKeybindsTranslations();
    const modifierKey = getModifierKeyName();
    
    // Create modal overlay
    const modalOverlay = this.createElement('div');
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    `;

    // Create modal content
    const modal = this.createElement('div');
    modal.style.cssText = `
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-lg);
      padding: var(--settings-spacing-xl);
      max-width: 400px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    `;

    const modalTitle = this.createElement('h3');
    modalTitle.style.cssText = `
      margin: 0 0 var(--settings-spacing-md) 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--settings-text-primary);
    `;
    const titleText = (t.changeTitle || 'Change {label}').replace('{label}', label);
    modalTitle.textContent = titleText;
    modal.appendChild(modalTitle);

    const modalDesc = this.createElement('p');
    modalDesc.style.cssText = `
      margin: 0 0 var(--settings-spacing-lg) 0;
      font-size: 0.875rem;
      color: var(--settings-text-secondary);
      line-height: 1.5;
    `;
    if (requiresAlt) {
      const descText = (t.changeDescAlt || 'Press any key to set as {modifier} + [your key]. {modifier} will be added automatically. Press ESC to cancel.')
        .replace(/{modifier}/g, modifierKey);
      modalDesc.innerHTML = descText;
    } else {
      modalDesc.innerHTML = t.changeDescNoAlt || 'Press any key (function keys recommended). No modifiers needed. Press ESC to cancel.';
    }
    modal.appendChild(modalDesc);

    const keybindPreview = this.createElement('div');
    keybindPreview.style.cssText = `
      padding: var(--settings-spacing-lg);
      background: var(--settings-background);
      border: 2px solid rgba(59, 130, 246, 0.5);
      border-radius: var(--settings-radius-md);
      text-align: center;
      font-size: 1.25rem;
      font-family: 'Courier New', monospace;
      color: var(--settings-text-primary);
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    keybindPreview.textContent = t.waitingForInput || 'Waiting for input...';
    modal.appendChild(keybindPreview);

    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);

    // Capture keybind
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC to cancel
      if (e.key === 'Escape') {
        cleanup();
        return;
      }

      // Ignore modifier-only keys
      if (['Alt', 'Control', 'Shift', 'Meta', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'].includes(e.key)) {
        return;
      }

      // Normalize key format: convert 'KeyB' to 'B', 'Space' stays 'Space', 'F11' stays 'F11'
      let normalizedKey = e.code || e.key;
      if (normalizedKey.startsWith('Key') && normalizedKey.length === 4) {
        // KeyA-KeyZ -> A-Z
        normalizedKey = normalizedKey.substring(3).toUpperCase();
      } else if (normalizedKey.startsWith('Digit')) {
        // Digit0-Digit9 -> 0-9
        normalizedKey = normalizedKey.substring(5);
      } else if (normalizedKey === 'Space') {
        normalizedKey = 'Space';
      }
      // For function keys (F1-F12) and other keys, keep as is

      const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
      };

      const newKeybind: Keybind = {
        ctrl: false,
        alt: requiresAlt,
        shift: false,
        key: normalizedKey
      };

      // ENFORCE: Space bar MUST have Ctrl for PTT (check if this is PTT by checking if requiresAlt is false)
      // If it's PTT (requiresAlt=false) and key is Space, force Ctrl
      if (!requiresAlt && normalizedKey === 'Space') {
        newKeybind.ctrl = true;
        newKeybind.alt = false;
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
      }
      
      // ENFORCE: Non-function keys (except Space) MUST have Alt for PTT - hardcode it
      if (!requiresAlt && normalizedKey !== 'Space' && !isFunctionKey(normalizedKey)) {
        newKeybind.alt = true;
        newKeybind.ctrl = false;
        console.log(`🚫 ${normalizedKey} requires Alt for PTT - enforcing Alt+${normalizedKey}`);
      }

      // Update preview
      keybindPreview.innerHTML = `<kbd>${this.formatKeybindDisplay(newKeybind)}</kbd>`;

      // Set keybind after short delay
      setTimeout(() => {
        onKeybindSet(newKeybind);
        cleanup();
      }, 300);
    };

    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (modalOverlay.parentNode) {
        modalOverlay.style.opacity = '0';
        setTimeout(() => {
          if (modalOverlay.parentNode) {
            document.body.removeChild(modalOverlay);
          }
        }, 200);
      }
    };

    // Add fade in animation
    modalOverlay.style.opacity = '0';
    requestAnimationFrame(() => {
      modalOverlay.style.transition = 'opacity 0.2s ease';
      modalOverlay.style.opacity = '1';
    });

    // Listen for keydown
    document.addEventListener('keydown', handleKeyDown, true);
  }

  /**
   * Save keybinds
   */
  public async onSave(): Promise<boolean> {
    try {
      const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
      };

      // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it before saving
      if (this.keybinds.ptt.key === 'Space' && !this.keybinds.ptt.ctrl) {
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
        this.keybinds.ptt.ctrl = true;
        this.keybinds.ptt.alt = false;
        this.keybinds.ptt.shift = false;
      }
      
      // ENFORCE: Non-function keys (except Space) MUST have Alt for PTT - hardcode it before saving
      if (this.keybinds.ptt.key !== 'Space' && !isFunctionKey(this.keybinds.ptt.key) && !this.keybinds.ptt.alt) {
        console.log(`🚫 ${this.keybinds.ptt.key} requires Alt for PTT - enforcing Alt+${this.keybinds.ptt.key}`);
        this.keybinds.ptt.alt = true;
        this.keybinds.ptt.ctrl = false;
        this.keybinds.ptt.shift = false;
      }

      // Save to config
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          uiSettings: {
            pttHotkey: this.keybinds.ptt,
            bidirectionalHotkey: this.keybinds.bidirectional,
            screenTranslationHotkey: this.keybinds.screenTranslation,
            screenTranslationBoxHotkey: this.keybinds.screenTranslationBox,
            overlaySettings: {
              toggleHotkey: this.keybinds.overlayToggle
            }
          }
        }
      });

      // Update active hotkeys in main process
      await (window as any).electronAPI.invoke('hotkeys:update', {
        pttHotkey: this.keybinds.ptt,
        bidirectionalHotkey: this.keybinds.bidirectional,
        screenTranslationHotkey: this.keybinds.screenTranslation,
        screenTranslationBoxHotkey: this.keybinds.screenTranslationBox
      });

      return true;
    } catch (error) {
      console.error('Failed to save keybinds:', error);
      return false;
    }
  }

  /**
   * Validate keybinds
   */
  public validate(): boolean {
    // All keybinds are valid by default
    // Could add conflict detection here in the future
    return true;
  }
}
