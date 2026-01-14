type PaletteType = {
    dark: string;
    light: string;
    skin: string;
    skinHighlight: string;
    skinShadow: string;
    flesh: string;
    tears: string;
};

const createPalette = (hue: number = 210): PaletteType => ({
    dark: "#0a0a1a",
    light: "#ffffff",
    skin: `hsl(${hue}, 60%, 60%)`,
    skinHighlight: `hsl(${hue}, 70%, 75%)`,
    skinShadow: `hsl(${hue}, 50%, 40%)`,
    flesh: "hsl(350, 60%, 35%)",
    tears: "transparent",
});

let PALETTE = createPalette();


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
    lastTap: number;
};

type PartyModeState = {
    isActive: boolean;
    clickCount: number;
    lastClick: number;
    hueOffset: number;
    wobblePhase: number;
    bouncePhase: number;
    spinSpeed: number;
    intervalId: ReturnType<typeof setInterval> | null;
};

type JumpscareState = {
    isActive: boolean;
    timeoutId: ReturnType<typeof setTimeout> | null;
};

const createCharacterModel = (illo: any): CharacterModel => {
    const Zdog = window.Zdog;

    const headAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: -42 } });
    new Zdog.Group({ addTo: headAnchor });
    new Zdog.Shape({
        addTo: headAnchor.children[0],
        stroke: 228,
        color: PALETTE.skinShadow,
        path: [{ x: -4.5 }, { x: 4.5 }],
    });
    new Zdog.Shape({
        addTo: headAnchor.children[0],
        stroke: 216,
        color: PALETTE.skin,
        translate: { x: -4.5 },
    });

    const eyeAnchor = new Zdog.Anchor({
        addTo: headAnchor,
        translate: { x: -66, y: -30, z: 84 },
        rotate: { y: Zdog.TAU / 11 },
    });
    const eyeGroup = new Zdog.Group({ addTo: eyeAnchor });

    new Zdog.Shape({
        addTo: eyeGroup,
        fill: true,
        stroke: 0,
        color: PALETTE.skinShadow,
        scale: 1.15,
        path: [
            { x: 0, y: 0, z: 3 },
            {
                bezier: [
                    { x: 24, y: 0, z: 3 },
                    { x: 36, y: 21, z: 0 },
                    { x: 36, y: 36, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: 36, y: 51, z: 0 },
                    { x: 24, y: 63, z: 3 },
                    { x: 0, y: 63, z: 3 },
                ],
            },
            {
                bezier: [
                    { x: -24, y: 63, z: 3 },
                    { x: -36, y: 51, z: 0 },
                    { x: -36, y: 36, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: -36, y: 21, z: 0 },
                    { x: -24, y: 0, z: 3 },
                    { x: 0, y: 0, z: 3 },
                ],
            },
        ],
    });

    const eye = new Zdog.Shape({
        addTo: eyeGroup,
        fill: true,
        stroke: 3,
        color: PALETTE.dark,
        translate: { y: 6 },
        path: [
            { x: 0, y: 0, z: 3 },
            {
                bezier: [
                    { x: 24, y: 0, z: 3 },
                    { x: 36, y: 21, z: 0 },
                    { x: 36, y: 36, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: 36, y: 51, z: 0 },
                    { x: 24, y: 63, z: 3 },
                    { x: 0, y: 63, z: 3 },
                ],
            },
            {
                bezier: [
                    { x: -24, y: 63, z: 3 },
                    { x: -36, y: 51, z: 0 },
                    { x: -36, y: 36, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: -36, y: 21, z: 0 },
                    { x: -24, y: 0, z: 3 },
                    { x: 0, y: 0, z: 3 },
                ],
            },
        ],
    });

    eye.copy({
        addTo: eye,
        fill: true,
        color: PALETTE.light,
        scale: 0.4,
        translate: { x: -9, y: 9, z: 3 },
    });

    new Zdog.Shape({
        addTo: eyeAnchor,
        fill: true,
        stroke: 0,
        color: PALETTE.tears,
        translate: { y: 63 },
        path: [
            { x: 0, y: 0, z: 0 },
            { x: 18, y: 0, z: 0 },
            { arc: [{ x: 18, y: 45, z: 0 }, { x: 18, y: 70, z: -60 }] },
            {
                bezier: [
                    { x: 18, y: 80, z: -80 },
                    { x: 18, y: 80, z: -100 },
                    { x: 0, y: 80, z: -100 },
                ],
            },
            {
                bezier: [
                    { x: -18, y: 80, z: -100 },
                    { x: -18, y: 80, z: -80 },
                    { x: -18, y: 70, z: -60 },
                ],
            },
            { arc: [{ x: -18, y: 45, z: 0 }, { x: -18, y: 0, z: 0 }] },
            { x: 0, y: 0, z: 0 },
        ],
    });

    const eyeLeft = eyeAnchor.copyGraph({
        translate: { x: 66, y: -30, z: 84 },
        rotate: { y: Zdog.TAU / -11 },
    });

    const mouthAnchor = new Zdog.Anchor({
        addTo: headAnchor,
        translate: { y: 36, z: 96 },
        rotate: { x: Zdog.TAU / -45 },
    });
    const mouthGroup = new Zdog.Group({ addTo: mouthAnchor });
    mouthGroup.scale = new Zdog.Vector({ x: 1, y: 1, z: 1 });
    new Zdog.Shape({
        addTo: mouthGroup,
        stroke: 3,
        fill: true,
        color: PALETTE.skinShadow,
        scale: 1.1,
        translate: { y: -5 },
        path: [
            { x: 0, y: 0 },
            {
                bezier: [
                    { x: 18, y: 0, z: 0 },
                    { x: 30, y: 21, z: -6 },
                    { x: 30, y: 30, z: -6 },
                ],
            },
            {
                bezier: [
                    { x: 30, y: 51, z: -6 },
                    { x: 24, y: 33, z: -3 },
                    { x: 0, y: 33, z: -3 },
                ],
            },
            {
                bezier: [
                    { x: -24, y: 33, z: -3 },
                    { x: -30, y: 51, z: -6 },
                    { x: -30, y: 30, z: -6 },
                ],
            },
            {
                bezier: [
                    { x: -30, y: 21, z: -6 },
                    { x: -18, y: 0, z: 0 },
                    { x: 0, y: 0, z: 0 },
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
            { x: 0, y: 0 },
            {
                bezier: [
                    { x: 18, y: 0, z: 0 },
                    { x: 30, y: 21, z: -6 },
                    { x: 30, y: 30, z: -6 },
                ],
            },
            {
                bezier: [
                    { x: 30, y: 51, z: -6 },
                    { x: 24, y: 33, z: -3 },
                    { x: 0, y: 33, z: -3 },
                ],
            },
            {
                bezier: [
                    { x: -24, y: 33, z: -3 },
                    { x: -30, y: 51, z: -6 },
                    { x: -30, y: 30, z: -6 },
                ],
            },
            {
                bezier: [
                    { x: -30, y: 21, z: -6 },
                    { x: -18, y: 0, z: 0 },
                    { x: 0, y: 0, z: 0 },
                ],
            },
        ],
    });
    new Zdog.Shape({
        addTo: mouthGroup,
        stroke: 7,
        fill: false,
        color: PALETTE.light,
        translate: { y: 25, z: -6 },
        path: [
            { x: 0, y: 0, z: 0 },
            {
                bezier: [
                    { x: 24, y: 0, z: 0 },
                    { x: 24, y: 10, z: -7 },
                    { x: 24, y: 10, z: -7 },
                ],
            },
            { x: 26, y: 13, z: -8 },
            {
                bezier: [
                    { x: 26, y: 13, z: -7 },
                    { x: 16, y: 5, z: 0 },
                    { x: 0, y: 5, z: 0 },
                ],
            },
            {
                bezier: [
                    { x: -16, y: 5, z: 0 },
                    { x: -26, y: 13, z: -7 },
                    { x: -26, y: 13, z: -8 },
                ],
            },
            { x: -24, y: 10, z: -7 },
            {
                bezier: [
                    { x: -24, y: 10, z: -7 },
                    { x: -24, y: 0, z: 0 },
                    { x: 0, y: 0, z: 0 },
                ],
            },
        ],
    });

    const lipGroup = new Zdog.Group({ addTo: mouthAnchor });
    new Zdog.Shape({
        addTo: lipGroup,
        stroke: 7,
        fill: false,
        translate: { y: 8, z: -4 },
        color: PALETTE.skinShadow,
        rotate: { x: Zdog.TAU / -45 },
        path: [
            { x: -33, y: 30, z: -6 },
            {
                bezier: [
                    { x: -35, y: 40, z: -6 },
                    { x: -30, y: 40, z: -4 },
                    { x: -30, y: 40, z: -4 },
                ],
            },
        ],
        closed: false,
    });
    new Zdog.Shape({
        addTo: lipGroup,
        stroke: 7,
        fill: false,
        translate: { y: 4, z: -1 },
        color: PALETTE.skinHighlight,
        path: [
            { x: -33, y: 30, z: -6 },
            {
                bezier: [
                    { x: -35, y: 40, z: -6 },
                    { x: -30, y: 40, z: -4 },
                    { x: -30, y: 40, z: -4 },
                ],
            },
        ],
        closed: false,
    });
    const lipLeftGroup = lipGroup.copyGraph();
    lipLeftGroup.children.forEach((lip: any) => {
        lip.scale.x = -1;
    });

    const bodyAnchor = new Zdog.Anchor({ addTo: illo, translate: { y: 81 } });
    const bodyGroup = new Zdog.Group({ addTo: bodyAnchor });
    const bodyUpperGroup = new Zdog.Group({ addTo: bodyGroup });
    const bodyUpper = new Zdog.Shape({
        addTo: bodyUpperGroup,
        stroke: 63,
        fill: true,
        color: PALETTE.skinShadow,
        translate: { y: 6 },
    });
    bodyUpper.copy({ stroke: 57, color: PALETTE.skin, translate: { x: -3 } });

    const armGroup = new Zdog.Group({
        addTo: bodyAnchor,
        translate: { z: -6 },
        rotate: { x: Zdog.TAU / 16 },
    });
    const arm = new Zdog.Shape({
        addTo: armGroup,
        stroke: 30,
        color: PALETTE.skinShadow,
        path: [
            { x: -35, y: -6, z: 0 },
            {
                bezier: [
                    { x: -33, y: -6, z: 0 },
                    { x: -45, y: -6, z: 0 },
                    { x: -54, y: 30, z: 0 },
                ],
            },
        ],
        closed: false,
    });
    arm.copy({ stroke: 27, color: PALETTE.skin });
    const armLeft = armGroup.copyGraph({
        rotate: { x: Zdog.TAU / 16, y: Zdog.TAU / 2 },
    });
    armLeft.children[1].stroke = 21;
    armLeft.children[1].translate = { x: 1, y: 1 };

    const bodyLowerGroup = new Zdog.Group({ addTo: bodyGroup, translate: { y: 30 } });
    new Zdog.Shape({
        addTo: bodyLowerGroup,
        stroke: 69,
        fill: true,
        color: PALETTE.skinShadow,
        translate: { y: 6 },
        path: [{ x: -4.5 }, { x: 4.5 }],
    }).copy({
        stroke: 66,
        color: PALETTE.skin,
        translate: { x: -3, y: 4.5 },
        path: [{ x: -4.5 }, { x: 4.5 }],
    });

    const legGroup = new Zdog.Group({
        addTo: illo,
        translate: { y: 141, z: -3 },
    });
    new Zdog.Shape({
        addTo: legGroup,
        stroke: 28,
        color: PALETTE.skinShadow,
        translate: { y: 6 },
        path: [
            { x: -21, y: -6, z: 0 },
            {
                bezier: [
                    { x: -18, y: -6, z: 0 },
                    { x: -24, y: -6, z: 0 },
                    { x: -24, y: 24, z: 0 },
                ],
            },
        ],
        closed: false,
    }).copy({ stroke: 24, color: PALETTE.skin });
    const footGroup = new Zdog.Group({
        addTo: legGroup,
        translate: { x: -25, y: 42, z: 4 },
        rotate: { x: Zdog.TAU / 4 },
    });
    new Zdog.Hemisphere({
        addTo: footGroup,
        stroke: 5,
        diameter: 23,
        color: PALETTE.skinShadow,
        backface: PALETTE.skinShadow,
    }).copy({
        diameter: 20,
        color: PALETTE.skin,
        backface: PALETTE.skin,
        translate: { y: -2, z: 2 },
    });
    const legLeft = legGroup.copyGraph({ rotate: { y: Zdog.TAU / 2 } });
    legLeft.children[1].stroke = 20;
    legLeft.children[1].translate = { x: 1, y: 9 };
    legLeft.children[2].translate = { x: -25, y: 42, z: -4 };

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

    // Initialize PARTY MODE - triple-click to activate!
    const partyState = createPartyMode(canvas, model, illo, (hue) => {
        // Update all character colors during party mode
        PALETTE = createPalette(hue);
    });

    // Initialize JUMPSCARE - click the back of his head!
    const jumpscareState = createJumpscare(canvas, illo);

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
        // Clean up party mode
        if (partyState.intervalId) {
            clearInterval(partyState.intervalId);
        }
        // Clean up jumpscare
        if (jumpscareState.timeoutId) {
            clearTimeout(jumpscareState.timeoutId);
        }
        document.getElementById('jumpscare-container')?.remove();

        removeEventListeners();
        animationManager.stop();
    };
};

