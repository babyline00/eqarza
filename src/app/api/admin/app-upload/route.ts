import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, stat, rm } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getAdminFromReq, isSuperAdmin } from '@/lib/session'
import { getSetting, setSetting, invalidateSetting, APP_FILE_NAME, APP_FILE_MAX_SIZE, SETTING_APP_FILE, SETTING_APP_FILE_SIZE, SETTING_APP_FILE_UPLOADED } from '@/lib/settings'
import { logActivity, getClientIp } from '@/lib/activity'

const appDir = () => path.join(process.cwd(), 'public', 'uploads')
const apkPath = () => path.join(appDir(), APP_FILE_NAME)

// POST /api/admin/app-upload (multipart: apk=<file>) -> uploads the Android APK
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromReq(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

    const form = await req.formData()
    const file = form.get('apk') || form.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No APK file provided' }, { status: 400 })
    }

    const name = (file.name || '').toLowerCase()
    if (!name.endsWith('.apk')) {
      return NextResponse.json({ error: 'Only .apk files are allowed' }, { status: 400 })
    }

    if (file.size > APP_FILE_MAX_SIZE) {
      return NextResponse.json(
        { error: `APK too large. Maximum ${Math.round(APP_FILE_MAX_SIZE / (1024 * 1024))}MB allowed` },
        { status: 413 }
      )
    }

    await mkdir(appDir(), { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const target = apkPath()
    await writeFile(target, buffer)

    const info = await stat(target)
    await setSetting(SETTING_APP_FILE, `/uploads/${APP_FILE_NAME}`)
    await setSetting(SETTING_APP_FILE_SIZE, String(info.size))
    await setSetting(SETTING_APP_FILE_UPLOADED, String(Date.now()))

    await logActivity({ type: 'APP_UPLOADED', actor: admin.username, action: 'Uploaded Android APK', details: `${APP_FILE_NAME} — ${(info.size / (1024 * 1024)).toFixed(1)} MB`, ip: getClientIp(req) })

    return NextResponse.json({ ok: true, url: `/uploads/${APP_FILE_NAME}`, size: info.size })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'App upload failed' }, { status: 500 })
  }
}

// DELETE /api/admin/app-upload -> removes the uploaded APK
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminFromReq(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

    await rm(apkPath(), { force: true }).catch(() => {})
    await db.setting.deleteMany({
      where: { key: { in: [SETTING_APP_FILE, SETTING_APP_FILE_SIZE, SETTING_APP_FILE_UPLOADED] } },
    })
    invalidateSetting(SETTING_APP_FILE)
    invalidateSetting(SETTING_APP_FILE_SIZE)
    invalidateSetting(SETTING_APP_FILE_UPLOADED)

    await logActivity({ type: 'APP_REMOVED', actor: admin.username, action: 'Removed Android APK', details: `${APP_FILE_NAME} deleted`, ip: getClientIp(req) })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to remove app' }, { status: 500 })
  }
}

// GET /api/admin/app-upload -> current upload info (admin view, same shape as /api/app-info)
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromReq(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isSuperAdmin(admin)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })

    const url = await getSetting(SETTING_APP_FILE)
    if (!url) return NextResponse.json({ available: false })

    let size = 0
    try {
      size = (await stat(apkPath())).size
    } catch {
      return NextResponse.json({ available: false })
    }

    return NextResponse.json({
      available: true,
      url,
      size,
      uploadedAt: await getSetting(SETTING_APP_FILE_UPLOADED),
      fileName: APP_FILE_NAME,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to read app info' }, { status: 500 })
  }
}