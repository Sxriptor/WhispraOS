/**
 * Side Button Component
 * A reusable half-off-screen button that appears on all pages
 */

export class SideButton {
  private button: HTMLButtonElement | null = null;
  private isVisible: boolean = true;

  constructor() {
    console.log('SideButton constructor called');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.createButton();
        this.setupEventListeners();
      });
    } else {
      this.createButton();
      this.setupEventListeners();
    }
    
    console.log('SideButton initialization complete');
  }

  /**
   * Create the side button element and add it to the DOM
   */
  private createButton(): void {
    console.log('Creating side button...');
    
    // Remove existing button if it exists
    const existingButton = document.getElementById('side-button');
    if (existingButton) {
      existingButton.remove();
      console.log('Removed existing side button');
    }

    // Create the button element
    this.button = document.createElement('button');
    this.button.id = 'side-button';
    this.button.className = 'side-button';
    this.button.title = 'Quick Access';
    this.button.innerHTML = '◀';

    console.log('Side button element created:', this.button);

    // Add styles directly to ensure they're applied
    this.applyStyles();

    // Add to body so it appears on all pages
    document.body.appendChild(this.button);
    console.log('Side button added to DOM');
    
    // Verify it's in the DOM
    const verification = document.getElementById('side-button');
    console.log('Side button verification:', verification ? 'Found in DOM' : 'NOT found in DOM');
  }

  /**
   * Apply styles directly to the button
   */
  private applyStyles(): void {
    if (!this.button) return;

    const styles = {
      position: 'fixed',
      right: '-25px', // Half off screen (25px hidden, 25px visible)
      top: '50vh', // Dead center vertically using viewport height
      transform: 'translateY(-50%)', // Center the button on the 50vh point
      width: '25px',
      height: '200px',
      background: 'linear-gradient(135deg, #007acc, #0056b3)',
      border: 'none',
      borderRadius: '25px 0 0 25px',
      color: 'white',
      fontSize: '20px',
      cursor: 'pointer',
      zIndex: '999999', // Extremely high z-index to ensure it's on top
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '-2px 0 10px rgba(0, 122, 204, 0.3)',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      outline: 'none',
      pointerEvents: 'auto' // Ensure it can be clicked
    };

    // Apply all styles
    Object.assign(this.button.style, styles);
  }

  /**
   * Setup event listeners for the button
   */
  private setupEventListeners(): void {
    if (!this.button) return;

    // Click handler
    this.button.addEventListener('click', this.handleClick.bind(this));

    // Hover effects
    this.button.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.button.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Active state
    this.button.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.button.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * Handle button click
   */
  private async handleClick(): Promise<void> {
    if (!this.button) return;

    // Add click animation
    this.button.style.transform = 'translateY(-50%) scale(0.9)';
    
    setTimeout(() => {
      if (this.button) {
        this.button.style.transform = 'translateY(-50%)';
      }
    }, 150);

    // Trigger the action (for now, toggle debug console)
    try {
      // Call the global toggle function if it exists
      if ((window as any).toggleDebugConsole) {
        await (window as any).toggleDebugConsole();
      } else {
        console.log('Side button clicked - no action defined yet');
      }
    } catch (error) {
      console.error('Error handling side button click:', error);
    }
  }

  /**
   * Handle mouse enter (hover)
   */
  private handleMouseEnter(): void {
    if (!this.button) return;
    
    this.button.style.right = '-20px';
    this.button.style.background = 'linear-gradient(135deg, #0088ff, #0066cc)';
    this.button.style.boxShadow = '-3px 0 15px rgba(0, 122, 204, 0.5)';
  }

  /**
   * Handle mouse leave
   */
  private handleMouseLeave(): void {
    if (!this.button) return;
    
    this.button.style.right = '-25px';
    this.button.style.background = 'linear-gradient(135deg, #007acc, #0056b3)';
    this.button.style.boxShadow = '-2px 0 10px rgba(0, 122, 204, 0.3)';
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(): void {
    if (!this.button) return;
    this.button.style.transform = 'translateY(-50%) scale(0.95)';
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    if (!this.button) return;
    this.button.style.transform = 'translateY(-50%)';
  }

  /**
   * Show the button
   */
  public show(): void {
    if (this.button) {
      this.button.style.display = 'flex';
      this.isVisible = true;
    }
  }

  /**
   * Hide the button
   */
  public hide(): void {
    if (this.button) {
      this.button.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Toggle button visibility
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set custom click handler
   */
  public setClickHandler(handler: () => void | Promise<void>): void {
    if (this.button) {
      // Remove existing click listeners
      this.button.replaceWith(this.button.cloneNode(true));
      this.button = document.getElementById('side-button') as HTMLButtonElement;
      
      // Add new click handler
      this.button.addEventListener('click', async () => {
        await this.handleClick();
        await handler();
      });
      
      // Re-setup other event listeners
      this.setupEventListeners();
    }
  }

  /**
   * Destroy the button and clean up
   */
  public destroy(): void {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }
}

// Export a singleton instance
export const sideButton = new SideButton();