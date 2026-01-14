const PALETTE = {
    dark: "#0a0a1a",
    light: "#ffffff",

    // Vibrant purple/pink alien body
    skinPrimary: "hsl(280, 75%, 55%)",
    skinHighlight: "hsl(280, 85%, 70%)",
    skinShadow: "hsl(280, 65%, 35%)",

    // Large bright eyes - mint green
    eyeWhite: "hsl(160, 100%, 90%)",
    eyeIris: "hsl(160, 100%, 35%)",
    eyeShine: "#ffffff",

    // Mouth - warm coral
    mouth: "hsl(15, 100%, 55%)",
    mouthInner: "hsl(15, 100%, 40%)",

    // Antenna glow
    antennaGlow: "hsl(280, 100%, 60%)",
} as const;


const SCENE_SIZE = 400;

type AudioAnalyserInstance = {
    getVolume: () => number;
};

declare global {
    interface Window {
        Zdog: any;
        TweenMax: any;
        TweenLite: any;
        Sine: any;
        __whispraInteractive?: {
            createAudioAnalyser?: () => Promise<AudioAnalyserInstance | null>;
            isPTTActive?: () => boolean;
        };
        createAudioAnalyser?: () => Promise<AudioAnalyserInstance | null>;
        isPTTActive?: () => boolean;
    }
}

type CharacterModel = {
    headAnchor: any;
    bodyAnchor: any;
    bodyUpper: any;
    eyeRight: any;
    eyeLeft: any;
    mouth: any;
};

type AnimationState = {
    animationFrameId?: number;
    mouseTimeout?: ReturnType<typeof setTimeout>;
};

export type InteractiveCharacterHandle = {
    dispose: () => void;
};

type ColorPickerState = {
    isOpen: boolean;
    element: HTMLDivElement | null;
};

