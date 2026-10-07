import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Klien browser berbasis COOKIE (bukan localStorage) agar sesi yang sama bisa
// dibaca proxy/server-side. Satu instance (singleton) dipakai seluruh aplikasi
// supaya tidak ada sesi yang terpecah antar-klien — akar penyebab logout mendadak.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
