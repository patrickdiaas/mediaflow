// GET /api/debug/meta-account?secret=<META_SYNC_SECRET>&slug=<client_slug>
//
// Diagnostica o estado da conta Meta de um cliente:
//   1. Verifica se o cliente existe e tem meta_ad_account_id
//   2. Chama Graph API para status da conta
//   3. Chama Graph API de insights do dia anterior
// Retorna o erro bruto do Graph se alguma chamada falhar.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const META_API_BASE = 'https://graph.facebook.com/v21.0'

async function graphGet(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${META_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString())
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (!process.env.META_SYNC_SECRET || secret !== process.env.META_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.META_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'META_ACCESS_TOKEN ausente' }, { status: 500 })

  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug obrigatório (?slug=)' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('slug, name, active, meta_ad_account_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: `cliente "${slug}" não encontrado` }, { status: 404 })
  if (!client.meta_ad_account_id) return NextResponse.json({ client, error: 'sem meta_ad_account_id' }, { status: 400 })

  const accountId = String(client.meta_ad_account_id).startsWith('act_')
    ? client.meta_ad_account_id
    : `act_${client.meta_ad_account_id}`

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const ymd = yesterday.toISOString().split('T')[0]

  const accountInfo = await graphGet(`/${accountId}`, {
    fields: 'name,account_status,disable_reason,currency,timezone_name,business',
  }, token)

  const insights = await graphGet(`/${accountId}/insights`, {
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,date_start',
    time_range: JSON.stringify({ since: ymd, until: ymd }),
    level: 'campaign',
    limit: '50',
  }, token)

  const tokenInfo = await graphGet(`/me`, { fields: 'id,name' }, token)

  return NextResponse.json({
    client,
    account_id: accountId,
    checked_at: new Date().toISOString(),
    yesterday: ymd,
    token: tokenInfo,
    account_info: accountInfo,
    insights,
  })
}
