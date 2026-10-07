'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import PengumumanFeed from '@/components/PengumumanFeed';

export default function SiswaDashboard() {
  const [loading, setLoading] = useState(true);
  const [profilSiswa, setProfilSiswa] = useState<{ nama: string; nisn: string; namaKelas: string; kelasId: string } | null>(null);
  const [materiTerbaru, setMateriTerbaru] = useState<any[]>([]);
  const [showToast, setShowToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [jadwalHariIni, setJadwalHariIni] = useState<any[]>([]);

  // Statistik persebaran (selesai / total)
  const [materiCount, setMateriCount] = useState(0);
  const [lkpdTotal, setLkpdTotal] = useState(0);
  const [lkpdDone, setLkpdDone] = useState(0);
  const [tugasTotal, setTugasTotal] = useState(0);
  const [tugasDone, setTugasDone] = useState(0);
  const [ujianTotal, setUjianTotal] = useState(0);
  const [ujianDone, setUjianDone] = useState(0);

  // Grafik pencapaian per bab
  const [chartData, setChartData] = useState<{ label: string, value: number }[]>([]);

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (SISWA_ID) fetchDashboard();

    if (!SISWA_ID) return;

    const channel = supabase.channel('siswa-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konten' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa', filter: `siswa_id=eq.${SISWA_ID}` }, () => fetchDashboard())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${SISWA_ID}` }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [SISWA_ID]);

  const fetchDashboard = async () => {
    if (!SISWA_ID) return;
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

      const { data: babs } = await supabase.from('bab').select('id, nomor, judul').eq('kelas_id', kelasId).order('nomor');
      babIds = babs?.map(b => b.id) || [];

      // Jadwal hari ini
      const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
      const { data: jdw } = await supabase
        .from('jadwal')
        .select('*, users:guru_id(nama)')
        .eq('kelas_id', kelasId)
        .eq('hari', hariIni)
        .order('jam_mulai', { ascending: true });
      if (jdw) setJadwalHariIni(jdw);

      // Grafik pencapaian: nilai akhir per bab
      const { data: nilaiData } = await supabase.from('nilai').select('bab_id, nilai_akhir').eq('siswa_id', SISWA_ID);
      const chart = (babs || []).map((b: any) => {
        const n = (nilaiData || []).find((x: any) => x.bab_id === b.id);
        return { label: b.judul, value: n?.nilai_akhir != null ? Number(n.nilai_akhir) : 0 };
      });
      setChartData(chart);
    }

    // Sapaan waktu
    const hour = new Date().getHours();
    let sapaan = 'Pagi';
    if (hour >= 12 && hour < 15) sapaan = 'Siang';
    else if (hour >= 15 && hour < 18) sapaan = 'Sore';
    else if (hour >= 18) sapaan = 'Malam';

    setProfilSiswa({
      nama: `Selamat ${sapaan}, ${userSiswa?.nama?.split(' ')[0] || 'Siswa'}!`,
      nisn: userSiswa?.nisn || '-',
      namaKelas,
      kelasId,
    });

    if (babIds.length > 0) {
      // Materi terbaru
      const { data: materi } = await supabase
        .from('konten')
        .select('id, judul, tipe, bab_id, bab:bab_id(judul)')
        .in('bab_id', babIds)
        .eq('tipe', 'emateri')
        .order('created_at', { ascending: false })
        .limit(3);
      setMateriTerbaru(materi || []);

      // Semua konten kelas ini, dikelompokkan per tipe
      const { data: kontenAll } = await supabase.from('konten').select('id, tipe').in('bab_id', babIds);
      const byType: Record<string, string[]> = { emateri: [], lkpd: [], banksoal: [], evaluasi: [] };
      (kontenAll || []).forEach((k: any) => { if (byType[k.tipe]) byType[k.tipe].push(k.id); });

      // Konten yang sudah dikerjakan (ada jawaban_siswa untuk minimal 1 soal)
      const kontenIds = (kontenAll || []).map((k: any) => k.id);
      const doneKonten = new Set<string>();
      if (kontenIds.length > 0) {
        const { data: soals } = await supabase.from('soal').select('id, konten_id').in('konten_id', kontenIds);
        const soalIds = (soals || []).map((s: any) => s.id);
        if (soalIds.length > 0) {
          const { data: jw } = await supabase.from('jawaban_siswa').select('soal_id').eq('siswa_id', SISWA_ID).in('soal_id', soalIds);
          const answered = new Set((jw || []).map((j: any) => j.soal_id));
          (soals || []).forEach((s: any) => { if (answered.has(s.id)) doneKonten.add(s.konten_id); });
        }
      }

      setMateriCount(byType.emateri.length);
      setLkpdTotal(byType.lkpd.length);
      setLkpdDone(byType.lkpd.filter(id => doneKonten.has(id)).length);
      setTugasTotal(byType.banksoal.length);
      setTugasDone(byType.banksoal.filter(id => doneKonten.has(id)).length);

      if (byType.lkpd.length > 0) {
        setShowToast({ message: `🔔 Ada ${byType.lkpd.length} LKPD yang tersedia untukmu!`, visible: true });
        setTimeout(() => setShowToast({ message: '', visible: false }), 5000);
      }
    }

    // Ujian: selesai / total
    if (kelasId) {
      // Hanya hitung ujian yang sudah diterbitkan — draf memang tidak muncul di daftar siswa.
      const { data: ujianAll } = await supabase.from('ujian').select('id').eq('kelas_id', kelasId).eq('is_terbit', true);
      const ujianIds = (ujianAll || []).map((u: any) => u.id);
      setUjianTotal(ujianIds.length);
      let done = 0;
      if (ujianIds.length > 0) {
        const { data: soalU } = await supabase.from('soal_ujian').select('id, ujian_id').in('ujian_id', ujianIds);
        const soalUIds = (soalU || []).map((s: any) => s.id);
        if (soalUIds.length > 0) {
          const { data: jwU } = await supabase.from('jawaban_ujian').select('soal_id').eq('siswa_id', SISWA_ID).in('soal_id', soalUIds);
          const answeredU = new Set((jwU || []).map((j: any) => j.soal_id));
          done = new Set((soalU || []).filter((s: any) => answeredU.has(s.id)).map((s: any) => s.ujian_id)).size;
        }
      }
      setUjianDone(done);
    }

    setLoading(false);
  };

  if (loading) return <div className="text-center mt-4">Memuat data dashboard...</div>;
  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  const maxVal = Math.max(100, ...chartData.map(c => c.value));

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
            👋
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{profilSiswa.nama}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--slate-500)', fontSize: '13px' }}>
              {profilSiswa.namaKelas} &nbsp;|&nbsp; NISN: <strong>{profilSiswa.nisn}</strong>
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Link href="/siswa/profile" className="btn btn-sm btn-outline">Edit Profil</Link>
          </div>
        </div>
      )}

      <PengumumanFeed role="siswa" />

      <div className="grid-2">
        <div className="d-flex flex-column gap-4">
          {/* Persebaran: Materi / LKPD / Tugas / Ujian */}
          {/* Kartu dapat diklik → langsung ke halaman terkait (revisi A1). */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <Link href="/siswa/materi" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon bg-blue">📚</div>
              <div className="stat-info">
                <span className="label">Materi</span>
                <span className="value">{materiCount}</span>
              </div>
            </Link>
            <Link href="/siswa/tugas" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon bg-amber">📝</div>
              <div className="stat-info">
                <span className="label">LKPD</span>
                <span className="value">{lkpdDone}/{lkpdTotal}</span>
              </div>
            </Link>
            <Link href="/siswa/tugas" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon bg-green">✏️</div>
              <div className="stat-info">
                <span className="label">Tugas</span>
                <span className="value">{tugasDone}/{tugasTotal}</span>
              </div>
            </Link>
            <Link href="/siswa/ujian" className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon bg-indigo">🧪</div>
              <div className="stat-info">
                <span className="label">Ujian</span>
                <span className="value">{ujianDone}/{ujianTotal}</span>
              </div>
            </Link>
          </div>

          {/* Grafik pencapaian per bab */}
          <div className="card card-body">
            <h3 className="mb-3">📈 Grafik Pencapaian per Bab</h3>
            {chartData.length === 0 ? (
              <p className="text-muted text-center my-4">Belum ada data nilai.</p>
            ) : (
              <>
                <div style={{ height: '150px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '10px 0', borderBottom: '1px solid #ddd', overflowX: 'auto' }}>
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
        </div>

        <div className="d-flex flex-column gap-4">
          {/* Schedule Reminder */}
          <div className="card card-body" style={{ background: 'var(--slate-50)', borderLeft: '4px solid var(--primary)' }}>
            <h3 className="mb-3">Jadwal Kelas Hari Ini</h3>
            {jadwalHariIni.length === 0 ? (
              <p className="text-muted m-0">Tidak ada jadwal matematika hari ini.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {jadwalHariIni.map(j => (
                  <div key={j.id} className="d-flex justify-between align-center p-2 bg-white rounded border">
                    <div>
                      <strong>Guru: {j.users?.nama}</strong>
                      <div className="text-sm text-muted">Mapel Matematika</div>
                    </div>
                    <div className="badge badge-primary">{j.jam_mulai.substring(0, 5)} - {j.jam_selesai.substring(0, 5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materi Terbaru */}
          <div className="card">
            <div className="card-header"><h3>What's New (Materi Terbaru)</h3></div>
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
                      <Link href="/siswa/kelas" className="btn btn-sm btn-outline">Lihat</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
