/**
 * LanguageTool JRE Setup Script
 * Automatically downloads and sets up Java 17 minimal runtime
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const zlib = require('zlib');
const extractZip = require('extract-zip');

const GRAMMAR_DIR = path.join(__dirname, '..', 'resources', 'engines', 'grammar');
const RUNTIME_DIR = path.join(GRAMMAR_DIR, 'runtime');
const RUNTIME_BIN = path.join(RUNTIME_DIR, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');

// Adoptium API for downloading JDK
const ADOPTIUM_API = 'https://api.adoptium.net/v3';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    console.log(`📥 Downloading ${url}...`);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r📥 Progress: ${percent}%`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          // Wait a moment for file handle to be fully released
          setTimeout(() => {
            console.log('\n✅ Download complete');
            resolve();
          }, 500);
        });
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function getJDKDownloadUrl() {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch === 'x64' ? 'x64' : 'x86';
  
  const url = `${ADOPTIUM_API}/assets/feature_releases/17/ga?os=${os}&architecture=${arch}&image_type=jdk&jvm_impl=hotspot&page_size=1`;
  
  console.log(`🔍 Querying Adoptium API: ${url}`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`📋 API Response: ${JSON.stringify(json).substring(0, 500)}`);
          
          if (json.length > 0) {
            const asset = json[0];
            // API structure: asset.binaries[0].package
            if (asset.binaries && asset.binaries.length > 0) {
              const binary = asset.binaries[0];
              const packageInfo = binary.package;
              
              if (packageInfo && packageInfo.link) {
                resolve({
                  url: packageInfo.link,
                  name: packageInfo.name || packageInfo.link.split('/').pop() || 'jdk-17.zip',
                  size: packageInfo.size || 0
                });
              } else {
                console.error('❌ No package.link found in binary');
                reject(new Error('No package download link found in API response'));
              }
            } else {
              console.error('❌ No binaries found in asset');
              reject(new Error('No binaries found in API response'));
            }
          } else {
            reject(new Error('No JDK 17 found in API response'));
          }
        } catch (err) {
          console.error('❌ Failed to parse API response:', err);
          console.error('Response data:', data.substring(0, 500));
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function extractJDK(archivePath, extractDir) {
  console.log('📦 Extracting JDK...');
  
  // Wait a moment to ensure file handle is released
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (archivePath.endsWith('.zip')) {
    // Use extract-zip library (cross-platform, avoids file locking issues)
    try {
      await extractZip(archivePath, { dir: extractDir });
      console.log('✅ ZIP extraction complete');
    } catch (err) {
      throw new Error(`Failed to extract ZIP: ${err.message}`);
    }
  } else if (archivePath.endsWith('.tar.gz')) {
    // Unix - use system tar command
    try {
      execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
    } catch (err) {
      throw new Error(`Failed to extract tar.gz: ${err.message}`);
    }
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
  
  // Wait a moment for extraction to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Find the JDK directory (usually jdk-17.x.x or similar)
  const entries = fs.readdirSync(extractDir);
  const jdkDir = entries.find(e => e.startsWith('jdk') || e.includes('jdk'));
  if (!jdkDir) {
    console.error(`   Available entries: ${entries.join(', ')}`);
    throw new Error('Could not find JDK directory in archive');
  }
  
  console.log(`✅ Found JDK directory: ${jdkDir}`);
  return path.join(extractDir, jdkDir);
}

async function createMinimalRuntime(jdkPath) {
  console.log('🔨 Creating minimal JRE with jlink...');
  
  const jlinkPath = path.join(jdkPath, 'bin', process.platform === 'win32' ? 'jlink.exe' : 'jlink');
  const jmodsPath = path.join(jdkPath, 'jmods');
  
  if (!fs.existsSync(jlinkPath)) {
    throw new Error(`jlink not found at ${jlinkPath}`);
  }
  
  // Check if runtime directory exists
  if (fs.existsSync(RUNTIME_DIR)) {
    console.log('⚠️  Runtime directory already exists');
    
    // Check if it's a valid runtime (has java.exe)
    if (fs.existsSync(RUNTIME_BIN)) {
      console.log('✅ Valid Java runtime already exists, skipping creation');
      return;
    }
    
    // Directory exists but is incomplete, remove it
    console.log('🗑️  Removing incomplete runtime directory...');
    try {
      // Wait a moment to ensure no file handles are open
      await new Promise(resolve => setTimeout(resolve, 500));
      fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
      // Wait again after removal to ensure filesystem is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Removed incomplete runtime directory');
    } catch (error) {
      console.error(`⚠️  Error removing directory: ${error.message}`);
      console.error('💡 Please manually delete: resources/engines/grammar/runtime');
      throw new Error(`Failed to remove existing runtime directory: ${error.message}`);
    }
  }
  
  // Double-check directory doesn't exist before jlink (jlink creates it)
  // Don't create it manually - jlink will create it
  if (fs.existsSync(RUNTIME_DIR)) {
    throw new Error(`Runtime directory still exists after removal attempt: ${RUNTIME_DIR}`);
  }
  
  // Run jlink
  const jlinkCmd = `"${jlinkPath}" --module-path "${jmodsPath}" --add-modules java.base,java.logging,java.xml,java.net.http,jdk.httpserver,java.naming --output "${RUNTIME_DIR}" --strip-debug --compress=2 --no-header-files --no-man-pages`;
  
  console.log(`📋 Running jlink command...`);
  console.log(`   ${jlinkCmd}`);
  
  try {
    const result = execSync(jlinkCmd, { 
      stdio: 'pipe',
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // jlink doesn't output much on success, but check for errors in output
    if (result) {
      console.log(result);
    }
    
    console.log('✅ Minimal JRE created successfully');
  } catch (err) {
    // Capture stderr output
    const errorOutput = err.stderr ? err.stderr.toString() : err.message;
    const stdoutOutput = err.stdout ? err.stdout.toString() : '';
    
    console.error('❌ jlink command failed!');
    if (stdoutOutput) {
      console.error('STDOUT:', stdoutOutput);
    }
    if (errorOutput) {
      console.error('STDERR:', errorOutput);
    }
    
    throw new Error(`jlink failed: ${errorOutput || err.message}`);
  }
}

async function setupJavaRuntime() {
  // Check if runtime already exists and is valid
  if (fs.existsSync(RUNTIME_BIN)) {
    console.log('✅ Java runtime already exists, skipping setup');
    return;
  }
  
  // Check if runtime directory exists but is incomplete
  if (fs.existsSync(RUNTIME_DIR)) {
    console.log('⚠️  Runtime directory exists but java.exe not found');
    console.log('🗑️  Removing incomplete runtime directory...');
    try {
      fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
      console.log('✅ Removed incomplete runtime directory');
    } catch (error) {
      console.error(`⚠️  Could not remove existing directory: ${error.message}`);
      console.error('💡 Please manually delete: resources/engines/grammar/runtime');
      throw new Error('Existing runtime directory could not be removed');
    }
  }
  
  console.log('🚀 Setting up Java 17 runtime for LanguageTool...\n');
  
  const tempDir = path.join(__dirname, '..', 'temp-jdk-setup');
  
  try {
    // Step 1: Get JDK download URL
    console.log('🔍 Finding JDK 17 download...');
    const jdkInfo = await getJDKDownloadUrl();
    console.log(`📋 Found: ${jdkInfo.name} (${(jdkInfo.size / 1024 / 1024).toFixed(0)} MB)\n`);
    
    // Step 2: Download JDK
    const archivePath = path.join(tempDir, jdkInfo.name);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    await downloadFile(jdkInfo.url, archivePath);
    console.log('');
    
    // Wait for file handle to be fully released
    console.log('⏳ Waiting for file handle to be released...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Extract JDK
    const extractDir = path.join(tempDir, 'extracted');
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    const jdkPath = await extractJDK(archivePath, extractDir);
    console.log(`✅ JDK extracted to: ${jdkPath}\n`);
    
    // Step 4: Create minimal runtime
    await createMinimalRuntime(jdkPath);
    
    // Step 5: Cleanup
    console.log('\n🧹 Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Verify runtime
    if (fs.existsSync(RUNTIME_BIN)) {
      const stats = fs.statSync(RUNTIME_BIN);
      console.log(`\n✅ Setup complete! Runtime size: ${(getDirSize(RUNTIME_DIR) / 1024 / 1024).toFixed(2)} MB`);
    } else {
      throw new Error('Runtime creation failed - java.exe not found');
    }
    
  } catch (error) {
    console.error(`\n❌ Error setting up Java runtime: ${error.message}`);
    console.error('\n💡 Alternative: Run setup-jre.ps1 manually or install JDK 17 and run jlink yourself.');
    console.error('   See resources/engines/grammar/SETUP_JRE.md for instructions.');
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}

function getDirSize(dirPath) {
  let size = 0;
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stats.size;
    }
  }
  
  return size;
}

// Run if called directly
if (require.main === module) {
  setupJavaRuntime().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { setupJavaRuntime };

