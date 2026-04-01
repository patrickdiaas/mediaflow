// GET /api/cron/sync-google
// Disparado automaticamente pela Vercel Cron todos os dias às 06h30 UTC (03h30 Brasília).
// Sincroniza o dia anterior de todos os clientes com google_ads_customer_id.

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.GOOGLE_SYNC_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'GOOGLE_SYNC_SECRET não configurado' }, { status: 500 })
  }

  const syncUrl = new URL('/api/sync/google', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
  syncUrl.searchParams.set('secret', secret)
  syncUrl.searchParams.set('days', '1')

  try {
    const res = await fetch(syncUrl.toString(), { method: 'POST' })
    const data = await res.json()
    return NextResponse.json({ cron: 'sync-google', ...data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
