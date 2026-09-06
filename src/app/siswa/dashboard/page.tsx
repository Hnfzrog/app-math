'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SiswaDashboard() {
  const [tugasAktif, setTugasAktif] = useState(0);
  const [rataRata, setRataRata] = useState(0);
  const [showToast, setShowToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });
  const [loading, setLoading] = useState(true);
  
  // Hardcoded ID Siswa Andi untuk MVP
  const SISWA_ID = 'e0000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchStats();

    const channel = supabase.channel('siswa-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konten' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa', filter: `siswa_id=eq.${SISWA_ID}` }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    // Cari jumlah tugas di kelas siswa
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).single();
    if (siswaKelas) {
      const { data: babs } = await supabase.from('bab').select('id').eq('kelas_id', siswaKelas.kelas_id);
      const babIds = babs?.map(b => b.id) || [];
      
      if (babIds.length > 0) {
        const { count: kontenCount } = await supabase
          .from('konten')
          .select('*', { count: 'exact', head: true })
          .in('bab_id', babIds)
          .in('tipe', ['lkpd', 'banksoal', 'evaluasi']);
        
        if (kontenCount && kontenCount > 0 && kontenCount > tugasAktif) {
          setShowToast({ message: `🔔 Ada ${kontenCount} tugas/kuis yang tersedia untukmu!`, visible: true });
          setTimeout(() => setShowToast({ message: '', visible: false }), 5000);
        }
        setTugasAktif(kontenCount || 0);
      }
    }

    // Cari rata-rata nilai final siswa
    const { data: jawaban } = await supabase.from('jawaban_siswa').select('skor_final').eq('siswa_id', SISWA_ID).eq('status', 'final');
    if (jawaban && jawaban.length > 0) {
      const total = jawaban.reduce((acc, curr) => acc + (Number(curr.skor_final) || 0), 0);
      setRataRata(Math.round(total / jawaban.length));
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center mt-4">Memuat data dashboard...</div>;

  return (
    <div>
      <div className="card card-body mb-4">
        <h2 className="mb-2">Notifikasi Terkini</h2>
        <ul className="notif-list">
          <li className="notif-item">🔔 Kamu memiliki tugas/kuis yang harus dikerjakan di kelas ini! Cek menu Tugas.</li>
          <li className="notif-item">🎉 Jangan lupa cek Nilai Saya untuk melihat hasil koreksi Guru.</li>
        </ul>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon bg-blue">📝</div>
          <div className="stat-info">
            <span className="label">Kuis & Tugas Tersedia</span>
            <span className="value">{tugasAktif}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-green">🏆</div>
          <div className="stat-info">
            <span className="label">Nilai Rata-rata</span>
            <span className="value">{rataRata}</span>
          </div>
        </div>
      </div>

      {showToast.visible && (
        <div className="toast-container">
          <div className="toast toast-success">
            {showToast.message}
          </div>
        </div>
      )}
    </div>
  );
}
