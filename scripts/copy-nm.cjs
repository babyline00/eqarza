const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const src = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\node_modules'
const dst = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)\\app\\node_modules'

// Remove existing and copy using PowerShell
try {
  execSync(`rmdir "${dst}" /S /Q 2>nul`)
} catch (e) {}

try {
  fs.mkdirSync(dst, { recursive: true })
} catch (e) {}

// Use PowerShell to copy everything
const result = execSync(`powershell -Command "Copy-Item -Path '${src}\\*' -Destination '${dst}' -Recurse -Force -ErrorAction SilentlyContinue; Get-ChildItem '${dst}' -Recurse | Measure-Object | Select-Object -ExpandProperty Count"`, { stdio: 'pipe', timeout: 180000 })
console.log('Count:', result.toString().trim())

// Verify next
const nextPath = path.join(dst, 'next', 'dist', 'server', 'next.js')
console.log('next.js exists:', fs.existsSync(nextPath))
console.log('prisma exists:', fs.existsSync(path.join(dst, 'prisma', 'dist', 'prisma.js')))
