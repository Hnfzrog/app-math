'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function GuruKelas() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Hardcoded ID Guru Budi untuk MVP
  const GURU_ID = 'f0000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchKelas();
  }, []);

  const fetchKelas = async () => {
    setLoading(true);
    const { data: guruKelas } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama)')
      .eq('guru_id', GURU_ID);

    if (guruKelas) {
      // @ts-ignore
      const mapped = guruKelas.map(gk => gk.kelas).filter(k => k !== null);
      setKelasList(mapped);
    }
    setLoading(false);
  };

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
              <h2 className="mb-3">{kelas.nama}</h2>
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
