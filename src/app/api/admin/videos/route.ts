import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { logActivity, getClientIp } from '@/lib/activity'

const MAX_VIDEO_SIZE = 60 * 1024 * 1024 // 60MB
const ALLOWED_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const ALLOWED_EXT = new Set(['.mp4', '.webm', '.mov'])
const VIDEOS_DIR = path.join(process.cwd(), 'public', 'uploads', 'videos')

// GET /api/admin/videos — list all customer videos (newest first)
export async function GET(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const videos = await db.video.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ videos })
}

// POST /api/admin/videos (multipart: file, title, subtitle)
export async function POST(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  const title = String(form.get('title') || '').trim()
  const subtitle = String(form.get('subtitle') || '').trim()

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
  }
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: 'Video too large. Maximum 60MB allowed.' }, { status: 413 })
  }

  const ext = path.extname(file.name || '').toLowerCase() || '.mp4'
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.type.toLowerCase())) {
    return NextResponse.json({ error: 'Invalid file type. Only MP4, WebM and MOV videos are allowed.' }, { status: 400 })
  }

  await mkdir(VIDEOS_DIR, { recursive: true })
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`
  const filePath = path.join(VIDEOS_DIR, name)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const video = await db.video.create({
    data: { title, subtitle: subtitle || null, url: `/uploads/videos/${name}` },
  })

  await logActivity({
    type: 'VIDEO_UPLOADED',
    actor: admin.username,
    action: 'Uploaded customer video',
    details: title,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true, video })
}

// DELETE /api/admin/videos?id=... — remove a video record and its file
export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromReq(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const video = await db.video.findUnique({ where: { id } })
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  await db.video.delete({ where: { id } })
  if (video.url.startsWith('/uploads/videos/')) {
    try {
      await unlink(path.join(process.cwd(), 'public', video.url))
    } catch {
      // file may already be gone — record deletion is what matters
    }
  }

  await logActivity({
    type: 'VIDEO_DELETED',
    actor: admin.username,
    action: 'Deleted customer video',
    details: video.title,
    ip: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
