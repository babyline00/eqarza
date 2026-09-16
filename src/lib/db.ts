import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const client = new PrismaClient({
    // Query logging is expensive under concurrency and only useful for dev.
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

  // Best-effort SQLite connection tuning for concurrent app traffic on shared
  // hosting: WAL lets readers proceed while a write is in progress, and a sane
  // busy timeout avoids immediate "database is locked" errors. Never fatal.
  // PRAGMAs return result rows, so $queryRawUnsafe (not $execute) must be used.
  void client.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {})
  void client.$queryRawUnsafe('PRAGMA synchronous = NORMAL;').catch(() => {})
  void client.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {})

  return client
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db