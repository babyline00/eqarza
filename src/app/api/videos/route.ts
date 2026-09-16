import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/videos — public list of active customer videos (home page carousel)
export async function GET() {
  const videos = await db.video.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, title: true, subtitle: true, url: true },
  })
  return NextResponse.json({ videos })
}
