/**
 * Theme Manager
 * Handles theme switching and persistence
 */

export type ThemeId = 'default' | 'neo-brutalism' | 'hacker' | 'corporate';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
}

export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private static initPromise: Promise<void> | null = null;
  private currentTheme: ThemeId = 'default';
  private themes: Theme[] = [
    {
      id: 'default',
      name: 'Default',
      description: 'Clean, modern interface with subtle colors'
    },
    {
      id: 'neo-brutalism',
      name: 'Neo-Brutalism',
      description: 'Raw, bold, unapologetic design with vibrant primaries'
    },
    {
      id: 'hacker',
      name: 'Hacker',
      description: 'Terminal-inspired aesthetic with matrix green and glitch effects'
    },
    {
      id: 'corporate',
      name: 'Corporate',
      description: 'Functional minimalism with corporate precision — calm, sterile, and efficient'
    }
  ];

  private constructor() {
    // Don't apply theme in constructor - wait for initialization
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
      // Initialize asynchronously
      if (!ThemeManager.initPromise) {
        ThemeManager.initPromise = ThemeManager.instance.initialize();
      }
    }
    return ThemeManager.instance;
  }

  /**
   * Initialize theme manager by loading saved theme
   */
  private async initialize(): Promise<void> {
    await this.loadTheme();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Get all available themes
   */
  public getThemes(): Theme[] {
    return [...this.themes];
  }

  /**
   * Get current theme
   */
  public getCurrentTheme(): ThemeId {
    return this.currentTheme;
  }

  /**
   * Set theme
   */
  public async setTheme(themeId: ThemeId): Promise<void> {
    if (!this.themes.find(t => t.id === themeId)) {
      console.error(`Theme ${themeId} not found`);
      return;
    }

    this.currentTheme = themeId;
    this.applyTheme(themeId);
    await this.saveTheme();
  }

  /**
   * Apply theme to document
   */
  private applyTheme(themeId: ThemeId): void {
    const body = document.body;
    const html = document.documentElement;

    // Remove all theme classes
    body.classList.remove('theme-default', 'theme-neo-brutalism', 'theme-hacker', 'theme-corporate');
    html.classList.remove('theme-default', 'theme-neo-brutalism', 'theme-hacker', 'theme-corporate');
    
    // Remove data-theme attribute
    body.removeAttribute('data-theme');
    html.removeAttribute('data-theme');

    // Apply new theme
    if (themeId === 'neo-brutalism') {
      body.classList.add('theme-neo-brutalism');
      html.classList.add('theme-neo-brutalism');
      body.setAttribute('data-theme', 'neo-brutalism');
      html.setAttribute('data-theme', 'neo-brutalism');
    } else if (themeId === 'hacker') {
      body.classList.add('theme-hacker');
      html.classList.add('theme-hacker');
      body.setAttribute('data-theme', 'hacker');
      html.setAttribute('data-theme', 'hacker');
    } else if (themeId === 'corporate') {
      body.classList.add('theme-corporate');
      html.classList.add('theme-corporate');
      body.setAttribute('data-theme', 'corporate');
      html.setAttribute('data-theme', 'corporate');
    } else {
      body.classList.add('theme-default');
      html.classList.add('theme-default');
      body.setAttribute('data-theme', 'default');
      html.setAttribute('data-theme', 'default');
    }

    // Save theme to localStorage for overlay access
    try {
      localStorage.setItem('whispra-theme', themeId);
      console.log('Theme saved to localStorage:', themeId);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  }

  /**
   * Load theme from storage
   */
  private async loadTheme(): Promise<void> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (response.success && response.payload?.uiSettings?.theme) {
        const themeId = response.payload.uiSettings.theme as ThemeId;
        if (this.themes.find(t => t.id === themeId)) {
          this.currentTheme = themeId;
          return;
        }
      }
    } catch (error) {
      console.error('Error loading theme from config:', error);
    }

    // Fallback to localStorage
    try {
      const savedTheme = localStorage.getItem('whispra-theme') as ThemeId;
      if (savedTheme && this.themes.find(t => t.id === savedTheme)) {
        this.currentTheme = savedTheme;
        console.log('Loaded theme from localStorage:', savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme from localStorage:', error);
    }
  }

  /**
   * Save theme to storage
   */
  private async saveTheme(): Promise<void> {
    try {
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { 
          uiSettings: { 
            theme: this.currentTheme 
          } 
        }
      });
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }
}

// Make ThemeManager available globally
(window as any).ThemeManager = ThemeManager;
