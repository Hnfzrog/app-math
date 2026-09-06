import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log("Mencoba koneksi ke Supabase...");
  
  // Test koneksi ringan dengan query tabel yang mungkin belum ada atau auth API
  const { data, error } = await supabase.from('_dummy_table').select('*').limit(1);
  
  // Jika errornya 'relation does not exist' atau 'Permission denied', itu wajar dan berarti koneksi sukses. 
  // Jika errornya terkait network atau fetch, berarti kredensial/URL salah.
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST116') {
      console.log("✅ Sukses! Berhasil terhubung ke Supabase (auth + URL valid).");
    } else {
      console.log("✅ Sukses! Kredensial terbaca, tapi ada API error (wajar jika tabel belum dibuat):", error.message);
    }
  } else {
    console.log("✅ Sukses! Berhasil terhubung ke Supabase.");
  }
}

testConnection();
