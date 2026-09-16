import { NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import path from 'path'
import { getSetting, APP_FILE_NAME, SETTING_APP_FILE, SETTING_APP_FILE_SIZE, SETTING_APP_FILE_UPLOADED } from '@/lib/settings'

// GET /api/app-info (public) -> tells the login page whether an installable
// Android APK is available so it can show the "Install App" download button.
export async function GET() {
  const url = await getSetting(SETTING_APP_FILE)
  if (!url) return NextResponse.json({ available: false })

  try {
    const p = path.join(process.cwd(), 'public', 'uploads', APP_FILE_NAME)
    const info = await stat(p)
    if (!info.isFile() || info.size === 0) return NextResponse.json({ available: false })

    return NextResponse.json({
      available: true,
      url,
      size: Number(await getSetting(SETTING_APP_FILE_SIZE)) || info.size,
      uploadedAt: await getSetting(SETTING_APP_FILE_UPLOADED),
      fileName: APP_FILE_NAME,
    })
  } catch {
    return NextResponse.json({ available: false })
  }
}