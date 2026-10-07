import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const MAX_RETRY = 3;
const RETRY_DELAY_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadName = async (uid: string) => {
      const { data } = await supabase.from('users').select('nama').eq('id', uid).single();
      if (active) setUserName(data?.nama || null);
    };

    // Retry getSession() — gangguan jaringan/refresh token sementara TIDAK boleh
    // dianggap sebagai logout. Hanya hasil "sukses tapi kosong" yang berarti sesi hilang.
    // Return: session (ada), null (benar-benar tidak ada), undefined (tidak bisa dipastikan).
    const resolveSession = async () => {
      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const { data, error } = await supabase.auth.getSession();
        if (data.session) return data.session;
        if (!error) return null; // sukses tanpa error & tanpa sesi → memang belum login
        console.warn(`[auth] getSession gagal (${attempt}/${MAX_RETRY}): ${error.message}`);
        if (attempt < MAX_RETRY) await delay(RETRY_DELAY_MS * attempt);
      }
      return undefined; // semua percobaan error → jangan redirect, hindari logout palsu
    };

    const init = async () => {
      const session = await resolveSession();
      if (!active) return;

      if (session === undefined) {
        // Status sesi tidak dapat dipastikan — biarkan halaman tampil tanpa memaksa login.
        setLoading(false);
        return;
      }
      if (session === null) {
        console.warn('[auth] redirect /login — useCurrentUser (sesi tidak ada)');
        router.replace('/login');
        return;
      }

      setUserId(session.user.id);
      await loadName(session.user.id);
      if (active) setLoading(false);
    };

    init();

    // Satu sumber kebenaran untuk token refresh & sign-out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setUserId(null);
        setUserName(null);
        return;
      }
      setUserId(session.user.id);
      loadName(session.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return { userId, userName, loading };
}
