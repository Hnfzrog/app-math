'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { fileUrl } from '@/lib/uploadClient';
import { generateKopPdf } from '@/lib/pdf';

export default function SiswaNilai() {
  const [loading, setLoading] = useState(true);
  const [babList, setBabList] = useState<any[]>([]);
  const [nilaiMap, setNilaiMap] = useState<Record<string, any>>({});
  const [allBabDone, setAllBabDone] = useState(false);
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelasNama, setKelasNama] = useState('');
  const [ujianList, setUjianList] = useState<any[]>([]);

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

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
  }, [SISWA_ID]);

  const fetchNilai = async () => {
    if (!SISWA_ID) return;
    setLoading(true);
    try {
      // 1. Kelas siswa
      const { data: sk } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).limit(1);
      const kelasId = sk && sk.length > 0 ? sk[0].kelas_id : null;

      const { data: u } = await supabase.from('users').select('nama').eq('id', SISWA_ID).single();
      if (u?.nama) setNamaSiswa(u.nama);

      if (kelasId) {
        const { data: babs } = await supabase.from('bab').select('id, nomor, judul').eq('kelas_id', kelasId).order('nomor');
        if (babs) setBabList(babs);
        const { data: kls } = await supabase.from('kelas').select('nama').eq('id', kelasId).single();
        if (kls?.nama) setKelasNama(kls.nama);
      }

      // 2. Nilai siswa (per bab)
      const { data } = await supabase.from('nilai').select('*').eq('siswa_id', SISWA_ID);
      const map: Record<string, any> = {};
      (data || []).forEach(n => { map[n.bab_id] = n; });
      setNilaiMap(map);

      // 3. Ujian UTS/UAS siswa (skor rata-rata) — UH sudah masuk ke nilai per-bab.
      await fetchUjianSiswa(kelasId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUjianSiswa = async (kelasId: string | null) => {
    if (!kelasId) {
      setUjianList([]);
      return;
    }

    const { data: ujianSiswa } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi')
      .eq('kelas_id', kelasId)
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

  // e-Rapor tersedia otomatis jika semua bab sudah dinilai
  useEffect(() => {
    setAllBabDone(babList.length > 0 && babList.every(b => nilaiMap[b.id]?.nilai_akhir != null));
  }, [babList, nilaiMap]);

  const handleCetakPDF = async () => {
    const columns = ['No', 'Bab', 'Skor Benar', 'Skor Presensi', 'Nilai Akhir', 'Umpan Balik'];
    const rows = babList.map((b, i) => {
      const n = nilaiMap[b.id];
      return [
        i + 1,
        `${b.nomor}. ${b.judul}`,
        n?.skor_benar != null ? String(n.skor_benar) : '-',
        n?.skor_presensi != null ? String(n.skor_presensi) : '-',
        n?.nilai_akhir != null ? Number(n.nilai_akhir).toFixed(2) : '-',
        n?.umpan_balik || '-'
      ];
    });
    const vals = babList.map(b => nilaiMap[b.id]?.nilai_akhir).filter(v => v != null).map(Number);
    const rata = vals.length > 0 ? (vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(2) : '-';
    rows.push(['', '', '', '', '', '']);
    rows.push(['', 'Rata-rata', '', '', rata, '']);
    await generateKopPdf({
      title: 'e-Rapor Siswa',
      subtitle: `${namaSiswa}${kelasNama ? ' — Kelas ' + kelasNama : ''}`,
      columns,
      rows,
      filename: 'e-rapor.pdf'
    });
  };

  if (loading || userLoading) return <div className="text-center mt-4">Loading data nilai...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Nilai Saya (e-Rapor)</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Laporan hasil belajar per bab.</p>
        </div>
        {allBabDone && (
          <button onClick={handleCetakPDF} className="btn btn-primary">Cetak e-Rapor PDF</button>
        )}
      </div>

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
                  <th>Skor Benar</th>
                  <th>Skor Presensi</th>
                  <th>Nilai Akhir</th>
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
                      <td><strong>{b.nomor}. {b.judul}</strong></td>
                      <td>{n?.skor_benar ?? '-'}</td>
                      <td>{n?.skor_presensi ?? '-'}</td>
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

            {!allBabDone && (
              <p className="text-muted mt-3" style={{ fontSize: '13px' }}>
                e-Rapor (PDF) akan tersedia otomatis setelah semua bab selesai dinilai oleh guru.
              </p>
            )}
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
