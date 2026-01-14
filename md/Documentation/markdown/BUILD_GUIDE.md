# Whispra Build Guide

This guide explains how to build Whispra into a Windows executable and installer.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Visual Studio Build Tools** (for native addon compilation)
- **Windows 10/11** (for Windows builds)

### Visual Studio Build Tools Setup
1. Download and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. During installation, select:
   - **C++ build tools**
   - **Windows 10/11 SDK**
   - **CMake tools** (optional but recommended)

## Build Process

### 1. Install Dependencies
```bash
npm install
```
This will automatically build the native WASAPI addon for Electron.

### 2. Complete Build
```bash
npm run build:complete
```
This script:
- Cleans previous builds
- Compiles TypeScript files
- Copies HTML and assets
- Builds the native WASAPI addon
- Verifies all critical files

### 3. Create Windows Executable

#### Portable Executable
```bash
npm run dist:win-portable
```
Creates a portable `.exe` file that can run without installation.

#### Windows Installer
```bash
npm run dist:win-installer
```
Creates an NSIS installer (`.exe`) that:
- Installs to Program Files
- Creates desktop and start menu shortcuts
- Allows custom installation directory
- Requires administrator privileges

#### Unpacked Distribution
```bash
npm run pack
```
Creates an unpacked distribution for testing or custom packaging.

## Build Output

All builds are created in the `dist-electron` directory:

- **Portable**: `whispra.exe`
- **Installer**: `whispra-setup.exe`
- **Unpacked**: `win-unpacked/` directory

## Troubleshooting

### Native Addon Build Issues
If the native addon fails to build:

1. **Check Visual Studio Build Tools**:
   ```bash
   npm run build:addon
   ```

2. **Clean and rebuild**:
   ```bash
   npm run clean
   npm run build:complete
   ```

3. **Verify Electron version**:
   Make sure the Electron version in `package.json` matches the target version in the build command.

### Missing Dependencies
If you get missing dependency errors:

1. **Reinstall node_modules**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check native addon dependencies**:
   ```bash
   cd native-wasapi-loopback
   npm install
   ```

### Build Verification
After building, verify these files exist in `dist/`:
- `main.js`
- `preload.js`
- `renderer.js`
- `index.html`
- `signin.html`
- `overlay.html`
- `wasapi_loopback.node`

## Development vs Production

### Development
```bash
npm run dev
```
Runs the app in development mode with hot reloading.

### Production Build
```bash
npm run build:complete
npm start
```
Runs the production build locally.

## Advanced Configuration

### Custom Build Configuration
Edit the `build` section in `package.json` to customize:
- App metadata (name, version, description)
- Icons and branding
- Installer behavior
- File inclusion/exclusion

### Native Addon Configuration
The native addon is configured in:
- `native-wasapi-loopback/binding.gyp` - Build configuration
- `native-wasapi-loopback/wasapi_loopback.cc` - Source code

## Security Considerations

- The app requires administrator privileges for audio capture
- Native addon handles sensitive audio data
- All API keys are stored securely using system keychain

## Distribution

### Code Signing (Recommended)
For production distribution, consider code signing your executable:
1. Obtain a code signing certificate
2. Configure electron-builder with your certificate
3. Sign the final executable

### Auto-updates
Consider implementing auto-updates using electron-updater:
1. Host updates on a server
2. Configure electron-builder for auto-updates
3. Implement update logic in the main process

## Support

For build issues:
1. Check the console output for specific error messages
2. Verify all prerequisites are installed
3. Try cleaning and rebuilding from scratch
4. Check the troubleshooting section above
