const fs = require('fs');
const path = require('path');

function copyFile(src, dst) {
  if (fs.existsSync(src)) {
    const dir = path.dirname(dst);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  
  const copy = (s, d) => {
    fs.readdirSync(s).forEach(f => {
      const ss = path.join(s, f);
      const dd = path.join(d, f);
      if (fs.statSync(ss).isDirectory()) {
        if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
        copy(ss, dd);
      } else {
        fs.copyFileSync(ss, dd);
      }
    });
  };
  copy(src, dst);
}

const task = process.argv[2];

switch (task) {
  case 'copy-renderer':
    copyFile('dist/renderer/renderer.js', 'dist/renderer.js');
    copyFile('dist/renderer/renderer.js.map', 'dist/renderer.js.map');
    break;

  case 'copy-renderer-utils':
    copyDir('dist/renderer/renderer', 'dist/renderer');
    break;

  case 'copy-renderer-modules':
    ['translationHelpers', 'updateNotification', 'i18n', 'soundboard'].forEach(f => {
      copyFile(`dist/renderer/renderer/${f}.js`, `dist/renderer/${f}.js`);
      copyFile(`dist/renderer/renderer/${f}.js.map`, `dist/renderer/${f}.js.map`);
    });
    ['bidirectional', 'quicktrans', 'screentrans'].forEach(d => {
      copyDir(`dist/renderer/renderer/${d}`, `dist/renderer/${d}`);
    });
    break;

  case 'copy-services':
    ['BidirectionalTTSProcessor', 'StreamingAudioPlayer', 'TranslationContextManager', 'TranslateTTSProcessor'].forEach(f => {
      copyFile(`dist/renderer/services/${f}.js`, `dist/services/${f}.js`);
      copyFile(`dist/renderer/services/${f}.js.map`, `dist/services/${f}.js.map`);
    });
    break;

  case 'copy-paddle':
    copyDir('dist/paddle', 'dist/paddle');
    break;

  case 'copy-paddle-python':
    if (!fs.existsSync('dist/paddle')) fs.mkdirSync('dist/paddle', { recursive: true });
    if (fs.existsSync('src/paddle')) {
      fs.readdirSync('src/paddle').filter(f => f.endsWith('.py')).forEach(f => {
        copyFile(path.join('src/paddle', f), path.join('dist/paddle', f));
      });
    }
    break;

  case 'copy-ui':
    copyDir('dist/renderer/ui', 'dist/ui');
    break;

  case 'copy-components':
    copyDir('dist/renderer/components', 'dist/components');
    break;

  case 'copy-ui-services':
    if (!fs.existsSync('dist/ui/services')) fs.mkdirSync('dist/ui/services', { recursive: true });
    ['ManagedApiRouter', 'UsageMonitorService', 'ManagedApiErrorHandler', 'WhispraApiClient', 'ConfigurationManager', 'WhisperApiClient'].forEach(f => {
      copyFile(`dist/renderer/services/${f}.js`, `dist/ui/services/${f}.js`);
      copyFile(`dist/renderer/services/${f}.js.map`, `dist/ui/services/${f}.js.map`);
    });
    break;

  case 'copy-html':
    ['index.html', 'signin.html', 'device-check-overlay.html', 'vb-audio-setup-overlay.html', 'api-setup-overlay.html', 'python-check-overlay.html', 'paddlepaddle-overlay.html', 'screen-translation-overlay.html', 'screen-translation-box-select.html', 'screen-translation-watch-box-select.html', 'gpu-paddle-overlay.html', 'captions-overlay.html', 'whats-new-overlay.html'].forEach(f => {
      copyFile(`src/${f}`, `dist/${f}`);
    });
    break;

  case 'copy-overlay':
    [
      ['src/overlay.html', 'dist/overlay.html'],
      ['src/overlay-renderer.js', 'dist/overlay-renderer.js'],
      ['src/overlay-preload.js', 'dist/overlay-preload.js'],
      ['src/mini-overlay.html', 'dist/mini-overlay.html'],
      ['src/expanded-overlay.html', 'dist/expanded-overlay.html'],
      ['dist/renderer/mini-overlay-renderer.js', 'dist/mini-overlay-renderer.js'],
      ['dist/renderer/expanded-overlay-renderer.js', 'dist/expanded-overlay-renderer.js'],
      ['src/soundboard-overlay.html', 'dist/soundboard-overlay.html'],
      ['dist/renderer/soundboard-overlay-renderer.js', 'dist/soundboard-overlay-renderer.js'],
      ['src/screen-translation-overlay-preload.js', 'dist/screen-translation-overlay-preload.js'],
      ['src/screen-translation-box-select-preload.js', 'dist/screen-translation-box-select-preload.js'],
      ['src/screen-translation-watch-box-select-preload.js', 'dist/screen-translation-watch-box-select-preload.js'],
      ['src/ptt-overlay-window.html', 'dist/ptt-overlay-window.html'],
      ['src/ptt-overlay-preload.js', 'dist/ptt-overlay-preload.js'],
      ['src/audio-level-overlay-window.html', 'dist/audio-level-overlay-window.html'],
      ['src/audio-level-overlay-preload.js', 'dist/audio-level-overlay-preload.js'],
      ['src/screen-translation-loading-overlay.html', 'dist/screen-translation-loading-overlay.html'],
      ['src/screen-translation-loading-overlay-preload.js', 'dist/screen-translation-loading-overlay-preload.js']
    ].forEach(([src, dst]) => copyFile(src, dst));
    break;

  case 'copy-package':
    copyFile('package.json', 'dist/package.json');
    break;

  case 'copy-diagnostic':
    if (fs.existsSync('debug-windows11-audio-devices.js')) {
      copyFile('debug-windows11-audio-devices.js', 'dist/debug-windows11-audio-devices.js');
    } else {
      console.log('Diagnostic file not found, skipping...');
    }
    break;

  case 'copy-addon':
    copyFile('native-wasapi-loopback/build/Release/wasapi_loopback.node', 'dist/wasapi_loopback.node');
    break;

  case 'copy-utils':
    // Copy renderer utils to dist/utils, but preserve main process CommonJS versions
    const srcUtilsDir = 'dist/renderer/utils';
    const dstUtilsDir = 'dist/utils';
    if (fs.existsSync(srcUtilsDir)) {
      if (!fs.existsSync(dstUtilsDir)) fs.mkdirSync(dstUtilsDir, { recursive: true });
      fs.readdirSync(srcUtilsDir).forEach(f => {
        const srcPath = path.join(srcUtilsDir, f);
        const dstPath = path.join(dstUtilsDir, f);
        
        // For critical files, check if main process CommonJS version exists
        if (f === 'platformUtils.js' || f === 'pythonPath.js') {
          if (fs.existsSync(dstPath)) {
            const content = fs.readFileSync(dstPath, 'utf8');
            // If it's already CommonJS (has exports), don't overwrite
            if (content.includes('Object.defineProperty(exports, "__esModule"')) {
              console.log(`Preserving CommonJS ${f} for main process`);
              return;
            }
          }
        }
        
        if (fs.statSync(srcPath).isDirectory()) {
          copyDir(srcPath, dstPath);
        } else {
          fs.copyFileSync(srcPath, dstPath);
        }
      });
    }
    
    // Also copy the renderer-specific platformUtils file
    const rendererPlatformUtils = 'dist/renderer/utils/platformUtils-renderer.js';
    if (fs.existsSync(rendererPlatformUtils)) {
      fs.copyFileSync(rendererPlatformUtils, 'dist/utils/platformUtils-renderer.js');
      console.log('Copied platformUtils-renderer.js for renderer process');
    }
    break;
}
