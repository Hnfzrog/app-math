'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function GuruDashboard() {
  const [totalKelas, setTotalKelas] = useState(0);
  const [tugasBelumDinilai, setTugasBelumDinilai] = useState(0);

  const { userId, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userId) fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    if (!userId) return;

    const { count: kelasCount } = await supabase
      .from('guru_kelas')
      .select('*', { count: 'exact', head: true })
      .eq('guru_id', userId);
    setTotalKelas(kelasCount || 0);

    const { count: pendingCount } = await supabase.from('jawaban_siswa').select('*', { count: 'exact', head: true }).eq('status', 'pending_verifikasi');
    setTugasBelumDinilai(pendingCount || 0);
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="stats-grid mb-4">
        <div className="stat-card">
          <div className="stat-icon bg-blue">🏫</div>
          <div className="stat-info">
            <span className="label">Kelas Saya</span>
            <span className="value">{totalKelas} Kelas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-amber">📝</div>
          <div className="stat-info">
            <span className="label">Perlu Verifikasi</span>
            <span className="value text-danger">{tugasBelumDinilai}</span>
          </div>
        </div>
      </div>
      
      <div className="grid-2">
        <div className="card card-body">
          <h3 className="mb-3">Akses Cepat</h3>
          <div className="d-flex" style={{ gap: '1rem' }}>
            <Link href="/guru/kelas" className="btn btn-primary">Kelola Kelas</Link>
            <Link href="/guru/penilaian" className="btn btn-outline">Cek Penilaian</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
