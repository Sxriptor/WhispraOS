const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Copy the entire renderer directory structure from dist/renderer/renderer to dist/renderer
// This ensures all imports like ./renderer/eventListeners.js work correctly
const srcDir = 'dist/renderer/renderer';
const dstDir = 'dist/renderer';

if (fs.existsSync(srcDir)) {
  // Copy all files and directories recursively
  execSync(`shx cp -R "${srcDir}"/* "${dstDir}/"`, { stdio: 'inherit' });
  console.log('✅ Copied all renderer modules');
} else {
  console.warn(`⚠️ Source directory ${srcDir} not found - skipping copy`);
}

