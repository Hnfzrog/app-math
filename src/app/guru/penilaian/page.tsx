'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadImage, fileUrl } from '@/lib/uploadClient';
import { generateKopPdf } from '@/lib/pdf';

export default function GuruPenilaian() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  const [kelasList, setKelasList] = useState<any[]>([]);
  const [babList, setBabList] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState<string>('');
  const [filterBab, setFilterBab] = useState<string>('');

  const [tampilan, setTampilan] = useState<'menyeluruh' | 'tunggal'>('menyeluruh');
  const [siswaList, setSiswaList] = useState<any[]>([]);

  // Tunggal: input nilai per siswa untuk bab yang dipilih
  const [formInput, setFormInput] = useState<Record<string, { skor_benar: number, skor_presensi: number, umpan_balik: string, umpan_balik_foto_url: string }>>({});
  const [pendingFoto, setPendingFoto] = useState<Record<string, File | null>>({});
  const [showJawabanModal, setShowJawabanModal] = useState(false);
  const [jawabanList, setJawabanList] = useState<any[]>([]);
  const [jawabanSiswaNama, setJawabanSiswaNama] = useState('');
  const [loadingJawaban, setLoadingJawaban] = useState(false);

  // Menyeluruh: matrix nilai per siswa per bab
  const [nilaiMatrix, setNilaiMatrix] = useState<Record<string, any>>({});

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) fetchKelas();
  }, [userId]);

  useEffect(() => {
    if (filterKelas) {
      fetchBabDanSiswa();
    } else {
      setBabList([]);
      setSiswaList([]);
      setNilaiMatrix({});
      setFormInput({});
    }
  }, [filterKelas]);

  useEffect(() => {
    if (!filterKelas) return;
    if (tampilan === 'tunggal' && filterBab) {
      fetchNilaiBab();
    } else if (tampilan === 'menyeluruh') {
      fetchNilaiMenyeluruh();
    }
  }, [tampilan, filterBab, siswaList]);

  const fetchKelas = async () => {
    const { data } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama)')
      .eq('guru_id', userId);

    if (data) {
      // @ts-ignore
      setKelasList(data.map(gk => gk.kelas).filter(Boolean));
    }
    setLoading(false);
  };

  const fetchBabDanSiswa = async () => {
    setLoading(true);
    const { data: babs } = await supabase.from('bab').select('id, nomor, judul').eq('kelas_id', filterKelas).order('nomor');
    if (babs) setBabList(babs);

    const { data: dataSiswa } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama, nisn)')
      .eq('kelas_id', filterKelas);

    if (dataSiswa) {
      const formatted = dataSiswa.map((s: any) => ({
        id: s.siswa_id,
        nama: s.users?.nama || 'Unknown',
        nisn: s.users?.nisn || '-'
      }));
      setSiswaList(formatted);
    }
    setLoading(false);
  };

  const fetchNilaiBab = async () => {
    const { data } = await supabase.from('nilai').select('*').eq('bab_id', filterBab);
    const formMap: Record<string, any> = {};
    siswaList.forEach(s => {
      const n = data?.find(x => x.siswa_id === s.id);
      formMap[s.id] = {
        skor_benar: n ? n.skor_benar : 0,
        skor_presensi: n ? n.skor_presensi : 0,
        umpan_balik: n ? n.umpan_balik || '' : '',
        umpan_balik_foto_url: n ? n.umpan_balik_foto_url || '' : ''
      };
    });
    setFormInput(formMap);
  };

  const fetchNilaiMenyeluruh = async () => {
    const ids = siswaList.map(s => s.id);
    if (ids.length === 0) { setNilaiMatrix({}); return; }
    const { data } = await supabase.from('nilai').select('siswa_id, bab_id, nilai_akhir').in('siswa_id', ids);
    const matrix: Record<string, any> = {};
    siswaList.forEach(s => { matrix[s.id] = { nama: s.nama, nisn: s.nisn, bab: {} }; });
    (data || []).forEach(n => {
      if (matrix[n.siswa_id]) matrix[n.siswa_id].bab[n.bab_id] = n.nilai_akhir;
    });
    setNilaiMatrix(matrix);
  };

  const bukaJawaban = async (siswaId: string, siswaNama: string) => {
    setJawabanSiswaNama(siswaNama);
    setJawabanList([]);
    setShowJawabanModal(true);
    setLoadingJawaban(true);
    // Ambil soal dari konten di bab yang dipilih
    const { data: konten } = await supabase.from('konten').select('id').eq('bab_id', filterBab);
    const kontenIds = (konten || []).map((k: any) => k.id);
    if (kontenIds.length === 0) { setLoadingJawaban(false); return; }
    const { data: soals } = await supabase.from('soal').select('id, pertanyaan, tipe').in('konten_id', kontenIds);
    const soalIds = (soals || []).map((s: any) => s.id);
    if (soalIds.length === 0) { setLoadingJawaban(false); return; }
    const { data: jw } = await supabase.from('jawaban_siswa').select('*').eq('siswa_id', siswaId).in('soal_id', soalIds);
    const list = (jw || []).map((j: any) => {
      const soal = (soals || []).find((s: any) => s.id === j.soal_id);
      return { ...j, pertanyaan: soal?.pertanyaan?.split('|||')[0] || '-', tipe: soal?.tipe };
    });
    setJawabanList(list);
    setLoadingJawaban(false);
  };

  const handleInputChange = (siswaId: string, field: string, value: string | number) => {    setFormInput(prev => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        [field]: value
      }
    }));
  };

  const hitungNilaiAkhir = (skorBenar: number, skorPresensi: number) => {
    return (skorBenar * 0.9) + (skorPresensi * 0.1);
  };

  const handleSimpanSemua = async () => {
    if (!filterKelas) return;
    if (tampilan === 'tunggal' && !filterBab) {
      customAlert('Pilih bab terlebih dahulu!', true);
      return;
    }
    setSaving(true);
    try {
      if (tampilan === 'tunggal') {
        for (const s of siswaList) {
          const input = formInput[s.id] || { skor_benar: 0, skor_presensi: 0, umpan_balik: '', umpan_balik_foto_url: '' };
          const nAkhir = hitungNilaiAkhir(input.skor_benar, input.skor_presensi);
          const pendingFile = pendingFoto[s.id];
          let fotoKey: string | null = input.umpan_balik_foto_url || null;
          if (pendingFile) {
            fotoKey = await uploadImage(pendingFile, 'umpan-balik');
          }
          const payload = {
            siswa_id: s.id,
            bab_id: filterBab,
            skor_benar: input.skor_benar,
            skor_presensi: input.skor_presensi,
            nilai_akhir: nAkhir,
            umpan_balik: input.umpan_balik,
            umpan_balik_foto_url: fotoKey
          };
          const { data: exist } = await supabase.from('nilai').select('id').eq('siswa_id', s.id).eq('bab_id', filterBab).limit(1);
          if (exist && exist.length > 0) {
            await supabase.from('nilai').update(payload).eq('id', exist[0].id);
          } else {
            await supabase.from('nilai').insert(payload);
          }
        }
      }
      customAlert('Nilai berhasil disimpan!', false);
    } catch (e: any) {
      customAlert('Gagal simpan nilai: ' + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filterKelas) return;
    const kelasNama = kelasList.find(k => k.id === filterKelas)?.nama || '';

    if (tampilan === 'menyeluruh') {
      const columns = ['No', 'Nama Siswa', ...babList.map(b => `Bab ${b.nomor}`), 'Rata-rata'];
      const rows = siswaList.map((s, i) => {
        const row = nilaiMatrix[s.id] || { bab: {} };
        const vals = babList.map(b => row.bab[b.id]).filter(v => v != null).map(Number);
        const rata = vals.length > 0 ? (vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(2) : '-';
        return [
          i + 1,
          s.nama,
          ...babList.map(b => row.bab[b.id] != null ? Number(row.bab[b.id]).toFixed(2) : '-'),
          rata
        ];
      });
      await generateKopPdf({ title: `Daftar Nilai Menyeluruh Kelas ${kelasNama}`, columns, rows, filename: 'nilai-menyeluruh.pdf' });
    } else {
      const babNama = babList.find(b => b.id === filterBab)?.judul || '';
      const columns = ['No', 'Nama Siswa', 'Skor Benar', 'Skor Presensi', 'Nilai Akhir', 'Umpan Balik'];
      const rows = siswaList.map((s, i) => {
        const input = formInput[s.id] || { skor_benar: 0, skor_presensi: 0, umpan_balik: '' };
        const nAkhir = hitungNilaiAkhir(input.skor_benar, input.skor_presensi);
        return [i + 1, s.nama, String(input.skor_benar ?? 0), String(input.skor_presensi ?? 0), nAkhir.toFixed(2), input.umpan_balik || '-'];
      });
      await generateKopPdf({ title: `Penilaian ${babNama} — Kelas ${kelasNama}`, columns, rows, filename: 'penilaian.pdf' });
    }
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Penilaian & Evaluasi</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Input Nilai Akhir: (Skor Benar × 90%) + (Skor Presensi × 10%)</p>
        </div>
        <button onClick={handleExportPDF} className="btn btn-primary" disabled={!filterKelas}>Export PDF</button>
      </div>

      <div className="card card-body mb-4 hide-on-print">
        <div className="grid-2 align-center">
          <div className="form-group mb-0">
            <label>Pilih Kelas</label>
            <select
              className="form-control"
              value={filterKelas}
              onChange={e => { setFilterKelas(e.target.value); setFilterBab(''); }}
            >
              <option value="">-- Pilih Kelas --</option>
              {kelasList.map(k => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label>Tampilan</label>
            <select
              className="form-control"
              value={tampilan}
              onChange={e => setTampilan(e.target.value as any)}
            >
              <option value="menyeluruh">Tabel Menyeluruh (Semua Bab)</option>
              <option value="tunggal">Tunggal (Per Bab)</option>
            </select>
          </div>
        </div>

        {tampilan === 'tunggal' && (
          <div className="form-group mt-3 mb-0">
            <label>Pilih Bab</label>
            <select className="form-control" value={filterBab} onChange={e => setFilterBab(e.target.value)}>
              <option value="">-- Pilih Bab --</option>
              {babList.map(b => (
                <option key={b.id} value={b.id}>{b.nomor}. {b.judul}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center my-4">Memuat data...</p>
      ) : !filterKelas ? (
        <p className="text-center text-muted my-4 card card-body">Silakan pilih kelas terlebih dahulu.</p>
      ) : siswaList.length === 0 ? (
        <p className="text-center text-muted my-4 card card-body">Belum ada siswa di kelas ini.</p>
      ) : tampilan === 'menyeluruh' ? (
        <div className="card card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Siswa (NISN)</th>
                  {babList.map(b => <th key={b.id}>{b.nomor}. {b.judul}</th>)}
                  <th>Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((s, idx) => {
                  const row = nilaiMatrix[s.id] || { bab: {} };
                  const vals = babList.map(b => row.bab[b.id]).filter(v => v !== undefined && v !== null).map(Number);
                  const rata = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                  return (
                    <tr key={s.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{s.nama}</strong><br />
                        <small className="text-muted">{s.nisn}</small>
                      </td>
                      {babList.map(b => (
                        <td key={b.id}>
                          {row.bab[b.id] !== undefined && row.bab[b.id] !== null ? Number(row.bab[b.id]).toFixed(2) : '-'}
                        </td>
                      ))}
                      <td>
                        <strong>{rata !== null ? rata.toFixed(2) : '-'}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Tampilan Tunggal (per bab)
        <>
          {!filterBab ? (
            <p className="text-center text-muted my-4 card card-body">Silakan pilih bab terlebih dahulu.</p>
          ) : (
            <div className="d-flex flex-column gap-4">
              {siswaList.map((s, idx) => {
                const input = formInput[s.id] || { skor_benar: 0, skor_presensi: 0, umpan_balik: '' };
                const nAkhir = hitungNilaiAkhir(input.skor_benar, input.skor_presensi);

                return (
                  <div key={s.id} className="card card-body" style={{ pageBreakInside: 'avoid' }}>
                    <h3 className="mb-3 border-bottom pb-2">Lembar Penilaian Siswa</h3>

                    <div className="grid-2 mb-4">
                      <div>
                        <p className="mb-1"><strong>Nama:</strong> {s.nama}</p>
                        <p className="mb-1"><strong>NISN:</strong> {s.nisn}</p>
                        <button type="button" className="btn btn-sm btn-outline mt-2 hide-on-print" onClick={() => bukaJawaban(s.id, s.nama)}>📄 Lihat Jawaban Siswa</button>
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className={nAkhir >= 75 ? 'text-success' : 'text-danger'}>
                          Nilai Akhir: {nAkhir.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid-2 gap-4">
                      <div className="form-group">
                        <label>Skor Benar Ujian / Tugas</label>
                        <input
                          type="number"
                          className="form-control hide-on-print"
                          value={input.skor_benar}
                          onChange={e => handleInputChange(s.id, 'skor_benar', parseFloat(e.target.value) || 0)}
                        />
                        <p className="print-only mb-0" style={{ display: 'none', borderBottom: '1px dotted #000' }}>{input.skor_benar}</p>
                        <small className="text-muted">Bobot: 90%</small>
                      </div>

                      <div className="form-group">
                        <label>Skor Presensi (Kehadiran)</label>
                        <input
                          type="number"
                          className="form-control hide-on-print"
                          value={input.skor_presensi}
                          onChange={e => handleInputChange(s.id, 'skor_presensi', parseFloat(e.target.value) || 0)}
                        />
                        <p className="print-only mb-0" style={{ display: 'none', borderBottom: '1px dotted #000' }}>{input.skor_presensi}</p>
                        <small className="text-muted">Bobot: 10%</small>
                      </div>
                    </div>

                    <div className="form-group mt-3">
                      <label>Feedback / Umpan Balik Guru</label>
                      <textarea
                        className="form-control hide-on-print"
                        rows={3}
                        value={input.umpan_balik}
                        onChange={e => handleInputChange(s.id, 'umpan_balik', e.target.value)}
                        placeholder="Contoh: Tingkatkan lagi belajarnya..."
                      ></textarea>
                      <p className="print-only mb-0" style={{ display: 'none', minHeight: '60px', border: '1px solid #ddd', padding: '8px' }}>
                        {input.umpan_balik || '-'}
                      </p>
                    </div>

                    <div className="form-group mt-2 hide-on-print">
                      <label>Foto Umpan Balik (opsional)</label>
                      <PhotoUpload value={input.umpan_balik_foto_url || null} onFileChange={(file) => setPendingFoto(prev => ({ ...prev, [s.id]: file }))} label="Foto Umpan Balik" />
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 text-right hide-on-print">
                <button onClick={handleSimpanSemua} disabled={saving} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                  {saving ? 'Menyimpan...' : 'Simpan Semua Nilai'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Lihat Jawaban Siswa */}
      {showJawabanModal && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Jawaban: {jawabanSiswaNama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowJawabanModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {loadingJawaban ? (
                <p className="text-center my-4">Memuat jawaban...</p>
              ) : jawabanList.length === 0 ? (
                <p className="text-muted text-center my-4">Siswa ini belum mengumpulkan jawaban untuk bab ini.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {jawabanList.map((j, i) => (
                    <div key={j.id} className="p-3 border rounded">
                      <p className="mb-1"><strong>Soal {i + 1}:</strong> {j.pertanyaan}</p>
                      <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>Jawaban: {j.jawaban}</p>
                      {j.skor_ai != null && <span className="badge badge-info">Skor AI: {j.skor_ai}</span>}
                      {j.file_url && (
                        <div className="mt-2">
                          <a href={fileUrl(j.file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat Lampiran Jawaban</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styles for print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .hide-on-print { display: none !important; }
          .print-only { display: block !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 2rem !important; }
          .table th { background-color: #f1f5f9 !important; color: #0f172a !important; }
          body { background: white; }
          @page { margin: 1cm; }
        }
      `}} />
    </div>
  );
}
