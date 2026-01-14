/**
 * Internationalization (i18n) module for Whispra
 * Contains all UI translations for supported languages
 */

const translations: { [key: string]: any } = {
            'en': {
                "tab": {
                    "translation": "Translation",
                    "bidirectional": "Bidirectional",
                    "soundboard": "Soundboard",
                    "settings": "Settings"
                },
                "sidebar": {
                    "translate": "Translate",
                    "bidirectional": "Bidirectional",
                    "screenTranslation": "Screen Translation",
                    "soundBoard": "Sound Board",
                    "voiceFilter": "Voice Filter",
                    "settings": "Settings",
                    "logs": "Logs",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Translate",
                    "screenTranslate": "Screen Translate",
                    "quickTranslate": "Quick Translate",
                    "help": "Help"
                },
                "soundboard": {
                    "panel": {
                        "title": "Sound Board",
                        "description": "Play custom sounds and audio clips during conversations"
                    },
                    "controls": {
                        "outputDevice": "Output Device",
                        "vbAudioVolume": "VB Audio Volume",
                        "headphonesVolume": "Headphones Volume",
                        "soundPadGrid": "Sound Pad Grid",
                        "enableHotkeys": "Enable Soundboard Hotkeys",
                        "addSoundFiles": "Add Sound Files",
                        "webOverlay": "Web Overlay",
                        "stopAllSounds": "Stop All Sounds"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Select output device...",
                        "defaultSystemOutput": "Default System Output",
                        "virtualAudioCable": "Virtual Audio Cable"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidirectional Mode"
                    },
                    "controls": {
                        "startBidirectional": "Start Bidirectional",
                        "stopBidirectional": "Stop Bidirectional",
                        "keybind": "Translate to",
                        "toggleWith": "Toggle with",
                        "changeKey": "Change Key",
                        "outputDevice": "Output Device",
                        "systemInput": "System Input",
                        "incomingVoice": "Incoming Voice",
                        "sourceLanguage": "Source Language",
                        "appSelection": "App Selection"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Loading output devices...",
                        "loadingVoices": "Loading voices...",
                        "displaySystemAudio": "Display/System Audio (Default)"
                    },
                    "status": {
                        "idle": "Idle",
                        "waiting": "Waiting...",
                        "ready": "Ready...",
                        "starting": "Starting...",
                        "stopping": "Stopping..."
                    },
                    "labels": {
                        "detectedTarget": "Detected (Source Language)",
                        "respoken": "Re-spoken (Translate To)"
                    }
                },
                "header": {
                    "signOut": "Sign Out"
                },
                "footer": {
                    "becomeAffiliate": "Become an Affiliate",
                    "reportBug": "Report Bug / Suggest Feature"
                },
                "settings": {
                    "modal": {
                        "title": "Secure API Configuration",
                        "close": "Close"
                    },
                    "instructions": {
                        "title": "API Key Setup Instructions",
                        "openaiTitle": "OpenAI API Key",
                        "openaiPermissions": "Read permissions: Models, Capabilities",
                        "openaiUsage": "Used for speech-to-text and text-to-speech translation",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API Key",
                        "elevenlabsRestrict": "Restrict key: Enabled",
                        "elevenlabsNoAccess": "Everything else: No access",
                        "elevenlabsTts": "Text to speech: Access",
                        "elevenlabsSts": "Speech to speech: Access",
                        "elevenlabsAgents": "ElevenLabs agents: Write",
                        "elevenlabsVoices": "Voices: Write",
                        "elevenlabsVoiceGen": "Voice generation: Access",
                        "elevenlabsUser": "User: Read",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API Key:",
                        "openaiPlaceholder": "Enter your OpenAI API key",
                        "openaiStored": "Key stored securely",
                        "openaiHelp": "Enter your OpenAI API key (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API Key:",
                        "elevenlabsPlaceholder": "Enter your ElevenLabs API key",
                        "elevenlabsStored": "Key stored securely",
                        "elevenlabsHelp": "Enter your ElevenLabs API key (32 chars)",
                        "deepinfraLabel": "DeepInfra API Key:",
                        "deepinfraPlaceholder": "Enter your DeepInfra API key",
                        "deepinfraStored": "Key stored securely",
                        "deepinfraHelp": "Enter your DeepInfra API key for accessing various AI models"
                    },
                    "buttons": {
                        "showKey": "Show Key",
                        "removeKey": "Remove Key",
                        "clearAll": "Clear All Keys",
                        "cancel": "Cancel",
                        "save": "Save"
                    },
                    "status": {
                        "keyStored": "✓ Key stored securely"
                    },
                    "links": {
                        "openai": "Generate key at: platform.openai.com/api-keys",
                        "elevenlabs": "Generate key at: elevenlabs.io/app/profile",
                        "deepinfra": "Generate key at: deepinfra.com/dash/api_keys"
                    },
                    "storage": {
                        "title": "Storage Configuration",
                        "description": "Choose how your API keys are stored. We recommend using OS keychain for maximum security.",
                        "keychain": "OS Keychain (Recommended)",
                        "keychainDesc": "Store keys securely in your operating system's credential manager. Most secure option.",
                        "passphrase": "Passphrase Encryption",
                        "passphraseDesc": "Encrypt keys with a passphrase. Good for portability across devices.",
                        "passphraseInput": "Enter encryption passphrase",
                        "passphraseHelp": "Choose a strong passphrase. You'll need this to access your keys.",
                        "none": "No Storage",
                        "noneDesc": "Don't store keys. You'll need to enter them each time you use the app."
                    },
                    "managedApi": {
                        "title": "API Key Management",
                        "description": "Choose how to manage your API keys for translation services.",
                        "modeLabel": "API Key Mode:",
                        "personalMode": "Personal Keys",
                        "personalModeDesc": "Use your own OpenAI and ElevenLabs API keys",
                        "managedMode": "Managed Keys",
                        "managedModeDesc": "Use Whispra-managed keys (requires subscription)",
                        "subscriptionRequired": "Subscription required for managed keys",
                        "usageLimitInfo": "$20 monthly usage limit included",
                        "switchingMode": "Switching mode...",
                        "switchFailed": "Failed to switch mode"
                    }
                },
                "controls": {
                    "microphone": "Microphone",
                    "targetLanguage": "Translate To",
                    "voice": "Voice",
                    "output": "Output",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Start Translation",
                    "stopTranslation": "Stop Translation",
                    "addCustomVoice": "Add Custom Voice",
                    "accent": "Accent",
                    "noAccent": "No Accent",
                    "accentOn": "Accent: ON",
                    "accentOff": "Accent: OFF"
                },
                "placeholders": {
                    "selectMicrophone": "Select microphone...",
                    "loadingVoices": "Loading voices...",
                    "selectVoice": "Select voice...",
                    "enterCustomAccent": "Enter custom accent...",
                    "selectPreset": "Select preset..."
                },
                "keys": {
                    "space": "SPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Welcome to Whispra!",
                        "message": "Welcome to the app! Let's quickly walk through the main interface."
                    },
                    "sidebar": {
                        "title": "Left Sidebar Navigation",
                        "message": "This is your main navigation bar. Use it to switch between different features like Whispra Translate, Screen Translation, Quick Translate, and more."
                    },
                    "translateTab": {
                        "title": "Translate Tab",
                        "message": "The Translate tab is your main workspace for real-time translation. Start speaking and watch your words get translated instantly."
                    },
                    "bidirectionalTab": {
                        "title": "Bidirectional Mode",
                        "message": "Bidirectional mode translates conversations in both directions automatically. Perfect for natural back-and-forth dialogue."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate Tab",
                        "message": "The Whispra Translate tab combines real-time translation and bidirectional mode in one unified interface. Use the left panel for one-way translation and the right panel for bidirectional conversations. Start speaking and watch your words get translated instantly."
                    },
                    "screenTranslationTab": {
                        "title": "Screen Translation",
                        "message": "Screen Translation captures text from your screen and translates it in real-time. Great for translating content from games, videos, or applications."
                    },
                    "quickTranslateTab": {
                        "title": "Quick Translate",
                        "message": "Quick Translate gives you instant translation with a keyboard shortcut. Press Alt+C to translate selected text quickly."
                    },
                    "soundBoardTab": {
                        "title": "Sound Board",
                        "message": "The Sound Board lets you play audio clips instantly. Perfect for quick responses or sound effects during conversations."
                    },
                    "profile": {
                        "title": "Profile Section",
                        "message": "Access your profile settings, account information, and sign out from here."
                    },
                    "settings": {
                        "title": "Settings Menu",
                        "message": "Click the settings button in the sidebar to access all application settings. We'll show you what's inside next."
                    },
                    "apiKeys": {
                        "title": "API Keys Configuration",
                        "message": "Configure your API keys here. You'll need keys for OpenAI (Whisper), translation services, and ElevenLabs for voice synthesis."
                    },
                    "keybinds": {
                        "title": "Keyboard Shortcuts",
                        "message": "This is where you can configure keyboard shortcuts for quick actions. Customize your hotkeys to suit your workflow."
                    },
                    "models": {
                        "title": "Models & Processing",
                        "message": "Here you can select AI models and adjust processing options. Choose between cloud and local processing, and fine-tune model parameters."
                    },
                    "accountSettings": {
                        "title": "Account & Background Settings",
                        "message": "In the Account tab, you can configure system tray behavior and Paddle warmup settings. Enable \"Run in Background\" to minimize Whispra to the system tray instead of closing it completely."
                    },
                    "screenBoxSelector": {
                        "title": "Screen Box Selector",
                        "message": "Use Alt+Y (default hotkey) to activate the screen box selector. This lets you select specific areas of your screen for targeted translation instead of translating the entire screen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle Warmup Feature",
                        "message": "Enable \"Paddle Warmup on Startup\" to pre-load OCR models when the app starts. This makes screen translation faster but increases startup time. You can find this toggle in the Account settings tab."
                    },
                    "systemTray": {
                        "title": "System Tray Integration",
                        "message": "When \"Run in Background\" is enabled, closing the main window will minimize Whispra to your system tray instead of quitting. Click the tray icon to restore the window, or right-click for quick actions."
                    },
                    "expandedOverlay": {
                        "title": "Expanded Overlay",
                        "message": "Press F11 (or your configured hotkey) to open the Expanded Overlay - a floating control panel that stays on top of other applications. Perfect for gaming or fullscreen apps! It includes all the same features accessible without leaving your current application."
                    },
                    "hotkeys": {
                        "title": "Essential Hotkeys",
                        "message": "Remember these key shortcuts: F11 for Expanded Overlay, Alt+T for Screen Translation, Alt+Y for Screen Box Selector. You can customize all hotkeys in Settings → Keybinds."
                    },
                    "finish": {
                        "title": "You're All Set!",
                        "message": "That's it! You're ready to start using the app. Press F11 to try the Expanded Overlay, and explore all the features to customize your experience."
                    },
                    "buttons": {
                        "skip": "Skip",
                        "back": "Back",
                        "next": "Next",
                        "closeTour": "Close Tour"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Quick Translate",
                    "description": "Instantly translate text using AI translation services",
                    "globalHotkey": "Global Hotkey:",
                    "translateTo": "Translate To",
                    "autoTranslate": "Auto-Translate",
                    "translatesAsYouType": "Translates as you type",
                    "clickTranslateOrPress": "Click Translate or press Ctrl+Enter",
                    "textToTranslate": "Text to Translate",
                    "translationResult": "Translation Result",
                    "translate": "Translate",
                    "translating": "Translating...",
                    "clear": "Clear",
                    "copyResult": "Copy Result",
                    "readyToTranslate": "Ready to translate",
                    "typingDots": "Typing...",
                    "translatingWord": "Translating word...",
                    "translationCompleted": "Translation completed",
                    "translationFailed": "Translation failed",
                    "copiedToClipboard": "Translation copied to clipboard",
                    "pleaseEnterText": "Please enter text to translate",
                    "autoTranslateEnabled": "Auto-translate enabled",
                    "autoTranslateDisabled": "Auto-translate disabled - Click Translate to translate",
                    "enterTextPlaceholder": "Enter text to translate...",
                    "translationPlaceholder": "Translation will appear here..."
                },
                "settingsModal": {
                    "title": "Settings",
                    "runInBackground": "Run in background",
                    "close": "Close",
                    "tabs": {
                        "account": "Account",
                        "apiKeys": "API Keys",
                        "models": "Models",
                        "cloudLocal": "Cloud/Local",
                        "keybinds": "Keybinds",
                        "themes": "Themes",
                        "languageLibrary": "Language Library"
                    },
                    "keybinds": {
                        "title": "Keybinds",
                        "description": "Configure global hotkeys for various features. Bidirectional and screen translation use {modifier} + key. Click \"Change\" to set a new key.",
                        "ptt": "Push-to-Talk",
                        "pttDesc": "Hold this key to speak (default: Space, no Alt needed)",
                        "bidirectional": "Toggle Bidirectional",
                        "bidirectionalDesc": "Press {modifier} + this key to toggle bidirectional mode (default: B)",
                        "screenTranslation": "Screen Translation",
                        "screenTranslationDesc": "Press {modifier} + this key to capture screen (default: T)",
                        "screenTranslationBox": "Screen Translation Box",
                        "screenTranslationBoxDesc": "Press {modifier} + this key to select box area for translation (default: Y)",
                        "overlayToggle": "Toggle Overlay",
                        "overlayToggleDesc": "Press this key to toggle overlay (default: F11, no Alt needed)",
                        "quickTranslation": "Quick Translation",
                        "quickTranslationLocked": "This hotkey is fixed and cannot be changed",
                        "change": "Change",
                        "locked": "Locked",
                        "tip": "Push-to-talk and overlay toggle don't need {modifier}. Bidirectional and screen translation require {modifier} + key. Press ESC to cancel.",
                        "changeTitle": "Change {label}",
                        "changeDescAlt": "Press any key to set as {modifier} + [your key]. {modifier} will be added automatically. Press ESC to cancel.",
                        "changeDescNoAlt": "Press any key (function keys recommended). No modifiers needed. Press ESC to cancel.",
                        "waitingForInput": "Waiting for input..."
                    },
                    "themes": {
                        "title": "Theme Selection",
                        "description": "Choose your preferred interface theme. Changes apply immediately.",
                        "active": "Active",
                        "select": "Select"
                    },
                    "account": {
                        "title": "Account",
                        "profile": "Profile",
                        "subscription": "Subscription",
                        "usage": "Usage",
                        "preferences": "Preferences",
                        "email": "Email",
                        "plan": "Plan",
                        "trialDays": "Trial Days Remaining",
                        "status": "Status",
                        "spokenLanguage": "Language You Speak",
                        "rememberResponses": "Save API Responses",
                        "rememberResponsesDesc": "Store API responses for usage tracking and debugging. Disable for enhanced privacy.",
                        "usageUsed": "Used this month",
                        "usageRemaining": "remaining",
                        "usageLoading": "Loading usage data...",
                        "usageError": "Unable to load usage data",
                        "usageWarningHigh": "⚠️ High usage this month",
                        "usageWarningLimit": "⚠️ Approaching usage limit",
                        "openDashboard": "Manage Subscription",
                        "signOut": "Sign Out",
                        "opening": "Opening...",
                        "error": "Failed to open account dashboard. Please visit account.whispra.xyz manually.",
                        "loading": "Loading account information...",
                        "trial": "7-Day Free Trial",
                        "active": "Active Subscription",
                        "expired": "Expired"
                    }
                }
            },
            'es': {
                "tab": {
                    "translation": "Traducción",
                    "bidirectional": "Bidireccional",
                    "soundboard": "Panel de Sonido",
                    "settings": "Configuración"
                },
                "sidebar": {
                    "translate": "Traducir",
                    "bidirectional": "Bidireccional",
                    "screenTranslation": "Traducción de Pantalla",
                    "soundBoard": "Panel de Sonido",
                    "voiceFilter": "Filtro de Voz",
                    "settings": "Configuración",
                    "logs": "Registros",
                    "menu": "Menú",
                    "whispraTranslate": "Whispra Traducir",
                    "screenTranslate": "Traducir Pantalla",
                    "quickTranslate": "Traducción Rápida",
                    "help": "Ayuda"
                },
                "soundboard": {
                    "panel": {
                        "title": "Panel de Sonido",
                        "description": "Reproduce sonidos personalizados y clips de audio durante conversaciones"
                    },
                    "controls": {
                        "outputDevice": "Dispositivo de Salida",
                        "vbAudioVolume": "Volumen VB Audio",
                        "headphonesVolume": "Volumen de Auriculares",
                        "soundPadGrid": "Cuadrícula de Pad de Sonido",
                        "enableHotkeys": "Habilitar Teclas Rápidas del Panel de Sonido",
                        "addSoundFiles": "Agregar Archivos de Sonido",
                        "webOverlay": "Superposición Web",
                        "stopAllSounds": "Detener Todos los Sonidos"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Seleccionar dispositivo de salida...",
                        "defaultSystemOutput": "Salida del Sistema Predeterminada",
                        "virtualAudioCable": "Cable de Audio Virtual"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Modo Bidireccional"
                    },
                    "controls": {
                        "startBidirectional": "Iniciar Bidireccional",
                        "stopBidirectional": "Detener Bidireccional",
                        "keybind": "Atajo de Teclado",
                        "toggleWith": "Alternar con",
                        "changeKey": "Cambiar Tecla",
                        "outputDevice": "Dispositivo de Salida",
                        "systemInput": "Entrada del Sistema",
                        "incomingVoice": "Voz Entrante",
                        "sourceLanguage": "Idioma de Origen",
                        "appSelection": "Selección de Aplicación"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Cargando dispositivos de salida...",
                        "loadingVoices": "Cargando voces...",
                        "displaySystemAudio": "Pantalla/Audio del Sistema (Predeterminado)"
                    },
                    "status": {
                        "idle": "Inactivo",
                        "waiting": "Esperando...",
                        "ready": "Listo...",
                        "starting": "Iniciando...",
                        "stopping": "Deteniendo..."
                    },
                    "labels": {
                        "detectedTarget": "Detectado (Idioma Objetivo)",
                        "respoken": "Repronunciado"
                    }
                },
                "header": {
                    "signOut": "Cerrar Sesión"
                },
                "footer": {
                    "becomeAffiliate": "Conviértete en Afiliado",
                    "reportBug": "Reportar Error / Sugerir Función"
                },
                "settings": {
                    "modal": {
                        "title": "Configuración Segura de API",
                        "close": "Cerrar"
                    },
                    "instructions": {
                        "title": "Instrucciones de Configuración de Claves API",
                        "openaiTitle": "Clave API de OpenAI",
                        "openaiPermissions": "Permisos de lectura: Modelos, Capacidades",
                        "openaiUsage": "Usado para traducción de voz a texto y texto a voz",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Clave API de ElevenLabs",
                        "elevenlabsRestrict": "Restringir clave: Habilitado",
                        "elevenlabsNoAccess": "Todo lo demás: Sin acceso",
                        "elevenlabsTts": "Texto a voz: Acceso",
                        "elevenlabsSts": "Voz a voz: Acceso",
                        "elevenlabsAgents": "Agentes ElevenLabs: Escritura",
                        "elevenlabsVoices": "Voces: Escritura",
                        "elevenlabsVoiceGen": "Generación de voz: Acceso",
                        "elevenlabsUser": "Usuario: Lectura",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Clave API de OpenAI:",
                        "openaiPlaceholder": "Ingresa tu clave API de OpenAI",
                        "openaiStored": "Clave almacenada de forma segura",
                        "openaiHelp": "Ingresa tu clave API de OpenAI (sk-...)",
                        "elevenlabsLabel": "Clave API de ElevenLabs:",
                        "elevenlabsPlaceholder": "Ingresa tu clave API de ElevenLabs",
                        "elevenlabsStored": "Clave almacenada de forma segura",
                        "elevenlabsHelp": "Ingresa tu clave API de ElevenLabs (32 caracteres)",
                        "deepinfraLabel": "Clave API de DeepInfra:",
                        "deepinfraPlaceholder": "Ingresa tu clave API de DeepInfra",
                        "deepinfraStored": "Clave almacenada de forma segura",
                        "deepinfraHelp": "Ingresa tu clave API de DeepInfra para acceder a varios modelos de IA"
                    },
                    "buttons": {
                        "showKey": "Mostrar Clave",
                        "removeKey": "Eliminar Clave",
                        "clearAll": "Eliminar Todas las Claves",
                        "cancel": "Cancelar",
                        "save": "Guardar"
                    },
                    "status": {
                        "keyStored": "✓ Clave almacenada de forma segura"
                    },
                    "links": {
                        "openai": "Generar clave en: platform.openai.com/api-keys",
                        "elevenlabs": "Generar clave en: elevenlabs.io/app/profile",
                        "deepinfra": "Generar clave en: deepinfra.com/dash/api_keys"
                    },
                    "storage": {
                        "title": "Configuración de Almacenamiento",
                        "description": "Elige cómo se almacenan tus claves API. Recomendamos usar el llavero del SO para máxima seguridad.",
                        "keychain": "Llavero del SO (Recomendado)",
                        "keychainDesc": "Almacena las claves de forma segura en el administrador de credenciales de tu sistema operativo. Opción más segura.",
                        "passphrase": "Cifrado con Frase de Contraseña",
                        "passphraseDesc": "Cifra las claves con una frase de contraseña. Bueno para portabilidad entre dispositivos.",
                        "passphraseInput": "Ingresa la frase de contraseña de cifrado",
                        "passphraseHelp": "Elige una frase de contraseña fuerte. La necesitarás para acceder a tus claves.",
                        "none": "Sin Almacenamiento",
                        "noneDesc": "No almacenar claves. Necesitarás ingresarlas cada vez que uses la aplicación."
                    },
                    "managedApi": {
                        "title": "Gestión de Claves API",
                        "description": "Elige cómo gestionar tus claves API para los servicios de traducción.",
                        "modeLabel": "Modo de Claves API:",
                        "personalMode": "Claves Personales",
                        "personalModeDesc": "Usa tus propias claves API de OpenAI y ElevenLabs",
                        "managedMode": "Claves Administradas",
                        "managedModeDesc": "Usa claves administradas por Whispra (requiere suscripción)",
                        "subscriptionRequired": "Se requiere suscripción para claves administradas",
                        "usageLimitInfo": "Límite de uso mensual de $20 incluido",
                        "switchingMode": "Cambiando modo...",
                        "switchFailed": "Error al cambiar modo"
                    }
                },
                "controls": {
                    "microphone": "Micrófono",
                    "targetLanguage": "Idioma Objetivo",
                    "voice": "Voz",
                    "output": "Salida",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Iniciar Traducción",
                    "stopTranslation": "Detener Traducción",
                    "addCustomVoice": "Agregar Voz Personalizada",
                    "accent": "Acento",
                    "noAccent": "Sin Acento",
                    "accentOn": "Acento: ACTIVADO",
                    "accentOff": "Acento: DESACTIVADO"
                },
                "placeholders": {
                    "selectMicrophone": "Seleccionar micrófono...",
                    "loadingVoices": "Cargando voces...",
                    "selectVoice": "Seleccionar voz...",
                    "enterCustomAccent": "Ingresar acento personalizado...",
                    "selectPreset": "Seleccionar preset..."
                },
                "keys": {
                    "space": "ESPACIO",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "¡Bienvenido a Whispra!",
                        "message": "¡Bienvenido a la aplicación! Hagamos un recorrido rápido por la interfaz principal."
                    },
                    "sidebar": {
                        "title": "Navegación de la Barra Lateral Izquierda",
                        "message": "Esta es tu barra de navegación principal. Úsala para cambiar entre diferentes funciones como Whispra Translate, Traducción de Pantalla, Traducción Rápida y más."
                    },
                    "translateTab": {
                        "title": "Pestaña de Traducción",
                        "message": "La pestaña de Traducción es tu espacio de trabajo principal para traducción en tiempo real. Comienza a hablar y observa cómo tus palabras se traducen instantáneamente."
                    },
                    "bidirectionalTab": {
                        "title": "Modo Bidireccional",
                        "message": "El modo bidireccional traduce conversaciones en ambas direcciones automáticamente. Perfecto para diálogos naturales de ida y vuelta."
                    },
                    "whispraTranslateTab": {
                        "title": "Pestaña Whispra Translate",
                        "message": "La pestaña Whispra Translate combina la traducción en tiempo real y el modo bidireccional en una interfaz unificada. Usa el panel izquierdo para traducción unidireccional y el panel derecho para conversaciones bidireccionales. Comienza a hablar y observa cómo tus palabras se traducen instantáneamente."
                    },
                    "screenTranslationTab": {
                        "title": "Traducción de Pantalla",
                        "message": "La Traducción de Pantalla captura texto de tu pantalla y lo traduce en tiempo real. Ideal para traducir contenido de juegos, videos o aplicaciones."
                    },
                    "quickTranslateTab": {
                        "title": "Traducción Rápida",
                        "message": "La Traducción Rápida te brinda traducción instantánea con un atajo de teclado. Presiona Alt+C para traducir texto seleccionado rápidamente."
                    },
                    "soundBoardTab": {
                        "title": "Panel de Sonido",
                        "message": "El Panel de Sonido te permite reproducir clips de audio al instante. Perfecto para respuestas rápidas o efectos de sonido durante conversaciones."
                    },
                    "profile": {
                        "title": "Sección de Perfil",
                        "message": "Accede a la configuración de tu perfil, información de cuenta y cierra sesión desde aquí."
                    },
                    "settings": {
                        "title": "Menú de Configuración",
                        "message": "Haz clic en el botón de configuración en la barra lateral para acceder a todas las configuraciones de la aplicación. Te mostraremos qué hay dentro a continuación."
                    },
                    "apiKeys": {
                        "title": "Configuración de Claves API",
                        "message": "Configura tus claves API aquí. Necesitarás claves para OpenAI (Whisper), servicios de traducción y ElevenLabs para síntesis de voz."
                    },
                    "keybinds": {
                        "title": "Atajos de Teclado",
                        "message": "Aquí es donde puedes configurar atajos de teclado para acciones rápidas. Personaliza tus teclas de acceso rápido para adaptarlas a tu flujo de trabajo."
                    },
                    "models": {
                        "title": "Modelos y Procesamiento",
                        "message": "Aquí puedes seleccionar modelos de IA y ajustar opciones de procesamiento. Elige entre procesamiento en la nube y local, y ajusta los parámetros del modelo."
                    },
                    "accountSettings": {
                        "title": "Configuración de Cuenta y Fondo",
                        "message": "En la pestaña de Cuenta, puedes configurar el comportamiento de la bandeja del sistema y la configuración de precalentamiento de Paddle. Habilita \"Ejecutar en Segundo Plano\" para minimizar Whispra a la bandeja del sistema en lugar de cerrarla completamente."
                    },
                    "screenBoxSelector": {
                        "title": "Selector de Cuadro de Pantalla",
                        "message": "Usa Alt+Y (tecla de acceso rápido predeterminada) para activar el selector de cuadro de pantalla. Esto te permite seleccionar áreas específicas de tu pantalla para traducción dirigida en lugar de traducir toda la pantalla."
                    },
                    "paddleWarmup": {
                        "title": "Función de Precalentamiento de Paddle",
                        "message": "Habilita \"Precalentamiento de Paddle al Inicio\" para precargar modelos OCR cuando se inicia la aplicación. Esto hace que la traducción de pantalla sea más rápida pero aumenta el tiempo de inicio. Puedes encontrar este interruptor en la pestaña de configuración de Cuenta."
                    },
                    "systemTray": {
                        "title": "Integración de Bandeja del Sistema",
                        "message": "Cuando \"Ejecutar en Segundo Plano\" está habilitado, cerrar la ventana principal minimizará Whispra a tu bandeja del sistema en lugar de salir. Haz clic en el icono de la bandeja para restaurar la ventana, o haz clic derecho para acciones rápidas."
                    },
                    "expandedOverlay": {
                        "title": "Superposición Expandida",
                        "message": "Presiona F11 (o tu tecla de acceso rápido configurada) para abrir la Superposición Expandida: un panel de control flotante que permanece encima de otras aplicaciones. ¡Perfecto para juegos o aplicaciones en pantalla completa! Incluye todas las mismas funciones accesibles sin salir de tu aplicación actual."
                    },
                    "hotkeys": {
                        "title": "Atajos Esenciales",
                        "message": "Recuerda estos atajos de teclado clave: F11 para Superposición Expandida, Alt+T para Traducción de Pantalla, Alt+Y para Selector de Cuadro de Pantalla. Puedes personalizar todos los atajos en Configuración → Atajos de Teclado."
                    },
                    "finish": {
                        "title": "¡Todo Listo!",
                        "message": "¡Eso es todo! Estás listo para comenzar a usar la aplicación. Presiona F11 para probar la Superposición Expandida y explora todas las funciones para personalizar tu experiencia."
                    },
                    "buttons": {
                        "skip": "Omitir",
                        "back": "Atrás",
                        "next": "Siguiente",
                        "closeTour": "Cerrar Tour"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Traducción Rápida",
                    "description": "Traduce texto instantáneamente usando servicios de traducción con IA",
                    "globalHotkey": "Tecla de Acceso Rápido Global:",
                    "translateTo": "Traducir A",
                    "autoTranslate": "Auto-Traducir",
                    "translatesAsYouType": "Traduce mientras escribes",
                    "clickTranslateOrPress": "Haz clic en Traducir o presiona Ctrl+Enter",
                    "textToTranslate": "Texto a Traducir",
                    "translationResult": "Resultado de la Traducción",
                    "translate": "Traducir",
                    "translating": "Traduciendo...",
                    "clear": "Limpiar",
                    "copyResult": "Copiar Resultado",
                    "readyToTranslate": "Listo para traducir",
                    "typingDots": "Escribiendo...",
                    "translatingWord": "Traduciendo palabra...",
                    "translationCompleted": "Traducción completada",
                    "translationFailed": "Traducción fallida",
                    "copiedToClipboard": "Traducción copiada al portapapeles",
                    "pleaseEnterText": "Por favor ingresa texto para traducir",
                    "autoTranslateEnabled": "Auto-traducción habilitada",
                    "autoTranslateDisabled": "Auto-traducción deshabilitada - Haz clic en Traducir para traducir",
                    "enterTextPlaceholder": "Ingresa texto para traducir...",
                    "translationPlaceholder": "La traducción aparecerá aquí..."
                },
                "settingsModal": {
                    "title": "Configuración",
                    "runInBackground": "Ejecutar en segundo plano",
                    "close": "Cerrar",
                    "tabs": {
                        "account": "Cuenta",
                        "apiKeys": "Claves API",
                        "models": "Modelos",
                        "cloudLocal": "Nube/Local",
                        "keybinds": "Atajos",
                        "themes": "Temas",
                        "languageLibrary": "Biblioteca de Idiomas"
                    },
                    "keybinds": {
                        "title": "Atajos de Teclado",
                        "description": "Configura las teclas rápidas globales para varias funciones. Bidireccional y traducción de pantalla usan {modifier} + tecla. Haz clic en \"Cambiar\" para establecer una nueva tecla.",
                        "ptt": "Pulsar para Hablar",
                        "pttDesc": "Mantén esta tecla para hablar (predeterminado: Espacio, sin Alt)",
                        "bidirectional": "Alternar Bidireccional",
                        "bidirectionalDesc": "Presiona {modifier} + esta tecla para alternar modo bidireccional (predeterminado: B)",
                        "screenTranslation": "Traducción de Pantalla",
                        "screenTranslationDesc": "Presiona {modifier} + esta tecla para capturar pantalla (predeterminado: T)",
                        "screenTranslationBox": "Caja de Traducción de Pantalla",
                        "screenTranslationBoxDesc": "Presiona {modifier} + esta tecla para seleccionar área de caja para traducción (predeterminado: Y)",
                        "overlayToggle": "Alternar Superposición",
                        "overlayToggleDesc": "Presiona esta tecla para alternar superposición (predeterminado: F11, sin Alt)",
                        "quickTranslation": "Traducción Rápida",
                        "quickTranslationLocked": "Este atajo está fijo y no se puede cambiar",
                        "change": "Cambiar",
                        "locked": "Bloqueado",
                        "tip": "Pulsar para hablar y alternar superposición no necesitan {modifier}. Bidireccional y traducción de pantalla requieren {modifier} + tecla. Presiona ESC para cancelar.",
                        "changeTitle": "Cambiar {label}",
                        "changeDescAlt": "Presiona cualquier tecla para establecer como {modifier} + [tu tecla]. {modifier} se agregará automáticamente. Presiona ESC para cancelar.",
                        "changeDescNoAlt": "Presiona cualquier tecla (se recomiendan teclas de función). No se necesitan modificadores. Presiona ESC para cancelar.",
                        "waitingForInput": "Esperando entrada..."
                    },
                    "themes": {
                        "title": "Selección de Tema",
                        "description": "Elige tu tema de interfaz preferido. Los cambios se aplican inmediatamente.",
                        "active": "Activo",
                        "select": "Seleccionar"
                    },
                    "account": {
                        "title": "Cuenta",
                        "profile": "Perfil",
                        "subscription": "Suscripción",
                        "usage": "Uso",
                        "preferences": "Preferencias",
                        "email": "Correo",
                        "plan": "Plan",
                        "trialDays": "Días de Prueba Restantes",
                        "status": "Estado",
                        "spokenLanguage": "Idioma que Hablas",
                        "rememberResponses": "Guardar Respuestas de API",
                        "rememberResponsesDesc": "Almacenar respuestas de API para seguimiento de uso y depuración. Desactivar para mayor privacidad.",
                        "usageUsed": "Usado este mes",
                        "usageRemaining": "restante",
                        "usageLoading": "Cargando datos de uso...",
                        "usageError": "No se pueden cargar los datos de uso",
                        "usageWarningHigh": "⚠️ Uso alto este mes",
                        "usageWarningLimit": "⚠️ Acercándose al límite de uso",
                        "openDashboard": "Gestionar Suscripción",
                        "signOut": "Cerrar Sesión",
                        "opening": "Abriendo...",
                        "error": "Error al abrir el panel de cuenta. Por favor visita account.whispra.xyz manualmente.",
                        "loading": "Cargando información de cuenta...",
                        "trial": "Prueba Gratuita de 7 Días",
                        "active": "Suscripción Activa",
                        "expired": "Expirado"
                    }
                }
            },
            'ru': {
                "tab": {
                    "translation": "Перевод",
                    "bidirectional": "Двунаправленный",
                    "soundboard": "Звуковая Панель",
                    "settings": "Настройки"
                },
                "sidebar": {
                    "translate": "Перевести",
                    "bidirectional": "Двунаправленный",
                    "screenTranslation": "Перевод Экрана",
                    "soundBoard": "Звуковая Панель",
                    "voiceFilter": "Фильтр Голоса",
                    "settings": "Настройки",
                    "logs": "Журналы",
                    "menu": "Меню",
                    "whispraTranslate": "Whispra Перевод",
                    "screenTranslate": "Перевод Экрана",
                    "quickTranslate": "Быстрый Перевод",
                    "help": "Помощь"
                },
                "soundboard": {
                    "panel": {
                        "title": "Звуковая Панель",
                        "description": "Воспроизводить пользовательские звуки и аудио клипы во время разговоров"
                    },
                    "controls": {
                        "outputDevice": "Устройство Вывода",
                        "vbAudioVolume": "Громкость VB Audio",
                        "headphonesVolume": "Громкость Наушников",
                        "soundPadGrid": "Сетка Звуковых Падов",
                        "enableHotkeys": "Включить Горячие Клавиши Звуковой Панели",
                        "addSoundFiles": "Добавить Звуковые Файлы",
                        "webOverlay": "Веб Оверлей",
                        "stopAllSounds": "Остановить Все Звуки"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Выберите устройство вывода...",
                        "defaultSystemOutput": "Вывод Системы По Умолчанию",
                        "virtualAudioCable": "Виртуальный Аудио Кабель"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Двунаправленный Режим"
                    },
                    "controls": {
                        "startBidirectional": "Начать Двунаправленный",
                        "stopBidirectional": "Остановить Двунаправленный",
                        "keybind": "Горячая Клавиша",
                        "toggleWith": "Переключить с",
                        "changeKey": "Изменить Клавишу",
                        "outputDevice": "Устройство Вывода",
                        "systemInput": "Системный Вход",
                        "incomingVoice": "Входящий Голос",
                        "sourceLanguage": "Исходный Язык",
                        "appSelection": "Выбор Приложения"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Загрузка устройств вывода...",
                        "loadingVoices": "Загрузка голосов...",
                        "displaySystemAudio": "Экран/Системный Аудио (По умолчанию)"
                    },
                    "status": {
                        "idle": "Ожидание",
                        "waiting": "Ожидание...",
                        "ready": "Готов...",
                        "starting": "Запуск...",
                        "stopping": "Остановка..."
                    },
                    "labels": {
                        "detectedTarget": "Обнаружено (Целевой Язык)",
                        "respoken": "Переговорено"
                    }
                },
                "header": {
                    "signOut": "Выйти"
                },
                "footer": {
                    "becomeAffiliate": "Стать партнёром",
                    "reportBug": "Сообщить об ошибке / Предложить функцию"
                },
                "settings": {
                    "modal": {
                        "title": "Безопасная Конфигурация API",
                        "close": "Закрыть"
                    },
                    "instructions": {
                        "title": "Инструкции по Настройке Ключей API",
                        "openaiTitle": "Ключ API OpenAI",
                        "openaiPermissions": "Разрешения на чтение: Модели, Возможности",
                        "openaiUsage": "Используется для перевода речи в текст и текста в речь",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Ключ API ElevenLabs",
                        "elevenlabsRestrict": "Ограничить ключ: Включено",
                        "elevenlabsNoAccess": "Все остальное: Нет доступа",
                        "elevenlabsTts": "Текст в речь: Доступ",
                        "elevenlabsSts": "Речь в речь: Доступ",
                        "elevenlabsAgents": "Агенты ElevenLabs: Запись",
                        "elevenlabsVoices": "Голоса: Запись",
                        "elevenlabsVoiceGen": "Генерация голоса: Доступ",
                        "elevenlabsUser": "Пользователь: Чтение",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Ключ API OpenAI:",
                        "openaiPlaceholder": "Введите ваш ключ API OpenAI",
                        "openaiStored": "Ключ хранится безопасно",
                        "openaiHelp": "Введите ваш ключ API OpenAI (sk-...)",
                        "elevenlabsLabel": "Ключ API ElevenLabs:",
                        "elevenlabsPlaceholder": "Введите ваш ключ API ElevenLabs",
                        "elevenlabsStored": "Ключ хранится безопасно",
                        "elevenlabsHelp": "Введите ваш ключ API ElevenLabs (32 символа)",
                        "deepinfraLabel": "Ключ API DeepInfra:",
                        "deepinfraPlaceholder": "Введите ваш ключ API DeepInfra",
                        "deepinfraStored": "Ключ хранится безопасно",
                        "deepinfraHelp": "Введите ваш ключ API DeepInfra для доступа к различным моделям ИИ"
                    },
                    "buttons": {
                        "showKey": "Показать Ключ",
                        "removeKey": "Удалить Ключ",
                        "clearAll": "Удалить Все Ключи",
                        "cancel": "Отмена",
                        "save": "Сохранить"
                    },
                    "status": {
                        "keyStored": "✓ Ключ хранится безопасно"
                    },
                    "links": {
                        "openai": "Сгенерировать ключ на: platform.openai.com/api-keys",
                        "elevenlabs": "Сгенерировать ключ на: elevenlabs.io/app/profile",
                        "deepinfra": "Сгенерировать ключ на: deepinfra.com/dash/api_keys"
                    },
                    "storage": {
                        "title": "Конфигурация Хранилища",
                        "description": "Выберите, как хранятся ваши API ключи. Мы рекомендуем использовать связку ключей ОС для максимальной безопасности.",
                        "keychain": "Связка Ключей ОС (Рекомендуется)",
                        "keychainDesc": "Безопасно храните ключи в менеджере учетных данных вашей операционной системы. Самый безопасный вариант.",
                        "passphrase": "Шифрование Паролем",
                        "passphraseDesc": "Шифруйте ключи паролем. Хорошо для переносимости между устройствами.",
                        "passphraseInput": "Введите пароль для шифрования",
                        "passphraseHelp": "Выберите надежный пароль. Он понадобится для доступа к вашим ключам.",
                        "none": "Без Хранения",
                        "noneDesc": "Не сохранять ключи. Вам нужно будет вводить их каждый раз при использовании приложения."
                    },
                    "managedApi": {
                        "title": "Управление Ключами API",
                        "description": "Выберите способ управления ключами API для служб перевода.",
                        "modeLabel": "Режим Ключей API:",
                        "personalMode": "Личные Ключи",
                        "personalModeDesc": "Используйте свои собственные ключи API OpenAI и ElevenLabs",
                        "managedMode": "Управляемые Ключи",
                        "managedModeDesc": "Используйте ключи, управляемые Whispra (требуется подписка)",
                        "subscriptionRequired": "Для управляемых ключей требуется подписка",
                        "usageLimitInfo": "Включен месячный лимит использования $20",
                        "switchingMode": "Переключение режима...",
                        "switchFailed": "Не удалось переключить режим"
                    }
                },
                "controls": {
                    "microphone": "Микрофон",
                    "targetLanguage": "Целевой Язык",
                    "voice": "Голос",
                    "output": "Выход",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Начать Перевод",
                    "stopTranslation": "Остановить Перевод",
                    "addCustomVoice": "Добавить Пользовательский Голос",
                    "accent": "Акцент",
                    "noAccent": "Без Акцента",
                    "accentOn": "Акцент: ВКЛ",
                    "accentOff": "Акцент: ВЫКЛ"
                },
                "placeholders": {
                    "selectMicrophone": "Выберите микрофон...",
                    "loadingVoices": "Загрузка голосов...",
                    "selectVoice": "Выберите голос...",
                    "enterCustomAccent": "Введите пользовательский акцент...",
                    "selectPreset": "Выберите preset..."
                },
                "keys": {
                    "space": "ПРОБЕЛ",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Добро пожаловать в Whispra!",
                        "message": "Добро пожаловать в приложение! Давайте быстро пройдемся по основному интерфейсу."
                    },
                    "sidebar": {
                        "title": "Навигация по Левой Боковой Панели",
                        "message": "Это ваша основная панель навигации. Используйте её для переключения между различными функциями, такими как Whispra Translate, Перевод Экрана, Быстрый Перевод и многое другое."
                    },
                    "translateTab": {
                        "title": "Вкладка Перевода",
                        "message": "Вкладка Перевода - это ваше основное рабочее пространство для перевода в реальном времени. Начните говорить и наблюдайте, как ваши слова мгновенно переводятся."
                    },
                    "bidirectionalTab": {
                        "title": "Двунаправленный Режим",
                        "message": "Двунаправленный режим автоматически переводит разговоры в обоих направлениях. Идеально подходит для естественного диалога туда и обратно."
                    },
                    "whispraTranslateTab": {
                        "title": "Вкладка Whispra Translate",
                        "message": "Вкладка Whispra Translate объединяет перевод в реальном времени и двунаправленный режим в едином интерфейсе. Используйте левую панель для одностороннего перевода и правую панель для двунаправленных разговоров. Начните говорить и наблюдайте, как ваши слова мгновенно переводятся."
                    },
                    "screenTranslationTab": {
                        "title": "Перевод Экрана",
                        "message": "Перевод Экрана захватывает текст с вашего экрана и переводит его в реальном времени. Отлично подходит для перевода контента из игр, видео или приложений."
                    },
                    "quickTranslateTab": {
                        "title": "Быстрый Перевод",
                        "message": "Быстрый Перевод дает вам мгновенный перевод с помощью сочетания клавиш. Нажмите Alt+C, чтобы быстро перевести выделенный текст."
                    },
                    "soundBoardTab": {
                        "title": "Звуковая Панель",
                        "message": "Звуковая Панель позволяет мгновенно воспроизводить аудиоклипы. Идеально подходит для быстрых ответов или звуковых эффектов во время разговоров."
                    },
                    "profile": {
                        "title": "Раздел Профиля",
                        "message": "Получите доступ к настройкам профиля, информации об учетной записи и выйдите отсюда."
                    },
                    "settings": {
                        "title": "Меню Настроек",
                        "message": "Нажмите кнопку настроек на боковой панели, чтобы получить доступ ко всем настройкам приложения. Далее мы покажем вам, что внутри."
                    },
                    "apiKeys": {
                        "title": "Конфигурация Ключей API",
                        "message": "Настройте свои ключи API здесь. Вам понадобятся ключи для OpenAI (Whisper), служб перевода и ElevenLabs для синтеза голоса."
                    },
                    "keybinds": {
                        "title": "Сочетания Клавиш",
                        "message": "Здесь вы можете настроить сочетания клавиш для быстрых действий. Настройте свои горячие клавиши в соответствии с вашим рабочим процессом."
                    },
                    "models": {
                        "title": "Модели и Обработка",
                        "message": "Здесь вы можете выбрать модели ИИ и настроить параметры обработки. Выберите между облачной и локальной обработкой и точно настройте параметры модели."
                    },
                    "accountSettings": {
                        "title": "Настройки Учетной Записи и Фона",
                        "message": "На вкладке Учетная запись вы можете настроить поведение системного трея и настройки прогрева Paddle. Включите \"Запуск в Фоновом Режиме\", чтобы свернуть Whispra в системный трей вместо полного закрытия."
                    },
                    "screenBoxSelector": {
                        "title": "Селектор Области Экрана",
                        "message": "Используйте Alt+Y (горячая клавиша по умолчанию), чтобы активировать селектор области экрана. Это позволяет выбирать определенные области экрана для целевого перевода вместо перевода всего экрана."
                    },
                    "paddleWarmup": {
                        "title": "Функция Прогрева Paddle",
                        "message": "Включите \"Прогрев Paddle при Запуске\", чтобы предварительно загрузить модели OCR при запуске приложения. Это ускоряет перевод экрана, но увеличивает время запуска. Вы можете найти этот переключатель на вкладке настроек Учетной записи."
                    },
                    "systemTray": {
                        "title": "Интеграция Системного Трея",
                        "message": "Когда включен \"Запуск в Фоновом Режиме\", закрытие главного окна свернет Whispra в системный трей вместо выхода. Щелкните значок трея, чтобы восстановить окно, или щелкните правой кнопкой мыши для быстрых действий."
                    },
                    "expandedOverlay": {
                        "title": "Расширенный Оверлей",
                        "message": "Нажмите F11 (или настроенную горячую клавишу), чтобы открыть Расширенный Оверлей - плавающую панель управления, которая остается поверх других приложений. Идеально подходит для игр или полноэкранных приложений! Он включает все те же функции, доступные без выхода из текущего приложения."
                    },
                    "hotkeys": {
                        "title": "Основные Горячие Клавиши",
                        "message": "Запомните эти ключевые сочетания: F11 для Расширенного Оверлея, Alt+T для Перевода Экрана, Alt+Y для Селектора Области Экрана. Вы можете настроить все горячие клавиши в Настройки → Сочетания Клавиш."
                    },
                    "finish": {
                        "title": "Все Готово!",
                        "message": "Вот и все! Вы готовы начать использовать приложение. Нажмите F11, чтобы попробовать Расширенный Оверлей, и изучите все функции, чтобы настроить свой опыт."
                    },
                    "buttons": {
                        "skip": "Пропустить",
                        "back": "Назад",
                        "next": "Далее",
                        "closeTour": "Закрыть Тур"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Быстрый Перевод",
                    "description": "Мгновенно переводите текст с помощью ИИ-сервисов перевода",
                    "globalHotkey": "Глобальная Горячая Клавиша:",
                    "translateTo": "Перевести На",
                    "autoTranslate": "Авто-Перевод",
                    "translatesAsYouType": "Переводит по мере ввода",
                    "clickTranslateOrPress": "Нажмите Перевести или Ctrl+Enter",
                    "textToTranslate": "Текст для Перевода",
                    "translationResult": "Результат Перевода",
                    "translate": "Перевести",
                    "translating": "Перевод...",
                    "clear": "Очистить",
                    "copyResult": "Копировать Результат",
                    "readyToTranslate": "Готов к переводу",
                    "typingDots": "Ввод...",
                    "translatingWord": "Перевод слова...",
                    "translationCompleted": "Перевод завершён",
                    "translationFailed": "Перевод не удался",
                    "copiedToClipboard": "Перевод скопирован в буфер обмена",
                    "pleaseEnterText": "Пожалуйста, введите текст для перевода",
                    "autoTranslateEnabled": "Авто-перевод включён",
                    "autoTranslateDisabled": "Авто-перевод выключен - Нажмите Перевести",
                    "enterTextPlaceholder": "Введите текст для перевода...",
                    "translationPlaceholder": "Перевод появится здесь..."
                },
                "settingsModal": {
                    "title": "Настройки",
                    "runInBackground": "Работать в фоне",
                    "close": "Закрыть",
                    "tabs": {
                        "account": "Аккаунт",
                        "apiKeys": "API Ключи",
                        "models": "Модели",
                        "cloudLocal": "Облако/Локально",
                        "keybinds": "Горячие клавиши",
                        "themes": "Темы",
                        "languageLibrary": "Библиотека языков"
                    },
                    "keybinds": {
                        "title": "Горячие Клавиши",
                        "description": "Настройте глобальные горячие клавиши для различных функций. Двунаправленный и перевод экрана используют {modifier} + клавиша. Нажмите \"Изменить\" для установки новой клавиши.",
                        "ptt": "Нажми и Говори",
                        "pttDesc": "Удерживайте эту клавишу для разговора (по умолчанию: Пробел, без Alt)",
                        "bidirectional": "Переключить Двунаправленный",
                        "bidirectionalDesc": "Нажмите {modifier} + эту клавишу для переключения двунаправленного режима (по умолчанию: B)",
                        "screenTranslation": "Перевод Экрана",
                        "screenTranslationDesc": "Нажмите {modifier} + эту клавишу для захвата экрана (по умолчанию: T)",
                        "screenTranslationBox": "Область Перевода Экрана",
                        "screenTranslationBoxDesc": "Нажмите {modifier} + эту клавишу для выбора области для перевода (по умолчанию: Y)",
                        "overlayToggle": "Переключить Оверлей",
                        "overlayToggleDesc": "Нажмите эту клавишу для переключения оверлея (по умолчанию: F11, без Alt)",
                        "quickTranslation": "Быстрый Перевод",
                        "quickTranslationLocked": "Эта горячая клавиша фиксирована и не может быть изменена",
                        "change": "Изменить",
                        "locked": "Заблокировано",
                        "tip": "Нажми и говори и переключение оверлея не требуют {modifier}. Двунаправленный и перевод экрана требуют {modifier} + клавиша. Нажмите ESC для отмены.",
                        "changeTitle": "Изменить {label}",
                        "changeDescAlt": "Нажмите любую клавишу для установки как {modifier} + [ваша клавиша]. {modifier} будет добавлен автоматически. Нажмите ESC для отмены.",
                        "changeDescNoAlt": "Нажмите любую клавишу (рекомендуются функциональные клавиши). Модификаторы не нужны. Нажмите ESC для отмены.",
                        "waitingForInput": "Ожидание ввода..."
                    },
                    "themes": {
                        "title": "Выбор Темы",
                        "description": "Выберите предпочитаемую тему интерфейса. Изменения применяются немедленно.",
                        "active": "Активна",
                        "select": "Выбрать"
                    },
                    "account": {
                        "title": "Аккаунт",
                        "profile": "Профиль",
                        "subscription": "Подписка",
                        "usage": "Использование",
                        "preferences": "Настройки",
                        "email": "Email",
                        "plan": "План",
                        "trialDays": "Осталось дней пробного периода",
                        "status": "Статус",
                        "spokenLanguage": "Язык, на котором вы говорите",
                        "rememberResponses": "Сохранять ответы API",
                        "rememberResponsesDesc": "Сохранять ответы API для отслеживания использования и отладки. Отключите для повышенной конфиденциальности.",
                        "usageUsed": "Использовано в этом месяце",
                        "usageRemaining": "осталось",
                        "usageLoading": "Загрузка данных использования...",
                        "usageError": "Не удалось загрузить данные использования",
                        "usageWarningHigh": "⚠️ Высокое использование в этом месяце",
                        "usageWarningLimit": "⚠️ Приближение к лимиту использования",
                        "openDashboard": "Управление подпиской",
                        "signOut": "Выйти",
                        "opening": "Открытие...",
                        "error": "Не удалось открыть панель аккаунта. Пожалуйста, посетите account.whispra.xyz вручную.",
                        "loading": "Загрузка информации об аккаунте...",
                        "trial": "7-дневный бесплатный пробный период",
                        "active": "Активная подписка",
                        "expired": "Истекла"
                    }
                }
            },
            'zh': {
                "tab": {
                    "translation": "翻译",
                    "bidirectional": "双向",
                    "soundboard": "声音面板",
                    "settings": "设置"
                },
                "sidebar": {
                    "translate": "翻译",
                    "bidirectional": "双向",
                    "screenTranslation": "屏幕翻译",
                    "soundBoard": "声音面板",
                    "voiceFilter": "语音过滤",
                    "settings": "设置",
                    "logs": "日志",
                    "menu": "菜单",
                    "whispraTranslate": "Whispra 翻译",
                    "screenTranslate": "屏幕翻译",
                    "quickTranslate": "快速翻译",
                    "help": "帮助"
                },
                "soundboard": {
                    "panel": {
                        "title": "声音面板",
                        "description": "在对话期间播放自定义声音和音频剪辑"
                    },
                    "controls": {
                        "outputDevice": "输出设备",
                        "vbAudioVolume": "VB Audio 音量",
                        "headphonesVolume": "耳机音量",
                        "soundPadGrid": "声音垫网格",
                        "enableHotkeys": "启用声音面板快捷键",
                        "addSoundFiles": "添加声音文件",
                        "webOverlay": "网页叠加",
                        "stopAllSounds": "停止所有声音"
                    },
                    "placeholders": {
                        "selectOutputDevice": "选择输出设备...",
                        "defaultSystemOutput": "默认系统输出",
                        "virtualAudioCable": "虚拟音频线缆"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "双向模式"
                    },
                    "controls": {
                        "startBidirectional": "开始双向翻译",
                        "stopBidirectional": "停止双向翻译",
                        "keybind": "快捷键",
                        "toggleWith": "切换键",
                        "changeKey": "更改按键",
                        "outputDevice": "输出设备",
                        "systemInput": "系统输入",
                        "incomingVoice": "输入语音",
                        "sourceLanguage": "源语言",
                        "appSelection": "应用选择"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "加载输出设备中...",
                        "loadingVoices": "加载语音中...",
                        "displaySystemAudio": "显示/系统音频（默认）"
                    },
                    "status": {
                        "idle": "空闲",
                        "waiting": "等待中...",
                        "ready": "就绪...",
                        "starting": "启动中...",
                        "stopping": "停止中..."
                    },
                    "labels": {
                        "detectedTarget": "检测到（目标语言）",
                        "respoken": "重新发音"
                    }
                },
                "header": {
                    "signOut": "退出登录"
                },
                "footer": {
                    "becomeAffiliate": "成为合作伙伴",
                    "reportBug": "报告错误 / 建议功能"
                },
                "settings": {
                    "modal": {
                        "title": "安全 API 配置",
                        "close": "关闭"
                    },
                    "instructions": {
                        "title": "API 密钥设置说明",
                        "openaiTitle": "OpenAI API 密钥",
                        "openaiPermissions": "读取权限：模型、功能",
                        "openaiUsage": "用于语音转文本和文本转语音翻译",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API 密钥",
                        "elevenlabsRestrict": "限制密钥：已启用",
                        "elevenlabsNoAccess": "其他所有内容：无访问权限",
                        "elevenlabsTts": "文本转语音：访问权限",
                        "elevenlabsSts": "语音转语音：访问权限",
                        "elevenlabsAgents": "ElevenLabs 代理：写入",
                        "elevenlabsVoices": "语音：写入",
                        "elevenlabsVoiceGen": "语音生成：访问权限",
                        "elevenlabsUser": "用户：读取",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API 密钥：",
                        "openaiPlaceholder": "输入您的 OpenAI API 密钥",
                        "openaiStored": "密钥已安全存储",
                        "openaiHelp": "输入您的 OpenAI API 密钥 (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API 密钥：",
                        "elevenlabsPlaceholder": "输入您的 ElevenLabs API 密钥",
                        "elevenlabsStored": "密钥已安全存储",
                        "elevenlabsHelp": "输入您的 ElevenLabs API 密钥 (32 个字符)",
                        "deepinfraLabel": "DeepInfra API 密钥：",
                        "deepinfraPlaceholder": "输入您的 DeepInfra API 密钥",
                        "deepinfraStored": "密钥已安全存储",
                        "deepinfraHelp": "输入您的 DeepInfra API 密钥以访问各种 AI 模型"
                    },
                    "buttons": {
                        "showKey": "显示密钥",
                        "removeKey": "删除密钥",
                        "clearAll": "清除所有密钥",
                        "cancel": "取消",
                        "save": "保存"
                    },
                    "status": {
                        "keyStored": "✓ 密钥已安全存储"
                    },
                    "links": {
                        "openai": "在以下位置生成密钥：platform.openai.com/api-keys",
                        "elevenlabs": "在以下位置生成密钥：elevenlabs.io/app/profile",
                        "deepinfra": "在以下位置生成密钥：deepinfra.com/dash/api_keys"
                    },
                    "storage": {
                        "title": "存储配置",
                        "description": "选择如何存储您的 API 密钥。我们建议使用操作系统钥匙串以获得最大安全性。",
                        "keychain": "操作系统钥匙串（推荐）",
                        "keychainDesc": "将密钥安全地存储在操作系统的凭据管理器中。最安全的选项。",
                        "passphrase": "密码短语加密",
                        "passphraseDesc": "使用密码短语加密密钥。适合在设备间移植。",
                        "passphraseInput": "输入加密密码短语",
                        "passphraseHelp": "选择一个强密码短语。您需要它来访问您的密钥。",
                        "none": "不存储",
                        "noneDesc": "不存储密钥。每次使用应用程序时都需要输入它们。"
                    },
                    "managedApi": {
                        "title": "API 密钥管理",
                        "description": "选择如何管理翻译服务的 API 密钥。",
                        "modeLabel": "API 密钥模式：",
                        "personalMode": "个人密钥",
                        "personalModeDesc": "使用您自己的 OpenAI 和 ElevenLabs API 密钥",
                        "managedMode": "托管密钥",
                        "managedModeDesc": "使用 Whispra 托管的密钥（需要订阅）",
                        "subscriptionRequired": "托管密钥需要订阅",
                        "usageLimitInfo": "包含每月 $20 使用限制",
                        "switchingMode": "切换模式中...",
                        "switchFailed": "切换模式失败"
                    }
                },
                "controls": {
                    "microphone": "麦克风",
                    "targetLanguage": "目标语言",
                    "voice": "语音",
                    "output": "输出",
                    "pushToTalk": "按键通话",
                    "startTranslation": "开始翻译",
                    "stopTranslation": "停止翻译",
                    "addCustomVoice": "添加自定义语音",
                    "accent": "口音",
                    "noAccent": "无口音",
                    "accentOn": "口音：开启",
                    "accentOff": "口音：关闭"
                },
                "placeholders": {
                    "selectMicrophone": "选择麦克风...",
                    "loadingVoices": "加载语音中...",
                    "selectVoice": "选择语音...",
                    "enterCustomAccent": "输入自定义口音...",
                    "selectPreset": "选择预设..."
                },
                "keys": {
                    "space": "空格",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "欢迎使用 Whispra！",
                        "message": "欢迎使用本应用！让我们快速浏览一下主界面。"
                    },
                    "sidebar": {
                        "title": "左侧边栏导航",
                        "message": "这是您的主导航栏。使用它在不同功能之间切换，如 Whispra Translate、屏幕翻译、快速翻译等。"
                    },
                    "translateTab": {
                        "title": "翻译标签",
                        "message": "翻译标签是您进行实时翻译的主要工作区。开始说话，观看您的话语即时翻译。"
                    },
                    "bidirectionalTab": {
                        "title": "双向模式",
                        "message": "双向模式自动双向翻译对话。非常适合自然的来回对话。"
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate 标签",
                        "message": "Whispra Translate 标签将实时翻译和双向模式结合在一个统一的界面中。使用左侧面板进行单向翻译，使用右侧面板进行双向对话。开始说话，观看您的话语即时翻译。"
                    },
                    "screenTranslationTab": {
                        "title": "屏幕翻译",
                        "message": "屏幕翻译从您的屏幕捕获文本并实时翻译。非常适合翻译游戏、视频或应用程序中的内容。"
                    },
                    "quickTranslateTab": {
                        "title": "快速翻译",
                        "message": "快速翻译通过键盘快捷键为您提供即时翻译。按 Alt+C 快速翻译选定的文本。"
                    },
                    "soundBoardTab": {
                        "title": "声音面板",
                        "message": "声音面板让您即时播放音频剪辑。非常适合在对话期间快速响应或音效。"
                    },
                    "profile": {
                        "title": "个人资料部分",
                        "message": "从这里访问您的个人资料设置、帐户信息并退出登录。"
                    },
                    "settings": {
                        "title": "设置菜单",
                        "message": "单击侧边栏中的设置按钮以访问所有应用程序设置。接下来我们将向您展示里面有什么。"
                    },
                    "apiKeys": {
                        "title": "API 密钥配置",
                        "message": "在此处配置您的 API 密钥。您需要 OpenAI（Whisper）、翻译服务和 ElevenLabs 的语音合成密钥。"
                    },
                    "keybinds": {
                        "title": "键盘快捷键",
                        "message": "这是您可以配置快速操作的键盘快捷键的地方。自定义您的热键以适应您的工作流程。"
                    },
                    "models": {
                        "title": "模型和处理",
                        "message": "在这里您可以选择 AI 模型并调整处理选项。在云处理和本地处理之间进行选择，并微调模型参数。"
                    },
                    "accountSettings": {
                        "title": "帐户和后台设置",
                        "message": "在帐户选项卡中，您可以配置系统托盘行为和 Paddle 预热设置。启用「在后台运行」可将 Whispra 最小化到系统托盘，而不是完全关闭它。"
                    },
                    "screenBoxSelector": {
                        "title": "屏幕框选择器",
                        "message": "使用 Alt+Y（默认热键）激活屏幕框选择器。这使您可以选择屏幕的特定区域进行有针对性的翻译，而不是翻译整个屏幕。"
                    },
                    "paddleWarmup": {
                        "title": "Paddle 预热功能",
                        "message": "启用「启动时 Paddle 预热」以在应用启动时预加载 OCR 模型。这使屏幕翻译更快，但会增加启动时间。您可以在帐户设置选项卡中找到此切换。"
                    },
                    "systemTray": {
                        "title": "系统托盘集成",
                        "message": "启用「在后台运行」后，关闭主窗口将把 Whispra 最小化到系统托盘而不是退出。单击托盘图标以恢复窗口，或右键单击以进行快速操作。"
                    },
                    "expandedOverlay": {
                        "title": "扩展叠加层",
                        "message": "按 F11（或您配置的热键）打开扩展叠加层 - 一个浮动控制面板，始终位于其他应用程序之上。非常适合游戏或全屏应用！它包括所有相同的功能，无需离开当前应用程序即可访问。"
                    },
                    "hotkeys": {
                        "title": "基本热键",
                        "message": "记住这些关键快捷键：F11 用于扩展叠加层，Alt+T 用于屏幕翻译，Alt+Y 用于屏幕框选择器。您可以在设置 → 键盘快捷键中自定义所有热键。"
                    },
                    "finish": {
                        "title": "一切就绪！",
                        "message": "就是这样！您已准备好开始使用该应用。按 F11 尝试扩展叠加层，并探索所有功能以自定义您的体验。"
                    },
                    "buttons": {
                        "skip": "跳过",
                        "back": "返回",
                        "next": "下一步",
                        "closeTour": "关闭导览"
                    }
                },
                "quickTranslatePanel": {
                    "title": "快速翻译",
                    "description": "使用AI翻译服务即时翻译文本",
                    "globalHotkey": "全局快捷键：",
                    "translateTo": "翻译为",
                    "autoTranslate": "自动翻译",
                    "translatesAsYouType": "输入时自动翻译",
                    "clickTranslateOrPress": "点击翻译或按Ctrl+Enter",
                    "textToTranslate": "待翻译文本",
                    "translationResult": "翻译结果",
                    "translate": "翻译",
                    "translating": "翻译中...",
                    "clear": "清除",
                    "copyResult": "复制结果",
                    "readyToTranslate": "准备翻译",
                    "typingDots": "输入中...",
                    "translatingWord": "翻译词语中...",
                    "translationCompleted": "翻译完成",
                    "translationFailed": "翻译失败",
                    "copiedToClipboard": "翻译已复制到剪贴板",
                    "pleaseEnterText": "请输入要翻译的文本",
                    "autoTranslateEnabled": "自动翻译已启用",
                    "autoTranslateDisabled": "自动翻译已禁用 - 点击翻译按钮",
                    "enterTextPlaceholder": "输入要翻译的文本...",
                    "translationPlaceholder": "翻译结果将显示在这里..."
                },
                "settingsModal": {
                    "title": "设置",
                    "runInBackground": "后台运行",
                    "close": "关闭",
                    "tabs": {
                        "account": "账户",
                        "apiKeys": "API密钥",
                        "models": "模型",
                        "cloudLocal": "云端/本地",
                        "keybinds": "快捷键",
                        "themes": "主题",
                        "languageLibrary": "语言库"
                    },
                    "keybinds": {
                        "title": "快捷键",
                        "description": "配置各种功能的全局快捷键。双向和屏幕翻译使用 {modifier} + 键。点击\"更改\"设置新键。",
                        "ptt": "按键说话",
                        "pttDesc": "按住此键说话（默认：空格，无需Alt）",
                        "bidirectional": "切换双向",
                        "bidirectionalDesc": "按 {modifier} + 此键切换双向模式（默认：B）",
                        "screenTranslation": "屏幕翻译",
                        "screenTranslationDesc": "按 {modifier} + 此键捕获屏幕（默认：T）",
                        "screenTranslationBox": "屏幕翻译框",
                        "screenTranslationBoxDesc": "按 {modifier} + 此键选择翻译区域（默认：Y）",
                        "overlayToggle": "切换覆盖层",
                        "overlayToggleDesc": "按此键切换覆盖层（默认：F11，无需Alt）",
                        "quickTranslation": "快速翻译",
                        "quickTranslationLocked": "此快捷键已固定，无法更改",
                        "change": "更改",
                        "locked": "已锁定",
                        "tip": "按键说话和切换覆盖层不需要 {modifier}。双向和屏幕翻译需要 {modifier} + 键。按ESC取消。",
                        "changeTitle": "更改 {label}",
                        "changeDescAlt": "按任意键设置为 {modifier} + [您的键]。{modifier} 将自动添加。按ESC取消。",
                        "changeDescNoAlt": "按任意键（推荐功能键）。不需要修饰键。按ESC取消。",
                        "waitingForInput": "等待输入..."
                    },
                    "themes": {
                        "title": "主题选择",
                        "description": "选择您喜欢的界面主题。更改立即生效。",
                        "active": "已激活",
                        "select": "选择"
                    },
                    "account": {
                        "title": "账户",
                        "profile": "个人资料",
                        "subscription": "订阅",
                        "usage": "使用量",
                        "preferences": "偏好设置",
                        "email": "邮箱",
                        "plan": "计划",
                        "trialDays": "剩余试用天数",
                        "status": "状态",
                        "spokenLanguage": "您说的语言",
                        "rememberResponses": "保存API响应",
                        "rememberResponsesDesc": "存储API响应用于使用跟踪和调试。禁用以增强隐私。",
                        "usageUsed": "本月已使用",
                        "usageRemaining": "剩余",
                        "usageLoading": "加载使用数据...",
                        "usageError": "无法加载使用数据",
                        "usageWarningHigh": "⚠️ 本月使用量较高",
                        "usageWarningLimit": "⚠️ 接近使用限制",
                        "openDashboard": "管理订阅",
                        "signOut": "退出登录",
                        "opening": "正在打开...",
                        "error": "无法打开账户面板。请手动访问 account.whispra.xyz。",
                        "loading": "加载账户信息...",
                        "trial": "7天免费试用",
                        "active": "活跃订阅",
                        "expired": "已过期"
                    }
                }
            },
            'ja': {
                "tab": {
                    "translation": "翻訳",
                    "bidirectional": "双方向",
                    "soundboard": "サウンドボード",
                    "settings": "設定"
                },
                "sidebar": {
                    "translate": "翻訳",
                    "bidirectional": "双方向",
                    "screenTranslation": "画面翻訳",
                    "soundBoard": "サウンドボード",
                    "voiceFilter": "音声フィルター",
                    "settings": "設定",
                    "logs": "ログ",
                    "menu": "メニュー",
                    "whispraTranslate": "Whispra 翻訳",
                    "screenTranslate": "画面翻訳",
                    "quickTranslate": "クイック翻訳",
                    "help": "ヘルプ"
                },
                "soundboard": {
                    "panel": {
                        "title": "サウンドボード",
                        "description": "会話中にカスタムサウンドとオーディオクリップを再生"
                    },
                    "controls": {
                        "outputDevice": "出力デバイス",
                        "vbAudioVolume": "VB Audio 音量",
                        "headphonesVolume": "ヘッドフォン音量",
                        "soundPadGrid": "サウンドパッドグリッド",
                        "enableHotkeys": "サウンドボードホットキーを有効化",
                        "addSoundFiles": "サウンドファイルを追加",
                        "webOverlay": "ウェブオーバーレイ",
                        "stopAllSounds": "すべてのサウンドを停止"
                    },
                    "placeholders": {
                        "selectOutputDevice": "出力デバイスを選択...",
                        "defaultSystemOutput": "デフォルトシステム出力",
                        "virtualAudioCable": "仮想オーディオケーブル"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "双方向モード"
                    },
                    "controls": {
                        "startBidirectional": "双方向を開始",
                        "stopBidirectional": "双方向を停止",
                        "keybind": "キーバインド",
                        "toggleWith": "切り替えキー",
                        "changeKey": "キーを変更",
                        "outputDevice": "出力デバイス",
                        "systemInput": "システム入力",
                        "incomingVoice": "入力音声",
                        "sourceLanguage": "ソース言語",
                        "appSelection": "アプリ選択"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "出力デバイスを読み込み中...",
                        "loadingVoices": "音声を読み込み中...",
                        "displaySystemAudio": "ディスプレイ/システムオーディオ（デフォルト）"
                    },
                    "status": {
                        "idle": "待機中",
                        "waiting": "待機中...",
                        "ready": "準備完了...",
                        "starting": "開始中...",
                        "stopping": "停止中..."
                    },
                    "labels": {
                        "detectedTarget": "検出（ターゲット言語）",
                        "respoken": "再発音"
                    }
                },
                "header": {
                    "signOut": "ログアウト"
                },
                "footer": {
                    "becomeAffiliate": "アフィリエイトになる",
                    "reportBug": "バグ報告 / 機能提案"
                },
                "settings": {
                    "modal": {
                        "title": "安全な API 設定",
                        "close": "閉じる"
                    },
                    "instructions": {
                        "title": "API キー設定手順",
                        "openaiTitle": "OpenAI API キー",
                        "openaiPermissions": "読み取り権限：モデル、機能",
                        "openaiUsage": "音声テキスト変換とテキスト音声変換の翻訳に使用",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API キー",
                        "elevenlabsRestrict": "キーを制限：有効",
                        "elevenlabsNoAccess": "その他すべて：アクセスなし",
                        "elevenlabsTts": "テキスト音声変換：アクセス",
                        "elevenlabsSts": "音声音声変換：アクセス",
                        "elevenlabsAgents": "ElevenLabs エージェント：書き込み",
                        "elevenlabsVoices": "音声：書き込み",
                        "elevenlabsVoiceGen": "音声生成：アクセス",
                        "elevenlabsUser": "ユーザー：読み取り",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API キー：",
                        "openaiPlaceholder": "OpenAI API キーを入力してください",
                        "openaiStored": "キーが安全に保存されました",
                        "openaiHelp": "OpenAI API キーを入力してください (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API キー：",
                        "elevenlabsPlaceholder": "ElevenLabs API キーを入力してください",
                        "elevenlabsStored": "キーが安全に保存されました",
                        "elevenlabsHelp": "ElevenLabs API キーを入力してください (32 文字)",
                        "deepinfraLabel": "DeepInfra API キー：",
                        "deepinfraPlaceholder": "DeepInfra API キーを入力してください",
                        "deepinfraStored": "キーが安全に保存されました",
                        "deepinfraHelp": "さまざまな AI モデルにアクセスするための DeepInfra API キーを入力してください"
                    },
                    "buttons": {
                        "showKey": "キーを表示",
                        "removeKey": "キーを削除",
                        "clearAll": "すべてのキーをクリア",
                        "cancel": "キャンセル",
                        "save": "保存"
                    },
                    "status": {
                        "keyStored": "✓ キーが安全に保存されました"
                    },
                    "links": {
                        "openai": "キーを生成：platform.openai.com/api-keys",
                        "elevenlabs": "キーを生成：elevenlabs.io/app/profile",
                        "deepinfra": "キーを生成：deepinfra.com/dash/api_keys"
                    },
                    "storage": {
                        "title": "ストレージ設定",
                        "description": "API キーの保存方法を選択してください。最大のセキュリティのために OS キーチェーンの使用をお勧めします。",
                        "keychain": "OS キーチェーン（推奨）",
                        "keychainDesc": "オペレーティングシステムの資格情報マネージャーにキーを安全に保存します。最も安全なオプション。",
                        "passphrase": "パスフレーズ暗号化",
                        "passphraseDesc": "パスフレーズでキーを暗号化します。デバイス間での移植性に適しています。",
                        "passphraseInput": "暗号化パスフレーズを入力",
                        "passphraseHelp": "強力なパスフレーズを選択してください。キーにアクセスするために必要になります。",
                        "none": "ストレージなし",
                        "noneDesc": "キーを保存しません。アプリを使用するたびに入力する必要があります。"
                    },
                    "managedApi": {
                        "title": "API キー管理",
                        "description": "翻訳サービスの API キーの管理方法を選択してください。",
                        "modeLabel": "API キーモード：",
                        "personalMode": "個人キー",
                        "personalModeDesc": "独自の OpenAI および ElevenLabs API キーを使用",
                        "managedMode": "管理キー",
                        "managedModeDesc": "Whispra 管理のキーを使用（サブスクリプション必要）",
                        "subscriptionRequired": "管理キーにはサブスクリプションが必要です",
                        "usageLimitInfo": "月額 $20 の使用制限が含まれています",
                        "switchingMode": "モード切り替え中...",
                        "switchFailed": "モードの切り替えに失敗しました"
                    }
                },
                "controls": {
                    "microphone": "マイク",
                    "targetLanguage": "ターゲット言語",
                    "voice": "音声",
                    "output": "出力",
                    "pushToTalk": "プッシュ・トゥ・トーク",
                    "startTranslation": "翻訳を開始",
                    "stopTranslation": "翻訳を停止",
                    "addCustomVoice": "カスタム音声を追加",
                    "accent": "アクセント",
                    "noAccent": "アクセントなし",
                    "accentOn": "アクセント：オン",
                    "accentOff": "アクセント：オフ"
                },
                "placeholders": {
                    "selectMicrophone": "マイクを選択...",
                    "loadingVoices": "音声を読み込み中...",
                    "selectVoice": "音声を選択...",
                    "enterCustomAccent": "カスタムアクセントを入力...",
                    "selectPreset": "プリセットを選択..."
                },
                "keys": {
                    "space": "スペース",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Whispra へようこそ！",
                        "message": "アプリへようこそ！メインインターフェースを簡単に見ていきましょう。"
                    },
                    "sidebar": {
                        "title": "左サイドバーナビゲーション",
                        "message": "これはメインナビゲーションバーです。Whispra Translate、画面翻訳、クイック翻訳などのさまざまな機能を切り替えるために使用します。"
                    },
                    "translateTab": {
                        "title": "翻訳タブ",
                        "message": "翻訳タブは、リアルタイム翻訳のメインワークスペースです。話し始めると、あなたの言葉が即座に翻訳されるのを見ることができます。"
                    },
                    "bidirectionalTab": {
                        "title": "双方向モード",
                        "message": "双方向モードは、会話を両方向に自動的に翻訳します。自然な往復対話に最適です。"
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate タブ",
                        "message": "Whispra Translate タブは、リアルタイム翻訳と双方向モードを1つの統合インターフェースに結合します。左パネルで一方向翻訳、右パネルで双方向会話に使用します。話し始めると、あなたの言葉が即座に翻訳されるのを見ることができます。"
                    },
                    "screenTranslationTab": {
                        "title": "画面翻訳",
                        "message": "画面翻訳は、画面からテキストをキャプチャし、リアルタイムで翻訳します。ゲーム、ビデオ、またはアプリケーションからのコンテンツを翻訳するのに最適です。"
                    },
                    "quickTranslateTab": {
                        "title": "クイック翻訳",
                        "message": "クイック翻訳は、キーボードショートカットで即座に翻訳を提供します。Alt+C を押して、選択したテキストをすばやく翻訳します。"
                    },
                    "soundBoardTab": {
                        "title": "サウンドボード",
                        "message": "サウンドボードを使用すると、オーディオクリップを即座に再生できます。会話中の迅速な応答や音響効果に最適です。"
                    },
                    "profile": {
                        "title": "プロフィールセクション",
                        "message": "ここからプロフィール設定、アカウント情報にアクセスし、ログアウトします。"
                    },
                    "settings": {
                        "title": "設定メニュー",
                        "message": "サイドバーの設定ボタンをクリックして、すべてのアプリケーション設定にアクセスします。次に中身をお見せします。"
                    },
                    "apiKeys": {
                        "title": "API キー設定",
                        "message": "ここで API キーを設定します。OpenAI（Whisper）、翻訳サービス、および音声合成用の ElevenLabs のキーが必要です。"
                    },
                    "keybinds": {
                        "title": "キーボードショートカット",
                        "message": "ここでは、クイックアクション用のキーボードショートカットを設定できます。ワークフローに合わせてホットキーをカスタマイズします。"
                    },
                    "models": {
                        "title": "モデルと処理",
                        "message": "ここでは、AI モデルを選択し、処理オプションを調整できます。クラウド処理とローカル処理を選択し、モデルパラメータを微調整します。"
                    },
                    "accountSettings": {
                        "title": "アカウントとバックグラウンド設定",
                        "message": "アカウントタブでは、システムトレイの動作と Paddle ウォームアップ設定を構成できます。「バックグラウンドで実行」を有効にすると、Whispra を完全に閉じる代わりにシステムトレイに最小化します。"
                    },
                    "screenBoxSelector": {
                        "title": "画面ボックスセレクター",
                        "message": "Alt+Y（デフォルトのホットキー）を使用して画面ボックスセレクターをアクティブにします。これにより、画面全体を翻訳する代わりに、ターゲット翻訳用の画面の特定の領域を選択できます。"
                    },
                    "paddleWarmup": {
                        "title": "Paddle ウォームアップ機能",
                        "message": "「起動時に Paddle ウォームアップ」を有効にすると、アプリの起動時に OCR モデルを事前ロードします。これにより画面翻訳が高速化されますが、起動時間が長くなります。このトグルはアカウント設定タブにあります。"
                    },
                    "systemTray": {
                        "title": "システムトレイ統合",
                        "message": "「バックグラウンドで実行」が有効になっている場合、メインウィンドウを閉じると、終了する代わりに Whispra がシステムトレイに最小化されます。トレイアイコンをクリックしてウィンドウを復元するか、右クリックしてクイックアクションを実行します。"
                    },
                    "expandedOverlay": {
                        "title": "拡張オーバーレイ",
                        "message": "F11（または設定したホットキー）を押して拡張オーバーレイを開きます - 他のアプリケーションの上に留まるフローティングコントロールパネルです。ゲームやフルスクリーンアプリに最適です！現在のアプリケーションを離れることなくアクセスできる同じ機能がすべて含まれています。"
                    },
                    "hotkeys": {
                        "title": "必須ホットキー",
                        "message": "これらの重要なショートカットを覚えておいてください：拡張オーバーレイには F11、画面翻訳には Alt+T、画面ボックスセレクターには Alt+Y。設定 → キーボードショートカットですべてのホットキーをカスタマイズできます。"
                    },
                    "finish": {
                        "title": "準備完了！",
                        "message": "以上です！アプリの使用を開始する準備が整いました。F11 を押して拡張オーバーレイを試し、すべての機能を探索して体験をカスタマイズしてください。"
                    },
                    "buttons": {
                        "skip": "スキップ",
                        "back": "戻る",
                        "next": "次へ",
                        "closeTour": "ツアーを閉じる"
                    }
                },
                "quickTranslatePanel": {
                    "title": "クイック翻訳",
                    "description": "AI翻訳サービスを使用してテキストを即座に翻訳",
                    "globalHotkey": "グローバルホットキー：",
                    "translateTo": "翻訳先",
                    "autoTranslate": "自動翻訳",
                    "translatesAsYouType": "入力中に翻訳",
                    "clickTranslateOrPress": "翻訳をクリックまたはCtrl+Enter",
                    "textToTranslate": "翻訳するテキスト",
                    "translationResult": "翻訳結果",
                    "translate": "翻訳",
                    "translating": "翻訳中...",
                    "clear": "クリア",
                    "copyResult": "結果をコピー",
                    "readyToTranslate": "翻訳準備完了",
                    "typingDots": "入力中...",
                    "translatingWord": "単語を翻訳中...",
                    "translationCompleted": "翻訳完了",
                    "translationFailed": "翻訳失敗",
                    "copiedToClipboard": "翻訳をクリップボードにコピーしました",
                    "pleaseEnterText": "翻訳するテキストを入力してください",
                    "autoTranslateEnabled": "自動翻訳が有効",
                    "autoTranslateDisabled": "自動翻訳が無効 - 翻訳をクリック",
                    "enterTextPlaceholder": "翻訳するテキストを入力...",
                    "translationPlaceholder": "翻訳結果がここに表示されます..."
                },
                "settingsModal": {
                    "title": "設定",
                    "runInBackground": "バックグラウンドで実行",
                    "close": "閉じる",
                    "tabs": {
                        "account": "アカウント",
                        "apiKeys": "APIキー",
                        "models": "モデル",
                        "cloudLocal": "クラウド/ローカル",
                        "keybinds": "キーバインド",
                        "themes": "テーマ",
                        "languageLibrary": "言語ライブラリ"
                    },
                    "keybinds": {
                        "title": "キーバインド",
                        "description": "各種機能のグローバルホットキーを設定します。双方向とスクリーン翻訳は {modifier} + キーを使用します。「変更」をクリックして新しいキーを設定してください。",
                        "ptt": "プッシュトゥトーク",
                        "pttDesc": "このキーを押しながら話す（デフォルト：スペース、Altなし）",
                        "bidirectional": "双方向切り替え",
                        "bidirectionalDesc": "{modifier} + このキーで双方向モードを切り替え（デフォルト：B）",
                        "screenTranslation": "スクリーン翻訳",
                        "screenTranslationDesc": "{modifier} + このキーで画面をキャプチャ（デフォルト：T）",
                        "screenTranslationBox": "スクリーン翻訳ボックス",
                        "screenTranslationBoxDesc": "{modifier} + このキーで翻訳エリアを選択（デフォルト：Y）",
                        "overlayToggle": "オーバーレイ切り替え",
                        "overlayToggleDesc": "このキーでオーバーレイを切り替え（デフォルト：F11、Altなし）",
                        "quickTranslation": "クイック翻訳",
                        "quickTranslationLocked": "このホットキーは固定されており、変更できません",
                        "change": "変更",
                        "locked": "ロック済み",
                        "tip": "プッシュトゥトークとオーバーレイ切り替えは {modifier} 不要。双方向とスクリーン翻訳は {modifier} + キーが必要。ESCでキャンセル。",
                        "changeTitle": "{label} を変更",
                        "changeDescAlt": "任意のキーを押して {modifier} + [あなたのキー] として設定。{modifier} は自動的に追加されます。ESCでキャンセル。",
                        "changeDescNoAlt": "任意のキーを押してください（ファンクションキー推奨）。修飾キーは不要です。ESCでキャンセル。",
                        "waitingForInput": "入力待ち..."
                    },
                    "themes": {
                        "title": "テーマ選択",
                        "description": "お好みのインターフェーステーマを選択してください。変更は即座に適用されます。",
                        "active": "アクティブ",
                        "select": "選択"
                    },
                    "account": {
                        "title": "アカウント",
                        "profile": "プロフィール",
                        "subscription": "サブスクリプション",
                        "usage": "使用量",
                        "preferences": "設定",
                        "email": "メール",
                        "plan": "プラン",
                        "trialDays": "残りトライアル日数",
                        "status": "ステータス",
                        "spokenLanguage": "話す言語",
                        "rememberResponses": "API応答を保存",
                        "rememberResponsesDesc": "使用状況の追跡とデバッグのためにAPI応答を保存します。プライバシー強化のため無効にできます。",
                        "usageUsed": "今月の使用量",
                        "usageRemaining": "残り",
                        "usageLoading": "使用データを読み込み中...",
                        "usageError": "使用データを読み込めません",
                        "usageWarningHigh": "⚠️ 今月の使用量が多いです",
                        "usageWarningLimit": "⚠️ 使用制限に近づいています",
                        "openDashboard": "サブスクリプション管理",
                        "signOut": "サインアウト",
                        "opening": "開いています...",
                        "error": "アカウントダッシュボードを開けませんでした。account.whispra.xyz に手動でアクセスしてください。",
                        "loading": "アカウント情報を読み込み中...",
                        "trial": "7日間無料トライアル",
                        "active": "アクティブなサブスクリプション",
                        "expired": "期限切れ"
                    }
                }
            },
        
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            'no': {
                "tab": {
                    "translation": "Oversettelse",
                    "bidirectional": "Bidireksjonal",
                    "soundboard": "Lydtavle",
                    "settings": "Innstillinger"
                },
                "sidebar": {
                    "translate": "Oversett",
                    "bidirectional": "Bidireksjonal",
                    "screenTranslation": "Skjermoversettelse",
                    "soundBoard": "Lydtavle",
                    "voiceFilter": "Stemmesfilter",
                    "settings": "Innstillinger",
                    "logs": "Logger",
                    "menu": "Meny",
                    "whispraTranslate": "Whispra Oversett",
                    "screenTranslate": "Skjermoversett",
                    "quickTranslate": "Hurtigoversett",
                    "help": "Hjelp"
                },
                "soundboard": {
                    "panel": {
                        "title": "Lydtavle",
                        "description": "Spill av tilpassede lyder og lydklipp under samtaler"
                    },
                    "controls": {
                        "outputDevice": "Utgangsenhet",
                        "vbAudioVolume": "VB Audio Volum",
                        "headphonesVolume": "Hodetelefonvolum",
                        "soundPadGrid": "Lydpad Rutenett",
                        "enableHotkeys": "Aktiver hurtigtaster for lydtavle",
                        "addSoundFiles": "Legg til lydfiler",
                        "webOverlay": "Web-overlay",
                        "stopAllSounds": "Stopp alle lyder"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Velg utgangsenhet...",
                        "defaultSystemOutput": "Standard systemutgang",
                        "virtualAudioCable": "Virtuell lydkabel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidireksjonal modus"
                    },
                    "controls": {
                        "startBidirectional": "Start bidireksjonal",
                        "stopBidirectional": "Stopp bidireksjonal",
                        "keybind": "Oversett til",
                        "toggleWith": "Veksle med",
                        "changeKey": "Endre tast",
                        "outputDevice": "Utgangsenhet",
                        "systemInput": "Systeminngang",
                        "incomingVoice": "Innkommende stemme",
                        "sourceLanguage": "Kildespråk",
                        "appSelection": "Appvalg"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Laster utgangsenheter...",
                        "loadingVoices": "Laster stemmer...",
                        "displaySystemAudio": "Vis/systemlyd (Standard)"
                    },
                    "status": {
                        "idle": "Inaktiv",
                        "waiting": "Venter...",
                        "ready": "Klar...",
                        "starting": "Starter...",
                        "stopping": "Stopper..."
                    },
                    "labels": {
                        "detectedTarget": "Oppdaget (Kildespråk)",
                        "respoken": "Gjenfortalt (Oversett til)"
                    }
                },
                "header": {
                    "signOut": "Logg ut"
                },
                "footer": {
                    "becomeAffiliate": "Bli en Affiliate",
                    "reportBug": "Rapporter Feil / Foreslå Funksjon"
                },
                "settings": {
                    "modal": {
                        "title": "Sikker API-konfigurasjon",
                        "close": "Lukk"
                    },
                    "instructions": {
                        "title": "API-nøkkeloppsett",
                        "openaiTitle": "OpenAI API-nøkkel",
                        "openaiPermissions": "Lesetilgang: Modeller, Kapabiliteter",
                        "openaiUsage": "Brukt for tale-til-tekst og tekst-til-tale oversettelse",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API-nøkkel",
                        "elevenlabsRestrict": "Begrens nøkkel: Aktivert",
                        "elevenlabsNoAccess": "Alt annet: Ingen tilgang",
                        "elevenlabsTts": "Tekst til tale: Tilgang",
                        "elevenlabsSts": "Tale til tale: Tilgang",
                        "elevenlabsAgents": "ElevenLabs-agenter: Skrive",
                        "elevenlabsVoices": "Stemmer: Skrive",
                        "elevenlabsVoiceGen": "Stemmegenerering: Tilgang",
                        "elevenlabsUser": "Bruker: Les",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API-nøkkel:",
                        "openaiPlaceholder": "Skriv inn din OpenAI API-nøkkel",
                        "openaiStored": "Nøkkel lagret sikkert",
                        "openaiHelp": "Skriv inn din OpenAI API-nøkkel (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API-nøkkel:",
                        "elevenlabsPlaceholder": "Skriv inn din ElevenLabs API-nøkkel",
                        "elevenlabsStored": "Nøkkel lagret sikkert",
                        "elevenlabsHelp": "Skriv inn din ElevenLabs API-nøkkel (32 tegn)"
                    },
                    "buttons": {
                        "showKey": "Vis nøkkel",
                        "removeKey": "Fjern nøkkel",
                        "clearAll": "Fjern alle nøkler",
                        "cancel": "Avbryt",
                        "save": "Lagre"
                    },
                    "status": {
                        "keyStored": "✓ Nøkkel lagret sikkert"
                    },
                    "links": {
                        "openai": "Generer nøkkel på: platform.openai.com/api-keys",
                        "elevenlabs": "Generer nøkkel på: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Oversett til",
                    "voice": "Stemme",
                    "output": "Utgang",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Start oversettelse",
                    "stopTranslation": "Stopp oversettelse",
                    "addCustomVoice": "Legg til tilpasset stemme",
                    "accent": "Aksent",
                    "noAccent": "Ingen aksent",
                    "accentOn": "Aksent: PÅ",
                    "accentOff": "Aksent: AV"
                },
                "placeholders": {
                    "selectMicrophone": "Velg mikrofon...",
                    "loadingVoices": "Laster stemmer...",
                    "selectVoice": "Velg stemme...",
                    "enterCustomAccent": "Skriv inn tilpasset aksent...",
                    "selectPreset": "Velg forhåndsinnstilling..."
                },
                "keys": {
                    "space": "MELLOMROM",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Velkommen til Whispra!",
                        "message": "Velkommen til appen! La oss raskt gå gjennom hovedgrensesnittet."
                    },
                    "sidebar": {
                        "title": "Navigasjon i venstre sidefelt",
                        "message": "Dette er din hovednavigasjonslinje. Bruk den til å bytte mellom forskjellige funksjoner som Whispra Translate, Skjermoversettelse, Rask oversettelse, og mer."
                    },
                    "translateTab": {
                        "title": "Oversett-fane",
                        "message": "Oversett-fanen er ditt hovedarbeidsområde for sanntidsoversettelse. Begynn å snakke og se ordene dine bli oversatt umiddelbart."
                    },
                    "bidirectionalTab": {
                        "title": "Bidireksjonal modus",
                        "message": "Bidireksjonal modus oversetter samtaler i begge retninger automatisk. Perfekt for naturlig frem og tilbake-dialog."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate-fane",
                        "message": "Whispra Translate-fanen kombinerer sanntidsoversettelse og bidireksjonal modus i ett forent grensesnitt. Bruk venstre panel for enveis oversettelse og høyre panel for bidireksjonale samtaler. Begynn å snakke og se ordene dine bli oversatt umiddelbart."
                    },
                    "screenTranslationTab": {
                        "title": "Skjermoversettelse",
                        "message": "Skjermoversettelse fanger tekst fra skjermen din og oversetter den i sanntid. Flott for å oversette innhold fra spill, videoer eller applikasjoner."
                    },
                    "quickTranslateTab": {
                        "title": "Rask oversettelse",
                        "message": "Rask oversettelse gir deg umiddelbar oversettelse med en hurtigtast. Trykk Alt+C for å oversette valgt tekst raskt."
                    },
                    "soundBoardTab": {
                        "title": "Lydtavle",
                        "message": "Lydtavlen lar deg spille av lydklipp umiddelbart. Perfekt for raske svar eller lydeffekter under samtaler."
                    },
                    "profile": {
                        "title": "Profilseksjon",
                        "message": "Få tilgang til profilinnstillingene dine, kontoinformasjonen og logg ut herfra."
                    },
                    "settings": {
                        "title": "Innstillingsmeny",
                        "message": "Klikk på innstillingsknappen i sidefeltet for å få tilgang til alle applikasjonsinnstillinger. Vi viser deg hva som er inne neste."
                    },
                    "apiKeys": {
                        "title": "API-nøkkelkonfigurasjon",
                        "message": "Konfigurer API-nøklene dine her. Du trenger nøkler for OpenAI (Whisper), oversettelsestjenester og ElevenLabs for stemmesyntese."
                    },
                    "keybinds": {
                        "title": "Tastatursnarveier",
                        "message": "Dette er hvor du kan konfigurere tastatursnarveier for raske handlinger. Tilpass hurtigtastene dine for å passe til arbeidsflyten din."
                    },
                    "models": {
                        "title": "Modeller & Behandling",
                        "message": "Her kan du velge AI-modeller og justere behandlingsalternativer. Velg mellom sky- og lokal behandling, og finjuster modellparametere."
                    },
                    "accountSettings": {
                        "title": "Konto- og bakgrunnsinnstillinger",
                        "message": "I Konto-fanen kan du konfigurere systemstatusoppførsel og Paddle oppvarmingsinnstillinger. Aktiver \"Kjør i bakgrunnen\" for å minimere Whispra til systemstatusfeltet i stedet for å lukke det helt."
                    },
                    "screenBoxSelector": {
                        "title": "Skjermboksvelger",
                        "message": "Bruk Alt+Y (standard hurtigtast) for å aktivere skjermboksvelgeren. Dette lar deg velge spesifikke områder av skjermen din for målrettet oversettelse i stedet for å oversette hele skjermen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle oppvarmingsfunksjon",
                        "message": "Aktiver \"Paddle oppvarming ved oppstart\" for å forhåndslaste OCR-modeller når appen starter. Dette gjør skjermoversettelse raskere, men øker oppstartstiden. Du finner denne bryteren i Konto-innstillingsfanen."
                    },
                    "systemTray": {
                        "title": "Systemstatusfeltintegrasjon",
                        "message": "Når \"Kjør i bakgrunnen\" er aktivert, vil lukking av hovedvinduet minimere Whispra til systemstatusfeltet i stedet for å avslutte. Klikk på statusfeltikonet for å gjenopprette vinduet, eller høyreklikk for raske handlinger."
                    },
                    "expandedOverlay": {
                        "title": "Utvidet overlay",
                        "message": "Trykk F11 (eller din konfigurerte hurtigtast) for å åpne det utvidede overlayet - et flytende kontrollpanel som holder seg over andre applikasjoner. Perfekt for spill eller fullskjermsapper! Det inkluderer alle de samme funksjonene som er tilgjengelige uten å forlate den nåværende applikasjonen."
                    },
                    "hotkeys": {
                        "title": "Essensielle hurtigtaster",
                        "message": "Husk disse tastekombinasjonene: F11 for utvidet overlay, Alt+T for skjermoversettelse, Alt+Y for skjermboksvelger. Du kan tilpasse alle hurtigtaster i Innstillinger → Tastaturbindinger."
                    },
                    "finish": {
                        "title": "Du er klar!",
                        "message": "Det er alt! Du er klar til å begynne å bruke appen. Trykk F11 for å prøve det utvidede overlayet, og utforsk alle funksjonene for å tilpasse opplevelsen din."
                    },
                    "buttons": {
                        "skip": "Hopp over",
                        "back": "Tilbake",
                        "next": "Neste",
                        "closeTour": "Lukk omvisning"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Hurtigoversettelse",
                    "description": "Oversett tekst umiddelbart med AI-oversettelsestjenester",
                    "globalHotkey": "Global Hurtigtast:",
                    "translateTo": "Oversett Til",
                    "autoTranslate": "Auto-Oversett",
                    "translatesAsYouType": "Oversetter mens du skriver",
                    "clickTranslateOrPress": "Klikk Oversett eller trykk Ctrl+Enter",
                    "textToTranslate": "Tekst å Oversette",
                    "translationResult": "Oversettelsesresultat",
                    "translate": "Oversett",
                    "translating": "Oversetter...",
                    "clear": "Tøm",
                    "copyResult": "Kopier Resultat",
                    "readyToTranslate": "Klar til å oversette",
                    "typingDots": "Skriver...",
                    "translatingWord": "Oversetter ord...",
                    "translationCompleted": "Oversettelse fullført",
                    "translationFailed": "Oversettelse mislyktes",
                    "copiedToClipboard": "Oversettelse kopiert til utklippstavlen",
                    "pleaseEnterText": "Vennligst skriv inn tekst å oversette",
                    "autoTranslateEnabled": "Auto-oversettelse aktivert",
                    "autoTranslateDisabled": "Auto-oversettelse deaktivert - Klikk Oversett",
                    "enterTextPlaceholder": "Skriv inn tekst å oversette...",
                    "translationPlaceholder": "Oversettelsen vises her..."
                },
                "settingsModal": {
                    "title": "Innstillinger",
                    "runInBackground": "Kjør i bakgrunnen",
                    "close": "Lukk",
                    "tabs": {
                        "account": "Konto",
                        "apiKeys": "API-nøkler",
                        "models": "Modeller",
                        "cloudLocal": "Sky/Lokal",
                        "keybinds": "Hurtigtaster",
                        "themes": "Temaer",
                        "languageLibrary": "Språkbibliotek"
                    },
                    "keybinds": {
                        "title": "Hurtigtaster",
                        "description": "Konfigurer globale hurtigtaster for ulike funksjoner. Bidireksjonal og skjermoversettelse bruker {modifier} + tast. Klikk \"Endre\" for å sette en ny tast.",
                        "ptt": "Trykk for å snakke",
                        "pttDesc": "Hold denne tasten for å snakke (standard: Mellomrom, ingen Alt)",
                        "bidirectional": "Veksle bidireksjonal",
                        "bidirectionalDesc": "Trykk {modifier} + denne tasten for å veksle bidireksjonal modus (standard: B)",
                        "screenTranslation": "Skjermoversettelse",
                        "screenTranslationDesc": "Trykk {modifier} + denne tasten for å ta skjermbilde (standard: T)",
                        "screenTranslationBox": "Skjermoversettelse boks",
                        "screenTranslationBoxDesc": "Trykk {modifier} + denne tasten for å velge boksområde for oversettelse (standard: Y)",
                        "overlayToggle": "Veksle overlegg",
                        "overlayToggleDesc": "Trykk denne tasten for å veksle overlegg (standard: F11, ingen Alt)",
                        "quickTranslation": "Hurtigoversettelse",
                        "quickTranslationLocked": "Denne hurtigtasten er fast og kan ikke endres",
                        "change": "Endre",
                        "locked": "Låst",
                        "tip": "Trykk for å snakke og veksle overlegg trenger ikke {modifier}. Bidireksjonal og skjermoversettelse krever {modifier} + tast. Trykk ESC for å avbryte.",
                        "changeTitle": "Endre {label}",
                        "changeDescAlt": "Trykk en tast for å sette som {modifier} + [din tast]. {modifier} legges til automatisk. Trykk ESC for å avbryte.",
                        "changeDescNoAlt": "Trykk en tast (funksjonstaster anbefales). Ingen modifikatorer nødvendig. Trykk ESC for å avbryte.",
                        "waitingForInput": "Venter på input..."
                    },
                    "themes": {
                        "title": "Temavalg",
                        "description": "Velg ditt foretrukne grensesnitttema. Endringer gjelder umiddelbart.",
                        "active": "Aktiv",
                        "select": "Velg"
                    },
                    "account": {
                        "title": "Konto",
                        "profile": "Profil",
                        "subscription": "Abonnement",
                        "usage": "Bruk",
                        "preferences": "Preferanser",
                        "email": "E-post",
                        "plan": "Plan",
                        "trialDays": "Gjenværende prøvedager",
                        "status": "Status",
                        "spokenLanguage": "Språk du snakker",
                        "rememberResponses": "Lagre API-svar",
                        "rememberResponsesDesc": "Lagre API-svar for brukssporing og feilsøking. Deaktiver for økt personvern.",
                        "usageUsed": "Brukt denne måneden",
                        "usageRemaining": "gjenstående",
                        "usageLoading": "Laster bruksdata...",
                        "usageError": "Kan ikke laste bruksdata",
                        "usageWarningHigh": "⚠️ Høy bruk denne måneden",
                        "usageWarningLimit": "⚠️ Nærmer seg bruksgrense",
                        "openDashboard": "Administrer abonnement",
                        "signOut": "Logg ut",
                        "opening": "Åpner...",
                        "error": "Kunne ikke åpne kontopanel. Vennligst besøk account.whispra.xyz manuelt.",
                        "loading": "Laster kontoinformasjon...",
                        "trial": "7-dagers gratis prøveperiode",
                        "active": "Aktivt abonnement",
                        "expired": "Utløpt"
                    }
                }
            },'da': {
                "tab": {
                    "translation": "Oversættelse",
                    "bidirectional": "Bidirektional",
                    "soundboard": "Lydtavle",
                    "settings": "Indstillinger"
                },
                "sidebar": {
                    "translate": "Oversæt",
                    "bidirectional": "Bidirektional",
                    "screenTranslation": "Skærmoversættelse",
                    "soundBoard": "Lydtavle",
                    "voiceFilter": "Stemmefilter",
                    "settings": "Indstillinger",
                    "logs": "Logfiler",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Oversæt",
                    "screenTranslate": "Skærmoversæt",
                    "quickTranslate": "Hurtig Oversæt",
                    "help": "Hjælp"
                },
                "soundboard": {
                    "panel": {
                        "title": "Lydtavle",
                        "description": "Afspil tilpassede lyde og lydklip under samtaler"
                    },
                    "controls": {
                        "outputDevice": "Output-enhed",
                        "vbAudioVolume": "VB Audio Volume",
                        "headphonesVolume": "Hovedtelefonvolumen",
                        "soundPadGrid": "Lydpad Gitter",
                        "enableHotkeys": "Aktiver lydtavle genvejstaster",
                        "addSoundFiles": "Tilføj lydfiler",
                        "webOverlay": "Web Overlay",
                        "stopAllSounds": "Stop alle lyde"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Vælg output-enhed...",
                        "defaultSystemOutput": "Standard systemoutput",
                        "virtualAudioCable": "Virtuel lydkabel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidirektional tilstand"
                    },
                    "controls": {
                        "startBidirectional": "Start bidirektional",
                        "stopBidirectional": "Stop bidirektional",
                        "keybind": "Oversæt til",
                        "toggleWith": "Skift med",
                        "changeKey": "Ændre nøgle",
                        "outputDevice": "Output-enhed",
                        "systemInput": "Systeminput",
                        "incomingVoice": "Indkommende stemme",
                        "sourceLanguage": "Kildesprog",
                        "appSelection": "App-valg"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Indlæser output-enheder...",
                        "loadingVoices": "Indlæser stemmer...",
                        "displaySystemAudio": "Vis/Systemlyd (Standard)"
                    },
                    "status": {
                        "idle": "Inaktiv",
                        "waiting": "Venter...",
                        "ready": "Klar...",
                        "starting": "Starter...",
                        "stopping": "Stopper..."
                    },
                    "labels": {
                        "detectedTarget": "Registreret (Kildesprog)",
                        "respoken": "Genudtalt (Oversæt til)"
                    }
                },
                "header": {
                    "signOut": "Log ud"
                },
                "footer": {
                    "becomeAffiliate": "Bliv Affiliate",
                    "reportBug": "Rapporter Fejl / Foreslå Funktion"
                },
                "settings": {
                    "modal": {
                        "title": "Sikker API-konfiguration",
                        "close": "Luk"
                    },
                    "instructions": {
                        "title": "API-nøgle opsætningsinstruktioner",
                        "openaiTitle": "OpenAI API-nøgle",
                        "openaiPermissions": "Læserettigheder: Modeller, Funktioner",
                        "openaiUsage": "Bruges til tale-til-tekst og tekst-til-tale oversættelse",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API-nøgle",
                        "elevenlabsRestrict": "Begræns nøgle: Aktiveret",
                        "elevenlabsNoAccess": "Alt andet: Ingen adgang",
                        "elevenlabsTts": "Tekst til tale: Adgang",
                        "elevenlabsSts": "Tale til tale: Adgang",
                        "elevenlabsAgents": "ElevenLabs agenter: Skriv",
                        "elevenlabsVoices": "Stemmer: Skriv",
                        "elevenlabsVoiceGen": "Stemmegenerering: Adgang",
                        "elevenlabsUser": "Bruger: Læs",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API-nøgle:",
                        "openaiPlaceholder": "Indtast din OpenAI API-nøgle",
                        "openaiStored": "Nøgle gemt sikkert",
                        "openaiHelp": "Indtast din OpenAI API-nøgle (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API-nøgle:",
                        "elevenlabsPlaceholder": "Indtast din ElevenLabs API-nøgle",
                        "elevenlabsStored": "Nøgle gemt sikkert",
                        "elevenlabsHelp": "Indtast din ElevenLabs API-nøgle (32 tegn)"
                    },
                    "buttons": {
                        "showKey": "Vis nøgle",
                        "removeKey": "Fjern nøgle",
                        "clearAll": "Ryd alle nøgler",
                        "cancel": "Annuller",
                        "save": "Gem"
                    },
                    "status": {
                        "keyStored": "✓ Nøgle gemt sikkert"
                    },
                    "links": {
                        "openai": "Generer nøgle på: platform.openai.com/api-keys",
                        "elevenlabs": "Generer nøgle på: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Oversæt til",
                    "voice": "Stemme",
                    "output": "Output",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Start oversættelse",
                    "stopTranslation": "Stop oversættelse",
                    "addCustomVoice": "Tilføj tilpasset stemme",
                    "accent": "Accent",
                    "noAccent": "Ingen accent",
                    "accentOn": "Accent: TIL",
                    "accentOff": "Accent: FRA"
                },
                "placeholders": {
                    "selectMicrophone": "Vælg mikrofon...",
                    "loadingVoices": "Indlæser stemmer...",
                    "selectVoice": "Vælg stemme...",
                    "enterCustomAccent": "Indtast tilpasset accent...",
                    "selectPreset": "Vælg forudindstilling..."
                },
                "keys": {
                    "space": "MELLEMRUM",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Velkommen til Whispra!",
                        "message": "Velkommen til appen! Lad os hurtigt gennemgå hovedgrænsefladen."
                    },
                    "sidebar": {
                        "title": "Venstre sidebar navigation",
                        "message": "Dette er din hovednavigationslinje. Brug den til at skifte mellem forskellige funktioner som Whispra Translate, Skærmoversættelse, Hurtig oversættelse og mere."
                    },
                    "translateTab": {
                        "title": "Oversæt fanen",
                        "message": "Oversæt fanen er dit hovedarbejdsområde for realtidsoversættelse. Begynd at tale og se dine ord blive oversat øjeblikkeligt."
                    },
                    "bidirectionalTab": {
                        "title": "Bidirektional tilstand",
                        "message": "Bidirektional tilstand oversætter samtaler i begge retninger automatisk. Perfekt til naturlig frem-og-tilbage dialog."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate-fane",
                        "message": "Whispra Translate-fanen kombinerer realtidsoversættelse og bidirektional tilstand i ét forenet interface. Brug venstre panel til envejs oversættelse og højre panel til bidirektionale samtaler. Begynd at tale og se dine ord blive oversat øjeblikkeligt."
                    },
                    "screenTranslationTab": {
                        "title": "Skærmoversættelse",
                        "message": "Skærmoversættelse fanger tekst fra din skærm og oversætter den i realtid. Fantastisk til at oversætte indhold fra spil, videoer eller applikationer."
                    },
                    "quickTranslateTab": {
                        "title": "Hurtig oversættelse",
                        "message": "Hurtig oversættelse giver dig øjeblikkelig oversættelse med en genvejstast. Tryk på Alt+C for hurtigt at oversætte valgt tekst."
                    },
                    "soundBoardTab": {
                        "title": "Lydtavle",
                        "message": "Lydtavlen lader dig afspille lydklip øjeblikkeligt. Perfekt til hurtige svar eller lydeffekter under samtaler."
                    },
                    "profile": {
                        "title": "Profilsektion",
                        "message": "Få adgang til dine profilindstillinger, kontoinformation og log ud herfra."
                    },
                    "settings": {
                        "title": "Indstillingsmenu",
                        "message": "Klik på indstillingsknappen i sidepanelet for at få adgang til alle applikationsindstillinger. Vi viser dig, hvad der er indeni næste."
                    },
                    "apiKeys": {
                        "title": "API-nøgler konfiguration",
                        "message": "Konfigurer dine API-nøgler her. Du får brug for nøgler til OpenAI (Whisper), oversættelsestjenester og ElevenLabs til stemmesyntese."
                    },
                    "keybinds": {
                        "title": "Tastaturgenveje",
                        "message": "Dette er, hvor du kan konfigurere tastaturgenveje til hurtige handlinger. Tilpas dine genvejstaster til at passe til dit arbejdsgang."
                    },
                    "models": {
                        "title": "Modeller & Behandling",
                        "message": "Her kan du vælge AI-modeller og justere behandlingsmuligheder. Vælg mellem cloud og lokal behandling, og finjuster modelparametre."
                    },
                    "accountSettings": {
                        "title": "Konto & Baggrundsindstillinger",
                        "message": "I fanen Konto kan du konfigurere systembakkeadfærd og Paddle opvarmningsindstillinger. Aktiver \"Kør i baggrunden\" for at minimere Whispra til systembakken i stedet for at lukke den helt."
                    },
                    "screenBoxSelector": {
                        "title": "Skærmboksvælger",
                        "message": "Brug Alt+Y (standard genvejstast) til at aktivere skærmboksvælgeren. Dette lader dig vælge specifikke områder af din skærm til målrettet oversættelse i stedet for at oversætte hele skærmen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle opvarmningsfunktion",
                        "message": "Aktiver \"Paddle opvarmning ved opstart\" for at forindlæse OCR-modeller, når appen starter. Dette gør skærmoversættelse hurtigere, men øger opstartstiden. Du kan finde denne indstilling i fanen Konto."
                    },
                    "systemTray": {
                        "title": "Systembakkeintegration",
                        "message": "Når \"Kør i baggrunden\" er aktiveret, vil lukning af hovedvinduet minimere Whispra til din systembakke i stedet for at afslutte. Klik på bakkeikonet for at gendanne vinduet, eller højreklik for hurtige handlinger."
                    },
                    "expandedOverlay": {
                        "title": "Udvidet overlay",
                        "message": "Tryk på F11 (eller din konfigurerede genvejstast) for at åbne det udvidede overlay - et flydende kontrolpanel, der forbliver oven på andre applikationer. Perfekt til gaming eller fuldskærmsapps! Det inkluderer alle de samme funktioner, der er tilgængelige uden at forlade din nuværende applikation."
                    },
                    "hotkeys": {
                        "title": "Vigtige genvejstaster",
                        "message": "Husk disse tastaturgenveje: F11 for Udvidet overlay, Alt+T for Skærmoversættelse, Alt+Y for Skærmboksvælger. Du kan tilpasse alle genvejstaster i Indstillinger → Genvejstaster."
                    },
                    "finish": {
                        "title": "Du er klar!",
                        "message": "Det var det! Du er klar til at begynde at bruge appen. Tryk på F11 for at prøve det udvidede overlay, og udforsk alle funktionerne for at tilpasse din oplevelse."
                    },
                    "buttons": {
                        "skip": "Spring over",
                        "back": "Tilbage",
                        "next": "Næste",
                        "closeTour": "Luk tur"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Hurtig Oversættelse",
                    "description": "Oversæt tekst øjeblikkeligt med AI-oversættelsestjenester",
                    "globalHotkey": "Global Genvejstast:",
                    "translateTo": "Oversæt Til",
                    "autoTranslate": "Auto-Oversæt",
                    "translatesAsYouType": "Oversætter mens du skriver",
                    "clickTranslateOrPress": "Klik Oversæt eller tryk Ctrl+Enter",
                    "textToTranslate": "Tekst at Oversætte",
                    "translationResult": "Oversættelsesresultat",
                    "translate": "Oversæt",
                    "translating": "Oversætter...",
                    "clear": "Ryd",
                    "copyResult": "Kopier Resultat",
                    "readyToTranslate": "Klar til at oversætte",
                    "typingDots": "Skriver...",
                    "translatingWord": "Oversætter ord...",
                    "translationCompleted": "Oversættelse fuldført",
                    "translationFailed": "Oversættelse mislykkedes",
                    "copiedToClipboard": "Oversættelse kopieret til udklipsholder",
                    "pleaseEnterText": "Indtast venligst tekst at oversætte",
                    "autoTranslateEnabled": "Auto-oversættelse aktiveret",
                    "autoTranslateDisabled": "Auto-oversættelse deaktiveret - Klik Oversæt",
                    "enterTextPlaceholder": "Indtast tekst at oversætte...",
                    "translationPlaceholder": "Oversættelsen vises her..."
                },
                "settingsModal": {
                    "title": "Indstillinger",
                    "runInBackground": "Kør i baggrunden",
                    "close": "Luk",
                    "tabs": {
                        "account": "Konto",
                        "apiKeys": "API-nøgler",
                        "models": "Modeller",
                        "cloudLocal": "Sky/Lokal",
                        "keybinds": "Genvejstaster",
                        "themes": "Temaer",
                        "languageLibrary": "Sprogbibliotek"
                    },
                    "keybinds": {
                        "title": "Genvejstaster",
                        "description": "Konfigurer globale genvejstaster til forskellige funktioner. Bidirektional og skærmoversættelse bruger {modifier} + tast. Klik \"Skift\" for at indstille en ny tast.",
                        "ptt": "Tryk for at tale",
                        "pttDesc": "Hold denne tast for at tale (standard: Mellemrum, ingen Alt)",
                        "bidirectional": "Skift bidirektional",
                        "bidirectionalDesc": "Tryk {modifier} + denne tast for at skifte bidirektional tilstand (standard: B)",
                        "screenTranslation": "Skærmoversættelse",
                        "screenTranslationDesc": "Tryk {modifier} + denne tast for at tage skærmbillede (standard: T)",
                        "screenTranslationBox": "Skærmoversættelse boks",
                        "screenTranslationBoxDesc": "Tryk {modifier} + denne tast for at vælge boksområde til oversættelse (standard: Y)",
                        "overlayToggle": "Skift overlay",
                        "overlayToggleDesc": "Tryk denne tast for at skifte overlay (standard: F11, ingen Alt)",
                        "quickTranslation": "Hurtig oversættelse",
                        "quickTranslationLocked": "Denne genvejstast er fast og kan ikke ændres",
                        "change": "Skift",
                        "locked": "Låst",
                        "tip": "Tryk for at tale og skift overlay behøver ikke {modifier}. Bidirektional og skærmoversættelse kræver {modifier} + tast. Tryk ESC for at annullere.",
                        "changeTitle": "Skift {label}",
                        "changeDescAlt": "Tryk en tast for at indstille som {modifier} + [din tast]. {modifier} tilføjes automatisk. Tryk ESC for at annullere.",
                        "changeDescNoAlt": "Tryk en tast (funktionstaster anbefales). Ingen modifikatorer nødvendige. Tryk ESC for at annullere.",
                        "waitingForInput": "Venter på input..."
                    },
                    "themes": {
                        "title": "Temavalg",
                        "description": "Vælg dit foretrukne grænsefladetema. Ændringer træder i kraft med det samme.",
                        "active": "Aktiv",
                        "select": "Vælg"
                    },
                    "account": {
                        "title": "Konto",
                        "profile": "Profil",
                        "subscription": "Abonnement",
                        "usage": "Forbrug",
                        "preferences": "Præferencer",
                        "email": "E-mail",
                        "plan": "Plan",
                        "trialDays": "Resterende prøvedage",
                        "status": "Status",
                        "spokenLanguage": "Sprog du taler",
                        "rememberResponses": "Gem API-svar",
                        "rememberResponsesDesc": "Gem API-svar til forbrugssporing og fejlfinding. Deaktiver for øget privatliv.",
                        "usageUsed": "Brugt denne måned",
                        "usageRemaining": "tilbage",
                        "usageLoading": "Indlæser forbrugsdata...",
                        "usageError": "Kan ikke indlæse forbrugsdata",
                        "usageWarningHigh": "⚠️ Højt forbrug denne måned",
                        "usageWarningLimit": "⚠️ Nærmer sig forbrugsgrænse",
                        "openDashboard": "Administrer abonnement",
                        "signOut": "Log ud",
                        "opening": "Åbner...",
                        "error": "Kunne ikke åbne kontopanel. Besøg venligst account.whispra.xyz manuelt.",
                        "loading": "Indlæser kontoinformation...",
                        "trial": "7-dages gratis prøveperiode",
                        "active": "Aktivt abonnement",
                        "expired": "Udløbet"
                    }
                }
            },'sv': {
                "tab": {
                    "translation": "Översättning",
                    "bidirectional": "Bidirectional",
                    "soundboard": "Ljudtavla",
                    "settings": "Inställningar"
                },
                "sidebar": {
                    "translate": "Översätt",
                    "bidirectional": "Bidirectional",
                    "screenTranslation": "Skärmöversättning",
                    "soundBoard": "Ljudtavla",
                    "voiceFilter": "Röstfilter",
                    "settings": "Inställningar",
                    "logs": "Loggar",
                    "menu": "Meny",
                    "whispraTranslate": "Whispra Översätt",
                    "screenTranslate": "Skärmöversätt",
                    "quickTranslate": "Snabböversätt",
                    "help": "Hjälp"
                },
                "soundboard": {
                    "panel": {
                        "title": "Ljudtavla",
                        "description": "Spela upp anpassade ljud och ljudklipp under samtal"
                    },
                    "controls": {
                        "outputDevice": "Utmatningsenhet",
                        "vbAudioVolume": "VB Audio Volym",
                        "headphonesVolume": "Hörlursvolym",
                        "soundPadGrid": "Ljudpad-rutnät",
                        "enableHotkeys": "Aktivera ljudtavla genvägar",
                        "addSoundFiles": "Lägg till ljudfiler",
                        "webOverlay": "Webböverlägg",
                        "stopAllSounds": "Stoppa alla ljud"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Välj utmatningsenhet...",
                        "defaultSystemOutput": "Standard systemutmatning",
                        "virtualAudioCable": "Virtuell ljudkabel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidirectional-läge"
                    },
                    "controls": {
                        "startBidirectional": "Starta Bidirectional",
                        "stopBidirectional": "Stoppa Bidirectional",
                        "keybind": "Översätt till",
                        "toggleWith": "Växla med",
                        "changeKey": "Ändra tangent",
                        "outputDevice": "Utmatningsenhet",
                        "systemInput": "Systemingång",
                        "incomingVoice": "Inkommande röst",
                        "sourceLanguage": "Källspråk",
                        "appSelection": "Appval"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Laddar utmatningsenheter...",
                        "loadingVoices": "Laddar röster...",
                        "displaySystemAudio": "Visa/systemljud (Standard)"
                    },
                    "status": {
                        "idle": "Inaktiv",
                        "waiting": "Väntar...",
                        "ready": "Klar...",
                        "starting": "Startar...",
                        "stopping": "Stoppar..."
                    },
                    "labels": {
                        "detectedTarget": "Upptäckt (Källspråk)",
                        "respoken": "Återberättad (Översätt till)"
                    }
                },
                "header": {
                    "signOut": "Logga ut"
                },
                "footer": {
                    "becomeAffiliate": "Bli Affiliate",
                    "reportBug": "Rapportera Bugg / Föreslå Funktion"
                },
                "settings": {
                    "modal": {
                        "title": "Säker API-konfiguration",
                        "close": "Stäng"
                    },
                    "instructions": {
                        "title": "Instruktioner för API-nyckelinställning",
                        "openaiTitle": "OpenAI API-nyckel",
                        "openaiPermissions": "Läsbehörigheter: Modeller, Funktioner",
                        "openaiUsage": "Används för tal-till-text och text-till-tal översättning",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API-nyckel",
                        "elevenlabsRestrict": "Begränsa nyckel: Aktiverad",
                        "elevenlabsNoAccess": "Allt annat: Ingen åtkomst",
                        "elevenlabsTts": "Text till tal: Åtkomst",
                        "elevenlabsSts": "Tal till tal: Åtkomst",
                        "elevenlabsAgents": "ElevenLabs-agenter: Skriv",
                        "elevenlabsVoices": "Röster: Skriv",
                        "elevenlabsVoiceGen": "Röstgenerering: Åtkomst",
                        "elevenlabsUser": "Användare: Läs",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API-nyckel:",
                        "openaiPlaceholder": "Ange din OpenAI API-nyckel",
                        "openaiStored": "Nyckel lagrad säkert",
                        "openaiHelp": "Ange din OpenAI API-nyckel (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API-nyckel:",
                        "elevenlabsPlaceholder": "Ange din ElevenLabs API-nyckel",
                        "elevenlabsStored": "Nyckel lagrad säkert",
                        "elevenlabsHelp": "Ange din ElevenLabs API-nyckel (32 tecken)"
                    },
                    "buttons": {
                        "showKey": "Visa nyckel",
                        "removeKey": "Ta bort nyckel",
                        "clearAll": "Rensa alla nycklar",
                        "cancel": "Avbryt",
                        "save": "Spara"
                    },
                    "status": {
                        "keyStored": "✓ Nyckel lagrad säkert"
                    },
                    "links": {
                        "openai": "Generera nyckel på: platform.openai.com/api-keys",
                        "elevenlabs": "Generera nyckel på: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Översätt till",
                    "voice": "Röst",
                    "output": "Utmatning",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Starta översättning",
                    "stopTranslation": "Stoppa översättning",
                    "addCustomVoice": "Lägg till anpassad röst",
                    "accent": "Accent",
                    "noAccent": "Ingen accent",
                    "accentOn": "Accent: PÅ",
                    "accentOff": "Accent: AV"
                },
                "placeholders": {
                    "selectMicrophone": "Välj mikrofon...",
                    "loadingVoices": "Laddar röster...",
                    "selectVoice": "Välj röst...",
                    "enterCustomAccent": "Ange anpassad accent...",
                    "selectPreset": "Välj förinställning..."
                },
                "keys": {
                    "space": "MELLANSLAG",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Skift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Välkommen till Whispra!",
                        "message": "Välkommen till appen! Låt oss snabbt gå igenom huvudgränssnittet."
                    },
                    "sidebar": {
                        "title": "Navigering i vänster sidofält",
                        "message": "Detta är din huvudnavigeringsfält. Använd det för att växla mellan olika funktioner som Whispra Translate, Skärmöversättning, Snabböversättning och mer."
                    },
                    "translateTab": {
                        "title": "Översätt-flik",
                        "message": "Översätt-fliken är din huvudarbetsyta för realtidsöversättning. Börja prata och se dina ord översättas omedelbart."
                    },
                    "bidirectionalTab": {
                        "title": "Bidirectional-läge",
                        "message": "Bidirectional-läget översätter samtal i båda riktningar automatiskt. Perfekt för naturlig dialog fram och tillbaka."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate-flik",
                        "message": "Whispra Translate-fliken kombinerar realtidsöversättning och bidirectional-läge i ett enhetligt gränssnitt. Använd vänster panel för enkelriktad översättning och höger panel för bidirektionala samtal. Börja prata och se dina ord översättas omedelbart."
                    },
                    "screenTranslationTab": {
                        "title": "Skärmöversättning",
                        "message": "Skärmöversättning fångar text från din skärm och översätter den i realtid. Utmärkt för att översätta innehåll från spel, videor eller applikationer."
                    },
                    "quickTranslateTab": {
                        "title": "Snabböversättning",
                        "message": "Snabböversättning ger dig omedelbar översättning med en tangentbordsgenväg. Tryck på Alt+C för att snabbt översätta markerad text."
                    },
                    "soundBoardTab": {
                        "title": "Ljudtavla",
                        "message": "Ljudtavlan låter dig spela upp ljudklipp omedelbart. Perfekt för snabba svar eller ljudeffekter under samtal."
                    },
                    "profile": {
                        "title": "Profilavsnitt",
                        "message": "Åtkomst till dina profilinställningar, kontoinformation och logga ut härifrån."
                    },
                    "settings": {
                        "title": "Inställningsmeny",
                        "message": "Klicka på inställningsknappen i sidofältet för att få åtkomst till alla applikationsinställningar. Vi visar dig vad som finns inuti nästa."
                    },
                    "apiKeys": {
                        "title": "API-nyckelkonfiguration",
                        "message": "Konfigurera dina API-nycklar här. Du behöver nycklar för OpenAI (Whisper), översättningstjänster och ElevenLabs för röstsyntes."
                    },
                    "keybinds": {
                        "title": "Tangentbordsgenvägar",
                        "message": "Detta är där du kan konfigurera tangentbordsgenvägar för snabba åtgärder. Anpassa dina genvägar för att passa ditt arbetsflöde."
                    },
                    "models": {
                        "title": "Modeller & Bearbetning",
                        "message": "Här kan du välja AI-modeller och justera bearbetningsalternativ. Välj mellan moln- och lokal bearbetning, och finjustera modellparametrar."
                    },
                    "accountSettings": {
                        "title": "Kontoinställningar & Bakgrundsinställningar",
                        "message": "I fliken Konto kan du konfigurera systemfältbeteende och Paddle-värmningsinställningar. Aktivera \"Kör i bakgrunden\" för att minimera Whispra till systemfältet istället för att stänga det helt."
                    },
                    "screenBoxSelector": {
                        "title": "Skärmboxväljare",
                        "message": "Använd Alt+Y (standardgenväg) för att aktivera skärmboxväljaren. Detta låter dig välja specifika områden av din skärm för riktad översättning istället för att översätta hela skärmen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle Värmningsfunktion",
                        "message": "Aktivera \"Paddle Warmup vid start\" för att förladda OCR-modeller när appen startar. Detta gör skärmöversättning snabbare men ökar starttiden. Du kan hitta denna växlingsknapp i fliken Kontoinställningar."
                    },
                    "systemTray": {
                        "title": "Systemfältintegration",
                        "message": "När \"Kör i bakgrunden\" är aktiverat kommer stängning av huvudfönstret att minimera Whispra till ditt systemfält istället för att avsluta. Klicka på fältikonen för att återställa fönstret, eller högerklicka för snabba åtgärder."
                    },
                    "expandedOverlay": {
                        "title": "Utökat överlägg",
                        "message": "Tryck på F11 (eller din konfigurerade genväg) för att öppna det utökade överlägget - en flytande kontrollpanel som ligger ovanpå andra applikationer. Perfekt för spel eller helskärmsappar! Den innehåller alla samma funktioner som är tillgängliga utan att lämna din nuvarande applikation."
                    },
                    "hotkeys": {
                        "title": "Viktiga genvägar",
                        "message": "Kom ihåg dessa tangentgenvägar: F11 för Utökat överlägg, Alt+T för Skärmöversättning, Alt+Y för Skärmboxväljare. Du kan anpassa alla genvägar i Inställningar → Tangentbindningar."
                    },
                    "finish": {
                        "title": "Du är redo!",
                        "message": "Det är allt! Du är redo att börja använda appen. Tryck på F11 för att prova det utökade överlägget och utforska alla funktioner för att anpassa din upplevelse."
                    },
                    "buttons": {
                        "skip": "Hoppa över",
                        "back": "Tillbaka",
                        "next": "Nästa",
                        "closeTour": "Stäng rundtur"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Snabböversättning",
                    "description": "Översätt text direkt med AI-översättningstjänster",
                    "globalHotkey": "Global Snabbtangent:",
                    "translateTo": "Översätt Till",
                    "autoTranslate": "Auto-Översätt",
                    "translatesAsYouType": "Översätter medan du skriver",
                    "clickTranslateOrPress": "Klicka Översätt eller tryck Ctrl+Enter",
                    "textToTranslate": "Text att Översätta",
                    "translationResult": "Översättningsresultat",
                    "translate": "Översätt",
                    "translating": "Översätter...",
                    "clear": "Rensa",
                    "copyResult": "Kopiera Resultat",
                    "readyToTranslate": "Redo att översätta",
                    "typingDots": "Skriver...",
                    "translatingWord": "Översätter ord...",
                    "translationCompleted": "Översättning klar",
                    "translationFailed": "Översättning misslyckades",
                    "copiedToClipboard": "Översättning kopierad till urklipp",
                    "pleaseEnterText": "Ange text att översätta",
                    "autoTranslateEnabled": "Auto-översättning aktiverad",
                    "autoTranslateDisabled": "Auto-översättning inaktiverad - Klicka Översätt",
                    "enterTextPlaceholder": "Ange text att översätta...",
                    "translationPlaceholder": "Översättningen visas här..."
                },
                "settingsModal": {
                    "title": "Inställningar",
                    "runInBackground": "Kör i bakgrunden",
                    "close": "Stäng",
                    "tabs": {
                        "account": "Konto",
                        "apiKeys": "API-nycklar",
                        "models": "Modeller",
                        "cloudLocal": "Moln/Lokal",
                        "keybinds": "Snabbtangenter",
                        "themes": "Teman",
                        "languageLibrary": "Språkbibliotek"
                    },
                    "keybinds": {
                        "title": "Snabbtangenter",
                        "description": "Konfigurera globala snabbtangenter för olika funktioner. Bidirektionell och skärmöversättning använder {modifier} + tangent. Klicka \"Ändra\" för att ställa in en ny tangent.",
                        "ptt": "Tryck för att prata",
                        "pttDesc": "Håll denna tangent för att prata (standard: Mellanslag, ingen Alt)",
                        "bidirectional": "Växla bidirektionell",
                        "bidirectionalDesc": "Tryck {modifier} + denna tangent för att växla bidirektionellt läge (standard: B)",
                        "screenTranslation": "Skärmöversättning",
                        "screenTranslationDesc": "Tryck {modifier} + denna tangent för att ta skärmdump (standard: T)",
                        "screenTranslationBox": "Skärmöversättning ruta",
                        "screenTranslationBoxDesc": "Tryck {modifier} + denna tangent för att välja rutområde för översättning (standard: Y)",
                        "overlayToggle": "Växla överlägg",
                        "overlayToggleDesc": "Tryck denna tangent för att växla överlägg (standard: F11, ingen Alt)",
                        "quickTranslation": "Snabböversättning",
                        "quickTranslationLocked": "Denna snabbtangent är fast och kan inte ändras",
                        "change": "Ändra",
                        "locked": "Låst",
                        "tip": "Tryck för att prata och växla överlägg behöver inte {modifier}. Bidirektionell och skärmöversättning kräver {modifier} + tangent. Tryck ESC för att avbryta.",
                        "changeTitle": "Ändra {label}",
                        "changeDescAlt": "Tryck valfri tangent för att ställa in som {modifier} + [din tangent]. {modifier} läggs till automatiskt. Tryck ESC för att avbryta.",
                        "changeDescNoAlt": "Tryck valfri tangent (funktionstangenter rekommenderas). Inga modifierare behövs. Tryck ESC för att avbryta.",
                        "waitingForInput": "Väntar på input..."
                    },
                    "themes": {
                        "title": "Temaval",
                        "description": "Välj ditt föredragna gränssnittstema. Ändringar tillämpas omedelbart.",
                        "active": "Aktiv",
                        "select": "Välj"
                    },
                    "account": {
                        "title": "Konto",
                        "profile": "Profil",
                        "subscription": "Prenumeration",
                        "usage": "Användning",
                        "preferences": "Inställningar",
                        "email": "E-post",
                        "plan": "Plan",
                        "trialDays": "Återstående provdagar",
                        "status": "Status",
                        "spokenLanguage": "Språk du talar",
                        "rememberResponses": "Spara API-svar",
                        "rememberResponsesDesc": "Spara API-svar för användningsspårning och felsökning. Inaktivera för ökad integritet.",
                        "usageUsed": "Använt denna månad",
                        "usageRemaining": "kvar",
                        "usageLoading": "Laddar användningsdata...",
                        "usageError": "Kan inte ladda användningsdata",
                        "usageWarningHigh": "⚠️ Hög användning denna månad",
                        "usageWarningLimit": "⚠️ Närmar sig användningsgräns",
                        "openDashboard": "Hantera prenumeration",
                        "signOut": "Logga ut",
                        "opening": "Öppnar...",
                        "error": "Kunde inte öppna kontopanel. Besök account.whispra.xyz manuellt.",
                        "loading": "Laddar kontoinformation...",
                        "trial": "7-dagars gratis provperiod",
                        "active": "Aktiv prenumeration",
                        "expired": "Utgången"
                    }
                }
            },'nl': {
                "tab": {
                    "translation": "Vertaling",
                    "bidirectional": "Bidirectioneel",
                    "soundboard": "Geluidspaneel",
                    "settings": "Instellingen"
                },
                "sidebar": {
                    "translate": "Vertalen",
                    "bidirectional": "Bidirectioneel",
                    "screenTranslation": "Schermvertaling",
                    "soundBoard": "Geluidspaneel",
                    "voiceFilter": "Stemfilter",
                    "settings": "Instellingen",
                    "logs": "Logboeken",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Vertalen",
                    "screenTranslate": "Schermvertalen",
                    "quickTranslate": "Snel Vertalen",
                    "help": "Help"
                },
                "soundboard": {
                    "panel": {
                        "title": "Geluidspaneel",
                        "description": "Speel aangepaste geluiden en audioclips tijdens gesprekken"
                    },
                    "controls": {
                        "outputDevice": "Uitvoerapparaat",
                        "vbAudioVolume": "VB Audio Volume",
                        "headphonesVolume": "Hoofdtelefoonvolume",
                        "soundPadGrid": "Geluidspad Raster",
                        "enableHotkeys": "Schakel sneltoetsen voor geluidspaneel in",
                        "addSoundFiles": "Voeg geluidsbestanden toe",
                        "webOverlay": "Web-overlay",
                        "stopAllSounds": "Stop alle geluiden"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Selecteer uitvoerapparaat...",
                        "defaultSystemOutput": "Standaard systeemuitvoer",
                        "virtualAudioCable": "Virtuele audiokabel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidirectionele modus"
                    },
                    "controls": {
                        "startBidirectional": "Start bidirectioneel",
                        "stopBidirectional": "Stop bidirectioneel",
                        "keybind": "Vertalen naar",
                        "toggleWith": "Wisselen met",
                        "changeKey": "Verander toets",
                        "outputDevice": "Uitvoerapparaat",
                        "systemInput": "Systeeminvoer",
                        "incomingVoice": "Binnenkomende stem",
                        "sourceLanguage": "Brontaal",
                        "appSelection": "App-selectie"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Uitvoerapparaten laden...",
                        "loadingVoices": "Stemmen laden...",
                        "displaySystemAudio": "Weergave/Systeemgeluid (Standaard)"
                    },
                    "status": {
                        "idle": "Inactief",
                        "waiting": "Wachten...",
                        "ready": "Klaar...",
                        "starting": "Bezig met starten...",
                        "stopping": "Bezig met stoppen..."
                    },
                    "labels": {
                        "detectedTarget": "Gedetecteerd (Brontaal)",
                        "respoken": "Herhaald (Vertalen naar)"
                    }
                },
                "header": {
                    "signOut": "Afmelden"
                },
                "footer": {
                    "becomeAffiliate": "Word Affiliate",
                    "reportBug": "Bug Melden / Functie Voorstellen"
                },
                "settings": {
                    "modal": {
                        "title": "Veilige API-configuratie",
                        "close": "Sluiten"
                    },
                    "instructions": {
                        "title": "Instructies voor API-sleutelinstelling",
                        "openaiTitle": "OpenAI API-sleutel",
                        "openaiPermissions": "Leesrechten: Modellen, Capaciteiten",
                        "openaiUsage": "Gebruikt voor spraak-naar-tekst en tekst-naar-spraakvertaling",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API-sleutel",
                        "elevenlabsRestrict": "Beperk sleutel: Ingeschakeld",
                        "elevenlabsNoAccess": "Alles behalve: Geen toegang",
                        "elevenlabsTts": "Tekst naar spraak: Toegang",
                        "elevenlabsSts": "Spraak naar spraak: Toegang",
                        "elevenlabsAgents": "ElevenLabs-agenten: Schrijven",
                        "elevenlabsVoices": "Stemmen: Schrijven",
                        "elevenlabsVoiceGen": "Stemgeneratie: Toegang",
                        "elevenlabsUser": "Gebruiker: Lezen",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API-sleutel:",
                        "openaiPlaceholder": "Voer uw OpenAI API-sleutel in",
                        "openaiStored": "Sleutel veilig opgeslagen",
                        "openaiHelp": "Voer uw OpenAI API-sleutel in (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API-sleutel:",
                        "elevenlabsPlaceholder": "Voer uw ElevenLabs API-sleutel in",
                        "elevenlabsStored": "Sleutel veilig opgeslagen",
                        "elevenlabsHelp": "Voer uw ElevenLabs API-sleutel in (32 tekens)"
                    },
                    "buttons": {
                        "showKey": "Toon sleutel",
                        "removeKey": "Verwijder sleutel",
                        "clearAll": "Wis alle sleutels",
                        "cancel": "Annuleren",
                        "save": "Opslaan"
                    },
                    "status": {
                        "keyStored": "✓ Sleutel veilig opgeslagen"
                    },
                    "links": {
                        "openai": "Genereer sleutel op: platform.openai.com/api-keys",
                        "elevenlabs": "Genereer sleutel op: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Microfoon",
                    "targetLanguage": "Vertalen naar",
                    "voice": "Stem",
                    "output": "Uitvoer",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Start vertaling",
                    "stopTranslation": "Stop vertaling",
                    "addCustomVoice": "Voeg aangepaste stem toe",
                    "accent": "Accent",
                    "noAccent": "Geen accent",
                    "accentOn": "Accent: AAN",
                    "accentOff": "Accent: UIT"
                },
                "placeholders": {
                    "selectMicrophone": "Selecteer microfoon...",
                    "loadingVoices": "Stemmen laden...",
                    "selectVoice": "Selecteer stem...",
                    "enterCustomAccent": "Voer aangepast accent in...",
                    "selectPreset": "Selecteer preset..."
                },
                "keys": {
                    "space": "SPATIE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Welkom bij Whispra!",
                        "message": "Welkom bij de app! Laten we snel door de hoofdinterface lopen."
                    },
                    "sidebar": {
                        "title": "Navigatie in de linkerzijbalk",
                        "message": "Dit is uw hoofd navigatiebalk. Gebruik het om te schakelen tussen verschillende functies zoals Whispra Translate, Schermvertaling, Snelle vertaling en meer."
                    },
                    "translateTab": {
                        "title": "Vertaal Tab",
                        "message": "De Vertaal-tab is uw belangrijkste werkruimte voor realtime vertaling. Begin met spreken en kijk hoe uw woorden onmiddellijk worden vertaald."
                    },
                    "bidirectionalTab": {
                        "title": "Bidirectionele modus",
                        "message": "De bidirectionele modus vertaalt gesprekken automatisch in beide richtingen. Perfect voor natuurlijke heen-en-weer dialoog."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate Tab",
                        "message": "De Whispra Translate-tab combineert realtime vertaling en bidirectionele modus in één geïntegreerde interface. Gebruik het linkerpaneel voor eenrichtingsvertaling en het rechterpaneel voor bidirectionele gesprekken. Begin met spreken en kijk hoe uw woorden onmiddellijk worden vertaald."
                    },
                    "screenTranslationTab": {
                        "title": "Schermvertaling",
                        "message": "Schermvertaling legt tekst van uw scherm vast en vertaalt deze in realtime. Geweldig voor het vertalen van inhoud uit games, video's of applicaties."
                    },
                    "quickTranslateTab": {
                        "title": "Snelle Vertaling",
                        "message": "Snelle Vertaling biedt u onmiddellijke vertaling met een sneltoets. Druk op Alt+C om geselecteerde tekst snel te vertalen."
                    },
                    "soundBoardTab": {
                        "title": "Geluidspaneel",
                        "message": "Het geluidspaneel stelt u in staat om audioclips onmiddellijk af te spelen. Perfect voor snelle antwoorden of geluidseffecten tijdens gesprekken."
                    },
                    "profile": {
                        "title": "Profielsectie",
                        "message": "Toegang tot uw profielinstellingen, accountinformatie en meld u hier af."
                    },
                    "settings": {
                        "title": "Instellingenmenu",
                        "message": "Klik op de instellingenknop in de zijbalk om toegang te krijgen tot alle applicatie-instellingen. We laten u zien wat er binnenin is."
                    },
                    "apiKeys": {
                        "title": "API-sleutels Configuratie",
                        "message": "Configureer hier uw API-sleutels. U heeft sleutels nodig voor OpenAI (Whisper), vertaalservices en ElevenLabs voor spraaksynthetisatie."
                    },
                    "keybinds": {
                        "title": "Sneltoetsen",
                        "message": "Dit is waar u sneltoetsen kunt configureren voor snelle acties. Pas uw sneltoetsen aan om aan uw workflow te voldoen."
                    },
                    "models": {
                        "title": "Modellen & Verwerking",
                        "message": "Hier kunt u AI-modellen selecteren en verwerkingsopties aanpassen. Kies tussen cloud- en lokale verwerking, en verfijn modelparameters."
                    },
                    "accountSettings": {
                        "title": "Account- en Achtergrondinstellingen",
                        "message": "In het tabblad Account kunt u het gedrag van het systeemvak en de Paddle-warmup-instellingen configureren. Schakel \"Op de achtergrond uitvoeren\" in om Whispra naar het systeemvak te minimaliseren in plaats van het volledig te sluiten."
                    },
                    "screenBoxSelector": {
                        "title": "Schermvakselector",
                        "message": "Gebruik Alt+Y (standaard sneltoets) om de schermvakselector te activeren. Dit stelt u in staat om specifieke gebieden van uw scherm te selecteren voor gerichte vertaling in plaats van het hele scherm te vertalen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle Warmup-functie",
                        "message": "Schakel \"Paddle Warmup bij opstarten\" in om OCR-modellen voor te laden wanneer de app start. Dit maakt schermvertaling sneller, maar verhoogt de opstarttijd. U kunt deze schakelaar vinden in het tabblad Accountinstellingen."
                    },
                    "systemTray": {
                        "title": "Systeemvakintegratie",
                        "message": "Wanneer \"Op de achtergrond uitvoeren\" is ingeschakeld, minimaliseert het sluiten van het hoofdvenster Whispra naar uw systeemvak in plaats van te stoppen. Klik op het tray-icoon om het venster te herstellen, of klik met de rechtermuisknop voor snelle acties."
                    },
                    "expandedOverlay": {
                        "title": "Uitgebreide Overlay",
                        "message": "Druk op F11 (of uw geconfigureerde sneltoets) om de uitgebreide overlay te openen - een zwevend bedieningspaneel dat boven andere applicaties blijft. Perfect voor gaming of fullscreen-apps! Het bevat alle dezelfde functies die toegankelijk zijn zonder uw huidige applicatie te verlaten."
                    },
                    "hotkeys": {
                        "title": "Essentiële sneltoetsen",
                        "message": "Vergeet deze toets snelkoppelingen niet: F11 voor uitgebreide overlay, Alt+T voor schermvertaling, Alt+Y voor schermvakselector. U kunt alle sneltoetsen aanpassen in Instellingen → Sneltoetsen."
                    },
                    "finish": {
                        "title": "U bent helemaal klaar!",
                        "message": "Dat is het! U bent klaar om de app te gaan gebruiken. Druk op F11 om de uitgebreide overlay te proberen en verken alle functies om uw ervaring aan te passen."
                    },
                    "buttons": {
                        "skip": "Overslaan",
                        "back": "Terug",
                        "next": "Volgende",
                        "closeTour": "Sluit rondleiding"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Snelle Vertaling",
                    "description": "Vertaal tekst direct met AI-vertaaldiensten",
                    "globalHotkey": "Globale Sneltoets:",
                    "translateTo": "Vertaal Naar",
                    "autoTranslate": "Auto-Vertalen",
                    "translatesAsYouType": "Vertaalt terwijl u typt",
                    "clickTranslateOrPress": "Klik Vertalen of druk Ctrl+Enter",
                    "textToTranslate": "Te Vertalen Tekst",
                    "translationResult": "Vertaalresultaat",
                    "translate": "Vertalen",
                    "translating": "Vertalen...",
                    "clear": "Wissen",
                    "copyResult": "Kopieer Resultaat",
                    "readyToTranslate": "Klaar om te vertalen",
                    "typingDots": "Typen...",
                    "translatingWord": "Woord vertalen...",
                    "translationCompleted": "Vertaling voltooid",
                    "translationFailed": "Vertaling mislukt",
                    "copiedToClipboard": "Vertaling gekopieerd naar klembord",
                    "pleaseEnterText": "Voer tekst in om te vertalen",
                    "autoTranslateEnabled": "Auto-vertalen ingeschakeld",
                    "autoTranslateDisabled": "Auto-vertalen uitgeschakeld - Klik Vertalen",
                    "enterTextPlaceholder": "Voer tekst in om te vertalen...",
                    "translationPlaceholder": "Vertaling verschijnt hier..."
                },
                "settingsModal": {
                    "title": "Instellingen",
                    "runInBackground": "Op achtergrond uitvoeren",
                    "close": "Sluiten",
                    "tabs": {
                        "account": "Account",
                        "apiKeys": "API-sleutels",
                        "models": "Modellen",
                        "cloudLocal": "Cloud/Lokaal",
                        "keybinds": "Sneltoetsen",
                        "themes": "Thema's",
                        "languageLibrary": "Taalbibliotheek"
                    },
                    "keybinds": {
                        "title": "Sneltoetsen",
                        "description": "Configureer globale sneltoetsen voor verschillende functies. Bidirectioneel en schermvertaling gebruiken {modifier} + toets. Klik \"Wijzigen\" om een nieuwe toets in te stellen.",
                        "ptt": "Druk om te praten",
                        "pttDesc": "Houd deze toets ingedrukt om te praten (standaard: Spatie, geen Alt)",
                        "bidirectional": "Bidirectioneel schakelen",
                        "bidirectionalDesc": "Druk {modifier} + deze toets om bidirectionele modus te schakelen (standaard: B)",
                        "screenTranslation": "Schermvertaling",
                        "screenTranslationDesc": "Druk {modifier} + deze toets om scherm vast te leggen (standaard: T)",
                        "screenTranslationBox": "Schermvertaling box",
                        "screenTranslationBoxDesc": "Druk {modifier} + deze toets om boxgebied te selecteren voor vertaling (standaard: Y)",
                        "overlayToggle": "Overlay schakelen",
                        "overlayToggleDesc": "Druk deze toets om overlay te schakelen (standaard: F11, geen Alt)",
                        "quickTranslation": "Snelle vertaling",
                        "quickTranslationLocked": "Deze sneltoets is vast en kan niet worden gewijzigd",
                        "change": "Wijzigen",
                        "locked": "Vergrendeld",
                        "tip": "Druk om te praten en overlay schakelen hebben geen {modifier} nodig. Bidirectioneel en schermvertaling vereisen {modifier} + toets. Druk ESC om te annuleren.",
                        "changeTitle": "{label} wijzigen",
                        "changeDescAlt": "Druk een toets om in te stellen als {modifier} + [uw toets]. {modifier} wordt automatisch toegevoegd. Druk ESC om te annuleren.",
                        "changeDescNoAlt": "Druk een toets (functietoetsen aanbevolen). Geen modifiers nodig. Druk ESC om te annuleren.",
                        "waitingForInput": "Wachten op invoer..."
                    },
                    "themes": {
                        "title": "Themaselectie",
                        "description": "Kies uw favoriete interfacethema. Wijzigingen worden direct toegepast.",
                        "active": "Actief",
                        "select": "Selecteren"
                    },
                    "account": {
                        "title": "Account",
                        "profile": "Profiel",
                        "subscription": "Abonnement",
                        "usage": "Gebruik",
                        "preferences": "Voorkeuren",
                        "email": "E-mail",
                        "plan": "Plan",
                        "trialDays": "Resterende proefdagen",
                        "status": "Status",
                        "spokenLanguage": "Taal die u spreekt",
                        "rememberResponses": "API-antwoorden opslaan",
                        "rememberResponsesDesc": "Sla API-antwoorden op voor gebruikstracking en debugging. Schakel uit voor meer privacy.",
                        "usageUsed": "Gebruikt deze maand",
                        "usageRemaining": "resterend",
                        "usageLoading": "Gebruiksgegevens laden...",
                        "usageError": "Kan gebruiksgegevens niet laden",
                        "usageWarningHigh": "⚠️ Hoog gebruik deze maand",
                        "usageWarningLimit": "⚠️ Nadert gebruikslimiet",
                        "openDashboard": "Abonnement beheren",
                        "signOut": "Uitloggen",
                        "opening": "Openen...",
                        "error": "Kon accountpaneel niet openen. Bezoek account.whispra.xyz handmatig.",
                        "loading": "Accountinformatie laden...",
                        "trial": "7-daagse gratis proefperiode",
                        "active": "Actief abonnement",
                        "expired": "Verlopen"
                    }
                }
            },'pl': {
                "tab": {
                    "translation": "Tłumaczenie",
                    "bidirectional": "Dwukierunkowy",
                    "soundboard": "Panel dźwiękowy",
                    "settings": "Ustawienia"
                },
                "sidebar": {
                    "translate": "Tłumacz",
                    "bidirectional": "Dwukierunkowy",
                    "screenTranslation": "Tłumaczenie ekranu",
                    "soundBoard": "Panel dźwiękowy",
                    "voiceFilter": "Filtr głosu",
                    "settings": "Ustawienia",
                    "logs": "Dzienniki",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Tłumacz",
                    "screenTranslate": "Tłumacz Ekran",
                    "quickTranslate": "Szybkie Tłumaczenie",
                    "help": "Pomoc"
                },
                "soundboard": {
                    "panel": {
                        "title": "Panel dźwiękowy",
                        "description": "Odtwarzaj niestandardowe dźwięki i klipy audio podczas rozmów"
                    },
                    "controls": {
                        "outputDevice": "Urządzenie wyjściowe",
                        "vbAudioVolume": "Głośność VB Audio",
                        "headphonesVolume": "Głośność słuchawek",
                        "soundPadGrid": "Siatka panelu dźwiękowego",
                        "enableHotkeys": "Włącz skróty klawiszowe panelu dźwiękowego",
                        "addSoundFiles": "Dodaj pliki dźwiękowe",
                        "webOverlay": "Nakładka webowa",
                        "stopAllSounds": "Zatrzymaj wszystkie dźwięki"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Wybierz urządzenie wyjściowe...",
                        "defaultSystemOutput": "Domyślne wyjście systemowe",
                        "virtualAudioCable": "Wirtualny kabel audio"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Tryb dwukierunkowy"
                    },
                    "controls": {
                        "startBidirectional": "Rozpocznij dwukierunkowy",
                        "stopBidirectional": "Zatrzymaj dwukierunkowy",
                        "keybind": "Tłumacz na",
                        "toggleWith": "Przełącz z",
                        "changeKey": "Zmień klawisz",
                        "outputDevice": "Urządzenie wyjściowe",
                        "systemInput": "Wejście systemowe",
                        "incomingVoice": "Przychodzący głos",
                        "sourceLanguage": "Język źródłowy",
                        "appSelection": "Wybór aplikacji"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Ładowanie urządzeń wyjściowych...",
                        "loadingVoices": "Ładowanie głosów...",
                        "displaySystemAudio": "Wyświetl/Audio systemowe (Domyślnie)"
                    },
                    "status": {
                        "idle": "Bezczynny",
                        "waiting": "Czekam...",
                        "ready": "Gotowy...",
                        "starting": "Rozpoczynam...",
                        "stopping": "Zatrzymuję..."
                    },
                    "labels": {
                        "detectedTarget": "Wykryty (Język źródłowy)",
                        "respoken": "Powtórzony (Tłumacz na)"
                    }
                },
                "header": {
                    "signOut": "Wyloguj się"
                },
                "footer": {
                    "becomeAffiliate": "Zostań Partnerem",
                    "reportBug": "Zgłoś Błąd / Zaproponuj Funkcję"
                },
                "settings": {
                    "modal": {
                        "title": "Bezpieczna konfiguracja API",
                        "close": "Zamknij"
                    },
                    "instructions": {
                        "title": "Instrukcje konfiguracji klucza API",
                        "openaiTitle": "Klucz API OpenAI",
                        "openaiPermissions": "Uprawnienia do odczytu: Modele, Możliwości",
                        "openaiUsage": "Używane do tłumaczenia mowy na tekst i tekstu na mowę",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Klucz API ElevenLabs",
                        "elevenlabsRestrict": "Ograniczenie klucza: Włączone",
                        "elevenlabsNoAccess": "Wszystko inne: Brak dostępu",
                        "elevenlabsTts": "Tekst na mowę: Dostęp",
                        "elevenlabsSts": "Mowa na mowę: Dostęp",
                        "elevenlabsAgents": "Agenci ElevenLabs: Zapisz",
                        "elevenlabsVoices": "Głosy: Zapisz",
                        "elevenlabsVoiceGen": "Generowanie głosu: Dostęp",
                        "elevenlabsUser": "Użytkownik: Odczyt",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Klucz API OpenAI:",
                        "openaiPlaceholder": "Wprowadź swój klucz API OpenAI",
                        "openaiStored": "Klucz przechowywany bezpiecznie",
                        "openaiHelp": "Wprowadź swój klucz API OpenAI (sk-...)",
                        "elevenlabsLabel": "Klucz API ElevenLabs:",
                        "elevenlabsPlaceholder": "Wprowadź swój klucz API ElevenLabs",
                        "elevenlabsStored": "Klucz przechowywany bezpiecznie",
                        "elevenlabsHelp": "Wprowadź swój klucz API ElevenLabs (32 znaki)"
                    },
                    "buttons": {
                        "showKey": "Pokaż klucz",
                        "removeKey": "Usuń klucz",
                        "clearAll": "Wyczyść wszystkie klucze",
                        "cancel": "Anuluj",
                        "save": "Zapisz"
                    },
                    "status": {
                        "keyStored": "✓ Klucz przechowywany bezpiecznie"
                    },
                    "links": {
                        "openai": "Generuj klucz na: platform.openai.com/api-keys",
                        "elevenlabs": "Generuj klucz na: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Tłumacz na",
                    "voice": "Głos",
                    "output": "Wyjście",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Rozpocznij tłumaczenie",
                    "stopTranslation": "Zatrzymaj tłumaczenie",
                    "addCustomVoice": "Dodaj niestandardowy głos",
                    "accent": "Akcent",
                    "noAccent": "Brak akcentu",
                    "accentOn": "Akcent: WŁ.",
                    "accentOff": "Akcent: WYŁ."
                },
                "placeholders": {
                    "selectMicrophone": "Wybierz mikrofon...",
                    "loadingVoices": "Ładowanie głosów...",
                    "selectVoice": "Wybierz głos...",
                    "enterCustomAccent": "Wprowadź niestandardowy akcent...",
                    "selectPreset": "Wybierz preset..."
                },
                "keys": {
                    "space": "SPACJA",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Witamy w Whispra!",
                        "message": "Witamy w aplikacji! Szybko przejdźmy przez główny interfejs."
                    },
                    "sidebar": {
                        "title": "Nawigacja w lewym pasku bocznym",
                        "message": "To jest twój główny pasek nawigacyjny. Użyj go, aby przełączać się między różnymi funkcjami, takimi jak Whispra Translate, Tłumaczenie ekranu, Szybkie tłumaczenie i inne."
                    },
                    "translateTab": {
                        "title": "Zakładka Tłumaczenie",
                        "message": "Zakładka Tłumaczenie to twoje główne miejsce pracy do tłumaczenia w czasie rzeczywistym. Zacznij mówić i obserwuj, jak twoje słowa są tłumaczone natychmiast."
                    },
                    "bidirectionalTab": {
                        "title": "Tryb dwukierunkowy",
                        "message": "Tryb dwukierunkowy automatycznie tłumaczy rozmowy w obu kierunkach. Idealny do naturalnego dialogu."
                    },
                    "whispraTranslateTab": {
                        "title": "Zakładka Whispra Translate",
                        "message": "Zakładka Whispra Translate łączy tłumaczenie w czasie rzeczywistym i tryb dwukierunkowy w jednym zunifikowanym interfejsie. Użyj lewego panelu do tłumaczenia jednokierunkowego i prawego panelu do rozmów dwukierunkowych. Zacznij mówić i obserwuj, jak twoje słowa są tłumaczone natychmiast."
                    },
                    "screenTranslationTab": {
                        "title": "Tłumaczenie ekranu",
                        "message": "Tłumaczenie ekranu przechwytuje tekst z twojego ekranu i tłumaczy go w czasie rzeczywistym. Świetne do tłumaczenia treści z gier, filmów lub aplikacji."
                    },
                    "quickTranslateTab": {
                        "title": "Szybkie Tłumaczenie",
                        "message": "Szybkie Tłumaczenie daje ci natychmiastowe tłumaczenie za pomocą skrótu klawiszowego. Naciśnij Alt+C, aby szybko przetłumaczyć zaznaczony tekst."
                    },
                    "soundBoardTab": {
                        "title": "Panel dźwiękowy",
                        "message": "Panel dźwiękowy pozwala na natychmiastowe odtwarzanie klipów audio. Idealny do szybkich odpowiedzi lub efektów dźwiękowych podczas rozmów."
                    },
                    "profile": {
                        "title": "Sekcja profilu",
                        "message": "Uzyskaj dostęp do ustawień swojego profilu, informacji o koncie i wyloguj się stąd."
                    },
                    "settings": {
                        "title": "Menu ustawień",
                        "message": "Kliknij przycisk ustawień w pasku bocznym, aby uzyskać dostęp do wszystkich ustawień aplikacji. Pokażemy ci, co jest w środku następnie."
                    },
                    "apiKeys": {
                        "title": "Konfiguracja kluczy API",
                        "message": "Skonfiguruj swoje klucze API tutaj. Będziesz potrzebować kluczy dla OpenAI (Whisper), usług tłumaczeniowych i ElevenLabs do syntezowania głosu."
                    },
                    "keybinds": {
                        "title": "Skróty klawiszowe",
                        "message": "To jest miejsce, w którym możesz skonfigurować skróty klawiszowe do szybkich działań. Dostosuj swoje skróty klawiszowe do swojego stylu pracy."
                    },
                    "models": {
                        "title": "Modele i przetwarzanie",
                        "message": "Tutaj możesz wybierać modele AI i dostosowywać opcje przetwarzania. Wybierz między przetwarzaniem w chmurze a lokalnym, i dostosuj parametry modelu."
                    },
                    "accountSettings": {
                        "title": "Ustawienia konta i tła",
                        "message": "W zakładce Konto możesz skonfigurować zachowanie w zasobniku systemowym i ustawienia rozgrzewki Paddle. Włącz \"Uruchom w tle\", aby zminimalizować Whispra do zasobnika systemowego zamiast całkowicie go zamykać."
                    },
                    "screenBoxSelector": {
                        "title": "Wybór obszaru ekranu",
                        "message": "Użyj Alt+Y (domyślny skrót klawiszowy), aby aktywować wybór obszaru ekranu. To pozwala na wybór konkretnych obszarów ekranu do tłumaczenia zamiast tłumaczenia całego ekranu."
                    },
                    "paddleWarmup": {
                        "title": "Funkcja rozgrzewki Paddle",
                        "message": "Włącz \"Rozgrzewkę Paddle przy uruchomieniu\", aby wstępnie załadować modele OCR, gdy aplikacja się uruchamia. To przyspiesza tłumaczenie ekranu, ale zwiększa czas uruchamiania. Możesz znaleźć ten przełącznik w zakładce ustawień konta."
                    },
                    "systemTray": {
                        "title": "Integracja z zasobnikiem systemowym",
                        "message": "Gdy \"Uruchom w tle\" jest włączone, zamknięcie głównego okna zminimalizuje Whispra do zasobnika systemowego zamiast zakończenia. Kliknij ikonę w zasobniku, aby przywrócić okno, lub kliknij prawym przyciskiem myszy, aby uzyskać szybkie akcje."
                    },
                    "expandedOverlay": {
                        "title": "Rozszerzona nakładka",
                        "message": "Naciśnij F11 (lub skonfigurowany skrót klawiszowy), aby otworzyć rozszerzoną nakładkę - pływający panel sterowania, który pozostaje na wierzchu innych aplikacji. Idealny do gier lub aplikacji w trybie pełnoekranowym! Zawiera wszystkie te same funkcje dostępne bez opuszczania bieżącej aplikacji."
                    },
                    "hotkeys": {
                        "title": "Podstawowe skróty klawiszowe",
                        "message": "Pamiętaj o tych skrótach klawiszowych: F11 dla rozszerzonej nakładki, Alt+T dla tłumaczenia ekranu, Alt+Y dla wyboru obszaru ekranu. Możesz dostosować wszystkie skróty klawiszowe w Ustawienia → Skróty klawiszowe."
                    },
                    "finish": {
                        "title": "Jesteś gotowy!",
                        "message": "To wszystko! Jesteś gotowy do rozpoczęcia korzystania z aplikacji. Naciśnij F11, aby wypróbować rozszerzoną nakładkę, i odkryj wszystkie funkcje, aby dostosować swoje doświadczenie."
                    },
                    "buttons": {
                        "skip": "Pomiń",
                        "back": "Wstecz",
                        "next": "Dalej",
                        "closeTour": "Zamknij wycieczkę"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Szybkie Tłumaczenie",
                    "description": "Natychmiast tłumacz tekst za pomocą usług tłumaczenia AI",
                    "globalHotkey": "Globalny Skrót:",
                    "translateTo": "Tłumacz Na",
                    "autoTranslate": "Auto-Tłumaczenie",
                    "translatesAsYouType": "Tłumaczy podczas pisania",
                    "clickTranslateOrPress": "Kliknij Tłumacz lub naciśnij Ctrl+Enter",
                    "textToTranslate": "Tekst do Tłumaczenia",
                    "translationResult": "Wynik Tłumaczenia",
                    "translate": "Tłumacz",
                    "translating": "Tłumaczenie...",
                    "clear": "Wyczyść",
                    "copyResult": "Kopiuj Wynik",
                    "readyToTranslate": "Gotowy do tłumaczenia",
                    "typingDots": "Pisanie...",
                    "translatingWord": "Tłumaczenie słowa...",
                    "translationCompleted": "Tłumaczenie zakończone",
                    "translationFailed": "Tłumaczenie nie powiodło się",
                    "copiedToClipboard": "Tłumaczenie skopiowane do schowka",
                    "pleaseEnterText": "Wprowadź tekst do tłumaczenia",
                    "autoTranslateEnabled": "Auto-tłumaczenie włączone",
                    "autoTranslateDisabled": "Auto-tłumaczenie wyłączone - Kliknij Tłumacz",
                    "enterTextPlaceholder": "Wprowadź tekst do tłumaczenia...",
                    "translationPlaceholder": "Tłumaczenie pojawi się tutaj..."
                },
                "settingsModal": {
                    "title": "Ustawienia",
                    "runInBackground": "Uruchom w tle",
                    "close": "Zamknij",
                    "tabs": {
                        "account": "Konto",
                        "apiKeys": "Klucze API",
                        "models": "Modele",
                        "cloudLocal": "Chmura/Lokalnie",
                        "keybinds": "Skróty klawiszowe",
                        "themes": "Motywy",
                        "languageLibrary": "Biblioteka języków"
                    },
                    "keybinds": {
                        "title": "Skróty Klawiszowe",
                        "description": "Skonfiguruj globalne skróty klawiszowe dla różnych funkcji. Dwukierunkowy i tłumaczenie ekranu używają {modifier} + klawisz. Kliknij \"Zmień\" aby ustawić nowy klawisz.",
                        "ptt": "Naciśnij aby mówić",
                        "pttDesc": "Przytrzymaj ten klawisz aby mówić (domyślnie: Spacja, bez Alt)",
                        "bidirectional": "Przełącz dwukierunkowy",
                        "bidirectionalDesc": "Naciśnij {modifier} + ten klawisz aby przełączyć tryb dwukierunkowy (domyślnie: B)",
                        "screenTranslation": "Tłumaczenie ekranu",
                        "screenTranslationDesc": "Naciśnij {modifier} + ten klawisz aby przechwycić ekran (domyślnie: T)",
                        "screenTranslationBox": "Pole tłumaczenia ekranu",
                        "screenTranslationBoxDesc": "Naciśnij {modifier} + ten klawisz aby wybrać obszar do tłumaczenia (domyślnie: Y)",
                        "overlayToggle": "Przełącz nakładkę",
                        "overlayToggleDesc": "Naciśnij ten klawisz aby przełączyć nakładkę (domyślnie: F11, bez Alt)",
                        "quickTranslation": "Szybkie tłumaczenie",
                        "quickTranslationLocked": "Ten skrót jest stały i nie można go zmienić",
                        "change": "Zmień",
                        "locked": "Zablokowany",
                        "tip": "Naciśnij aby mówić i przełącz nakładkę nie wymagają {modifier}. Dwukierunkowy i tłumaczenie ekranu wymagają {modifier} + klawisz. Naciśnij ESC aby anulować.",
                        "changeTitle": "Zmień {label}",
                        "changeDescAlt": "Naciśnij dowolny klawisz aby ustawić jako {modifier} + [twój klawisz]. {modifier} zostanie dodany automatycznie. Naciśnij ESC aby anulować.",
                        "changeDescNoAlt": "Naciśnij dowolny klawisz (zalecane klawisze funkcyjne). Modyfikatory nie są potrzebne. Naciśnij ESC aby anulować.",
                        "waitingForInput": "Oczekiwanie na wprowadzenie..."
                    },
                    "themes": {
                        "title": "Wybór Motywu",
                        "description": "Wybierz preferowany motyw interfejsu. Zmiany są stosowane natychmiast.",
                        "active": "Aktywny",
                        "select": "Wybierz"
                    },
                    "account": {
                        "title": "Konto",
                        "profile": "Profil",
                        "subscription": "Subskrypcja",
                        "usage": "Użycie",
                        "preferences": "Preferencje",
                        "email": "E-mail",
                        "plan": "Plan",
                        "trialDays": "Pozostałe dni próbne",
                        "status": "Status",
                        "spokenLanguage": "Język którym mówisz",
                        "rememberResponses": "Zapisz odpowiedzi API",
                        "rememberResponsesDesc": "Przechowuj odpowiedzi API do śledzenia użycia i debugowania. Wyłącz dla zwiększonej prywatności.",
                        "usageUsed": "Użyte w tym miesiącu",
                        "usageRemaining": "pozostało",
                        "usageLoading": "Ładowanie danych użycia...",
                        "usageError": "Nie można załadować danych użycia",
                        "usageWarningHigh": "⚠️ Wysokie użycie w tym miesiącu",
                        "usageWarningLimit": "⚠️ Zbliżanie się do limitu użycia",
                        "openDashboard": "Zarządzaj subskrypcją",
                        "signOut": "Wyloguj się",
                        "opening": "Otwieranie...",
                        "error": "Nie udało się otworzyć panelu konta. Odwiedź account.whispra.xyz ręcznie.",
                        "loading": "Ładowanie informacji o koncie...",
                        "trial": "7-dniowy bezpłatny okres próbny",
                        "active": "Aktywna subskrypcja",
                        "expired": "Wygasła"
                    }
                }
            },'tr': {
                "tab": {
                    "translation": "Çeviri",
                    "bidirectional": "İki Yönlü",
                    "soundboard": "Ses Panosu",
                    "settings": "Ayarlar"
                },
                "sidebar": {
                    "translate": "Çevir",
                    "bidirectional": "İki Yönlü",
                    "screenTranslation": "Ekran Çevirisi",
                    "soundBoard": "Ses Panosu",
                    "voiceFilter": "Ses Filtre",
                    "settings": "Ayarlar",
                    "logs": "Kayıtlar",
                    "menu": "Menü",
                    "whispraTranslate": "Whispra Çevir",
                    "screenTranslate": "Ekran Çevir",
                    "quickTranslate": "Hızlı Çeviri",
                    "help": "Yardım"
                },
                "soundboard": {
                    "panel": {
                        "title": "Ses Panosu",
                        "description": "Konuşmalar sırasında özel sesleri ve ses kliplerini çal"
                    },
                    "controls": {
                        "outputDevice": "Çıkış Aygıtı",
                        "vbAudioVolume": "VB Audio Ses Seviyesi",
                        "headphonesVolume": "Kulaklık Ses Seviyesi",
                        "soundPadGrid": "Ses Pad Izgarası",
                        "enableHotkeys": "Ses Panosu Kısayollarını Etkinleştir",
                        "addSoundFiles": "Ses Dosyaları Ekle",
                        "webOverlay": "Web Üst Katmanı",
                        "stopAllSounds": "Tüm Sesleri Durdur"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Çıkış aygıtını seçin...",
                        "defaultSystemOutput": "Varsayılan Sistem Çıkışı",
                        "virtualAudioCable": "Sanal Ses Kablosu"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "İki Yönlü Mod"
                    },
                    "controls": {
                        "startBidirectional": "İki Yönlü Başlat",
                        "stopBidirectional": "İki Yönlü Durdur",
                        "keybind": "Çevirilecek",
                        "toggleWith": "Değiştir",
                        "changeKey": "Tuşa Değiştir",
                        "outputDevice": "Çıkış Aygıtı",
                        "systemInput": "Sistem Girişi",
                        "incomingVoice": "Gelen Ses",
                        "sourceLanguage": "Kaynak Dil",
                        "appSelection": "Uygulama Seçimi"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Çıkış aygıtları yükleniyor...",
                        "loadingVoices": "Sesler yükleniyor...",
                        "displaySystemAudio": "Görüntü/Sistem Ses (Varsayılan)"
                    },
                    "status": {
                        "idle": "Boşta",
                        "waiting": "Bekleniyor...",
                        "ready": "Hazır...",
                        "starting": "Başlatılıyor...",
                        "stopping": "Durduruluyor..."
                    },
                    "labels": {
                        "detectedTarget": "Tespit Edildi (Kaynak Dil)",
                        "respoken": "Yeniden Konuşuldu (Çevirilecek)"
                    }
                },
                "header": {
                    "signOut": "Çıkış Yap"
                },
                "footer": {
                    "becomeAffiliate": "Affiliate Ol",
                    "reportBug": "Hata Bildir / Özellik Öner"
                },
                "settings": {
                    "modal": {
                        "title": "Güvenli API Yapılandırması",
                        "close": "Kapat"
                    },
                    "instructions": {
                        "title": "API Anahtarı Kurulum Talimatları",
                        "openaiTitle": "OpenAI API Anahtarı",
                        "openaiPermissions": "Okuma izinleri: Modeller, Yetenekler",
                        "openaiUsage": "Sesli metin ve metinden sesli çeviri için kullanılır",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API Anahtarı",
                        "elevenlabsRestrict": "Anahtarı kısıtla: Etkin",
                        "elevenlabsNoAccess": "Diğer her şey: Erişim yok",
                        "elevenlabsTts": "Metinden sese: Erişim",
                        "elevenlabsSts": "Sesten sese: Erişim",
                        "elevenlabsAgents": "ElevenLabs ajanları: Yazma",
                        "elevenlabsVoices": "Sesler: Yazma",
                        "elevenlabsVoiceGen": "Ses üretimi: Erişim",
                        "elevenlabsUser": "Kullanıcı: Okuma",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API Anahtarı:",
                        "openaiPlaceholder": "OpenAI API anahtarınızı girin",
                        "openaiStored": "Anahtar güvenli bir şekilde saklandı",
                        "openaiHelp": "OpenAI API anahtarınızı girin (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API Anahtarı:",
                        "elevenlabsPlaceholder": "ElevenLabs API anahtarınızı girin",
                        "elevenlabsStored": "Anahtar güvenli bir şekilde saklandı",
                        "elevenlabsHelp": "ElevenLabs API anahtarınızı girin (32 karakter)"
                    },
                    "buttons": {
                        "showKey": "Anahtarı Göster",
                        "removeKey": "Anahtarı Kaldır",
                        "clearAll": "Tüm Anahtarları Temizle",
                        "cancel": "İptal",
                        "save": "Kaydet"
                    },
                    "status": {
                        "keyStored": "✓ Anahtar güvenli bir şekilde saklandı"
                    },
                    "links": {
                        "openai": "Anahtarı oluşturun: platform.openai.com/api-keys",
                        "elevenlabs": "Anahtarı oluşturun: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Çevirilecek",
                    "voice": "Ses",
                    "output": "Çıkış",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Çeviriyi Başlat",
                    "stopTranslation": "Çeviriyi Durdur",
                    "addCustomVoice": "Özel Ses Ekle",
                    "accent": "Aksan",
                    "noAccent": "Aksan Yok",
                    "accentOn": "Aksan: AÇIK",
                    "accentOff": "Aksan: KAPALI"
                },
                "placeholders": {
                    "selectMicrophone": "Mikrofonu seçin...",
                    "loadingVoices": "Sesler yükleniyor...",
                    "selectVoice": "Sesi seçin...",
                    "enterCustomAccent": "Özel aksanı girin...",
                    "selectPreset": "Ön ayarı seçin..."
                },
                "keys": {
                    "space": "BOŞLUK",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Whispra'ya Hoş Geldiniz!",
                        "message": "Uygulamaya hoş geldiniz! Ana arayüzü hızlıca gözden geçirelim."
                    },
                    "sidebar": {
                        "title": "Sol Kenar Çubuğu Navigasyonu",
                        "message": "Bu, ana navigasyon çubuğunuzdur. Whispra Translate, Ekran Çevirisi, Hızlı Çeviri ve daha fazlası gibi farklı özellikler arasında geçiş yapmak için kullanın."
                    },
                    "translateTab": {
                        "title": "Çeviri Sekmesi",
                        "message": "Çeviri sekmesi, gerçek zamanlı çeviri için ana çalışma alanınızdır. Konuşmaya başlayın ve kelimelerinizin anında çevrildiğini izleyin."
                    },
                    "bidirectionalTab": {
                        "title": "İki Yönlü Mod",
                        "message": "İki yönlü mod, konuşmaları otomatik olarak her iki yönde çevirir. Doğal bir karşılıklı diyalog için mükemmel."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate Sekmesi",
                        "message": "Whispra Translate sekmesi, gerçek zamanlı çeviri ve iki yönlü modu tek bir birleşik arayüzde birleştirir. Tek yönlü çeviri için sol paneli ve iki yönlü konuşmalar için sağ paneli kullanın. Konuşmaya başlayın ve kelimelerinizin anında çevrildiğini izleyin."
                    },
                    "screenTranslationTab": {
                        "title": "Ekran Çevirisi",
                        "message": "Ekran Çevirisi, ekranınızdaki metni yakalar ve gerçek zamanlı olarak çevirir. Oyunlar, videolar veya uygulamalardan içerik çevirisi için harika."
                    },
                    "quickTranslateTab": {
                        "title": "Hızlı Çeviri",
                        "message": "Hızlı Çeviri, bir klavye kısayolu ile anında çeviri sağlar. Seçili metni hızlıca çevirmek için Alt+C tuşuna basın."
                    },
                    "soundBoardTab": {
                        "title": "Ses Panosu",
                        "message": "Ses Panosu, ses kliplerini anında çalmanızı sağlar. Konuşmalar sırasında hızlı yanıtlar veya ses efektleri için mükemmel."
                    },
                    "profile": {
                        "title": "Profil Bölümü",
                        "message": "Profil ayarlarınıza, hesap bilgilerinize erişin ve buradan çıkış yapın."
                    },
                    "settings": {
                        "title": "Ayarlar Menüsü",
                        "message": "Tüm uygulama ayarlarına erişmek için kenar çubuğundaki ayarlar düğmesine tıklayın. İçinde neler olduğunu bir sonraki adımda göstereceğiz."
                    },
                    "apiKeys": {
                        "title": "API Anahtarları Yapılandırması",
                        "message": "API anahtarlarınızı burada yapılandırın. OpenAI (Whisper), çeviri hizmetleri ve ses sentezi için ElevenLabs anahtarlarına ihtiyacınız olacak."
                    },
                    "keybinds": {
                        "title": "Klavye Kısayolları",
                        "message": "Bu, hızlı eylemler için klavye kısayollarını yapılandırabileceğiniz yerdir. Kısayollarınızı iş akışınıza uygun şekilde özelleştirin."
                    },
                    "models": {
                        "title": "Modeller & İşleme",
                        "message": "Burada AI modellerini seçebilir ve işleme seçeneklerini ayarlayabilirsiniz. Bulut ve yerel işleme arasında seçim yapın ve model parametrelerini ince ayar yapın."
                    },
                    "accountSettings": {
                        "title": "Hesap & Arka Plan Ayarları",
                        "message": "Hesap sekmesinde, sistem tepsisi davranışını ve Paddle ısınma ayarlarını yapılandırabilirsiniz. Whispra'yı tamamen kapatmak yerine sistem tepsisine küçültmek için \"Arka Planda Çalıştır\" seçeneğini etkinleştirin."
                    },
                    "screenBoxSelector": {
                        "title": "Ekran Kutusu Seçici",
                        "message": "Ekran kutusu seçicisini etkinleştirmek için Alt+Y (varsayılan kısayol) tuşuna basın. Bu, tüm ekranı çevirmek yerine ekranınızın belirli alanlarını hedefli çeviri için seçmenizi sağlar."
                    },
                    "paddleWarmup": {
                        "title": "Paddle Isınma Özelliği",
                        "message": "Uygulama başladığında OCR modellerini ön yüklemek için \"Başlangıçta Paddle Isınmasını Etkinleştir\" seçeneğini etkinleştirin. Bu, ekran çevirisini hızlandırır ancak başlangıç süresini artırır. Bu geçişi Hesap ayarları sekmesinde bulabilirsiniz."
                    },
                    "systemTray": {
                        "title": "Sistem Tepsisi Entegrasyonu",
                        "message": "\"Arka Planda Çalıştır\" etkinleştirildiğinde, ana pencereyi kapatmak Whispra'yı sistem tepsinize küçültür. Pencereyi geri yüklemek için tepsi simgesine tıklayın veya hızlı eylemler için sağ tıklayın."
                    },
                    "expandedOverlay": {
                        "title": "Genişletilmiş Üst Katman",
                        "message": "Genişletilmiş Üst Katmanı açmak için F11 (veya yapılandırılmış kısayolunuzu) tuşuna basın - diğer uygulamaların üzerinde kalan bir kontrol paneli. Oyun veya tam ekran uygulamaları için mükemmel! Mevcut uygulamanızdan ayrılmadan erişilebilen tüm aynı özellikleri içerir."
                    },
                    "hotkeys": {
                        "title": "Temel Kısayollar",
                        "message": "Bu tuş kısayollarını hatırlayın: Genişletilmiş Üst Katman için F11, Ekran Çevirisi için Alt+T, Ekran Kutusu Seçici için Alt+Y. Tüm kısayolları Ayarlar → Kısayollar bölümünde özelleştirebilirsiniz."
                    },
                    "finish": {
                        "title": "Her Şey Hazır!",
                        "message": "Hepsi bu kadar! Uygulamayı kullanmaya hazırsınız. Genişletilmiş Üst Katmanı denemek için F11'e basın ve deneyiminizi özelleştirmek için tüm özellikleri keşfedin."
                    },
                    "buttons": {
                        "skip": "Atla",
                        "back": "Geri",
                        "next": "İleri",
                        "closeTour": "Turu Kapat"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Hızlı Çeviri",
                    "description": "AI çeviri hizmetleriyle metni anında çevirin",
                    "globalHotkey": "Global Kısayol:",
                    "translateTo": "Çevir",
                    "autoTranslate": "Otomatik Çeviri",
                    "translatesAsYouType": "Yazarken çevirir",
                    "clickTranslateOrPress": "Çevir'e tıklayın veya Ctrl+Enter basın",
                    "textToTranslate": "Çevrilecek Metin",
                    "translationResult": "Çeviri Sonucu",
                    "translate": "Çevir",
                    "translating": "Çevriliyor...",
                    "clear": "Temizle",
                    "copyResult": "Sonucu Kopyala",
                    "readyToTranslate": "Çevirmeye hazır",
                    "typingDots": "Yazıyor...",
                    "translatingWord": "Kelime çevriliyor...",
                    "translationCompleted": "Çeviri tamamlandı",
                    "translationFailed": "Çeviri başarısız",
                    "copiedToClipboard": "Çeviri panoya kopyalandı",
                    "pleaseEnterText": "Lütfen çevrilecek metin girin",
                    "autoTranslateEnabled": "Otomatik çeviri etkin",
                    "autoTranslateDisabled": "Otomatik çeviri devre dışı - Çevir'e tıklayın",
                    "enterTextPlaceholder": "Çevrilecek metni girin...",
                    "translationPlaceholder": "Çeviri burada görünecek..."
                },
                "settingsModal": {
                    "title": "Ayarlar",
                    "runInBackground": "Arka planda çalıştır",
                    "close": "Kapat",
                    "tabs": {
                        "account": "Hesap",
                        "apiKeys": "API Anahtarları",
                        "models": "Modeller",
                        "cloudLocal": "Bulut/Yerel",
                        "keybinds": "Kısayol Tuşları",
                        "themes": "Temalar",
                        "languageLibrary": "Dil Kütüphanesi"
                    },
                    "keybinds": {
                        "title": "Kısayol Tuşları",
                        "description": "Çeşitli özellikler için global kısayol tuşlarını yapılandırın. İki yönlü ve ekran çevirisi {modifier} + tuş kullanır. Yeni tuş ayarlamak için \"Değiştir\"e tıklayın.",
                        "ptt": "Konuşmak için bas",
                        "pttDesc": "Konuşmak için bu tuşu basılı tutun (varsayılan: Boşluk, Alt yok)",
                        "bidirectional": "İki yönlü geçiş",
                        "bidirectionalDesc": "İki yönlü modu değiştirmek için {modifier} + bu tuşa basın (varsayılan: B)",
                        "screenTranslation": "Ekran Çevirisi",
                        "screenTranslationDesc": "Ekranı yakalamak için {modifier} + bu tuşa basın (varsayılan: T)",
                        "screenTranslationBox": "Ekran Çevirisi Kutusu",
                        "screenTranslationBoxDesc": "Çeviri için kutu alanı seçmek için {modifier} + bu tuşa basın (varsayılan: Y)",
                        "overlayToggle": "Kaplama geçişi",
                        "overlayToggleDesc": "Kaplamayı değiştirmek için bu tuşa basın (varsayılan: F11, Alt yok)",
                        "quickTranslation": "Hızlı Çeviri",
                        "quickTranslationLocked": "Bu kısayol tuşu sabit ve değiştirilemez",
                        "change": "Değiştir",
                        "locked": "Kilitli",
                        "tip": "Konuşmak için bas ve kaplama geçişi {modifier} gerektirmez. İki yönlü ve ekran çevirisi {modifier} + tuş gerektirir. İptal için ESC'ye basın.",
                        "changeTitle": "{label} Değiştir",
                        "changeDescAlt": "{modifier} + [tuşunuz] olarak ayarlamak için herhangi bir tuşa basın. {modifier} otomatik olarak eklenir. İptal için ESC'ye basın.",
                        "changeDescNoAlt": "Herhangi bir tuşa basın (fonksiyon tuşları önerilir). Değiştirici gerekmez. İptal için ESC'ye basın.",
                        "waitingForInput": "Giriş bekleniyor..."
                    },
                    "themes": {
                        "title": "Tema Seçimi",
                        "description": "Tercih ettiğiniz arayüz temasını seçin. Değişiklikler hemen uygulanır.",
                        "active": "Aktif",
                        "select": "Seç"
                    },
                    "account": {
                        "title": "Hesap",
                        "profile": "Profil",
                        "subscription": "Abonelik",
                        "usage": "Kullanım",
                        "preferences": "Tercihler",
                        "email": "E-posta",
                        "plan": "Plan",
                        "trialDays": "Kalan Deneme Günleri",
                        "status": "Durum",
                        "spokenLanguage": "Konuştuğunuz Dil",
                        "rememberResponses": "API Yanıtlarını Kaydet",
                        "rememberResponsesDesc": "Kullanım takibi ve hata ayıklama için API yanıtlarını saklayın. Gelişmiş gizlilik için devre dışı bırakın.",
                        "usageUsed": "Bu ay kullanılan",
                        "usageRemaining": "kalan",
                        "usageLoading": "Kullanım verileri yükleniyor...",
                        "usageError": "Kullanım verileri yüklenemiyor",
                        "usageWarningHigh": "⚠️ Bu ay yüksek kullanım",
                        "usageWarningLimit": "⚠️ Kullanım sınırına yaklaşılıyor",
                        "openDashboard": "Aboneliği Yönet",
                        "signOut": "Çıkış Yap",
                        "opening": "Açılıyor...",
                        "error": "Hesap paneli açılamadı. Lütfen account.whispra.xyz adresini manuel olarak ziyaret edin.",
                        "loading": "Hesap bilgileri yükleniyor...",
                        "trial": "7 Günlük Ücretsiz Deneme",
                        "active": "Aktif Abonelik",
                        "expired": "Süresi Dolmuş"
                    }
                }
            },'vi': {
                "tab": {
                    "translation": "Dịch",
                    "bidirectional": "Hai chiều",
                    "soundboard": "Bảng âm thanh",
                    "settings": "Cài đặt"
                },
                "sidebar": {
                    "translate": "Dịch",
                    "bidirectional": "Hai chiều",
                    "screenTranslation": "Dịch màn hình",
                    "soundBoard": "Bảng âm thanh",
                    "voiceFilter": "Bộ lọc giọng nói",
                    "settings": "Cài đặt",
                    "logs": "Nhật ký",
                    "menu": "Thực đơn",
                    "whispraTranslate": "Whispra Dịch",
                    "screenTranslate": "Dịch Màn Hình",
                    "quickTranslate": "Dịch Nhanh",
                    "help": "Trợ giúp"
                },
                "soundboard": {
                    "panel": {
                        "title": "Bảng Âm Thanh",
                        "description": "Phát âm thanh và đoạn âm thanh tùy chỉnh trong các cuộc trò chuyện"
                    },
                    "controls": {
                        "outputDevice": "Thiết bị đầu ra",
                        "vbAudioVolume": "Âm lượng VB Audio",
                        "headphonesVolume": "Âm lượng tai nghe",
                        "soundPadGrid": "Lưới Bảng Âm Thanh",
                        "enableHotkeys": "Bật phím tắt Bảng Âm Thanh",
                        "addSoundFiles": "Thêm tệp âm thanh",
                        "webOverlay": "Lớp phủ web",
                        "stopAllSounds": "Dừng tất cả âm thanh"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Chọn thiết bị đầu ra...",
                        "defaultSystemOutput": "Đầu ra hệ thống mặc định",
                        "virtualAudioCable": "Cáp âm thanh ảo"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Chế độ Hai Chiều"
                    },
                    "controls": {
                        "startBidirectional": "Bắt đầu Hai Chiều",
                        "stopBidirectional": "Dừng Hai Chiều",
                        "keybind": "Dịch sang",
                        "toggleWith": "Chuyển đổi với",
                        "changeKey": "Thay đổi phím",
                        "outputDevice": "Thiết bị đầu ra",
                        "systemInput": "Đầu vào hệ thống",
                        "incomingVoice": "Giọng nói đến",
                        "sourceLanguage": "Ngôn ngữ nguồn",
                        "appSelection": "Chọn ứng dụng"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Đang tải thiết bị đầu ra...",
                        "loadingVoices": "Đang tải giọng nói...",
                        "displaySystemAudio": "Hiển thị/Âm thanh hệ thống (Mặc định)"
                    },
                    "status": {
                        "idle": "Nhàn rỗi",
                        "waiting": "Đang chờ...",
                        "ready": "Sẵn sàng...",
                        "starting": "Đang khởi động...",
                        "stopping": "Đang dừng..."
                    },
                    "labels": {
                        "detectedTarget": "Phát hiện (Ngôn ngữ nguồn)",
                        "respoken": "Nói lại (Dịch sang)"
                    }
                },
                "header": {
                    "signOut": "Đăng xuất"
                },
                "footer": {
                    "becomeAffiliate": "Trở thành Đối tác",
                    "reportBug": "Báo Lỗi / Đề Xuất Tính Năng"
                },
                "settings": {
                    "modal": {
                        "title": "Cấu hình API Bảo mật",
                        "close": "Đóng"
                    },
                    "instructions": {
                        "title": "Hướng dẫn thiết lập API Key",
                        "openaiTitle": "API Key OpenAI",
                        "openaiPermissions": "Quyền đọc: Mô hình, Khả năng",
                        "openaiUsage": "Sử dụng cho dịch giọng nói thành văn bản và dịch văn bản thành giọng nói",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "API Key ElevenLabs",
                        "elevenlabsRestrict": "Giới hạn key: Đã bật",
                        "elevenlabsNoAccess": "Mọi thứ khác: Không có quyền truy cập",
                        "elevenlabsTts": "Văn bản thành giọng nói: Quyền truy cập",
                        "elevenlabsSts": "Giọng nói thành giọng nói: Quyền truy cập",
                        "elevenlabsAgents": "Đại lý ElevenLabs: Ghi",
                        "elevenlabsVoices": "Giọng nói: Ghi",
                        "elevenlabsVoiceGen": "Tạo giọng nói: Quyền truy cập",
                        "elevenlabsUser": "Người dùng: Đọc",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "API Key OpenAI:",
                        "openaiPlaceholder": "Nhập API key OpenAI của bạn",
                        "openaiStored": "Key được lưu trữ an toàn",
                        "openaiHelp": "Nhập API key OpenAI của bạn (sk-...)",
                        "elevenlabsLabel": "API Key ElevenLabs:",
                        "elevenlabsPlaceholder": "Nhập API key ElevenLabs của bạn",
                        "elevenlabsStored": "Key được lưu trữ an toàn",
                        "elevenlabsHelp": "Nhập API key ElevenLabs của bạn (32 ký tự)"
                    },
                    "buttons": {
                        "showKey": "Hiển thị Key",
                        "removeKey": "Xóa Key",
                        "clearAll": "Xóa tất cả Keys",
                        "cancel": "Hủy",
                        "save": "Lưu"
                    },
                    "status": {
                        "keyStored": "✓ Key được lưu trữ an toàn"
                    },
                    "links": {
                        "openai": "Tạo key tại: platform.openai.com/api-keys",
                        "elevenlabs": "Tạo key tại: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Microphone",
                    "targetLanguage": "Dịch sang",
                    "voice": "Giọng nói",
                    "output": "Đầu ra",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Bắt đầu dịch",
                    "stopTranslation": "Dừng dịch",
                    "addCustomVoice": "Thêm giọng nói tùy chỉnh",
                    "accent": "Giọng điệu",
                    "noAccent": "Không có giọng điệu",
                    "accentOn": "Giọng điệu: BẬT",
                    "accentOff": "Giọng điệu: TẮT"
                },
                "placeholders": {
                    "selectMicrophone": "Chọn microphone...",
                    "loadingVoices": "Đang tải giọng nói...",
                    "selectVoice": "Chọn giọng nói...",
                    "enterCustomAccent": "Nhập giọng điệu tùy chỉnh...",
                    "selectPreset": "Chọn cài đặt trước..."
                },
                "keys": {
                    "space": "SPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Chào mừng đến với Whispra!",
                        "message": "Chào mừng bạn đến với ứng dụng! Hãy cùng nhau khám phá nhanh giao diện chính."
                    },
                    "sidebar": {
                        "title": "Điều hướng Thanh bên trái",
                        "message": "Đây là thanh điều hướng chính của bạn. Sử dụng nó để chuyển đổi giữa các tính năng khác nhau như Whispra Translate, Dịch màn hình, Dịch nhanh, và nhiều hơn nữa."
                    },
                    "translateTab": {
                        "title": "Tab Dịch",
                        "message": "Tab Dịch là không gian làm việc chính của bạn cho việc dịch theo thời gian thực. Bắt đầu nói và xem từ ngữ của bạn được dịch ngay lập tức."
                    },
                    "bidirectionalTab": {
                        "title": "Chế độ Hai Chiều",
                        "message": "Chế độ Hai chiều tự động dịch các cuộc trò chuyện theo cả hai hướng. Hoàn hảo cho các cuộc đối thoại tự nhiên."
                    },
                    "whispraTranslateTab": {
                        "title": "Tab Whispra Translate",
                        "message": "Tab Whispra Translate kết hợp dịch theo thời gian thực và chế độ hai chiều trong một giao diện thống nhất. Sử dụng bảng điều khiển bên trái cho dịch một chiều và bảng điều khiển bên phải cho các cuộc trò chuyện hai chiều. Bắt đầu nói và xem từ ngữ của bạn được dịch ngay lập tức."
                    },
                    "screenTranslationTab": {
                        "title": "Dịch Màn Hình",
                        "message": "Dịch Màn Hình ghi lại văn bản từ màn hình của bạn và dịch nó theo thời gian thực. Tuyệt vời cho việc dịch nội dung từ trò chơi, video, hoặc ứng dụng."
                    },
                    "quickTranslateTab": {
                        "title": "Dịch Nhanh",
                        "message": "Dịch Nhanh cung cấp cho bạn dịch ngay lập tức với một phím tắt. Nhấn Alt+C để dịch văn bản đã chọn nhanh chóng."
                    },
                    "soundBoardTab": {
                        "title": "Bảng Âm Thanh",
                        "message": "Bảng Âm Thanh cho phép bạn phát các đoạn âm thanh ngay lập tức. Hoàn hảo cho các phản hồi nhanh hoặc hiệu ứng âm thanh trong các cuộc trò chuyện."
                    },
                    "profile": {
                        "title": "Phần Hồ Sơ",
                        "message": "Truy cập cài đặt hồ sơ, thông tin tài khoản, và đăng xuất từ đây."
                    },
                    "settings": {
                        "title": "Thực Đơn Cài Đặt",
                        "message": "Nhấn nút cài đặt trong thanh bên để truy cập tất cả các cài đặt ứng dụng. Chúng tôi sẽ cho bạn biết bên trong tiếp theo."
                    },
                    "apiKeys": {
                        "title": "Cấu Hình API Keys",
                        "message": "Cấu hình API keys của bạn ở đây. Bạn sẽ cần keys cho OpenAI (Whisper), dịch vụ dịch thuật, và ElevenLabs cho tổng hợp giọng nói."
                    },
                    "keybinds": {
                        "title": "Phím Tắt Bàn Phím",
                        "message": "Đây là nơi bạn có thể cấu hình phím tắt bàn phím cho các hành động nhanh. Tùy chỉnh phím tắt của bạn để phù hợp với quy trình làm việc."
                    },
                    "models": {
                        "title": "Mô Hình & Xử Lý",
                        "message": "Tại đây bạn có thể chọn các mô hình AI và điều chỉnh các tùy chọn xử lý. Chọn giữa xử lý đám mây và cục bộ, và tinh chỉnh các tham số mô hình."
                    },
                    "accountSettings": {
                        "title": "Cài Đặt Tài Khoản & Nền",
                        "message": "Trong tab Tài khoản, bạn có thể cấu hình hành vi khay hệ thống và cài đặt khởi động Paddle. Bật \"Chạy trong Nền\" để thu nhỏ Whispra vào khay hệ thống thay vì đóng hoàn toàn."
                    },
                    "screenBoxSelector": {
                        "title": "Bộ Chọn Hộp Màn Hình",
                        "message": "Sử dụng Alt+Y (phím tắt mặc định) để kích hoạt bộ chọn hộp màn hình. Điều này cho phép bạn chọn các khu vực cụ thể trên màn hình của bạn để dịch mục tiêu thay vì dịch toàn bộ màn hình."
                    },
                    "paddleWarmup": {
                        "title": "Tính Năng Khởi Động Paddle",
                        "message": "Bật \"Khởi động Paddle khi Khởi động\" để tải trước các mô hình OCR khi ứng dụng khởi động. Điều này làm cho việc dịch màn hình nhanh hơn nhưng tăng thời gian khởi động. Bạn có thể tìm thấy công tắc này trong tab cài đặt Tài khoản."
                    },
                    "systemTray": {
                        "title": "Tích Hợp Khay Hệ Thống",
                        "message": "Khi \"Chạy trong Nền\" được bật, đóng cửa sổ chính sẽ thu nhỏ Whispra vào khay hệ thống của bạn thay vì thoát. Nhấn vào biểu tượng khay để khôi phục cửa sổ, hoặc nhấp chuột phải để thực hiện các hành động nhanh."
                    },
                    "expandedOverlay": {
                        "title": "Lớp Phủ Mở Rộng",
                        "message": "Nhấn F11 (hoặc phím tắt đã cấu hình của bạn) để mở Lớp Phủ Mở Rộng - một bảng điều khiển nổi luôn ở trên các ứng dụng khác. Hoàn hảo cho việc chơi game hoặc ứng dụng toàn màn hình! Nó bao gồm tất cả các tính năng tương tự có thể truy cập mà không cần rời khỏi ứng dụng hiện tại của bạn."
                    },
                    "hotkeys": {
                        "title": "Phím Tắt Cần Thiết",
                        "message": "Nhớ những phím tắt này: F11 cho Lớp Phủ Mở Rộng, Alt+T cho Dịch Màn Hình, Alt+Y cho Bộ Chọn Hộp Màn Hình. Bạn có thể tùy chỉnh tất cả phím tắt trong Cài đặt → Phím Tắt."
                    },
                    "finish": {
                        "title": "Bạn đã sẵn sàng!",
                        "message": "Đó là tất cả! Bạn đã sẵn sàng để bắt đầu sử dụng ứng dụng. Nhấn F11 để thử Lớp Phủ Mở Rộng, và khám phá tất cả các tính năng để tùy chỉnh trải nghiệm của bạn."
                    },
                    "buttons": {
                        "skip": "Bỏ qua",
                        "back": "Quay lại",
                        "next": "Tiếp theo",
                        "closeTour": "Đóng Tour"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Dịch Nhanh",
                    "description": "Dịch văn bản ngay lập tức bằng dịch vụ dịch AI",
                    "globalHotkey": "Phím Tắt Toàn Cục:",
                    "translateTo": "Dịch Sang",
                    "autoTranslate": "Tự Động Dịch",
                    "translatesAsYouType": "Dịch khi bạn gõ",
                    "clickTranslateOrPress": "Nhấp Dịch hoặc nhấn Ctrl+Enter",
                    "textToTranslate": "Văn Bản Cần Dịch",
                    "translationResult": "Kết Quả Dịch",
                    "translate": "Dịch",
                    "translating": "Đang dịch...",
                    "clear": "Xóa",
                    "copyResult": "Sao Chép Kết Quả",
                    "readyToTranslate": "Sẵn sàng dịch",
                    "typingDots": "Đang gõ...",
                    "translatingWord": "Đang dịch từ...",
                    "translationCompleted": "Dịch hoàn tất",
                    "translationFailed": "Dịch thất bại",
                    "copiedToClipboard": "Đã sao chép bản dịch vào clipboard",
                    "pleaseEnterText": "Vui lòng nhập văn bản cần dịch",
                    "autoTranslateEnabled": "Tự động dịch đã bật",
                    "autoTranslateDisabled": "Tự động dịch đã tắt - Nhấp Dịch",
                    "enterTextPlaceholder": "Nhập văn bản cần dịch...",
                    "translationPlaceholder": "Bản dịch sẽ xuất hiện ở đây..."
                },
                "settingsModal": {
                    "title": "Cài đặt",
                    "runInBackground": "Chạy nền",
                    "close": "Đóng",
                    "tabs": {
                        "account": "Tài khoản",
                        "apiKeys": "Khóa API",
                        "models": "Mô hình",
                        "cloudLocal": "Đám mây/Cục bộ",
                        "keybinds": "Phím tắt",
                        "themes": "Giao diện",
                        "languageLibrary": "Thư viện ngôn ngữ"
                    },
                    "keybinds": {
                        "title": "Phím Tắt",
                        "description": "Cấu hình phím tắt toàn cục cho các tính năng khác nhau. Hai chiều và dịch màn hình sử dụng {modifier} + phím. Nhấp \"Thay đổi\" để đặt phím mới.",
                        "ptt": "Nhấn để nói",
                        "pttDesc": "Giữ phím này để nói (mặc định: Space, không cần Alt)",
                        "bidirectional": "Chuyển đổi hai chiều",
                        "bidirectionalDesc": "Nhấn {modifier} + phím này để chuyển đổi chế độ hai chiều (mặc định: B)",
                        "screenTranslation": "Dịch màn hình",
                        "screenTranslationDesc": "Nhấn {modifier} + phím này để chụp màn hình (mặc định: T)",
                        "screenTranslationBox": "Hộp dịch màn hình",
                        "screenTranslationBoxDesc": "Nhấn {modifier} + phím này để chọn vùng hộp để dịch (mặc định: Y)",
                        "overlayToggle": "Chuyển đổi lớp phủ",
                        "overlayToggleDesc": "Nhấn phím này để chuyển đổi lớp phủ (mặc định: F11, không cần Alt)",
                        "quickTranslation": "Dịch nhanh",
                        "quickTranslationLocked": "Phím tắt này cố định và không thể thay đổi",
                        "change": "Thay đổi",
                        "locked": "Đã khóa",
                        "tip": "Nhấn để nói và chuyển đổi lớp phủ không cần {modifier}. Hai chiều và dịch màn hình yêu cầu {modifier} + phím. Nhấn ESC để hủy.",
                        "changeTitle": "Thay đổi {label}",
                        "changeDescAlt": "Nhấn bất kỳ phím nào để đặt là {modifier} + [phím của bạn]. {modifier} sẽ được thêm tự động. Nhấn ESC để hủy.",
                        "changeDescNoAlt": "Nhấn bất kỳ phím nào (khuyến nghị phím chức năng). Không cần phím bổ trợ. Nhấn ESC để hủy.",
                        "waitingForInput": "Đang chờ nhập..."
                    },
                    "themes": {
                        "title": "Chọn Giao Diện",
                        "description": "Chọn giao diện ưa thích của bạn. Thay đổi được áp dụng ngay lập tức.",
                        "active": "Đang dùng",
                        "select": "Chọn"
                    },
                    "account": {
                        "title": "Tài khoản",
                        "profile": "Hồ sơ",
                        "subscription": "Đăng ký",
                        "usage": "Sử dụng",
                        "preferences": "Tùy chọn",
                        "email": "Email",
                        "plan": "Gói",
                        "trialDays": "Ngày dùng thử còn lại",
                        "status": "Trạng thái",
                        "spokenLanguage": "Ngôn ngữ bạn nói",
                        "rememberResponses": "Lưu phản hồi API",
                        "rememberResponsesDesc": "Lưu trữ phản hồi API để theo dõi sử dụng và gỡ lỗi. Tắt để tăng cường quyền riêng tư.",
                        "usageUsed": "Đã dùng tháng này",
                        "usageRemaining": "còn lại",
                        "usageLoading": "Đang tải dữ liệu sử dụng...",
                        "usageError": "Không thể tải dữ liệu sử dụng",
                        "usageWarningHigh": "⚠️ Sử dụng cao tháng này",
                        "usageWarningLimit": "⚠️ Sắp đạt giới hạn sử dụng",
                        "openDashboard": "Quản lý đăng ký",
                        "signOut": "Đăng xuất",
                        "opening": "Đang mở...",
                        "error": "Không thể mở bảng điều khiển tài khoản. Vui lòng truy cập account.whispra.xyz thủ công.",
                        "loading": "Đang tải thông tin tài khoản...",
                        "trial": "Dùng thử miễn phí 7 ngày",
                        "active": "Đăng ký đang hoạt động",
                        "expired": "Đã hết hạn"
                    }
                }
            },'th': {
                "tab": {
                    "translation": "การแปล",
                    "bidirectional": "สองทิศทาง",
                    "soundboard": "แผงเสียง",
                    "settings": "การตั้งค่า"
                },
                "sidebar": {
                    "translate": "แปล",
                    "bidirectional": "สองทิศทาง",
                    "screenTranslation": "การแปลหน้าจอ",
                    "soundBoard": "แผงเสียง",
                    "voiceFilter": "ฟิลเตอร์เสียง",
                    "settings": "การตั้งค่า",
                    "logs": "บันทึก",
                    "menu": "เมนู",
                    "whispraTranslate": "Whispra แปล",
                    "screenTranslate": "แปลหน้าจอ",
                    "quickTranslate": "แปลด่วน",
                    "help": "ช่วยเหลือ"
                },
                "soundboard": {
                    "panel": {
                        "title": "แผงเสียง",
                        "description": "เล่นเสียงและคลิปเสียงที่กำหนดเองระหว่างการสนทนา"
                    },
                    "controls": {
                        "outputDevice": "อุปกรณ์เอาต์พุต",
                        "vbAudioVolume": "ระดับเสียง VB Audio",
                        "headphonesVolume": "ระดับเสียงหูฟัง",
                        "soundPadGrid": "ตารางแผงเสียง",
                        "enableHotkeys": "เปิดใช้งานปุ่มลัดแผงเสียง",
                        "addSoundFiles": "เพิ่มไฟล์เสียง",
                        "webOverlay": "เว็บโอเวอร์เลย์",
                        "stopAllSounds": "หยุดเสียงทั้งหมด"
                    },
                    "placeholders": {
                        "selectOutputDevice": "เลือกอุปกรณ์เอาต์พุต...",
                        "defaultSystemOutput": "เอาต์พุตระบบเริ่มต้น",
                        "virtualAudioCable": "สายเสียงเสมือน"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "โหมดสองทิศทาง"
                    },
                    "controls": {
                        "startBidirectional": "เริ่มโหมดสองทิศทาง",
                        "stopBidirectional": "หยุดโหมดสองทิศทาง",
                        "keybind": "แปลเป็น",
                        "toggleWith": "สลับกับ",
                        "changeKey": "เปลี่ยนปุ่ม",
                        "outputDevice": "อุปกรณ์เอาต์พุต",
                        "systemInput": "ข้อมูลนำเข้าสำหรับระบบ",
                        "incomingVoice": "เสียงที่เข้ามา",
                        "sourceLanguage": "ภาษาต้นทาง",
                        "appSelection": "การเลือกแอป"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "กำลังโหลดอุปกรณ์เอาต์พุต...",
                        "loadingVoices": "กำลังโหลดเสียง...",
                        "displaySystemAudio": "แสดง/เสียงระบบ (เริ่มต้น)"
                    },
                    "status": {
                        "idle": "ว่าง",
                        "waiting": "กำลังรอ...",
                        "ready": "พร้อม...",
                        "starting": "กำลังเริ่ม...",
                        "stopping": "กำลังหยุด..."
                    },
                    "labels": {
                        "detectedTarget": "ตรวจพบ (ภาษาต้นทาง)",
                        "respoken": "พูดซ้ำ (แปลเป็น)"
                    }
                },
                "header": {
                    "signOut": "ออกจากระบบ"
                },
                "footer": {
                    "becomeAffiliate": "เป็นพันธมิตร",
                    "reportBug": "รายงานข้อผิดพลาด / แนะนำฟีเจอร์"
                },
                "settings": {
                    "modal": {
                        "title": "การกำหนดค่า API ที่ปลอดภัย",
                        "close": "ปิด"
                    },
                    "instructions": {
                        "title": "คำแนะนำการตั้งค่า API Key",
                        "openaiTitle": "OpenAI API Key",
                        "openaiPermissions": "สิทธิ์การอ่าน: โมเดล, ความสามารถ",
                        "openaiUsage": "ใช้สำหรับการแปลงเสียงเป็นข้อความและข้อความเป็นเสียง",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API Key",
                        "elevenlabsRestrict": "จำกัดคีย์: เปิดใช้งาน",
                        "elevenlabsNoAccess": "ทุกอย่างอื่น: ไม่มีการเข้าถึง",
                        "elevenlabsTts": "ข้อความเป็นเสียง: การเข้าถึง",
                        "elevenlabsSts": "เสียงเป็นเสียง: การเข้าถึง",
                        "elevenlabsAgents": "ตัวแทน ElevenLabs: เขียน",
                        "elevenlabsVoices": "เสียง: เขียน",
                        "elevenlabsVoiceGen": "การสร้างเสียง: การเข้าถึง",
                        "elevenlabsUser": "ผู้ใช้: อ่าน",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API Key:",
                        "openaiPlaceholder": "กรุณาใส่ OpenAI API key ของคุณ",
                        "openaiStored": "คีย์ถูกเก็บอย่างปลอดภัย",
                        "openaiHelp": "กรุณาใส่ OpenAI API key ของคุณ (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API Key:",
                        "elevenlabsPlaceholder": "กรุณาใส่ ElevenLabs API key ของคุณ",
                        "elevenlabsStored": "คีย์ถูกเก็บอย่างปลอดภัย",
                        "elevenlabsHelp": "กรุณาใส่ ElevenLabs API key ของคุณ (32 ตัวอักษร)"
                    },
                    "buttons": {
                        "showKey": "แสดงคีย์",
                        "removeKey": "ลบคีย์",
                        "clearAll": "ลบคีย์ทั้งหมด",
                        "cancel": "ยกเลิก",
                        "save": "บันทึก"
                    },
                    "status": {
                        "keyStored": "✓ คีย์ถูกเก็บอย่างปลอดภัย"
                    },
                    "links": {
                        "openai": "สร้างคีย์ที่: platform.openai.com/api-keys",
                        "elevenlabs": "สร้างคีย์ที่: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "ไมโครโฟน",
                    "targetLanguage": "แปลเป็น",
                    "voice": "เสียง",
                    "output": "เอาต์พุต",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "เริ่มการแปล",
                    "stopTranslation": "หยุดการแปล",
                    "addCustomVoice": "เพิ่มเสียงที่กำหนดเอง",
                    "accent": "สำเนียง",
                    "noAccent": "ไม่มีสำเนียง",
                    "accentOn": "สำเนียง: เปิด",
                    "accentOff": "สำเนียง: ปิด"
                },
                "placeholders": {
                    "selectMicrophone": "เลือกไมโครโฟน...",
                    "loadingVoices": "กำลังโหลดเสียง...",
                    "selectVoice": "เลือกเสียง...",
                    "enterCustomAccent": "กรุณาใส่สำเนียงที่กำหนดเอง...",
                    "selectPreset": "เลือกพรีเซ็ต..."
                },
                "keys": {
                    "space": "SPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "ยินดีต้อนรับสู่ Whispra!",
                        "message": "ยินดีต้อนรับสู่แอป! มาทำความรู้จักกับส่วนติดต่อหลักกันอย่างรวดเร็ว."
                    },
                    "sidebar": {
                        "title": "การนำทางแถบด้านซ้าย",
                        "message": "นี่คือแถบนำทางหลักของคุณ ใช้เพื่อสลับระหว่างฟีเจอร์ต่างๆ เช่น Whispra Translate, การแปลหน้าจอ, การแปลด่วน และอื่นๆ."
                    },
                    "translateTab": {
                        "title": "แท็บแปล",
                        "message": "แท็บแปลคือพื้นที่ทำงานหลักของคุณสำหรับการแปลแบบเรียลไทม์ เริ่มพูดและดูคำพูดของคุณถูกแปลทันที."
                    },
                    "bidirectionalTab": {
                        "title": "โหมดสองทิศทาง",
                        "message": "โหมดสองทิศทางจะแปลการสนทนาในทั้งสองทิศทางโดยอัตโนมัติ เหมาะสำหรับการสนทนาที่เป็นธรรมชาติ."
                    },
                    "whispraTranslateTab": {
                        "title": "แท็บ Whispra Translate",
                        "message": "แท็บ Whispra Translate รวมการแปลแบบเรียลไทม์และโหมดสองทิศทางไว้ในอินเทอร์เฟซเดียว ใช้แผงด้านซ้ายสำหรับการแปลทางเดียวและแผงด้านขวาสำหรับการสนทนาสองทิศทาง เริ่มพูดและดูคำพูดของคุณถูกแปลทันที."
                    },
                    "screenTranslationTab": {
                        "title": "การแปลหน้าจอ",
                        "message": "การแปลหน้าจอจับข้อความจากหน้าจอของคุณและแปลในเวลาเรียลไทม์ เหมาะสำหรับการแปลเนื้อหาจากเกม, วิดีโอ หรือแอปพลิเคชัน."
                    },
                    "quickTranslateTab": {
                        "title": "แปลด่วน",
                        "message": "แปลด่วนให้การแปลทันทีด้วยปุ่มลัด กด Alt+C เพื่อแปลข้อความที่เลือกอย่างรวดเร็ว."
                    },
                    "soundBoardTab": {
                        "title": "แผงเสียง",
                        "message": "แผงเสียงให้คุณเล่นคลิปเสียงทันที เหมาะสำหรับการตอบสนองอย่างรวดเร็วหรือเสียงเอฟเฟกต์ระหว่างการสนทนา."
                    },
                    "profile": {
                        "title": "ส่วนโปรไฟล์",
                        "message": "เข้าถึงการตั้งค่าโปรไฟล์, ข้อมูลบัญชี, และออกจากระบบจากที่นี่."
                    },
                    "settings": {
                        "title": "เมนูการตั้งค่า",
                        "message": "คลิกปุ่มการตั้งค่าในแถบด้านข้างเพื่อเข้าถึงการตั้งค่าทั้งหมดของแอปพลิเคชัน เราจะแสดงให้คุณเห็นว่ามีอะไรอยู่ข้างในต่อไป."
                    },
                    "apiKeys": {
                        "title": "การกำหนดค่า API Keys",
                        "message": "กำหนดค่า API keys ของคุณที่นี่ คุณจะต้องใช้คีย์สำหรับ OpenAI (Whisper), บริการแปล, และ ElevenLabs สำหรับการสร้างเสียง."
                    },
                    "keybinds": {
                        "title": "ปุ่มลัด",
                        "message": "นี่คือที่ที่คุณสามารถกำหนดค่าปุ่มลัดสำหรับการกระทำอย่างรวดเร็ว ปรับแต่งปุ่มลัดของคุณให้เหมาะกับการทำงานของคุณ."
                    },
                    "models": {
                        "title": "โมเดล & การประมวลผล",
                        "message": "ที่นี่คุณสามารถเลือกโมเดล AI และปรับแต่งตัวเลือกการประมวลผล เลือกระหว่างการประมวลผลบนคลาวด์และท้องถิ่น และปรับแต่งพารามิเตอร์ของโมเดล."
                    },
                    "accountSettings": {
                        "title": "การตั้งค่าบัญชี & พื้นหลัง",
                        "message": "ในแท็บบัญชี คุณสามารถกำหนดพฤติกรรมของถาดระบบและการตั้งค่า Paddle warmup เปิดใช้งาน \"ทำงานในพื้นหลัง\" เพื่อย่อ Whispra ไปยังถาดระบบแทนที่จะปิดมันทั้งหมด."
                    },
                    "screenBoxSelector": {
                        "title": "ตัวเลือกกล่องหน้าจอ",
                        "message": "ใช้ Alt+Y (ปุ่มลัดเริ่มต้น) เพื่อเปิดใช้งานตัวเลือกกล่องหน้าจอ ซึ่งช่วยให้คุณเลือกพื้นที่เฉพาะบนหน้าจอของคุณสำหรับการแปลที่มุ่งเป้าแทนที่จะเป็นการแปลหน้าจอทั้งหมด."
                    },
                    "paddleWarmup": {
                        "title": "ฟีเจอร์ Paddle Warmup",
                        "message": "เปิดใช้งาน \"Paddle Warmup เมื่อเริ่มต้น\" เพื่อโหลดโมเดล OCR ล่วงหน้าเมื่อแอปเริ่มต้น ซึ่งทำให้การแปลหน้าจอเร็วขึ้นแต่เพิ่มเวลาเริ่มต้น คุณสามารถหาสวิตช์นี้ได้ในแท็บการตั้งค่าบัญชี."
                    },
                    "systemTray": {
                        "title": "การรวมกับถาดระบบ",
                        "message": "เมื่อเปิดใช้งาน \"ทำงานในพื้นหลัง\" การปิดหน้าต่างหลักจะทำให้ Whispra ย่อไปยังถาดระบบของคุณแทนที่จะออกจากระบบ คลิกที่ไอคอนถาดเพื่อกู้คืนหน้าต่าง หรือคลิกขวาเพื่อทำการกระทำอย่างรวดเร็ว."
                    },
                    "expandedOverlay": {
                        "title": "โอเวอร์เลย์ขยาย",
                        "message": "กด F11 (หรือปุ่มลัดที่คุณกำหนด) เพื่อเปิดโอเวอร์เลย์ขยาย - แผงควบคุมลอยที่อยู่ด้านบนของแอปพลิเคชันอื่นๆ เหมาะสำหรับการเล่นเกมหรือแอปพลิเคชันเต็มหน้าจอ! มันรวมฟีเจอร์ทั้งหมดที่เข้าถึงได้โดยไม่ต้องออกจากแอปพลิเคชันปัจจุบันของคุณ."
                    },
                    "hotkeys": {
                        "title": "ปุ่มลัดที่สำคัญ",
                        "message": "จำปุ่มลัดเหล่านี้: F11 สำหรับโอเวอร์เลย์ขยาย, Alt+T สำหรับการแปลหน้าจอ, Alt+Y สำหรับตัวเลือกกล่องหน้าจอ คุณสามารถปรับแต่งปุ่มลัดทั้งหมดในการตั้งค่า → ปุ่มลัด."
                    },
                    "finish": {
                        "title": "คุณพร้อมแล้ว!",
                        "message": "แค่นั้นแหละ! คุณพร้อมที่จะเริ่มใช้แอปแล้ว กด F11 เพื่อทดลองใช้โอเวอร์เลย์ขยาย และสำรวจฟีเจอร์ทั้งหมดเพื่อปรับแต่งประสบการณ์ของคุณ."
                    },
                    "buttons": {
                        "skip": "ข้าม",
                        "back": "กลับ",
                        "next": "ถัดไป",
                        "closeTour": "ปิดทัวร์"
                    }
                },
                "quickTranslatePanel": {
                    "title": "แปลด่วน",
                    "description": "แปลข้อความทันทีด้วยบริการแปล AI",
                    "globalHotkey": "ปุ่มลัดทั่วไป:",
                    "translateTo": "แปลเป็น",
                    "autoTranslate": "แปลอัตโนมัติ",
                    "translatesAsYouType": "แปลขณะพิมพ์",
                    "clickTranslateOrPress": "คลิกแปลหรือกด Ctrl+Enter",
                    "textToTranslate": "ข้อความที่จะแปล",
                    "translationResult": "ผลการแปล",
                    "translate": "แปล",
                    "translating": "กำลังแปล...",
                    "clear": "ล้าง",
                    "copyResult": "คัดลอกผลลัพธ์",
                    "readyToTranslate": "พร้อมแปล",
                    "typingDots": "กำลังพิมพ์...",
                    "translatingWord": "กำลังแปลคำ...",
                    "translationCompleted": "แปลเสร็จสิ้น",
                    "translationFailed": "แปลล้มเหลว",
                    "copiedToClipboard": "คัดลอกการแปลไปยังคลิปบอร์ดแล้ว",
                    "pleaseEnterText": "กรุณาใส่ข้อความที่จะแปล",
                    "autoTranslateEnabled": "เปิดใช้งานแปลอัตโนมัติ",
                    "autoTranslateDisabled": "ปิดใช้งานแปลอัตโนมัติ - คลิกแปล",
                    "enterTextPlaceholder": "ใส่ข้อความที่จะแปล...",
                    "translationPlaceholder": "การแปลจะปรากฏที่นี่..."
                },
                "settingsModal": {
                    "title": "การตั้งค่า",
                    "runInBackground": "ทำงานในพื้นหลัง",
                    "close": "ปิด",
                    "tabs": {
                        "account": "บัญชี",
                        "apiKeys": "คีย์ API",
                        "models": "โมเดล",
                        "cloudLocal": "คลาวด์/ท้องถิ่น",
                        "keybinds": "ปุ่มลัด",
                        "themes": "ธีม",
                        "languageLibrary": "ไลบรารีภาษา"
                    },
                    "keybinds": {
                        "title": "ปุ่มลัด",
                        "description": "กำหนดค่าปุ่มลัดทั่วไปสำหรับฟีเจอร์ต่างๆ สองทิศทางและการแปลหน้าจอใช้ {modifier} + ปุ่ม คลิก \"เปลี่ยน\" เพื่อตั้งค่าปุ่มใหม่",
                        "ptt": "กดเพื่อพูด",
                        "pttDesc": "กดปุ่มนี้ค้างไว้เพื่อพูด (ค่าเริ่มต้น: Space ไม่ต้องใช้ Alt)",
                        "bidirectional": "สลับสองทิศทาง",
                        "bidirectionalDesc": "กด {modifier} + ปุ่มนี้เพื่อสลับโหมดสองทิศทาง (ค่าเริ่มต้น: B)",
                        "screenTranslation": "แปลหน้าจอ",
                        "screenTranslationDesc": "กด {modifier} + ปุ่มนี้เพื่อจับภาพหน้าจอ (ค่าเริ่มต้น: T)",
                        "screenTranslationBox": "กล่องแปลหน้าจอ",
                        "screenTranslationBoxDesc": "กด {modifier} + ปุ่มนี้เพื่อเลือกพื้นที่กล่องสำหรับแปล (ค่าเริ่มต้น: Y)",
                        "overlayToggle": "สลับโอเวอร์เลย์",
                        "overlayToggleDesc": "กดปุ่มนี้เพื่อสลับโอเวอร์เลย์ (ค่าเริ่มต้น: F11 ไม่ต้องใช้ Alt)",
                        "quickTranslation": "แปลด่วน",
                        "quickTranslationLocked": "ปุ่มลัดนี้คงที่และไม่สามารถเปลี่ยนได้",
                        "change": "เปลี่ยน",
                        "locked": "ล็อค",
                        "tip": "กดเพื่อพูดและสลับโอเวอร์เลย์ไม่ต้องใช้ {modifier} สองทิศทางและแปลหน้าจอต้องใช้ {modifier} + ปุ่ม กด ESC เพื่อยกเลิก",
                        "changeTitle": "เปลี่ยน {label}",
                        "changeDescAlt": "กดปุ่มใดก็ได้เพื่อตั้งค่าเป็น {modifier} + [ปุ่มของคุณ] {modifier} จะถูกเพิ่มโดยอัตโนมัติ กด ESC เพื่อยกเลิก",
                        "changeDescNoAlt": "กดปุ่มใดก็ได้ (แนะนำปุ่มฟังก์ชัน) ไม่ต้องใช้ตัวปรับแต่ง กด ESC เพื่อยกเลิก",
                        "waitingForInput": "รอการป้อนข้อมูล..."
                    },
                    "themes": {
                        "title": "เลือกธีม",
                        "description": "เลือกธีมอินเทอร์เฟซที่คุณต้องการ การเปลี่ยนแปลงจะมีผลทันที",
                        "active": "ใช้งานอยู่",
                        "select": "เลือก"
                    },
                    "account": {
                        "title": "บัญชี",
                        "profile": "โปรไฟล์",
                        "subscription": "การสมัครสมาชิก",
                        "usage": "การใช้งาน",
                        "preferences": "การตั้งค่า",
                        "email": "อีเมล",
                        "plan": "แผน",
                        "trialDays": "วันทดลองใช้ที่เหลือ",
                        "status": "สถานะ",
                        "spokenLanguage": "ภาษาที่คุณพูด",
                        "rememberResponses": "บันทึกการตอบกลับ API",
                        "rememberResponsesDesc": "จัดเก็บการตอบกลับ API สำหรับการติดตามการใช้งานและการดีบัก ปิดใช้งานเพื่อความเป็นส่วนตัวที่เพิ่มขึ้น",
                        "usageUsed": "ใช้ไปเดือนนี้",
                        "usageRemaining": "เหลือ",
                        "usageLoading": "กำลังโหลดข้อมูลการใช้งาน...",
                        "usageError": "ไม่สามารถโหลดข้อมูลการใช้งาน",
                        "usageWarningHigh": "⚠️ การใช้งานสูงเดือนนี้",
                        "usageWarningLimit": "⚠️ ใกล้ถึงขีดจำกัดการใช้งาน",
                        "openDashboard": "จัดการการสมัครสมาชิก",
                        "signOut": "ออกจากระบบ",
                        "opening": "กำลังเปิด...",
                        "error": "ไม่สามารถเปิดแผงบัญชี กรุณาเยี่ยมชม account.whispra.xyz ด้วยตนเอง",
                        "loading": "กำลังโหลดข้อมูลบัญชี...",
                        "trial": "ทดลองใช้ฟรี 7 วัน",
                        "active": "การสมัครสมาชิกที่ใช้งานอยู่",
                        "expired": "หมดอายุ"
                    }
                }
            },'hi': {
                "tab": {
                    "translation": "अनुवाद",
                    "bidirectional": "द्विदिश",
                    "soundboard": "साउंडबोर्ड",
                    "settings": "सेटिंग्स"
                },
                "sidebar": {
                    "translate": "अनुवाद करें",
                    "bidirectional": "द्विदिश",
                    "screenTranslation": "स्क्रीन अनुवाद",
                    "soundBoard": "साउंड बोर्ड",
                    "voiceFilter": "वॉयस फ़िल्टर",
                    "settings": "सेटिंग्स",
                    "logs": "लॉग",
                    "menu": "मेनू",
                    "whispraTranslate": "Whispra अनुवाद",
                    "screenTranslate": "स्क्रीन अनुवाद",
                    "quickTranslate": "त्वरित अनुवाद",
                    "help": "मदद"
                },
                "soundboard": {
                    "panel": {
                        "title": "साउंड बोर्ड",
                        "description": "बातचीत के दौरान कस्टम ध्वनियाँ और ऑडियो क्लिप चलाएँ"
                    },
                    "controls": {
                        "outputDevice": "आउटपुट डिवाइस",
                        "vbAudioVolume": "VB ऑडियो वॉल्यूम",
                        "headphonesVolume": "हेडफ़ोन वॉल्यूम",
                        "soundPadGrid": "साउंड पैड ग्रिड",
                        "enableHotkeys": "साउंडबोर्ड हॉटकीज़ सक्षम करें",
                        "addSoundFiles": "ध्वनि फ़ाइलें जोड़ें",
                        "webOverlay": "वेब ओवरले",
                        "stopAllSounds": "सभी ध्वनियाँ रोकें"
                    },
                    "placeholders": {
                        "selectOutputDevice": "आउटपुट डिवाइस चुनें...",
                        "defaultSystemOutput": "डिफ़ॉल्ट सिस्टम आउटपुट",
                        "virtualAudioCable": "वर्चुअल ऑडियो केबल"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "द्विदिश मोड"
                    },
                    "controls": {
                        "startBidirectional": "द्विदिश प्रारंभ करें",
                        "stopBidirectional": "द्विदिश रोकें",
                        "keybind": "अनुवाद करें",
                        "toggleWith": "स्विच करें",
                        "changeKey": "कुंजी बदलें",
                        "outputDevice": "आउटपुट डिवाइस",
                        "systemInput": "सिस्टम इनपुट",
                        "incomingVoice": "इनकमिंग वॉयस",
                        "sourceLanguage": "स्रोत भाषा",
                        "appSelection": "ऐप चयन"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "आउटपुट डिवाइस लोड हो रहे हैं...",
                        "loadingVoices": "वॉयस लोड हो रही हैं...",
                        "displaySystemAudio": "डिस्प्ले/सिस्टम ऑडियो (डिफ़ॉल्ट)"
                    },
                    "status": {
                        "idle": "खाली",
                        "waiting": "इंतज़ार कर रहा...",
                        "ready": "तैयार...",
                        "starting": "शुरू हो रहा...",
                        "stopping": "रोक रहा..."
                    },
                    "labels": {
                        "detectedTarget": "पाया गया (स्रोत भाषा)",
                        "respoken": "फिर से बोला गया (अनुवाद करें)"
                    }
                },
                "header": {
                    "signOut": "साइन आउट"
                },
                "footer": {
                    "becomeAffiliate": "सहयोगी बनें",
                    "reportBug": "बग रिपोर्ट करें / सुविधा सुझाएं"
                },
                "settings": {
                    "modal": {
                        "title": "सुरक्षित API कॉन्फ़िगरेशन",
                        "close": "बंद करें"
                    },
                    "instructions": {
                        "title": "API कुंजी सेटअप निर्देश",
                        "openaiTitle": "OpenAI API कुंजी",
                        "openaiPermissions": "पढ़ने की अनुमति: मॉडल, क्षमताएँ",
                        "openaiUsage": "स्पीच-टू-टेक्स्ट और टेक्स्ट-टू-स्पीच अनुवाद के लिए उपयोग किया जाता है",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API कुंजी",
                        "elevenlabsRestrict": "कुंजी प्रतिबंधित: सक्षम",
                        "elevenlabsNoAccess": "बाकी सब: कोई पहुंच नहीं",
                        "elevenlabsTts": "टेक्स्ट से स्पीच: पहुंच",
                        "elevenlabsSts": "स्पीच से स्पीच: पहुंच",
                        "elevenlabsAgents": "ElevenLabs एजेंट: लिखें",
                        "elevenlabsVoices": "वॉयस: लिखें",
                        "elevenlabsVoiceGen": "वॉयस जनरेशन: पहुंच",
                        "elevenlabsUser": "उपयोगकर्ता: पढ़ें",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API कुंजी:",
                        "openaiPlaceholder": "अपनी OpenAI API कुंजी दर्ज करें",
                        "openaiStored": "कुंजी सुरक्षित रूप से संग्रहीत",
                        "openaiHelp": "अपनी OpenAI API कुंजी दर्ज करें (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API कुंजी:",
                        "elevenlabsPlaceholder": "अपनी ElevenLabs API कुंजी दर्ज करें",
                        "elevenlabsStored": "कुंजी सुरक्षित रूप से संग्रहीत",
                        "elevenlabsHelp": "अपनी ElevenLabs API कुंजी दर्ज करें (32 अक्षर)"
                    },
                    "buttons": {
                        "showKey": "कुंजी दिखाएँ",
                        "removeKey": "कुंजी हटाएँ",
                        "clearAll": "सभी कुंजियाँ हटाएँ",
                        "cancel": "रद्द करें",
                        "save": "सहेजें"
                    },
                    "status": {
                        "keyStored": "✓ कुंजी सुरक्षित रूप से संग्रहीत"
                    },
                    "links": {
                        "openai": "कुंजी उत्पन्न करें: platform.openai.com/api-keys",
                        "elevenlabs": "कुंजी उत्पन्न करें: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "माइक्रोफोन",
                    "targetLanguage": "अनुवाद करें",
                    "voice": "वॉयस",
                    "output": "आउटपुट",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "अनुवाद शुरू करें",
                    "stopTranslation": "अनुवाद रोकें",
                    "addCustomVoice": "कस्टम वॉयस जोड़ें",
                    "accent": "उच्चारण",
                    "noAccent": "कोई उच्चारण नहीं",
                    "accentOn": "उच्चारण: चालू",
                    "accentOff": "उच्चारण: बंद"
                },
                "placeholders": {
                    "selectMicrophone": "माइक्रोफोन चुनें...",
                    "loadingVoices": "वॉयस लोड हो रही हैं...",
                    "selectVoice": "वॉयस चुनें...",
                    "enterCustomAccent": "कस्टम उच्चारण दर्ज करें...",
                    "selectPreset": "प्रीसेट चुनें..."
                },
                "keys": {
                    "space": "SPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Whispra में आपका स्वागत है!",
                        "message": "ऐप में आपका स्वागत है! आइए मुख्य इंटरफ़ेस के माध्यम से जल्दी से चलते हैं।"
                    },
                    "sidebar": {
                        "title": "बाएँ साइडबार नेविगेशन",
                        "message": "यह आपका मुख्य नेविगेशन बार है। इसका उपयोग विभिन्न सुविधाओं के बीच स्विच करने के लिए करें जैसे Whispra Translate, स्क्रीन अनुवाद, त्वरित अनुवाद, और अधिक।"
                    },
                    "translateTab": {
                        "title": "अनुवाद टैब",
                        "message": "अनुवाद टैब आपका मुख्य कार्यक्षेत्र है वास्तविक समय के अनुवाद के लिए। बोलना शुरू करें और देखें कि आपके शब्द तुरंत अनुवादित हो जाते हैं।"
                    },
                    "bidirectionalTab": {
                        "title": "द्विदिश मोड",
                        "message": "द्विदिश मोड स्वचालित रूप से दोनों दिशाओं में बातचीत का अनुवाद करता है। प्राकृतिक बातचीत के लिए एकदम सही।"
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate टैब",
                        "message": "Whispra Translate टैब वास्तविक समय अनुवाद और द्विदिश मोड को एक एकीकृत इंटरफ़ेस में जोड़ता है। एक-तरफ़ा अनुवाद के लिए बाएँ पैनल और द्विदिश बातचीत के लिए दाएँ पैनल का उपयोग करें। बोलना शुरू करें और देखें कि आपके शब्द तुरंत अनुवादित हो जाते हैं।"
                    },
                    "screenTranslationTab": {
                        "title": "स्क्रीन अनुवाद",
                        "message": "स्क्रीन अनुवाद आपके स्क्रीन से पाठ कैप्चर करता है और इसे वास्तविक समय में अनुवाद करता है। खेलों, वीडियो, या अनुप्रयोगों से सामग्री का अनुवाद करने के लिए महान।"
                    },
                    "quickTranslateTab": {
                        "title": "त्वरित अनुवाद",
                        "message": "त्वरित अनुवाद आपको कीबोर्ड शॉर्टकट के साथ त्वरित अनुवाद देता है। चयनित पाठ को जल्दी से अनुवादित करने के लिए Alt+C दबाएँ।"
                    },
                    "soundBoardTab": {
                        "title": "साउंड बोर्ड",
                        "message": "साउंड बोर्ड आपको तुरंत ऑडियो क्लिप चलाने की अनुमति देता है। बातचीत के दौरान त्वरित प्रतिक्रियाओं या ध्वनि प्रभावों के लिए एकदम सही।"
                    },
                    "profile": {
                        "title": "प्रोफ़ाइल अनुभाग",
                        "message": "यहाँ अपनी प्रोफ़ाइल सेटिंग्स, खाता जानकारी, और साइन आउट करें।"
                    },
                    "settings": {
                        "title": "सेटिंग्स मेनू",
                        "message": "साइडबार में सेटिंग्स बटन पर क्लिक करें सभी एप्लिकेशन सेटिंग्स तक पहुँचने के लिए। हम आपको अगली बार अंदर क्या है दिखाएंगे।"
                    },
                    "apiKeys": {
                        "title": "API कुंजी कॉन्फ़िगरेशन",
                        "message": "यहाँ अपनी API कुंजियाँ कॉन्फ़िगर करें। आपको OpenAI (Whisper), अनुवाद सेवाओं, और वॉयस सिंथेसिस के लिए ElevenLabs के लिए कुंजियों की आवश्यकता होगी।"
                    },
                    "keybinds": {
                        "title": "कीबोर्ड शॉर्टकट",
                        "message": "यह वह जगह है जहाँ आप त्वरित क्रियाओं के लिए कीबोर्ड शॉर्टकट कॉन्फ़िगर कर सकते हैं। अपने कार्यप्रवाह के अनुसार अपनी हॉटकीज़ को अनुकूलित करें।"
                    },
                    "models": {
                        "title": "मॉडल और प्रोसेसिंग",
                        "message": "यहाँ आप AI मॉडल चुन सकते हैं और प्रोसेसिंग विकल्प समायोजित कर सकते हैं। क्लाउड और स्थानीय प्रोसेसिंग के बीच चुनें, और मॉडल पैरामीटर को ठीक करें।"
                    },
                    "accountSettings": {
                        "title": "खाता और पृष्ठभूमि सेटिंग्स",
                        "message": "खाता टैब में, आप सिस्टम ट्रे व्यवहार और पैडल वार्मअप सेटिंग्स कॉन्फ़िगर कर सकते हैं। \"पृष्ठभूमि में चलाएँ\" सक्षम करें ताकि Whispra को पूरी तरह से बंद करने के बजाय सिस्टम ट्रे में कम किया जा सके।"
                    },
                    "screenBoxSelector": {
                        "title": "स्क्रीन बॉक्स चयनकर्ता",
                        "message": "स्क्रीन बॉक्स चयनकर्ता सक्रिय करने के लिए Alt+Y (डिफ़ॉल्ट हॉटकी) का उपयोग करें। यह आपको लक्षित अनुवाद के लिए अपने स्क्रीन के विशिष्ट क्षेत्रों का चयन करने की अनुमति देता है, पूरे स्क्रीन का अनुवाद करने के बजाय।"
                    },
                    "paddleWarmup": {
                        "title": "पैडल वार्मअप फ़ीचर",
                        "message": "\"स्टार्टअप पर पैडल वार्मअप\" सक्षम करें ताकि ऐप शुरू होने पर OCR मॉडल प्रीलोड हो जाएँ। यह स्क्रीन अनुवाद को तेज़ बनाता है लेकिन स्टार्टअप समय बढ़ाता है। आप इस टॉगल को खाता सेटिंग्स टैब में पा सकते हैं।"
                    },
                    "systemTray": {
                        "title": "सिस्टम ट्रे एकीकरण",
                        "message": "\"पृष्ठभूमि में चलाएँ\" सक्षम होने पर, मुख्य विंडो बंद करने से Whispra आपके सिस्टम ट्रे में कम हो जाएगा। विंडो को पुनर्स्थापित करने के लिए ट्रे आइकन पर क्लिक करें, या त्वरित क्रियाओं के लिए राइट-क्लिक करें।"
                    },
                    "expandedOverlay": {
                        "title": "विस्तारित ओवरले",
                        "message": "विस्तारित ओवरले खोलने के लिए F11 (या आपकी कॉन्फ़िगर की गई हॉटकी) दबाएँ - एक तैरता हुआ नियंत्रण पैनल जो अन्य अनुप्रयोगों के ऊपर रहता है। गेमिंग या फुलस्क्रीन ऐप्स के लिए एकदम सही! इसमें सभी समान सुविधाएँ शामिल हैं जो आपके वर्तमान अनुप्रयोग को छोड़े बिना सुलभ हैं।"
                    },
                    "hotkeys": {
                        "title": "अनिवार्य हॉटकीज़",
                        "message": "इन की शॉर्टकट को याद रखें: विस्तारित ओवरले के लिए F11, स्क्रीन अनुवाद के लिए Alt+T, स्क्रीन बॉक्स चयनकर्ता के लिए Alt+Y। आप सेटिंग्स → कीबाइंड्स में सभी हॉटकीज़ को अनुकूलित कर सकते हैं।"
                    },
                    "finish": {
                        "title": "आप सब सेट हैं!",
                        "message": "बस इतना ही! आप ऐप का उपयोग करने के लिए तैयार हैं। विस्तारित ओवरले का प्रयास करने के लिए F11 दबाएँ, और अपने अनुभव को अनुकूलित करने के लिए सभी सुविधाओं का अन्वेषण करें।"
                    },
                    "buttons": {
                        "skip": "छोड़ें",
                        "back": "वापस",
                        "next": "अगला",
                        "closeTour": "टूर बंद करें"
                    }
                },
                "quickTranslatePanel": {
                    "title": "त्वरित अनुवाद",
                    "description": "AI अनुवाद सेवाओं का उपयोग करके तुरंत टेक्स्ट का अनुवाद करें",
                    "globalHotkey": "वैश्विक हॉटकी:",
                    "translateTo": "में अनुवाद करें",
                    "autoTranslate": "स्वतः अनुवाद",
                    "translatesAsYouType": "टाइप करते समय अनुवाद करता है",
                    "clickTranslateOrPress": "अनुवाद पर क्लिक करें या Ctrl+Enter दबाएं",
                    "textToTranslate": "अनुवाद करने के लिए टेक्स्ट",
                    "translationResult": "अनुवाद परिणाम",
                    "translate": "अनुवाद करें",
                    "translating": "अनुवाद हो रहा है...",
                    "clear": "साफ़ करें",
                    "copyResult": "परिणाम कॉपी करें",
                    "readyToTranslate": "अनुवाद के लिए तैयार",
                    "typingDots": "टाइप कर रहे हैं...",
                    "translatingWord": "शब्द का अनुवाद हो रहा है...",
                    "translationCompleted": "अनुवाद पूर्ण",
                    "translationFailed": "अनुवाद विफल",
                    "copiedToClipboard": "अनुवाद क्लिपबोर्ड पर कॉपी किया गया",
                    "pleaseEnterText": "कृपया अनुवाद करने के लिए टेक्स्ट दर्ज करें",
                    "autoTranslateEnabled": "स्वतः अनुवाद सक्षम",
                    "autoTranslateDisabled": "स्वतः अनुवाद अक्षम - अनुवाद पर क्लिक करें",
                    "enterTextPlaceholder": "अनुवाद करने के लिए टेक्स्ट दर्ज करें...",
                    "translationPlaceholder": "अनुवाद यहाँ दिखाई देगा..."
                },
                "settingsModal": {
                    "title": "सेटिंग्स",
                    "runInBackground": "बैकग्राउंड में चलाएं",
                    "close": "बंद करें",
                    "tabs": {
                        "account": "खाता",
                        "apiKeys": "API कुंजियाँ",
                        "models": "मॉडल",
                        "cloudLocal": "क्लाउड/स्थानीय",
                        "keybinds": "कीबाइंड",
                        "themes": "थीम",
                        "languageLibrary": "भाषा लाइब्रेरी"
                    },
                    "keybinds": {
                        "title": "कीबाइंड",
                        "description": "विभिन्न सुविधाओं के लिए ग्लोबल हॉटकी कॉन्फ़िगर करें। द्विदिश और स्क्रीन अनुवाद {modifier} + कुंजी का उपयोग करते हैं। नई कुंजी सेट करने के लिए \"बदलें\" पर क्लिक करें।",
                        "ptt": "बोलने के लिए दबाएं",
                        "pttDesc": "बोलने के लिए इस कुंजी को दबाए रखें (डिफ़ॉल्ट: स्पेस, Alt की जरूरत नहीं)",
                        "bidirectional": "द्विदिश टॉगल करें",
                        "bidirectionalDesc": "द्विदिश मोड टॉगल करने के लिए {modifier} + यह कुंजी दबाएं (डिफ़ॉल्ट: B)",
                        "screenTranslation": "स्क्रीन अनुवाद",
                        "screenTranslationDesc": "स्क्रीन कैप्चर करने के लिए {modifier} + यह कुंजी दबाएं (डिफ़ॉल्ट: T)",
                        "screenTranslationBox": "स्क्रीन अनुवाद बॉक्स",
                        "screenTranslationBoxDesc": "अनुवाद के लिए बॉक्स क्षेत्र चुनने के लिए {modifier} + यह कुंजी दबाएं (डिफ़ॉल्ट: Y)",
                        "overlayToggle": "ओवरले टॉगल करें",
                        "overlayToggleDesc": "ओवरले टॉगल करने के लिए यह कुंजी दबाएं (डिफ़ॉल्ट: F11, Alt की जरूरत नहीं)",
                        "quickTranslation": "त्वरित अनुवाद",
                        "quickTranslationLocked": "यह हॉटकी निश्चित है और बदली नहीं जा सकती",
                        "change": "बदलें",
                        "locked": "लॉक",
                        "tip": "बोलने के लिए दबाएं और ओवरले टॉगल को {modifier} की जरूरत नहीं। द्विदिश और स्क्रीन अनुवाद को {modifier} + कुंजी चाहिए। रद्द करने के लिए ESC दबाएं।",
                        "changeTitle": "{label} बदलें",
                        "changeDescAlt": "{modifier} + [आपकी कुंजी] के रूप में सेट करने के लिए कोई भी कुंजी दबाएं। {modifier} स्वचालित रूप से जोड़ा जाएगा। रद्द करने के लिए ESC दबाएं।",
                        "changeDescNoAlt": "कोई भी कुंजी दबाएं (फंक्शन कुंजियाँ अनुशंसित)। मॉडिफायर की जरूरत नहीं। रद्द करने के लिए ESC दबाएं।",
                        "waitingForInput": "इनपुट की प्रतीक्षा..."
                    },
                    "themes": {
                        "title": "थीम चयन",
                        "description": "अपनी पसंदीदा इंटरफ़ेस थीम चुनें। परिवर्तन तुरंत लागू होते हैं।",
                        "active": "सक्रिय",
                        "select": "चुनें"
                    },
                    "account": {
                        "title": "खाता",
                        "profile": "प्रोफ़ाइल",
                        "subscription": "सदस्यता",
                        "usage": "उपयोग",
                        "preferences": "प्राथमिकताएं",
                        "email": "ईमेल",
                        "plan": "योजना",
                        "trialDays": "शेष परीक्षण दिन",
                        "status": "स्थिति",
                        "spokenLanguage": "आप जो भाषा बोलते हैं",
                        "rememberResponses": "API प्रतिक्रियाएं सहेजें",
                        "rememberResponsesDesc": "उपयोग ट्रैकिंग और डीबगिंग के लिए API प्रतिक्रियाएं संग्रहीत करें। बढ़ी हुई गोपनीयता के लिए अक्षम करें।",
                        "usageUsed": "इस महीने उपयोग किया गया",
                        "usageRemaining": "शेष",
                        "usageLoading": "उपयोग डेटा लोड हो रहा है...",
                        "usageError": "उपयोग डेटा लोड करने में असमर्थ",
                        "usageWarningHigh": "⚠️ इस महीने उच्च उपयोग",
                        "usageWarningLimit": "⚠️ उपयोग सीमा के करीब",
                        "openDashboard": "सदस्यता प्रबंधित करें",
                        "signOut": "साइन आउट",
                        "opening": "खुल रहा है...",
                        "error": "खाता डैशबोर्ड खोलने में विफल। कृपया account.whispra.xyz पर मैन्युअल रूप से जाएं।",
                        "loading": "खाता जानकारी लोड हो रही है...",
                        "trial": "7-दिन का मुफ्त परीक्षण",
                        "active": "सक्रिय सदस्यता",
                        "expired": "समाप्त"
                    }
                }
            },'ar': {
                "tab": {
                    "translation": "ترجمة",
                    "bidirectional": "ثنائي الاتجاه",
                    "soundboard": "لوحة الصوت",
                    "settings": "الإعدادات"
                },
                "sidebar": {
                    "translate": "ترجمة",
                    "bidirectional": "ثنائي الاتجاه",
                    "screenTranslation": "ترجمة الشاشة",
                    "soundBoard": "لوحة الصوت",
                    "voiceFilter": "فلتر الصوت",
                    "settings": "الإعدادات",
                    "logs": "السجلات",
                    "menu": "القائمة",
                    "whispraTranslate": "Whispra ترجمة",
                    "screenTranslate": "ترجمة الشاشة",
                    "quickTranslate": "ترجمة سريعة",
                    "help": "مساعدة"
                },
                "soundboard": {
                    "panel": {
                        "title": "لوحة الصوت",
                        "description": "تشغيل الأصوات المخصصة ومقاطع الصوت أثناء المحادثات"
                    },
                    "controls": {
                        "outputDevice": "جهاز الإخراج",
                        "vbAudioVolume": "حجم صوت VB Audio",
                        "headphonesVolume": "حجم سماعات الرأس",
                        "soundPadGrid": "شبكة لوحة الصوت",
                        "enableHotkeys": "تفعيل اختصارات لوحة الصوت",
                        "addSoundFiles": "إضافة ملفات صوتية",
                        "webOverlay": "تراكب الويب",
                        "stopAllSounds": "إيقاف جميع الأصوات"
                    },
                    "placeholders": {
                        "selectOutputDevice": "اختر جهاز الإخراج...",
                        "defaultSystemOutput": "الإخراج الافتراضي للنظام",
                        "virtualAudioCable": "كابل الصوت الافتراضي"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "وضع ثنائي الاتجاه"
                    },
                    "controls": {
                        "startBidirectional": "بدء ثنائي الاتجاه",
                        "stopBidirectional": "إيقاف ثنائي الاتجاه",
                        "keybind": "ترجمة إلى",
                        "toggleWith": "التبديل مع",
                        "changeKey": "تغيير المفتاح",
                        "outputDevice": "جهاز الإخراج",
                        "systemInput": "إدخال النظام",
                        "incomingVoice": "صوت وارد",
                        "sourceLanguage": "اللغة المصدر",
                        "appSelection": "اختيار التطبيق"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "جارٍ تحميل أجهزة الإخراج...",
                        "loadingVoices": "جارٍ تحميل الأصوات...",
                        "displaySystemAudio": "عرض/صوت النظام (افتراضي)"
                    },
                    "status": {
                        "idle": "خامل",
                        "waiting": "في الانتظار...",
                        "ready": "جاهز...",
                        "starting": "يبدأ...",
                        "stopping": "يتوقف..."
                    },
                    "labels": {
                        "detectedTarget": "تم الكشف عن (اللغة المصدر)",
                        "respoken": "إعادة النطق (ترجمة إلى)"
                    }
                },
                "header": {
                    "signOut": "تسجيل الخروج"
                },
                "footer": {
                    "becomeAffiliate": "كن شريكاً",
                    "reportBug": "الإبلاغ عن خطأ / اقتراح ميزة"
                },
                "settings": {
                    "modal": {
                        "title": "تكوين API آمن",
                        "close": "إغلاق"
                    },
                    "instructions": {
                        "title": "تعليمات إعداد مفتاح API",
                        "openaiTitle": "مفتاح API لـ OpenAI",
                        "openaiPermissions": "أذونات القراءة: النماذج، القدرات",
                        "openaiUsage": "يستخدم لترجمة الكلام إلى نص والنص إلى كلام",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "مفتاح API لـ ElevenLabs",
                        "elevenlabsRestrict": "تقييد المفتاح: مفعل",
                        "elevenlabsNoAccess": "كل شيء آخر: لا يوجد وصول",
                        "elevenlabsTts": "النص إلى الكلام: وصول",
                        "elevenlabsSts": "الكلام إلى الكلام: وصول",
                        "elevenlabsAgents": "وكلاء ElevenLabs: كتابة",
                        "elevenlabsVoices": "الأصوات: كتابة",
                        "elevenlabsVoiceGen": "توليد الصوت: وصول",
                        "elevenlabsUser": "المستخدم: قراءة",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "مفتاح API لـ OpenAI:",
                        "openaiPlaceholder": "أدخل مفتاح API الخاص بـ OpenAI",
                        "openaiStored": "تم تخزين المفتاح بأمان",
                        "openaiHelp": "أدخل مفتاح API الخاص بـ OpenAI (sk-...)",
                        "elevenlabsLabel": "مفتاح API لـ ElevenLabs:",
                        "elevenlabsPlaceholder": "أدخل مفتاح API الخاص بـ ElevenLabs",
                        "elevenlabsStored": "تم تخزين المفتاح بأمان",
                        "elevenlabsHelp": "أدخل مفتاح API الخاص بـ ElevenLabs (32 حرف)"
                    },
                    "buttons": {
                        "showKey": "عرض المفتاح",
                        "removeKey": "إزالة المفتاح",
                        "clearAll": "مسح جميع المفاتيح",
                        "cancel": "إلغاء",
                        "save": "حفظ"
                    },
                    "status": {
                        "keyStored": "✓ تم تخزين المفتاح بأمان"
                    },
                    "links": {
                        "openai": "توليد مفتاح في: platform.openai.com/api-keys",
                        "elevenlabs": "توليد مفتاح في: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "الميكروفون",
                    "targetLanguage": "ترجمة إلى",
                    "voice": "صوت",
                    "output": "الإخراج",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "بدء الترجمة",
                    "stopTranslation": "إيقاف الترجمة",
                    "addCustomVoice": "إضافة صوت مخصص",
                    "accent": "لهجة",
                    "noAccent": "بدون لهجة",
                    "accentOn": "لهجة: مفعل",
                    "accentOff": "لهجة: غير مفعل"
                },
                "placeholders": {
                    "selectMicrophone": "اختر الميكروفون...",
                    "loadingVoices": "جارٍ تحميل الأصوات...",
                    "selectVoice": "اختر الصوت...",
                    "enterCustomAccent": "أدخل لهجة مخصصة...",
                    "selectPreset": "اختر إعداد مسبق..."
                },
                "keys": {
                    "space": "SPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "مرحبًا بك في Whispra!",
                        "message": "مرحبًا بك في التطبيق! دعنا نمر سريعًا عبر الواجهة الرئيسية."
                    },
                    "sidebar": {
                        "title": "تنقل الشريط الجانبي الأيسر",
                        "message": "هذه هي شريط التنقل الرئيسي الخاص بك. استخدمه للتبديل بين الميزات المختلفة مثل Whispra Translate، ترجمة الشاشة، الترجمة السريعة، والمزيد."
                    },
                    "translateTab": {
                        "title": "علامة الترجمة",
                        "message": "علامة الترجمة هي مساحة العمل الرئيسية الخاصة بك للترجمة في الوقت الحقيقي. ابدأ بالتحدث وشاهد كلماتك تُترجم على الفور."
                    },
                    "bidirectionalTab": {
                        "title": "وضع ثنائي الاتجاه",
                        "message": "وضع ثنائي الاتجاه يترجم المحادثات في كلا الاتجاهين تلقائيًا. مثالي للحوار الطبيعي المتبادل."
                    },
                    "whispraTranslateTab": {
                        "title": "علامة Whispra Translate",
                        "message": "تجمع علامة Whispra Translate الترجمة في الوقت الحقيقي ووضع ثنائي الاتجاه في واجهة موحدة واحدة. استخدم اللوحة اليسرى للترجمة أحادية الاتجاه واللوحة اليمنى للمحادثات ثنائية الاتجاه. ابدأ بالتحدث وشاهد كلماتك تُترجم على الفور."
                    },
                    "screenTranslationTab": {
                        "title": "ترجمة الشاشة",
                        "message": "ترجمة الشاشة تلتقط النص من شاشتك وتترجمه في الوقت الحقيقي. رائع لترجمة المحتوى من الألعاب، الفيديوهات، أو التطبيقات."
                    },
                    "quickTranslateTab": {
                        "title": "ترجمة سريعة",
                        "message": "تتيح لك الترجمة السريعة الحصول على ترجمة فورية باستخدام اختصار لوحة المفاتيح. اضغط على Alt+C لترجمة النص المحدد بسرعة."
                    },
                    "soundBoardTab": {
                        "title": "لوحة الصوت",
                        "message": "تتيح لك لوحة الصوت تشغيل مقاطع الصوت على الفور. مثالية للردود السريعة أو المؤثرات الصوتية أثناء المحادثات."
                    },
                    "profile": {
                        "title": "قسم الملف الشخصي",
                        "message": "الوصول إلى إعدادات ملفك الشخصي، معلومات الحساب، وتسجيل الخروج من هنا."
                    },
                    "settings": {
                        "title": "قائمة الإعدادات",
                        "message": "انقر على زر الإعدادات في الشريط الجانبي للوصول إلى جميع إعدادات التطبيق. سنعرض لك ما بداخلها بعد ذلك."
                    },
                    "apiKeys": {
                        "title": "تكوين مفاتيح API",
                        "message": "قم بتكوين مفاتيح API الخاصة بك هنا. ستحتاج إلى مفاتيح لـ OpenAI (Whisper)، خدمات الترجمة، وElevenLabs لتوليد الصوت."
                    },
                    "keybinds": {
                        "title": "اختصارات لوحة المفاتيح",
                        "message": "هذا هو المكان الذي يمكنك فيه تكوين اختصارات لوحة المفاتيح للإجراءات السريعة. خصص اختصاراتك لتناسب سير العمل الخاص بك."
                    },
                    "models": {
                        "title": "النماذج والمعالجة",
                        "message": "هنا يمكنك اختيار نماذج الذكاء الاصطناعي وضبط خيارات المعالجة. اختر بين المعالجة السحابية والمحلية، وقم بضبط معلمات النموذج."
                    },
                    "accountSettings": {
                        "title": "إعدادات الحساب والخلفية",
                        "message": "في علامة التبويب الحساب، يمكنك تكوين سلوك علبة النظام وإعدادات تسخين Paddle. قم بتمكين \"التشغيل في الخلفية\" لتقليل Whispra إلى علبة النظام بدلاً من إغلاقه تمامًا."
                    },
                    "screenBoxSelector": {
                        "title": "محدد صندوق الشاشة",
                        "message": "استخدم Alt+Y (اختصار افتراضي) لتفعيل محدد صندوق الشاشة. يتيح لك ذلك اختيار مناطق معينة من شاشتك للترجمة المستهدفة بدلاً من ترجمة الشاشة بالكامل."
                    },
                    "paddleWarmup": {
                        "title": "ميزة تسخين Paddle",
                        "message": "قم بتمكين \"تسخين Paddle عند بدء التشغيل\" لتحميل نماذج OCR مسبقًا عند بدء تشغيل التطبيق. يجعل هذا ترجمة الشاشة أسرع ولكنه يزيد من وقت بدء التشغيل. يمكنك العثور على هذا التبديل في علامة إعدادات الحساب."
                    },
                    "systemTray": {
                        "title": "تكامل علبة النظام",
                        "message": "عندما يتم تمكين \"التشغيل في الخلفية\"، فإن إغلاق النافذة الرئيسية سيقلل Whispra إلى علبة النظام بدلاً من الخروج. انقر على أيقونة العلبة لاستعادة النافذة، أو انقر بزر الماوس الأيمن للحصول على إجراءات سريعة."
                    },
                    "expandedOverlay": {
                        "title": "تراكب موسع",
                        "message": "اضغط على F11 (أو اختصارك المكون) لفتح التراكب الموسع - لوحة تحكم عائمة تبقى فوق التطبيقات الأخرى. مثالية للألعاب أو التطبيقات ذات الشاشة الكاملة! تتضمن جميع نفس الميزات المتاحة دون مغادرة تطبيقك الحالي."
                    },
                    "hotkeys": {
                        "title": "اختصارات أساسية",
                        "message": "تذكر هذه الاختصارات: F11 للتراكب الموسع، Alt+T لترجمة الشاشة، Alt+Y لمحدد صندوق الشاشة. يمكنك تخصيص جميع الاختصارات في الإعدادات → اختصارات المفاتيح."
                    },
                    "finish": {
                        "title": "أنت جاهز الآن!",
                        "message": "هذا كل شيء! أنت مستعد لبدء استخدام التطبيق. اضغط على F11 لتجربة التراكب الموسع، واستكشف جميع الميزات لتخصيص تجربتك."
                    },
                    "buttons": {
                        "skip": "تخطي",
                        "back": "رجوع",
                        "next": "التالي",
                        "closeTour": "إغلاق الجولة"
                    }
                },
                "quickTranslatePanel": {
                    "title": "ترجمة سريعة",
                    "description": "ترجم النص فوراً باستخدام خدمات الترجمة بالذكاء الاصطناعي",
                    "globalHotkey": "مفتاح الاختصار العام:",
                    "translateTo": "ترجم إلى",
                    "autoTranslate": "ترجمة تلقائية",
                    "translatesAsYouType": "يترجم أثناء الكتابة",
                    "clickTranslateOrPress": "انقر ترجمة أو اضغط Ctrl+Enter",
                    "textToTranslate": "النص للترجمة",
                    "translationResult": "نتيجة الترجمة",
                    "translate": "ترجمة",
                    "translating": "جاري الترجمة...",
                    "clear": "مسح",
                    "copyResult": "نسخ النتيجة",
                    "readyToTranslate": "جاهز للترجمة",
                    "typingDots": "جاري الكتابة...",
                    "translatingWord": "جاري ترجمة الكلمة...",
                    "translationCompleted": "اكتملت الترجمة",
                    "translationFailed": "فشلت الترجمة",
                    "copiedToClipboard": "تم نسخ الترجمة إلى الحافظة",
                    "pleaseEnterText": "الرجاء إدخال نص للترجمة",
                    "autoTranslateEnabled": "الترجمة التلقائية مفعلة",
                    "autoTranslateDisabled": "الترجمة التلقائية معطلة - انقر ترجمة",
                    "enterTextPlaceholder": "أدخل النص للترجمة...",
                    "translationPlaceholder": "ستظهر الترجمة هنا..."
                },
                "settingsModal": {
                    "title": "الإعدادات",
                    "runInBackground": "تشغيل في الخلفية",
                    "close": "إغلاق",
                    "tabs": {
                        "account": "الحساب",
                        "apiKeys": "مفاتيح API",
                        "models": "النماذج",
                        "cloudLocal": "سحابي/محلي",
                        "keybinds": "اختصارات لوحة المفاتيح",
                        "themes": "السمات",
                        "languageLibrary": "مكتبة اللغات"
                    },
                    "keybinds": {
                        "title": "اختصارات لوحة المفاتيح",
                        "description": "تكوين مفاتيح الاختصار العامة للميزات المختلفة. ثنائي الاتجاه وترجمة الشاشة يستخدمان {modifier} + مفتاح. انقر \"تغيير\" لتعيين مفتاح جديد.",
                        "ptt": "اضغط للتحدث",
                        "pttDesc": "اضغط مع الاستمرار على هذا المفتاح للتحدث (افتراضي: مسافة، بدون Alt)",
                        "bidirectional": "تبديل ثنائي الاتجاه",
                        "bidirectionalDesc": "اضغط {modifier} + هذا المفتاح لتبديل الوضع ثنائي الاتجاه (افتراضي: B)",
                        "screenTranslation": "ترجمة الشاشة",
                        "screenTranslationDesc": "اضغط {modifier} + هذا المفتاح لالتقاط الشاشة (افتراضي: T)",
                        "screenTranslationBox": "مربع ترجمة الشاشة",
                        "screenTranslationBoxDesc": "اضغط {modifier} + هذا المفتاح لتحديد منطقة المربع للترجمة (افتراضي: Y)",
                        "overlayToggle": "تبديل التراكب",
                        "overlayToggleDesc": "اضغط هذا المفتاح لتبديل التراكب (افتراضي: F11، بدون Alt)",
                        "quickTranslation": "ترجمة سريعة",
                        "quickTranslationLocked": "هذا الاختصار ثابت ولا يمكن تغييره",
                        "change": "تغيير",
                        "locked": "مقفل",
                        "tip": "اضغط للتحدث وتبديل التراكب لا يحتاجان {modifier}. ثنائي الاتجاه وترجمة الشاشة يتطلبان {modifier} + مفتاح. اضغط ESC للإلغاء.",
                        "changeTitle": "تغيير {label}",
                        "changeDescAlt": "اضغط أي مفتاح لتعيينه كـ {modifier} + [مفتاحك]. سيتم إضافة {modifier} تلقائياً. اضغط ESC للإلغاء.",
                        "changeDescNoAlt": "اضغط أي مفتاح (يُنصح بمفاتيح الوظائف). لا حاجة للمعدلات. اضغط ESC للإلغاء.",
                        "waitingForInput": "في انتظار الإدخال..."
                    },
                    "themes": {
                        "title": "اختيار السمة",
                        "description": "اختر سمة الواجهة المفضلة لديك. التغييرات تُطبق فوراً.",
                        "active": "نشط",
                        "select": "اختيار"
                    },
                    "account": {
                        "title": "الحساب",
                        "profile": "الملف الشخصي",
                        "subscription": "الاشتراك",
                        "usage": "الاستخدام",
                        "preferences": "التفضيلات",
                        "email": "البريد الإلكتروني",
                        "plan": "الخطة",
                        "trialDays": "أيام التجربة المتبقية",
                        "status": "الحالة",
                        "spokenLanguage": "اللغة التي تتحدثها",
                        "rememberResponses": "حفظ استجابات API",
                        "rememberResponsesDesc": "تخزين استجابات API لتتبع الاستخدام وتصحيح الأخطاء. تعطيل لخصوصية محسنة.",
                        "usageUsed": "المستخدم هذا الشهر",
                        "usageRemaining": "متبقي",
                        "usageLoading": "جاري تحميل بيانات الاستخدام...",
                        "usageError": "تعذر تحميل بيانات الاستخدام",
                        "usageWarningHigh": "⚠️ استخدام عالي هذا الشهر",
                        "usageWarningLimit": "⚠️ الاقتراب من حد الاستخدام",
                        "openDashboard": "إدارة الاشتراك",
                        "signOut": "تسجيل الخروج",
                        "opening": "جاري الفتح...",
                        "error": "فشل فتح لوحة الحساب. يرجى زيارة account.whispra.xyz يدوياً.",
                        "loading": "جاري تحميل معلومات الحساب...",
                        "trial": "تجربة مجانية لمدة 7 أيام",
                        "active": "اشتراك نشط",
                        "expired": "منتهي الصلاحية"
                    }
                }
            },'ko': {
                "tab": {
                    "translation": "번역",
                    "bidirectional": "양방향",
                    "soundboard": "사운드 보드",
                    "settings": "설정"
                },
                "sidebar": {
                    "translate": "번역",
                    "bidirectional": "양방향",
                    "screenTranslation": "화면 번역",
                    "soundBoard": "사운드 보드",
                    "voiceFilter": "음성 필터",
                    "settings": "설정",
                    "logs": "로그",
                    "menu": "메뉴",
                    "whispraTranslate": "Whispra 번역",
                    "screenTranslate": "화면 번역",
                    "quickTranslate": "빠른 번역",
                    "help": "도움말"
                },
                "soundboard": {
                    "panel": {
                        "title": "사운드 보드",
                        "description": "대화 중 사용자 지정 사운드 및 오디오 클립 재생"
                    },
                    "controls": {
                        "outputDevice": "출력 장치",
                        "vbAudioVolume": "VB 오디오 볼륨",
                        "headphonesVolume": "헤드폰 볼륨",
                        "soundPadGrid": "사운드 패드 그리드",
                        "enableHotkeys": "사운드 보드 단축키 활성화",
                        "addSoundFiles": "사운드 파일 추가",
                        "webOverlay": "웹 오버레이",
                        "stopAllSounds": "모든 소리 중지"
                    },
                    "placeholders": {
                        "selectOutputDevice": "출력 장치 선택...",
                        "defaultSystemOutput": "기본 시스템 출력",
                        "virtualAudioCable": "가상 오디오 케이블"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "양방향 모드"
                    },
                    "controls": {
                        "startBidirectional": "양방향 시작",
                        "stopBidirectional": "양방향 중지",
                        "keybind": "번역할 언어",
                        "toggleWith": "전환",
                        "changeKey": "키 변경",
                        "outputDevice": "출력 장치",
                        "systemInput": "시스템 입력",
                        "incomingVoice": "들어오는 음성",
                        "sourceLanguage": "원본 언어",
                        "appSelection": "앱 선택"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "출력 장치 로딩 중...",
                        "loadingVoices": "음성 로딩 중...",
                        "displaySystemAudio": "디스플레이/시스템 오디오 (기본)"
                    },
                    "status": {
                        "idle": "대기 중",
                        "waiting": "대기 중...",
                        "ready": "준비 완료...",
                        "starting": "시작 중...",
                        "stopping": "중지 중..."
                    },
                    "labels": {
                        "detectedTarget": "감지된 (원본 언어)",
                        "respoken": "재진술된 (번역할 언어)"
                    }
                },
                "header": {
                    "signOut": "로그아웃"
                },
                "footer": {
                    "becomeAffiliate": "제휴 파트너 되기",
                    "reportBug": "버그 신고 / 기능 제안"
                },
                "settings": {
                    "modal": {
                        "title": "보안 API 구성",
                        "close": "닫기"
                    },
                    "instructions": {
                        "title": "API 키 설정 지침",
                        "openaiTitle": "OpenAI API 키",
                        "openaiPermissions": "읽기 권한: 모델, 기능",
                        "openaiUsage": "음성-텍스트 및 텍스트-음성 번역에 사용됨",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API 키",
                        "elevenlabsRestrict": "키 제한: 활성화됨",
                        "elevenlabsNoAccess": "기타 모든 것: 접근 불가",
                        "elevenlabsTts": "텍스트 음성 변환: 접근",
                        "elevenlabsSts": "음성 음성 변환: 접근",
                        "elevenlabsAgents": "ElevenLabs 에이전트: 쓰기",
                        "elevenlabsVoices": "음성: 쓰기",
                        "elevenlabsVoiceGen": "음성 생성: 접근",
                        "elevenlabsUser": "사용자: 읽기",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API 키:",
                        "openaiPlaceholder": "OpenAI API 키를 입력하세요",
                        "openaiStored": "키가 안전하게 저장됨",
                        "openaiHelp": "OpenAI API 키를 입력하세요 (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API 키:",
                        "elevenlabsPlaceholder": "ElevenLabs API 키를 입력하세요",
                        "elevenlabsStored": "키가 안전하게 저장됨",
                        "elevenlabsHelp": "ElevenLabs API 키를 입력하세요 (32자)"
                    },
                    "buttons": {
                        "showKey": "키 표시",
                        "removeKey": "키 제거",
                        "clearAll": "모든 키 지우기",
                        "cancel": "취소",
                        "save": "저장"
                    },
                    "status": {
                        "keyStored": "✓ 키가 안전하게 저장됨"
                    },
                    "links": {
                        "openai": "키 생성: platform.openai.com/api-keys",
                        "elevenlabs": "키 생성: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "마이크",
                    "targetLanguage": "번역할 언어",
                    "voice": "음성",
                    "output": "출력",
                    "pushToTalk": "푸시 투 토크",
                    "startTranslation": "번역 시작",
                    "stopTranslation": "번역 중지",
                    "addCustomVoice": "사용자 지정 음성 추가",
                    "accent": "억양",
                    "noAccent": "억양 없음",
                    "accentOn": "억양: 켬",
                    "accentOff": "억양: 끔"
                },
                "placeholders": {
                    "selectMicrophone": "마이크 선택...",
                    "loadingVoices": "음성 로딩 중...",
                    "selectVoice": "음성 선택...",
                    "enterCustomAccent": "사용자 지정 억양 입력...",
                    "selectPreset": "프리셋 선택..."
                },
                "keys": {
                    "space": "스페이스",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Whispra에 오신 것을 환영합니다!",
                        "message": "앱에 오신 것을 환영합니다! 주요 인터페이스를 빠르게 안내해 드리겠습니다."
                    },
                    "sidebar": {
                        "title": "왼쪽 사이드바 내비게이션",
                        "message": "이곳은 주요 내비게이션 바입니다. Whispra Translate, 화면 번역, 빠른 번역 등 다양한 기능 간에 전환하는 데 사용하세요."
                    },
                    "translateTab": {
                        "title": "번역 탭",
                        "message": "번역 탭은 실시간 번역을 위한 주요 작업 공간입니다. 말을 시작하면 즉시 번역되는 것을 확인할 수 있습니다."
                    },
                    "bidirectionalTab": {
                        "title": "양방향 모드",
                        "message": "양방향 모드는 대화를 자동으로 양쪽 방향으로 번역합니다. 자연스러운 대화에 완벽합니다."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate 탭",
                        "message": "Whispra Translate 탭은 실시간 번역과 양방향 모드를 하나의 통합 인터페이스로 결합합니다. 단방향 번역에는 왼쪽 패널을, 양방향 대화에는 오른쪽 패널을 사용하세요. 말을 시작하면 즉시 번역되는 것을 확인할 수 있습니다."
                    },
                    "screenTranslationTab": {
                        "title": "화면 번역",
                        "message": "화면 번역은 화면의 텍스트를 캡처하고 실시간으로 번역합니다. 게임, 비디오 또는 애플리케이션의 콘텐츠를 번역하는 데 유용합니다."
                    },
                    "quickTranslateTab": {
                        "title": "빠른 번역",
                        "message": "빠른 번역은 키보드 단축키로 즉시 번역을 제공합니다. Alt+C를 눌러 선택한 텍스트를 빠르게 번역하세요."
                    },
                    "soundBoardTab": {
                        "title": "사운드 보드",
                        "message": "사운드 보드를 사용하면 오디오 클립을 즉시 재생할 수 있습니다. 대화 중 빠른 응답이나 음향 효과에 적합합니다."
                    },
                    "profile": {
                        "title": "프로필 섹션",
                        "message": "여기에서 프로필 설정, 계정 정보에 접근하고 로그아웃할 수 있습니다."
                    },
                    "settings": {
                        "title": "설정 메뉴",
                        "message": "사이드바의 설정 버튼을 클릭하여 모든 애플리케이션 설정에 접근하세요. 다음에 내부 내용을 보여드리겠습니다."
                    },
                    "apiKeys": {
                        "title": "API 키 구성",
                        "message": "여기에서 API 키를 구성하세요. OpenAI(Whisper), 번역 서비스 및 ElevenLabs 음성 합성을 위한 키가 필요합니다."
                    },
                    "keybinds": {
                        "title": "키보드 단축키",
                        "message": "여기에서 빠른 작업을 위한 키보드 단축키를 구성할 수 있습니다. 작업 흐름에 맞게 단축키를 사용자 지정하세요."
                    },
                    "models": {
                        "title": "모델 및 처리",
                        "message": "여기에서 AI 모델을 선택하고 처리 옵션을 조정할 수 있습니다. 클라우드 및 로컬 처리 중에서 선택하고 모델 매개변수를 미세 조정하세요."
                    },
                    "accountSettings": {
                        "title": "계정 및 백그라운드 설정",
                        "message": "계정 탭에서 시스템 트레이 동작 및 패들 워밍업 설정을 구성할 수 있습니다. \"백그라운드에서 실행\"을 활성화하면 Whispra를 완전히 종료하지 않고 시스템 트레이로 최소화합니다."
                    },
                    "screenBoxSelector": {
                        "title": "화면 박스 선택기",
                        "message": "Alt+Y(기본 단축키)를 사용하여 화면 박스 선택기를 활성화하세요. 이를 통해 전체 화면을 번역하는 대신 특정 화면 영역을 선택하여 번역할 수 있습니다."
                    },
                    "paddleWarmup": {
                        "title": "패들 워밍업 기능",
                        "message": "\"시작 시 패들 워밍업\"을 활성화하여 앱 시작 시 OCR 모델을 미리 로드하세요. 이렇게 하면 화면 번역이 더 빨라지지만 시작 시간이 늘어납니다. 이 토글은 계정 설정 탭에서 찾을 수 있습니다."
                    },
                    "systemTray": {
                        "title": "시스템 트레이 통합",
                        "message": "\"백그라운드에서 실행\"이 활성화되면 기본 창을 닫으면 Whispra가 종료되지 않고 시스템 트레이로 최소화됩니다. 트레이 아이콘을 클릭하여 창을 복원하거나 마우스 오른쪽 버튼을 클릭하여 빠른 작업을 수행하세요."
                    },
                    "expandedOverlay": {
                        "title": "확장 오버레이",
                        "message": "F11(또는 구성된 단축키)을 눌러 확장 오버레이를 열어보세요. 이는 다른 애플리케이션 위에 떠 있는 제어 패널입니다. 게임이나 전체 화면 앱에 적합합니다! 현재 애플리케이션을 떠나지 않고도 접근할 수 있는 모든 동일한 기능이 포함되어 있습니다."
                    },
                    "hotkeys": {
                        "title": "필수 단축키",
                        "message": "다음 단축키를 기억하세요: F11은 확장 오버레이, Alt+T는 화면 번역, Alt+Y는 화면 박스 선택기입니다. 모든 단축키는 설정 → 단축키에서 사용자 지정할 수 있습니다."
                    },
                    "finish": {
                        "title": "모든 준비가 완료되었습니다!",
                        "message": "그게 전부입니다! 앱을 사용할 준비가 되었습니다. F11을 눌러 확장 오버레이를 시도하고 모든 기능을 탐색하여 경험을 사용자 지정하세요."
                    },
                    "buttons": {
                        "skip": "건너뛰기",
                        "back": "뒤로",
                        "next": "다음",
                        "closeTour": "투어 닫기"
                    }
                },
                "quickTranslatePanel": {
                    "title": "빠른 번역",
                    "description": "AI 번역 서비스를 사용하여 텍스트를 즉시 번역",
                    "globalHotkey": "전역 단축키:",
                    "translateTo": "번역 대상",
                    "autoTranslate": "자동 번역",
                    "translatesAsYouType": "입력하면서 번역",
                    "clickTranslateOrPress": "번역 클릭 또는 Ctrl+Enter 누르기",
                    "textToTranslate": "번역할 텍스트",
                    "translationResult": "번역 결과",
                    "translate": "번역",
                    "translating": "번역 중...",
                    "clear": "지우기",
                    "copyResult": "결과 복사",
                    "readyToTranslate": "번역 준비 완료",
                    "typingDots": "입력 중...",
                    "translatingWord": "단어 번역 중...",
                    "translationCompleted": "번역 완료",
                    "translationFailed": "번역 실패",
                    "copiedToClipboard": "번역이 클립보드에 복사됨",
                    "pleaseEnterText": "번역할 텍스트를 입력하세요",
                    "autoTranslateEnabled": "자동 번역 활성화됨",
                    "autoTranslateDisabled": "자동 번역 비활성화됨 - 번역 클릭",
                    "enterTextPlaceholder": "번역할 텍스트 입력...",
                    "translationPlaceholder": "번역 결과가 여기에 표시됩니다..."
                },
                "settingsModal": {
                    "title": "설정",
                    "runInBackground": "백그라운드에서 실행",
                    "close": "닫기",
                    "tabs": {
                        "account": "계정",
                        "apiKeys": "API 키",
                        "models": "모델",
                        "cloudLocal": "클라우드/로컬",
                        "keybinds": "단축키",
                        "themes": "테마",
                        "languageLibrary": "언어 라이브러리"
                    },
                    "keybinds": {
                        "title": "단축키",
                        "description": "다양한 기능에 대한 전역 단축키를 구성합니다. 양방향 및 화면 번역은 {modifier} + 키를 사용합니다. 새 키를 설정하려면 \"변경\"을 클릭하세요.",
                        "ptt": "눌러서 말하기",
                        "pttDesc": "말하려면 이 키를 누르고 있으세요 (기본값: 스페이스, Alt 불필요)",
                        "bidirectional": "양방향 전환",
                        "bidirectionalDesc": "양방향 모드를 전환하려면 {modifier} + 이 키를 누르세요 (기본값: B)",
                        "screenTranslation": "화면 번역",
                        "screenTranslationDesc": "화면을 캡처하려면 {modifier} + 이 키를 누르세요 (기본값: T)",
                        "screenTranslationBox": "화면 번역 박스",
                        "screenTranslationBoxDesc": "번역할 박스 영역을 선택하려면 {modifier} + 이 키를 누르세요 (기본값: Y)",
                        "overlayToggle": "오버레이 전환",
                        "overlayToggleDesc": "오버레이를 전환하려면 이 키를 누르세요 (기본값: F11, Alt 불필요)",
                        "quickTranslation": "빠른 번역",
                        "quickTranslationLocked": "이 단축키는 고정되어 있으며 변경할 수 없습니다",
                        "change": "변경",
                        "locked": "잠김",
                        "tip": "눌러서 말하기와 오버레이 전환은 {modifier}가 필요 없습니다. 양방향 및 화면 번역은 {modifier} + 키가 필요합니다. 취소하려면 ESC를 누르세요.",
                        "changeTitle": "{label} 변경",
                        "changeDescAlt": "{modifier} + [사용자 키]로 설정하려면 아무 키나 누르세요. {modifier}가 자동으로 추가됩니다. 취소하려면 ESC를 누르세요.",
                        "changeDescNoAlt": "아무 키나 누르세요 (기능 키 권장). 수정자가 필요 없습니다. 취소하려면 ESC를 누르세요.",
                        "waitingForInput": "입력 대기 중..."
                    },
                    "themes": {
                        "title": "테마 선택",
                        "description": "선호하는 인터페이스 테마를 선택하세요. 변경 사항이 즉시 적용됩니다.",
                        "active": "활성",
                        "select": "선택"
                    },
                    "account": {
                        "title": "계정",
                        "profile": "프로필",
                        "subscription": "구독",
                        "usage": "사용량",
                        "preferences": "환경설정",
                        "email": "이메일",
                        "plan": "플랜",
                        "trialDays": "남은 체험 일수",
                        "status": "상태",
                        "spokenLanguage": "사용하는 언어",
                        "rememberResponses": "API 응답 저장",
                        "rememberResponsesDesc": "사용량 추적 및 디버깅을 위해 API 응답을 저장합니다. 개인정보 보호를 위해 비활성화하세요.",
                        "usageUsed": "이번 달 사용량",
                        "usageRemaining": "남음",
                        "usageLoading": "사용량 데이터 로딩 중...",
                        "usageError": "사용량 데이터를 로드할 수 없습니다",
                        "usageWarningHigh": "⚠️ 이번 달 사용량이 높습니다",
                        "usageWarningLimit": "⚠️ 사용 한도에 근접 중",
                        "openDashboard": "구독 관리",
                        "signOut": "로그아웃",
                        "opening": "열는 중...",
                        "error": "계정 대시보드를 열 수 없습니다. account.whispra.xyz를 직접 방문해 주세요.",
                        "loading": "계정 정보 로딩 중...",
                        "trial": "7일 무료 체험",
                        "active": "활성 구독",
                        "expired": "만료됨"
                    }
                }
            },'pt': {
                "tab": {
                    "translation": "Tradução",
                    "bidirectional": "Bidirecional",
                    "soundboard": "Soundboard",
                    "settings": "Configurações"
                },
                "sidebar": {
                    "translate": "Traduzir",
                    "bidirectional": "Bidirecional",
                    "screenTranslation": "Tradução de Tela",
                    "soundBoard": "Painel de Som",
                    "voiceFilter": "Filtro de Voz",
                    "settings": "Configurações",
                    "logs": "Registros",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Traduzir",
                    "screenTranslate": "Traduzir Tela",
                    "quickTranslate": "Tradução Rápida",
                    "help": "Ajuda"
                },
                "soundboard": {
                    "panel": {
                        "title": "Painel de Som",
                        "description": "Toque sons e clipes de áudio personalizados durante as conversas"
                    },
                    "controls": {
                        "outputDevice": "Dispositivo de Saída",
                        "vbAudioVolume": "Volume do VB Audio",
                        "headphonesVolume": "Volume dos Fones de Ouvido",
                        "soundPadGrid": "Grade do Painel de Som",
                        "enableHotkeys": "Ativar Teclas de Atalho do Soundboard",
                        "addSoundFiles": "Adicionar Arquivos de Som",
                        "webOverlay": "Sobreposição da Web",
                        "stopAllSounds": "Parar Todos os Sons"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Selecione o dispositivo de saída...",
                        "defaultSystemOutput": "Saída do Sistema Padrão",
                        "virtualAudioCable": "Cabo de Áudio Virtual"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Modo Bidirecional"
                    },
                    "controls": {
                        "startBidirectional": "Iniciar Bidirecional",
                        "stopBidirectional": "Parar Bidirecional",
                        "keybind": "Traduzir para",
                        "toggleWith": "Alternar com",
                        "changeKey": "Alterar Tecla",
                        "outputDevice": "Dispositivo de Saída",
                        "systemInput": "Entrada do Sistema",
                        "incomingVoice": "Voz de Entrada",
                        "sourceLanguage": "Idioma de Origem",
                        "appSelection": "Seleção de Aplicativo"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Carregando dispositivos de saída...",
                        "loadingVoices": "Carregando vozes...",
                        "displaySystemAudio": "Exibir/Som do Sistema (Padrão)"
                    },
                    "status": {
                        "idle": "Ocioso",
                        "waiting": "Aguardando...",
                        "ready": "Pronto...",
                        "starting": "Iniciando...",
                        "stopping": "Parando..."
                    },
                    "labels": {
                        "detectedTarget": "Detectado (Idioma de Origem)",
                        "respoken": "Re-falado (Traduzir Para)"
                    }
                },
                "header": {
                    "signOut": "Sair"
                },
                "footer": {
                    "becomeAffiliate": "Torne-se um Afiliado",
                    "reportBug": "Reportar Bug / Sugerir Recurso"
                },
                "settings": {
                    "modal": {
                        "title": "Configuração de API Segura",
                        "close": "Fechar"
                    },
                    "instructions": {
                        "title": "Instruções de Configuração da Chave da API",
                        "openaiTitle": "Chave da API OpenAI",
                        "openaiPermissions": "Permissões de leitura: Modelos, Capacidades",
                        "openaiUsage": "Usado para tradução de fala para texto e texto para fala",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Chave da API ElevenLabs",
                        "elevenlabsRestrict": "Restringir chave: Habilitado",
                        "elevenlabsNoAccess": "Tudo o mais: Sem acesso",
                        "elevenlabsTts": "Texto para fala: Acesso",
                        "elevenlabsSts": "Fala para fala: Acesso",
                        "elevenlabsAgents": "Agentes ElevenLabs: Escrita",
                        "elevenlabsVoices": "Vozes: Escrita",
                        "elevenlabsVoiceGen": "Geração de voz: Acesso",
                        "elevenlabsUser": "Usuário: Leitura",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Chave da API OpenAI:",
                        "openaiPlaceholder": "Insira sua chave da API OpenAI",
                        "openaiStored": "Chave armazenada com segurança",
                        "openaiHelp": "Insira sua chave da API OpenAI (sk-...)",
                        "elevenlabsLabel": "Chave da API ElevenLabs:",
                        "elevenlabsPlaceholder": "Insira sua chave da API ElevenLabs",
                        "elevenlabsStored": "Chave armazenada com segurança",
                        "elevenlabsHelp": "Insira sua chave da API ElevenLabs (32 caracteres)"
                    },
                    "buttons": {
                        "showKey": "Mostrar Chave",
                        "removeKey": "Remover Chave",
                        "clearAll": "Limpar Todas as Chaves",
                        "cancel": "Cancelar",
                        "save": "Salvar"
                    },
                    "status": {
                        "keyStored": "✓ Chave armazenada com segurança"
                    },
                    "links": {
                        "openai": "Gerar chave em: platform.openai.com/api-keys",
                        "elevenlabs": "Gerar chave em: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Microfone",
                    "targetLanguage": "Traduzir Para",
                    "voice": "Voz",
                    "output": "Saída",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Iniciar Tradução",
                    "stopTranslation": "Parar Tradução",
                    "addCustomVoice": "Adicionar Voz Personalizada",
                    "accent": "Sotaque",
                    "noAccent": "Sem Sotaque",
                    "accentOn": "Sotaque: ATIVADO",
                    "accentOff": "Sotaque: DESATIVADO"
                },
                "placeholders": {
                    "selectMicrophone": "Selecione o microfone...",
                    "loadingVoices": "Carregando vozes...",
                    "selectVoice": "Selecione a voz...",
                    "enterCustomAccent": "Insira sotaque personalizado...",
                    "selectPreset": "Selecione predefinição..."
                },
                "keys": {
                    "space": "ESPAÇO",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Shift"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Bem-vindo ao Whispra!",
                        "message": "Bem-vindo ao aplicativo! Vamos passar rapidamente pela interface principal."
                    },
                    "sidebar": {
                        "title": "Navegação da Barra Lateral Esquerda",
                        "message": "Esta é a sua barra de navegação principal. Use-a para alternar entre diferentes recursos como Whispra Translate, Tradução de Tela, Tradução Rápida e mais."
                    },
                    "translateTab": {
                        "title": "Aba Traduzir",
                        "message": "A aba Traduzir é seu espaço de trabalho principal para tradução em tempo real. Comece a falar e veja suas palavras serem traduzidas instantaneamente."
                    },
                    "bidirectionalTab": {
                        "title": "Modo Bidirecional",
                        "message": "O modo bidirecional traduz conversas em ambas as direções automaticamente. Perfeito para diálogos naturais."
                    },
                    "whispraTranslateTab": {
                        "title": "Aba Whispra Translate",
                        "message": "A aba Whispra Translate combina tradução em tempo real e modo bidirecional em uma interface unificada. Use o painel esquerdo para tradução unidirecional e o painel direito para conversas bidirecionais. Comece a falar e veja suas palavras serem traduzidas instantaneamente."
                    },
                    "screenTranslationTab": {
                        "title": "Tradução de Tela",
                        "message": "A Tradução de Tela captura texto da sua tela e o traduz em tempo real. Ótimo para traduzir conteúdo de jogos, vídeos ou aplicativos."
                    },
                    "quickTranslateTab": {
                        "title": "Tradução Rápida",
                        "message": "A Tradução Rápida oferece tradução instantânea com um atalho de teclado. Pressione Alt+C para traduzir rapidamente o texto selecionado."
                    },
                    "soundBoardTab": {
                        "title": "Painel de Som",
                        "message": "O Painel de Som permite tocar clipes de áudio instantaneamente. Perfeito para respostas rápidas ou efeitos sonoros durante as conversas."
                    },
                    "profile": {
                        "title": "Seção de Perfil",
                        "message": "Acesse suas configurações de perfil, informações da conta e saia daqui."
                    },
                    "settings": {
                        "title": "Menu de Configurações",
                        "message": "Clique no botão de configurações na barra lateral para acessar todas as configurações do aplicativo. Vamos mostrar o que há dentro a seguir."
                    },
                    "apiKeys": {
                        "title": "Configuração de Chaves da API",
                        "message": "Configure suas chaves da API aqui. Você precisará de chaves para OpenAI (Whisper), serviços de tradução e ElevenLabs para síntese de voz."
                    },
                    "keybinds": {
                        "title": "Atalhos de Teclado",
                        "message": "Aqui é onde você pode configurar atalhos de teclado para ações rápidas. Personalize suas teclas de atalho para se adequar ao seu fluxo de trabalho."
                    },
                    "models": {
                        "title": "Modelos & Processamento",
                        "message": "Aqui você pode selecionar modelos de IA e ajustar opções de processamento. Escolha entre processamento em nuvem e local, e ajuste os parâmetros do modelo."
                    },
                    "accountSettings": {
                        "title": "Configurações de Conta & Fundo",
                        "message": "Na aba Conta, você pode configurar o comportamento da bandeja do sistema e as configurações de aquecimento do Paddle. Ative \"Executar em Segundo Plano\" para minimizar o Whispra na bandeja do sistema em vez de fechá-lo completamente."
                    },
                    "screenBoxSelector": {
                        "title": "Selecionador de Caixa de Tela",
                        "message": "Use Alt+Y (atalho padrão) para ativar o selecionador de caixa de tela. Isso permite que você selecione áreas específicas da sua tela para tradução direcionada em vez de traduzir a tela inteira."
                    },
                    "paddleWarmup": {
                        "title": "Recurso de Aquecimento do Paddle",
                        "message": "Ative \"Aquecimento do Paddle na Inicialização\" para pré-carregar modelos de OCR quando o aplicativo iniciar. Isso torna a tradução de tela mais rápida, mas aumenta o tempo de inicialização. Você pode encontrar essa opção na aba de configurações da Conta."
                    },
                    "systemTray": {
                        "title": "Integração com a Bandeja do Sistema",
                        "message": "Quando \"Executar em Segundo Plano\" está ativado, fechar a janela principal minimizará o Whispra na bandeja do sistema em vez de sair. Clique no ícone da bandeja para restaurar a janela, ou clique com o botão direito para ações rápidas."
                    },
                    "expandedOverlay": {
                        "title": "Sobreposição Expandida",
                        "message": "Pressione F11 (ou seu atalho configurado) para abrir a Sobreposição Expandida - um painel de controle flutuante que permanece acima de outros aplicativos. Perfeito para jogos ou aplicativos em tela cheia! Inclui todos os mesmos recursos acessíveis sem sair do seu aplicativo atual."
                    },
                    "hotkeys": {
                        "title": "Atalhos Essenciais",
                        "message": "Lembre-se destes atalhos: F11 para Sobreposição Expandida, Alt+T para Tradução de Tela, Alt+Y para Selecionador de Caixa de Tela. Você pode personalizar todos os atalhos em Configurações → Teclas de Atalho."
                    },
                    "finish": {
                        "title": "Você Está Pronto!",
                        "message": "É isso! Você está pronto para começar a usar o aplicativo. Pressione F11 para experimentar a Sobreposição Expandida e explore todos os recursos para personalizar sua experiência."
                    },
                    "buttons": {
                        "skip": "Pular",
                        "back": "Voltar",
                        "next": "Próximo",
                        "closeTour": "Fechar Tour"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Tradução Rápida",
                    "description": "Traduza texto instantaneamente usando serviços de tradução com IA",
                    "globalHotkey": "Tecla de Atalho Global:",
                    "translateTo": "Traduzir Para",
                    "autoTranslate": "Auto-Traduzir",
                    "translatesAsYouType": "Traduz enquanto você digita",
                    "clickTranslateOrPress": "Clique em Traduzir ou pressione Ctrl+Enter",
                    "textToTranslate": "Texto para Traduzir",
                    "translationResult": "Resultado da Tradução",
                    "translate": "Traduzir",
                    "translating": "Traduzindo...",
                    "clear": "Limpar",
                    "copyResult": "Copiar Resultado",
                    "readyToTranslate": "Pronto para traduzir",
                    "typingDots": "Digitando...",
                    "translatingWord": "Traduzindo palavra...",
                    "translationCompleted": "Tradução concluída",
                    "translationFailed": "Tradução falhou",
                    "copiedToClipboard": "Tradução copiada para a área de transferência",
                    "pleaseEnterText": "Por favor, insira texto para traduzir",
                    "autoTranslateEnabled": "Auto-tradução ativada",
                    "autoTranslateDisabled": "Auto-tradução desativada - Clique em Traduzir",
                    "enterTextPlaceholder": "Digite texto para traduzir...",
                    "translationPlaceholder": "A tradução aparecerá aqui..."
                },
                "settingsModal": {
                    "title": "Configurações",
                    "runInBackground": "Executar em segundo plano",
                    "close": "Fechar",
                    "tabs": {
                        "account": "Conta",
                        "apiKeys": "Chaves API",
                        "models": "Modelos",
                        "cloudLocal": "Nuvem/Local",
                        "keybinds": "Atalhos",
                        "themes": "Temas",
                        "languageLibrary": "Biblioteca de Idiomas"
                    },
                    "keybinds": {
                        "title": "Atalhos de Teclado",
                        "description": "Configure atalhos globais para várias funcionalidades. Bidirecional e tradução de tela usam {modifier} + tecla. Clique \"Alterar\" para definir uma nova tecla.",
                        "ptt": "Pressione para Falar",
                        "pttDesc": "Segure esta tecla para falar (padrão: Espaço, sem Alt)",
                        "bidirectional": "Alternar Bidirecional",
                        "bidirectionalDesc": "Pressione {modifier} + esta tecla para alternar modo bidirecional (padrão: B)",
                        "screenTranslation": "Tradução de Tela",
                        "screenTranslationDesc": "Pressione {modifier} + esta tecla para capturar tela (padrão: T)",
                        "screenTranslationBox": "Caixa de Tradução de Tela",
                        "screenTranslationBoxDesc": "Pressione {modifier} + esta tecla para selecionar área de caixa para tradução (padrão: Y)",
                        "overlayToggle": "Alternar Sobreposição",
                        "overlayToggleDesc": "Pressione esta tecla para alternar sobreposição (padrão: F11, sem Alt)",
                        "quickTranslation": "Tradução Rápida",
                        "quickTranslationLocked": "Este atalho é fixo e não pode ser alterado",
                        "change": "Alterar",
                        "locked": "Bloqueado",
                        "tip": "Pressione para falar e alternar sobreposição não precisam de {modifier}. Bidirecional e tradução de tela requerem {modifier} + tecla. Pressione ESC para cancelar.",
                        "changeTitle": "Alterar {label}",
                        "changeDescAlt": "Pressione qualquer tecla para definir como {modifier} + [sua tecla]. {modifier} será adicionado automaticamente. Pressione ESC para cancelar.",
                        "changeDescNoAlt": "Pressione qualquer tecla (teclas de função recomendadas). Modificadores não necessários. Pressione ESC para cancelar.",
                        "waitingForInput": "Aguardando entrada..."
                    },
                    "themes": {
                        "title": "Seleção de Tema",
                        "description": "Escolha seu tema de interface preferido. As alterações são aplicadas imediatamente.",
                        "active": "Ativo",
                        "select": "Selecionar"
                    },
                    "account": {
                        "title": "Conta",
                        "profile": "Perfil",
                        "subscription": "Assinatura",
                        "usage": "Uso",
                        "preferences": "Preferências",
                        "email": "E-mail",
                        "plan": "Plano",
                        "trialDays": "Dias de Teste Restantes",
                        "status": "Status",
                        "spokenLanguage": "Idioma que Você Fala",
                        "rememberResponses": "Salvar Respostas da API",
                        "rememberResponsesDesc": "Armazenar respostas da API para rastreamento de uso e depuração. Desative para maior privacidade.",
                        "usageUsed": "Usado este mês",
                        "usageRemaining": "restante",
                        "usageLoading": "Carregando dados de uso...",
                        "usageError": "Não foi possível carregar dados de uso",
                        "usageWarningHigh": "⚠️ Alto uso este mês",
                        "usageWarningLimit": "⚠️ Aproximando-se do limite de uso",
                        "openDashboard": "Gerenciar Assinatura",
                        "signOut": "Sair",
                        "opening": "Abrindo...",
                        "error": "Falha ao abrir painel da conta. Por favor, visite account.whispra.xyz manualmente.",
                        "loading": "Carregando informações da conta...",
                        "trial": "Teste Gratuito de 7 Dias",
                        "active": "Assinatura Ativa",
                        "expired": "Expirado"
                    }
                }
            },'it': {
                "tab": {
                    "translation": "Traduzione",
                    "bidirectional": "Bidirezionale",
                    "soundboard": "Tavolo dei suoni",
                    "settings": "Impostazioni"
                },
                "sidebar": {
                    "translate": "Traduci",
                    "bidirectional": "Bidirezionale",
                    "screenTranslation": "Traduzione dello schermo",
                    "soundBoard": "Tavolo dei suoni",
                    "voiceFilter": "Filtro vocale",
                    "settings": "Impostazioni",
                    "logs": "Log",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Traduci",
                    "screenTranslate": "Traduci Schermo",
                    "quickTranslate": "Traduzione Rapida",
                    "help": "Aiuto"
                },
                "soundboard": {
                    "panel": {
                        "title": "Tavolo dei suoni",
                        "description": "Riproduci suoni personalizzati e clip audio durante le conversazioni"
                    },
                    "controls": {
                        "outputDevice": "Dispositivo di uscita",
                        "vbAudioVolume": "Volume VB Audio",
                        "headphonesVolume": "Volume cuffie",
                        "soundPadGrid": "Griglia del pad sonoro",
                        "enableHotkeys": "Abilita tasti di scelta rapida del tavolo dei suoni",
                        "addSoundFiles": "Aggiungi file audio",
                        "webOverlay": "Sovrapposizione web",
                        "stopAllSounds": "Ferma tutti i suoni"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Seleziona dispositivo di uscita...",
                        "defaultSystemOutput": "Uscita di sistema predefinita",
                        "virtualAudioCable": "Cavo audio virtuale"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Modalità Bidirezionale"
                    },
                    "controls": {
                        "startBidirectional": "Avvia Bidirezionale",
                        "stopBidirectional": "Ferma Bidirezionale",
                        "keybind": "Traduci in",
                        "toggleWith": "Attiva con",
                        "changeKey": "Cambia tasto",
                        "outputDevice": "Dispositivo di uscita",
                        "systemInput": "Input di sistema",
                        "incomingVoice": "Voce in arrivo",
                        "sourceLanguage": "Lingua di origine",
                        "appSelection": "Selezione app"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Caricamento dispositivi di uscita...",
                        "loadingVoices": "Caricamento voci...",
                        "displaySystemAudio": "Audio di sistema/Visualizza (Predefinito)"
                    },
                    "status": {
                        "idle": "Inattivo",
                        "waiting": "In attesa...",
                        "ready": "Pronto...",
                        "starting": "Avviando...",
                        "stopping": "Arrestando..."
                    },
                    "labels": {
                        "detectedTarget": "Rilevato (Lingua di origine)",
                        "respoken": "Ripetuto (Traduci in)"
                    }
                },
                "header": {
                    "signOut": "Disconnetti"
                },
                "footer": {
                    "becomeAffiliate": "Diventa un Affiliato",
                    "reportBug": "Segnala Bug / Suggerisci Funzione"
                },
                "settings": {
                    "modal": {
                        "title": "Configurazione API Sicura",
                        "close": "Chiudi"
                    },
                    "instructions": {
                        "title": "Istruzioni per la Configurazione della Chiave API",
                        "openaiTitle": "Chiave API OpenAI",
                        "openaiPermissions": "Permessi di lettura: Modelli, Capacità",
                        "openaiUsage": "Utilizzato per la traduzione da voce a testo e da testo a voce",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Chiave API ElevenLabs",
                        "elevenlabsRestrict": "Restrizione chiave: Abilitata",
                        "elevenlabsNoAccess": "Tutto il resto: Nessun accesso",
                        "elevenlabsTts": "Testo in voce: Accesso",
                        "elevenlabsSts": "Voce in voce: Accesso",
                        "elevenlabsAgents": "Agenti ElevenLabs: Scrittura",
                        "elevenlabsVoices": "Voci: Scrittura",
                        "elevenlabsVoiceGen": "Generazione vocale: Accesso",
                        "elevenlabsUser": "Utente: Lettura",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Chiave API OpenAI:",
                        "openaiPlaceholder": "Inserisci la tua chiave API OpenAI",
                        "openaiStored": "Chiave memorizzata in modo sicuro",
                        "openaiHelp": "Inserisci la tua chiave API OpenAI (sk-...)",
                        "elevenlabsLabel": "Chiave API ElevenLabs:",
                        "elevenlabsPlaceholder": "Inserisci la tua chiave API ElevenLabs",
                        "elevenlabsStored": "Chiave memorizzata in modo sicuro",
                        "elevenlabsHelp": "Inserisci la tua chiave API ElevenLabs (32 caratteri)"
                    },
                    "buttons": {
                        "showKey": "Mostra Chiave",
                        "removeKey": "Rimuovi Chiave",
                        "clearAll": "Cancella Tutte le Chiavi",
                        "cancel": "Annulla",
                        "save": "Salva"
                    },
                    "status": {
                        "keyStored": "✓ Chiave memorizzata in modo sicuro"
                    },
                    "links": {
                        "openai": "Genera chiave su: platform.openai.com/api-keys",
                        "elevenlabs": "Genera chiave su: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Microfono",
                    "targetLanguage": "Traduci in",
                    "voice": "Voce",
                    "output": "Uscita",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Avvia Traduzione",
                    "stopTranslation": "Ferma Traduzione",
                    "addCustomVoice": "Aggiungi Voce Personalizzata",
                    "accent": "Accento",
                    "noAccent": "Nessun Accento",
                    "accentOn": "Accento: ON",
                    "accentOff": "Accento: OFF"
                },
                "placeholders": {
                    "selectMicrophone": "Seleziona microfono...",
                    "loadingVoices": "Caricamento voci...",
                    "selectVoice": "Seleziona voce...",
                    "enterCustomAccent": "Inserisci accento personalizzato...",
                    "selectPreset": "Seleziona preset..."
                },
                "keys": {
                    "space": "SPAZIO",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Maiusc"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Benvenuto in Whispra!",
                        "message": "Benvenuto nell'app! Facciamo rapidamente un tour dell'interfaccia principale."
                    },
                    "sidebar": {
                        "title": "Navigazione della Barra Laterale Sinistra",
                        "message": "Questa è la tua barra di navigazione principale. Usala per passare tra le diverse funzionalità come Whispra Translate, Traduzione dello schermo, Traduzione Veloce e altro."
                    },
                    "translateTab": {
                        "title": "Scheda Traduci",
                        "message": "La scheda Traduci è il tuo principale spazio di lavoro per la traduzione in tempo reale. Inizia a parlare e guarda le tue parole tradotte istantaneamente."
                    },
                    "bidirectionalTab": {
                        "title": "Modalità Bidirezionale",
                        "message": "La modalità bidirezionale traduce automaticamente le conversazioni in entrambe le direzioni. Perfetta per un dialogo naturale e scorrevole."
                    },
                    "whispraTranslateTab": {
                        "title": "Scheda Whispra Translate",
                        "message": "La scheda Whispra Translate combina la traduzione in tempo reale e la modalità bidirezionale in un'interfaccia unificata. Usa il pannello sinistro per la traduzione unidirezionale e il pannello destro per le conversazioni bidirezionali. Inizia a parlare e guarda le tue parole tradotte istantaneamente."
                    },
                    "screenTranslationTab": {
                        "title": "Traduzione dello Schermo",
                        "message": "La Traduzione dello Schermo cattura il testo dal tuo schermo e lo traduce in tempo reale. Ottima per tradurre contenuti da giochi, video o applicazioni."
                    },
                    "quickTranslateTab": {
                        "title": "Traduzione Veloce",
                        "message": "La Traduzione Veloce ti offre una traduzione istantanea con una scorciatoia da tastiera. Premi Alt+C per tradurre rapidamente il testo selezionato."
                    },
                    "soundBoardTab": {
                        "title": "Tavolo dei Suoni",
                        "message": "Il Tavolo dei Suoni ti consente di riprodurre clip audio istantaneamente. Perfetto per risposte rapide o effetti sonori durante le conversazioni."
                    },
                    "profile": {
                        "title": "Sezione Profilo",
                        "message": "Accedi alle impostazioni del tuo profilo, informazioni sull'account e disconnettiti da qui."
                    },
                    "settings": {
                        "title": "Menu Impostazioni",
                        "message": "Clicca sul pulsante delle impostazioni nella barra laterale per accedere a tutte le impostazioni dell'applicazione. Ti mostreremo cosa c'è dentro dopo."
                    },
                    "apiKeys": {
                        "title": "Configurazione Chiavi API",
                        "message": "Configura le tue chiavi API qui. Avrai bisogno di chiavi per OpenAI (Whisper), servizi di traduzione e ElevenLabs per la sintesi vocale."
                    },
                    "keybinds": {
                        "title": "Scorciatoie da Tastiera",
                        "message": "Qui puoi configurare le scorciatoie da tastiera per azioni rapide. Personalizza i tuoi tasti di scelta rapida per adattarli al tuo flusso di lavoro."
                    },
                    "models": {
                        "title": "Modelli e Elaborazione",
                        "message": "Qui puoi selezionare modelli AI e regolare le opzioni di elaborazione. Scegli tra elaborazione cloud e locale, e affina i parametri del modello."
                    },
                    "accountSettings": {
                        "title": "Impostazioni Account e di Sfondo",
                        "message": "Nella scheda Account, puoi configurare il comportamento della barra delle applicazioni e le impostazioni di riscaldamento di Paddle. Abilita \"Esegui in Background\" per minimizzare Whispra nella barra delle applicazioni invece di chiuderlo completamente."
                    },
                    "screenBoxSelector": {
                        "title": "Selettore della Casella dello Schermo",
                        "message": "Usa Alt+Y (tasto di scelta rapida predefinito) per attivare il selettore della casella dello schermo. Questo ti consente di selezionare aree specifiche del tuo schermo per una traduzione mirata invece di tradurre l'intero schermo."
                    },
                    "paddleWarmup": {
                        "title": "Funzione di Riscaldamento Paddle",
                        "message": "Abilita \"Riscaldamento Paddle all'Avvio\" per pre-caricare i modelli OCR quando l'app si avvia. Questo rende la traduzione dello schermo più veloce ma aumenta il tempo di avvio. Puoi trovare questo interruttore nella scheda delle impostazioni dell'account."
                    },
                    "systemTray": {
                        "title": "Integrazione con la Barra delle Applicazioni",
                        "message": "Quando \"Esegui in Background\" è abilitato, chiudere la finestra principale minimizzerà Whispra nella barra delle applicazioni invece di uscire. Clicca sull'icona della barra per ripristinare la finestra, o fai clic destro per azioni rapide."
                    },
                    "expandedOverlay": {
                        "title": "Sovrapposizione Espansa",
                        "message": "Premi F11 (o il tuo tasto di scelta rapida configurato) per aprire la Sovrapposizione Espansa - un pannello di controllo flottante che rimane sopra ad altre applicazioni. Perfetto per giochi o app a schermo intero! Include tutte le stesse funzionalità accessibili senza lasciare la tua attuale applicazione."
                    },
                    "hotkeys": {
                        "title": "Scorciatoie Essenziali",
                        "message": "Ricorda queste scorciatoie: F11 per Sovrapposizione Espansa, Alt+T per Traduzione dello Schermo, Alt+Y per Selettore della Casella dello Schermo. Puoi personalizzare tutte le scorciatoie nelle Impostazioni → Scorciatoie."
                    },
                    "finish": {
                        "title": "Sei Pronto!",
                        "message": "Ecco fatto! Sei pronto per iniziare a usare l'app. Premi F11 per provare la Sovrapposizione Espansa e esplora tutte le funzionalità per personalizzare la tua esperienza."
                    },
                    "buttons": {
                        "skip": "Salta",
                        "back": "Indietro",
                        "next": "Avanti",
                        "closeTour": "Chiudi Tour"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Traduzione Rapida",
                    "description": "Traduci istantaneamente il testo usando servizi di traduzione AI",
                    "globalHotkey": "Tasto di Scelta Rapida Globale:",
                    "translateTo": "Traduci In",
                    "autoTranslate": "Auto-Traduzione",
                    "translatesAsYouType": "Traduce mentre digiti",
                    "clickTranslateOrPress": "Clicca Traduci o premi Ctrl+Enter",
                    "textToTranslate": "Testo da Tradurre",
                    "translationResult": "Risultato della Traduzione",
                    "translate": "Traduci",
                    "translating": "Traduzione in corso...",
                    "clear": "Cancella",
                    "copyResult": "Copia Risultato",
                    "readyToTranslate": "Pronto per tradurre",
                    "typingDots": "Digitando...",
                    "translatingWord": "Traduzione parola...",
                    "translationCompleted": "Traduzione completata",
                    "translationFailed": "Traduzione fallita",
                    "copiedToClipboard": "Traduzione copiata negli appunti",
                    "pleaseEnterText": "Inserisci il testo da tradurre",
                    "autoTranslateEnabled": "Auto-traduzione attivata",
                    "autoTranslateDisabled": "Auto-traduzione disattivata - Clicca Traduci",
                    "enterTextPlaceholder": "Inserisci testo da tradurre...",
                    "translationPlaceholder": "La traduzione apparirà qui..."
                },
                "settingsModal": {
                    "title": "Impostazioni",
                    "runInBackground": "Esegui in background",
                    "close": "Chiudi",
                    "tabs": {
                        "account": "Account",
                        "apiKeys": "Chiavi API",
                        "models": "Modelli",
                        "cloudLocal": "Cloud/Locale",
                        "keybinds": "Scorciatoie",
                        "themes": "Temi",
                        "languageLibrary": "Libreria Lingue"
                    },
                    "keybinds": {
                        "title": "Scorciatoie da Tastiera",
                        "description": "Configura le scorciatoie globali per varie funzionalità. Bidirezionale e traduzione schermo usano {modifier} + tasto. Clicca \"Cambia\" per impostare un nuovo tasto.",
                        "ptt": "Premi per Parlare",
                        "pttDesc": "Tieni premuto questo tasto per parlare (predefinito: Spazio, senza Alt)",
                        "bidirectional": "Attiva/Disattiva Bidirezionale",
                        "bidirectionalDesc": "Premi {modifier} + questo tasto per attivare/disattivare la modalità bidirezionale (predefinito: B)",
                        "screenTranslation": "Traduzione Schermo",
                        "screenTranslationDesc": "Premi {modifier} + questo tasto per catturare lo schermo (predefinito: T)",
                        "screenTranslationBox": "Riquadro Traduzione Schermo",
                        "screenTranslationBoxDesc": "Premi {modifier} + questo tasto per selezionare l'area del riquadro per la traduzione (predefinito: Y)",
                        "overlayToggle": "Attiva/Disattiva Overlay",
                        "overlayToggleDesc": "Premi questo tasto per attivare/disattivare l'overlay (predefinito: F11, senza Alt)",
                        "quickTranslation": "Traduzione Rapida",
                        "quickTranslationLocked": "Questa scorciatoia è fissa e non può essere modificata",
                        "change": "Cambia",
                        "locked": "Bloccato",
                        "tip": "Premi per parlare e attiva/disattiva overlay non richiedono {modifier}. Bidirezionale e traduzione schermo richiedono {modifier} + tasto. Premi ESC per annullare.",
                        "changeTitle": "Cambia {label}",
                        "changeDescAlt": "Premi un tasto qualsiasi per impostarlo come {modifier} + [il tuo tasto]. {modifier} verrà aggiunto automaticamente. Premi ESC per annullare.",
                        "changeDescNoAlt": "Premi un tasto qualsiasi (tasti funzione consigliati). Nessun modificatore necessario. Premi ESC per annullare.",
                        "waitingForInput": "In attesa di input..."
                    },
                    "themes": {
                        "title": "Selezione Tema",
                        "description": "Scegli il tema dell'interfaccia preferito. Le modifiche vengono applicate immediatamente.",
                        "active": "Attivo",
                        "select": "Seleziona"
                    },
                    "account": {
                        "title": "Account",
                        "profile": "Profilo",
                        "subscription": "Abbonamento",
                        "usage": "Utilizzo",
                        "preferences": "Preferenze",
                        "email": "Email",
                        "plan": "Piano",
                        "trialDays": "Giorni di Prova Rimanenti",
                        "status": "Stato",
                        "spokenLanguage": "Lingua che Parli",
                        "rememberResponses": "Salva Risposte API",
                        "rememberResponsesDesc": "Memorizza le risposte API per il tracciamento dell'utilizzo e il debug. Disattiva per maggiore privacy.",
                        "usageUsed": "Usato questo mese",
                        "usageRemaining": "rimanente",
                        "usageLoading": "Caricamento dati di utilizzo...",
                        "usageError": "Impossibile caricare i dati di utilizzo",
                        "usageWarningHigh": "⚠️ Utilizzo elevato questo mese",
                        "usageWarningLimit": "⚠️ Avvicinamento al limite di utilizzo",
                        "openDashboard": "Gestisci Abbonamento",
                        "signOut": "Esci",
                        "opening": "Apertura...",
                        "error": "Impossibile aprire il pannello account. Visita account.whispra.xyz manualmente.",
                        "loading": "Caricamento informazioni account...",
                        "trial": "Prova Gratuita di 7 Giorni",
                        "active": "Abbonamento Attivo",
                        "expired": "Scaduto"
                    }
                }
            },'de': {
                "tab": {
                    "translation": "Übersetzung",
                    "bidirectional": "Bidirektional",
                    "soundboard": "Soundboard",
                    "settings": "Einstellungen"
                },
                "sidebar": {
                    "translate": "Übersetzen",
                    "bidirectional": "Bidirektional",
                    "screenTranslation": "Bildschirmübersetzung",
                    "soundBoard": "Soundboard",
                    "voiceFilter": "Sprachfilter",
                    "settings": "Einstellungen",
                    "logs": "Protokolle",
                    "menu": "Menü",
                    "whispraTranslate": "Whispra Übersetzen",
                    "screenTranslate": "Bildschirm Übersetzen",
                    "quickTranslate": "Schnellübersetzung",
                    "help": "Hilfe"
                },
                "soundboard": {
                    "panel": {
                        "title": "Soundboard",
                        "description": "Spiele benutzerdefinierte Sounds und Audio-Clips während Gesprächen"
                    },
                    "controls": {
                        "outputDevice": "Ausgabegerät",
                        "vbAudioVolume": "VB Audio Lautstärke",
                        "headphonesVolume": "Kopfhörerlautstärke",
                        "soundPadGrid": "Sound Pad Raster",
                        "enableHotkeys": "Soundboard-Hotkeys aktivieren",
                        "addSoundFiles": "Sounddateien hinzufügen",
                        "webOverlay": "Web-Overlay",
                        "stopAllSounds": "Alle Sounds stoppen"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Ausgabegerät auswählen...",
                        "defaultSystemOutput": "Standard-Systemausgabe",
                        "virtualAudioCable": "Virtuelles Audiokabel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Bidirektionaler Modus"
                    },
                    "controls": {
                        "startBidirectional": "Bidirektional starten",
                        "stopBidirectional": "Bidirektional stoppen",
                        "keybind": "Übersetzen in",
                        "toggleWith": "Umschalten mit",
                        "changeKey": "Taste ändern",
                        "outputDevice": "Ausgabegerät",
                        "systemInput": "Systemeingabe",
                        "incomingVoice": "Eingehende Stimme",
                        "sourceLanguage": "Quellsprache",
                        "appSelection": "App-Auswahl"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Lade Ausgabegeräte...",
                        "loadingVoices": "Lade Stimmen...",
                        "displaySystemAudio": "Anzeige/Systemaudio (Standard)"
                    },
                    "status": {
                        "idle": "Inaktiv",
                        "waiting": "Warten...",
                        "ready": "Bereit...",
                        "starting": "Starte...",
                        "stopping": "Stoppe..."
                    },
                    "labels": {
                        "detectedTarget": "Erkannte (Zielsprache)",
                        "respoken": "Wiederholt (Übersetzen in)"
                    }
                },
                "header": {
                    "signOut": "Abmelden"
                },
                "footer": {
                    "becomeAffiliate": "Affiliate werden",
                    "reportBug": "Fehler melden / Funktion vorschlagen"
                },
                "settings": {
                    "modal": {
                        "title": "Sichere API-Konfiguration",
                        "close": "Schließen"
                    },
                    "instructions": {
                        "title": "Anleitung zur API-Schlüssel-Konfiguration",
                        "openaiTitle": "OpenAI API-Schlüssel",
                        "openaiPermissions": "Lese Berechtigungen: Modelle, Fähigkeiten",
                        "openaiUsage": "Verwendet für Sprach-zu-Text und Text-zu-Sprache Übersetzung",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "ElevenLabs API-Schlüssel",
                        "elevenlabsRestrict": "Schlüssel einschränken: Aktiviert",
                        "elevenlabsNoAccess": "Alles andere: Kein Zugang",
                        "elevenlabsTts": "Text zu Sprache: Zugang",
                        "elevenlabsSts": "Sprache zu Sprache: Zugang",
                        "elevenlabsAgents": "ElevenLabs-Agenten: Schreiben",
                        "elevenlabsVoices": "Stimmen: Schreiben",
                        "elevenlabsVoiceGen": "Sprachgenerierung: Zugang",
                        "elevenlabsUser": "Benutzer: Lesen",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "OpenAI API-Schlüssel:",
                        "openaiPlaceholder": "Geben Sie Ihren OpenAI API-Schlüssel ein",
                        "openaiStored": "Schlüssel sicher gespeichert",
                        "openaiHelp": "Geben Sie Ihren OpenAI API-Schlüssel ein (sk-...)",
                        "elevenlabsLabel": "ElevenLabs API-Schlüssel:",
                        "elevenlabsPlaceholder": "Geben Sie Ihren ElevenLabs API-Schlüssel ein",
                        "elevenlabsStored": "Schlüssel sicher gespeichert",
                        "elevenlabsHelp": "Geben Sie Ihren ElevenLabs API-Schlüssel ein (32 Zeichen)"
                    },
                    "buttons": {
                        "showKey": "Schlüssel anzeigen",
                        "removeKey": "Schlüssel entfernen",
                        "clearAll": "Alle Schlüssel löschen",
                        "cancel": "Abbrechen",
                        "save": "Speichern"
                    },
                    "status": {
                        "keyStored": "✓ Schlüssel sicher gespeichert"
                    },
                    "links": {
                        "openai": "Schlüssel generieren unter: platform.openai.com/api-keys",
                        "elevenlabs": "Schlüssel generieren unter: elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Mikrofon",
                    "targetLanguage": "Übersetzen in",
                    "voice": "Stimme",
                    "output": "Ausgabe",
                    "pushToTalk": "Push-to-Talk",
                    "startTranslation": "Übersetzung starten",
                    "stopTranslation": "Übersetzung stoppen",
                    "addCustomVoice": "Benutzerdefinierte Stimme hinzufügen",
                    "accent": "Akzent",
                    "noAccent": "Kein Akzent",
                    "accentOn": "Akzent: AN",
                    "accentOff": "Akzent: AUS"
                },
                "placeholders": {
                    "selectMicrophone": "Mikrofon auswählen...",
                    "loadingVoices": "Lade Stimmen...",
                    "selectVoice": "Stimme auswählen...",
                    "enterCustomAccent": "Benutzerdefinierten Akzent eingeben...",
                    "selectPreset": "Voreinstellung auswählen..."
                },
                "keys": {
                    "space": "LEERTASTE",
                    "ctrl": "Strg",
                    "alt": "Alt",
                    "shift": "Umschalt"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Willkommen bei Whispra!",
                        "message": "Willkommen in der App! Lassen Sie uns schnell durch die Hauptoberfläche gehen."
                    },
                    "sidebar": {
                        "title": "Navigation in der linken Seitenleiste",
                        "message": "Dies ist Ihre Hauptnavigationsleiste. Verwenden Sie sie, um zwischen verschiedenen Funktionen wie Whispra Translate, Bildschirmübersetzung, Schnellübersetzung und mehr zu wechseln."
                    },
                    "translateTab": {
                        "title": "Übersetzen-Tab",
                        "message": "Der Übersetzen-Tab ist Ihr Hauptarbeitsbereich für die Echtzeitübersetzung. Beginnen Sie zu sprechen und sehen Sie, wie Ihre Worte sofort übersetzt werden."
                    },
                    "bidirectionalTab": {
                        "title": "Bidirektionaler Modus",
                        "message": "Der bidirektionale Modus übersetzt Gespräche automatisch in beide Richtungen. Perfekt für natürliche Dialoge."
                    },
                    "whispraTranslateTab": {
                        "title": "Whispra Translate-Tab",
                        "message": "Der Whispra Translate-Tab kombiniert Echtzeitübersetzung und bidirektionalen Modus in einer einheitlichen Benutzeroberfläche. Verwenden Sie das linke Panel für Einwegübersetzung und das rechte Panel für bidirektionale Gespräche. Beginnen Sie zu sprechen und sehen Sie, wie Ihre Worte sofort übersetzt werden."
                    },
                    "screenTranslationTab": {
                        "title": "Bildschirmübersetzung",
                        "message": "Die Bildschirmübersetzung erfasst Text von Ihrem Bildschirm und übersetzt ihn in Echtzeit. Ideal für die Übersetzung von Inhalten aus Spielen, Videos oder Anwendungen."
                    },
                    "quickTranslateTab": {
                        "title": "Schnellübersetzung",
                        "message": "Die Schnellübersetzung bietet Ihnen sofortige Übersetzung mit einer Tastenkombination. Drücken Sie Alt+C, um den ausgewählten Text schnell zu übersetzen."
                    },
                    "soundBoardTab": {
                        "title": "Soundboard",
                        "message": "Das Soundboard ermöglicht es Ihnen, Audio-Clips sofort abzuspielen. Perfekt für schnelle Antworten oder Soundeffekte während Gesprächen."
                    },
                    "profile": {
                        "title": "Profilbereich",
                        "message": "Greifen Sie hier auf Ihre Profileinstellungen, Kontoinformationen und Abmeldemöglichkeiten zu."
                    },
                    "settings": {
                        "title": "Einstellungsmenü",
                        "message": "Klicken Sie auf die Schaltfläche Einstellungen in der Seitenleiste, um auf alle Anwendungseinstellungen zuzugreifen. Wir zeigen Ihnen als Nächstes, was sich darin befindet."
                    },
                    "apiKeys": {
                        "title": "API-Schlüssel-Konfiguration",
                        "message": "Konfigurieren Sie hier Ihre API-Schlüssel. Sie benötigen Schlüssel für OpenAI (Whisper), Übersetzungsdienste und ElevenLabs für die Sprachsynthese."
                    },
                    "keybinds": {
                        "title": "Tastenkombinationen",
                        "message": "Hier können Sie Tastenkombinationen für schnelle Aktionen konfigurieren. Passen Sie Ihre Hotkeys an, um Ihren Arbeitsablauf zu optimieren."
                    },
                    "models": {
                        "title": "Modelle & Verarbeitung",
                        "message": "Hier können Sie KI-Modelle auswählen und Verarbeitungsoptionen anpassen. Wählen Sie zwischen Cloud- und lokaler Verarbeitung und optimieren Sie die Modellparameter."
                    },
                    "accountSettings": {
                        "title": "Konto- & Hintergrundeinstellungen",
                        "message": "Im Konto-Tab können Sie das Verhalten des Systemtray und die Paddle-Warmup-Einstellungen konfigurieren. Aktivieren Sie \"Im Hintergrund ausführen\", um Whispra in den Systemtray zu minimieren, anstatt es vollständig zu schließen."
                    },
                    "screenBoxSelector": {
                        "title": "Bildschirmfeldauswahl",
                        "message": "Verwenden Sie Alt+Y (Standard-Hotkey), um den Bildschirmfeldauswähler zu aktivieren. Damit können Sie bestimmte Bereiche Ihres Bildschirms für gezielte Übersetzungen auswählen, anstatt den gesamten Bildschirm zu übersetzen."
                    },
                    "paddleWarmup": {
                        "title": "Paddle-Warmup-Funktion",
                        "message": "Aktivieren Sie \"Paddle-Warmup beim Start\", um OCR-Modelle beim Start der App vorzuladen. Dies macht die Bildschirmübersetzung schneller, erhöht jedoch die Startzeit. Sie finden diesen Schalter im Tab Kontoeinstellungen."
                    },
                    "systemTray": {
                        "title": "Systemtray-Integration",
                        "message": "Wenn \"Im Hintergrund ausführen\" aktiviert ist, wird das Schließen des Hauptfensters Whispra in Ihren Systemtray minimieren, anstatt es zu beenden. Klicken Sie auf das Tray-Symbol, um das Fenster wiederherzustellen, oder klicken Sie mit der rechten Maustaste für schnelle Aktionen."
                    },
                    "expandedOverlay": {
                        "title": "Erweitertes Overlay",
                        "message": "Drücken Sie F11 (oder Ihre konfigurierte Hotkey), um das erweiterte Overlay zu öffnen - ein schwebendes Bedienfeld, das über anderen Anwendungen bleibt. Perfekt für Spiele oder Vollbildanwendungen! Es enthält alle gleichen Funktionen, die ohne Verlassen Ihrer aktuellen Anwendung zugänglich sind."
                    },
                    "hotkeys": {
                        "title": "Wichtige Hotkeys",
                        "message": "Merken Sie sich diese Tastenkombinationen: F11 für das erweiterte Overlay, Alt+T für Bildschirmübersetzung, Alt+Y für Bildschirmfeldauswahl. Sie können alle Hotkeys in Einstellungen → Tastenkombinationen anpassen."
                    },
                    "finish": {
                        "title": "Sie sind bereit!",
                        "message": "Das ist es! Sie sind bereit, die App zu verwenden. Drücken Sie F11, um das erweiterte Overlay auszuprobieren, und erkunden Sie alle Funktionen, um Ihr Erlebnis anzupassen."
                    },
                    "buttons": {
                        "skip": "Überspringen",
                        "back": "Zurück",
                        "next": "Weiter",
                        "closeTour": "Tour schließen"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Schnellübersetzung",
                    "description": "Übersetzen Sie Text sofort mit KI-Übersetzungsdiensten",
                    "globalHotkey": "Globale Tastenkombination:",
                    "translateTo": "Übersetzen Nach",
                    "autoTranslate": "Auto-Übersetzen",
                    "translatesAsYouType": "Übersetzt während Sie tippen",
                    "clickTranslateOrPress": "Klicken Sie Übersetzen oder drücken Sie Strg+Enter",
                    "textToTranslate": "Zu übersetzender Text",
                    "translationResult": "Übersetzungsergebnis",
                    "translate": "Übersetzen",
                    "translating": "Übersetze...",
                    "clear": "Löschen",
                    "copyResult": "Ergebnis kopieren",
                    "readyToTranslate": "Bereit zum Übersetzen",
                    "typingDots": "Tippen...",
                    "translatingWord": "Übersetze Wort...",
                    "translationCompleted": "Übersetzung abgeschlossen",
                    "translationFailed": "Übersetzung fehlgeschlagen",
                    "copiedToClipboard": "Übersetzung in Zwischenablage kopiert",
                    "pleaseEnterText": "Bitte geben Sie Text zum Übersetzen ein",
                    "autoTranslateEnabled": "Auto-Übersetzung aktiviert",
                    "autoTranslateDisabled": "Auto-Übersetzung deaktiviert - Klicken Sie Übersetzen",
                    "enterTextPlaceholder": "Text zum Übersetzen eingeben...",
                    "translationPlaceholder": "Übersetzung erscheint hier..."
                },
                "settingsModal": {
                    "title": "Einstellungen",
                    "runInBackground": "Im Hintergrund ausführen",
                    "close": "Schließen",
                    "tabs": {
                        "account": "Konto",
                        "apiKeys": "API-Schlüssel",
                        "models": "Modelle",
                        "cloudLocal": "Cloud/Lokal",
                        "keybinds": "Tastenkürzel",
                        "themes": "Designs",
                        "languageLibrary": "Sprachbibliothek"
                    },
                    "keybinds": {
                        "title": "Tastenkürzel",
                        "description": "Konfigurieren Sie globale Tastenkürzel für verschiedene Funktionen. Bidirektional und Bildschirmübersetzung verwenden {modifier} + Taste. Klicken Sie \"Ändern\" um eine neue Taste festzulegen.",
                        "ptt": "Drücken zum Sprechen",
                        "pttDesc": "Halten Sie diese Taste zum Sprechen gedrückt (Standard: Leertaste, ohne Alt)",
                        "bidirectional": "Bidirektional umschalten",
                        "bidirectionalDesc": "Drücken Sie {modifier} + diese Taste um den bidirektionalen Modus umzuschalten (Standard: B)",
                        "screenTranslation": "Bildschirmübersetzung",
                        "screenTranslationDesc": "Drücken Sie {modifier} + diese Taste um den Bildschirm aufzunehmen (Standard: T)",
                        "screenTranslationBox": "Bildschirmübersetzung Box",
                        "screenTranslationBoxDesc": "Drücken Sie {modifier} + diese Taste um einen Boxbereich für die Übersetzung auszuwählen (Standard: Y)",
                        "overlayToggle": "Overlay umschalten",
                        "overlayToggleDesc": "Drücken Sie diese Taste um das Overlay umzuschalten (Standard: F11, ohne Alt)",
                        "quickTranslation": "Schnellübersetzung",
                        "quickTranslationLocked": "Dieses Tastenkürzel ist fest und kann nicht geändert werden",
                        "change": "Ändern",
                        "locked": "Gesperrt",
                        "tip": "Drücken zum Sprechen und Overlay umschalten benötigen kein {modifier}. Bidirektional und Bildschirmübersetzung erfordern {modifier} + Taste. Drücken Sie ESC zum Abbrechen.",
                        "changeTitle": "{label} ändern",
                        "changeDescAlt": "Drücken Sie eine beliebige Taste um sie als {modifier} + [Ihre Taste] festzulegen. {modifier} wird automatisch hinzugefügt. Drücken Sie ESC zum Abbrechen.",
                        "changeDescNoAlt": "Drücken Sie eine beliebige Taste (Funktionstasten empfohlen). Keine Modifikatoren erforderlich. Drücken Sie ESC zum Abbrechen.",
                        "waitingForInput": "Warte auf Eingabe..."
                    },
                    "themes": {
                        "title": "Design-Auswahl",
                        "description": "Wählen Sie Ihr bevorzugtes Oberflächendesign. Änderungen werden sofort angewendet.",
                        "active": "Aktiv",
                        "select": "Auswählen"
                    },
                    "account": {
                        "title": "Konto",
                        "profile": "Profil",
                        "subscription": "Abonnement",
                        "usage": "Nutzung",
                        "preferences": "Einstellungen",
                        "email": "E-Mail",
                        "plan": "Plan",
                        "trialDays": "Verbleibende Testtage",
                        "status": "Status",
                        "spokenLanguage": "Sprache die Sie sprechen",
                        "rememberResponses": "API-Antworten speichern",
                        "rememberResponsesDesc": "API-Antworten für Nutzungsverfolgung und Debugging speichern. Deaktivieren für mehr Privatsphäre.",
                        "usageUsed": "Diesen Monat verwendet",
                        "usageRemaining": "verbleibend",
                        "usageLoading": "Lade Nutzungsdaten...",
                        "usageError": "Nutzungsdaten können nicht geladen werden",
                        "usageWarningHigh": "⚠️ Hohe Nutzung diesen Monat",
                        "usageWarningLimit": "⚠️ Nutzungslimit wird erreicht",
                        "openDashboard": "Abonnement verwalten",
                        "signOut": "Abmelden",
                        "opening": "Öffne...",
                        "error": "Konto-Dashboard konnte nicht geöffnet werden. Bitte besuchen Sie account.whispra.xyz manuell.",
                        "loading": "Lade Kontoinformationen...",
                        "trial": "7-Tage kostenlose Testversion",
                        "active": "Aktives Abonnement",
                        "expired": "Abgelaufen"
                    }
                }
            },'fr': {
                "tab": {
                    "translation": "Traduction",
                    "bidirectional": "Bidirectionnel",
                    "soundboard": "Table de son",
                    "settings": "Paramètres"
                },
                "sidebar": {
                    "translate": "Traduire",
                    "bidirectional": "Bidirectionnel",
                    "screenTranslation": "Traduction d'écran",
                    "soundBoard": "Table de son",
                    "voiceFilter": "Filtre vocal",
                    "settings": "Paramètres",
                    "logs": "Journaux",
                    "menu": "Menu",
                    "whispraTranslate": "Whispra Traduire",
                    "screenTranslate": "Traduire Écran",
                    "quickTranslate": "Traduction Rapide",
                    "help": "Aide"
                },
                "soundboard": {
                    "panel": {
                        "title": "Table de son",
                        "description": "Jouez des sons et des clips audio personnalisés pendant les conversations"
                    },
                    "controls": {
                        "outputDevice": "Périphérique de sortie",
                        "vbAudioVolume": "Volume VB Audio",
                        "headphonesVolume": "Volume des écouteurs",
                        "soundPadGrid": "Grille de pad sonore",
                        "enableHotkeys": "Activer les raccourcis de la table de son",
                        "addSoundFiles": "Ajouter des fichiers audio",
                        "webOverlay": "Superposition Web",
                        "stopAllSounds": "Arrêter tous les sons"
                    },
                    "placeholders": {
                        "selectOutputDevice": "Sélectionnez le périphérique de sortie...",
                        "defaultSystemOutput": "Sortie système par défaut",
                        "virtualAudioCable": "Câble audio virtuel"
                    },
                    "status": {
                        "volume": "%"
                    }
                },
                "bidirectional": {
                    "panel": {
                        "title": "Mode bidirectionnel"
                    },
                    "controls": {
                        "startBidirectional": "Démarrer le bidirectionnel",
                        "stopBidirectional": "Arrêter le bidirectionnel",
                        "keybind": "Traduire en",
                        "toggleWith": "Basculer avec",
                        "changeKey": "Changer la touche",
                        "outputDevice": "Périphérique de sortie",
                        "systemInput": "Entrée système",
                        "incomingVoice": "Voix entrante",
                        "sourceLanguage": "Langue source",
                        "appSelection": "Sélection d'application"
                    },
                    "placeholders": {
                        "loadingOutputDevices": "Chargement des périphériques de sortie...",
                        "loadingVoices": "Chargement des voix...",
                        "displaySystemAudio": "Affichage/Audio système (par défaut)"
                    },
                    "status": {
                        "idle": "Inactif",
                        "waiting": "En attente...",
                        "ready": "Prêt...",
                        "starting": "Démarrage...",
                        "stopping": "Arrêt..."
                    },
                    "labels": {
                        "detectedTarget": "Détecté (Langue source)",
                        "respoken": "Re-énoncé (Traduire en)"
                    }
                },
                "header": {
                    "signOut": "Se déconnecter"
                },
                "footer": {
                    "becomeAffiliate": "Devenir Affilié",
                    "reportBug": "Signaler un Bug / Suggérer une Fonctionnalité"
                },
                "settings": {
                    "modal": {
                        "title": "Configuration API sécurisée",
                        "close": "Fermer"
                    },
                    "instructions": {
                        "title": "Instructions de configuration de la clé API",
                        "openaiTitle": "Clé API OpenAI",
                        "openaiPermissions": "Permissions de lecture : Modèles, Capacités",
                        "openaiUsage": "Utilisé pour la traduction de la parole en texte et du texte en parole",
                        "openaiLink": "platform.openai.com/api-keys",
                        "elevenlabsTitle": "Clé API ElevenLabs",
                        "elevenlabsRestrict": "Restreindre la clé : Activé",
                        "elevenlabsNoAccess": "Tout le reste : Pas d'accès",
                        "elevenlabsTts": "Texte à parole : Accès",
                        "elevenlabsSts": "Parole à parole : Accès",
                        "elevenlabsAgents": "Agents ElevenLabs : Écrire",
                        "elevenlabsVoices": "Voix : Écrire",
                        "elevenlabsVoiceGen": "Génération de voix : Accès",
                        "elevenlabsUser": "Utilisateur : Lire",
                        "elevenlabsLink": "elevenlabs.io/app/profile"
                    },
                    "fields": {
                        "openaiLabel": "Clé API OpenAI :",
                        "openaiPlaceholder": "Entrez votre clé API OpenAI",
                        "openaiStored": "Clé stockée en toute sécurité",
                        "openaiHelp": "Entrez votre clé API OpenAI (sk-...)",
                        "elevenlabsLabel": "Clé API ElevenLabs :",
                        "elevenlabsPlaceholder": "Entrez votre clé API ElevenLabs",
                        "elevenlabsStored": "Clé stockée en toute sécurité",
                        "elevenlabsHelp": "Entrez votre clé API ElevenLabs (32 caractères)"
                    },
                    "buttons": {
                        "showKey": "Afficher la clé",
                        "removeKey": "Supprimer la clé",
                        "clearAll": "Effacer toutes les clés",
                        "cancel": "Annuler",
                        "save": "Enregistrer"
                    },
                    "status": {
                        "keyStored": "✓ Clé stockée en toute sécurité"
                    },
                    "links": {
                        "openai": "Générez une clé sur : platform.openai.com/api-keys",
                        "elevenlabs": "Générez une clé sur : elevenlabs.io/app/profile"
                    }
                },
                "controls": {
                    "microphone": "Microphone",
                    "targetLanguage": "Traduire en",
                    "voice": "Voix",
                    "output": "Sortie",
                    "pushToTalk": "Appuyer pour parler",
                    "startTranslation": "Démarrer la traduction",
                    "stopTranslation": "Arrêter la traduction",
                    "addCustomVoice": "Ajouter une voix personnalisée",
                    "accent": "Accent",
                    "noAccent": "Pas d'accent",
                    "accentOn": "Accent : ACTIVÉ",
                    "accentOff": "Accent : DÉSACTIVÉ"
                },
                "placeholders": {
                    "selectMicrophone": "Sélectionnez le microphone...",
                    "loadingVoices": "Chargement des voix...",
                    "selectVoice": "Sélectionnez la voix...",
                    "enterCustomAccent": "Entrez un accent personnalisé...",
                    "selectPreset": "Sélectionnez un préréglage..."
                },
                "keys": {
                    "space": "ESPACE",
                    "ctrl": "Ctrl",
                    "alt": "Alt",
                    "shift": "Maj"
                },
                "tutorial": {
                    "welcome": {
                        "title": "Bienvenue dans Whispra !",
                        "message": "Bienvenue dans l'application ! Passons rapidement en revue l'interface principale."
                    },
                    "sidebar": {
                        "title": "Navigation de la barre latérale gauche",
                        "message": "Ceci est votre barre de navigation principale. Utilisez-la pour passer d'une fonctionnalité à l'autre comme Whispra Translate, traduction d'écran, traduction rapide, et plus encore."
                    },
                    "translateTab": {
                        "title": "Onglet Traduire",
                        "message": "L'onglet Traduire est votre espace de travail principal pour la traduction en temps réel. Commencez à parler et regardez vos mots être traduits instantanément."
                    },
                    "bidirectionalTab": {
                        "title": "Mode bidirectionnel",
                        "message": "Le mode bidirectionnel traduit les conversations dans les deux sens automatiquement. Parfait pour un dialogue naturel."
                    },
                    "whispraTranslateTab": {
                        "title": "Onglet Whispra Translate",
                        "message": "L'onglet Whispra Translate combine la traduction en temps réel et le mode bidirectionnel dans une interface unifiée. Utilisez le panneau gauche pour la traduction unidirectionnelle et le panneau droit pour les conversations bidirectionnelles. Commencez à parler et regardez vos mots être traduits instantanément."
                    },
                    "screenTranslationTab": {
                        "title": "Traduction d'écran",
                        "message": "La traduction d'écran capture le texte de votre écran et le traduit en temps réel. Idéal pour traduire du contenu de jeux, vidéos ou applications."
                    },
                    "quickTranslateTab": {
                        "title": "Traduction rapide",
                        "message": "La traduction rapide vous donne une traduction instantanée avec un raccourci clavier. Appuyez sur Alt+C pour traduire rapidement le texte sélectionné."
                    },
                    "soundBoardTab": {
                        "title": "Table de son",
                        "message": "La table de son vous permet de jouer des clips audio instantanément. Parfait pour des réponses rapides ou des effets sonores pendant les conversations."
                    },
                    "profile": {
                        "title": "Section Profil",
                        "message": "Accédez à vos paramètres de profil, informations de compte, et déconnectez-vous d'ici."
                    },
                    "settings": {
                        "title": "Menu Paramètres",
                        "message": "Cliquez sur le bouton des paramètres dans la barre latérale pour accéder à tous les paramètres de l'application. Nous vous montrerons ce qu'il y a à l'intérieur ensuite."
                    },
                    "apiKeys": {
                        "title": "Configuration des clés API",
                        "message": "Configurez vos clés API ici. Vous aurez besoin de clés pour OpenAI (Whisper), services de traduction, et ElevenLabs pour la synthèse vocale."
                    },
                    "keybinds": {
                        "title": "Raccourcis clavier",
                        "message": "C'est ici que vous pouvez configurer des raccourcis clavier pour des actions rapides. Personnalisez vos raccourcis pour convenir à votre flux de travail."
                    },
                    "models": {
                        "title": "Modèles & Traitement",
                        "message": "Ici, vous pouvez sélectionner des modèles IA et ajuster les options de traitement. Choisissez entre le traitement cloud et local, et affinez les paramètres du modèle."
                    },
                    "accountSettings": {
                        "title": "Paramètres de compte & d'arrière-plan",
                        "message": "Dans l'onglet Compte, vous pouvez configurer le comportement de la barre d'état système et les paramètres de préchauffage Paddle. Activez \"Exécuter en arrière-plan\" pour minimiser Whispra dans la barre d'état système au lieu de le fermer complètement."
                    },
                    "screenBoxSelector": {
                        "title": "Sélecteur de boîte d'écran",
                        "message": "Utilisez Alt+Y (raccourci par défaut) pour activer le sélecteur de boîte d'écran. Cela vous permet de sélectionner des zones spécifiques de votre écran pour une traduction ciblée au lieu de traduire l'écran entier."
                    },
                    "paddleWarmup": {
                        "title": "Fonction de préchauffage Paddle",
                        "message": "Activez \"Préchauffage Paddle au démarrage\" pour précharger les modèles OCR lorsque l'application démarre. Cela rend la traduction d'écran plus rapide mais augmente le temps de démarrage. Vous pouvez trouver ce commutateur dans l'onglet des paramètres de compte."
                    },
                    "systemTray": {
                        "title": "Intégration de la barre d'état système",
                        "message": "Lorsque \"Exécuter en arrière-plan\" est activé, fermer la fenêtre principale minimisera Whispra dans votre barre d'état système au lieu de quitter. Cliquez sur l'icône de la barre pour restaurer la fenêtre, ou faites un clic droit pour des actions rapides."
                    },
                    "expandedOverlay": {
                        "title": "Superposition étendue",
                        "message": "Appuyez sur F11 (ou votre raccourci configuré) pour ouvrir la superposition étendue - un panneau de contrôle flottant qui reste au-dessus des autres applications. Parfait pour les jeux ou les applications en plein écran ! Il comprend toutes les mêmes fonctionnalités accessibles sans quitter votre application actuelle."
                    },
                    "hotkeys": {
                        "title": "Raccourcis essentiels",
                        "message": "N'oubliez pas ces raccourcis : F11 pour la superposition étendue, Alt+T pour la traduction d'écran, Alt+Y pour le sélecteur de boîte d'écran. Vous pouvez personnaliser tous les raccourcis dans Paramètres → Raccourcis."
                    },
                    "finish": {
                        "title": "Vous êtes prêt !",
                        "message": "C'est tout ! Vous êtes prêt à commencer à utiliser l'application. Appuyez sur F11 pour essayer la superposition étendue et explorez toutes les fonctionnalités pour personnaliser votre expérience."
                    },
                    "buttons": {
                        "skip": "Passer",
                        "back": "Retour",
                        "next": "Suivant",
                        "closeTour": "Fermer la visite"
                    }
                },
                "quickTranslatePanel": {
                    "title": "Traduction Rapide",
                    "description": "Traduisez instantanément du texte avec des services de traduction IA",
                    "globalHotkey": "Raccourci Global:",
                    "translateTo": "Traduire Vers",
                    "autoTranslate": "Auto-Traduction",
                    "translatesAsYouType": "Traduit pendant que vous tapez",
                    "clickTranslateOrPress": "Cliquez Traduire ou appuyez Ctrl+Entrée",
                    "textToTranslate": "Texte à Traduire",
                    "translationResult": "Résultat de la Traduction",
                    "translate": "Traduire",
                    "translating": "Traduction en cours...",
                    "clear": "Effacer",
                    "copyResult": "Copier le Résultat",
                    "readyToTranslate": "Prêt à traduire",
                    "typingDots": "Saisie...",
                    "translatingWord": "Traduction du mot...",
                    "translationCompleted": "Traduction terminée",
                    "translationFailed": "Échec de la traduction",
                    "copiedToClipboard": "Traduction copiée dans le presse-papiers",
                    "pleaseEnterText": "Veuillez entrer du texte à traduire",
                    "autoTranslateEnabled": "Auto-traduction activée",
                    "autoTranslateDisabled": "Auto-traduction désactivée - Cliquez Traduire",
                    "enterTextPlaceholder": "Entrez le texte à traduire...",
                    "translationPlaceholder": "La traduction apparaîtra ici..."
                },
                "settingsModal": {
                    "title": "Paramètres",
                    "runInBackground": "Exécuter en arrière-plan",
                    "close": "Fermer",
                    "tabs": {
                        "account": "Compte",
                        "apiKeys": "Clés API",
                        "models": "Modèles",
                        "cloudLocal": "Cloud/Local",
                        "keybinds": "Raccourcis",
                        "themes": "Thèmes",
                        "languageLibrary": "Bibliothèque de langues"
                    },
                    "keybinds": {
                        "title": "Raccourcis Clavier",
                        "description": "Configurez les raccourcis globaux pour diverses fonctionnalités. Bidirectionnel et traduction d'écran utilisent {modifier} + touche. Cliquez \"Modifier\" pour définir une nouvelle touche.",
                        "ptt": "Appuyer pour parler",
                        "pttDesc": "Maintenez cette touche pour parler (par défaut: Espace, sans Alt)",
                        "bidirectional": "Basculer bidirectionnel",
                        "bidirectionalDesc": "Appuyez sur {modifier} + cette touche pour basculer le mode bidirectionnel (par défaut: B)",
                        "screenTranslation": "Traduction d'écran",
                        "screenTranslationDesc": "Appuyez sur {modifier} + cette touche pour capturer l'écran (par défaut: T)",
                        "screenTranslationBox": "Zone de traduction d'écran",
                        "screenTranslationBoxDesc": "Appuyez sur {modifier} + cette touche pour sélectionner une zone de boîte pour la traduction (par défaut: Y)",
                        "overlayToggle": "Basculer superposition",
                        "overlayToggleDesc": "Appuyez sur cette touche pour basculer la superposition (par défaut: F11, sans Alt)",
                        "quickTranslation": "Traduction rapide",
                        "quickTranslationLocked": "Ce raccourci est fixe et ne peut pas être modifié",
                        "change": "Modifier",
                        "locked": "Verrouillé",
                        "tip": "Appuyer pour parler et basculer superposition n'ont pas besoin de {modifier}. Bidirectionnel et traduction d'écran nécessitent {modifier} + touche. Appuyez sur ESC pour annuler.",
                        "changeTitle": "Modifier {label}",
                        "changeDescAlt": "Appuyez sur n'importe quelle touche pour la définir comme {modifier} + [votre touche]. {modifier} sera ajouté automatiquement. Appuyez sur ESC pour annuler.",
                        "changeDescNoAlt": "Appuyez sur n'importe quelle touche (touches de fonction recommandées). Aucun modificateur nécessaire. Appuyez sur ESC pour annuler.",
                        "waitingForInput": "En attente de saisie..."
                    },
                    "themes": {
                        "title": "Sélection du thème",
                        "description": "Choisissez votre thème d'interface préféré. Les modifications sont appliquées immédiatement.",
                        "active": "Actif",
                        "select": "Sélectionner"
                    },
                    "account": {
                        "title": "Compte",
                        "profile": "Profil",
                        "subscription": "Abonnement",
                        "usage": "Utilisation",
                        "preferences": "Préférences",
                        "email": "E-mail",
                        "plan": "Forfait",
                        "trialDays": "Jours d'essai restants",
                        "status": "Statut",
                        "spokenLanguage": "Langue que vous parlez",
                        "rememberResponses": "Enregistrer les réponses API",
                        "rememberResponsesDesc": "Stocker les réponses API pour le suivi d'utilisation et le débogage. Désactiver pour une confidentialité accrue.",
                        "usageUsed": "Utilisé ce mois",
                        "usageRemaining": "restant",
                        "usageLoading": "Chargement des données d'utilisation...",
                        "usageError": "Impossible de charger les données d'utilisation",
                        "usageWarningHigh": "⚠️ Utilisation élevée ce mois",
                        "usageWarningLimit": "⚠️ Approche de la limite d'utilisation",
                        "openDashboard": "Gérer l'abonnement",
                        "signOut": "Déconnexion",
                        "opening": "Ouverture...",
                        "error": "Impossible d'ouvrir le tableau de bord du compte. Veuillez visiter account.whispra.xyz manuellement.",
                        "loading": "Chargement des informations du compte...",
                        "trial": "Essai gratuit de 7 jours",
                        "active": "Abonnement actif",
                        "expired": "Expiré"
                    }
                }
            }
        };

/**
 * Get translations for a specific language
 * Falls back to English if language is not supported
 */
export function getTranslations(languageCode: string): any {
    return translations[languageCode] || translations['en'];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageCode: string): boolean {
    return languageCode in translations;
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): string[] {
    return Object.keys(translations);
}
