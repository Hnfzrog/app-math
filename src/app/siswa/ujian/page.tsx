'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function SiswaUjianList() {
  const [loading, setLoading] = useState(true);
  const [ujianList, setUjianList] = useState<any[]>([]);
  const { userId, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userId) fetchUjian();
  }, [userId]);

  const fetchUjian = async () => {
    setLoading(true);
    // Cari kelas_id siswa
    const { data: siswaKelas } = await supabase
      .from('siswa_kelas')
      .select('kelas_id')
      .eq('siswa_id', userId)
      .single();

    if (siswaKelas) {
      // Ambil ujian untuk kelas tersebut
      const { data: ujianData } = await supabase
        .from('ujian')
        .select('*, users:guru_id(nama)')
        .eq('kelas_id', siswaKelas.kelas_id)
        .order('created_at', { ascending: false });

      if (ujianData) {
        setUjianList(ujianData);
      }
    }
    setLoading(false);
  };

  if (userLoading || loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Daftar Ujian / Evaluasi</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Ujian aktif yang ditugaskan untuk kelasmu.</p>
      </div>

      <div className="card card-body">
        {ujianList.length === 0 ? (
          <p className="text-center text-muted my-4">Belum ada ujian aktif.</p>
        ) : (
          <div className="grid-2 gap-4">
            {ujianList.map(u => (
              <div key={u.id} className="card p-3 border">
                <div className="d-flex justify-between align-center mb-2">
                  <span className={`badge ${u.jenis === 'UH' ? 'badge-primary' : 'badge-warning'}`}>{u.jenis}</span>
                  <span className="text-sm text-muted">⌛ {u.durasi_menit} Menit</span>
                </div>
                <h3 className="mb-1">{u.deskripsi || 'Ujian'}</h3>
                <p className="text-sm text-muted mb-3">Guru: {u.users?.nama}</p>
                <Link href={`/siswa/ujian/${u.id}`} className="btn btn-primary w-100 text-center">
                  Mulai Ujian
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