const createCharacterModel = (illo: any): CharacterModel => {
    const Zdog = window.Zdog;

    const headAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: -50 } });

    // Large round head base
    new Zdog.Hemisphere({
        addTo: headAnchor,
        diameter: 100,
        color: PALETTE.skinPrimary,
        backface: PALETTE.skinShadow,
        fill: true,
        stroke: 0,
    });

    // Head highlight
    new Zdog.Hemisphere({
        addTo: headAnchor,
        diameter: 95,
        color: PALETTE.skinHighlight,
        translate: { x: -15, y: -15, z: 5 },
        fill: true,
        stroke: 0,
    });

    // Left antenna
    const leftAntennaGroup = new Zdog.Group({
        addTo: headAnchor,
        translate: { x: -35, y: -65, z: 0 },
        rotate: { z: -0.3 },
    });

    new Zdog.Shape({
        addTo: leftAntennaGroup,
        stroke: 12,
        color: PALETTE.antennaGlow,
        path: [
            { x: 0, y: 0 },
            { x: 8, y: -45 },
        ],
        closed: false,
    });

    new Zdog.Hemisphere({
        addTo: leftAntennaGroup,
        diameter: 18,
        translate: { x: 8, y: -50 },
        color: PALETTE.antennaGlow,
        fill: true,
        stroke: 2,
    });

    // Right antenna (mirrored)
    const rightAntennaGroup = new Zdog.Group({
        addTo: headAnchor,
        translate: { x: 35, y: -65, z: 0 },
        rotate: { z: 0.3 },
    });

    new Zdog.Shape({
        addTo: rightAntennaGroup,
        stroke: 12,
        color: PALETTE.antennaGlow,
        path: [
            { x: 0, y: 0 },
            { x: -8, y: -45 },
        ],
        closed: false,
    });

    new Zdog.Hemisphere({
        addTo: rightAntennaGroup,
        diameter: 18,
        translate: { x: -8, y: -50 },
        color: PALETTE.antennaGlow,
        fill: true,
        stroke: 2,
    });

    // Left eye socket
    const leftEyeSocket = new Zdog.Group({
        addTo: headAnchor,
        translate: { x: -35, y: -20, z: 55 },
    });

    new Zdog.Hemisphere({
        addTo: leftEyeSocket,
        diameter: 50,
        color: PALETTE.skinShadow,
        fill: true,
        stroke: 0,
    });

    // Left eye white
    new Zdog.Hemisphere({
        addTo: leftEyeSocket,
        diameter: 45,
        color: PALETTE.eyeWhite,
        translate: { z: 3 },
        fill: true,
        stroke: 0,
    });

    // Left iris
    const leftIris = new Zdog.Hemisphere({
        addTo: leftEyeSocket,
        diameter: 28,
        color: PALETTE.eyeIris,
        translate: { y: 3, z: 8 },
        fill: true,
        stroke: 0,
    });

    // Left eye shine
    new Zdog.Hemisphere({
        addTo: leftEyeSocket,
        diameter: 10,
        color: PALETTE.eyeShine,
        translate: { x: -8, y: -8, z: 15 },
        fill: true,
        stroke: 0,
    });

    // Right eye socket
    const rightEyeSocket = new Zdog.Group({
        addTo: headAnchor,
        translate: { x: 35, y: -20, z: 55 },
    });

    new Zdog.Hemisphere({
        addTo: rightEyeSocket,
        diameter: 50,
        color: PALETTE.skinShadow,
        fill: true,
        stroke: 0,
    });

    // Right eye white
    new Zdog.Hemisphere({
        addTo: rightEyeSocket,
        diameter: 45,
        color: PALETTE.eyeWhite,
        translate: { z: 3 },
        fill: true,
        stroke: 0,
    });

    // Right iris
    const rightIris = new Zdog.Hemisphere({
        addTo: rightEyeSocket,
        diameter: 28,
        color: PALETTE.eyeIris,
        translate: { y: 3, z: 8 },
        fill: true,
        stroke: 0,
    });

    // Right eye shine
    new Zdog.Hemisphere({
        addTo: rightEyeSocket,
        diameter: 10,
        color: PALETTE.eyeShine,
        translate: { x: 8, y: -8, z: 15 },
        fill: true,
        stroke: 0,
    });

    // Mouth anchor
    const mouthAnchor = new Zdog.Anchor({
        addTo: headAnchor,
        translate: { y: 35, z: 65 },
        rotate: { x: Zdog.TAU / -45 },
    });

    const mouthGroup = new Zdog.Group({ addTo: mouthAnchor });
    mouthGroup.scale = new Zdog.Vector({ x: 1, y: 1, z: 1 });

    // Mouth outer shape
    new Zdog.Shape({
        addTo: mouthGroup,
        fill: true,
        stroke: 0,
        color: PALETTE.mouthInner,
        path: [
            { x: 0, y: 0 },
            {
                bezier: [
                    { x: 20, y: 0 },
                    { x: 30, y: 12 },
                    { x: 30, y: 24 },
                ],
            },
            {
                bezier: [
                    { x: 30, y: 36 },
                    { x: 20, y: 40 },
                    { x: 0, y: 40 },
                ],
            },
            {
                bezier: [
                    { x: -20, y: 40 },
                    { x: -30, y: 36 },
                    { x: -30, y: 24 },
                ],
            },
            {
                bezier: [
                    { x: -30, y: 12 },
                    { x: -20, y: 0 },
                    { x: 0, y: 0 },
                ],
            },
        ],
    });

    // Mouth rim
    new Zdog.Shape({
        addTo: mouthGroup,
        stroke: 4,
        fill: false,
        color: PALETTE.mouth,
        path: [
            { x: 0, y: 0 },
            {
                bezier: [
                    { x: 20, y: 0 },
                    { x: 30, y: 12 },
                    { x: 30, y: 24 },
                ],
            },
            {
                bezier: [
                    { x: 30, y: 36 },
                    { x: 20, y: 40 },
                    { x: 0, y: 40 },
                ],
            },
            {
                bezier: [
                    { x: -20, y: 40 },
                    { x: -30, y: 36 },
                    { x: -30, y: 24 },
                ],
            },
            {
                bezier: [
                    { x: -30, y: 12 },
                    { x: -20, y: 0 },
                    { x: 0, y: 0 },
                ],
            },
        ],
    });

    // Compact body
    const bodyAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: 60 } });
    const bodyGroup = new Zdog.Group({ addTo: bodyAnchor });

    new Zdog.Hemisphere({
        addTo: bodyGroup,
        diameter: 70,
        color: PALETTE.skinPrimary,
        translate: { y: 10 },
        fill: true,
        stroke: 0,
    });

    new Zdog.Hemisphere({
        addTo: bodyGroup,
        diameter: 65,
        color: PALETTE.skinHighlight,
        translate: { y: 10, x: -12, z: 3 },
        fill: true,
        stroke: 0,
    });

    const bodyUpper = bodyGroup;

    // Left arm
    const leftArmGroup = new Zdog.Group({
        addTo: bodyGroup,
        translate: { x: -45, y: -5 },
        rotate: { x: 0.4, z: 0.3 },
    });

    new Zdog.Hemisphere({
        addTo: leftArmGroup,
        diameter: 20,
        color: PALETTE.skinShadow,
    });

    new Zdog.Hemisphere({
        addTo: leftArmGroup,
        diameter: 18,
        color: PALETTE.skinHighlight,
        translate: { x: -3, y: 0 },
    });

    // Right arm
    const rightArmGroup = new Zdog.Group({
        addTo: bodyGroup,
        translate: { x: 45, y: -5 },
        rotate: { x: 0.4, z: -0.3 },
    });

    new Zdog.Hemisphere({
        addTo: rightArmGroup,
        diameter: 20,
        color: PALETTE.skinShadow,
    });

    new Zdog.Hemisphere({
        addTo: rightArmGroup,
        diameter: 18,
        color: PALETTE.skinHighlight,
        translate: { x: 3, y: 0 },
    });

    // Left leg
    const leftLegGroup = new Zdog.Group({
        addTo: illo,
        translate: { x: -25, y: 130 },
    });

    new Zdog.Hemisphere({
        addTo: leftLegGroup,
        diameter: 24,
        color: PALETTE.skinShadow,
    });

    new Zdog.Hemisphere({
        addTo: leftLegGroup,
        diameter: 22,
        color: PALETTE.skinPrimary,
        translate: { x: -2, y: 2 },
    });

    // Right leg
    const rightLegGroup = new Zdog.Group({
        addTo: illo,
        translate: { x: 25, y: 130 },
    });

    new Zdog.Hemisphere({
        addTo: rightLegGroup,
        diameter: 24,
        color: PALETTE.skinShadow,
    });

    new Zdog.Hemisphere({
        addTo: rightLegGroup,
        diameter: 22,
        color: PALETTE.skinPrimary,
        translate: { x: 2, y: 2 },
    });

    return {
        headAnchor,
        bodyAnchor,
        bodyUpper: bodyGroup,
        eyeRight: rightIris,
        eyeLeft: leftIris,
        mouth: mouthGroup,
    };
};

