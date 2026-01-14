const fs = require('fs');
const path = require('path');

const platform = process.platform;

let buildPath, destPath, addonName;

if (platform === 'win32') {
  // Windows: Copy WASAPI addon
  addonName = 'wasapi_loopback.node';
  buildPath = path.join('native-wasapi-loopback', 'build', 'Release', addonName);
  destPath = path.join('dist', addonName);
} else if (platform === 'darwin') {
  // macOS: Copy CoreAudio addon
  addonName = 'coreaudio_loopback.node';
  buildPath = path.join('native-coreaudio-loopback', 'build', 'Release', addonName);
  destPath = path.join('dist', addonName);
} else {
  console.log(`ℹ️  Skipping addon copy (not supported on platform: ${platform})`);
  process.exit(0);
}

if (fs.existsSync(buildPath)) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(buildPath, destPath);
  console.log(`✅ Copied ${platform === 'win32' ? 'WASAPI' : 'CoreAudio'} addon from ${buildPath} to ${destPath}`);
} else {
  console.warn(`⚠️ Addon not found at ${buildPath} - skipping copy`);
  console.warn(`   Make sure you've run 'npm run build:addon' first`);
}