const createPartyMode = (
    canvas: HTMLCanvasElement,
    model: CharacterModel,
    illo: any,
    onHueChange: (hue: number) => void
): PartyModeState => {
    const state: PartyModeState = {
        isActive: false,
        clickCount: 0,
        lastClick: 0,
        hueOffset: 0,
        wobblePhase: 0,
        bouncePhase: 0,
        spinSpeed: 0,
        intervalId: null,
    };

    const startParty = () => {
        if (state.isActive) return;
        state.isActive = true;
        state.spinSpeed = 0.15;

        // Party animation loop - just the character going crazy, no UI clutter
        state.intervalId = setInterval(() => {
            if (!state.isActive) return;

            // Cycle through rainbow colors FAST
            state.hueOffset = (state.hueOffset + 15) % 360;
            onHueChange(state.hueOffset);

            // Crazy wobble
            state.wobblePhase += 0.3;
            state.bouncePhase += 0.2;

            const Zdog = window.Zdog;
            if (model.headAnchor && Zdog) {
                // Head goes crazy
                model.headAnchor.rotate.x = Math.sin(state.wobblePhase) * 0.3;
                model.headAnchor.rotate.y = Math.cos(state.wobblePhase * 1.3) * 0.5;
                model.headAnchor.rotate.z = Math.sin(state.wobblePhase * 0.7) * 0.2;
            }

            if (model.bodyAnchor && Zdog) {
                // Body bounces and spins
                model.bodyAnchor.translate.y = 81 + Math.abs(Math.sin(state.bouncePhase)) * 30;
                model.bodyAnchor.rotate.y += state.spinSpeed;
                model.bodyAnchor.rotate.z = Math.sin(state.bouncePhase * 2) * 0.15;
            }

            // Mouth goes wild
            if (model.mouth && model.mouth.scale) {
                model.mouth.scale.y = 0.5 + Math.abs(Math.sin(state.bouncePhase * 3)) * 1.5;
            }

            // Eyes get excited
            if (model.eyeRight && model.eyeLeft) {
                const eyeScale = 0.8 + Math.abs(Math.sin(state.bouncePhase * 2)) * 0.4;
                model.eyeRight.scale.x = eyeScale;
                model.eyeRight.scale.y = eyeScale;
                model.eyeLeft.scale.x = eyeScale;
                model.eyeLeft.scale.y = eyeScale;
            }

            illo.updateRenderGraph();
        }, 50);
    };

    const stopParty = () => {
        state.isActive = false;
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }

        // Reset character
        if (model.headAnchor) {
            model.headAnchor.rotate.x = 0;
            model.headAnchor.rotate.y = 0;
            model.headAnchor.rotate.z = 0;
        }
        if (model.bodyAnchor) {
            model.bodyAnchor.translate.y = 81;
            model.bodyAnchor.rotate.y = 0;
            model.bodyAnchor.rotate.z = 0;
        }
        if (model.mouth && model.mouth.scale) {
            model.mouth.scale.y = 0.5;
        }
    };

    // Triple-click detection
    canvas.addEventListener('click', () => {
        const now = Date.now();
        if (now - state.lastClick > 500) {
            state.clickCount = 1;
        } else {
            state.clickCount++;
        }
        state.lastClick = now;

        if (state.clickCount >= 3) {
            state.clickCount = 0;
            if (state.isActive) {
                stopParty();
            } else {
                startParty();
            }
        }
    });

    return state;
};

