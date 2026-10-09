'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import PengumumanFeed from '@/components/PengumumanFeed';

export default function GuruDashboard() {
  const { userId, loading: userLoading } = useCurrentUser();

  const [namaGuru, setNamaGuru] = useState('');
  const [totalKelas, setTotalKelas] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [jadwalBerikutnya, setJadwalBerikutnya] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ label: string, value: number }[]>([]);

  useEffect(() => {
    if (userId) fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    if (!userId) return;

    // Nama guru
    const { data: user } = await supabase.from('users').select('nama').eq('id', userId).single();
    if (user) setNamaGuru(user.nama);

    // Kelas yang diampu
    const { data: gk } = await supabase.from('guru_kelas').select('kelas_id').eq('guru_id', userId);
    const kelasIds = (gk || []).map((g: any) => g.kelas_id);
    setTotalKelas(kelasIds.length);

    // Banyak siswa yang diajar (distinct)
    if (kelasIds.length > 0) {
      const { data: sk } = await supabase.from('siswa_kelas').select('siswa_id').in('kelas_id', kelasIds);
      setTotalSiswa(new Set((sk || []).map((s: any) => s.siswa_id)).size);
    } else {
      setTotalSiswa(0);
    }

    // Jadwal mengajar hari ini
    const hariMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = hariMap[new Date().getDay()];
    const { data: jadwal } = await supabase
      .from('jadwal')
      .select('jam_mulai, jam_selesai, kelas(nama)')
      .eq('guru_id', userId)
      .eq('hari', hariIni)
      .order('jam_mulai');
    if (jadwal) setJadwalBerikutnya(jadwal);

    // Grafik pencapaian: rata-rata nilai akhir per bab (dari kelas yang diampu)
    if (kelasIds.length > 0) {
      const { data: babs } = await supabase.from('bab').select('id, nomor, judul').in('kelas_id', kelasIds).order('nomor');
      if (babs && babs.length > 0) {
        const babIds = babs.map((b: any) => b.id);
        const { data: nilais } = await supabase.from('nilai').select('bab_id, nilai_akhir').in('bab_id', babIds);
        const chart = babs.map((b: any) => {
          const rows = (nilais || [])
            .filter((n: any) => n.bab_id === b.id && n.nilai_akhir != null)
            .map((n: any) => Number(n.nilai_akhir));
          const avg = rows.length > 0 ? rows.reduce((a: number, c: number) => a + c, 0) / rows.length : 0;
          return { label: b.judul, value: avg };
        });
        setChartData(chart);
      }
    }
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  const maxVal = Math.max(100, ...chartData.map(c => c.value));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', rowGap: '8px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Halo, {namaGuru || 'Guru'}! 👋</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Selamat datang di Dashboard Guru.</p>
        </div>
      </div>

      <PengumumanFeed role="guru" />

      {/* Kartu dapat diklik → Kelas Saya (revisi A1). */}
      <div className="stats-grid mb-4">
        <Link href="/guru/kelas" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-icon bg-green">👨‍🎓</div>
          <div className="stat-info">
            <span className="label">Siswa Diajar</span>
            <span className="value">{totalSiswa}</span>
          </div>
        </Link>
        <Link href="/guru/kelas" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-icon bg-blue">🏫</div>
          <div className="stat-info">
            <span className="label">Kelas Diampu</span>
            <span className="value">{totalKelas}</span>
          </div>
        </Link>
      </div>

      <div className="grid-2">
        {/* Jadwal Reminder */}
        <div className="card card-body">
          <h3 className="mb-3">📅 Jadwal Mengajar Hari Ini</h3>
          {jadwalBerikutnya.length === 0 ? (
            <p className="text-muted text-center my-4">Tidak ada jadwal mengajar untuk hari ini.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {jadwalBerikutnya.map((j, idx) => (
                <li key={idx} style={{
                  padding: '12px',
                  borderLeft: '4px solid var(--primary-color)',
                  background: 'var(--slate-50)',
                  marginBottom: '10px',
                  borderRadius: '0 8px 8px 0'
                }}>
                  <div style={{ fontWeight: 'bold' }}>Kelas: {j.kelas?.nama}</div>
                  <div className="text-muted" style={{ fontSize: '13px' }}>
                    ⏰ {j.jam_mulai.slice(0, 5)} - {j.jam_selesai.slice(0, 5)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Grafik Pencapaian + Shortcuts */}
        <div>
          <div className="card card-body mb-4">
            <h3 className="mb-3">📈 Rata-rata Nilai per Bab</h3>
            {chartData.length === 0 ? (
              <p className="text-muted text-center my-4">Belum ada data nilai untuk ditampilkan.</p>
            ) : (
              <>
                <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '10px 0', borderBottom: '1px solid #ddd', overflowX: 'auto' }}>
                  {chartData.map((c, i) => (
                    <div key={i} style={{ flex: '1 0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <span style={{ fontSize: '12px', marginBottom: '4px' }}>{c.value.toFixed(0)}</span>
                      <div style={{ width: '100%', background: 'var(--primary, #4f46e5)', height: `${(c.value / maxVal) * 100}%`, minHeight: '4px', borderRadius: '4px 4px 0 0' }}></div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '5px', overflowX: 'auto' }}>
                  {chartData.map((c, i) => <div key={i} style={{ flex: '1 0 40px' }}>{c.label}</div>)}
                </div>
              </>
            )}
          </div>

          <div className="card card-body">
            <h3 className="mb-3">🚀 Akses Cepat</h3>
            <div className="grid-2" style={{ gap: '10px' }}>
              <Link href="/guru/kelas" className="btn btn-outline" style={{ textAlign: 'center' }}>👥 Kelola Kelas</Link>
              <Link href="/guru/ujian" className="btn btn-outline" style={{ textAlign: 'center' }}>📝 Manajemen Ujian</Link>
              <Link href="/guru/penilaian" className="btn btn-outline" style={{ textAlign: 'center' }}>✍️ Penilaian</Link>
              <Link href="/guru/presensi" className="btn btn-outline" style={{ textAlign: 'center' }}>📍 Presensi</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
