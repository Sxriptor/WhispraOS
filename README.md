<h1 align="center">
  <a href="https://crawlee.dev">
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcset="https://github.com/user-attachments/assets/5fd5f5ac-87a2-4051-83e2-8a3a52946e46"
      >
      <img
        alt="Whispra"
        src="https://github.com/user-attachments/assets/5fd5f5ac-87a2-4051-83e2-8a3a52946e46"
        width="300"
        height="100"
        style="margin-bottom:-4px;"
      >
    </picture>
  </a>
  <br>
  <small>Real Time Voice | Display Translation</small>
</h1>









<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-white" alt="Downloads" style="max-width: 100%;">
    <img src="https://img.shields.io/badge/downloads-123-white" alt="Downloads" style="max-width: 100%;">
    <img src="https://img.shields.io/badge/discord-78 online-white" alt="Downloads" style="max-width: 100%;">
    <img src="https://img.shields.io/badge/stable-win 10/11-white" alt="Downloads" style="max-width: 100%;">
</p>

---
## ⚠️ Open-Source & Self-Hosted Notice

This repository is an **open-source project intended for highly technical users and developers**.

This codebase **does not use Whispra’s official servers**, managed APIs, or hosted infrastructure.  
It is designed to be **self-hosted, independently deployed, or fully recreated** by third parties using their own backend, database, authentication system, and service providers.

Whispra, Inc. does **not** operate, control, or provide any hosted services through this repository.

We deeply appreciate the open-source community and are grateful to everyone who contributes, improves, or builds upon this project.

If you are an experienced developer or part of a technically advanced team, it is entirely possible—and explicitly allowed—to recreate the required backend on alternative providers or regional infrastructure and release your own independent version (including rebranded or region-specific deployments).

Please note:
- Whispra, Inc. **cannot provide support, hosting, managed services, or operational assistance** for deployments in locations where such support is restricted or prohibited.
- Any self-hosted or third-party deployment is **independently operated** and not affiliated with or endorsed by Whispra, Inc.