const createJumpscare = (
    canvas: HTMLCanvasElement,
    illo: any
): JumpscareState => {
    const state: JumpscareState = {
        isActive: false,
        timeoutId: null,
    };

    const triggerJumpscare = () => {
        if (state.isActive) return;
        state.isActive = true;

        // Create the jumpscare container
        const jumpscareContainer = document.createElement('div');
        jumpscareContainer.id = 'jumpscare-container';
        jumpscareContainer.style.cssText = `
            position: fixed;
            bottom: -400px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            pointer-events: none;
            transition: bottom 0.15s ease-out;
        `;

        // Create a new canvas for the jumpscare face
        const jumpscareCanvas = document.createElement('canvas');
        jumpscareCanvas.width = 800;
        jumpscareCanvas.height = 400;
        jumpscareCanvas.style.cssText = `
            width: 800px;
            height: 400px;
        `;
        jumpscareContainer.appendChild(jumpscareCanvas);

        document.body.appendChild(jumpscareContainer);

        // Create a separate Zdog illustration for just the head
        const Zdog = window.Zdog;
        const jumpscareIllo = new Zdog.Illustration({
            element: jumpscareCanvas,
            zoom: 3,
        });

        // Create simplified giant head with just eyes
        const headAnchor = new Zdog.Anchor({ addTo: jumpscareIllo, translate: { y: 50 } });

        // Giant head shape
        const headGroup = new Zdog.Group({ addTo: headAnchor });
        new Zdog.Shape({
            addTo: headGroup,
            stroke: 228,
            color: PALETTE.skinShadow,
            path: [{ x: -4.5 }, { x: 4.5 }],
        });
        new Zdog.Shape({
            addTo: headGroup,
            stroke: 216,
            color: PALETTE.skin,
            translate: { x: -4.5 },
        });

        // Create the eyes - make them WIDE
        const createEye = (xPos: number, rotY: number) => {
            const eyeAnchor = new Zdog.Anchor({
                addTo: headAnchor,
                translate: { x: xPos, y: -30, z: 84 },
                rotate: { y: rotY },
            });
            const eyeGroup = new Zdog.Group({ addTo: eyeAnchor });

            // Eye socket shadow
            new Zdog.Shape({
                addTo: eyeGroup,
                fill: true,
                stroke: 0,
                color: PALETTE.skinShadow,
                scale: 1.15,
                path: [
                    { x: 0, y: 0, z: 3 },
                    { bezier: [{ x: 24, y: 0, z: 3 }, { x: 36, y: 21, z: 0 }, { x: 36, y: 36, z: 0 }] },
                    { bezier: [{ x: 36, y: 51, z: 0 }, { x: 24, y: 63, z: 3 }, { x: 0, y: 63, z: 3 }] },
                    { bezier: [{ x: -24, y: 63, z: 3 }, { x: -36, y: 51, z: 0 }, { x: -36, y: 36, z: 0 }] },
                    { bezier: [{ x: -36, y: 21, z: 0 }, { x: -24, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }] },
                ],
            });

            // Main eye (pupil)
            const eye = new Zdog.Shape({
                addTo: eyeGroup,
                fill: true,
                stroke: 3,
                color: PALETTE.dark,
                translate: { y: 6 },
                path: [
                    { x: 0, y: 0, z: 3 },
                    { bezier: [{ x: 24, y: 0, z: 3 }, { x: 36, y: 21, z: 0 }, { x: 36, y: 36, z: 0 }] },
                    { bezier: [{ x: 36, y: 51, z: 0 }, { x: 24, y: 63, z: 3 }, { x: 0, y: 63, z: 3 }] },
                    { bezier: [{ x: -24, y: 63, z: 3 }, { x: -36, y: 51, z: 0 }, { x: -36, y: 36, z: 0 }] },
                    { bezier: [{ x: -36, y: 21, z: 0 }, { x: -24, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }] },
                ],
            });

            // Eye highlight
            eye.copy({
                addTo: eye,
                fill: true,
                color: PALETTE.light,
                scale: 0.4,
                translate: { x: -9, y: 9, z: 3 },
            });

            return eyeGroup;
        };

        createEye(-66, Zdog.TAU / 11);
        createEye(66, -Zdog.TAU / 11);

        jumpscareIllo.updateRenderGraph();

        // Make the giant face follow the cursor
        let jumpscareAnimationId: number | null = null;
        const handleMouseMove = (e: MouseEvent) => {
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight;

            // Calculate rotation based on mouse position relative to the face
            const rotX = (e.clientX - screenCenterX) / window.innerWidth;
            const rotY = (e.clientY - screenCenterY) / window.innerHeight;

            // Apply smooth rotation to the head
            headAnchor.rotate.y = -rotX * 0.5;
            headAnchor.rotate.x = rotY * 0.3;

            jumpscareIllo.updateRenderGraph();
        };

        // Animation loop for the jumpscare face
        const animateJumpscare = () => {
            jumpscareIllo.updateRenderGraph();
            jumpscareAnimationId = requestAnimationFrame(animateJumpscare);
        };

        document.addEventListener('mousemove', handleMouseMove);
        animateJumpscare();

        // Store cleanup for later
        const cleanupJumpscareTracking = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            if (jumpscareAnimationId) {
                cancelAnimationFrame(jumpscareAnimationId);
            }
        };

        // Phase 1: Hide original character (it "falls" off screen)
        canvas.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
        canvas.style.transform = 'translateY(300px)';
        canvas.style.opacity = '0';

        // Phase 2: Giant face rises from bottom after a beat
        setTimeout(() => {
            jumpscareContainer.style.bottom = '0px';

            // Shake effect
            let shakeCount = 0;
            const shakeInterval = setInterval(() => {
                const shakeX = (Math.random() - 0.5) * 20;
                jumpscareContainer.style.transform = `translateX(calc(-50% + ${shakeX}px))`;
                shakeCount++;
                if (shakeCount > 30) {
                    clearInterval(shakeInterval);
                    jumpscareContainer.style.transform = 'translateX(-50%)';
                }
            }, 50);
        }, 300);

        // Phase 3: After 5 seconds, remove and restore
        state.timeoutId = setTimeout(() => {
            // Slide jumpscare back down
            jumpscareContainer.style.transition = 'bottom 0.3s ease-in';
            jumpscareContainer.style.bottom = '-400px';

            // Restore original character
            setTimeout(() => {
                canvas.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                canvas.style.transform = 'translateY(0)';
                canvas.style.opacity = '1';

                // Clean up
                setTimeout(() => {
                    cleanupJumpscareTracking();
                    jumpscareContainer.remove();
                    canvas.style.transition = '';
                    state.isActive = false;
                }, 300);
            }, 300);
        }, 5000);
    };

    // Detect click on back of head (when rotated to show back)
    canvas.addEventListener('click', (e: MouseEvent) => {
        if (state.isActive) return;

        // Check if we're looking at the back of the head
        // The illo.rotate.y tells us the rotation - if it's around PI (180 degrees), we're looking at the back
        const rotation = illo.rotate.y;
        const normalizedRotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        // Back of head is visible when rotation is between ~2.5 and ~3.8 radians (roughly 140-220 degrees)
        const isBackVisible = normalizedRotation > 2.2 && normalizedRotation < 4.0;

        if (isBackVisible) {
            // Check if click is roughly in the center (where back of head would be)
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const distFromCenter = Math.sqrt(
                Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2)
            );

            // If clicking within the head area
            if (distFromCenter < rect.width * 0.35) {
                triggerJumpscare();
            }
        }
    });

    return state;
};

