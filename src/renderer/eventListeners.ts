// Event Listeners Module
// This module contains all event listener initialization for the renderer process

import { getTranslations } from './i18n.js';
import {
    getTranslatedButtonText,
    getTranslatedBidirectionalButtonText,
    updatePTTKeybindDisplay,
    updateBidirectionalKeybindDisplay,
    updateScreenTranslationKeybindDisplay,
    updateLabelText
} from './translationHelpers.js';
import {
    manualCheckForUpdates,
    manualDownloadUpdate,
    manualInstallUpdate,
    openReleaseNotes,
    openUpdateSettings
} from './updateNotification.js';
import {
    toggleBidirectional
} from './bidirectional/BidirectionalControls.js';
import {
    updateUILanguage
} from './bidirectional/BidirectionalUI.js';
import {
    handleScreenTranslationKeyDown,
    showScreenTranslationKeybindModal,
    updateScreenTranslationConfig,
    triggerScreenTranslation
} from './screentrans/PaddleTriggerConfig.js';
import { openSettings } from '../ui/settings/SettingsIntegration.js';

/**
 * Initialize all event listeners for the application
 * This function must be called after all DOM elements are loaded and all dependencies are available
 *
 * @param dependencies - Object containing all required DOM elements and functions from renderer.ts
 */
export function initializeEventListeners(dependencies: any): void {
    const {
        // DOM elements
        startButton,
        refreshVoicesButton,
        outputToggleButton,
        debugToggle,
        affiliateButton,
        feedbackButton,
        sidebarToggleButton,
        appSidebar,
        sidebarSettingsButton,
        sidebarTranslateButton,
        sidebarBidirectionalButton,
        soundBoardButton,
        voiceFilterButton,
        quickTranslateButton,
        whispraTranslateButton,
        microphoneSelect,
        languageSelect,
        voiceSelect,
        accentPreset,
        accentToggle,
        customAccentText,
        changeKeybindBtn,
        whispraTranslatePTTKeybindContainer,
        whispraTranslateBidiKeybindContainer,
        bidirectionalToggleButton,
        bidirectionalChangeKeybindBtn,
        bidirectionalOutputSelect,
        incomingVoiceSelect,
        bidirectionalProcessSelect,
        bidirectionalRefreshProcessesBtn,
        bidirectionalSourceLanguageSelect,
        bidirectionalTargetLanguageSelect,
        bidirectionalCaptionsToggle,
        bidirectionalCaptionsSettings,
        screenTranslationButton,
        screenTranslationTriggerButton,
        screenTranslationChangeKeybindBtn,
        screenTranslationTargetLang,
        screenTranslationSourceLang,
        screenTranslationDisplaySelect,
        bidirectionalPanel,
        bidirectionalStatusText,
        bidirectionalDetectedText,
        currentKeybindSpan,
        translationKeybindDisplay,
        bidirectionalKeybindSpan,
        bidirectionalKeybindDisplay,
        screenTranslationKeybindSpan,
        screenTranslationKeybindDisplay,

        // Functions
        toggleTranslation,
        logToDebug,
        loadVoices,
        toggleOutputTarget,
        toggleDebugConsole,
        toggleSidebar,
        switchTab,
        onMicrophoneChange,
        onLanguageChange,
        onVoiceChange,
        onAccentPresetChange,
        onAccentToggleClick,
        onCustomAccentInput,
        onCustomAccentKeydown,
        onCustomAccentBlur,
        showKeybindModal,
        handleKeyDown,
        handleKeyUp,
        showBidirectionalKeybindModal,
        showWhispraPTTKeybindModal,
        showWhispraBidirectionalKeybindModal,
        onBidirectionalOutputChange,
        onIncomingVoiceChange,
        onBidirectionalProcessChange,
        loadBidirectionalProcesses,
        onBidirectionalSourceLanguageChange,
        onBidirectionalTargetLanguageChange,
        toggleBidirectionalCaptions,
        showCaptionsSettingsModal,
        startRecording,
        stopRecording,
        isTranslating,
        setBidirectionalStatus,
        isBidirectionalActive,
        bidirectionalKeybind,
        screenTranslationKeybind,

        // Global variables (to be modified)
        languageToggle,
        currentLanguage
    } = dependencies;

    // Start/Stop button
    startButton.addEventListener('click', toggleTranslation);

    // Refresh voices button
    refreshVoicesButton.addEventListener('click', async () => {
        logToDebug('Refreshing voice list...');
        await loadVoices();
        logToDebug('Voice list refreshed');
    });

    // ElevenLabs link - open in default browser
    const elevenlabsLink = document.getElementById('elevenlabs-link');
    if (elevenlabsLink) {
        elevenlabsLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await (window as any).electronAPI.invoke('open-external', 'https://elevenlabs.io/app/voice-library');
            } catch (error) {
                console.error('Error opening ElevenLabs link:', error);
            }
        });
    }

    // Output toggle button
    outputToggleButton.addEventListener('click', toggleOutputTarget);

    // Debug toggle
    if (debugToggle) {
        debugToggle.addEventListener('click', toggleDebugConsole);
    }

    // Affiliate button
    if (affiliateButton) {
        affiliateButton.addEventListener('click', () => {
            const url = 'https://account.whispra.xyz/affiliate';
            try {
                // Prefer Electron external open if available
                // @ts-ignore - exposed via preload
                if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                    // @ts-ignore
                    window.electronAPI.openExternal(url);
                } else {
                    window.open(url, '_blank');
                }
            } catch (_e) {
                window.location.href = url;
            }
        });
    }

    // Feedback button
    if (feedbackButton) {
        feedbackButton.addEventListener('click', () => {
            const url = 'https://account.whispra.xyz/report';
            try {
                // Prefer Electron external open if available
                // @ts-ignore - exposed via preload
                if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                    // @ts-ignore
                    window.electronAPI.openExternal(url);
                } else {
                    window.open(url, '_blank');
                }
            } catch (_e) {
                window.location.href = url;
            }
        });
    }

    // Sidebar controls
    if (sidebarToggleButton && appSidebar) {
        sidebarToggleButton.addEventListener('click', toggleSidebar);
    }
    if (sidebarSettingsButton) {
        sidebarSettingsButton.addEventListener('click', openSettings);
    }
    if (sidebarTranslateButton) {
        sidebarTranslateButton.addEventListener('click', () => switchTab('translate'));
    }
    if (sidebarBidirectionalButton) {
        sidebarBidirectionalButton.addEventListener('click', () => switchTab('bidirectional'));
    }
    // Update tab removed
    if (soundBoardButton) {
        soundBoardButton.addEventListener('click', () => switchTab('sound-board'));
    }
    if (voiceFilterButton) {
        voiceFilterButton.addEventListener('click', () => switchTab('voice-filter'));
    }
    if (quickTranslateButton) {
        quickTranslateButton.addEventListener('click', () => switchTab('quick-translate'));
    }
    if (whispraTranslateButton) {
        whispraTranslateButton.addEventListener('click', () => switchTab('whispra-translate'));
    }

    // Whispra Screen button
    const whispraScreenButton = document.getElementById('sidebar-whispra-screen-button') as HTMLButtonElement | null;
    if (whispraScreenButton) {
        whispraScreenButton.addEventListener('click', () => {
            // Check if on Mac - screen translate not available
            const isMac = (window as any).electronAPI?.platform === 'darwin';
            if (isMac) {
                console.log('🍎 Screen translate is not available on macOS');
                return;
            }
            switchTab('whispra-screen');
        });
    }

    // Device selection
    microphoneSelect.addEventListener('change', onMicrophoneChange);

    // Language selection
    languageSelect.addEventListener('change', onLanguageChange);

    // Voice selection
    voiceSelect.addEventListener('change', onVoiceChange);

    // Accent controls
    accentPreset.addEventListener('change', onAccentPresetChange);
    accentToggle.addEventListener('click', onAccentToggleClick);
    customAccentText.addEventListener('input', onCustomAccentInput);
    customAccentText.addEventListener('keydown', onCustomAccentKeydown);
    customAccentText.addEventListener('blur', onCustomAccentBlur);

    // Live translation controls
    if (changeKeybindBtn) {
        changeKeybindBtn.addEventListener('click', showKeybindModal);
    }

    // Whispra Translate page keybind containers (clickable)
    if (whispraTranslatePTTKeybindContainer) {
        whispraTranslatePTTKeybindContainer.addEventListener('click', showWhispraPTTKeybindModal);
    }
    if (whispraTranslateBidiKeybindContainer) {
        whispraTranslateBidiKeybindContainer.addEventListener('click', showWhispraBidirectionalKeybindModal);
    }

    // Keyboard event listeners for push-to-talk
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    // Bidirectional keydown handler removed - global handler now works everywhere

    // Global hotkey listeners for push-to-talk (works even when window not focused)
    (window as any).electronAPI?.on?.('translation-start', () => {
        if (isTranslating) {
            console.log('Global hotkey: Starting translation recording');
            startRecording();
        }
    });

    (window as any).electronAPI?.on?.('translation-stop', () => {
        if (isTranslating) {
            console.log('Global hotkey: Stopping translation recording');
            stopRecording();
        }
    });

    // Screen translation keybind update listener
    (window as any).electronAPI?.on?.('screen-translation-keybind-updated', (_event: any, data: any) => {
        console.log('📺 Screen translation keybind updated:', data.keybind);
        if (data.keybind) {
            updateScreenTranslationKeybindDisplay(data.keybind, screenTranslationKeybindSpan, screenTranslationKeybindDisplay);
        }
    });

    // Screen translation watch box keybind update listener
    (window as any).electronAPI?.on?.('screen-translation-watch-box-keybind-updated', (_event: any, data: any) => {
        console.log('👁️ Screen translation watch box keybind updated:', data);
        const keybindDisplay = document.getElementById('whispra-screen-watch-box-keybind') as HTMLElement | null;
        if (keybindDisplay && data.keybind) {
            // Format the keybind for display
            const key = data.keybind.replace('Key', '').replace('Digit', '');
            // We need to get the full keybind config to show modifiers
            (async () => {
                try {
                    const response = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    if (response.success && response.payload.uiSettings?.screenTranslationWatchBoxHotkey) {
                        const keybind = response.payload.uiSettings.screenTranslationWatchBoxHotkey;
                        const parts = [];
                        if (keybind.ctrl) parts.push('Ctrl');
                        if (keybind.alt) parts.push('Alt');
                        if (keybind.shift) parts.push('Shift');
                        parts.push(keybind.key);
                        keybindDisplay.textContent = parts.join(' + ');
                    }
                } catch (error) {
                    console.error('Failed to update watch box keybind display:', error);
                }
            })();
        }
    });

    // Bidirectional listeners
    if (bidirectionalToggleButton) bidirectionalToggleButton.addEventListener('click', toggleBidirectional);
    if (bidirectionalChangeKeybindBtn) bidirectionalChangeKeybindBtn.addEventListener('click', showBidirectionalKeybindModal);
    if (bidirectionalOutputSelect) bidirectionalOutputSelect.addEventListener('change', onBidirectionalOutputChange);
    // bidirectionalInputSelect event listener removed - now hardcoded
    if (incomingVoiceSelect) incomingVoiceSelect.addEventListener('change', onIncomingVoiceChange);
    if (bidirectionalProcessSelect) bidirectionalProcessSelect.addEventListener('change', onBidirectionalProcessChange);
    if (bidirectionalRefreshProcessesBtn) bidirectionalRefreshProcessesBtn.addEventListener('click', loadBidirectionalProcesses);
    if (bidirectionalSourceLanguageSelect) bidirectionalSourceLanguageSelect.addEventListener('change', onBidirectionalSourceLanguageChange);
    if (bidirectionalTargetLanguageSelect) bidirectionalTargetLanguageSelect.addEventListener('change', onBidirectionalTargetLanguageChange);
    if (bidirectionalCaptionsToggle) bidirectionalCaptionsToggle.addEventListener('click', toggleBidirectionalCaptions);
    if (bidirectionalCaptionsSettings) bidirectionalCaptionsSettings.addEventListener('click', () => showCaptionsSettingsModal());

    // Screen Translation listeners
    if (screenTranslationButton) screenTranslationButton.addEventListener('click', () => switchTab('screen-translation'));
    if (screenTranslationTriggerButton) screenTranslationTriggerButton.addEventListener('click', triggerScreenTranslation);
    if (screenTranslationChangeKeybindBtn) screenTranslationChangeKeybindBtn.addEventListener('click', showScreenTranslationKeybindModal);
    if (screenTranslationTargetLang) screenTranslationTargetLang.addEventListener('change', updateScreenTranslationConfig);
    if (screenTranslationSourceLang) screenTranslationSourceLang.addEventListener('change', updateScreenTranslationConfig);
    if (screenTranslationDisplaySelect) screenTranslationDisplaySelect.addEventListener('change', updateScreenTranslationConfig);
    document.addEventListener('keydown', handleScreenTranslationKeyDown);

    // Update page listeners
    const checkUpdatesButton = document.getElementById('check-updates-button') as HTMLButtonElement | null;
    const downloadUpdateButton = document.getElementById('download-update-button') as HTMLButtonElement | null;
    const installUpdateButton = document.getElementById('install-update-button') as HTMLButtonElement | null;
    const releaseNotesButton = document.getElementById('release-notes-button') as HTMLButtonElement | null;
    const updateSettingsButton = document.getElementById('update-settings-button') as HTMLButtonElement | null;

    if (checkUpdatesButton) checkUpdatesButton.addEventListener('click', manualCheckForUpdates);
    if (downloadUpdateButton) downloadUpdateButton.addEventListener('click', manualDownloadUpdate);
    if (installUpdateButton) installUpdateButton.addEventListener('click', manualInstallUpdate);
    if (releaseNotesButton) releaseNotesButton.addEventListener('click', openReleaseNotes);
    if (updateSettingsButton) updateSettingsButton.addEventListener('click', openUpdateSettings);

