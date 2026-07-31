import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { ADMIN_WIDGET_DEFAULTS } from '@/lib/admin-control-plane'

export async function GET() {
  try {
    const records = await db.query.AdminWidgetSetting.findMany()
    const byType = new Map(records.map((record: any) => [record.widgetType, record]))
    const data = ADMIN_WIDGET_DEFAULTS.map((item) => ({
      ...item,
      ...(byType.get(item.widgetType) || {}),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/dashboard/widget-catalog' } })
    return NextResponse.json({ success: false, error: 'Failed to fetch widget catalog' }, { status: 500 })
  }
}