import { ctx } from './shared.js';
import { updateScreenTranslationConfig } from './PaddleTriggerConfig.js';
import { updateScreenTranslationKeybindDisplay } from '../../renderer/translationHelpers.js';

type DesktopSource = {
    id: string;
    name?: string;
    display_id?: string | number;
};

type SelectDisplayOptions = {
    skipConfigUpdate?: boolean;
};

const getDisplayId = (source: DesktopSource): string => source.display_id?.toString() || source.id;

const buildDisplayTitle = (source: DesktopSource, index: number): string => {
    let title = `Display ${index + 1}`;
    if (source.name) {
        title += ` - ${source.name}`;
    }
    if (source.display_id) {
        title += ` (ID: ${source.display_id})`;
    }
    return title;
};

const renderDisplaySelector = (container: HTMLDivElement | null, sources: DesktopSource[]): void => {
    if (!container) return;
    container.innerHTML = '';

    sources.forEach((source, index) => {
        const rect = document.createElement('div');
        rect.className = 'display-rectangle';
        const displayId = getDisplayId(source);
        rect.setAttribute('data-display-id', displayId);
        rect.setAttribute('title', buildDisplayTitle(source, index));

        const numberDiv = document.createElement('div');
        numberDiv.className = 'display-number';
        numberDiv.textContent = (index + 1).toString();

        const labelDiv = document.createElement('div');
        labelDiv.className = 'display-label';
        labelDiv.textContent = `Display ${index + 1}`;

        rect.appendChild(numberDiv);
        rect.appendChild(labelDiv);

        rect.addEventListener('click', () => selectDisplay(displayId));
        container.appendChild(rect);
    });
};

const renderFallbackDisplay = (container: HTMLDivElement | null): void => {
    if (!container) return;
    container.innerHTML = `
        <div class="display-rectangle selected" data-display-id="primary" title="Primary Display">
            <div class="display-number">1</div>
            <div class="display-label">Primary</div>
        </div>
    `;
};

const updateRectangleSelection = (container: HTMLDivElement | null, displayId: string): void => {
    if (!container) return;
    const rectangles = container.querySelectorAll('.display-rectangle');
    rectangles.forEach(rect => rect.classList.remove('selected'));
    const selectedRect = container.querySelector<HTMLElement>(`.display-rectangle[data-display-id="${displayId}"]`);
    if (selectedRect) {
        selectedRect.classList.add('selected');
    }
};

export async function loadAvailableDisplays(): Promise<void> {
    try {
        // Get screen sources from desktopCapturer
        const sources = await (window as any).electronAPI.invoke('get-desktop-sources', ['screen']);

        // Get displays and sort them consistently with the backend
        const displays = await (window as any).electronAPI.invoke('get-displays');
        const sortedDisplays = displays.sort((a: any, b: any) => {
            if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
            return a.bounds.y - b.bounds.y;
        });

        if (sources && sources.length > 0) {
            console.log('📺 Loading displays from desktopCapturer sources:', sources);
            console.log('📺 Sorted displays by position:', sortedDisplays.map((d: any) => ({ id: d.id, bounds: d.bounds })));

            // Sort sources to match the display order
            const sortedSources = sources.sort((a: any, b: any) => {
                const aDisplay = sortedDisplays.find((d: any) => d.id.toString() === a.display_id?.toString());
                const bDisplay = sortedDisplays.find((d: any) => d.id.toString() === b.display_id?.toString());

                if (!aDisplay && !bDisplay) return 0;
                if (!aDisplay) return 1;
                if (!bDisplay) return -1;

                if (aDisplay.bounds.x !== bDisplay.bounds.x) return aDisplay.bounds.x - bDisplay.bounds.x;
                return aDisplay.bounds.y - bDisplay.bounds.y;
            });

            console.log('📺 Sorted sources by display position:', sortedSources.map((s: any) => ({ id: s.id, display_id: s.display_id })));

            // Update dropdown selector using sorted sources order
            const screenTranslationDisplaySelect = ctx.screenTranslationDisplaySelect;
            if (screenTranslationDisplaySelect) {
                screenTranslationDisplaySelect.innerHTML = '';
                sortedSources.forEach((source: DesktopSource, index: number) => {
                    const option = document.createElement('option');
                    option.value = getDisplayId(source);
                    option.textContent = buildDisplayTitle(source, index);
                    screenTranslationDisplaySelect.appendChild(option);
                });
            }

            // Update visual display selectors (legacy + whispra)
            renderDisplaySelector(ctx.screenTranslationDisplaySelector, sortedSources);
            renderDisplaySelector(ctx.whispraScreenDisplaySelector, sortedSources);

            const existingSelection = ctx.screenTranslationDisplaySelect?.value || null;
            const defaultDisplayId = existingSelection || (sortedSources[0] ? getDisplayId(sortedSources[0]) : null);

            if (defaultDisplayId) {
                selectDisplay(defaultDisplayId, { skipConfigUpdate: Boolean(existingSelection) });
            }

            ctx.logToDebug(`📺 Loaded ${sources.length} displays from desktopCapturer sources`);
        }
    } catch (error) {
        ctx.logToDebug(`❌ Failed to load displays: ${error}`);
        // Fallback to primary display option
        const screenTranslationDisplaySelect = ctx.screenTranslationDisplaySelect;
        if (screenTranslationDisplaySelect) {
            screenTranslationDisplaySelect.innerHTML = '<option value="primary">Primary Display</option>';
        }
        renderFallbackDisplay(ctx.screenTranslationDisplaySelector);
        renderFallbackDisplay(ctx.whispraScreenDisplaySelector);
        selectDisplay('primary', { skipConfigUpdate: true });
    }
}

// Expose loadAvailableDisplays to screentrans modules
// Use a function to defer assignment until __screenTransCtx is initialized
// ES modules execute imports before other code, so we need to wait for renderer.ts to initialize __screenTransCtx
function exposeToScreenTransCtx() {
    if ((window as any).__screenTransCtx) {
        (window as any).__screenTransCtx.loadAvailableDisplays = loadAvailableDisplays;
        (window as any).__screenTransCtx.updateScreenTranslationKeybindDisplay = updateScreenTranslationKeybindDisplay;
    } else {
        // If __screenTransCtx doesn't exist yet, try again on the next tick
        // This ensures renderer.ts has time to initialize it
        setTimeout(exposeToScreenTransCtx, 0);
    }
}
// Start checking immediately - will retry if needed
exposeToScreenTransCtx();

// Function to handle display selection from visual selector
export function selectDisplay(displayId: string, options: SelectDisplayOptions = {}): void {
    console.log(`📺 User selected display ID: ${displayId}`);

    updateRectangleSelection(ctx.screenTranslationDisplaySelector, displayId);
    updateRectangleSelection(ctx.whispraScreenDisplaySelector, displayId);

    // Update hidden dropdown to maintain compatibility
    const screenTranslationDisplaySelect = ctx.screenTranslationDisplaySelect;
    if (screenTranslationDisplaySelect) {
        screenTranslationDisplaySelect.value = displayId;
    }

    // Update configuration
    if (!options.skipConfigUpdate) {
        updateScreenTranslationConfig();
    }

    ctx.logToDebug(`📺 Selected display: ${displayId}`);
}