const createColorPicker = (container: HTMLElement, onColorChange: (hue: number) => void): ColorPickerState => {
    const pickerEl = document.createElement('div');
    pickerEl.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(10, 10, 26, 0.95);
        border: 2px solid #ffffff;
        border-radius: 8px;
        padding: 10px;
        display: none;
        z-index: 10000;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        max-width: 200px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Choose Color';
    title.style.cssText = `
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 8px;
        text-align: center;
    `;
    pickerEl.appendChild(title);

    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
        margin-bottom: 8px;
    `;

    const hues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];
    hues.forEach(hue => {
        const colorBtn = document.createElement('button');
        colorBtn.style.cssText = `
            width: 28px;
            height: 28px;
            border: 2px solid #ffffff;
            border-radius: 6px;
            background: hsl(${hue}, 60%, 60%);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        colorBtn.onmouseover = () => {
            colorBtn.style.transform = 'scale(1.1)';
            colorBtn.style.boxShadow = '0 2px 8px rgba(255, 255, 255, 0.3)';
        };
        colorBtn.onmouseout = () => {
            colorBtn.style.transform = 'scale(1)';
            colorBtn.style.boxShadow = 'none';
        };
        colorBtn.onclick = () => {
            onColorChange(hue);
            localStorage.setItem('whispra-character-hue', hue.toString());
            pickerEl.style.display = 'none';
        };
        colorGrid.appendChild(colorBtn);
    });

    pickerEl.appendChild(colorGrid);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #ffffff;
        color: #0a0a1a;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 10px;
    `;
    closeBtn.onclick = () => {
        pickerEl.style.display = 'none';
    };
    pickerEl.appendChild(closeBtn);

    container.appendChild(pickerEl);

    return {
        isOpen: false,
        element: pickerEl,
        lastTap: 0,
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
                // Script exists but hasn't been tracked yet - check if it's already loaded
                // by checking if the global objects are available
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
    // Load saved color preference
    const savedHue = localStorage.getItem('whispra-character-hue');
    if (savedHue) {
        const hue = parseInt(savedHue, 10);
        if (!isNaN(hue)) {
            PALETTE = createPalette(hue);
        }
    }

    container.innerHTML = `
        <div class="hero-container" style="position: relative;">
            <div class="character-container">
                <canvas class="interactive-character-canvas" aria-hidden="true"></canvas>
            </div>
        </div>
    `;

    const heroContainer = container.querySelector('.hero-container') as HTMLElement;
    const canvas = container.querySelector('canvas');
    if (!canvas || !heroContainer) {
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

    // Create color picker
    const colorPicker = createColorPicker(heroContainer, (hue: number) => {
        PALETTE = createPalette(hue);
        // Restart animation with new colors
        if (cleanupAnimation) {
            cleanupAnimation();
        }
        attemptInitialization();
    });

    // Double-tap detection
    const handleCanvasClick = () => {
        const now = Date.now();
        const timeSinceLastTap = now - colorPicker.lastTap;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // Double tap detected
            if (colorPicker.element) {
                colorPicker.element.style.display = 'block';
                colorPicker.isOpen = true;
            }
        }

        colorPicker.lastTap = now;
    };

    canvasEl.addEventListener('click', handleCanvasClick);
    canvasEl.style.cursor = 'pointer';

    // Create close button (appears on hover)
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.4);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s, background 0.2s, color 0.2s;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = 'rgba(255, 80, 80, 0.8)';
        closeBtn.style.color = 'white';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        closeBtn.style.color = 'rgba(255, 255, 255, 0.4)';
    };

    heroContainer.appendChild(closeBtn);

    // Show/hide close button on container hover
    heroContainer.onmouseenter = () => {
        closeBtn.style.opacity = '1';
    };
    heroContainer.onmouseleave = () => {
        closeBtn.style.opacity = '0';
    };

    // Track collapsed state
    let isCollapsed = false;

    // Get the outer card container for collapsing
    const cardContainer = container.closest('.interactive-character-card') as HTMLElement | null;

    // Create collapsed button (will be placed in sidebar-footer)
    const collapsedBtn = document.createElement('button');
    collapsedBtn.id = 'sidebar-character-button';
    collapsedBtn.className = 'sidebar-settings-button';
    collapsedBtn.setAttribute('data-tooltip', 'Show Buddy');
    collapsedBtn.title = 'Show interactive character';
    collapsedBtn.innerHTML = `
        <span class="icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
                <path d="M8 14 Q12 17 16 14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
        </span>
        <span class="label">Buddy</span>
    `;
    collapsedBtn.style.display = 'none';

    // Insert button into sidebar-footer, above the help button
    const sidebarFooter = document.querySelector('.sidebar-footer');
    const helpDropdown = document.querySelector('.sidebar-footer .help-dropdown');
    if (sidebarFooter && helpDropdown) {
        sidebarFooter.insertBefore(collapsedBtn, helpDropdown);
    } else {
        // Fallback: add to container
        container.appendChild(collapsedBtn);
    }

    // Handle expand (show character again)
    const handleExpand = () => {
        if (!isCollapsed) return;
        isCollapsed = false;

        // Hide collapsed button
        collapsedBtn.style.display = 'none';

        // Show the card container
        if (cardContainer) {
            cardContainer.style.display = '';
        }

        // Show hero container with animation
        heroContainer.style.display = 'block';
        heroContainer.style.transform = 'scale(0.5) translateY(50px)';
        heroContainer.style.opacity = '0';

        requestAnimationFrame(() => {
            heroContainer.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            heroContainer.style.transform = 'scale(1) translateY(0)';
            heroContainer.style.opacity = '1';

            setTimeout(() => {
                heroContainer.style.transition = '';
            }, 300);
        });
    };
    collapsedBtn.onclick = handleExpand;

    // Handle close/collapse button click
    const handleClose = () => {
        if (isCollapsed) return;
        isCollapsed = true;

        // Animate hero container out
        heroContainer.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
        heroContainer.style.transform = 'scale(0.3) translateY(100px)';
        heroContainer.style.opacity = '0';

        setTimeout(() => {
            heroContainer.style.display = 'none';
            heroContainer.style.transition = '';

            // Hide the entire card container
            if (cardContainer) {
                cardContainer.style.display = 'none';
            }

            // Show collapsed button in sidebar footer
            collapsedBtn.style.display = '';
        }, 300);
    };
    closeBtn.onclick = handleClose;

    ensureScriptsLoaded(() => {
        if (!disposed) {
            attemptInitialization();
        }
    });

    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            canvasEl.removeEventListener('click', handleCanvasClick);
            if (initializationTimeout) {
                clearTimeout(initializationTimeout);
            }
            if (animationState.mouseTimeout) {
                clearTimeout(animationState.mouseTimeout);
            }
            if (cleanupAnimation) {
                cleanupAnimation();
            }
            // Remove the sidebar button if it exists
            collapsedBtn.remove();
            container.innerHTML = '';
        },
    };
};

