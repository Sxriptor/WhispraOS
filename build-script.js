const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Whispra build process...');

// Step 1: Clean previous builds
console.log('📁 Cleaning previous builds...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
} catch (error) {
  console.log('Clean command failed, continuing...');
}

// Step 2: Build TypeScript files
console.log('🔨 Building TypeScript files...');
execSync('npm run build:main', { stdio: 'inherit' });
execSync('npm run build:renderer', { stdio: 'inherit' });

// Step 3: Copy files to correct locations
console.log('📋 Copying files to correct locations...');
execSync('npm run copy-renderer', { stdio: 'inherit' });
execSync('npm run copy-renderer-utils', { stdio: 'inherit' });
execSync('npm run copy-renderer-modules', { stdio: 'inherit' });
execSync('npm run copy-services', { stdio: 'inherit' });
execSync('npm run copy-html', { stdio: 'inherit' });
execSync('npm run copy-overlay', { stdio: 'inherit' });
execSync('npm run copy-ui', { stdio: 'inherit' });
execSync('npm run copy-components', { stdio: 'inherit' });
execSync('npm run copy-utils', { stdio: 'inherit' });
execSync('npm run copy-paddle-python', { stdio: 'inherit' });
execSync('npm run copy-paddle', { stdio: 'inherit' });
execSync('npm run copy-diagnostic', { stdio: 'inherit' });
execSync('npm run copy-assets', { stdio: 'inherit' });

// Step 3.5: Create minimal package.json for electron-builder
console.log('📦 Creating minimal package.json for electron-builder...');
const minimalPackageJson = {
  name: "whispra",
  version: "1.0.0",
  description: "Cross-platform desktop application for real-time voice translation during voice calls",
  main: "main.js",
  keywords: [
    "electron",
    "voice-translation",
    "real-time",
    "speech-to-text",
    "text-to-speech"
  ],
  author: "Voice Translator Team",
  license: "MIT",
  dependencies: {
    "keytar": "^7.9.0",
    "node-addon-api": "^8.5.0",
    "node-global-key-listener": "^0.3.0",
    "openai": "^4.0.0"
  },
  optionalDependencies: {}
};

fs.writeFileSync('dist/package.json', JSON.stringify(minimalPackageJson, null, 2));

// Step 4: Build native addon for Electron (Windows: WASAPI, macOS: CoreAudio)
const platform = process.platform;
if (platform === 'win32') {
  console.log('🔧 Building native WASAPI addon for Electron...');
  const electronVersion = require('./package.json').devDependencies.electron.replace('^', '');
  const addonCommand = `cd native-wasapi-loopback && node-gyp rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`;
  execSync(addonCommand, { stdio: 'inherit' });

  // Step 5: Copy native addon
  console.log('📦 Copying native addon...');
  execSync('npm run copy-addon', { stdio: 'inherit' });
} else if (platform === 'darwin') {
  console.log('🔧 Building native CoreAudio addon for Electron...');
  
  // Install dependencies in native-coreaudio-loopback if needed
  const coreaudioNodeModules = path.join('native-coreaudio-loopback', 'node_modules', 'node-addon-api');
  if (!fs.existsSync(coreaudioNodeModules)) {
    console.log('📦 Installing native addon dependencies...');
    execSync('npm install', { cwd: 'native-coreaudio-loopback', stdio: 'inherit' });
  }
  
  const electronVersion = require('./package.json').devDependencies.electron.replace('^', '');
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const addonCommand = `cd native-coreaudio-loopback && node-gyp rebuild --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers --runtime=electron`;
  execSync(addonCommand, { stdio: 'inherit' });

  // Step 5: Copy native addon
  console.log('📦 Copying native addon...');
  const buildDir = `native-coreaudio-loopback/build/Release`;
  const addonFile = 'coreaudio_loopback.node';
  if (fs.existsSync(path.join(buildDir, addonFile))) {
    const destDir = 'dist';
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(path.join(buildDir, addonFile), path.join(destDir, addonFile));
    console.log(`✅ Copied ${addonFile} to dist/`);
  } else {
    console.warn(`⚠️  ${addonFile} not found in ${buildDir}`);
  }
} else {
  console.log(`ℹ️  Skipping native addon build (not supported on platform: ${platform})`);
}

// Step 6: Verify critical files exist
console.log('✅ Verifying build artifacts...');
const criticalFiles = [
  'dist/main.js',
  'dist/preload.js',
  'dist/renderer.js',
  'dist/index.html',
  'dist/signin.html',
  'dist/device-check-overlay.html',
  'dist/overlay.html',
  'dist/captions-overlay.html',
  'dist/screen-translation-box-select.html',
  'dist/screen-translation-box-select-preload.js',
  'dist/screen-translation-watch-box-select.html',
  'dist/screen-translation-watch-box-select-preload.js',
  'dist/screen-translation-overlay.html',
  'dist/screen-translation-overlay-preload.js',
  'dist/services/BidirectionalTTSProcessor.js',
  'dist/services/CaptionsOverlayManager.js',
  'dist/renderer/translationHelpers.js',
  'dist/renderer/i18n.js',
  'dist/renderer/updateNotification.js',
  'dist/renderer/soundboard.js',
  'dist/renderer/bidirectional/BidirectionalProcessor.js',
  'dist/renderer/bidirectional/BidirectionalControls.js',
  'dist/renderer/bidirectional/BidirectionalUI.js',
  'dist/renderer/bidirectional/BidirectionalState.js',
  'dist/renderer/quicktrans/QuickTranslatePanel.js',
  'dist/renderer/screentrans/ScreenTranslationInit.js',
  'dist/renderer/screentrans/PaddleTriggerConfig.js',
  'dist/components/ui/interactive-3d-character.js',
  'dist/ui/settings/SettingsIntegration.js'
];

// Only check for native addon on Windows or macOS
if (platform === 'win32') {
  criticalFiles.push('dist/wasapi_loopback.node');
} else if (platform === 'darwin') {
  criticalFiles.push('dist/coreaudio_loopback.node');
}

for (const file of criticalFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Critical file missing: ${file}`);
    process.exit(1);
  }
}

// Verify Python files are copied
console.log('✅ Verifying Python files...');
const pythonFiles = [
  'dist/paddle/ocr_service.py',
  'dist/paddle/ocr_screen.py'
];

for (const file of pythonFiles) {
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Python file missing (may be optional): ${file}`);
  } else {
    console.log(`✅ Found: ${file}`);
  }
}

console.log('✅ All critical files verified!');
console.log('🎉 Build process completed successfully!');
console.log('');
console.log('Next steps:');
if (platform === 'win32') {
  console.log('  • Run "npm run dist:win-installer" to create Windows installer');
  console.log('  • Run "npm run dist:win-portable" to create portable executable');
} else if (platform === 'darwin') {
  console.log('  • Run "npm run dist:mac" to create macOS DMG');
} else {
  console.log('  • Run "npm run dist" to create distribution');
}
console.log('  • Run "npm run pack" to create unpacked distribution');
