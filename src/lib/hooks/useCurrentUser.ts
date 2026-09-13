import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/login');
        return;
      }
      const uid = session.user.id;
      setUserId(uid);

      // Fetch nama dari tabel users
      const { data: userData } = await supabase
        .from('users')
        .select('nama')
        .eq('id', uid)
        .single();
      setUserName(userData?.nama || null);

      setLoading(false);
    };

    fetchSession();
  }, [router]);

  return { userId, userName, loading };
}
