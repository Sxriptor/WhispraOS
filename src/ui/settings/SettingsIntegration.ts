/**
 * Settings integration helper
 * Manages the new tabbed settings modal and tab registration
 */

import { SettingsModal } from './SettingsModal.js';
import { ApiKeysTab } from './tabs/ApiKeysTab.js';
import { ModelsTab } from './tabs/ModelsTab.js';
import { AccountTab } from './tabs/AccountTab.js';
import { KeybindsTab } from './tabs/KeybindsTab.js';
import { ThemesTab } from './tabs/ThemesTab.js';
import { LanguageLibraryTab } from './tabs/LanguageLibraryTab.js';

export class SettingsIntegration {
  private static instance: SettingsIntegration | null = null;
  private settingsModal: SettingsModal | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsIntegration {
    if (!SettingsIntegration.instance) {
      SettingsIntegration.instance = new SettingsIntegration();
    }
    return SettingsIntegration.instance;
  }

  /**
   * Initialize the settings modal with all tabs
   */
  public initializeSettings(): void {
    if (this.settingsModal) {
      return; // Already initialized
    }

    this.settingsModal = new SettingsModal();

    // Register all tabs
    this.settingsModal.registerTab({
      id: 'account',
      title: 'Account',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      component: AccountTab,
      order: 0
    });

    this.settingsModal.registerTab({
      id: 'api-keys',
      title: 'API Keys',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>',
      component: ApiKeysTab,
      order: 1
    });

    this.settingsModal.registerTab({
      id: 'keybinds',
      title: 'Keybinds',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/><path d="M9 6v12"/></svg>',
      component: KeybindsTab,
      order: 2
    });

    this.settingsModal.registerTab({
      id: 'models',
      title: 'Models',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/></svg>',
      component: ModelsTab,
      order: 3
    });

    this.settingsModal.registerTab({
      id: 'themes',
      title: 'Themes',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
      component: ThemesTab,
      order: 4
    });

    this.settingsModal.registerTab({
      id: 'language-library',
      title: 'Language Library',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h6"/></svg>',
      component: LanguageLibraryTab,
      order: 5
    });
  }

  /**
   * Show settings modal with optional default tab
   */
  public showSettings(defaultTab: string = 'api-keys'): void {
    this.initializeSettings();
    
    // Force subscription check when opening settings - THIS WILL SIGN OUT IF EXPIRED
    console.log('🔍 [Settings] Opening settings - forcing subscription check (will sign out if expired)...');
    if ((window as any).electronAPI?.forceSubscriptionCheck) {
      (window as any).electronAPI.forceSubscriptionCheck().then((result: any) => {
        console.log('🔍 [Settings] Force subscription check result:', result);
        if (!result.success) {
          console.error('❌ [Settings] Force subscription check failed:', result.error);
        } else if (!result.hasAccess) {
          console.log('🚪 [Settings] User has no access - sign out should have been triggered');
        } else {
          console.log('✅ [Settings] User has access');
        }
      }).catch((error: any) => {
        console.error('❌ [Settings] Failed to force subscription check on settings open:', error);
      });
    } else {
      console.warn('⚠️ [Settings] forceSubscriptionCheck not available, falling back to checkUserAccess');
      // Fallback to regular check
      if ((window as any).electronAPI?.checkUserAccess) {
        (window as any).electronAPI.checkUserAccess().then((result: any) => {
          console.log('🔍 [Settings] Subscription check result (fallback):', result);
        }).catch((error: any) => {
          console.error('❌ [Settings] Failed to check subscription status:', error);
        });
      }
    }
    
    if (this.settingsModal) {
      this.settingsModal.show();
      
      // Switch to default tab if specified
      if (defaultTab) {
        // Small delay to ensure modal is rendered
        setTimeout(() => {
          if (this.settingsModal) {
            this.settingsModal.switchTab(defaultTab);
          }
        }, 100);
      }
    }
  }

  /**
   * Hide settings modal
   */
  public hideSettings(): void {
    if (this.settingsModal) {
      this.settingsModal.hide();
    }
  }

  /**
   * Check if settings modal is open
   */
  public isSettingsOpen(): boolean {
    return this.settingsModal ? this.settingsModal.isOpen() : false;
  }

  /**
   * Get the settings modal instance
   */
  public getSettingsModal(): SettingsModal | null {
    return this.settingsModal;
  }
}

// Global function for backward compatibility and easy access
export function openSettings(defaultTab: string = 'api-keys'): void {
  const integration = SettingsIntegration.getInstance();
  integration.showSettings(defaultTab);
}

// Make it available globally for renderer.ts
(window as any).openSettings = openSettings;
(window as any).SettingsIntegration = SettingsIntegration;