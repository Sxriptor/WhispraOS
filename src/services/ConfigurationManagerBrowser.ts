/**
 * Browser-compatible configuration manager for renderer process
 * Uses localStorage instead of file system
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: any;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): any {
    try {
      const stored = localStorage.getItem('whispra-config');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load configuration from localStorage:', error);
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): any {
    return {
      managedApiConfig: {
        mode: 'personal',
        lastModeSwitch: new Date().toISOString(),
        usageWarningsEnabled: true,
        autoSwitchOnLimit: false
      }
    };
  }

  getConfig(): any {
    return { ...this.config };
  }

  updateConfig(updates: any): void {
    this.config = { ...this.config, ...updates };
    try {
      localStorage.setItem('whispra-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save configuration to localStorage:', error);
    }
  }
}
