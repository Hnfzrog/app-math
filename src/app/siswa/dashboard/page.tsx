'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SiswaDashboard() {
  const [loading, setLoading] = useState(true);
  const [profilSiswa, setProfilSiswa] = useState<{ nama: string; nisn: string; namaKelas: string; kelasId: string } | null>(null);
  const [rataRata, setRataRata] = useState(0);
  const [materiTerbaru, setMateriTerbaru] = useState<any[]>([]);
  const [evaluasiAktif, setEvaluasiAktif] = useState<any[]>([]);
  const [lkpdCount, setLkpdCount] = useState(0);
  const [showToast, setShowToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  // Hardcoded ID Siswa Andi untuk MVP
  const SISWA_ID = 'e0000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchDashboard();

    const channel = supabase.channel('siswa-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konten' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa', filter: `siswa_id=eq.${SISWA_ID}` }, () => fetchDashboard())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${SISWA_ID}` }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);

    // 1. Profil siswa
    const { data: userSiswa } = await supabase.from('users').select('nama, nisn').eq('id', SISWA_ID).single();
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).single();

    let namaKelas = '-';
    let kelasId = '';
    let babIds: string[] = [];

    if (siswaKelas) {
      kelasId = siswaKelas.kelas_id;
      const { data: kelas } = await supabase.from('kelas').select('nama').eq('id', kelasId).single();
      if (kelas) namaKelas = `Kelas ${kelas.nama}`;

      const { data: babs } = await supabase.from('bab').select('id').eq('kelas_id', kelasId);
      babIds = babs?.map(b => b.id) || [];
    }

    setProfilSiswa({
      nama: userSiswa?.nama || 'Siswa',
      nisn: userSiswa?.nisn || '-',
      namaKelas,
      kelasId,
    });

    // 2. Rata-rata nilai
    const { data: jawaban } = await supabase.from('jawaban_siswa').select('skor_final').eq('siswa_id', SISWA_ID).eq('status', 'final');
    if (jawaban && jawaban.length > 0) {
      const total = jawaban.reduce((acc, curr) => acc + (Number(curr.skor_final) || 0), 0);
      setRataRata(Math.round(total / jawaban.length));
    }

    if (babIds.length > 0) {
      // 3. Materi terbaru (emateri)
      const { data: materi } = await supabase
        .from('konten')
        .select('id, judul, tipe, bab_id, bab:bab_id(judul)')
        .in('bab_id', babIds)
        .eq('tipe', 'emateri')
        .order('created_at', { ascending: false })
        .limit(3);
      setMateriTerbaru(materi || []);

      // 4. Evaluasi aktif
      const { data: evaluasi } = await supabase
        .from('konten')
        .select('id, judul, tipe, bab_id, bab:bab_id(judul)')
        .in('bab_id', babIds)
        .eq('tipe', 'evaluasi')
        .order('created_at', { ascending: false })
        .limit(3);
      setEvaluasiAktif(evaluasi || []);

      // 5. Hitung LKPD tersedia
      const { count: lkpd } = await supabase
        .from('konten')
        .select('*', { count: 'exact', head: true })
        .in('bab_id', babIds)
        .eq('tipe', 'lkpd');
      setLkpdCount(lkpd || 0);

      if ((lkpd || 0) > 0) {
        setShowToast({ message: `🔔 Ada ${lkpd} LKPD yang tersedia untukmu!`, visible: true });
        setTimeout(() => setShowToast({ message: '', visible: false }), 5000);
      }
    }

    setLoading(false);
  };

  if (loading) return <div className="text-center mt-4">Memuat data dashboard...</div>;

  return (
    <div>
      {/* Profile Card */}
      {profilSiswa && (
        <div className="card card-body mb-4" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'var(--primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 700, flexShrink: 0
          }}>
            {profilSiswa.nama.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{profilSiswa.nama}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--slate-500)', fontSize: '13px' }}>
              {profilSiswa.namaKelas} &nbsp;|&nbsp; NISN: <strong>{profilSiswa.nisn}</strong>
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Link href="/siswa/profile" className="btn btn-sm btn-outline">Edit Profil</Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon bg-blue">📚</div>
          <div className="stat-info">
            <span className="label">Kelas Saya</span>
            <span className="value" style={{ fontSize: '16px' }}>{profilSiswa?.namaKelas || '-'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-green">🏆</div>
          <div className="stat-info">
            <span className="label">Rata-Rata Nilai</span>
            <span className="value">{rataRata || '-'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-amber">📝</div>
          <div className="stat-info">
            <span className="label">LKPD Tersedia</span>
            <span className="value">{lkpdCount}</span>
          </div>
        </div>
      </div>

      {/* Dua Card Grid */}
      <div className="grid-2">
        {/* Materi Terbaru */}
        <div className="card">
          <div className="card-header"><h3>Materi &amp; Modul Terbaru</h3></div>
          <div className="card-body">
            {materiTerbaru.length === 0 ? (
              <p className="text-muted">Belum ada materi dari guru.</p>
            ) : (
              <ul className="notif-list">
                {materiTerbaru.map(m => (
                  <li key={m.id} className="notif-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{m.judul}</strong>
                      <div className="text-muted" style={{ fontSize: '12px' }}>{(m.bab as any)?.judul || ''}</div>
                    </div>
                    <Link href="/siswa/materi" className="btn btn-sm btn-outline">Baca</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Evaluasi Aktif */}
        <div className="card">
          <div className="card-header"><h3>Evaluasi &amp; Ujian Aktif</h3></div>
          <div className="card-body">
            {evaluasiAktif.length === 0 ? (
              <p className="text-muted">Belum ada evaluasi aktif.</p>
            ) : (
              <ul className="notif-list">
                {evaluasiAktif.map(e => (
                  <li key={e.id} className="notif-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{e.judul}</strong>
                      <div className="text-muted" style={{ fontSize: '12px' }}>{(e.bab as any)?.judul || ''}</div>
                    </div>
                    <Link href="/siswa/tugas" className="btn btn-sm btn-success">Ikuti</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showToast.visible && (
        <div className="toast-container">
          <div className="toast toast-success">{showToast.message}</div>
        </div>
      )}
    </div>
  );
}
