'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function GuruKelas() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { userId, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userId) fetchKelas();
  }, [userId]);

  const fetchKelas = async () => {
    if (!userId) return;
    setLoading(true);
    const { data: guruKelas } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama, angkatan, sub_kelas)')
      .eq('guru_id', userId);

    if (guruKelas) {
      // @ts-ignore
      const mapped = guruKelas.map(gk => gk.kelas).filter(k => k !== null);
      setKelasList(mapped);
    }
    setLoading(false);
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="card card-body">
      <h3 className="mb-4">Manajemen Kelas & RPP</h3>
      
      {loading ? (
        <p className="text-center">Loading data kelas...</p>
      ) : kelasList.length === 0 ? (
        <p className="text-center text-muted">Anda belum ditugaskan ke kelas manapun.</p>
      ) : (
        <div className="grid-2">
          {kelasList.map((kelas) => (
            <div key={kelas.id} className="card card-body text-center" style={{ padding: '2rem' }}>
              <h2 className="mb-3">Kelas {kelas.angkatan}{kelas.sub_kelas || ''}</h2>
              <Link href={`/guru/kelas/${kelas.id}`} className="btn btn-primary w-100">
                Kelola Modul & Materi →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
