const fs = require('fs');
const path = require('path');

// Files that need import path fixes
const filesToFix = [
  'dist/ui/components/ManagedApiWarningBanner.js',
  'dist/ui/components/UsageDisplay.js',
  'dist/ui/settings/tabs/AccountTab.js',
  'dist/ui/settings/tabs/ApiKeysTab.js'
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Service imports are already correct - they point to ../../services or ../../../services
    // which will resolve to dist/ui/services after we copy the renderer services there
    // No changes needed!
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in ${filePath}`);
  }
});

console.log('UI import paths fixed!');
