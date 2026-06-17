import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('competitor_clients')
    .select('*')
    .eq('competitor_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabase()
  const body = await req.json()
  const { data, error } = await supabase
    .from('competitor_clients')
    .insert({ ...body, competitor_id: id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: competitorId } = await params
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  const { error } = await supabase
    .from('competitor_clients')
    .delete()
    .eq('id', clientId)
    .eq('competitor_id', competitorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
