const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const base = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)'
const src = base + '\\node_modules'
const dst = base + '\\app\\node_modules'

// Remove next if exists, then copy full next package
try {
  execSync(`rmdir "${dst}\\next" /S /Q`, { stdio: 'ignore' })
} catch (e) {}

// Use xcopy via cmd
try {
  const result = execSync(`xcopy "${src}\\next" "${dst}\\next" /E /Q /I /Y`, { timeout: 60000, stdio: 'pipe' })
  console.log('Copied next:', result.toString().trim())
} catch (e) {
  console.log('Copy error:', e.message)
}

// Verify
const nextJsPath = path.join(dst, 'next', 'dist', 'server', 'next.js')
console.log('next.js exists:', fs.existsSync(nextJsPath))

// Also copy @prisma/client if missing
try {
  if (!fs.existsSync(path.join(dst, '@prisma', 'client'))) {
    const r = execSync(`xcopy "${src}\\@prisma" "${dst}\\@prisma" /E /Q /I /Y`, { timeout: 30000, stdio: 'pipe' })
    console.log('Copied @prisma:', r.toString().trim())
  }
} catch (e) {}

console.log('Done')
