const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const platform = process.platform;
const electronVersion = '28.0.0';
const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';

if (platform === 'win32') {
  // Build WASAPI addon on Windows
  console.log(`🔧 Building native WASAPI addon for ${arch} architecture...`);
  const addonDir = path.join(__dirname, 'native-wasapi-loopback');
  const command = `node-gyp rebuild --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers --runtime=electron`;
  process.chdir(addonDir);
  execSync(command, { stdio: 'inherit' });
  console.log('✅ WASAPI addon built successfully');
} else if (platform === 'darwin') {
  // Build CoreAudio addon on macOS
  console.log(`🔧 Building native CoreAudio addon for ${arch} architecture...`);
  const addonDir = path.join(__dirname, 'native-coreaudio-loopback');
  const command = `node-gyp rebuild --target=${electronVersion} --arch=${arch} --dist-url=https://electronjs.org/headers --runtime=electron`;
  process.chdir(addonDir);
  execSync(command, { stdio: 'inherit' });
  console.log('✅ CoreAudio addon built successfully');
} else {
  console.log(`ℹ️  Skipping native addon build (not supported on platform: ${platform})`);
  process.exit(0);
}