const getAnalyserFactory = (): (() => Promise<AudioAnalyserInstance | null>) | null => {
    const interactive = (window as any).__whispraInteractive;
    const factory =
        interactive?.createAudioAnalyser ||
        window.createAudioAnalyser;
    return typeof factory === 'function' ? factory : null;
};

const requestExternalAudioAnalyser = async (): Promise<AudioAnalyserInstance | null> => {
    const factory = getAnalyserFactory();
    if (!factory) {
        return null;
    }

    try {
        const analyser = await factory();
        if (analyser && typeof analyser.getVolume === 'function') {
            return analyser;
        }
    } catch (error) {
        console.warn('[interactive-character] Failed to acquire audio analyser:', error);
    }

    return null;
};

let hasLoggedPTTWarning = false;

const getPTTState = (): boolean => {
    const interactive = (window as any).__whispraInteractive;
    const getter =
        interactive?.isPTTActive ||
        window.isPTTActive;

    if (typeof getter === 'function') {
        try {
            const active = !!getter();
            hasLoggedPTTWarning = false;
            return active;
        } catch (error) {
            if (!hasLoggedPTTWarning) {
                console.warn('[interactive-character] Failed to read PTT state:', error);
                hasLoggedPTTWarning = true;
            }
        }
    }

    return false;
};

