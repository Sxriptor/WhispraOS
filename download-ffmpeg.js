/**
 * Download FFmpeg for macOS
 * Downloads FFmpeg static builds and extracts them to ffmpeg/mac/
 * This allows PyAV to find FFmpeg libraries during installation
 * 
 * Note: PyAV requires FFmpeg development libraries (headers and pkg-config files)
 * for compilation. If pre-built PyAV wheels are not available, you may need
 * to install FFmpeg via Homebrew: brew install ffmpeg
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FFMPEG_VERSION = '7.0';
const BASE_URL = 'https://evermeet.cx/ffmpeg';
const OUTPUT_DIR = path.join(__dirname, 'ffmpeg', 'mac');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Download a file from URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`✓ Downloaded ${path.basename(outputPath)}`);
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded ${path.basename(outputPath)}`);
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * Check if FFmpeg is already downloaded
 */
function isFFmpegDownloaded() {
  const ffmpegBin = path.join(OUTPUT_DIR, 'ffmpeg');
  const ffprobeBin = path.join(OUTPUT_DIR, 'ffprobe');
  return fs.existsSync(ffmpegBin) && fs.existsSync(ffprobeBin);
}

/**
 * Make binaries executable
 */
function makeExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch (err) {
    console.warn(`Warning: Could not make ${filePath} executable:`, err.message);
  }
}

/**
 * Copy directory recursively
 */
function copyRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

/**
 * Try to copy FFmpeg from Homebrew (includes dev files)
 */
function tryCopyFromHomebrew() {
  try {
    console.log('Attempting to copy FFmpeg from Homebrew (includes development files)...');
    const brewPrefix = execSync('brew --prefix', { encoding: 'utf8' }).trim();
    const brewFFmpeg = path.join(brewPrefix, 'opt', 'ffmpeg');
    
    if (!fs.existsSync(brewFFmpeg)) {
      console.log('FFmpeg not found in Homebrew. Install it with: brew install ffmpeg');
      return false;
    }
    
    console.log(`Found Homebrew FFmpeg at: ${brewFFmpeg}`);
    
    // Copy bin directory
    const binSrc = path.join(brewFFmpeg, 'bin');
    const binDst = path.join(OUTPUT_DIR, 'bin');
    if (fs.existsSync(binSrc)) {
      copyRecursive(binSrc, binDst);
      // Make binaries executable
      const files = fs.readdirSync(binDst);
      files.forEach(file => {
        const filePath = path.join(binDst, file);
        if (fs.statSync(filePath).isFile()) {
          makeExecutable(filePath);
        }
      });
      console.log('✓ Copied FFmpeg binaries');
    }
    
    // Copy lib directory (needed for PyAV compilation)
    const libSrc = path.join(brewFFmpeg, 'lib');
    const libDst = path.join(OUTPUT_DIR, 'lib');
    if (fs.existsSync(libSrc)) {
      copyRecursive(libSrc, libDst);
      console.log('✓ Copied FFmpeg libraries');
    }
    
    // Copy include directory (headers needed for PyAV compilation)
    const includeSrc = path.join(brewFFmpeg, 'include');
    const includeDst = path.join(OUTPUT_DIR, 'include');
    if (fs.existsSync(includeSrc)) {
      copyRecursive(includeSrc, includeDst);
      console.log('✓ Copied FFmpeg headers');
    }
    
    // Create symlinks for ffmpeg and ffprobe in root (for compatibility)
    const ffmpegBin = path.join(OUTPUT_DIR, 'bin', 'ffmpeg');
    const ffprobeBin = path.join(OUTPUT_DIR, 'bin', 'ffprobe');
    const ffmpegLink = path.join(OUTPUT_DIR, 'ffmpeg');
    const ffprobeLink = path.join(OUTPUT_DIR, 'ffprobe');
    
    if (fs.existsSync(ffmpegBin) && !fs.existsSync(ffmpegLink)) {
      try {
        fs.symlinkSync('bin/ffmpeg', ffmpegLink);
      } catch (err) {
        // If symlink fails, copy instead
        fs.copyFileSync(ffmpegBin, ffmpegLink);
        makeExecutable(ffmpegLink);
      }
    }
    if (fs.existsSync(ffprobeBin) && !fs.existsSync(ffprobeLink)) {
      try {
        fs.symlinkSync('bin/ffprobe', ffprobeLink);
      } catch (err) {
        // If symlink fails, copy instead
        fs.copyFileSync(ffprobeBin, ffprobeLink);
        makeExecutable(ffprobeLink);
      }
    }
    
    return true;
  } catch (error) {
    console.log('Could not copy from Homebrew:', error.message);
    return false;
  }
}

/**
 * Main download function
 */
async function downloadFFmpeg() {
  if (isFFmpegDownloaded()) {
    console.log('FFmpeg already downloaded. Skipping...');
    return;
  }

  console.log('Downloading FFmpeg for macOS...');
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // First, try to copy from Homebrew (includes dev files needed for PyAV)
  if (tryCopyFromHomebrew()) {
    console.log('✓ Successfully copied FFmpeg from Homebrew!');
    console.log(`  Location: ${OUTPUT_DIR}`);
    console.log('  Note: This includes development files needed for PyAV compilation.');
    return;
  }

  // Fallback: Download static binaries (may not work for PyAV compilation)
  console.log('\nHomebrew FFmpeg not available. Downloading static binaries...');
  console.log('WARNING: Static binaries may not include development files needed for PyAV.');
  console.log('If PyAV installation fails, install FFmpeg via Homebrew: brew install ffmpeg\n');

  try {
    // Download FFmpeg binary
    const ffmpegUrl = `${BASE_URL}/ffmpeg-${FFMPEG_VERSION}.zip`;
    const ffmpegZipPath = path.join(OUTPUT_DIR, 'ffmpeg.zip');
    
    await downloadFile(ffmpegUrl, ffmpegZipPath);

    // Extract zip file
    console.log('Extracting FFmpeg...');
    try {
      // Use unzip command (available on macOS)
      execSync(`cd "${OUTPUT_DIR}" && unzip -o ffmpeg.zip`, { stdio: 'inherit' });
      
      // Clean up zip file
      fs.unlinkSync(ffmpegZipPath);
      
      // Make binaries executable
      const ffmpegBin = path.join(OUTPUT_DIR, 'ffmpeg');
      const ffprobeBin = path.join(OUTPUT_DIR, 'ffprobe');
      
      if (fs.existsSync(ffmpegBin)) {
        makeExecutable(ffmpegBin);
      }
      if (fs.existsSync(ffprobeBin)) {
        makeExecutable(ffprobeBin);
      }
      
      console.log('✓ FFmpeg downloaded and extracted successfully!');
      console.log(`  Location: ${OUTPUT_DIR}`);
      console.log('\n⚠️  Note: Static binaries may not include development files.');
      console.log('If PyAV installation fails, install FFmpeg via Homebrew: brew install ffmpeg');
    } catch (extractError) {
      console.error('Error extracting FFmpeg:', extractError);
      throw extractError;
    }
  } catch (error) {
    console.error('Error downloading FFmpeg:', error);
    console.log('\nAlternative: Install FFmpeg using Homebrew:');
    console.log('  brew install ffmpeg');
    console.log('Then run this script again to copy it to:', OUTPUT_DIR);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  downloadFFmpeg().catch((error) => {
    console.error('Failed to download FFmpeg:', error);
    process.exit(1);
  });
}

module.exports = { downloadFFmpeg };
