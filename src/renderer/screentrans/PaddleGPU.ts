/**
 * Setup GPU mode toggle helper function (shared logic)
 */
async function setupGPUModeToggleLogic(
    gpuModeToggle: HTMLElement,
    gpuModeLabel: HTMLElement,
    logPrefix: string = '⚡'
): Promise<void> {
    // Check GPU Paddle status (use quick check for UI responsiveness)
    const quickStatus = await (window as any).electronAPI?.gpuPaddle.quickStatus();
    const hasGPUPaddle = quickStatus?.success && quickStatus.hasGPUPaddle;

    // Get current GPU mode
    const modeResult = await (window as any).electronAPI?.gpuPaddle.getGpuMode();
    const currentMode = modeResult?.mode || 'normal';

    // Set initial toggle state
    const handle = gpuModeToggle.querySelector('.switch-handle') as HTMLElement;
    if (currentMode === 'fast' && hasGPUPaddle) {
        (gpuModeToggle as HTMLElement).style.background = '#4ade80';
        if (handle) handle.style.transform = 'translateX(18px)';
        gpuModeLabel.textContent = 'Fast (GPU)';
    } else {
        (gpuModeToggle as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)';
        if (handle) handle.style.transform = 'translateX(0)';
        gpuModeLabel.textContent = hasGPUPaddle ? 'Normal (CPU)' : 'Not Installed';
    }

    // Add click handler for toggle
    gpuModeToggle.addEventListener('click', async () => {
        // Use quick status check to avoid timeouts during UI interactions
        const quickStatus = await (window as any).electronAPI?.gpuPaddle.quickStatus();
        const isInstalled = quickStatus?.success && quickStatus.hasGPUPaddle;

        console.log(`${logPrefix} GPU Paddle quick status check:`, { isInstalled, fromCache: quickStatus?.fromCache });

        if (!isInstalled) {
            // GPU Paddle not installed - open installation overlay
            console.log(`${logPrefix} GPU Paddle not installed, opening installation overlay`);
            try {
                await (window as any).electronAPI?.gpuPaddle.showOverlay();
            } catch (error) {
                console.error('Failed to show GPU installation overlay:', error);
            }
            return;
        }

        // GPU Paddle is installed - toggle mode
        const currentBg = (gpuModeToggle as HTMLElement).style.background;
        const isNormal = currentBg.includes('rgba');
        const newMode = isNormal ? 'fast' : 'normal';

        try {
            // Update mode
            await (window as any).electronAPI?.gpuPaddle.setGpuMode(newMode);

            // Toggle UI
            if (newMode === 'fast') {
                (gpuModeToggle as HTMLElement).style.background = '#4ade80';
                if (handle) handle.style.transform = 'translateX(18px)';
                gpuModeLabel.textContent = 'Fast (GPU)';
            } else {
                (gpuModeToggle as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)';
                if (handle) handle.style.transform = 'translateX(0)';
                gpuModeLabel.textContent = 'Normal (CPU)';
            }

            console.log(`${logPrefix} GPU mode changed to: ${newMode}`);

            // Notify overlay to update its UI
            (window as any).electronAPI?.send?.('main:gpu-mode-changed', { mode: newMode });
        } catch (error) {
            console.error('Failed to change GPU mode:', error);
        }
    });

    // Listen for GPU mode changes from overlay
    (window as any).electronAPI?.onGpuModeChanged?.((mode: string) => {
        console.log(`${logPrefix} Received GPU mode change from overlay:`, mode);
        if (mode === 'fast') {
            (gpuModeToggle as HTMLElement).style.background = '#4ade80';
            if (handle) handle.style.transform = 'translateX(18px)';
            gpuModeLabel.textContent = 'Fast (GPU)';
        } else {
            (gpuModeToggle as HTMLElement).style.background = 'rgba(255, 255, 255, 0.3)';
            if (handle) handle.style.transform = 'translateX(0)';
            gpuModeLabel.textContent = 'Normal (CPU)';
        }
    });
}

/**
 * Setup GPU mode toggle for screen translation Paddle OCR speed
 */
export async function setupMainGPUModeToggle(): Promise<void> {
    try {
        const gpuModeToggle = document.getElementById('main-gpu-mode-toggle');
        const gpuModeLabel = document.getElementById('main-gpu-mode-label');

        if (!gpuModeToggle || !gpuModeLabel) {
            return;
        }

        await setupGPUModeToggleLogic(gpuModeToggle, gpuModeLabel, '⚡ Main');
    } catch (error) {
        console.error('Failed to setup main GPU mode toggle:', error);
    }
}

/**
 * Setup GPU mode toggle for Whispra Screen page
 */
export async function setupWhispraScreenGPUModeToggle(): Promise<void> {
    try {
        const gpuModeToggle = document.getElementById('whispra-screen-gpu-mode-toggle');
        const gpuModeLabel = document.getElementById('whispra-screen-gpu-mode-label');

        if (!gpuModeToggle || !gpuModeLabel) {
            return;
        }

        await setupGPUModeToggleLogic(gpuModeToggle, gpuModeLabel, '⚡ Whispra Screen');
    } catch (error) {
        console.error('Failed to setup Whispra Screen GPU mode toggle:', error);
    }
}
