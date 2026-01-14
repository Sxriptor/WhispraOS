import { ipcMain, BrowserWindow } from 'electron';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { OverlayStateManager } from '../../services/OverlayStateManager';
import { getSoundboardService } from '../../soundboard/soundboard-ipc';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GlobalKeyboardListener } = require('node-global-key-listener');

/**
 * Non-blocking subscription check - allows action to proceed but cancels if check fails
 * Returns true if subscription is valid, false if expired (will trigger sign-out)
 */
async function checkSubscriptionNonBlocking(): Promise<boolean> {
  try {
    const { SupabaseService } = await import('../../services/SupabaseService');
    const supabaseService = SupabaseService.getInstance();
    
    // Quick check without waiting - this will sign out if expired
    const accessStatus = await supabaseService.checkUserAccess();
    
    if (!accessStatus.hasAccess) {
      console.log('🚫 [Keybind] Subscription check failed - access denied');
      // The checkSubscriptionAndHandle will be called by periodic check, but we can also trigger it
      supabaseService.forceSubscriptionCheck().catch(() => {});
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ [Keybind] Subscription check error:', error);
    // On error, allow action to proceed (fail open)
    return true;
  }
}

// Utility functions for sending messages to all windows
const sendAll = (channel: string) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel);
  }
};

const sendAllData = (channel: string, data: any) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
};

const getOverlayStateManager = () => OverlayStateManager.getInstance();

