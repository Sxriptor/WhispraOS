/**
 * Themes tab implementation
 * Allows users to select and preview different UI themes
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';
import { ThemeManager, Theme } from '../../themes/ThemeManager.js';
import { getTranslations } from '../../../renderer/i18n.js';

export class ThemesTab extends BaseSettingsTab {
  public readonly id = 'themes';
  public readonly title = 'Themes';
  public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
  public readonly order = 6;

  private themeManager: ThemeManager;
  private selectedTheme: string = 'default';
  private themeElements: Map<string, HTMLElement> = new Map();

  constructor() {
    super();
    this.themeManager = ThemeManager.getInstance();
    this.selectedTheme = this.themeManager.getCurrentTheme();
  }

  /**
   * Get translations for current language
   */
  private getThemesTranslations(): any {
    const currentLanguage = (window as any).currentLanguage || 'en';
    const t = getTranslations(currentLanguage);
    return t.settingsModal?.themes || {};
  }

  /**
   * Render the Themes tab content
   */
  public render(): HTMLElement {
    const t = this.getThemesTranslations();
    
    const container = this.createElement('div', 'themes-tab');
    
    const header = this.createElement('h2', 'settings-section-header');
    header.textContent = t.title || 'Theme Selection';
    container.appendChild(header);

    const description = this.createElement('p', 'settings-section-description');
    description.textContent = t.description || 'Choose your preferred interface theme. Changes apply immediately.';
    container.appendChild(description);

    const themesContainer = this.createElement('div');
    themesContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--settings-spacing-lg);
      margin-top: var(--settings-spacing-lg);
    `;

    const themes = this.themeManager.getThemes();
    themes.forEach(theme => {
      const themeCard = this.createThemeCard(theme);
      themesContainer.appendChild(themeCard);
      this.themeElements.set(theme.id, themeCard);
    });

    container.appendChild(themesContainer);

    // Update selected state
    this.updateSelectedTheme();

    return container;
  }

  /**
   * Create theme card
   */
  private createThemeCard(theme: Theme): HTMLElement {
    const t = this.getThemesTranslations();
    
    const card = this.createElement('div');
    card.className = 'theme-card';
    
    // Get current theme to apply theme-specific styles
    const currentTheme = document.documentElement.getAttribute('data-theme') || 
                        document.body.getAttribute('data-theme') || 
                        'default';
    
    // For neo-brutalism, force white background and black text
    if (currentTheme === 'neo-brutalism') {
      card.style.cssText = `
        border: 2px solid #000000;
        border-radius: 0;
        padding: var(--settings-spacing-lg);
        cursor: pointer;
        transition: all 0.2s ease;
        background: #FFFFFF !important;
        background-color: #FFFFFF !important;
        color: #000000 !important;
      `;
    } else {
      card.style.cssText = `
        border: 2px solid var(--settings-border);
        border-radius: var(--settings-radius-md);
        padding: var(--settings-spacing-lg);
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--settings-surface);
      `;
    }

    // Set initial selected state - always use neo-brutalism style (blue border)
    if (theme.id === this.selectedTheme) {
      card.style.borderColor = '#00D9FF';
      card.style.borderWidth = '3px';
      card.style.boxShadow = '0 0 0 3px rgba(0, 217, 255, 0.2)';
    }

    card.addEventListener('click', () => {
      // Immediately update visual state for instant feedback
      this.selectedTheme = theme.id;
      this.updateSelectedTheme();
      // Then apply the theme change
      this.selectTheme(theme.id);
    });

    card.addEventListener('mouseenter', () => {
      if (theme.id !== this.selectedTheme) {
        // Use blue color for hover (neo-brutalism style)
        card.style.borderColor = '#00D9FF';
        card.style.transform = 'translateY(-2px)';
      }
    });

    card.addEventListener('mouseleave', () => {
      if (theme.id !== this.selectedTheme) {
        card.style.borderColor = 'var(--settings-border)';
        card.style.transform = 'translateY(0)';
      }
    });

    const title = this.createElement('h3');
    if (currentTheme === 'neo-brutalism') {
      title.style.cssText = `
        margin: 0 0 var(--settings-spacing-sm) 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #000000 !important;
      `;
    } else {
      title.style.cssText = `
        margin: 0 0 var(--settings-spacing-sm) 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--settings-text);
      `;
    }
    title.textContent = theme.name;
    card.appendChild(title);

    const description = this.createElement('p');
    if (currentTheme === 'neo-brutalism') {
      description.style.cssText = `
        margin: 0 0 var(--settings-spacing-md) 0;
        color: #000000 !important;
        font-size: 0.9rem;
        line-height: 1.5;
      `;
    } else {
      description.style.cssText = `
        margin: 0 0 var(--settings-spacing-md) 0;
        color: var(--settings-text-secondary);
        font-size: 0.9rem;
        line-height: 1.5;
      `;
    }
    description.textContent = theme.description;
    card.appendChild(description);

    // Add preview or badge
    const badge = this.createElement('div');
    
    // For neo-brutalism theme, only show badge for active theme
    if (currentTheme === 'neo-brutalism') {
      if (theme.id === this.selectedTheme) {
        badge.style.cssText = `
          display: inline-block;
          padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
          background: #00D9FF;
          color: #FFFFFF;
          border-radius: 0;
          font-size: 0.8rem;
          font-weight: 600;
          margin-top: var(--settings-spacing-sm);
        `;
        badge.textContent = `✓ ${t.active || 'Active'}`;
        card.appendChild(badge);
      }
      // Don't add badge for non-active themes in neo-brutalism
    } else {
      badge.style.cssText = `
        display: inline-block;
        padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
        background: ${theme.id === this.selectedTheme ? 'var(--settings-primary-color)' : 'var(--settings-border)'};
        color: ${theme.id === this.selectedTheme ? 'white' : 'var(--settings-text-secondary)'};
        border-radius: var(--settings-radius-sm);
        font-size: 0.8rem;
        font-weight: 600;
        margin-top: var(--settings-spacing-sm);
      `;
      badge.textContent = theme.id === this.selectedTheme ? `✓ ${t.active || 'Active'}` : (t.select || 'Select');
      card.appendChild(badge);
    }

    return card;
  }

  /**
   * Select theme
   */
  private async selectTheme(themeId: string): Promise<void> {
    // Update internal state
    this.selectedTheme = themeId;
    
    // Apply the theme change
    try {
      await this.themeManager.setTheme(themeId as any);
      
      // Update visual state after theme is applied
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.updateSelectedTheme();
      });
    } catch (error) {
      console.error('[ThemesTab] Error selecting theme:', error);
      // Still update visual state even if theme change fails
      this.updateSelectedTheme();
    }
  }

  /**
   * Update selected theme visual state
   */
  private updateSelectedTheme(): void {
    const t = this.getThemesTranslations();
    
    // Get current theme to apply theme-specific styles
    const currentTheme = document.documentElement.getAttribute('data-theme') || 
                        document.body.getAttribute('data-theme') || 
                        'default';
    
    this.themeElements.forEach((card, themeId) => {
      // Find all potential badges - look for divs that might be badges
      const allDivs = card.querySelectorAll('div');
      let badge: HTMLElement | null = null;
      
      // Find the badge by checking if it has badge-like styling or content
      for (let i = allDivs.length - 1; i >= 0; i--) {
        const div = allDivs[i] as HTMLElement;
        const style = div.getAttribute('style') || '';
        const text = div.textContent || '';
        
        // Check if this div looks like a badge (has inline-block, padding, or contains Active/Select)
        if (style.includes('display: inline-block') || 
            style.includes('padding') || 
            text.includes('✓') || 
            text.includes('Active') || 
            text.includes('Select')) {
          badge = div;
          break;
        }
      }
      
      if (themeId === this.selectedTheme) {
        // This is the active theme - always use neo-brutalism style (blue border and badge)
        card.style.borderColor = '#00D9FF';
        card.style.borderWidth = '3px';
        card.style.boxShadow = '0 0 0 3px rgba(0, 217, 255, 0.2)';
        
        // Always show blue badge for active theme
        if (badge) {
          badge.style.cssText = `
            display: inline-block !important;
            padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
            background: #00D9FF !important;
            color: #FFFFFF !important;
            border-radius: 0;
            font-size: 0.8rem;
            font-weight: 600;
            margin-top: var(--settings-spacing-sm);
          `;
          badge.textContent = `✓ ${t.active || 'Active'}`;
        } else {
          // Create badge if it doesn't exist
          const newBadge = this.createElement('div');
          newBadge.style.cssText = `
            display: inline-block;
            padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
            background: #00D9FF;
            color: #FFFFFF;
            border-radius: 0;
            font-size: 0.8rem;
            font-weight: 600;
            margin-top: var(--settings-spacing-sm);
          `;
          newBadge.textContent = `✓ ${t.active || 'Active'}`;
          card.appendChild(newBadge);
        }
      } else {
        // This is NOT the active theme - no badge, standard border
        card.style.borderColor = 'var(--settings-border)';
        card.style.borderWidth = '2px';
        card.style.boxShadow = 'none';
        
        // Always remove badge for non-active themes (neo-brutalism style)
        if (badge) {
          badge.remove(); // Remove it from DOM
        }
      }
    });
  }

  /**
   * Called when tab becomes active
   */
  public onActivate(): void {
    super.onActivate();
    this.selectedTheme = this.themeManager.getCurrentTheme();
    if (this.container) {
      this.updateSelectedTheme();
    }
  }

  /**
   * Save theme preference
   */
  public async onSave(): Promise<boolean> {
    try {
      await this.themeManager.setTheme(this.selectedTheme as any);
      return true;
    } catch (error) {
      console.error('Error saving theme:', error);
      return false;
    }
  }

  /**
   * Validate theme selection
   */
  public validate(): boolean {
    return this.themeManager.getThemes().some(t => t.id === this.selectedTheme);
  }

  /**
   * Get validation errors
   */
  public getValidationErrors(): string[] {
    if (!this.validate()) {
      return ['Invalid theme selected'];
    }
    return [];
  }
}
