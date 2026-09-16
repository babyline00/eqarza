const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const src = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\node_modules'
const dst = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\app\\node_modules'

// Critical packages to copy
const critical = ['sharp', 'react', 'react-dom']

for (const pkg of critical) {
  const srcPath = path.join(src, pkg)
  const dstPath = path.join(dst, pkg)
  if (fs.existsSync(dstPath)) {
    console.log(`${pkg} already exists, removing and re-copying...`)
    execSync(`rmdir "${dstPath}" /S /Q`, { stdio: 'ignore' })
  }
  fs.mkdirSync(dstPath, { recursive: true })
  // Use xcopy for speed
  try {
    execSync(`xcopy "${srcPath}\\*" "${dstPath}\\" /E /Q /I /Y`, { timeout: 30000, stdio: 'pipe' })
    console.log(`Copied ${pkg}`)
  } catch (e) {
    // Fallback to Node.js copy
    function copyDir(s, d) {
      const entries = fs.readdirSync(s, { withFileTypes: true })
      for (const entry of entries) {
        const sp = path.join(s, entry.name)
        const dp = path.join(d, entry.name)
        if (entry.isDirectory()) {
          if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true })
          copyDir(sp, dp)
        } else {
          fs.copyFileSync(sp, dp)
        }
      }
    }
    copyDir(srcPath, dstPath)
    console.log(`Copied ${pkg} (fallback)`)
  }
}

// Verify
console.log('sharp exists:', fs.existsSync(path.join(dst, 'sharp', 'package.json')))
console.log('react exists:', fs.existsSync(path.join(dst, 'react', 'package.json')))
console.log('react-dom exists:', fs.existsSync(path.join(dst, 'react-dom', 'package.json')))
console.log('Done')
