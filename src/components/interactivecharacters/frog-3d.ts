const PALETTE = {
    dark: "#0a0a1a",
    light: "#ffffff",

    // Frog green skin tones
    skin: "hsl(100, 45%, 50%)",
    skinHighlight: "hsl(100, 55%, 65%)",
    skinShadow: "hsl(100, 40%, 35%)",

    // Inside of mouth
    flesh: "hsl(350, 60%, 35%)",

    // Tears removed
    tears: "transparent",
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

const createCharacterModel = (illo: any): CharacterModel => {
    const Zdog = window.Zdog;

    const headAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: -80 } });

    new Zdog.Hemisphere({
        addTo: headAnchor,
        stroke: 5,
        diameter: 140,
        color: PALETTE.skin,
        backface: PALETTE.skin,
    });

    new Zdog.Hemisphere({
        addTo: headAnchor,
        stroke: 5,
        diameter: 135,
        color: PALETTE.skinHighlight,
        backface: PALETTE.skinHighlight,
        translate: { y: -3, z: 2 },
    });

    const eyeAnchor = new Zdog.Anchor({
        addTo: headAnchor,
        translate: { x: -45, y: -50, z: 70 },
        rotate: { y: Zdog.TAU / 12 },
    });
    const eyeGroup = new Zdog.Group({ addTo: eyeAnchor });

    new Zdog.Hemisphere({
        addTo: eyeGroup,
        stroke: 0,
        diameter: 55,
        color: PALETTE.skinShadow,
        backface: PALETTE.skinShadow,
    });

    new Zdog.Hemisphere({
        addTo: eyeGroup,
        stroke: 0,
        diameter: 50,
        color: PALETTE.skin,
        backface: PALETTE.skin,
        translate: { y: -2, z: 3 },
    });

    const eye = new Zdog.Hemisphere({
        addTo: eyeGroup,
        fill: true,
        stroke: 2,
        diameter: 35,
        color: PALETTE.dark,
        backface: PALETTE.dark,
        translate: { y: 3, z: 1 },
    });

    new Zdog.Hemisphere({
        addTo: eyeGroup,
        fill: true,
        stroke: 0,
        diameter: 14,
        color: PALETTE.light,
        backface: PALETTE.light,
        translate: { x: -8, y: 8, z: 4 },
    });

    const eyeLeft = eyeAnchor.copyGraph({
        translate: { x: 45, y: -50, z: 70 },
        rotate: { y: Zdog.TAU / -12 },
    });

    const mouthAnchor = new Zdog.Anchor({
        addTo: headAnchor,
        translate: { y: 35, z: 70 },
        rotate: { x: Zdog.TAU / -12 },
    });

    const mouthGroup = new Zdog.Group({ addTo: mouthAnchor });
    mouthGroup.scale = new Zdog.Vector({ x: 1, y: 0.3, z: 1 });

    new Zdog.Shape({
        addTo: mouthGroup,
        stroke: 4,
        fill: true,
        color: PALETTE.skinShadow,
        path: [
            { x: -50, y: 0, z: 0 },
            {
                bezier: [
                    { x: -40, y: -5, z: 0 },
                    { x: 0, y: -8, z: 0 },
                    { x: 50, y: 0, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: 0, y: 12, z: 0 },
                    { x: -40, y: 15, z: 0 },
                    { x: -50, y: 0, z: 0 },
                ],
            },
        ],
    });

    new Zdog.Shape({
        addTo: mouthGroup,
        stroke: 0,
        fill: true,
        color: PALETTE.flesh,
        path: [
            { x: -48, y: 2, z: 2 },
            {
                bezier: [
                    { x: -35, y: -2, z: 2 },
                    { x: 0, y: -5, z: 2 },
                    { x: 48, y: 2, z: 2 },
                ],
            },
            {
                bezier: [
                    { x: 0, y: 10, z: 2 },
                    { x: -35, y: 12, z: 2 },
                    { x: -48, y: 2, z: 2 },
                ],
            },
        ],
    });

    const bodyAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: 40 } });

    new Zdog.Hemisphere({
        addTo: bodyAnchor,
        stroke: 5,
        diameter: 160,
        color: PALETTE.skin,
        backface: PALETTE.skin,
    });

    const bodyUpper = new Zdog.Hemisphere({
        addTo: bodyAnchor,
        stroke: 5,
        diameter: 155,
        color: PALETTE.skinHighlight,
        backface: PALETTE.skinHighlight,
        translate: { y: -4, z: 3 },
    });

    const armGroup = new Zdog.Group({
        addTo: bodyAnchor,
        translate: { x: -65, y: -20, z: 0 },
        rotate: { z: Zdog.TAU / -8 },
    });

    new Zdog.Hemisphere({
        addTo: armGroup,
        stroke: 0,
        diameter: 35,
        color: PALETTE.skin,
        backface: PALETTE.skin,
    });

    new Zdog.Hemisphere({
        addTo: armGroup,
        stroke: 0,
        diameter: 32,
        color: PALETTE.skinHighlight,
        backface: PALETTE.skinHighlight,
        translate: { y: -1, z: 2 },
    });

    const armLeft = armGroup.copyGraph({
        translate: { x: 65, y: -20, z: 0 },
        rotate: { z: Zdog.TAU / 8 },
    });

    const legRightGroup = new Zdog.Group({
        addTo: bodyAnchor,
        translate: { x: -50, y: 70, z: -10 },
        rotate: { x: Zdog.TAU / 6 },
    });

    new Zdog.Hemisphere({
        addTo: legRightGroup,
        stroke: 3,
        diameter: 48,
        color: PALETTE.skin,
        backface: PALETTE.skin,
    });

    new Zdog.Hemisphere({
        addTo: legRightGroup,
        stroke: 3,
        diameter: 45,
        color: PALETTE.skinHighlight,
        backface: PALETTE.skinHighlight,
        translate: { y: -2, z: 2 },
    });

    const footRightGroup = new Zdog.Group({
        addTo: legRightGroup,
        translate: { x: 35, y: 8, z: 0 },
        rotate: { z: Zdog.TAU / 6 },
    });

    new Zdog.Shape({
        addTo: footRightGroup,
        stroke: 2,
        fill: true,
        color: PALETTE.skin,
        path: [
            { x: 0, y: 0, z: 0 },
            { x: 38, y: -8, z: 0 },
            { x: 45, y: 0, z: 0 },
            { x: 42, y: 12, z: 0 },
            { x: 28, y: 16, z: 0 },
            { x: 12, y: 14, z: 0 },
            { x: 0, y: 8, z: 0 },
        ],
    });

    new Zdog.Shape({
        addTo: footRightGroup,
        stroke: 0,
        fill: true,
        color: PALETTE.skinHighlight,
        translate: { z: 1 },
        path: [
            { x: 0, y: 0, z: 0 },
            { x: 38, y: -8, z: 0 },
            { x: 45, y: 0, z: 0 },
            { x: 42, y: 12, z: 0 },
            { x: 28, y: 16, z: 0 },
            { x: 12, y: 14, z: 0 },
            { x: 0, y: 8, z: 0 },
        ],
    });

    const legLeftGroup = legRightGroup.copyGraph({
        translate: { x: 50, y: 70, z: -10 },
    });

    legLeftGroup.children.forEach((child: any) => {
        child.scale.x = -1;
    });

    return {
        headAnchor,
        bodyAnchor,
        bodyUpper,
        eyeRight: eye,
        eyeLeft: eyeLeft.children[0],
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
        TweenMax.to(model.bodyUpper.scale, 0.5, {
            x: 0.95,
            y: 0.97,
            repeat: -1,
            yoyo: true,
            ease: Sine.easeInOut,
        });

        const blink = () => {
            const randomDelay = Math.random() * 6 + 2;
            TweenMax.to([model.eyeRight.scale, model.eyeLeft.scale], 0.07, {
                y: 0,
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
            model.mouth.scale.y = 0.2 + smoothedMouthOpen * 1.4;
            model.mouth.scale.z = 1 + smoothedMouthOpen * 0.4;
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
