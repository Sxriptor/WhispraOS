# Whispra Open Source Setup Guide

This document explains how to set up and run the open-source version of Whispra.

## Overview

Whispra is a desktop application for real-time voice and screen translation. This open-source version is designed to run **without any dependency on Whispra's hosted infrastructure**.

### What This Means

- ✅ **No hard-coded Whispra URLs** - All external services are configurable
- ✅ **No pre-configured authentication** - Auth is disabled by default
- ✅ **No subscription enforcement** - All features available without payment
- ✅ **No remote error reporting** - Errors logged locally only
- ✅ **Personal mode by default** - Users provide their own API keys

## Quick Start (Personal Mode)

The fastest way to get started is to run in "personal mode" where you provide your own API keys.

### 1. Prerequisites

- Node.js 18+
- npm or yarn
- Windows 10/11 (primary), macOS, or Linux

### 2. Install Dependencies

```bash
npm install
```

### 3. Build and Run

```bash
# Development mode with hot reload
npm run dev

# Or build and run once
npm run dev:simple
```

### 4. Configure API Keys

1. Open the app
2. Go to Settings → API Keys
3. Enter your API keys:
   - **OpenAI API Key** - For Whisper STT and GPT translation
   - **ElevenLabs API Key** - For text-to-speech (optional)
   - **DeepL API Key** - For alternative translation (optional)

That's it! You can now use Whispra with your own API keys.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Whispra Desktop App                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  Personal Mode  │    │  Managed Mode   │                 │
│  │  (Default)      │    │  (Optional)     │                 │
│  ├─────────────────┤    ├─────────────────┤                 │
│  │ User's own      │    │ Backend proxies │                 │
│  │ API keys        │    │ API requests    │                 │
│  │                 │    │                 │                 │
│  │ Direct calls to:│    │ Calls to:       │                 │
│  │ - OpenAI        │    │ - Your backend  │                 │
│  │ - ElevenLabs    │    │ - (configured)  │                 │
│  │ - DeepL         │    │                 │                 │
│  └─────────────────┘    └─────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Feature Flags

Edit `src/services/OpenSourceConfig.ts` to enable/disable features:

```typescript
export const OpenSourceFeatures = {
  AUTH_ENABLED: false,              // Enable authentication
  MANAGED_MODE_ENABLED: false,      // Enable managed API mode
  ERROR_REPORTING_ENABLED: false,   // Enable remote error reporting
  SUBSCRIPTION_CHECKING_ENABLED: false,  // Enable subscription checks
  USAGE_TRACKING_ENABLED: false,    // Enable usage tracking
  AUTO_UPDATE_ENABLED: false,       // Enable auto-updates
};
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Supabase (for authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Managed API Backend
MANAGED_API_URL=https://your-api.example.com/v1/api
MANAGED_API_WS_URL=wss://your-api.example.com/v1/api/ws

# Account Portal
ACCOUNT_PORTAL_URL=https://account.example.com

# Error Reporting
ERROR_REPORTING_URL=https://errors.example.com/report
```

## Setting Up Your Own Backend (Optional)

If you want to run a managed deployment (where users don't need their own API keys), you'll need to set up:

### 1. Authentication Backend (Supabase)

1. Create a Supabase project at https://supabase.com
2. Set up the database schema (see `supabase-setup.sql`)
3. Configure authentication providers
4. Update environment variables

### 2. Managed API Backend

The managed API backend proxies requests to OpenAI/ElevenLabs with:
- User authentication
- Usage tracking
- Rate limiting
- Cost management

See `BACKEND_API_SPECIFICATION.md` for the API contract.

### 3. Account Portal

A web application for:
- User sign-in/sign-up
- Account management
- Subscription management (if applicable)

## Local Mode Features

Even without any backend, Whispra supports:

- **Local Whisper** - Run speech-to-text locally using whisper.cpp
- **Argos Translate** - Offline translation using Argos models
- **PaddleOCR** - Local OCR for screen translation

To use local mode:
1. Go to Settings → Processing
2. Select "Local" mode
3. Download required models when prompted

## Building for Distribution

```bash
# Build for Windows
npm run dist:win

# Build portable version
npm run dist:win-portable

# Build installer
npm run dist:win-installer
```

## Project Structure

```
src/
├── services/
│   ├── OpenSourceConfig.ts    # Feature flags and configuration
│   ├── AuthManager.ts         # Authentication (disabled by default)
│   ├── SupabaseService.ts     # Backend integration (optional)
│   ├── ManagedApiRouter.ts    # API routing (personal/managed)
│   └── ...
├── main.ts                    # Electron main process
└── renderer.ts                # UI entry point
```

## FAQ

### Q: Do I need to sign in to use the app?
**A:** No. Authentication is disabled by default. The app works immediately with your own API keys.

### Q: Can I use this commercially?
**A:** Check the LICENSE file for terms. The open-source version is provided as-is.

### Q: How do I get API keys?
**A:**
- OpenAI: https://platform.openai.com/api-keys
- ElevenLabs: https://elevenlabs.io/
- DeepL: https://www.deepl.com/pro-api

### Q: Can I run everything locally without any API keys?
**A:** Yes! Use "Local" processing mode with local Whisper and Argos Translate.

### Q: How do I enable managed mode?
**A:** You need to deploy your own backend. See "Setting Up Your Own Backend" above.

## Support

This is an open-source project. For issues:
1. Check existing GitHub issues
2. Create a new issue with reproduction steps
3. Include relevant logs from the app

## License

See LICENSE file for details.
