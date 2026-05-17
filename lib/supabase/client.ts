import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables are missing. Sync features are disabled.')
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

console.log('✅ Supabase client ready for sync')
