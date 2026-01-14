/**
 * Modal handlers for changing keybinds on the Whispra Translate page
 */

interface Keybind {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

/**
 * Format keybind for display
 */
function formatKeybindDisplay(keybind: Keybind): string {
  const parts: string[] = [];

  if (keybind.ctrl) parts.push('Ctrl');
  if (keybind.alt) parts.push('Alt');
  if (keybind.shift) parts.push('Shift');

  let key = keybind.key;
  if (key === 'Space') {
    key = 'SPACE';
  } else if (key.startsWith('Key') && key.length === 4) {
    key = key.substring(3).toUpperCase();
  } else if (key.startsWith('Digit')) {
    key = key.substring(5);
  } else if (key.startsWith('Numpad')) {
    key = 'Numpad ' + key.substring(6);
  } else if (/^[a-z]$/i.test(key)) {
    key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join(' + ');
}

/**
 * Update keybind displays for PTT
 */
function updatePTTKeybindDisplays(keybind: Keybind): void {
  const displayText = formatKeybindDisplay(keybind);

  // Update translate page display
  const whispraKeybind = document.getElementById('whispra-translate-ptt-keybind');
  if (whispraKeybind) {
    whispraKeybind.textContent = displayText;
  }

  // Update settings page display
  const settingsKeybind = document.getElementById('translation-keybind-display');
  if (settingsKeybind) {
    settingsKeybind.innerHTML = `<kbd>${displayText}</kbd>`;
  }
}

/**
 * Update keybind displays for Bidirectional
 */
function updateBidirectionalKeybindDisplays(keybind: Keybind): void {
  const displayText = formatKeybindDisplay(keybind);

  // Update translate page display
  const whispraKeybind = document.getElementById('whispra-translate-bidi-keybind');
  if (whispraKeybind) {
    whispraKeybind.textContent = displayText;
  }

  // Update settings page display
  const settingsKeybind = document.getElementById('bidirectional-keybind-display');
  if (settingsKeybind) {
    settingsKeybind.innerHTML = `<kbd>${displayText}</kbd>`;
  }
}

/**
 * Show modal for changing PTT keybind
 */
export function showPTTKeybindModal(): void {
  createKeybindModal('Push-to-Talk', false, async (newKeybind: Keybind) => {
    console.log('[TranslateKeybindModal] PTT keybind changed to:', newKeybind);

    const isFunctionKey = (key: string): boolean => {
      return /^F\d{1,2}$/.test(key);
    };

    // ENFORCE: Space bar MUST have Ctrl for PTT
    if (newKeybind.key === 'Space') {
      newKeybind.ctrl = true;
      newKeybind.alt = false;
      newKeybind.shift = false;
      console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
    }
    // ENFORCE: Non-function keys (except Space) MUST have Alt for PTT
    else if (!isFunctionKey(newKeybind.key)) {
      newKeybind.alt = true;
      newKeybind.ctrl = false;
      newKeybind.shift = false;
      console.log(`🚫 ${newKeybind.key} requires Alt for PTT - enforcing Alt+${newKeybind.key}`);
    }

    // Update displays
    updatePTTKeybindDisplays(newKeybind);

    // Save to config
    try {
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { uiSettings: { pttHotkey: newKeybind } }
      });

      // Update active hotkeys in main process
      await (window as any).electronAPI.invoke('hotkeys:update', {
        pttHotkey: newKeybind
      });

      console.log('[TranslateKeybindModal] ✅ PTT keybind saved successfully');
    } catch (error) {
      console.error('[TranslateKeybindModal] ❌ Failed to save PTT keybind:', error);
    }
  });
}

/**
 * Show modal for changing Bidirectional keybind
 */
export function showBidirectionalKeybindModal(): void {
  // Check if on Mac - bidirectional not available
  const isMac = (window as any).electronAPI?.platform === 'darwin';
  if (isMac) {
    console.log('🍎 Bidirectional keybind modal not available on macOS');
    return;
  }

  createKeybindModal('Bidirectional Mode', true, async (newKeybind: Keybind) => {
    console.log('[TranslateKeybindModal] Bidirectional keybind changed to:', newKeybind);

    // Bidirectional always requires Alt
    newKeybind.alt = true;
    console.log('🚫 Bidirectional mode requires Alt - enforcing Alt modifier');

    // Update displays
    updateBidirectionalKeybindDisplays(newKeybind);

    // Save to config
    try {
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { uiSettings: { bidirectionalHotkey: newKeybind } }
      });

      // Update active hotkeys in main process
      await (window as any).electronAPI.invoke('hotkeys:update', {
        bidirectionalHotkey: newKeybind
      });

      console.log('[TranslateKeybindModal] ✅ Bidirectional keybind saved successfully');
    } catch (error) {
      console.error('[TranslateKeybindModal] ❌ Failed to save Bidirectional keybind:', error);
    }
  });
}

/**
 * Create keybind capture modal
 */
function createKeybindModal(label: string, requiresAlt: boolean, onKeybindSet: (keybind: Keybind) => void): void {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
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
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1e1e2e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
  `;

  const modalTitle = document.createElement('h3');
  modalTitle.style.cssText = `
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
  `;
  modalTitle.textContent = `Change ${label}`;
  modal.appendChild(modalTitle);

  const modalDesc = document.createElement('p');
  modalDesc.style.cssText = `
    margin: 0 0 1.5rem 0;
    font-size: 0.875rem;
    color: #a0a0a0;
    line-height: 1.5;
  `;
  if (requiresAlt) {
    modalDesc.innerHTML = 'Press any key to set as <strong>Alt + [your key]</strong>. Alt will be added automatically. Press ESC to cancel.';
  } else {
    modalDesc.innerHTML = 'Press any key (function keys recommended). <strong>No modifiers needed.</strong> Press ESC to cancel.';
  }
  modal.appendChild(modalDesc);

  const keybindPreview = document.createElement('div');
  keybindPreview.style.cssText = `
    padding: 1.5rem;
    background: #2a2a3e;
    border: 2px solid rgba(59, 130, 246, 0.5);
    border-radius: 8px;
    text-align: center;
    font-size: 1.25rem;
    font-family: 'Courier New', monospace;
    color: #ffffff;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  keybindPreview.textContent = 'Waiting for input...';
  modal.appendChild(keybindPreview);

  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);

  // Cleanup function
  const cleanup = () => {
    document.body.removeChild(modalOverlay);
    document.removeEventListener('keydown', handleKeyDown);
  };

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

    // Normalize key format
    let normalizedKey = e.code || e.key;
    if (normalizedKey.startsWith('Key') && normalizedKey.length === 4) {
      normalizedKey = normalizedKey.substring(3).toUpperCase();
    } else if (normalizedKey.startsWith('Digit')) {
      normalizedKey = normalizedKey.substring(5);
    } else if (normalizedKey === 'Space') {
      normalizedKey = 'Space';
    }

    // Build keybind object
    const keybind: Keybind = {
      ctrl: requiresAlt ? false : e.ctrlKey,
      alt: requiresAlt ? true : e.altKey,
      shift: e.shiftKey,
      key: normalizedKey
    };

    // Show preview
    keybindPreview.textContent = formatKeybindDisplay(keybind);

    // Set the keybind after a brief delay to show the preview
    setTimeout(() => {
      cleanup();
      onKeybindSet(keybind);
    }, 300);
  };

  document.addEventListener('keydown', handleKeyDown);

  // Click outside to cancel
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      cleanup();
    }
  });
}
