// TODO: Use IPC to communicate with ManagedApiRouter and UsageMonitorService
// For now, this component will show static content

// Temporary type definitions
interface UsageThreshold {
  level: 'safe' | 'warning' | 'critical' | 'exceeded';
  message: string;
}

/**
 * Warning banner component for managed API usage and errors
 */
class ManagedApiWarningBanner {
  private container: HTMLElement;
  private isVisible = false;

  constructor(container: HTMLElement) {
    this.container = container;
    // TODO: Initialize IPC communication with services
    this.initialize();
  }

  /**
   * Initialize the warning banner
   */
  private initialize(): void {
    this.container.style.cssText = `
      display: none;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
    `;

    // TODO: Subscribe to usage updates via IPC
    // For now, show no warnings (safe state)
  }

  /**
   * Update warning state based on current usage
   */
  private updateWarningState(): void {
    // TODO: Check usage thresholds via IPC
    // For now, assume safe state
    this.hide();
  }

  /**
   * Show threshold-based warning
   */
  private showThresholdWarning(threshold: UsageThreshold): void {
    let backgroundColor: string;
    let borderColor: string;
    let textColor: string;
    let icon: string;

    switch (threshold.level) {
      case 'warning':
        backgroundColor = 'rgba(255, 193, 7, 0.1)';
        borderColor = 'rgba(255, 193, 7, 0.5)';
        textColor = '#FFC107';
        icon = '⚠️';
        break;
      case 'critical':
        backgroundColor = 'rgba(255, 152, 0, 0.1)';
        borderColor = 'rgba(255, 152, 0, 0.5)';
        textColor = '#FF9800';
        icon = '🚨';
        break;
      case 'exceeded':
        backgroundColor = 'rgba(244, 67, 54, 0.1)';
        borderColor = 'rgba(244, 67, 54, 0.5)';
        textColor = '#F44336';
        icon = '🚫';
        break;
      default:
        return;
    }

    this.container.style.cssText = `
      display: block;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
      background: ${backgroundColor};
      border: 1px solid ${borderColor};
      color: ${textColor};
    `;

    // Create warning content
    const content = document.createElement('div');
    content.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: var(--settings-spacing-sm);
    `;

    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.fontSize = '1.2em';

    const messageContainer = document.createElement('div');
    messageContainer.style.flex = '1';

    const message = document.createElement('div');
    message.textContent = threshold.message;
    messageContainer.appendChild(message);

    // Add action buttons for exceeded state
    if (threshold.level === 'exceeded') {
      const actions = document.createElement('div');
      actions.style.cssText = `
        margin-top: var(--settings-spacing-sm);
        display: flex;
        gap: var(--settings-spacing-sm);
      `;

      const switchButton = document.createElement('button');
      switchButton.textContent = 'Switch to Personal Keys';
      switchButton.style.cssText = `
        padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
        background: ${textColor};
        color: white;
        border: none;
        border-radius: var(--settings-radius-sm);
        font-size: 0.8rem;
        cursor: pointer;
        font-weight: 500;
      `;
      switchButton.addEventListener('click', () => this.handleSwitchToPersonal());

      const dismissButton = document.createElement('button');
      dismissButton.textContent = 'Dismiss';
      dismissButton.style.cssText = `
        padding: var(--settings-spacing-xs) var(--settings-spacing-sm);
        background: transparent;
        color: ${textColor};
        border: 1px solid ${borderColor};
        border-radius: var(--settings-radius-sm);
        font-size: 0.8rem;
        cursor: pointer;
        font-weight: 500;
      `;
      dismissButton.addEventListener('click', () => this.hide());

      actions.appendChild(switchButton);
      actions.appendChild(dismissButton);
      messageContainer.appendChild(actions);
    }

    content.appendChild(iconEl);
    content.appendChild(messageContainer);

    this.container.innerHTML = '';
    this.container.appendChild(content);
    this.isVisible = true;
  }

  /**
   * Show subscription error
   */
  public showSubscriptionError(message: string): void {
    this.container.style.cssText = `
      display: block;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.5);
      color: #F44336;
    `;

    this.container.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: var(--settings-spacing-sm);">
        <span style="font-size: 1.2em;">❌</span>
        <div>
          <div>${message}</div>
          <div style="margin-top: var(--settings-spacing-xs); font-size: 0.85em; opacity: 0.8;">
            Please check your subscription status or switch to personal API keys.
          </div>
        </div>
      </div>
    `;

