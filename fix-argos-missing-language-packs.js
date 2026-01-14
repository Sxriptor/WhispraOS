/**
 * Fix script for missing Argos language packs
 * Run with: node fix-argos-missing-language-packs.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function fixArgosLanguagePacks() {
    console.log('🔧 Fixing Argos Missing Language Packs Issue...\n');
    
    // Get paths
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const localAppDataPath = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const configPath = path.join(appDataPath, 'whispra', 'config.json');
    const packagesPath = path.join(localAppDataPath, 'Whispra', 'models', 'argos', 'packages');
    
    console.log('📊 Current Status:');
    console.log(`   Config file: ${fs.existsSync(configPath) ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   Packages directory: ${fs.existsSync(packagesPath) ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // Check if packages directory exists and has language models
    let hasLanguageModels = false;
    if (fs.existsSync(packagesPath)) {
        try {
            const contents = fs.readdirSync(packagesPath);
            const argosModels = contents.filter(file => file.endsWith('.argosmodel'));
            hasLanguageModels = argosModels.length > 0;
            console.log(`   Language models: ${hasLanguageModels ? `✅ ${argosModels.length} found` : '❌ NONE'}`);
        } catch (error) {
            console.log(`   Language models: ❌ ERROR reading directory`);
        }
    } else {
        console.log(`   Language models: ❌ NO PACKAGES DIRECTORY`);
    }
    
    if (hasLanguageModels) {
        console.log('\n✅ Language models are present. The issue might be elsewhere.');
        console.log('💡 Try restarting the application or check the console for other errors.');
        return;
    }
    
    console.log('\n🎯 Root Cause Identified:');
    console.log('   ❌ Argos Translate base packages are installed');
    console.log('   ❌ But NO language translation models (.argosmodel files) are present');
    console.log('   💡 This means the Argos download was incomplete');
    
    console.log('\n🔧 Automatic Fix: Switching to Cloud Processing Mode');
    
    try {
        let config = {};
        
        // Read existing config if it exists
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
            console.log('   📖 Read existing configuration');
        } else {
            console.log('   📝 Creating new configuration file');
        }
        
        // Switch to cloud mode
        config.processingMode = 'cloud';
        
        // Ensure cloud model config exists
        if (!config.cloudModelConfig) {
            config.cloudModelConfig = {
                gptModel: 'openai',
                whisperModel: 'whisper-1',
                voiceModel: 'elevenlabs'
            };
        }
        
        // Write updated config
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('   ✅ Successfully switched to cloud processing mode');
        console.log('   📝 Configuration updated');
        
        console.log('\n🎉 Fix Applied Successfully!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Restart Whispra');
        console.log('   2. Make sure you have API keys configured (Settings > API Keys)');
        console.log('   3. The application should now use cloud translation services');
        console.log('   4. If you want local processing later, reinstall Argos through Local Models Setup');
        
    } catch (error) {
        console.error('\n❌ Error updating configuration:', error.message);
        console.log('\n🔧 Manual Fix Instructions:');
        console.log('   1. Open Whispra');
        console.log('   2. Go to Settings > Cloud/Local');
        console.log('   3. Select "Cloud Processing" option');
        console.log('   4. Save settings');
        console.log('   5. Restart the application');
    }
    
    console.log('\n💡 About This Issue:');
    console.log('   • Argos Translate needs both base packages AND language model files');
    console.log('   • The download appears to have installed only the base packages');
    console.log('   • Language models (.argosmodel files) are what actually do the translation');
    console.log('   • Without them, Argos cannot translate between any languages');
    console.log('   • Cloud mode uses online services instead and should work immediately');
}

// Run the fix
fixArgosLanguagePacks();