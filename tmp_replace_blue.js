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

  // Replace utility classes
  // e.g. bg-blue-500 -> bg-primary, text-blue-400 -> text-primary-hover
  
  // Mapping
  // blue-500 -> primary
  // blue-400 -> primary (or primary-hover/muted)
  // blue-600 -> primary-hover
  // Instead of individual weights, let's map:
  // (bg|text|border|ring|shadow|border|accent|outline)-blue-[4-6]00 -> $1-primary
  
  newContent = newContent.replace(/\b(bg|text|border|ring|shadow|accent|outline)-blue-[4-6]00(\/[0-9]+)?\b/g, '$1-primary$2');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = 'c:\\Users\\zhang\\Code\\LowCode\\shenbi-codes\\shenbi-system-theme-fix\\packages';
walkDir(targetDir, processFile);
console.log('Complete!');
