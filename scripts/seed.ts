// Seed admin + sample data
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

async function main() {
  // Admin user
  const existing = await db.admin.findUnique({ where: { username: 'admin' } })
  if (!existing) {
    await db.admin.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
      },
    })
    console.log('Admin created: admin / admin123')
  } else {
    console.log('Admin already exists')
  }
  console.log('Seed done')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
