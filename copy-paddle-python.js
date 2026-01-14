const fs = require('fs');
const path = require('path');

const srcDir = 'src/paddle';
const destDir = 'dist/paddle';

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Find all .py files in src/paddle
if (!fs.existsSync(srcDir)) {
  console.log('src/paddle directory not found');
  process.exit(0);
}

const files = fs.readdirSync(srcDir);
const pyFiles = files.filter(file => file.endsWith('.py'));

if (pyFiles.length === 0) {
  console.log('No Python files found in src/paddle');
} else {
  pyFiles.forEach((fileName) => {
    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${fileName} to ${destPath}`);
  });
}

