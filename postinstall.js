const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Post-install: Building native WASAPI addon...');

try {
  // Check if we're on Windows
  if (process.platform === 'win32') {
    // Build the native addon
    const electronVersion = require('./package.json').devDependencies.electron.replace('^', '');
    const addonCommand = `cd native-wasapi-loopback && node-gyp rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`;
    
    console.log(`Building for Electron version: ${electronVersion}`);
    execSync(addonCommand, { stdio: 'inherit' });
    
    // Copy to dist if it exists
    if (fs.existsSync('dist')) {
      execSync('npm run copy-addon', { stdio: 'inherit' });
    }
    
    console.log('✅ Native addon built successfully!');
  } else {
    console.log('⚠️  Native addon build skipped (not on Windows)');
  }
} catch (error) {
  console.error('❌ Failed to build native addon:', error.message);
  console.log('💡 You can manually build it later with: npm run build:addon');
}

// Setup Java runtime for LanguageTool (optional, non-blocking)
console.log('\n🔧 Post-install: Checking Java runtime for LanguageTool...');
try {
  const runtimePath = path.join(__dirname, 'resources', 'engines', 'grammar', 'runtime', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  
  if (!fs.existsSync(runtimePath)) {
    console.log('📝 Java runtime not found.');
    console.log('💡 Run once to download and embed: npm run setup:java-runtime');
    console.log('💡 Then commit resources/engines/grammar/runtime/ to your repo');
    console.log('💡 After that, it will be embedded in source code for everyone');
  } else {
    console.log('✅ Java runtime found (embedded in source code)');
  }
} catch (error) {
  console.log('⚠️  Java runtime check failed (non-critical):', error.message);
}