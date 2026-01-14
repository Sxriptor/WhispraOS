const fs = require('fs');
const path = require('path');

const files = [
  { src: 'dist/renderer/services/BidirectionalTTSProcessor.js', dst: 'dist/services/BidirectionalTTSProcessor.js' },
  { src: 'dist/renderer/services/BidirectionalTTSProcessor.js.map', dst: 'dist/services/BidirectionalTTSProcessor.js.map' },
  { src: 'dist/renderer/services/StreamingAudioPlayer.js', dst: 'dist/services/StreamingAudioPlayer.js' },
  { src: 'dist/renderer/services/StreamingAudioPlayer.js.map', dst: 'dist/services/StreamingAudioPlayer.js.map' },
  { src: 'dist/renderer/services/TranslationContextManager.js', dst: 'dist/services/TranslationContextManager.js' },
  { src: 'dist/renderer/services/TranslationContextManager.js.map', dst: 'dist/services/TranslationContextManager.js.map' }
];

files.forEach(({ src, dst }) => {
  if (fs.existsSync(src)) {
    const dstDir = path.dirname(dst);
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true });
    }
    fs.copyFileSync(src, dst);
  }
});