export function registerHotkeyHandlers(): void {
  // Global hotkeys via node-global-key-listener (supports keydown + keyup)
  try {
    let pttActive = false;
    let overlayHoldTimer: NodeJS.Timeout | null = null;

    // Track modifier keys separately for global listener
    let altPressed = false;
    let ctrlPressed = false;
    let shiftPressed = false;
    const configManager = ConfigurationManager.getInstance();
    // Default to Ctrl+Space for Windows, Space for other platforms
    const isWindows = process.platform === 'win32';
    const defaultPTTHotkey = isWindows 
        ? { ctrl: true, alt: false, shift: false, key: 'Space' }
        : { ctrl: false, alt: false, shift: false, key: 'Space' };
    let pttHotkey = configManager.getConfig().uiSettings?.pttHotkey || defaultPTTHotkey;
    
    // Migrate existing configs: if no modifiers, update based on key
    const hasNoModifiers = !pttHotkey.ctrl && !pttHotkey.alt && !pttHotkey.shift;
    const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
    };
    
    if (hasNoModifiers) {
        let needsUpdate = false;
        if (pttHotkey.key === 'Space') {
            // Space bar without modifiers -> Ctrl+Space
            pttHotkey = { ctrl: true, alt: false, shift: false, key: 'Space' };
            needsUpdate = true;
            console.log('🔄 Migrating PTT hotkey: Space -> Ctrl+Space');
        } else if (pttHotkey.key && pttHotkey.key !== 'Space' && !isFunctionKey(pttHotkey.key)) {
            // Any other non-function key without modifiers -> add Alt
            pttHotkey = { ctrl: false, alt: true, shift: false, key: pttHotkey.key };
            needsUpdate = true;
            console.log(`🔄 Migrating PTT hotkey: ${pttHotkey.key} -> Alt+${pttHotkey.key}`);
        }
        // Function keys (F1-F12) can stay without modifiers - no migration needed
        
        if (needsUpdate) {
            try {
                const currentConfig = configManager.getConfig();
                if (currentConfig.uiSettings) {
                    currentConfig.uiSettings.pttHotkey = pttHotkey;
                    configManager.updateConfig(currentConfig);
                    console.log('✅ PTT hotkey migrated successfully');
                }
            } catch (error) {
                console.warn('Failed to migrate PTT hotkey config:', error);
            }
        }
    }
    
    // If no PTT hotkey is saved, save the default
    if (!configManager.getConfig().uiSettings?.pttHotkey) {
        try {
            const currentConfig = configManager.getConfig();
            if (currentConfig.uiSettings) {
                currentConfig.uiSettings.pttHotkey = defaultPTTHotkey;
                configManager.updateConfig(currentConfig);
            }
        } catch (error) {
            console.warn('Failed to save default PTT hotkey config:', error);
        }
    }
    let bidiHotkey = configManager.getConfig().uiSettings?.bidirectionalHotkey || { ctrl: false, alt: true, shift: false, key: 'B' };
    let screenTranslationHotkey = configManager.getConfig().uiSettings?.screenTranslationHotkey || { ctrl: false, alt: true, shift: false, key: 'T' };
    let screenTranslationBoxHotkey = configManager.getConfig().uiSettings?.screenTranslationBoxHotkey || { ctrl: false, alt: true, shift: false, key: 'Y' };
    let screenTranslationWatchBoxHotkey = configManager.getConfig().uiSettings?.screenTranslationWatchBoxHotkey || { ctrl: false, alt: true, shift: false, key: 'W' };

    // On macOS, use "-" key instead of F11 to avoid conflict with volume controls
    const isMacOS = process.platform === 'darwin';
    const defaultOverlayHotkey = isMacOS 
      ? { ctrl: false, alt: false, shift: false, key: '-' }  // "-" key on macOS
      : { ctrl: false, alt: false, shift: false, key: 'F11' }; // F11 on Windows/Linux
    let overlayHotkey = configManager.getConfig().uiSettings?.overlaySettings?.toggleHotkey || defaultOverlayHotkey;

    // Force bidirectional hotkey to have alt: true and save if needed
    if (bidiHotkey && !bidiHotkey.alt) {
        bidiHotkey.alt = true;
        try {
            const currentConfig = configManager.getConfig();
            if (currentConfig.uiSettings) {
                currentConfig.uiSettings.bidirectionalHotkey = bidiHotkey;
                configManager.updateConfig(currentConfig);
            }
        } catch (error) {
            console.warn('Failed to update bidirectional hotkey config:', error);
        }
    }

      // Force screen translation hotkey to have alt: true and save if needed
      if (screenTranslationHotkey && !screenTranslationHotkey.alt) {
        screenTranslationHotkey.alt = true;
        try {
            const currentConfig = configManager.getConfig();
            if (currentConfig.uiSettings) {
                currentConfig.uiSettings.screenTranslationHotkey = screenTranslationHotkey;
                configManager.updateConfig(currentConfig);
            }
        } catch (error) {
            console.warn('Failed to update screen translation hotkey config:', error);
        }
    }

    // On macOS, force overlay hotkey to use "-" instead of F11 to avoid volume control conflict
    if (isMacOS && overlayHotkey && overlayHotkey.key === 'F11') {
        console.log('🔄 Migrating overlay hotkey to "-" on macOS (F11 conflicts with volume controls)');
        overlayHotkey.key = '-';
        overlayHotkey.alt = false;
        overlayHotkey.ctrl = false;
        overlayHotkey.shift = false;
        try {
            const currentConfig = configManager.getConfig();
            if (currentConfig.uiSettings?.overlaySettings) {
                currentConfig.uiSettings.overlaySettings.toggleHotkey = overlayHotkey;
                configManager.updateConfig(currentConfig);
            }
        } catch (error) {
            console.warn('Failed to update overlay hotkey config for macOS:', error);
        }
    }

    // Note: PTT hotkey does NOT require Alt - it's just the key

    // Note: Overlay hotkey uses F11 on Windows/Linux, "-" on macOS to avoid volume control conflict

    const getHotkeys = () => ({ ptt: pttHotkey, bidi: bidiHotkey, overlay: overlayHotkey, screenTranslation: screenTranslationHotkey, screenTranslationBox: screenTranslationBoxHotkey, screenTranslationWatchBox: screenTranslationWatchBoxHotkey });

    // Debug: Log registered hotkeys at startup
    console.log('Registered hotkeys:', {
      ptt: pttHotkey,
      bidi: bidiHotkey,
      overlay: overlayHotkey,
      screenTranslation: screenTranslationHotkey,
      screenTranslationBox: screenTranslationBoxHotkey,
      screenTranslationWatchBox: screenTranslationWatchBoxHotkey,
      platform: process.platform,
      note: isMacOS ? 'macOS: Overlay uses "-" key to avoid volume control conflict' : 'Windows/Linux: Overlay uses F11'
    });


    const matches = (e: any, hk: { ctrl: boolean; alt: boolean; shift: boolean; key: string }) => {
      // Normalize event
      const nameRaw: string = (e?.name || e?.key || e?.code || '').toString();
      const name: string = nameRaw.toUpperCase().replace(/^VK_/, '').replace(/\s+/g, ' ').trim();
      const ctrl = !!e?.ctrlKey;
      const alt = !!e?.altKey;
      const shift = !!e?.shiftKey;
      const raw: number | undefined = (e && (e.rawcode ?? e.rawKey ?? e.vkCode ?? e.keycode ?? e.keyCode ?? e.rawKeyCode)) as number | undefined;
      const wanted = (hk?.key || '').toString().toUpperCase();

      // Accept common synonyms and rawcode for reliability
      let keyOk = false;
      if (wanted === 'SPACE') {
        keyOk = name === 'SPACE' || name === 'SPACEBAR' || name === 'SPACE BAR' || raw === 32;
      } else if (hk?.key === '-') {
        // Minus/dash key - handle all variations (wanted is already uppercase, but '-' uppercase is still '-')
        keyOk = name === '-' || name === 'MINUS' || name === 'SUBTRACT' || e.name === '-' || e.key === '-';
      } else if (/^F\d{1,2}$/.test(wanted)) {
        keyOk = name === wanted; // Function keys
      } else if (/^[A-Z]$/.test(wanted) || /^KEY[A-Z]$/.test(wanted)) {
        // A-Z or KeyA-KeyZ format
        const letter = wanted.startsWith('KEY') ? wanted.substring(3) : wanted;
        const expectedRaw = letter.charCodeAt(0);
        // Some libs report lowercase or prefixed names
        keyOk = name === letter || name === letter.toLowerCase() || name === wanted || raw === expectedRaw;
      } else if (/^DIGIT\d$/.test(wanted) || /^\d$/.test(wanted)) {
        // Number row
        const digit = wanted.replace('DIGIT', '');
        keyOk = name === digit || name === `DIGIT${digit}` || raw === (48 + parseInt(digit, 10));
      } else if (/^NUMPAD\d$/.test(wanted)) {
        const d = wanted.replace('NUMPAD', '');
        keyOk = name === wanted || name === `NUMPAD ${d}`; // raw varies by layout
      } else {
        // Other tokens (ENTER, TAB, etc.)
        keyOk = name === wanted;
      }
      return keyOk && ctrl === !!hk.ctrl && alt === !!hk.alt && shift === !!hk.shift;
    };
    const formatSoundboardHotkey = (e: any): string | null => {
      try {
        const parts: string[] = [];
        if (e?.ctrlKey) parts.push('Ctrl');
        if (e?.altKey) parts.push('Alt');
        if (e?.shiftKey) parts.push('Shift');
        const nameRaw: string = (e?.name || e?.key || e?.code || '').toString();
        const name: string = nameRaw.toUpperCase().replace(/^VK_/, '').replace(/\s+/g, ' ').trim();

        let keyName = '';
        if (/^F\d{1,2}$/.test(name)) {
          keyName = name; // F-keys
        } else if (name.startsWith('NUMPAD')) {
          const d = name.replace('NUMPAD', '').trim();
          if (/^\d$/.test(d)) keyName = `Num ${d}`;
        } else if (/^DIGIT\d$/.test(name)) {
          keyName = name.replace('DIGIT', '');
        } else if (/^\d$/.test(name)) {
          keyName = name;
        } else if (/^[A-Z]$/.test(name)) {
          keyName = name;
        } else if (name === 'SPACE' || name === 'SPACEBAR' || name === 'SPACE BAR') {
          keyName = 'Space';
        } else if (name === 'ENTER' || name === 'RETURN') {
          keyName = 'Enter';
        } else if (name === 'TAB') {
          keyName = 'Tab';
        } else if (name === 'ESCAPE' || name === 'ESC') {
          keyName = 'Escape';
        } else {
          return null;
        }
        if (!keyName) return null;
        parts.push(keyName);
        return parts.join('+');
      } catch {
        return null;
      }
    };
    const gkl = new GlobalKeyboardListener();
    gkl.addListener((e: any) => {
      const { state } = e;
      const { ptt, bidi, overlay, screenTranslation } = getHotkeys();

      // Track modifier keys
      if (e.name === 'LEFT ALT' || e.name === 'RIGHT ALT' || e.name === 'ALT') {
        altPressed = state === 'DOWN';
        return; // Only track modifier, don't process further
      }
      if (e.name === 'LEFT CTRL' || e.name === 'RIGHT CTRL' || e.name === 'CTRL') {
        ctrlPressed = state === 'DOWN';
        return; // Only track modifier, don't process further
      }
      if (e.name === 'LEFT SHIFT' || e.name === 'RIGHT SHIFT' || e.name === 'SHIFT') {
        shiftPressed = state === 'DOWN';
        return; // Only track modifier, don't process further
      }

      // Early exit: Only process if key could match one of our configured hotkeys
      const nameUpper = (e.name || e.key || '').toString().toUpperCase();
      const { screenTranslationBox, screenTranslationWatchBox } = getHotkeys();

      // Check if key matches any of our main hotkeys
      const matchesMainHotkey =
        nameUpper === ptt.key.toUpperCase() ||
        nameUpper === `KEY${ptt.key.toUpperCase()}` ||
        nameUpper === bidi.key.toUpperCase() ||
        nameUpper === `KEY${bidi.key.toUpperCase()}` ||
        nameUpper === overlay.key.toUpperCase() ||
        (overlay.key && /^F\d{1,2}$/.test(overlay.key) && (nameUpper === overlay.key.toUpperCase() || e.name === overlay.key || e.name === overlay.key.toUpperCase())) ||
        (overlay.key === '-' && (nameUpper === '-' || nameUpper === 'MINUS' || nameUpper === 'SUBTRACT' || e.name === '-' || e.key === '-')) ||
        nameUpper === screenTranslation.key.toUpperCase() ||
        nameUpper === `KEY${screenTranslation.key.toUpperCase()}` ||
        nameUpper === screenTranslationBox.key.toUpperCase() ||
        nameUpper === `KEY${screenTranslationBox.key.toUpperCase()}` ||
        nameUpper === screenTranslationWatchBox.key.toUpperCase() ||
        nameUpper === `KEY${screenTranslationWatchBox.key.toUpperCase()}` ||
        // Handle Space key variations
        (ptt.key === 'Space' && (nameUpper === 'SPACE' || nameUpper === 'SPACEBAR' || nameUpper === 'SPACE BAR'));

      // Check if key matches soundboard custom keybinds
      let matchesSoundboardKey = false;
      try {
        const svc = getSoundboardService();
        if (svc) {
          const settings = svc.getSettings();
          if (settings.hotkeysEnabled) {
            const hk = formatSoundboardHotkey(e);
            if (hk) {
              const sounds = svc.getAllSounds();
              matchesSoundboardKey = sounds.some((s) => (s.hotkey || '').trim() === hk);
            }
          }
        }
      } catch {}

      if (!matchesMainHotkey && !matchesSoundboardKey) {
        return; // Not a key we care about, ignore it
      }

      // Custom check for PTT hotkey using tracked modifier keys (more reliable than matches function)
      // Helper: Check if key is a function key (F1-F12)
      const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
      };
      
      // PTT doesn't require modifiers by default - it's just the key
      let pttKeyMatch = false;

      if (ptt.key === 'Space') {
        // Handle Space key with all its variations
        pttKeyMatch = nameUpper === 'SPACE' || nameUpper === 'SPACEBAR' || nameUpper === 'SPACE BAR';
        
        // ENFORCE FIRST: If Space is the PTT key, it MUST have Ctrl - reject immediately if Space pressed without Ctrl
        if (pttKeyMatch && !(e.ctrlKey || ctrlPressed)) {
          // Space bar pressed without Ctrl - REJECT IT IMMEDIATELY
          console.log('🚫 BLOCKED: Space bar pressed without Ctrl - PTT requires Ctrl+Space');
          return;
        }
      } else if (/^[A-Z]$/.test(ptt.key)) {
        // Single letter keys (A-Z)
        pttKeyMatch = nameUpper === ptt.key || nameUpper === ptt.key.toLowerCase() ||
                      e.name === `KEY${ptt.key}` || e.name === `KEY ${ptt.key}` || e.key === ptt.key;
        
        // ENFORCE: Non-function keys MUST have Alt - reject immediately if letter key pressed without Alt
        if (pttKeyMatch && !isFunctionKey(ptt.key) && !(e.altKey || altPressed)) {
          console.log(`🚫 BLOCKED: ${ptt.key} pressed without Alt - PTT requires Alt+${ptt.key} (function keys can be used alone)`);
          return;
        }
      } else {
        // Other keys (function keys, numbers, etc.)
        pttKeyMatch = nameUpper === ptt.key.toUpperCase() || e.name === ptt.key || e.key === ptt.key;
        
        // ENFORCE: Non-function keys MUST have Alt - reject immediately if non-function key pressed without Alt
        if (pttKeyMatch && !isFunctionKey(ptt.key) && ptt.key !== 'Space' && !(e.altKey || altPressed)) {
          console.log(`🚫 BLOCKED: ${ptt.key} pressed without Alt - PTT requires Alt+${ptt.key} (function keys can be used alone)`);
          return;
        }
      }

      // Check modifiers: if ptt config has them, they must match; if not, they must be false
      // ENFORCE: Space bar ALWAYS requires Ctrl and NO other modifiers - override config if needed
      // ENFORCE: Non-function keys (except Space) ALWAYS require Alt - override config if needed
      let pttCtrlMatch: boolean;
      let pttAltMatch: boolean;
      let pttShiftMatch: boolean;
      
      if (ptt.key === 'Space') {
        // Space bar MUST have Ctrl and NO Alt/Shift - always enforce this (regardless of config)
        pttCtrlMatch = (e.ctrlKey || ctrlPressed);
        pttAltMatch = (!e.altKey && !altPressed); // Must NOT have Alt
        pttShiftMatch = (!e.shiftKey && !shiftPressed); // Must NOT have Shift
        
        // Double-check: if Space matched but Ctrl is missing, reject (should already be caught above)
        if (pttKeyMatch && !pttCtrlMatch) {
          console.log('🚫 BLOCKED: Space bar PTT requires Ctrl - rejecting');
          return;
        }
      } else if (isFunctionKey(ptt.key)) {
        // Function keys (F1-F12) can be used alone - use normal logic
        pttCtrlMatch = ptt.ctrl ? (e.ctrlKey || ctrlPressed) : (!e.ctrlKey && !ctrlPressed);
        pttAltMatch = ptt.alt ? (e.altKey || altPressed) : (!e.altKey && !altPressed);
        pttShiftMatch = ptt.shift ? (e.shiftKey || shiftPressed) : (!e.shiftKey && !shiftPressed);
      } else {
        // Non-function keys (letters, numbers, etc.) MUST have Alt - always enforce this (regardless of config)
        pttCtrlMatch = (!e.ctrlKey && !ctrlPressed); // Must NOT have Ctrl (unless Space)
        pttAltMatch = (e.altKey || altPressed); // MUST have Alt
        pttShiftMatch = (!e.shiftKey && !shiftPressed); // Must NOT have Shift
        
        // Double-check: if non-function key matched but Alt is missing, reject (should already be caught above)
        if (pttKeyMatch && !pttAltMatch) {
          console.log(`🚫 BLOCKED: ${ptt.key} PTT requires Alt - rejecting`);
          return;
        }
      }

      if (pttKeyMatch && pttAltMatch && pttCtrlMatch && pttShiftMatch) {
        if (state === 'DOWN' && !pttActive) {
          // Non-blocking subscription check - allow action to proceed
          checkSubscriptionNonBlocking().then((hasAccess) => {
            if (!hasAccess) {
              // If subscription check fails, stop the recording that was just started
              console.log('🚫 [Keybind] Stopping PTT due to subscription check failure');
              pttActive = false;
              sendAll('translation-stop');
              sendAll('hotkey:ptt-release');
            }
          }).catch(() => {
            // On error, allow action to continue
          });
          
          pttActive = true;
          sendAll('translation-start');
          sendAll('hotkey:ptt-press');
        } else if (state === 'UP' && pttActive) {
          pttActive = false;
          sendAll('translation-stop');
          sendAll('hotkey:ptt-release');
        }
      }

      // Custom check for bidirectional hotkey using tracked modifier keys
      const bidiKeyMatch = (e.name === bidi.key || e.name === `KEY${bidi.key}` || e.key === bidi.key);
      const bidiAltMatch = bidi.alt ? (e.altKey || altPressed) : (!e.altKey && !altPressed);
      const bidiCtrlMatch = bidi.ctrl ? (e.ctrlKey || ctrlPressed) : (!e.ctrlKey && !ctrlPressed);
      const bidiShiftMatch = bidi.shift ? (e.shiftKey || shiftPressed) : (!e.shiftKey && !shiftPressed);

      if (bidiKeyMatch && bidiAltMatch && bidiCtrlMatch && bidiShiftMatch && state === 'DOWN') {
        // Check if on Mac - bidirectional not available
        if (process.platform === 'darwin') {
          console.log('🍎 [Keybind] Bidirectional hotkey ignored on macOS');
          return;
        }

        // Non-blocking subscription check - allow action to proceed
        checkSubscriptionNonBlocking().then((hasAccess) => {
          if (!hasAccess) {
            // If subscription check fails, stop bidirectional that was just toggled
            console.log('🚫 [Keybind] Stopping bidirectional due to subscription check failure');
            sendAll('bidirectional-stop');
          }
        }).catch(() => {
          // On error, allow action to continue
        });
        
        sendAll('bidirectional-toggle');
        sendAll('hotkey:bidirectional-toggle');
        return; // Prevent fall-through to soundboard hotkeys
      }

 // Custom check for overlay hotkey using tracked modifier keys (more reliable than matches function)
      // Overlay hotkey uses function keys like F11 on Windows/Linux, "-" on macOS
      let overlayKeyMatch = false;
      if (/^F\d{1,2}$/.test(overlay.key)) {
        // Function keys (F1-F12) - handle all variations
        overlayKeyMatch = nameUpper === overlay.key.toUpperCase() ||
                         e.name === overlay.key ||
                         e.name === overlay.key.toUpperCase() ||
                         e.key === overlay.key ||
                         e.key === overlay.key.toUpperCase() ||
                         (e.name && e.name.toUpperCase().includes(overlay.key.toUpperCase()));
        
        // Debug logging for F11 detection
        if (overlay.key === 'F11') {
          console.log('🔍 F11 key detection check:', {
            nameUpper,
            eName: e.name,
            eKey: e.key,
            overlayKey: overlay.key,
            overlayKeyMatch,
            state
          });
        }
      } else if (overlay.key === '-') {
        // Minus/dash key - handle all variations
        overlayKeyMatch = nameUpper === '-' ||
                         nameUpper === 'MINUS' ||
                         nameUpper === 'SUBTRACT' ||
                         e.name === '-' ||
                         e.name === 'MINUS' ||
                         e.name === 'SUBTRACT' ||
                         e.key === '-' ||
                         (e.name && e.name.toUpperCase().includes('MINUS'));
        
        // Debug logging for "-" key detection
        console.log('🔍 "-" key detection check:', {
          nameUpper,
          eName: e.name,
          eKey: e.key,
          overlayKey: overlay.key,
          overlayKeyMatch,
          state
        });
      } else if (/^[A-Z]$/.test(overlay.key)) {
        // Single letter keys (A-Z) - handle all variations
        overlayKeyMatch = nameUpper === overlay.key ||
                         nameUpper === overlay.key.toLowerCase() ||
                         e.name === `KEY${overlay.key}` ||
                         e.name === `KEY ${overlay.key}` ||
                         e.key === overlay.key;
      } else {
        // Other keys
        overlayKeyMatch = nameUpper === overlay.key.toUpperCase() ||
                         e.name === overlay.key ||
                         e.key === overlay.key;
      }

      // Check modifiers: overlay doesn't require modifiers by default
      const overlayAltMatch = overlay.alt ? (e.altKey || altPressed) : (!e.altKey && !altPressed);
      const overlayCtrlMatch = overlay.ctrl ? (e.ctrlKey || ctrlPressed) : (!e.ctrlKey && !ctrlPressed);
      const overlayShiftMatch = overlay.shift ? (e.shiftKey || shiftPressed) : (!e.shiftKey && !shiftPressed);

      if (overlayKeyMatch && overlayAltMatch && overlayCtrlMatch && overlayShiftMatch) {
        if (overlay.key === 'F11' || overlay.key === '-') {
          console.log(`✅ Overlay hotkey matched (${overlay.key})!`, { state, overlayAltMatch, overlayCtrlMatch, overlayShiftMatch });
        }
        if (state === 'DOWN') {
          // Start hold timer for 2-second hold detection
          overlayHoldTimer = setTimeout(() => {
            // Handle overlay hold close directly
            getOverlayStateManager().handleHoldClose().catch(console.error);
            overlayHoldTimer = null;
          }, 2000);
          
          sendAll('overlay:key-down');
        } else if (state === 'UP') {
          // Clear hold timer and send toggle if it was a short press
          if (overlayHoldTimer) {
            clearTimeout(overlayHoldTimer);
            overlayHoldTimer = null;
            // Debounce overlay toggle to prevent immediate double-toggle
            (global as any).__overlayLastToggleAt = (global as any).__overlayLastToggleAt || 0;
            const now = Date.now();
            if (now - (global as any).__overlayLastToggleAt > 250) {
              (global as any).__overlayLastToggleAt = now;
              console.log(`🔄 Triggering overlay toggle via ${overlay.key}`);
              // Execute toggle immediately for faster response
              const overlayManager = getOverlayStateManager();
              overlayManager.handleToggle().catch((error) => {
                console.error('Error in overlay toggle:', error);
                // Reset debounce timer on error to allow retry
                (global as any).__overlayLastToggleAt = 0;
              });
            }
          }
          sendAll('overlay:key-up');
        }
      }

      // Custom check for screen translation box hotkey using tracked modifier keys
      const screenTranslationBoxKeyMatch = (e.name === screenTranslationBox.key || e.name === `KEY${screenTranslationBox.key}` || e.key === screenTranslationBox.key);
      const screenTranslationBoxAltMatch = screenTranslationBox.alt ? (e.altKey || altPressed) : (!e.altKey && !altPressed);
      const screenTranslationBoxCtrlMatch = screenTranslationBox.ctrl ? (e.ctrlKey || ctrlPressed) : (!e.ctrlKey && !ctrlPressed);
      const screenTranslationBoxShiftMatch = screenTranslationBox.shift ? (e.shiftKey || shiftPressed) : (!e.shiftKey && !shiftPressed);

      // Debug logging for box selection hotkey
      if (screenTranslationBoxKeyMatch) {
        console.log('Screen translation box key detected:', {
          key: e.name,
          expectedKey: screenTranslationBox.key,
          altMatch: screenTranslationBoxAltMatch,
          ctrlMatch: screenTranslationBoxCtrlMatch,
          shiftMatch: screenTranslationBoxShiftMatch,
          state,
          altPressed,
          e_altKey: e.altKey
        });
      }

      if (screenTranslationBoxKeyMatch && screenTranslationBoxAltMatch && screenTranslationBoxCtrlMatch && screenTranslationBoxShiftMatch && state === 'DOWN') {
        // Non-blocking subscription check - allow action to proceed
        checkSubscriptionNonBlocking().then((hasAccess) => {
          if (!hasAccess) {
            // If subscription check fails, cancel the box selection
            console.log('🚫 [Keybind] Canceling screen translation box select due to subscription check failure');
            // No specific stop action needed for box select, but we log it
          }
        }).catch(() => {
          // On error, allow action to continue
        });
        
        console.log('📦 Screen translation box select hotkey triggered!');
        sendAll('screen-translation-box-select');
        sendAll('hotkey:screen-translation-box-select');
        return; // Prevent fall-through to soundboard hotkeys
      }

      // Custom check for screen translation watch box hotkey
      const screenTranslationWatchBoxKeyMatch = (e.name === screenTranslationWatchBox.key || e.name === `KEY${screenTranslationWatchBox.key}` || e.key === screenTranslationWatchBox.key);
      const screenTranslationWatchBoxAltMatch = screenTranslationWatchBox.alt ? (e.altKey || altPressed) : (!e.altKey && !altPressed);
      const screenTranslationWatchBoxCtrlMatch = screenTranslationWatchBox.ctrl ? (e.ctrlKey || ctrlPressed) : (!e.ctrlKey && !ctrlPressed);
      const screenTranslationWatchBoxShiftMatch = screenTranslationWatchBox.shift ? (e.shiftKey || shiftPressed) : (!e.shiftKey && !shiftPressed);

      // Debug logging for watch box hotkey
      if (screenTranslationWatchBoxKeyMatch) {
        console.log('Screen translation watch box key detected:', {
          key: e.name,
          expectedKey: screenTranslationWatchBox.key,
          altMatch: screenTranslationWatchBoxAltMatch,
          ctrlMatch: screenTranslationWatchBoxCtrlMatch,
          shiftMatch: screenTranslationWatchBoxShiftMatch,
          state,
          altPressed,
          e_altKey: e.altKey
        });
      }

      if (screenTranslationWatchBoxKeyMatch && screenTranslationWatchBoxAltMatch && screenTranslationWatchBoxCtrlMatch && screenTranslationWatchBoxShiftMatch && state === 'DOWN') {
        // Non-blocking subscription check - allow action to proceed
        checkSubscriptionNonBlocking().then((hasAccess) => {
          if (!hasAccess) {
            console.log('🚫 [Keybind] Canceling screen translation watch box due to subscription check failure');
          }
        }).catch(() => {
          // On error, allow action to continue
        });
        
        console.log('👁️ Screen translation watch box hotkey triggered!');
        sendAll('screen-translation-watch-box-select');
        sendAll('hotkey:screen-translation-watch-box-select');
        return; // Prevent fall-through to soundboard hotkeys
      }

      // Fallback to matches function for backward compatibility
      if (matches(e, overlay)) {
        if (state === 'DOWN') {
          // Start hold timer for 2-second hold detection
          overlayHoldTimer = setTimeout(() => {
            // Handle overlay hold close directly
            getOverlayStateManager().handleHoldClose().catch(console.error);
            overlayHoldTimer = null;
          }, 2000);

          sendAll('overlay:key-down');
        } else if (state === 'UP') {
          // Clear hold timer and send toggle if it was a short press
          if (overlayHoldTimer) {
            clearTimeout(overlayHoldTimer);
            overlayHoldTimer = null;
            // Debounce overlay toggle to prevent immediate double-toggle
            (global as any).__overlayLastToggleAt = (global as any).__overlayLastToggleAt || 0;
            const now = Date.now();
            if (now - (global as any).__overlayLastToggleAt > 250) {
              (global as any).__overlayLastToggleAt = now;
              // Execute toggle immediately for faster response
              const overlayManager = getOverlayStateManager();
              overlayManager.handleToggle().catch((error) => {
                console.error('Error in overlay toggle:', error);
                // Reset debounce timer on error to allow retry
                (global as any).__overlayLastToggleAt = 0;
              });
            }
          }
          sendAll('overlay:key-up');
        }
        return; // Prevent fall-through to soundboard hotkeys
      }

      if (state === 'DOWN') {
        // Global soundboard hotkeys: only match configured per-sound custom hotkeys
        try {
          const svc = getSoundboardService();
          if (svc) {
            const settings = svc.getSettings();
            // Check if soundboard hotkeys are enabled
            if (!settings.hotkeysEnabled) return;

            const hk = formatSoundboardHotkey(e);
            if (hk) {
              const sounds = svc.getAllSounds();
              const found = sounds.find((s) => (s.hotkey || '').trim() === hk);
              if (found && typeof found.slot === 'number') {
                sendAllData('soundboard:global-hotkey', { slot: found.slot });
                return;
              }
            }
          }
        } catch {}
      }
    });

    // IPC to update in-memory hotkeys immediately (accept either raw object or IPCRequest with payload)
    try { ipcMain.removeHandler('hotkeys:update'); } catch {}
    ipcMain.handle('hotkeys:update', async (_event, request: any) => {
      const data = (request && (request.payload || request)) || {};
      if (data.pttHotkey) {
        const k = data.pttHotkey;
        const isFunctionKey = (key: string): boolean => {
          return /^F\d{1,2}$/.test(key);
        };
        
        // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
        if (k.key === 'Space' && !k.ctrl) {
          console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
          k.ctrl = true;
          k.alt = false;
          k.shift = false;
        }
        
        // ENFORCE: Non-function keys (except Space) MUST have Alt - hardcode it
        if (k.key !== 'Space' && !isFunctionKey(k.key) && !k.alt) {
          console.log(`🚫 ${k.key} requires Alt for PTT - enforcing Alt+${k.key}`);
          k.alt = true;
          k.ctrl = false;
          k.shift = false;
        }
        
        pttHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };
      }
      if (data.bidirectionalHotkey) {
        const k = data.bidirectionalHotkey;
        bidiHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };
      }
      if (data.overlayHotkey) {
        const k = data.overlayHotkey;
        overlayHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };
      }
      if (data.screenTranslationHotkey) {
        const k = data.screenTranslationHotkey;
        screenTranslationHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };

        // Broadcast the hotkey update to all renderer windows
        sendAllData('screen-translation-keybind-updated', {
          keybind: `Key${screenTranslationHotkey.key}`
        });
      }
      if (data.screenTranslationBoxHotkey) {
        const k = data.screenTranslationBoxHotkey;
        screenTranslationBoxHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };

        // Broadcast the hotkey update to all renderer windows
        sendAllData('screen-translation-box-keybind-updated', {
          keybind: `Key${screenTranslationBoxHotkey.key}`
        });
      }
      if (data.screenTranslationWatchBoxHotkey) {
        const k = data.screenTranslationWatchBoxHotkey;
        screenTranslationWatchBoxHotkey = {
          ctrl: !!k.ctrl,
          alt: !!k.alt,
          shift: !!k.shift,
          key: (k.key || '').toString()
        };

        // Broadcast the hotkey update to all renderer windows
        sendAllData('screen-translation-watch-box-keybind-updated', {
          keybind: `Key${screenTranslationWatchBoxHotkey.key}`
        });
      }
      return { ok: true };
    });
  } catch {}
}
