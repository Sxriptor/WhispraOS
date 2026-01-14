/**
 * Shows modal for changing the push-to-talk keybind
 */
export function showKeybindModal(
    currentKeybind: string,
    currentKeybindSpan: HTMLElement | null,
    translationKeybindDisplay: HTMLElement | null,
    recordingText: HTMLElement,
    logToDebug: (message: string) => void,
    updatePTTKeybindDisplay: (code: string, keybindSpan: HTMLElement | null, keybindDisplay: HTMLElement | null) => void,
    setCurrentKeybind: (value: string) => void
): void {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        width: 400px;
        max-width: 90%;
        text-align: center;
        color: black;
    `;

    modalContent.innerHTML = `
        <h2>Change Push-to-Talk Key</h2>
        <p>Press any key to set it as your push-to-talk key</p>
        <div style="margin: 2rem 0;">
            <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px; font-size: 1.2rem;">
                Current: <kbd style="background: #667eea; color: white; padding: 0.5rem; border-radius: 4px;">${currentKeybind}</kbd>
            </div>
        </div>
        <button id="cancel-keybind" style="padding: 0.5rem 1rem; margin-right: 1rem;">Cancel</button>
        <button id="reset-keybind" style="padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 4px;">Reset to Ctrl+Space</button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    let keyPressed = false;

    const keyListener = (event: KeyboardEvent) => {
        if (!keyPressed) {
            keyPressed = true;
            // Normalize to config-friendly key name used by global listener
            const code = event.code;
            let hotkeyKey = '';
            if (code === 'Space') {
                hotkeyKey = 'Space';
            } else if (code.startsWith('Key') && code.length === 4) {
                hotkeyKey = code.slice(3).toUpperCase();
            } else {
                hotkeyKey = code; // fallback
            }
            setCurrentKeybind(code);
            updatePTTKeybindDisplay(code, currentKeybindSpan, translationKeybindDisplay);
            recordingText.textContent = 'Audio being held quiet';
            logToDebug(`🔧 Push-to-talk key changed to: ${code}`);

            // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
            let hotkey = { ctrl: false, alt: false, shift: false, key: hotkeyKey.toUpperCase() };
            const isFunctionKey = (key: string): boolean => {
                return /^F\d{1,2}$/.test(key);
            };
            
            if (hotkeyKey === 'Space' || hotkeyKey.toUpperCase() === 'SPACE') {
                hotkey.ctrl = true;
                hotkey.alt = false;
                hotkey.shift = false;
                console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
            } else if (!isFunctionKey(hotkeyKey)) {
                // Non-function keys (except Space) MUST have Alt
                hotkey.alt = true;
                hotkey.ctrl = false;
                hotkey.shift = false;
                console.log(`🚫 ${hotkeyKey} requires Alt for PTT - enforcing Alt+${hotkeyKey}`);
            }

            // Persist to config AND push to main so global listener updates immediately
            try {
                (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { uiSettings: { pttHotkey: hotkey } }
                });
                (window as any).electronAPI.invoke('hotkeys:update', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { pttHotkey: hotkey }
                });
            } catch { }
            document.body.removeChild(modal);
            document.removeEventListener('keydown', keyListener);
        }
    };

    document.addEventListener('keydown', keyListener);

    modalContent.querySelector('#cancel-keybind')?.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', keyListener);
    });

    modalContent.querySelector('#reset-keybind')?.addEventListener('click', () => {
        setCurrentKeybind('Space');
        if (currentKeybindSpan) currentKeybindSpan.textContent = 'SPACE';
        recordingText.textContent = 'Audio being held quiet';
        logToDebug('🔧 Push-to-talk key reset to Ctrl+Space');
        
        // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
        const hotkey = { ctrl: true, alt: false, shift: false, key: 'Space' };
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
        
        try {
            (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { uiSettings: { pttHotkey: hotkey } }
            });
            (window as any).electronAPI.invoke('hotkeys:update', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { pttHotkey: hotkey }
            });
        } catch { }
        document.body.removeChild(modal);
        document.removeEventListener('keydown', keyListener);
    });
}