    this.isVisible = true;
  }

  /**
   * Show API error
   */
  public showApiError(message: string): void {
    this.container.style.cssText = `
      display: block;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.5);
      color: #F44336;
    `;

    this.container.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: var(--settings-spacing-sm);">
        <span style="font-size: 1.2em;">⚠️</span>
        <div>
          <div>API Error: ${message}</div>
          <div style="margin-top: var(--settings-spacing-xs); font-size: 0.85em; opacity: 0.8;">
            There was an issue with the managed API service. Please try again or switch to personal keys.
          </div>
        </div>
      </div>
    `;

    this.isVisible = true;
  }

  /**
   * Show trial status with usage information
   */
  public showTrialStatus(usage: { totalCost: number; usageLimit: number; planTier?: string }): void {
    const used = usage.totalCost || 0;
    const limit = usage.usageLimit || 5;
    const percentage = Math.min((used / limit) * 100, 100);
    
    // Determine if this is trial or pro with managed API
    const isUltra = usage.planTier === 'ultra';
    const isTrial = !usage.planTier || usage.planTier === 'trial';
    
    this.container.style.cssText = `
      display: block;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
      background: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.5);
      color: #2196F3;
    `;

    // Create banner content
    const content = document.createElement('div');
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: var(--settings-spacing-md);
    `;

    const iconEl = document.createElement('span');
    iconEl.textContent = isTrial ? '🎁' : '✨';
    iconEl.style.fontSize = '1.2em';

    const infoContainer = document.createElement('div');
    infoContainer.style.flex = '1';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = isTrial ? 'Trial Mode' : (isUltra ? 'Ultra Plan' : 'Pro Plan');
    title.style.fontWeight = '600';

    const usageText = document.createElement('div');
    usageText.textContent = `$${used.toFixed(2)} / $${limit.toFixed(2)}`;
    usageText.style.cssText = `
      font-size: 0.95em;
      font-weight: 600;
    `;

    titleRow.appendChild(title);
    titleRow.appendChild(usageText);

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 6px;
    `;
    
    const progressFill = document.createElement('div');
    const color = percentage >= 90 ? '#f44336' : percentage >= 70 ? '#ff9800' : '#4caf50';
    progressFill.style.cssText = `
      width: ${percentage}%;
      height: 100%;
      background: ${color};
      transition: width 0.3s ease;
    `;
    
    progressBar.appendChild(progressFill);

    const description = document.createElement('div');
    description.style.cssText = `
      font-size: 0.85em;
      opacity: 0.9;
    `;
    
    if (isTrial) {
      description.textContent = `You're on a trial with $${limit.toFixed(2)} usage included. Upgrade for more.`;
    } else if (isUltra) {
      description.textContent = `Using managed API with $${limit.toFixed(2)} monthly usage included.`;
    } else {
      description.textContent = `Using managed API with $${limit.toFixed(2)} monthly usage included.`;
    }

    infoContainer.appendChild(titleRow);
    infoContainer.appendChild(progressBar);
    infoContainer.appendChild(description);

    content.appendChild(iconEl);
    content.appendChild(infoContainer);

    this.container.innerHTML = '';
    this.container.appendChild(content);
    this.isVisible = true;
  }

  /**
   * Show success message
   */
  public showSuccess(message: string): void {
    this.container.style.cssText = `
      display: block;
      padding: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-lg);
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.4;
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.5);
      color: #4CAF50;
    `;

    this.container.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--settings-spacing-sm);">
        <span style="font-size: 1.2em;">✅</span>
        <div>${message}</div>
      </div>
    `;

    this.isVisible = true;

    // Auto-hide success messages after 3 seconds
    setTimeout(() => {
      this.hide();
    }, 3000);
  }

  /**
   * Hide the warning banner
   */
  public hide(): void {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.isVisible = false;
  }

  /**
   * Check if banner is visible
   */
  public isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Handle switching to personal mode
   */
  private async handleSwitchToPersonal(): Promise<void> {
    try {
      // TODO: Switch to personal mode via IPC
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      this.showSuccess('Switched to personal API keys mode');
      
      // Trigger a re-render of the parent component
      window.dispatchEvent(new CustomEvent('managed-api-mode-changed', { 
        detail: { mode: 'personal' } 
      }));
      
    } catch (error) {
      console.error('Failed to switch to personal mode:', error);
      this.showApiError('Failed to switch to personal mode');
    }
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.hide();
    // Note: We don't unsubscribe from usage updates here because
    // the UsageMonitorService manages its own lifecycle
  }
}

export { ManagedApiWarningBanner };
export default ManagedApiWarningBanner;