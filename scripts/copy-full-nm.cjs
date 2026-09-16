const fs = require('fs')
const path = require('path')

const src = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\node_modules'
const dst = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\app\\node_modules'

// Recursively copy a directory
function copyDir(srcPath, dstPath) {
  const entries = fs.readdirSync(srcPath, { withFileTypes: true })
  for (const entry of entries) {
    const srcEntry = path.join(srcPath, entry.name)
    const dstEntry = path.join(dstPath, entry.name)
    if (entry.isDirectory()) {
      if (!fs.existsSync(dstEntry)) fs.mkdirSync(dstEntry, { recursive: true })
      copyDir(srcEntry, dstEntry)
    } else {
      fs.copyFileSync(srcEntry, dstEntry)
    }
  }
}

// Copy all packages from src to dst
const srcItems = fs.readdirSync(src)
for (const item of srcItems) {
  const srcPath = path.join(src, item)
  const dstPath = path.join(dst, item)
  if (fs.existsSync(dstPath)) {
    // Skip if already exists (like next which was just copied)
    continue
  }
  if (fs.statSync(srcPath).isDirectory()) {
    fs.mkdirSync(dstPath, { recursive: true })
    copyDir(srcPath, dstPath)
    console.log('Copied:', item)
  } else {
    fs.copyFileSync(srcPath, dstPath)
  }
}

console.log('All packages copied')
console.log('next.js exists:', fs.existsSync(path.join(dst, 'next', 'dist', 'server', 'next.js')))
