// TODO: Use IPC to communicate with UsageMonitorService and WhispraApiClient
// For now, this component will show static content

// Temporary type definitions
interface UsageThreshold {
  level: 'safe' | 'warning' | 'critical' | 'exceeded';
  message: string;
  percentage: number;
}

interface UsageData {
  totalUsage: number;
  totalCost: number;
  limit: number;
  percentage: number;
  billingPeriodEnd: string;
}

/**
 * Visual component for displaying API usage progress and warnings
 */
export class UsageDisplay {
  private container: HTMLElement;
  private progressBar: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private usageText: HTMLElement | null = null;
  private warningBanner: HTMLElement | null = null;
  private isInitialized = false;

  constructor(container: HTMLElement) {
    this.container = container;
    // TODO: Initialize IPC communication with UsageMonitorService
    this.initialize();
  }

  /**
   * Initialize the usage display component
   */
  private initialize(): void {
    if (this.isInitialized) return;

    this.render();
    this.setupEventListeners();
    this.isInitialized = true;

    console.log('📊 UsageDisplay component initialized');
  }

  /**
   * Render the usage display UI
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = `
      background: var(--settings-bg-secondary, #1a1a1a);
      border: 1px solid var(--settings-border, #333);
      border-radius: var(--settings-radius-md, 8px);
      padding: var(--settings-spacing-lg, 16px);
      margin-bottom: var(--settings-spacing-lg, 16px);
    `;

    // Title
    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 var(--settings-spacing-md, 12px) 0;
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 600;
    `;
    title.textContent = 'API Usage';
    this.container.appendChild(title);

    // Usage text
    this.usageText = document.createElement('div');
    this.usageText.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.85rem;
      margin-bottom: var(--settings-spacing-sm, 8px);
    `;
    this.usageText.textContent = 'Loading usage data...';
    this.container.appendChild(this.usageText);

    // Progress bar container
    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--settings-spacing-md, 12px);
    `;

    // Progress bar fill
    this.progressFill = document.createElement('div');
    this.progressFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: #4CAF50;
      border-radius: 4px;
      transition: width 0.3s ease, background-color 0.3s ease;
    `;
    this.progressBar.appendChild(this.progressFill);
    this.container.appendChild(this.progressBar);

    // Warning banner (initially hidden)
    this.warningBanner = document.createElement('div');
    this.warningBanner.style.cssText = `
      display: none;
      padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 12px);
      border-radius: var(--settings-radius-sm, 4px);
      font-size: 0.8rem;
      font-weight: 500;
      margin-top: var(--settings-spacing-sm, 8px);
    `;
    this.container.appendChild(this.warningBanner);

    // Billing period info
    const billingInfo = document.createElement('div');
    billingInfo.style.cssText = `
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.75rem;
      margin-top: var(--settings-spacing-sm, 8px);
    `;
    billingInfo.textContent = 'Billing period: Loading...';
    billingInfo.id = 'billing-period-info';
    this.container.appendChild(billingInfo);
  }

  /**
   * Set up event listeners for usage updates
   */
  private setupEventListeners(): void {
    // TODO: Subscribe to usage updates via IPC
    // For now, show placeholder data
    setTimeout(() => {
      this.updateDisplay({
        totalUsage: 2.50,
        totalCost: 2.50,
        limit: 10.00,
        percentage: 25,
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }, 100);
  }

  /**
   * Update the display with new usage data
   */
  private updateDisplay(usage: UsageData): void {
    if (!this.isInitialized) return;

    const threshold: UsageThreshold = { level: 'safe', message: 'Usage is within limits', percentage: 0 };
    
    // Update usage text
    if (this.usageText) {
      this.usageText.textContent = `$${usage.totalUsage.toFixed(2)} used of $${usage.limit.toFixed(2)} limit`;
    }

    // Update progress bar
    if (this.progressFill) {
      this.progressFill.style.width = `${Math.min(threshold.percentage, 100)}%`;
      this.progressFill.style.backgroundColor = this.getProgressColor(threshold.level);
    }

    // Update warning banner
    this.updateWarningBanner(threshold);

    // Update billing period info
    const billingInfo = this.container.querySelector('#billing-period-info');
    if (billingInfo && usage.billingPeriodEnd) {
      const endDate = new Date(usage.billingPeriodEnd);
      billingInfo.textContent = `Billing period ends: ${endDate.toLocaleDateString()}`;
    }

    console.log('📊 Usage display updated:', {
      totalCost: usage.totalCost,
      percentage: threshold.percentage,
      level: threshold.level
    });
  }

  /**
   * Update warning banner based on threshold
   */
  private updateWarningBanner(threshold: UsageThreshold): void {
    if (!this.warningBanner) return;

    if (threshold.level === 'safe') {
      this.warningBanner.style.display = 'none';
    } else {
      this.warningBanner.style.display = 'block';
      this.warningBanner.textContent = threshold.message;

      // Set banner color based on threshold level
      switch (threshold.level) {
        case 'warning':
          this.warningBanner.style.cssText += `
            background: rgba(255, 193, 7, 0.2);
            border: 1px solid rgba(255, 193, 7, 0.5);
            color: #FFC107;
          `;
          break;
        case 'critical':
          this.warningBanner.style.cssText += `
            background: rgba(255, 152, 0, 0.2);
            border: 1px solid rgba(255, 152, 0, 0.5);
            color: #FF9800;
          `;
          break;
        case 'exceeded':
          this.warningBanner.style.cssText += `
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid rgba(244, 67, 54, 0.5);
            color: #F44336;
          `;
          break;
      }
    }
  }

  /**
   * Get progress bar color based on threshold level
   */
  private getProgressColor(level: string): string {
    switch (level) {
      case 'safe':
        return '#4CAF50'; // Green
      case 'warning':
        return '#FFC107'; // Yellow
      case 'critical':
        return '#FF9800'; // Orange
      case 'exceeded':
        return '#F44336'; // Red
      default:
        return '#4CAF50';
    }
  }

  /**
   * Show loading state
   */
  public showLoading(): void {
    if (this.usageText) {
      this.usageText.textContent = 'Loading usage data...';
    }
    if (this.progressFill) {
      this.progressFill.style.width = '0%';
      this.progressFill.style.backgroundColor = '#4CAF50';
    }
    if (this.warningBanner) {
      this.warningBanner.style.display = 'none';
    }
  }

  /**
   * Show error state
   */
  public showError(message: string): void {
    if (this.usageText) {
      this.usageText.textContent = `Error: ${message}`;
      this.usageText.style.color = '#F44336';
    }
    if (this.progressFill) {
      this.progressFill.style.width = '0%';
    }
    if (this.warningBanner) {
      this.warningBanner.style.display = 'block';
      this.warningBanner.textContent = 'Unable to load usage data. Please check your connection.';
      this.warningBanner.style.cssText += `
        background: rgba(244, 67, 54, 0.2);
        border: 1px solid rgba(244, 67, 54, 0.5);
        color: #F44336;
      `;
    }
  }

  /**
   * Refresh usage data
   */
  public async refresh(): Promise<void> {
    this.showLoading();
    try {
      // TODO: Refresh usage via IPC
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      this.updateDisplay({
        totalUsage: Math.random() * 5,
        totalCost: Math.random() * 5,
        limit: 10.00,
        percentage: Math.random() * 50,
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error('Failed to refresh usage data:', error);
      this.showError('Failed to refresh usage data');
    }
  }

  /**
   * Destroy the component and clean up
   */
  public destroy(): void {
    // Note: We don't unsubscribe from usage updates here because
    // the UsageMonitorService manages its own lifecycle
    this.isInitialized = false;
    this.container.innerHTML = '';
  }

  /**
   * Check if component is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}