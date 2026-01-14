/**
 * Script to install Argos .argosmodel files
 * Run with: node install-argos-models.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function installArgosModels() {
    console.log('🔧 Installing Argos Language Models...\n');
    
    // Get paths
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const argosPath = path.join(appDataPath, 'whispra', 'models', 'argos');
    const packagesPath = path.join(appDataPath, 'whispra', 'models', 'argos', 'packages');
    const embeddedPythonExe = path.join(process.cwd(), 'python', 'python.exe');
    
    console.log('📁 Paths:');
    console.log(`   Argos Directory: ${argosPath}`);
    console.log(`   Packages Directory: ${packagesPath}`);
    console.log(`   Embedded Python: ${embeddedPythonExe}\n`);
    
    // Check if packages directory exists
    if (!fs.existsSync(packagesPath)) {
        console.log('❌ Packages directory does not exist');
        return;
    }
    
    // Get all .argosmodel files
    const modelFiles = fs.readdirSync(packagesPath).filter(file => file.endsWith('.argosmodel'));
    
    if (modelFiles.length === 0) {
        console.log('❌ No .argosmodel files found');
        return;
    }
    
    console.log(`📦 Found ${modelFiles.length} model files:`);
    modelFiles.forEach(file => console.log(`   📄 ${file}`));
    console.log('');
    
    // Install each model file
    for (const modelFile of modelFiles) {
        const modelPath = path.join(packagesPath, modelFile);
        console.log(`🔧 Installing ${modelFile}...`);
        
        const script = `
import sys
import os

# Add Argos packages to Python path
argos_path = r"${argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    
    # Install the model
    model_path = r"${modelPath.replace(/\\/g, '\\\\')}"
    print(f"Installing model from: {model_path}")
    
    package.install_from_path(model_path)
    print(f"[OK] Successfully installed {model_path}")
    
except Exception as e:
    print(f"[ERROR] Failed to install model: {e}")
    sys.exit(1)
`;

        const success = await runPythonScript(embeddedPythonExe, script, argosPath, packagesPath);
        if (success) {
            console.log(`   ✅ ${modelFile} installed successfully`);
        } else {
            console.log(`   ❌ ${modelFile} installation failed`);
        }
    }
    
    // Test if models are now recognized
    console.log('\n🧪 Testing installed packages...');
    const testScript = `
import sys
import os

# Add Argos packages to Python path
argos_path = r"${argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    
    # Update package index and get installed packages
    package.update_package_index()
    installed_packages = package.get_installed_packages()
    
    print(f"[OK] Found {len(installed_packages)} installed packages")
    
    for pkg in installed_packages:
        print(f"   - {pkg.from_code} -> {pkg.to_code}")
    
    # Test a translation
    if len(installed_packages) > 0:
        import argostranslate.translate as translate
        result = translate.translate("Hello", "en", "es")
        print(f"[OK] Test translation: 'Hello' -> '{result}'")
    
except Exception as e:
    print(f"[ERROR] Test failed: {e}")
    sys.exit(1)
`;

    const testSuccess = await runPythonScript(embeddedPythonExe, testScript, argosPath, packagesPath);
    if (testSuccess) {
        console.log('\n🎉 All models installed and working!');
    } else {
        console.log('\n❌ Installation test failed');
    }
}

function runPythonScript(pythonExe, script, argosPath, packagesPath) {
    return new Promise((resolve) => {
        const tempScriptPath = path.join(process.cwd(), `temp_install_${Date.now()}.py`);
        
        try {
            fs.writeFileSync(tempScriptPath, script);
            
            const childProcess = spawn(pythonExe, [tempScriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
                env: {
                    ...process.env,
                    PYTHONPATH: argosPath,
                    ARGOS_TRANSLATE_PACKAGE_DIR: packagesPath
                }
            });

            let output = '';
            let errorOutput = '';

            childProcess.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            });

            childProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                process.stderr.write(text);
            });

            childProcess.on('close', (code) => {
                try {
                    fs.unlinkSync(tempScriptPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
                resolve(code === 0);
            });

            childProcess.on('error', (error) => {
                try {
                    fs.unlinkSync(tempScriptPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
                console.error(`Process error: ${error.message}`);
                resolve(false);
            });
        } catch (error) {
            console.error(`Script error: ${error.message}`);
            resolve(false);
        }
    });
}

// Run the installation
installArgosModels().catch(console.error);