## 📑 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Translation Providers](#-translation-providers)
- [Architecture](#-architecture)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

Whispra is a comprehensive desktop application built with Electron that enables real-time voice translation during voice calls and screen translation for games and applications. The application captures audio from microphones, translates speech in real-time, and outputs translated audio through a virtual microphone that other applications can use.

### Key Capabilities

- 🎙️ **Real-time voice translation** with bidirectional support
- 🖥️ **Screen translation** with OCR capabilities
- 🎮 **Gaming overlay** for non-intrusive translation access
- 🔊 **Soundboard** for quick audio clips
- ☁️ **Cloud & local processing** modes
- 🔐 **Secure API key management**
- 🎨 **Customizable themes** and keybinds
- 👤 **Account management** with subscription support

---

## ✨ Features

### 🎙️ Voice Translation

- **Real-time audio capture** from selected microphone devices
- **Multiple speech-to-text providers**:
  - OpenAI Whisper API
  - DeepInfra Whisper
  - Local Whisper models (Tiny, Small, Medium, Large)
- **Text translation** with multiple providers:
  - OpenAI GPT models
  - DeepInfra Meta-Llama-3.1-70B
  - Argos Translate (local)
- **Text-to-speech synthesis** using ElevenLabs API
- **Virtual microphone output** for integration with voice call applications
- **Bidirectional translation** support
- **Voice activity detection** for optimized processing
- **Test modes** for pipeline verification

### 🖥️ Screen Translation

- **Screen capture** with OCR capabilities
- **PaddleOCR integration** for text extraction
- **Real-time translation overlay** on screen content
- **Screen box selector** for targeted area translation (Alt+Y)
- **GPU acceleration** support for faster processing
- **Multiple overlay modes** (minimal, expanded)
- **Customizable positioning** and transparency
- **Paddle warmup on startup** for faster initial OCR processing

### 🎮 Gaming Overlay

- **Non-intrusive HUD** for fullscreen games
- **Minimal status indicator** with color-coded states
- **Expandable overlay** with full controls
- **Customizable hotkeys** (default: F11)
- **Click-through mode** for minimal overlay
- **Multi-monitor support**
- **Performance optimized** (< 50MB RAM, < 5% CPU)

### 🎛️ Additional Features

- **Soundboard** for quick audio playback
- **Quick translate panel** with hotkey support
- **Settings modal** with tabbed interface:
  - 🔐 API Keys management
  - ⌨️ Custom keybinds
  - 🤖 Model selection
  - ☁️ Cloud/Local mode switching
  - 👤 Account management
  - 🎨 Theme customization
- **Persistent configuration** across sessions
- **Debug console** for real-time monitoring
- **Auto-updater** support
- **System tray** integration with background mode
- **Paddle warmup** for optimized OCR performance

---

## 🚀 Installation

### Prerequisites

- **Node.js 18+** and npm
- **Windows 10/11**, macOS, or Linux
- **Microphone access** permissions
- **API Keys** (depending on features used):
  - OpenAI API key (for Whisper STT and GPT translation)
  - DeepInfra API key (optional, for alternative providers)
  - ElevenLabs API key (for text-to-speech)

### Installation Steps

1. **Clone the repository**

```bash
git clone https://github.com/Sxriptor/Whispra-Download.git
cd WhispraModelTwo
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the application**

```bash
# Build main application
npm run build

# Build WASAPI addon (Windows)
npm run build:addon

# Copy addon binaries
npm run copy-addon
```

4. **Launch the application**

```bash
npm start
```

### Development Setup

For development with hot reload:

```bash
# Development mode with watch
npm run dev

# Simple development build
npm run dev:simple

# Build and watch mode
npm run build:watch
```

---

## 🎬 Quick Start

### 1. Configure API Keys

1. Open the application
2. Click **⚙️ Settings** button
3. Navigate to **API Keys** tab
4. Enter your **OpenAI API key** (required for voice translation)
5. Enter your **ElevenLabs API key** (required for text-to-speech)
6. Optionally add **DeepInfra API key** (for alternative providers)
7. Click **Save Settings**

### 2. Select Translation Mode

In **Settings → Cloud/Local** tab:
- Choose **Cloud** mode for online processing (requires API keys)
- Choose **Local** mode for offline processing (requires local models)

### 3. Configure Models

In **Settings → Models** tab:
- Select **Speech-to-Text model** (Whisper, DeepInfra, or local models)
- Select **Translation model** (OpenAI, DeepInfra, or Argos)
- Select **Voice model** (ElevenLabs voices)

### 4. Test the Pipeline

1. Select your **microphone** from the device dropdown
2. Choose **target language** (e.g., Spanish, French, Japanese)
3. Pick a **voice** for text-to-speech output
4. Click **🧪 Test Translation** to verify the pipeline
5. Click **🎧 Hear Yourself** to test microphone input

### 5. Start Real-Time Translation

1. Click **▶️ Start Translation**
2. Speak into your selected microphone
3. Translated audio is sent to **Virtual Microphone Output**
4. Configure other apps (Zoom, Teams, Discord) to use the virtual microphone

### 6. Use Screen Translation Features

#### Screen Box Selector
1. Press **Alt+Y** (default hotkey) to activate box selection mode
2. Click and drag to select a specific area of your screen
3. The selected area will be translated and displayed in an overlay
4. Press **ESC** to cancel selection

#### System Tray Integration
1. Enable **"Run in Background"** in Settings → Account tab
2. Close the main window to minimize Whispra to system tray
3. Click the tray icon to restore the window
4. Right-click the tray icon for quick actions (Show/Hide/Quit)

#### Paddle Warmup Optimization
1. In Settings → Account tab, toggle **"Paddle Warmup on Startup"**
2. When enabled, OCR models pre-load during app startup
3. This provides faster screen translation performance
4. Disable if you want faster app startup times

---

## ⚙️ Configuration

### Settings Overview

The application includes a comprehensive settings modal with multiple tabs:

#### 🔐 API Keys
- Manage OpenAI, DeepInfra, and ElevenLabs API keys
- Secure storage with validation
- API key testing and verification

#### ⌨️ Keybinds
- Customize hotkeys for:
  - Overlay toggle (default: F11)
  - Screen translation (default: Alt+T)
  - Screen box selector (default: Alt+Y)
  - Quick translate
  - Push-to-talk
  - Soundboard shortcuts

#### 🤖 Models
- **Speech-to-Text Models**:
  - Cloud: Whisper v1, DeepInfra
  - Local: Whisper Tiny/Small/Medium/Large, GPT-based, DeepInfra
- **Translation Models**:
  - Cloud: OpenAI GPT, DeepInfra
  - Local: Argos Translate, OpenAI GPT, DeepInfra
- **Voice Models**:
  - ElevenLabs voices
  - Custom voice configuration

#### ☁️ Cloud/Local
- Switch between cloud and local processing modes
- Configure local model paths
- GPU acceleration settings for local processing

#### 👤 Account
- Sign in/sign out
- Subscription management
- Account preferences

#### 🎨 Themes
- Light/Dark mode
- Custom color schemes
- UI customization options

---

## 🌐 Translation Providers

### Speech-to-Text Providers

| Provider | Type | Model | Languages | Speed | Accuracy |
|----------|------|-------|-----------|-------|----------|
| **OpenAI Whisper** | Cloud | whisper-1 | 100+ | Fast | Excellent |
| **DeepInfra Whisper** | Cloud | whisper-large-v3 | 100+ | Fast | Excellent |
| **Local Whisper** | Local | tiny/small/medium/large | 100+ | Medium | Good-Excellent |

### Translation Providers

| Provider | Type | Model | Languages | Cost | Quality |
|----------|------|-------|-----------|------|---------|
| **OpenAI GPT** | Cloud | GPT-3.5/4 | 20+ | Variable | Excellent |
| **DeepInfra** | Cloud | Meta-Llama-3.1-70B | 30+ | Lower | Excellent |
| **Argos Translate** | Local | Neural MT | 100+ | Free | Good |

### Text-to-Speech Provider

- **ElevenLabs**: High-quality voice synthesis with multiple voices and languages

---

## 🏗️ Architecture

### Service Layer

The application follows a modular architecture with clear separation of concerns:

#### Core Services

- **`ProcessingOrchestrator`**: Manages the complete translation pipeline
- **`AudioCaptureService`**: Handles microphone input and audio processing
- **`SpeechToTextService`**: Manages STT provider selection and processing
- **`TranslationServiceManager`**: Coordinates translation providers
- **`TextToSpeechManager`**: Handles ElevenLabs voice synthesis
- **`VirtualMicrophoneManager`**: Manages audio output routing
- **`ConfigurationManager`**: Handles settings and API key storage

#### Translation Services

- **`OpenAITranslationClient`**: OpenAI GPT translation implementation
- **`DeepInfraTranslationClient`**: DeepInfra translation implementation
- **`ArgosTranslationService`**: Local Argos translation implementation

#### Screen Translation Services

- **`ScreenTranslationManager`**: Coordinates screen capture and translation
- **`ScreenTranslationBoxSelectManager`**: Manages box selection for targeted translation
- **`PaddleOCRService`**: OCR processing with PaddleOCR and warmup functionality
- **`GPUPaddleService`**: GPU-accelerated OCR processing
- **`ScreenCaptureService`**: Screen capture functionality

#### Overlay Services

- **`OverlayWindowManager`**: Manages overlay window lifecycle
- **`OverlayStateManager`**: Handles overlay state transitions
- **`SoundboardOverlayManager`**: Soundboard overlay management
- **`ScreenTranslationOverlayManager`**: Screen translation overlay

#### Utility Services

- **`AudioDeviceManager`**: Audio device detection and management
- **`VoiceActivityDetector`**: Voice activity detection
- **`TranscriptionQueue`**: Manages transcription queue
- **`LoggingService`**: Centralized logging
- **`AuthManager`**: Authentication and authorization
- **`AutoUpdaterService`**: Application auto-update management

### Audio Pipeline Flow

```
Microphone Input
    ↓
Audio Capture (AudioCaptureService)
    ↓
Voice Activity Detection (VoiceActivityDetector)
    ↓
Speech-to-Text (SpeechToTextService)
    ├── OpenAI Whisper API
    ├── DeepInfra Whisper
    └── Local Whisper Models
    ↓
Translation (TranslationServiceManager)
    ├── OpenAI GPT
    ├── DeepInfra Meta-Llama
    └── Argos Translate
    ↓
Text-to-Speech (TextToSpeechManager)
    └── ElevenLabs API
    ↓
Virtual Microphone Output (VirtualMicrophoneManager)
    ├── Test Mode → System Speakers
    └── Live Mode → Virtual Microphone
```

### Dual Output Modes

- **Test Mode**: Audio → System Speakers (for testing and verification)
- **Live Mode**: Audio → Virtual Microphone (for other applications)

---

## 💻 Development

### Project Structure

```
src/
├── services/              # Core business logic services
│   ├── ProcessingOrchestrator.ts      # Main pipeline coordinator
│   ├── AudioCaptureService.ts         # Microphone input handling
│   ├── SpeechToTextService.ts        # STT provider management
│   ├── TranslationServiceManager.ts   # Translation coordination
│   ├── TextToSpeechManager.ts         # ElevenLabs TTS
│   ├── VirtualMicrophoneManager.ts    # Audio output routing
│   ├── ScreenTranslationManager.ts    # Screen translation
│   ├── PaddleOCRService.ts            # OCR processing
│   ├── OverlayWindowManager.ts        # Overlay management
│   └── ...                            # Other services
├── interfaces/            # TypeScript interfaces
│   ├── AudioCaptureService.ts
│   ├── SpeechToTextService.ts
│   ├── TranslationService.ts
│   ├── TextToSpeechService.ts
│   └── VirtualMicrophoneService.ts
├── ui/                    # User interface components
│   ├── settings/          # Settings modal and tabs
│   │   ├── SettingsModal.ts
│   │   ├── tabs/
│   │   │   ├── ApiKeysTab.ts
│   │   │   ├── ModelsTab.ts
│   │   │   ├── CloudLocalTab.ts
│   │   │   ├── AccountTab.ts
│   │   │   ├── KeybindsTab.ts
│   │   │   └── ThemesTab.ts
│   │   └── styles/
│   ├── AudioDeviceSelector.ts
│   ├── LanguageSelector.ts
│   ├── VoiceSelector.ts
│   └── ...                # Other UI components
├── ipc/                   # Inter-process communication
│   ├── channels.ts        # IPC channel definitions
│   ├── handlers.ts        # IPC handlers
│   └── messages.ts        # Message type definitions
├── types/                 # TypeScript type definitions
│   ├── AudioTypes.ts
│   ├── ConfigurationTypes.ts
│   ├── ErrorTypes.ts
│   └── StateTypes.ts
├── main.ts                # Electron main process
├── renderer.ts            # UI renderer process
├── index.html             # Main application interface
├── overlay.html           # Gaming overlay interface
├── soundboard-overlay.html # Soundboard overlay
└── screen-translation-overlay.html # Screen translation overlay
```

### Build Commands

```bash
# Development with hot reload
npm run dev

# Simple development build and run
npm run dev:simple

# Production build
npm run build

# Build WASAPI addon (Windows)
npm run build:addon

# Copy addon binaries
npm run copy-addon

# Watch mode for development
npm run build:watch

# Clean build artifacts
npm run clean

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Build distribution packages
npm run dist              # Build all platforms
npm run dist:win          # Windows only
npm run dist:win-portable # Windows portable
npm run dist:win-installer # Windows installer
```

### Testing

The project includes Jest test suites:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Code Style

- TypeScript with strict mode enabled
- ESLint configuration (if configured)
- Consistent naming conventions
- Comprehensive JSDoc documentation

---

## 🐛 Troubleshooting

### Common Issues

#### ❌ Microphone Access Denied

**Solution**: Grant microphone permissions in system settings
- **Windows**: Settings → Privacy → Microphone
- **macOS**: System Preferences → Security & Privacy → Microphone
- **Linux**: Check PulseAudio/ALSA permissions

#### ❌ API Key Validation Failed

**Solution**: Verify API keys are correct and have sufficient credits
- Check OpenAI account: [platform.openai.com/usage](https://platform.openai.com/usage)
- Check ElevenLabs account: [elevenlabs.io/subscription](https://elevenlabs.io/subscription)
- Check DeepInfra account: [deepinfra.com](https://deepinfra.com)

#### ❌ No Audio Output

**Solution**: Check virtual microphone setup
1. Try **📢 Test Virtual Mic** button
2. Verify other apps can see **"Virtual Microphone Output"** device
3. Check Windows audio settings for virtual microphone
4. Ensure VB-Audio Cable or similar virtual audio device is installed

#### ❌ Translation Not Working

**Solution**: Use debug console to identify issues
1. Click **Show Debug Console** to see real-time logs
2. Verify all API keys are configured correctly
3. Check selected models are available
4. Ensure internet connection for cloud providers
5. Check translation provider selection in Settings → Models

#### ❌ Overlay Not Showing

**Solution**: Troubleshoot overlay issues
1. Check if overlay is enabled in settings
2. Try a different hotkey if F11 conflicts with your game
3. Restart the application if overlay becomes unresponsive
4. Check overlay position settings

#### ❌ Local Models Not Working

**Solution**: Verify local model setup
1. Ensure Python is installed and accessible
2. Check PaddlePaddle installation (for OCR)
3. Verify Argos Translate models are downloaded
4. Check GPU acceleration settings if using GPU

#### ❌ Screen Box Selector Not Working

**Solution**: Check hotkey configuration and permissions
1. Verify Alt+Y hotkey isn't conflicting with other applications
2. Try customizing the hotkey in Settings → Keybinds
3. Ensure screen capture permissions are granted
4. Check if antivirus software is blocking screen capture

#### ❌ System Tray Not Appearing

**Solution**: Check system tray settings
1. Verify system tray is enabled in Windows settings
2. Check if Whispra icon is hidden in system tray overflow
3. Try restarting the application
4. Ensure "Run in Background" is enabled in Settings → Account

#### ❌ Paddle Warmup Taking Too Long

**Solution**: Optimize OCR startup performance
1. Disable "Paddle Warmup on Startup" for faster app launch
2. Check available system memory (warmup requires ~500MB)
3. Verify PaddleOCR installation is complete
4. Consider using GPU acceleration if available

### Debug Console

The debug console shows real-time information:
- API requests and responses
- Audio processing status
- Error messages and warnings
- Performance metrics
- Translation progress

Access it via: **Show Debug Console** button in the main interface

### Getting Help

1. Check the debug console for detailed error messages
2. Review application logs
3. Verify all prerequisites are met
4. Ensure latest version is installed

---

## 📦 Project Structure

```
WhispraModelTwo/
├── src/                   # Source code
│   ├── services/          # Core services
│   ├── interfaces/        # TypeScript interfaces
│   ├── ui/                # UI components
│   ├── ipc/               # IPC communication
│   ├── types/             # Type definitions
│   ├── locales/           # Internationalization
│   ├── paddle/            # PaddleOCR integration
│   ├── soundboard/        # Soundboard functionality
│   └── main.ts            # Electron main process
├── native-wasapi-loopback/ # WASAPI native addon
├── dist/                  # Build output
├── dist-electron/         # Distribution packages
├── python/                # Embedded Python runtime
├── logos/                 # Application icons
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

---

## 🔧 Advanced Configuration

### Environment Variables

Create a `.env` file for development:

```env
OPENAI_API_KEY=your_openai_key
DEEPINFRA_API_KEY=your_deepinfra_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Configuration Files

Settings are stored in:
- **Windows**: `%APPDATA%/Whispra/config.json`
- **macOS**: `~/Library/Application Support/Whispra/config.json`
- **Linux**: `~/.config/Whispra/config.json`

### Custom Models

For local processing:
1. Download Whisper models (if using local Whisper)
2. Install Argos Translate models (if using Argos)
3. Configure paths in Settings → Cloud/Local

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation as needed
- Follow existing code style

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop framework
- **OpenAI** - Whisper and GPT models
- **ElevenLabs** - Text-to-speech synthesis
- **DeepInfra** - Alternative AI provider
- **Argos Translate** - Local translation models
- **PaddleOCR** - OCR capabilities

---

<div align="center">

**Made with ❤️ by the Whispra Team**

[Website](https://whispra.com) • [Documentation](https://docs.whispra.com) • [Issues](https://github.com/Sxriptor/Whispra-Download/issues) • [Discord](https://discord.gg/whispra)

</div>
