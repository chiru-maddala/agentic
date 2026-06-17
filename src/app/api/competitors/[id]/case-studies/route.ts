import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('competitor_case_studies')
    .select('*, competitor_clients(name)')
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
    .from('competitor_case_studies')
    .insert({ ...body, competitor_id: id })
    .select('*, competitor_clients(name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: competitorId } = await params
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const csId = searchParams.get('csId')
  if (!csId) return NextResponse.json({ error: 'csId required' }, { status: 400 })
  const { error } = await supabase
    .from('competitor_case_studies')
    .delete()
    .eq('id', csId)
    .eq('competitor_id', competitorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
