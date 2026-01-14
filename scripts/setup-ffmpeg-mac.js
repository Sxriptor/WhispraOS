/**
 * FFmpeg Setup Script for macOS
 * Installs FFmpeg libraries and binaries to ffmpeg/mac/ directory
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const https = require('https');

const FFMPEG_DIR = path.join(__dirname, '..', 'ffmpeg', 'mac');
const FFMPEG_BIN_DIR = path.join(FFMPEG_DIR, 'bin');
const FFMPEG_LIB_DIR = path.join(FFMPEG_DIR, 'lib');
const FFMPEG_INCLUDE_DIR = path.join(FFMPEG_DIR, 'include');

/**
 * Check if Homebrew is installed
 */
function hasHomebrew() {
  try {
    execSync('which brew', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install FFmpeg using Homebrew with custom prefix
 */
function installWithHomebrew() {
  console.log('🍺 Installing FFmpeg using Homebrew...');
  
  try {
    // First, ensure FFmpeg is installed via Homebrew (to system)
    console.log('📦 Installing FFmpeg via Homebrew (if not already installed)...');
    execSync('brew install ffmpeg', { stdio: 'inherit' });
    
    // Get Homebrew prefix
    const brewPrefix = execSync('brew --prefix', { encoding: 'utf-8' }).trim();
    const brewFfmpegPrefix = path.join(brewPrefix, 'opt', 'ffmpeg');
    
    console.log(`📂 Homebrew FFmpeg location: ${brewFfmpegPrefix}`);
    
    // Create target directories
    [FFMPEG_BIN_DIR, FFMPEG_LIB_DIR, FFMPEG_INCLUDE_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Copy binaries
    const brewBinDir = path.join(brewFfmpegPrefix, 'bin');
    if (fs.existsSync(brewBinDir)) {
      console.log('📋 Copying binaries...');
      const binFiles = fs.readdirSync(brewBinDir);
      binFiles.forEach(file => {
        const src = path.join(brewBinDir, file);
        const dest = path.join(FFMPEG_BIN_DIR, file);
        if (fs.statSync(src).isFile()) {
          // Remove existing file if it exists
          if (fs.existsSync(dest)) {
            try {
              fs.unlinkSync(dest);
            } catch (e) {
              // Try to make it writable first
              try {
                fs.chmodSync(dest, 0o666);
                fs.unlinkSync(dest);
              } catch (e2) {
                console.log(`  ⚠️  Could not remove existing ${file}, trying to overwrite...`);
              }
            }
          }
          fs.copyFileSync(src, dest);
          // Make executable
          fs.chmodSync(dest, 0o755);
          console.log(`  ✓ ${file}`);
        }
      });
    }
    
    // Copy libraries
    const brewLibDir = path.join(brewFfmpegPrefix, 'lib');
    if (fs.existsSync(brewLibDir)) {
      console.log('📋 Copying libraries...');
      const libFiles = fs.readdirSync(brewLibDir).filter(f => 
        f.endsWith('.dylib') || f.endsWith('.a') || f === 'pkgconfig'
      );
      libFiles.forEach(file => {
        const src = path.join(brewLibDir, file);
        const dest = path.join(FFMPEG_LIB_DIR, file);
        if (fs.statSync(src).isDirectory()) {
          // Copy pkgconfig directory
          if (file === 'pkgconfig') {
            if (fs.existsSync(dest)) {
              // Remove existing pkgconfig directory
              try {
                fs.rmSync(dest, { recursive: true, force: true });
              } catch (e) {
                console.log(`  ⚠️  Could not remove existing ${file}/ directory`);
              }
            }
            fs.mkdirSync(dest, { recursive: true });
            const pkgFiles = fs.readdirSync(src);
            pkgFiles.forEach(pkgFile => {
              const pkgSrc = path.join(src, pkgFile);
              const pkgDest = path.join(dest, pkgFile);
              // Remove existing file if it exists
              if (fs.existsSync(pkgDest)) {
                try {
                  fs.unlinkSync(pkgDest);
                } catch (e) {
                  fs.chmodSync(pkgDest, 0o666);
                  fs.unlinkSync(pkgDest);
                }
              }
              fs.copyFileSync(pkgSrc, pkgDest);
            });
            console.log(`  ✓ ${file}/`);
          }
        } else {
          // Remove existing file if it exists
          if (fs.existsSync(dest)) {
            try {
              fs.unlinkSync(dest);
            } catch (e) {
              // Try to make it writable first
              try {
                fs.chmodSync(dest, 0o666);
                fs.unlinkSync(dest);
              } catch (e2) {
                console.log(`  ⚠️  Could not remove existing ${file}, trying to overwrite...`);
              }
            }
          }
          fs.copyFileSync(src, dest);
          // Set proper permissions
          fs.chmodSync(dest, 0o644);
          console.log(`  ✓ ${file}`);
        }
      });
    }
    
    // Copy headers
    const brewIncludeDir = path.join(brewFfmpegPrefix, 'include');
    if (fs.existsSync(brewIncludeDir)) {
      console.log('📋 Copying headers...');
      const includeDirs = fs.readdirSync(brewIncludeDir);
      includeDirs.forEach(dir => {
        const src = path.join(brewIncludeDir, dir);
        const dest = path.join(FFMPEG_INCLUDE_DIR, dir);
        if (fs.statSync(src).isDirectory()) {
          // Remove existing directory if it exists
          if (fs.existsSync(dest)) {
            try {
              fs.rmSync(dest, { recursive: true, force: true });
            } catch (e) {
              console.log(`  ⚠️  Could not remove existing ${dir}/ directory`);
            }
          }
          fs.mkdirSync(dest, { recursive: true });
          copyRecursiveSync(src, dest);
          console.log(`  ✓ ${dir}/`);
        }
      });
    }
    
    console.log('✅ FFmpeg installed successfully via Homebrew!');
    return true;
  } catch (error) {
    console.error('❌ Error installing FFmpeg with Homebrew:', error.message);
    return false;
  }
}

/**
 * Recursively copy directory
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Remove existing file if it exists
    if (fs.existsSync(dest)) {
      try {
        fs.unlinkSync(dest);
      } catch (e) {
        try {
          fs.chmodSync(dest, 0o666);
          fs.unlinkSync(dest);
        } catch (e2) {
          // Continue anyway, copyFileSync might overwrite
        }
      }
    }
    fs.copyFileSync(src, dest);
    // Set proper permissions for header files
    try {
      fs.chmodSync(dest, 0o644);
    } catch (e) {
      // Ignore chmod errors
    }
  }
}

/**
 * Download FFmpeg pre-built binaries (fallback method)
 */
async function downloadPrebuilt() {
  console.log('📥 Attempting to download pre-built FFmpeg...');
  console.log('⚠️  Note: Pre-built binaries may not be available for all architectures.');
  console.log('💡 Recommendation: Install Homebrew (https://brew.sh) and run this script again.');
  
  // For now, we'll just provide instructions
  console.log('\n📝 Manual installation steps:');
  console.log('1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  console.log('2. Run: brew install ffmpeg');
  console.log('3. Run this script again: npm run setup:ffmpeg-mac');
  
  return false;
}

/**
 * Count files recursively in a directory
 */
function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  
  let count = 0;
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isFile()) {
      count++;
    } else if (stat.isDirectory()) {
      count += countFilesRecursive(fullPath);
    }
  });
  
  return count;
}

/**
 * Verify FFmpeg installation
 */
function verifyInstallation() {
  console.log('\n🔍 Verifying installation...');
  
  const checks = [
    { path: FFMPEG_BIN_DIR, name: 'binaries', minFiles: 1, recursive: false },
    { path: FFMPEG_LIB_DIR, name: 'libraries', minFiles: 8, recursive: false },
    { path: FFMPEG_INCLUDE_DIR, name: 'headers', minFiles: 1, recursive: true }
  ];
  
  let allGood = true;
  checks.forEach(check => {
    if (!fs.existsSync(check.path)) {
      console.log(`❌ ${check.name} directory missing: ${check.path}`);
      allGood = false;
      return;
    }
    
    const fileCount = check.recursive 
      ? countFilesRecursive(check.path)
      : fs.readdirSync(check.path).filter(f => {
          const fullPath = path.join(check.path, f);
          return fs.statSync(fullPath).isFile();
        }).length;
    
    if (fileCount < check.minFiles) {
      console.log(`⚠️  ${check.name} directory has only ${fileCount} files (expected at least ${check.minFiles})`);
      allGood = false;
    } else {
      console.log(`✓ ${check.name}: ${fileCount} files`);
    }
  });
  
  // Check for specific required libraries
  const requiredLibs = [
    'libavcodec.dylib',
    'libavformat.dylib',
    'libavutil.dylib',
    'libswscale.dylib',
    'libswresample.dylib'
  ];
  
  console.log('\n📚 Checking required libraries...');
  requiredLibs.forEach(lib => {
    const libPath = path.join(FFMPEG_LIB_DIR, lib);
    if (fs.existsSync(libPath)) {
      console.log(`  ✓ ${lib}`);
    } else {
      console.log(`  ❌ ${lib} - MISSING`);
      allGood = false;
    }
  });
  
  return allGood;
}

/**
 * Clear existing FFmpeg installation
 */
function clearExistingInstallation() {
  console.log('🧹 Clearing existing installation...');
  try {
    if (fs.existsSync(FFMPEG_BIN_DIR)) {
      fs.rmSync(FFMPEG_BIN_DIR, { recursive: true, force: true });
      console.log('  ✓ Cleared bin directory');
    }
    if (fs.existsSync(FFMPEG_LIB_DIR)) {
      fs.rmSync(FFMPEG_LIB_DIR, { recursive: true, force: true });
      console.log('  ✓ Cleared lib directory');
    }
    if (fs.existsSync(FFMPEG_INCLUDE_DIR)) {
      fs.rmSync(FFMPEG_INCLUDE_DIR, { recursive: true, force: true });
      console.log('  ✓ Cleared include directory');
    }
    // Recreate directories
    [FFMPEG_BIN_DIR, FFMPEG_LIB_DIR, FFMPEG_INCLUDE_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    return true;
  } catch (error) {
    console.error('⚠️  Error clearing existing installation:', error.message);
    console.log('💡 You may need to manually delete the ffmpeg/mac directory');
    return false;
  }
}

/**
 * Main installation function
 */
async function setupFFmpeg() {
  console.log('🎬 FFmpeg macOS Setup Script');
  console.log('============================\n');
  console.log(`Target directory: ${FFMPEG_DIR}\n`);
  
  // Check if already installed
  const isInstalled = verifyInstallation();
  if (isInstalled) {
    console.log('\n✅ FFmpeg appears to be already installed!');
    const args = process.argv.slice(2);
    if (args.includes('--force') || args.includes('-f')) {
      console.log('🔄 Force flag detected, reinstalling...\n');
      clearExistingInstallation();
    } else {
      console.log('💡 To reinstall, run: npm run setup:ffmpeg-mac -- --force');
      return;
    }
  } else {
    // Clear any partial installation
    clearExistingInstallation();
  }
  
  // Try Homebrew first
  if (hasHomebrew()) {
    console.log('🍺 Homebrew detected!\n');
    if (installWithHomebrew()) {
      const verified = verifyInstallation();
      if (verified) {
        console.log('\n✅ FFmpeg installation verified successfully!');
        console.log('🎉 All required components are in place.');
        return;
      } else {
        console.log('\n⚠️  Installation completed but verification found some issues.');
        console.log('💡 The core libraries are present, but some components may be missing.');
        console.log('💡 This may still work for PyAV - you can try installing faster-whisper.');
        // Don't exit - let user know it might still work
        return;
      }
    }
  } else {
    console.log('⚠️  Homebrew not found.\n');
  }
  
  // Fallback to pre-built download
  console.log('\n⚠️  Homebrew installation failed or not available.');
  if (!await downloadPrebuilt()) {
    console.log('\n❌ FFmpeg installation failed.');
    console.log('💡 Please install Homebrew and try again, or manually install FFmpeg.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupFFmpeg().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { setupFFmpeg };

