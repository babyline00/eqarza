import { NextResponse } from 'next/server'
import { isTawkEnabled, getTawkWidgetId } from '@/lib/settings'

// GET /api/settings -> public runtime settings (chat widget config etc.)
export async function GET() {
  return NextResponse.json({
    tawkEnabled: await isTawkEnabled(),
    tawkWidgetId: await getTawkWidgetId(),
  })
}
