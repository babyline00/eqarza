// One-time / repeatable seed for the production database.
// Run with: npx prisma db seed      (npm supports `prisma db seed` after config below)
// Or directly: node prisma/seed.mjs
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  log: ['warn', 'error'],
})

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  // SHA-256 hash must match src/lib/auth.ts (hashPassword)
  const passwordHash = createHash('sha256').update(password).digest('hex')

  const existing = await db.admin.findUnique({ where: { username } })
  if (existing) {
    console.log(`[seed] admin "${username}" already exists, skipping.`)
  } else {
    await db.admin.create({ data: { username, passwordHash } })
    console.log(`[seed] created admin "${username}"`)
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('[seed] WARNING: using default password "admin123" — change it immediately via ADMIN_PASSWORD.')
    }
  }
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())