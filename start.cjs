// Deployment bootstrap for E-Qarza (Namecheap / cPanel Node.js App).
// 1) Computes the database path INSIDE this app folder and pins DATABASE_URL to
//    an absolute file:// URL so SQLite always resolves, no matter which working
//    directory or Prisma version the host uses.
// 2) Starts the Next.js standalone server (reads PORT + HOSTNAME from env).
const path = require('path')
const { execSync } = require('child_process')

if (!process.env.DATABASE_URL) {
  const dbPath = path.join(__dirname, 'prisma', 'db', 'custom.db').replace(/\\/g, '/')
  process.env.DATABASE_URL = 'file:' + dbPath
}

try {
  execSync('npx prisma migrate deploy', { stdio: 'ignore', cwd: __dirname })
} catch (e) {
  // Migration may not be needed or may have failed
}

process.env.NODE_ENV = 'production'

require('./server.js')