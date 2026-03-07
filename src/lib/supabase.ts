import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// public client — for read operations on public data
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// admin client — for writes, used only in server-side admin routes
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