// Window control listeners
const windowMinimizeButton = document.getElementById('window-minimize') as HTMLButtonElement;
const windowMaximizeButton = document.getElementById('window-maximize') as HTMLButtonElement;
const windowCloseButton = document.getElementById('window-close') as HTMLButtonElement;

if (windowMinimizeButton) {
    windowMinimizeButton.addEventListener('click', async () => {
        await window.electronAPI.invoke('menu:minimize', {});
    });
}

if (windowMaximizeButton) {
    windowMaximizeButton.addEventListener('click', async () => {
        await window.electronAPI.invoke('menu:maximize', {});
        // Update icon based on maximized state
        const response = await window.electronAPI.invoke('menu:is-maximized', {});
        if (response.success && response.payload) {
            const icon = windowMaximizeButton.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', response.payload.isMaximized ? 'minimize-2' : 'square');
                // Re-initialize lucide icons
                if ((window as any).lucide) {
                    (window as any).lucide.createIcons();
                }
            }
        }
    });
}

if (windowCloseButton) {
    windowCloseButton.addEventListener('click', async () => {
        await window.electronAPI.invoke('menu:close', {});
    });
}

// Help dropdown listeners
const helpButton = document.getElementById('sidebar-help-button') as HTMLButtonElement;
const helpDropdownContent = document.getElementById('help-dropdown-content') as HTMLDivElement;
const helpTutorialButton = document.getElementById('help-tutorial-button') as HTMLButtonElement;
const helpVbAudioButton = document.getElementById('help-vb-audio-button') as HTMLButtonElement;
const helpApiSetupButton = document.getElementById('help-api-setup-button') as HTMLButtonElement;
const helpAudioSetupText = document.getElementById('help-audio-setup-text');
const helpReportIssueButton = document.getElementById('help-report-issue-button') as HTMLButtonElement;
const helpContactSupportButton = document.getElementById('help-contact-support-button') as HTMLButtonElement;
const helpVisitWebsiteButton = document.getElementById('help-visit-website-button') as HTMLButtonElement;

// Update audio setup button text based on platform
if (helpAudioSetupText) {
    const platform = (window as any).electronAPI?.platform || 'win32';
    helpAudioSetupText.textContent = platform === 'darwin' ? 'BlackHole Setup' : 'VB-Audio Setup';
}

