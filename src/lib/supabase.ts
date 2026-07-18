import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anon) {
  console.error('Variables Supabase manquantes. Copie .env.example en .env.local.')
}

// persistSession : la session reste stockée localement et se rafraîchit seule.
// → Tu te connectes UNE fois sur le téléphone, tu restes connecté des semaines.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
