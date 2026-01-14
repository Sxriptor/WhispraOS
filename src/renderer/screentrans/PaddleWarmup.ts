import { ctx } from './shared.js';

/**
 * Setup Paddle warmup toggle helper function (shared logic)
 */
async function setupPaddleWarmupToggleLogic(
    warmupToggle: HTMLElement,
    warmupLabel: HTMLElement,
    logPrefix: string = '🏓'
): Promise<void> {
    // Get current warmup setting from config
    const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
    });

    const warmupOnStartup = response?.payload?.uiSettings?.paddleWarmupOnStartup !== false; // Default to true

    // Update global warmup enabled state
    ctx.isPaddleWarmupEnabled = warmupOnStartup;
    console.log(`${logPrefix} Warmup toggle initialized: enabled=${ctx.isPaddleWarmupEnabled}`);

    // Set initial toggle state
    const handle = warmupToggle.querySelector('.switch-handle') as HTMLElement;
    if (warmupOnStartup) {
        (warmupToggle as HTMLElement).style.background = '#4ade80';
        if (handle) handle.style.transform = 'translateX(18px)';
        warmupLabel.textContent = 'On';
    } else {
        (warmupToggle as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)';
        if (handle) handle.style.transform = 'translateX(0)';
        warmupLabel.textContent = 'Off';
    }

    // Add click handler for toggle
    warmupToggle.addEventListener('click', async () => {
        const currentBg = (warmupToggle as HTMLElement).style.background;
        const isOff = currentBg.includes('rgba');
        const newValue = isOff; // If currently off (rgba), turn on (true)

        try {
            // Save to config
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        paddleWarmupOnStartup: newValue
                    }
                }
            });

            // Update global warmup enabled state
            ctx.isPaddleWarmupEnabled = newValue;

            // Toggle UI
            if (newValue) {
                (warmupToggle as HTMLElement).style.background = '#4ade80';
                if (handle) handle.style.transform = 'translateX(18px)';
                warmupLabel.textContent = 'On';
                console.log(`${logPrefix} Paddle startup warmup enabled`);
            } else {
                (warmupToggle as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)';
                if (handle) handle.style.transform = 'translateX(0)';
                warmupLabel.textContent = 'Off';
                console.log(`${logPrefix} Paddle startup warmup disabled`);
            }
        } catch (error) {
            console.error('Failed to change Paddle warmup setting:', error);
        }
    });
}

/**
 * Setup Paddle warmup on startup toggle for Screen Translation page
 */
export async function setupPaddleWarmupToggle(): Promise<void> {
    try {
        const warmupToggle = document.getElementById('paddle-warmup-toggle');
        const warmupLabel = document.getElementById('paddle-warmup-label');

        if (!warmupToggle || !warmupLabel) {
            return;
        }

        await setupPaddleWarmupToggleLogic(warmupToggle, warmupLabel, '🏓 Main');
    } catch (error) {
        console.error('Failed to setup Paddle warmup toggle:', error);
    }
}

/**
 * Setup Paddle warmup on startup toggle for Whispra Screen page
 */
export async function setupWhispraScreenPaddleWarmupToggle(): Promise<void> {
    try {
        const warmupToggle = document.getElementById('whispra-screen-paddle-warmup-toggle');
        const warmupLabel = document.getElementById('whispra-screen-paddle-warmup-label');

        if (!warmupToggle || !warmupLabel) {
            return;
        }

        await setupPaddleWarmupToggleLogic(warmupToggle, warmupLabel, '🏓 Whispra Screen');
    } catch (error) {
        console.error('Failed to setup Whispra Screen Paddle warmup toggle:', error);
    }
}