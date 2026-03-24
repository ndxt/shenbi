const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(f)) {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.ts') || f.endsWith('.tsx')) {
        callback(dirPath);
      }
    }
  });
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // Replace `focus:border-primary` (without any slash) with the ring styling unless it already has a ring
  newContent = newContent.replace(/focus:border-primary(?!\/)/g, 'focus:border-primary/50 focus:ring-1 focus:ring-primary/20');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = 'c:\\Users\\zhang\\Code\\LowCode\\shenbi-codes\\shenbi-system-theme-fix\\packages';
walkDir(targetDir, processFile);
console.log('Complete!');