const initializeAnimation = (
    canvas: HTMLCanvasElement,
    animationState: AnimationState,
): (() => void) | null => {
    if (!window.Zdog || !window.TweenMax) {
        return null;
    }

    const { Zdog, TweenMax, TweenLite, Sine } = window;
    const FIXED_WIDTH = 783;
    const FIXED_HEIGHT = 783;
    const FIXED_ZOOM = Math.min(FIXED_WIDTH, FIXED_HEIGHT) / SCENE_SIZE;
    
    const illo = new Zdog.Illustration({
        element: canvas,
        resize: false,
        zoom: FIXED_ZOOM,
        dragRotate: true,
    });

    const model = createCharacterModel(illo);
    let audioAnalyser: AudioAnalyserInstance | null = null;
    let analyserBootstrapTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasLoggedAnalyserWarning = false;
    let isStopped = false;

    const bootstrapAnalyser = async () => {
        if (isStopped) {
            return;
        }

        try {
            const analyser = await requestExternalAudioAnalyser();
            if (analyser) {
                audioAnalyser = analyser;
                hasLoggedAnalyserWarning = false;
                analyserBootstrapTimeout = null;
                return;
            }
        } catch (error) {
            if (!hasLoggedAnalyserWarning) {
                console.warn('[interactive-character] Error creating analyser:', error);
                hasLoggedAnalyserWarning = true;
            }
        }

        if (analyserBootstrapTimeout) {
            clearTimeout(analyserBootstrapTimeout);
        }
        analyserBootstrapTimeout = setTimeout(bootstrapAnalyser, 1000);
    };

    bootstrapAnalyser();

    const animationManager = (() => {
        // Gentle body breathing
        TweenMax.to(model.bodyUpper.scale, 0.6, {
            x: 1.05,
            y: 1.02,
            repeat: -1,
            yoyo: true,
            ease: Sine.easeInOut,
        });

        const blink = () => {
            const randomDelay = Math.random() * 6 + 2;
            TweenMax.to([model.eyeRight.scale, model.eyeLeft.scale], 0.1, {
                y: 0.1,
                repeat: 1,
                yoyo: true,
                delay: randomDelay,
                onComplete: blink,
            });
        };
        blink();

        return {
            stop: () => TweenMax.killAll(),
        };
    })();

    const removeEventListeners = (() => {
        let lookAroundTimeout: ReturnType<typeof setTimeout> | null = null;

        const lookAround = () => {
            const randomY = ((Math.random() * 40 - 20) / 360) * Zdog.TAU;
            const randomDuration = Math.random() + 0.5;
            TweenLite.to(model.headAnchor.rotate, randomDuration, {
                y: randomY,
                ease: Sine.easeInOut,
            });
            TweenLite.to(model.bodyAnchor.rotate, randomDuration, {
                y: randomY / 2,
                ease: Sine.easeInOut,
                onComplete: () => {
                    lookAroundTimeout = setTimeout(lookAround, Math.random() * 1000 + 500);
                },
            });
        };
        lookAround();

        const watchPlayer = (x: number, y: number) => {
            const rect = canvas.getBoundingClientRect();
            const rotX = (x - (rect.left + rect.width / 2)) / Zdog.TAU;
            const rotY = -(y - (rect.top + rect.height / 2)) / Zdog.TAU;
            TweenMax.to(model.headAnchor.rotate, 0.5, {
                x: rotY / 100,
                y: -rotX / 100,
                ease: Sine.easeOut,
            });
            TweenMax.to(model.bodyAnchor.rotate, 0.5, {
                x: rotY / 200,
                y: -rotX / 200,
                ease: Sine.easeOut,
            });
        };

        const resetAll = () => {
            TweenLite.to(model.headAnchor.rotate, 0.5, {
                x: 0,
                y: 0,
                ease: Sine.easeOut,
            });
            TweenLite.to(model.bodyAnchor.rotate, 0.5, {
                x: 0,
                y: 0,
                ease: Sine.easeOut,
            });
            lookAround();
        };

        const handleMouseMove = (e: MouseEvent) => {
            TweenLite.killTweensOf(model.headAnchor.rotate);
            TweenLite.killTweensOf(model.bodyAnchor.rotate);
            if (lookAroundTimeout) {
                clearTimeout(lookAroundTimeout);
                lookAroundTimeout = null;
            }
            watchPlayer(e.clientX, e.clientY);
            if (animationState.mouseTimeout) {
                clearTimeout(animationState.mouseTimeout);
            }
            animationState.mouseTimeout = setTimeout(resetAll, 2000);
        };

        document.body.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.body.removeEventListener('mousemove', handleMouseMove);
            if (lookAroundTimeout) {
                clearTimeout(lookAroundTimeout);
            }
        };
    })();

    let smoothedMouthOpen = 0;

    const animate = () => {
        let mouthOpen = 0;

        if (audioAnalyser) {
            try {
                const volume = audioAnalyser.getVolume();
                if (Number.isFinite(volume)) {
                    const scaled = Math.pow(volume * 12, 1.1);
                    mouthOpen = Math.min(1, scaled);
                }
            } catch (error) {
                if (!hasLoggedAnalyserWarning) {
                    console.warn('[interactive-character] Failed to read analyser volume:', error);
                    hasLoggedAnalyserWarning = true;
                }
            }
        } else if (!analyserBootstrapTimeout) {
            analyserBootstrapTimeout = setTimeout(bootstrapAnalyser, 1000);
        }

        const pttActive = getPTTState();
        if (pttActive) {
            mouthOpen = Math.max(mouthOpen, 0.35);
        }

        smoothedMouthOpen += (mouthOpen - smoothedMouthOpen) * 0.25;

        if (model.mouth && model.mouth.scale) {
            model.mouth.scale.y = 0.3 + smoothedMouthOpen * 1.2;
            model.mouth.scale.z = 1 + smoothedMouthOpen * 0.3;
        }

        illo.updateRenderGraph();
        if (!isStopped) {
            animationState.animationFrameId = requestAnimationFrame(animate);
        }
    };
    animate();

    return () => {
        isStopped = true;
        if (animationState.animationFrameId) {
            cancelAnimationFrame(animationState.animationFrameId);
            delete animationState.animationFrameId;
        }
        if (window.TweenMax) {
            window.TweenMax.killAll();
        }
        if (analyserBootstrapTimeout) {
            clearTimeout(analyserBootstrapTimeout);
        }
        removeEventListeners();
        animationManager.stop();
    };
};

