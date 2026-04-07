// GET /api/cron/sync-meta
// Chamado diariamente pelo Vercel Cron às 06:00 UTC
// Vercel envia automaticamente: Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth     = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET

  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.META_SYNC_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'META_SYNC_SECRET não configurado' }, { status: 500 })
  }

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

  const res  = await fetch(`${host}/api/sync/meta?secret=${encodeURIComponent(secret)}&days=1`, {
    method: 'POST',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
