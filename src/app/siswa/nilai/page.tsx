'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { fileUrl } from '@/lib/uploadClient';
import { generateRaporPdf } from '@/lib/raporPdf';
import { judulBab } from '@/lib/judulBab';
import { hitungKetidakhadiran, rataRapor } from '@/lib/rapor';

export default function SiswaNilai() {
  const [loading, setLoading] = useState(true);
  const [babList, setBabList] = useState<any[]>([]);
  const [ada, setAda] = useState({ lkpd: false, tugas: false, uh: false });
  const [nilaiMap, setNilaiMap] = useState<Record<string, any>>({});
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelasNama, setKelasNama] = useState('');
  const [ujianList, setUjianList] = useState<any[]>([]);

  // Rapor formal (terbit-gated)
  const [kelasId, setKelasId] = useState<string | null>(null);
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil');
  const [raporTerbit, setRaporTerbit] = useState(false);
  const [raporLoading, setRaporLoading] = useState(false);

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

  const fetchUjianSiswa = async (kId: string | null) => {
    if (!kId) {
      setUjianList([]);
      return;
    }

    const { data: ujianSiswa } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi')
      .eq('kelas_id', kId)
      .eq('is_terbit', true)
      .neq('jenis', 'UH')
      .order('created_at', { ascending: false });

    const examIds = (ujianSiswa || []).map((x: any) => x.id);
    if (examIds.length === 0) {
      setUjianList([]);
      return;
    }

    const { data: soalU } = await supabase
      .from('soal_ujian')
      .select('id, ujian_id')
      .in('ujian_id', examIds);

    const soalIds = (soalU || []).map((s: any) => s.id);
    const { data: jwU } = await supabase
      .from('jawaban_ujian')
      .select('soal_id, skor_ai, skor_final, status')
      .eq('siswa_id', SISWA_ID)
      .in('soal_id', soalIds);

    const jawabanBySoal: Record<string, any> = {};
    (jwU || []).forEach((j: any) => { jawabanBySoal[j.soal_id] = j; });

    const rows = (ujianSiswa || []).map((ujian: any) => {
      const soalExam = (soalU || []).filter((s: any) => s.ujian_id === ujian.id);
      const dijawab = soalExam
        .map((s: any) => jawabanBySoal[s.id])
        .filter(Boolean);
      const skors = dijawab.map((j: any) => Number(j.skor_final ?? j.skor_ai ?? 0));
      const semuaFinal = soalExam.length > 0 && soalExam.every((s: any) => jawabanBySoal[s.id]?.status === 'final');

      return {
        id: ujian.id,
        jenis: ujian.jenis,
        deskripsi: ujian.deskripsi,
        sudah: dijawab.length > 0,
        skor: skors.length > 0
          ? Math.round((skors.reduce((a, b) => a + b, 0) / skors.length) * 100) / 100
          : null,
        final: semuaFinal,
      };
    });

    setUjianList(rows);
  };

  const fetchNilai = async () => {
    if (!SISWA_ID) return;
    setLoading(true);
    try {
      // 1. Kelas siswa
      const { data: sk } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).limit(1);
      const kId = sk && sk.length > 0 ? sk[0].kelas_id : null;
      setKelasId(kId);

      const { data: u } = await supabase.from('users').select('nama').eq('id', SISWA_ID).single();
      if (u?.nama) setNamaSiswa(u.nama);

      let babIds: string[] = [];
      if (kId) {
        const { data: babs } = await supabase.from('bab').select('id, nomor, judul').eq('kelas_id', kId).order('nomor');
        if (babs) { setBabList(babs); babIds = babs.map((b) => b.id); }
        const { data: kls } = await supabase.from('kelas').select('nama').eq('id', kId).single();
        if (kls?.nama) setKelasNama(kls.nama);
      }

      // Deteksi komponen yang BENAR-BENAR ada → kolom "hantu" tak ditampilkan.
      if (babIds.length > 0) {
        const { data: knt } = await supabase.from('konten').select('tipe').in('bab_id', babIds);
        const tset = new Set((knt || []).map((k) => k.tipe));
        const { data: uhRows } = await supabase.from('ujian').select('id').in('bab_id', babIds).eq('jenis', 'UH');
        setAda({ lkpd: tset.has('lkpd'), tugas: tset.has('banksoal') || tset.has('evaluasi'), uh: (uhRows || []).length > 0 });
      }

      // 2. Nilai siswa (per bab)
      const { data } = await supabase.from('nilai').select('*').eq('siswa_id', SISWA_ID);
      const map: Record<string, any> = {};
      (data || []).forEach(n => { map[n.bab_id] = n; });
      setNilaiMap(map);

      // 3. Ujian UTS/UAS siswa (skor rata-rata) — UH sudah masuk ke nilai per-bab.
      await fetchUjianSiswa(kId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Unduh rapor formal (hanya aktif bila sudah diterbitkan). Ambil data segar saat diklik.
  const unduhRaporSiswa = async () => {
    if (!kelasId || !SISWA_ID) return;
    setRaporLoading(true);
    try {
      const [{ data: u }, { data: babs }, { data: nilaiRows }, { data: pres }, { data: peng }, { data: raporRow }, { data: guruK }] = await Promise.all([
        supabase.from('users').select('nama, nisn, tahun_ajaran, nama_wali').eq('id', SISWA_ID).single(),
        supabase.from('bab').select('id, nomor, judul').eq('kelas_id', kelasId).eq('semester', semester).order('nomor'),
        supabase.from('nilai').select('bab_id, nilai_akhir').eq('siswa_id', SISWA_ID),
        supabase.from('presensi').select('status, tanggal').eq('siswa_id', SISWA_ID),
        supabase.from('pengaturan').select('nama_sekolah, kop_surat, alamat, kkm').limit(1).single(),
        supabase.from('rapor').select('*').eq('kelas_id', kelasId).eq('semester', semester).maybeSingle(),
        supabase.from('guru_kelas').select('guru_id, users(nama)').eq('kelas_id', kelasId).limit(1),
      ]);

      const { data: kls } = await supabase.from('kelas').select('nama').eq('id', kelasId).single();

      let rs: any = null;
      if (raporRow?.id) {
        const { data: r } = await supabase.from('rapor_siswa').select('*').eq('rapor_id', raporRow.id).eq('siswa_id', SISWA_ID).maybeSingle();
        rs = r;
      }

      const nilaiByBab: Record<string, number | null> = {};
      (nilaiRows || []).forEach((n) => { nilaiByBab[n.bab_id] = n.nilai_akhir ?? null; });

      const guru = (guruK && guruK.length > 0) ? (guruK[0].users as unknown as { nama?: string })?.nama || '' : '';
      const ket = hitungKetidakhadiran((pres || []).map((p) => ({ status: p.status, tanggal: p.tanggal })), semester);

      await generateRaporPdf({
        namaSekolah: peng?.nama_sekolah || 'SMP Matematika',
        kopSurat: peng?.kop_surat || '',
        alamat: peng?.alamat || '',
        siswa: {
          nama: u?.nama || namaSiswa,
          nisn: u?.nisn || '-',
          kelas: kls?.nama || kelasNama,
          semester,
          tahunAjaran: u?.tahun_ajaran || raporRow?.tahun_ajaran || '',
        },
        kkm: peng?.kkm != null ? Number(peng.kkm) : 75,
        nilai: (babs || []).map((b) => ({ judul: judulBab(b.nomor, b.judul), nilaiAkhir: nilaiByBab[b.id] ?? null })),
        kegiatanPengembangan: rs?.kegiatan_pengembangan || [],
        akhlakKepribadian: rs?.akhlak_kepribadian || [],
        ketidakhadiran: ket,
        catatanWaliKelas: rs?.catatan_wali_kelas || '',
        waliKelas: guru,
        namaWali: u?.nama_wali || '',
        rataRata: rataRapor((babs || []).map((b) => nilaiByBab[b.id] ?? null)),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRaporLoading(false);
    }
  };

  useEffect(() => {
    if (SISWA_ID) fetchNilai();

    if (!SISWA_ID) return;

    // Listen to updates from Guru
    const channel = supabase.channel('siswa-nilai-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nilai', filter: `siswa_id=eq.${SISWA_ID}` }, () => {
        fetchNilai();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SISWA_ID]);

  // Status terbit rapor kelas+semester siswa.
  useEffect(() => {
    if (!kelasId) { setRaporTerbit(false); return; }
    let active = true;
    supabase
      .from('rapor')
      .select('is_terbit')
      .eq('kelas_id', kelasId)
      .eq('semester', semester)
      .maybeSingle()
      .then(({ data }) => { if (active) setRaporTerbit(!!data?.is_terbit); });
    return () => { active = false; };
  }, [kelasId, semester]);

  if (loading || userLoading) return <div className="text-center mt-4">Loading data nilai...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Nilai Saya (e-Rapor)</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Laporan hasil belajar per bab.</p>
        </div>
        <div className="d-flex align-center gap-2">
          <select className="form-control" style={{ width: 'auto' }} value={semester} onChange={(e) => setSemester(e.target.value as 'ganjil' | 'genap')}>
            <option value="ganjil">Semester Ganjil</option>
            <option value="genap">Semester Genap</option>
          </select>
          <button className="btn btn-primary" onClick={unduhRaporSiswa} disabled={!raporTerbit || raporLoading}>
            {raporLoading ? 'Menyiapkan...' : 'Unduh Rapor'}
          </button>
        </div>
      </div>

      {!raporTerbit && (
        <div className="card card-body mb-4" style={{ borderLeft: '4px solid var(--primary, #4f46e5)' }}>
          <p className="mb-0" style={{ fontSize: '14px' }}>
            Rapor akan tersedia untuk diunduh setelah wali kelas <strong>menerbitkan</strong> rapor semester ini.
          </p>
        </div>
      )}

      <div className="card card-body">
        {babList.length === 0 ? (
          <p className="text-muted text-center my-4">Belum ada bab yang tersedia untuk kelas Anda.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Bab</th>
                  {ada.lkpd && <th>LKPD</th>}
                  {ada.tugas && <th>Tugas</th>}
                  {ada.uh && <th>UH</th>}
                  <th>Keaktifan</th>
                  <th>Rata-rata</th>
                  <th>Status</th>
                  <th>Umpan Balik Guru</th>
                </tr>
              </thead>
              <tbody>
                {babList.map((b, idx) => {
                  const n = nilaiMap[b.id];
                  return (
                    <tr key={b.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{judulBab(b.nomor, b.judul)}</strong></td>
                      {ada.lkpd && <td>{n?.nilai_lkpd != null ? Number(n.nilai_lkpd).toFixed(2) : '-'}</td>}
                      {ada.tugas && <td>{n?.nilai_tugas != null ? Number(n.nilai_tugas).toFixed(2) : '-'}</td>}
                      {ada.uh && <td>{n?.nilai_uh != null ? Number(n.nilai_uh).toFixed(2) : '-'}</td>}
                      <td>{n?.nilai_keaktifan != null ? Number(n.nilai_keaktifan).toFixed(2) : '-'}</td>
                      <td>
                        {n?.nilai_akhir != null ? (
                          <span className={`font-bold ${n.nilai_akhir >= 75 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1.2rem' }}>
                            {Number(n.nilai_akhir).toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {n?.nilai_akhir != null
                          ? <span className="badge badge-success">Sudah Dinilai</span>
                          : <span className="badge badge-warning">Belum</span>}
                      </td>
                      <td>
                        {n?.umpan_balik || '-'}
                        {n?.umpan_balik_file_url && (
                          <div><a href={fileUrl(n.umpan_balik_file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary" style={{ fontSize: '13px' }}>📎 File Perbaikan</a></div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ujianList.length > 0 && (
        <div className="card card-body mt-4">
          <h4 className="mb-3">Ujian UTS / UAS</h4>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Deskripsi</th>
                  <th>Skor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ujianList.map(u => (
                  <tr key={u.id}>
                    <td>{u.jenis}</td>
                    <td>{u.deskripsi}</td>
                    <td>{u.skor != null ? u.skor : '-'}</td>
                    <td>
                      {!u.sudah ? (
                        <span className="badge badge-secondary">Belum dikerjakan</span>
                      ) : u.final ? (
                        <span className="badge badge-success">Sudah divalidasi</span>
                      ) : (
                        <span className="badge badge-warning">Menunggu validasi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
