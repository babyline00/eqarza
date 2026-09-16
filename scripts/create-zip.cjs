const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const base = 'C:\\Users\\musad\\Downloads\\E-Qarza-App-Ready (1)'
const appDir = path.join(base, 'app')

const cmds = [
  `copy /Y "${base}\\.next\\standalone\\server.js" "${appDir}\\server.js"`,
  `copy /Y "${base}\\.next\\standalone\\package.json" "${appDir}\\package.json"`,
  `xcopy "${base}\\.next\\standalone\\public" "${appDir}\\public" /Q /E /I /Y`,
  `xcopy "${base}\\src" "${appDir}\\src" /Q /E /I /Y`,
  `xcopy "${base}\\prisma" "${appDir}\\prisma" /Q /E /I /Y`,
  `xcopy "${base}\\public" "${appDir}\\public" /Q /E /I /Y`,
  `xcopy "${base}\\.next\\standalone\\node_modules" "${appDir}\\node_modules" /Q /E /I /Y`,
  `xcopy "${base}\\scripts" "${appDir}\\scripts" /Q /E /I /Y`,
  `copy /Y "${base}\\start.cjs" "${appDir}\\start.cjs"`,
  `copy /Y "${base}\\next.config.ts" "${appDir}\\next.config.ts"`,
  `copy /Y "${base}\\tsconfig.json" "${appDir}\\tsconfig.json"`,
  `copy /Y "${base}\\bun.lock" "${appDir}\\bun.lock"`,
  `copy /Y "${base}\\package.json" "${appDir}\\package.json"`,
  `copy /Y "${base}\\.env" "${appDir}\\.env"`,
]

for (const cmd of cmds) {
  try {
    execSync(cmd, { stdio: 'ignore' })
  } catch (e) {
    // ignore
  }
}
console.log('All files copied')

const zipPath = path.join(base, 'E-Qarza-Deploy.zip')
const psCmd = `powershell -Command "Compress-Archive -Path '${appDir}' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force"`
execSync(psCmd, { stdio: 'inherit' })

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath)
  console.log(`Zip created: ${Math.round(stats.size / (1024*1024))} MB`)
} else {
  console.log('Zip creation failed')
}
