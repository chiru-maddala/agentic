import { createClient } from '@supabase/supabase-js'

export type Report = {
  id: string
  date: string
  content: string
  created_at: string
}

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