if (helpButton && helpDropdownContent) {
    // Toggle dropdown on help button click
    helpButton.addEventListener('click', (e) => {
        e.stopPropagation();
        helpDropdownContent.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!helpButton.contains(e.target as Node) && !helpDropdownContent.contains(e.target as Node)) {
            helpDropdownContent.classList.remove('show');
        }
    });

    // Handle tutorial
    if (helpTutorialButton) {
        helpTutorialButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            try {
                const { TutorialOverlay } = await import('../ui/TutorialOverlay.js');
                const tutorial = TutorialOverlay.getInstance();
                await tutorial.start();
            } catch (error) {
                console.error('Failed to start tutorial:', error);
            }
        });
    }

    // Handle VB Audio setup
    if (helpVbAudioButton) {
        helpVbAudioButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            await window.electronAPI.invoke('help:vb-audio-setup', {});
        });
    }

    // Handle API setup
    if (helpApiSetupButton) {
        helpApiSetupButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            await window.electronAPI.showApiSetup();
        });
    }

    // Handle report issue
    if (helpReportIssueButton) {
        helpReportIssueButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            await window.electronAPI.invoke('help:report-issue', {});
        });
    }

    // Handle contact support
    if (helpContactSupportButton) {
        helpContactSupportButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            await window.electronAPI.invoke('help:contact-support', {});
        });
    }

    // Handle visit website
    if (helpVisitWebsiteButton) {
        helpVisitWebsiteButton.addEventListener('click', async () => {
            helpDropdownContent.classList.remove('show');
            await window.electronAPI.invoke('help:visit-website', {});
        });
    }
}

    // Profile dropdown listeners
    const menuAboutButton = document.getElementById('menu-about-button') as HTMLButtonElement;
    const menuWhatsNewButton = document.getElementById('menu-whats-new-button') as HTMLButtonElement;
    const menuCheckUpdatesButton = document.getElementById('menu-check-updates-button') as HTMLButtonElement;
    const profileButton = document.getElementById('profile-button') as HTMLButtonElement;
    const profileDropdownContent = document.getElementById('profile-dropdown-content') as HTMLDivElement;
    const getStartedButton = document.getElementById('get-started-button') as HTMLButtonElement;
    const logoutButton = document.getElementById('logout-button') as HTMLButtonElement;

    if (profileButton && profileDropdownContent && logoutButton) {
        // Toggle dropdown on profile button click
        profileButton.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdownContent.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileButton.contains(e.target as Node) && !profileDropdownContent.contains(e.target as Node)) {
                profileDropdownContent.classList.remove('show');
            }
        });

        // Menu action handlers
        if (menuAboutButton) {
            menuAboutButton.addEventListener('click', async () => {
                profileDropdownContent.classList.remove('show');
                await window.electronAPI.invoke('menu:about', {});
            });
        }

        if (menuWhatsNewButton) {
            menuWhatsNewButton.addEventListener('click', async () => {
                profileDropdownContent.classList.remove('show');
                try {
                    await window.electronAPI.showWhatsNew();
                } catch (error) {
                    console.error('Failed to open What\'s New:', error);
                }
            });
        }

        if (menuCheckUpdatesButton) {
            menuCheckUpdatesButton.addEventListener('click', async () => {
                profileDropdownContent.classList.remove('show');
                await window.electronAPI.invoke('menu:check-updates', {});
            });
        }

        // Logout button handler
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                profileDropdownContent.classList.remove('show');
                try {
                    // Check if auth is enabled
                    const authStatus = await window.electronAPI.invoke('auth:is-enabled', {});
                    if (!authStatus?.enabled) {
                        // Auth disabled - just close the dropdown, no sign-out needed
                        console.log('Auth disabled - sign-out not available in open-source mode');
                        return;
                    }

                    const result = await window.electronAPI.signOut();
                    if (result.success) {
                        // Redirect to signin page
                        window.location.href = 'signin.html';
                    } else {
                        console.error('Failed to sign out:', result.error);
                    }
                } catch (error) {
                    console.error('Error signing out:', error);
                }
            });
        }
    }



    // Theme toggle functionality (light/dark)
    const themeToggleButton = document.getElementById('theme-toggle') as HTMLButtonElement;
    const themeToggleIcon = document.getElementById('theme-toggle-icon') as HTMLElement;

    if (themeToggleButton && themeToggleIcon) {
        // Function to update the toggle icon based on current theme
        const updateThemeToggleIcon = () => {
            const ThemeManager = (window as any).ThemeManager;
            if (ThemeManager) {
                const themeManager = ThemeManager.getInstance();
                const currentTheme = themeManager.getCurrentTheme();

                // Set icon: sun for dark mode (default), moon for light mode (corporate)
                if (currentTheme === 'corporate') {
                    themeToggleIcon.setAttribute('data-lucide', 'moon');
                } else {
                    themeToggleIcon.setAttribute('data-lucide', 'sun');
                }

                // Re-initialize lucide icons
                if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
                    (window as any).lucide.createIcons();
                }
            }
        };

        // Initialize icon on load (with delay to ensure ThemeManager is ready)
        setTimeout(() => {
            updateThemeToggleIcon();
        }, 200);

        // Also listen for theme changes (e.g., from settings page)
        // Check periodically for theme changes
        setInterval(() => {
            updateThemeToggleIcon();
        }, 1000);

        // Handle theme toggle click
        themeToggleButton.addEventListener('click', async () => {
            const ThemeManager = (window as any).ThemeManager;
            if (ThemeManager) {
                const themeManager = ThemeManager.getInstance();
                const currentTheme = themeManager.getCurrentTheme();

                // Toggle between 'default' (dark) and 'corporate' (light)
                // If on corporate (light), switch to default (dark)
                // Otherwise, switch to corporate (light)
                if (currentTheme === 'corporate') {
                    await themeManager.setTheme('default');
                } else {
                    await themeManager.setTheme('corporate');
                }

                // Update icon after theme change
                setTimeout(() => {
                    updateThemeToggleIcon();
                }, 100);
            }
        });
    }

    // Language toggle functionality (using dependencies)
    const profileLanguageToggle = document.getElementById('profile-language-toggle') as HTMLSelectElement;
    console.log('Profile language toggle element:', profileLanguageToggle);
    dependencies.currentLanguage = 'en'; // Default language

    // Track initialization state and programmatic setting (accessible to updateLanguageDropdown)
    let isInitializingLanguage = true;
    let isSettingLanguageProgrammatically = false;

    // Load spoken language from account settings
    async function loadSpokenLanguage(): Promise<string | null> {
        try {
            const response = await window.electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
            return response?.payload?.userPreferences?.spokenLanguage || null;
        } catch (error) {
            console.error('Failed to load spoken language:', error);
            return null;
        }
    }

    // Save spoken language preference
    async function saveSpokenLanguage(languageCode: string): Promise<void> {
        try {
            await window.electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    userPreferences: {
                        spokenLanguage: languageCode
                    }
                }
            });
            console.log(`Saved spoken language: ${languageCode}`);
        } catch (error) {
            console.error('Failed to save spoken language:', error);
        }
    }

    // Get translations for modal (fallback to English if language not available)
    async function getModalTranslations(languageCode: string): Promise<any> {
        try {
            // Try to load translations for the selected language
            const response = await (window as any).electronAPI?.invoke('fs:read-file', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    path: `${languageCode}.json`
                }
            });

            if (response?.success && response.payload) {
                const translations = JSON.parse(response.payload);
                if (translations.languageChange) {
                    return translations.languageChange;
                }
            }
        } catch (error) {
            console.log(`Failed to load translations for ${languageCode}, falling back to English`);
        }

        // Fallback to English
        try {
            const response = await (window as any).electronAPI?.invoke('fs:read-file', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    path: 'en.json'
                }
            });

            if (response?.success && response.payload) {
                const translations = JSON.parse(response.payload);
                return translations.languageChange || {
                    title: 'Change App Language?',
                    message: 'Do you want to make Whispra\'s text in this language as well?',
                    yes: 'Yes',
                    no: 'No'
                };
            }
        } catch (error) {
            console.error('Failed to load English fallback translations:', error);
        }

        // Final fallback
        return {
            title: 'Change App Language?',
            message: 'Do you want to make Whispra\'s text in this language as well?',
            yes: 'Yes',
            no: 'No'
        };
    }

    // Show language change confirmation modal
    async function showLanguageChangeModal(selectedLanguage: string, onConfirm: () => void, onCancel: () => void): Promise<void> {
        // Prevent multiple modals
        if (document.getElementById('language-change-modal')) {
            return;
        }

        // Load translations in the selected language
        const translations = await getModalTranslations(selectedLanguage);

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'language-change-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: var(--panel, #1a1a1a);
            border: 1px solid var(--border, #333);
            border-radius: 12px;
            padding: 2rem;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            color: var(--text, #ffffff);
        `;

        const title = document.createElement('h3');
        title.textContent = translations.title;
        title.style.cssText = `
            margin: 0 0 1rem 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text, #ffffff);
        `;

        const message = document.createElement('p');
        message.textContent = translations.message;
        message.style.cssText = `
            margin: 0 0 1.5rem 0;
            font-size: 0.95rem;
            color: var(--text, #ffffff);
            opacity: 0.9;
            line-height: 1.5;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
        `;

        const yesButton = document.createElement('button');
        yesButton.textContent = translations.yes;
        yesButton.style.cssText = `
            padding: 0.625rem 1.25rem;
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s ease;
        `;
        yesButton.addEventListener('mouseenter', () => {
            yesButton.style.background = '#1d4ed8';
        });
        yesButton.addEventListener('mouseleave', () => {
            yesButton.style.background = '#2563eb';
        });
        yesButton.addEventListener('click', () => {
            modal.remove();
            onConfirm();
        });

        const noButton = document.createElement('button');
        noButton.textContent = translations.no;
        noButton.style.cssText = `
            padding: 0.625rem 1.25rem;
            background: transparent;
            color: var(--text, #ffffff);
            border: 1px solid var(--border, #333);
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s ease;
        `;
        noButton.addEventListener('mouseenter', () => {
            noButton.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        noButton.addEventListener('mouseleave', () => {
            noButton.style.background = 'transparent';
        });
        noButton.addEventListener('click', () => {
            modal.remove();
            onCancel();
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                onCancel();
            }
        });

        // Close on Escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                modal.remove();
                onCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        buttonContainer.appendChild(noButton);
        buttonContainer.appendChild(yesButton);
        modalContent.appendChild(title);
        modalContent.appendChild(message);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }

    // Handle profile dropdown language selector
    if (profileLanguageToggle) {
        console.log('Profile language toggle found, setting up event listener');
        
        // Track previous value
        let previousLanguageValue = profileLanguageToggle.value;
        
        // Load spoken language on init
        loadSpokenLanguage().then(savedLang => {
            if (savedLang && profileLanguageToggle) {
                // Set flag to prevent change event from triggering modal
                isSettingLanguageProgrammatically = true;
                profileLanguageToggle.value = savedLang;
                previousLanguageValue = savedLang;
                console.log('Loaded spoken language:', savedLang);
                // Reset flag after a brief moment
                setTimeout(() => {
                    isSettingLanguageProgrammatically = false;
                }, 50);
            } else {
                console.log('No saved spoken language found, using default');
                // Update previousLanguageValue to match current value
                previousLanguageValue = profileLanguageToggle.value;
            }
            // Mark initialization as complete after a delay to ensure value is set and other code doesn't override
            setTimeout(() => {
                isInitializingLanguage = false;
                console.log('✅ Profile dropdown initialization complete');
            }, 500);
        }).catch(error => {
            console.error('Error loading spoken language:', error);
            // Update previousLanguageValue to match current value
            previousLanguageValue = profileLanguageToggle.value;
            // Still mark initialization as complete even if there's an error
            setTimeout(() => {
                isInitializingLanguage = false;
                console.log('✅ Profile dropdown initialization complete (with error)');
            }, 500);
        });
        
        // Handle language dropdown change
        profileLanguageToggle.addEventListener('change', async () => {
            // Don't show modal during initialization or when setting programmatically
            if (isInitializingLanguage || isSettingLanguageProgrammatically) {
                console.log('Skipping modal during initialization or programmatic set');
                return;
            }
            
            const selectedLanguage = profileLanguageToggle.value;
            const previousLanguage = previousLanguageValue;
            
            // Don't show modal if value hasn't actually changed
            if (selectedLanguage === previousLanguage) {
                console.log('Language value unchanged, skipping modal');
                return;
            }
            
            console.log('Profile language dropdown changed to:', selectedLanguage);
            
            // Show modal asking if user wants to change UI language
            await showLanguageChangeModal(selectedLanguage, 
                async () => {
                    // User confirmed - save spoken language and update UI language
                    console.log('User confirmed language change to:', selectedLanguage);
                    await saveSpokenLanguage(selectedLanguage);
                    dependencies.currentLanguage = selectedLanguage;
                    await applyLanguage(selectedLanguage);
                    await saveLanguagePreference(selectedLanguage);
                    previousLanguageValue = selectedLanguage;
                    
                    // Dispatch event to sync other language selectors
                    window.dispatchEvent(new CustomEvent('spoken-language-changed', { 
                        detail: { language: selectedLanguage, source: 'profile-dropdown' } 
                    }));
                },
                async () => {
                    // User cancelled - save spoken language but don't change UI language
                    // Keep the dropdown showing their selection
                    console.log('User cancelled UI language change, but saving spoken language preference');
                    await saveSpokenLanguage(selectedLanguage);
                    previousLanguageValue = selectedLanguage;
                    // Don't revert the dropdown - keep showing their selection
                    
                    // Dispatch event to sync other language selectors
                    window.dispatchEvent(new CustomEvent('spoken-language-changed', { 
                        detail: { language: selectedLanguage, source: 'profile-dropdown' } 
                    }));
                }
            );
        });
        // Listen for spoken language changes from other sources (whispra translate, settings)
        window.addEventListener('spoken-language-changed', (event: Event) => {
            const customEvent = event as CustomEvent;
            const { language, source } = customEvent.detail;
            
            // Don't update if this dropdown was the source
            if (source === 'profile-dropdown') return;
            
            // Update this dropdown if the language exists
            if (profileLanguageToggle.querySelector(`option[value="${language}"]`)) {
                isSettingLanguageProgrammatically = true;
                profileLanguageToggle.value = language;
                previousLanguageValue = language;
                console.log(`Profile dropdown synced to ${language} from ${source}`);
                setTimeout(() => {
                    isSettingLanguageProgrammatically = false;
                }, 50);
            }
        });
    } else {
        console.error('Profile language toggle element not found!');
    }

    function updateLanguageDropdown() {
        console.log('Updating dropdown to language:', dependencies.currentLanguage);
        
        if (profileLanguageToggle) {
            // Don't override if we're still initializing - let the initialization code handle it
            if (!isInitializingLanguage) {
                // The spoken language preference takes precedence over UI language for the dropdown
                loadSpokenLanguage().then(savedLang => {
                    if (savedLang) {
                        // Use saved spoken language, set programmatically to avoid triggering change event
                        isSettingLanguageProgrammatically = true;
                        profileLanguageToggle.value = savedLang;
                        console.log('Profile dropdown set to saved spoken language:', savedLang);
                        setTimeout(() => {
                            isSettingLanguageProgrammatically = false;
                        }, 50);
                    } else {
                        // Fallback to UI language if no spoken language saved
                        isSettingLanguageProgrammatically = true;
                        profileLanguageToggle.value = dependencies.currentLanguage;
                        console.log('Profile dropdown set to UI language:', dependencies.currentLanguage);
                        setTimeout(() => {
                            isSettingLanguageProgrammatically = false;
                        }, 50);
                    }
                }).catch(() => {
                    // Fallback to UI language on error
                    isSettingLanguageProgrammatically = true;
                    profileLanguageToggle.value = dependencies.currentLanguage;
                    setTimeout(() => {
                        isSettingLanguageProgrammatically = false;
                    }, 50);
                });
            }
        }

        // Verify the dropdown was updated correctly
        setTimeout(() => {
            if (profileLanguageToggle && profileLanguageToggle.value !== dependencies.currentLanguage) {
                // Don't warn if it's different - that's expected if spoken language differs from UI language
                console.log('Profile dropdown value:', profileLanguageToggle.value, 'UI language:', dependencies.currentLanguage);
            }
        }, 100);
    }

    function getLanguageName(code: string): string {
        const names: { [key: string]: string } = {
            'en': 'English',
            'es': 'Spanish',
            'ru': 'Russian',
            'zh': 'Chinese',
            'ja': 'Japanese'
        };
        return names[code] || 'Unknown';
    }

    async function applyLanguage(languageCode: string) {
        try {
            console.log(`🔄 Applying language: ${languageCode}`);

            // Update global currentLanguage FIRST before anything else
            dependencies.currentLanguage = languageCode;
            (window as any).currentLanguage = languageCode;
            console.log(`✅ Updated window.currentLanguage to: ${languageCode}`);

            // Send language change to main process
            await window.electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        language: languageCode
                    }
                }
            });

            // Notify overlay about language change
            console.log(`📢 Notifying overlay about language change to: ${languageCode}`);
            console.log(`📢 Sending language:changed message with data:`, { language: languageCode, timestamp: Date.now() });

            try {
                (window as any).electronAPI?.sendToMain?.('language:changed', {
                    language: languageCode,
                    timestamp: Date.now()
                });
                console.log(`✅ Language change message sent successfully`);
            } catch (error) {
                console.error(`❌ Failed to send language change message:`, error);
            }

            // Update UI text based on language (basic implementation)
            console.log(`📝 About to update UI text for language: ${languageCode}`);
            updateUIText(languageCode, dependencies);
            
            // Update bidirectional UI language
            updateUILanguage(languageCode);

            // Update tutorial translations if tutorial is loaded
            try {
                const { TutorialOverlay } = await import('../ui/TutorialOverlay.js');
                const tutorialInstance = TutorialOverlay.getInstance();
                tutorialInstance.reloadTranslations();
                console.log('✅ Tutorial translations reloaded');
            } catch (error) {
                console.log('ℹ️ Tutorial not loaded yet, skipping translation reload');
            }

            console.log(`✅ Language successfully changed to: ${languageCode}`);
        } catch (error) {
            console.error('❌ Failed to apply language:', error);
        }
    }


    function updateUIText(languageCode: string, deps: any) {
        try {
            console.log(`Updating UI text for language: ${languageCode}`);

            // Get translations from embedded data
            const translations = getTranslations(languageCode);
            console.log('Using embedded translations for:', languageCode);

            // Update sidebar navigation buttons
            const sidebarTranslateBtn = document.querySelector('#sidebar-translate-button .label') as HTMLElement;
            if (sidebarTranslateBtn) sidebarTranslateBtn.textContent = translations.sidebar.translate;

            const sidebarBidirectionalBtn = document.querySelector('#sidebar-bidirectional-button .label') as HTMLElement;
            if (sidebarBidirectionalBtn) sidebarBidirectionalBtn.textContent = translations.sidebar.bidirectional;

            const sidebarScreenTranslationBtn = document.querySelector('#sidebar-screen-translation-button .label') as HTMLElement;
            if (sidebarScreenTranslationBtn) sidebarScreenTranslationBtn.textContent = translations.sidebar.screenTranslation;

            const sidebarSoundBoardBtn = document.querySelector('#sidebar-sound-board-button .label') as HTMLElement;
            if (sidebarSoundBoardBtn) sidebarSoundBoardBtn.textContent = translations.sidebar.soundBoard;

            const sidebarVoiceFilterBtn = document.querySelector('#sidebar-voice-filter-button .label') as HTMLElement;
            if (sidebarVoiceFilterBtn) sidebarVoiceFilterBtn.textContent = translations.sidebar.voiceFilter;

            const sidebarSettingsBtn = document.querySelector('#sidebar-settings-button .label') as HTMLElement;
            if (sidebarSettingsBtn) sidebarSettingsBtn.textContent = translations.sidebar.settings;

            const sidebarLogsBtn = document.querySelector('#sidebar-logs-button .label') as HTMLElement;
            if (sidebarLogsBtn) sidebarLogsBtn.textContent = translations.sidebar.logs;

            // Update new sidebar buttons (Whispra Translate, Screen Translate, Quick Translate, Help)
            const sidebarWhispraTranslateBtn = document.querySelector('#sidebar-whispra-translate-button .label') as HTMLElement;
            if (sidebarWhispraTranslateBtn) sidebarWhispraTranslateBtn.textContent = translations.sidebar.whispraTranslate || 'Whispra Translate';

            const sidebarWhispraScreenBtn = document.querySelector('#sidebar-whispra-screen-button .label') as HTMLElement;
            if (sidebarWhispraScreenBtn) sidebarWhispraScreenBtn.textContent = translations.sidebar.screenTranslate || 'Screen Translate';

            const sidebarQuickTranslateBtn = document.querySelector('#sidebar-quick-translate-button .label') as HTMLElement;
            if (sidebarQuickTranslateBtn) sidebarQuickTranslateBtn.textContent = translations.sidebar.quickTranslate || 'Quick Translate';

            const sidebarHelpBtn = document.querySelector('#sidebar-help-button .label') as HTMLElement;
            if (sidebarHelpBtn) sidebarHelpBtn.textContent = translations.sidebar.help || 'Help';

            // Update sidebar brand/menu text
            const sidebarBrand = document.querySelector('.sidebar .brand') as HTMLElement;
            if (sidebarBrand) sidebarBrand.textContent = translations.sidebar.menu;

            // Update header elements
            const logoutButtonEl = document.querySelector('#logout-button') as HTMLElement;
            if (logoutButtonEl) {
                const logoutText = logoutButtonEl.querySelector('span:last-child') as HTMLElement;
                if (logoutText) logoutText.textContent = translations.header.signOut;
            }

            // Update bidirectional panel elements
            const bidirectionalTitle = document.querySelector('#bidirectional-panel label:first-child') as HTMLElement;
            if (bidirectionalTitle) updateLabelText(bidirectionalTitle, translations.bidirectional.panel.title);

            // Update bidirectional toggle button
            if (bidirectionalToggleButton) {
                const isRunning = (bidirectionalToggleButton.textContent?.includes('Stop')) ?? false;
                bidirectionalToggleButton.textContent = getTranslatedBidirectionalButtonText(deps.currentLanguage, isRunning);
            }

            // Update bidirectional labels
            const bidirectionalKeybindLabel = document.querySelector('#bidirectional-panel .control-group:nth-child(2) label') as HTMLElement;
            if (bidirectionalKeybindLabel) updateLabelText(bidirectionalKeybindLabel, translations.bidirectional.controls.keybind);

            const bidirectionalOutputLabel = document.querySelector('label[for="bidirectional-output-select"]') as HTMLElement;
            if (bidirectionalOutputLabel) updateLabelText(bidirectionalOutputLabel, translations.bidirectional.controls.outputDevice);

            const bidirectionalInputLabel = document.querySelector('label[for="bidirectional-input-display"]') as HTMLElement;
            if (bidirectionalInputLabel) updateLabelText(bidirectionalInputLabel, translations.bidirectional.controls.systemInput);

            const bidirectionalVoiceLabel = document.querySelector('label[for="incoming-voice-select"]') as HTMLElement;
            if (bidirectionalVoiceLabel) updateLabelText(bidirectionalVoiceLabel, translations.bidirectional.controls.incomingVoice);

            const bidirectionalProcessLabel = document.querySelector('label[for="bidirectional-process-select"]') as HTMLElement;
            if (bidirectionalProcessLabel) updateLabelText(bidirectionalProcessLabel, translations.bidirectional.controls.appSelection);

            const bidirectionalSourceLanguageLabel = document.querySelector('label[for="bidirectional-source-language"]') as HTMLElement;
            if (bidirectionalSourceLanguageLabel) updateLabelText(bidirectionalSourceLanguageLabel, translations.bidirectional.controls.sourceLanguage || 'Source Language');

            // Update bidirectional placeholders
            if (bidirectionalOutputSelect && bidirectionalOutputSelect.options[0]) {
                bidirectionalOutputSelect.options[0].textContent = translations.bidirectional.placeholders.loadingOutputDevices;
            }

            if (incomingVoiceSelect && incomingVoiceSelect.options[0]) {
                incomingVoiceSelect.options[0].textContent = translations.bidirectional.placeholders.loadingVoices;
            }

            const bidirectionalInputDisplay = document.getElementById('bidirectional-input-display') as HTMLElement;
            if (bidirectionalInputDisplay) {
                bidirectionalInputDisplay.textContent = translations.bidirectional.placeholders.displaySystemAudio;
            }

            // Update bidirectional status messages
            if (bidirectionalStatusText) {
                // This will be updated dynamically, but we can set initial state
                if (bidirectionalStatusText.textContent === 'Idle' ||
                    bidirectionalStatusText.textContent === 'Waiting...' ||
                    bidirectionalStatusText.textContent === translations.bidirectional.status.waiting) {
                    bidirectionalStatusText.textContent = translations.bidirectional.status.idle;
                }
            }

            // Update bidirectional text areas
            if (bidirectionalDetectedText && bidirectionalDetectedText.classList.contains('empty')) {
                if (bidirectionalDetectedText.textContent === 'Waiting...' ||
                    bidirectionalDetectedText.textContent === translations.bidirectional.status.waiting) {
                    bidirectionalDetectedText.textContent = translations.bidirectional.status.waiting;
                }
            }

            const bidirectionalRespokenText = document.getElementById('bidirectional-respoken-text') as HTMLElement;
            if (bidirectionalRespokenText && bidirectionalRespokenText.classList.contains('empty')) {
                if (bidirectionalRespokenText.textContent === 'Ready...' ||
                    bidirectionalRespokenText.textContent === translations.bidirectional.status.ready) {
                    bidirectionalRespokenText.textContent = translations.bidirectional.status.ready;
                }
            }

            // Update bidirectional labels
            const bidirectionalDetectedLabel = document.querySelector('#bidirectional-panel .translation-section:nth-child(1) label') as HTMLElement;
            if (bidirectionalDetectedLabel) updateLabelText(bidirectionalDetectedLabel, translations.bidirectional.labels.detectedTarget);

            const bidirectionalRespokenLabel = document.querySelector('#bidirectional-panel .translation-section:nth-child(2) label') as HTMLElement;
            if (bidirectionalRespokenLabel) updateLabelText(bidirectionalRespokenLabel, translations.bidirectional.labels.respoken);

            // Update bidirectional keybind info - get current config value
            (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            }).then((response: any) => {
                if (response.success) {
                    const cfg = response.payload;
                    const defaultBidiHotkey = { ctrl: false, alt: true, shift: false, key: 'B' };
                    const bidiHotkey = cfg.uiSettings?.bidirectionalHotkey || defaultBidiHotkey;
                    const currentKeybind = `Key${bidiHotkey.key}`;
                    updateBidirectionalKeybindDisplay(currentKeybind, bidirectionalKeybindSpan, bidirectionalKeybindDisplay);

                    // Load screen translation hotkey
                    const defaultScreenTranslationHotkey = { ctrl: false, alt: true, shift: false, key: 'T' };
                    const screenTranslationHotkey = cfg.uiSettings?.screenTranslationHotkey || defaultScreenTranslationHotkey;
                    const currentScreenTranslationKeybind = `Key${screenTranslationHotkey.key}`;
                    dependencies.screenTranslationKeybind = currentScreenTranslationKeybind;
                    updateScreenTranslationKeybindDisplay(currentScreenTranslationKeybind, screenTranslationKeybindSpan, screenTranslationKeybindDisplay);
                }
            }).catch(() => {
                // Fallback to using the keybind variables
                updateBidirectionalKeybindDisplay(bidirectionalKeybind, bidirectionalKeybindSpan, bidirectionalKeybindDisplay);
                updateScreenTranslationKeybindDisplay(screenTranslationKeybind, screenTranslationKeybindSpan, screenTranslationKeybindDisplay);
            });

            const bidirectionalChangeKeyBtn = document.getElementById('bidirectional-change-keybind-btn') as HTMLElement;
            if (bidirectionalChangeKeyBtn) bidirectionalChangeKeyBtn.textContent = translations.bidirectional.controls.changeKey;

            // Update soundboard panel elements
            const soundboardTitle = document.querySelector('#sound-board-panel label:first-child') as HTMLElement;
            if (soundboardTitle) updateLabelText(soundboardTitle, translations.soundboard.panel.title);

            const soundboardDescription = document.querySelector('#sound-board-panel p') as HTMLElement;
            if (soundboardDescription) soundboardDescription.textContent = translations.soundboard.panel.description;

            // Update soundboard labels (output device label hidden - hardcoded to VB Audio INPUT Cable)
            // const soundboardOutputLabel = document.querySelector('label[for="sound-board-output"]') as HTMLElement;
            // if (soundboardOutputLabel) updateLabelText(soundboardOutputLabel, translations.soundboard.controls.outputDevice);

            const soundboardVBLabel = document.querySelector('label[for="sound-board-volume"]') as HTMLElement;
            if (soundboardVBLabel) updateLabelText(soundboardVBLabel, translations.soundboard.controls.vbAudioVolume);

            const soundboardHeadphonesLabel = document.querySelector('label[for="sound-board-headphones-volume"]') as HTMLElement;
            if (soundboardHeadphonesLabel) updateLabelText(soundboardHeadphonesLabel, translations.soundboard.controls.headphonesVolume);

            const soundboardGridLabel = document.querySelector('#sound-board-panel .keybind-info label') as HTMLElement;
            if (soundboardGridLabel) updateLabelText(soundboardGridLabel, translations.soundboard.controls.soundPadGrid);

            const soundboardHotkeysLabel = document.querySelector('label[for="soundboard-hotkeys-toggle"]') as HTMLElement;
            if (soundboardHotkeysLabel) soundboardHotkeysLabel.textContent = translations.soundboard.controls.enableHotkeys;

            // Update soundboard buttons
            const addSoundButton = document.getElementById('add-sound-button') as HTMLElement;
            if (addSoundButton) updateLabelText(addSoundButton, translations.soundboard.controls.addSoundFiles);

            const soundboardOverlayButton = document.getElementById('soundboard-overlay-button') as HTMLElement;
            if (soundboardOverlayButton) updateLabelText(soundboardOverlayButton, translations.soundboard.controls.webOverlay);

            const stopAllSoundsButton = document.getElementById('stop-all-sounds-button') as HTMLElement;
            if (stopAllSoundsButton) updateLabelText(stopAllSoundsButton, translations.soundboard.controls.stopAllSounds);

            // Update soundboard placeholders (output device hidden - hardcoded to VB Audio INPUT Cable)
            // const soundboardOutputSelect = document.getElementById('sound-board-output') as HTMLSelectElement;
            // if (soundboardOutputSelect && soundboardOutputSelect.options[0]) {
            //     soundboardOutputSelect.options[0].textContent = translations.soundboard.placeholders.selectOutputDevice;
            // }
            // if (soundboardOutputSelect && soundboardOutputSelect.options[1]) {
            //     soundboardOutputSelect.options[1].textContent = translations.soundboard.placeholders.defaultSystemOutput;
            // }
            // if (soundboardOutputSelect && soundboardOutputSelect.options[2]) {
            //     soundboardOutputSelect.options[2].textContent = translations.soundboard.placeholders.virtualAudioCable;
            // }

            // Refresh bidirectional status text with new language
            // Check if bidirectional panel is visible and update status accordingly
            if (bidirectionalPanel && bidirectionalPanel.style.display !== 'none') {
                // If panel is visible, refresh the status based on current active state
                const isActive = bidirectionalToggleButton?.classList.contains('active') || isBidirectionalActive;
                setBidirectionalStatus(isActive);
            } else if (bidirectionalStatusText) {
                // If panel is not visible, just update to idle state
                const translations = getTranslations(deps.currentLanguage);
                bidirectionalStatusText.textContent = translations.bidirectional.status.idle;
            }

            // Update main translation controls
            if (startButton) {
                const isRunning = startButton.textContent?.includes('Stop') || isTranslating;
                startButton.textContent = getTranslatedButtonText(deps.currentLanguage, isRunning);
            }

            // Update labels
            const micLabel = document.querySelector('label[for="microphone-select"]') as HTMLLabelElement;
            if (micLabel) updateLabelText(micLabel, translations.controls.microphone);

            const langLabel = document.querySelector('label[for="language-select"]') as HTMLLabelElement;
            if (langLabel) updateLabelText(langLabel, translations.controls.targetLanguage);

            const voiceLabel = document.querySelector('label[for="voice-select"]') as HTMLLabelElement;
            if (voiceLabel) updateLabelText(voiceLabel, translations.controls.voice);

            // Update other main app elements
            if (outputToggleButton) updateLabelText(outputToggleButton, translations.controls.output + ': Virtual Device');

            const accentLabel = document.querySelector('label[for="accent-preset"]') as HTMLLabelElement;
            if (accentLabel) updateLabelText(accentLabel, translations.controls.accent);

            const accentToggleButton = document.getElementById('accent-toggle') as HTMLButtonElement;
            if (accentToggleButton) {
                const isOn = accentToggleButton.textContent?.includes('ON') || accentToggleButton.textContent?.includes('ACTIVADO');
                updateLabelText(accentToggleButton, isOn ? translations.controls.accentOn : translations.controls.accentOff);
            }

            const addVoiceButton = document.getElementById('add-voice-button') as HTMLButtonElement;
            if (addVoiceButton) addVoiceButton.textContent = translations.controls.addCustomVoice;

            // Update placeholder texts
            const customAccentInput = document.getElementById('custom-accent-text') as HTMLInputElement;
            if (customAccentInput) customAccentInput.placeholder = translations.placeholders.enterCustomAccent;

            // Update placeholders
            const micSelect = document.getElementById('microphone-select') as HTMLSelectElement;
            if (micSelect && micSelect.options[0]) {
                micSelect.options[0].textContent = translations.placeholders.selectMicrophone;
            }

            const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
            if (voiceSelect && voiceSelect.options.length > 0) {
                const loadingOption = Array.from(voiceSelect.options).find(opt => opt.value === '');
                if (loadingOption) loadingOption.textContent = translations.placeholders.loadingVoices;
            }

            // Update tab labels
            const translationTab = document.getElementById('translation-tab');
            if (translationTab) translationTab.textContent = `➡️ ${translations.tab.translation}`;

            const bidirectionalTab = document.getElementById('bidirectional-tab');
            if (bidirectionalTab) bidirectionalTab.textContent = `⬅️ ${translations.tab.bidirectional}`;

            const soundboardTab = document.getElementById('soundboard-tab');
            if (soundboardTab) soundboardTab.textContent = `🎵 ${translations.tab.soundboard}`;

            const settingsTab = document.getElementById('overlay-settings-tab');
            if (settingsTab) settingsTab.textContent = `⚙️ ${translations.tab.settings}`;

            // Update keybind display
            updatePTTKeybindDisplay(deps.currentKeybind, currentKeybindSpan, translationKeybindDisplay);

            // Update Quick Translate panel elements
            const quickTranslatePanelTranslations = translations.quickTranslatePanel || {};
            
            // Quick Translate title and description
            const quickTranslateTitle = document.querySelector('#quick-translate-panel .control-group label') as HTMLElement;
            if (quickTranslateTitle) quickTranslateTitle.innerHTML = `<i data-lucide="zap" style="width: 16px; height: 16px;"></i> ${quickTranslatePanelTranslations.title || 'Quick Translate'}`;
            
            const quickTranslateDesc = document.querySelector('#quick-translate-panel .control-group p') as HTMLElement;
            if (quickTranslateDesc) quickTranslateDesc.textContent = quickTranslatePanelTranslations.description || 'Instantly translate text using AI translation services';
            
            // Global Hotkey label
            const quickTranslateHotkeyLabel = document.querySelector('#quick-translate-panel span[style*="color: var(--muted)"]') as HTMLElement;
            if (quickTranslateHotkeyLabel) quickTranslateHotkeyLabel.textContent = quickTranslatePanelTranslations.globalHotkey || 'Global Hotkey:';
            
            // Translate To label
            const quickTranslateToLabel = document.querySelector('label[for="quick-translate-target-lang"]') as HTMLElement;
            if (quickTranslateToLabel) quickTranslateToLabel.textContent = quickTranslatePanelTranslations.translateTo || 'Translate To';
            
            // Auto-Translate label
            const quickTranslateAutoLabel = document.querySelector('label[for="quick-translate-auto-toggle"]') as HTMLElement;
            if (quickTranslateAutoLabel) quickTranslateAutoLabel.textContent = quickTranslatePanelTranslations.autoTranslate || 'Auto-Translate';
            
            // Auto-Translate info text
            const quickTranslateAutoInfo = document.getElementById('quick-translate-auto-info') as HTMLElement;
            if (quickTranslateAutoInfo) {
                const autoSwitch = document.getElementById('quick-translate-auto-switch');
                const isAutoEnabled = autoSwitch?.classList.contains('active');
                quickTranslateAutoInfo.textContent = isAutoEnabled 
                    ? (quickTranslatePanelTranslations.translatesAsYouType || 'Translates as you type')
                    : (quickTranslatePanelTranslations.clickTranslateOrPress || 'Click Translate or press Ctrl+Enter');
            }
            
            // Text to Translate label
            const quickTranslateInputLabel = document.querySelector('label[for="quick-translate-input"]') as HTMLElement;
            if (quickTranslateInputLabel) quickTranslateInputLabel.textContent = quickTranslatePanelTranslations.textToTranslate || 'Text to Translate';
            
            // Translation Result label
            const quickTranslateOutputLabel = document.querySelector('label[for="quick-translate-output"]') as HTMLElement;
            if (quickTranslateOutputLabel) quickTranslateOutputLabel.textContent = quickTranslatePanelTranslations.translationResult || 'Translation Result';
            
            // Translate button
            const quickTranslateBtnText = document.getElementById('quick-translate-btn-text') as HTMLElement;
            if (quickTranslateBtnText && !quickTranslateBtnText.textContent?.includes('...')) {
                quickTranslateBtnText.textContent = quickTranslatePanelTranslations.translate || 'Translate';
            }
            
            // Clear button
            const quickTranslateClearBtn = document.getElementById('quick-translate-clear-btn') as HTMLElement;
            if (quickTranslateClearBtn) quickTranslateClearBtn.textContent = quickTranslatePanelTranslations.clear || 'Clear';
            
            // Copy Result button
            const quickTranslateCopyBtn = document.getElementById('quick-translate-copy-btn') as HTMLElement;
            if (quickTranslateCopyBtn) quickTranslateCopyBtn.textContent = quickTranslatePanelTranslations.copyResult || 'Copy Result';
            
            // Input placeholder
            const quickTranslateInput = document.getElementById('quick-translate-input') as HTMLTextAreaElement;
            if (quickTranslateInput) quickTranslateInput.placeholder = quickTranslatePanelTranslations.enterTextPlaceholder || 'Enter text to translate...';
            
            // Output placeholder
            const quickTranslateOutput = document.getElementById('quick-translate-output') as HTMLTextAreaElement;
            if (quickTranslateOutput) quickTranslateOutput.placeholder = quickTranslatePanelTranslations.translationPlaceholder || 'Translation will appear here...';

            // Update footer buttons
            const footerTranslations = translations.footer || {};
            
            const affiliateButton = document.getElementById('affiliate-button') as HTMLElement;
            if (affiliateButton) affiliateButton.textContent = footerTranslations.becomeAffiliate || 'Become an Affiliate';
            
            const feedbackButton = document.getElementById('feedback-button') as HTMLElement;
            if (feedbackButton) feedbackButton.textContent = footerTranslations.reportBug || 'Report Bug / Suggest Feature';

            console.log(`UI updated with language: ${languageCode}`);
            console.log('Sidebar and main app translations applied successfully');

            // Re-initialize all Lucide icons after DOM updates
            if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
                (window as any).lucide.createIcons();
                console.log('Lucide icons re-initialized after translation update');
            }
        } catch (error) {
            console.error(`Failed to update UI text for ${languageCode}:`, error);
            console.error('Error details:', error);
        }
    }


    async function saveLanguagePreference(languageCode: string) {
        try {
            console.log('Saving language preference:', languageCode);
            const result = await window.electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        preferredLanguage: languageCode
                    }
                }
            });
            console.log('Save result:', result);
        } catch (error) {
            console.error('Failed to save language preference:', error);
        }
    }

    async function loadLanguagePreference() {
        try {
            console.log('Loading language preference...');
            const config = await window.electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            console.log('Config response:', config);

            if (config?.success && config.payload?.uiSettings?.preferredLanguage) {
                const loadedLanguage = config.payload.uiSettings.preferredLanguage;
                dependencies.currentLanguage = loadedLanguage;
                (window as any).currentLanguage = loadedLanguage;
                console.log('Loaded preferred UI language:', loadedLanguage);
                // Don't call updateLanguageDropdown() here - let it respect spoken language
                // Only update if we're not initializing (to avoid race conditions)
                if (!isInitializingLanguage) {
                    updateLanguageDropdown();
                }
                applyLanguage(loadedLanguage);
            } else {
                console.log('No saved language preference found, using default: en');
                dependencies.currentLanguage = 'en';
                (window as any).currentLanguage = 'en';
                // Don't call updateLanguageDropdown() here - let it respect spoken language
                // Only update if we're not initializing (to avoid race conditions)
                if (!isInitializingLanguage) {
                    updateLanguageDropdown();
                }
                applyLanguage('en');
            }
        } catch (error) {
            console.error('Failed to load language preference:', error);
            // Fallback to default
            console.log('Using fallback language: en');
            dependencies.currentLanguage = 'en';
            (window as any).currentLanguage = 'en';
            // Don't call updateLanguageDropdown() here - let it respect spoken language
            // Only update if we're not initializing (to avoid race conditions)
            if (!isInitializingLanguage) {
                updateLanguageDropdown();
            }
            applyLanguage('en');
        }
    }

    // Initialize dropdown properly
    async function initializeDropdown() {
        if (profileLanguageToggle) {
            console.log('Initializing language dropdown...');
            // Load spoken language first - it takes precedence over UI language
            const savedSpokenLang = await loadSpokenLanguage();
            if (savedSpokenLang) {
                isSettingLanguageProgrammatically = true;
                profileLanguageToggle.value = savedSpokenLang;
                console.log('Dropdown initialized with saved spoken language:', savedSpokenLang);
                setTimeout(() => {
                    isSettingLanguageProgrammatically = false;
                }, 50);
            } else {
                // Fallback to UI language if no spoken language saved
                isSettingLanguageProgrammatically = true;
                profileLanguageToggle.value = dependencies.currentLanguage;
                console.log('Dropdown initialized with UI language:', dependencies.currentLanguage);
                setTimeout(() => {
                    isSettingLanguageProgrammatically = false;
                }, 50);
            }

            return true;
        } else {
            console.error('Profile language dropdown not found during initialization');
            return false;
        }
    }

    // Load saved language preference on startup (with DOM and Lucide ready check)
    async function loadLanguageWithDelay() {
        // Check if Lucide is loaded
        const lucideLoaded = typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons;

        if (profileLanguageToggle && document.readyState === 'complete' && lucideLoaded) {
            console.log('DOM and Lucide ready, loading language preferences...');
            // Wait a bit to ensure profile dropdown initialization has completed
            // The profile dropdown init code already loads the spoken language
            setTimeout(async () => {
                // Initialize dropdown with spoken language (in case profile init didn't run yet)
                await initializeDropdown();
                // Load UI language preference but don't let it override the dropdown
                loadLanguagePreference();
            }, 600);
        } else {
            if (!lucideLoaded) {
                console.log('Lucide not loaded yet, waiting...');
            } else {
                console.log('DOM not ready yet, waiting...');
            }
            // Wait for both DOM and Lucide to be ready
            if (document.readyState !== 'loading') {
                setTimeout(loadLanguageWithDelay, 100);
            } else {
                document.addEventListener('DOMContentLoaded', loadLanguageWithDelay);
            }
        }
    }

    // Also listen for window load to ensure Lucide is loaded
    if (document.readyState === 'complete') {
        loadLanguageWithDelay();
    } else {
        window.addEventListener('load', loadLanguageWithDelay);
    }

    // Initialize bidirectional status text
    if (bidirectionalStatusText) {
        const translations = getTranslations(dependencies.currentLanguage);
        bidirectionalStatusText.textContent = translations.bidirectional.status.idle;
    }

    // Language system initialized
    console.log('Language system initialized');


// Add global functions for testing and debugging
(window as any).testLanguage = (lang: string) => {
    console.log(`🧪 Testing language change to: ${lang}`);
    applyLanguage(lang);
    saveLanguagePreference(lang);
};

(window as any).resetLanguage = () => {
    console.log('🔄 Resetting language to English default');
    const currentLanguage = 'en';
    (window as any).currentLanguage = currentLanguage;
    updateLanguageDropdown();
    applyLanguage('en');
    saveLanguagePreference('en');
};

    (window as any).clearLanguagePreference = async () => {
        console.log('🗑️ Clearing saved language preference');
        try {
            await window.electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        preferredLanguage: null
                    }
                }
            });
            console.log('✅ Language preference cleared');
        } catch (error) {
            console.error('❌ Failed to clear language preference:', error);
        }
    };

    (window as any).syncDropdown = () => {
        console.log('🔄 Manually syncing dropdown to current language:', dependencies.currentLanguage);
        updateLanguageDropdown();
    };

    (window as any).checkDropdown = () => {
        console.log('🔍 Dropdown status:');
        console.log('Current language:', dependencies.currentLanguage);
        console.log('Dropdown value:', dependencies.languageToggle?.value);
        console.log('Dropdown element:', dependencies.languageToggle);
        if (dependencies.languageToggle) {
            console.log('Available options:');
            for (let i = 0; i < dependencies.languageToggle.options.length; i++) {
                console.log(`  ${dependencies.languageToggle.options[i].value}: ${dependencies.languageToggle.options[i].text}`);
            }
        }
    };

    (window as any).forceInitializeDropdown = () => {
        console.log('🔧 Force initializing dropdown...');
        initializeDropdown();
    };

    (window as any).testButtonTranslation = () => {
        console.log('🧪 Testing button translation...');
        console.log('Current language:', dependencies.currentLanguage);
        console.log('Button text (stopped):', getTranslatedButtonText(dependencies.currentLanguage, false));
        console.log('Button text (running):', getTranslatedButtonText(dependencies.currentLanguage, true));
    };

    (window as any).testBidirectionalTranslation = () => {
        console.log('🧪 Testing bidirectional translation...');
        console.log('Current language:', dependencies.currentLanguage);
        console.log('Bidirectional button text (stopped):', getTranslatedBidirectionalButtonText(dependencies.currentLanguage, false));
        console.log('Bidirectional button text (running):', getTranslatedBidirectionalButtonText(dependencies.currentLanguage, true));
    };

    (window as any).refreshBidirectionalStatus = () => {
        console.log('🔄 Refreshing bidirectional status...');
        const isActive = bidirectionalToggleButton?.classList.contains('active') || isBidirectionalActive;
        setBidirectionalStatus(isActive);
    };

    (window as any).testSoundboardTranslation = () => {
        console.log('🧪 Testing soundboard translation...');
        console.log('Current language:', dependencies.currentLanguage);
        const translations = getTranslations(dependencies.currentLanguage);
        console.log('Soundboard title:', translations.soundboard.panel.title);
        console.log('Add sound files:', translations.soundboard.controls.addSoundFiles);
    };

    (window as any).testSettingsTranslation = () => {
        console.log('🧪 Testing settings translation...');
        console.log('Current language:', dependencies.currentLanguage);
        const translations = getTranslations(dependencies.currentLanguage);
        console.log('Settings modal title:', translations.settings.modal.title);
        console.log('Save button:', translations.settings.buttons.save);
        console.log('Cancel button:', translations.settings.buttons.cancel);
    };

    // Note: soundboardManager is not available in this scope as it's initialized later
    // This debug function is commented out - access soundboardManager directly from console if needed
    // (window as any).refreshSoundboardDevices = () => {
    //     console.log('🔄 Refreshing soundboard devices...');
    //     if (soundboardManager && typeof soundboardManager.loadAudioDevices === 'function') {
    //         soundboardManager.loadAudioDevices();
    //     } else {
    //         console.warn('Soundboard manager not available');
    //     }
    // };

}