const ensureScriptsLoaded = (onReady: () => void) => {
    const scripts = [
        'https://unpkg.com/zdog@1/dist/zdog.dist.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/2.1.3/TweenMax.min.js',
    ];

    let loaded = 0;
    const handleLoaded = () => {
        loaded += 1;
        if (loaded === scripts.length) {
            onReady();
        }
    };

    scripts.forEach((src) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        if (existing) {
            const state = existing.getAttribute('data-loaded');
            if (state === 'loaded') {
                handleLoaded();
            } else if (state === 'loading') {
                existing.addEventListener('load', handleLoaded, { once: true });
            } else {
                if (src.includes('zdog') && window.Zdog) {
                    existing.setAttribute('data-loaded', 'loaded');
                    handleLoaded();
                } else if (src.includes('TweenMax') && window.TweenMax) {
                    existing.setAttribute('data-loaded', 'loaded');
                    handleLoaded();
                } else {
                    existing.setAttribute('data-loaded', 'loading');
                    existing.addEventListener('load', () => {
                        existing.setAttribute('data-loaded', 'loaded');
                        handleLoaded();
                    }, { once: true });
                }
            }
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.setAttribute('data-loaded', 'loading');
        script.addEventListener('load', () => {
            script.setAttribute('data-loaded', 'loaded');
            handleLoaded();
        }, { once: true });
        script.addEventListener('error', () => {
            console.error(`Failed to load script: ${src}`);
        });
        document.body.appendChild(script);
    });
};

export const mountInteractiveCharacter = (
    container: HTMLElement,
): InteractiveCharacterHandle => {
    container.innerHTML = `
        <div class="hero-container">
            <div class="character-container">
                <canvas class="interactive-character-canvas" aria-hidden="true"></canvas>
            </div>
        </div>
    `;

    const canvas = container.querySelector('canvas');
    if (!canvas) {
        throw new Error('Failed to create interactive character canvas');
    }
    const canvasEl = canvas as HTMLCanvasElement;
    canvasEl.width = 783;
    canvasEl.height = 783;
    canvasEl.style.background = 'transparent';
    canvasEl.style.width = '220px';
    canvasEl.style.height = '220px';

    const animationState: AnimationState = {};
    let cleanupAnimation: (() => void) | null = null;
    let initializationTimeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const attemptInitialization = () => {
        if (disposed) return;
        const cleanup = initializeAnimation(canvas as HTMLCanvasElement, animationState);
        if (cleanup) {
            cleanupAnimation = cleanup;
        } else {
            initializationTimeout = setTimeout(attemptInitialization, 50);
        }
    };

    ensureScriptsLoaded(() => {
        if (!disposed) {
            attemptInitialization();
        }
    });

    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            if (initializationTimeout) {
                clearTimeout(initializationTimeout);
            }
            if (animationState.mouseTimeout) {
                clearTimeout(animationState.mouseTimeout);
            }
            if (cleanupAnimation) {
                cleanupAnimation();
            }
            container.innerHTML = '';
        },
    };
};
