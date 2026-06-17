import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('competitors')
    .select('id, name, website, description, funding_stage, hq, pillars, last_refreshed_at, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { name, website } = body
  if (!name || !website) return NextResponse.json({ error: 'name and website required' }, { status: 400 })
  const { data, error } = await supabase
    .from('competitors')
    .insert({ name, website })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
