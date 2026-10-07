'use client';
import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { uploadFile, fileUrl } from '@/lib/uploadClient';
import Link from 'next/link';

type Siswa = { id: string; nama: string; nisn: string };

// Skor >= ambang dianggap "benar" (untuk hitungan benar/salah yang ditampilkan).
const BENAR_THRESHOLD = 70;

export default function GuruUjianHasil({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const ujianId = unwrappedParams.id;

  const [loading, setLoading] = useState(true);
  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [kunciMap, setKunciMap] = useState<Record<string, string>>({});
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  // jawabanMap[siswa_id][soal_id] = baris jawaban_ujian
  const [jawabanMap, setJawabanMap] = useState<Record<string, Record<string, any>>>({});
  // nilaiEdit[jawaban_id] = skor_final yang diketik/di-toggle guru
  const [nilaiEdit, setNilaiEdit] = useState<Record<string, string>>({});
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal Penilaian per siswa (kiri jawaban / kanan panel guru)
  const [penilaianSiswa, setPenilaianSiswa] = useState<Siswa | null>(null);

  // Feedback guru per siswa (ujian_feedback)
  const [feedbackMap, setFeedbackMap] = useState<Record<string, any>>({});
  const [fbSiswa, setFbSiswa] = useState<Siswa | null>(null);
  const [fbText, setFbText] = useState('');
  const [fbFile, setFbFile] = useState<File | null>(null);
  const [fbLink, setFbLink] = useState('');
  const [savingFb, setSavingFb] = useState(false);

  useEffect(() => {
    fetchData();
  }, [ujianId]);

  const fetchData = async () => {
    setLoading(true);

    const { data: dataUjian } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi, durasi_menit, kelas_id, bab_id, kelas(nama)')
      .eq('id', ujianId)
      .single();

    if (!dataUjian) {
      setLoading(false);
      return;
    }
    setUjian(dataUjian);

    const { data: dataSoal } = await supabase
      .from('soal_ujian')
      .select('id, pertanyaan, tipe, opsi, butuh_foto_jawaban, lampiran_url')
      .eq('ujian_id', ujianId)
      .order('created_at', { ascending: true });

    const soal = dataSoal || [];
    setSoalList(soal);

    const soalIds = soal.map((s) => s.id);

    // Kunci jawaban (guru pengampu kelas ini boleh membacanya)
    if (soalIds.length > 0) {
      const { data: kunci } = await supabase
        .from('soal_ujian_kunci')
        .select('soal_id, kunci_jawaban')
        .in('soal_id', soalIds);

      const map: Record<string, string> = {};
      (kunci || []).forEach((k) => { map[k.soal_id] = k.kunci_jawaban; });
      setKunciMap(map);
    }

    // Daftar siswa kelas ujian ini
    const { data: dataSiswa } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama, nisn)')
      .eq('kelas_id', dataUjian.kelas_id);

    const siswa: Siswa[] = (dataSiswa || [])
      .map((s) => {
        const u = s.users as unknown as { nama?: string; nisn?: string } | null;
        return { id: s.siswa_id, nama: u?.nama || '(tanpa nama)', nisn: u?.nisn || '' };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
    setSiswaList(siswa);

    // Semua jawaban untuk soal-soal ujian ini (policy guru: hanya ujian kelasnya)
    if (soalIds.length > 0) {
      const { data: jawaban } = await supabase
        .from('jawaban_ujian')
        .select('*')
        .in('soal_id', soalIds);

      const map: Record<string, Record<string, any>> = {};
      (jawaban || []).forEach((j) => {
        if (!map[j.siswa_id]) map[j.siswa_id] = {};
        map[j.siswa_id][j.soal_id] = j;
      });
      setJawabanMap(map);
    } else {
      setJawabanMap({});
    }

    // Feedback guru per siswa (ujian_feedback)
    const { data: fb } = await supabase.from('ujian_feedback').select('*').eq('ujian_id', ujianId);
    const fbMap: Record<string, any> = {};
    (fb || []).forEach((f) => { fbMap[f.siswa_id] = f; });
    setFeedbackMap(fbMap);

    setLoading(false);
  };

  const jawabanSiswa = (siswaId: string) => jawabanMap[siswaId] || {};
  const sudahMengerjakan = (siswaId: string) => Object.keys(jawabanSiswa(siswaId)).length > 0;

  // pg disimpan sebagai teks opsi; multi-jawaban disimpan sebagai JSON array.
  const formatJawaban = (teks: string | null | undefined): string => {
    if (!teks) return '(kosong)';
    if (teks.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(teks);
        if (Array.isArray(arr)) return arr.length > 0 ? arr.join(', ') : '(kosong)';
      } catch { /* bukan JSON, tampilkan apa adanya */ }
    }
    return teks;
  };

  // Skor efektif: hasil edit guru → skor_final tersimpan → skor AI.
  const skorEfektif = (j: any): number | null => {
    if (!j) return null;
    const edited = nilaiEdit[j.id];
    if (edited !== undefined && edited !== '') {
      const n = parseFloat(edited);
      return Number.isNaN(n) ? null : n;
    }
    if (j.skor_final != null) return Number(j.skor_final);
    if (j.skor_ai != null) return Number(j.skor_ai);
    return null;
  };

  const hitungBenarSalah = (siswaId: string) => {
    const jw = jawabanSiswa(siswaId);
    let benar = 0, salah = 0;
    soalList.forEach((soal) => {
      const j = jw[soal.id];
      if (!j) return;
      const skor = skorEfektif(j);
      if (skor == null) return;
      if (skor >= BENAR_THRESHOLD) benar++;
      else salah++;
    });
    return { benar, salah };
  };

  // Skor otomatis 0/100 untuk pilgan (skor_ai), dan rubrik AI untuk esai.
  const toggleBenarSalah = (jawabanId: string, benar: boolean) => {
    setNilaiEdit((prev) => ({ ...prev, [jawabanId]: benar ? '100' : '0' }));
  };

  const togglePilih = (siswaId: string) => {
    setTerpilih((prev) => (prev.includes(siswaId) ? prev.filter((s) => s !== siswaId) : [...prev, siswaId]));
  };

  const siswaBisaValidasi = siswaList.filter((s) => sudahMengerjakan(s.id));
  const semuaTerpilih = siswaBisaValidasi.length > 0 && terpilih.length === siswaBisaValidasi.length;

  const togglePilihSemua = () => {
    setTerpilih(semuaTerpilih ? [] : siswaBisaValidasi.map((s) => s.id));
  };

  const validasi = async (siswaIds: string[]) => {
    const rows: { id: string; skor_final: number; status: string; dinilai_at: string }[] = [];
    const dinilaiAt = new Date().toISOString();

    for (const siswaId of siswaIds) {
      const jw = jawabanSiswa(siswaId);
      for (const soal of soalList) {
        const j = jw[soal.id];
        if (!j) continue;

        const edited = nilaiEdit[j.id];
        const skorFinal = edited !== undefined && edited !== ''
          ? parseFloat(edited)
          : (j.skor_final ?? j.skor_ai ?? 0);

        rows.push({
          id: j.id,
          skor_final: Number.isNaN(skorFinal) ? 0 : skorFinal,
          status: 'final',
          dinilai_at: dinilaiAt,
        });
      }
    }

    if (rows.length === 0) {
      customAlert('Tidak ada jawaban yang bisa divalidasi.', true);
      return;
    }

    setSaving(true);

    // Dijalankan paralel — satu kelas bisa berarti ratusan baris jawaban.
    const hasilUpdate = await Promise.all(
      rows.map((r) =>
        supabase
          .from('jawaban_ujian')
          .update({ skor_final: r.skor_final, status: r.status, dinilai_at: r.dinilai_at })
          .eq('id', r.id)
      )
    );

    const gagal = hasilUpdate.find((h) => h.error);

    if (gagal?.error) {
      setSaving(false);
      setTerpilih([]);
      fetchData();
      customAlert('Sebagian nilai gagal divalidasi: ' + gagal.error.message, true);
      return;
    }

    // UH: masukkan rata-rata skor ujian ke komponen UH pada nilai per-bab (nilai_uh),
    // supaya muncul di menu Penilaian (guru) dan Nilai Saya (siswa). UTS/UAS tidak punya bab_id.
    if (ujian?.bab_id && ujian.jenis === 'UH') {
      const finalByJawaban = new Map(rows.map((r) => [r.id, r.skor_final]));
      const nilaiRows = siswaIds.map((siswaId) => {
        const jw = jawabanSiswa(siswaId);
        const skors: number[] = [];
        soalList.forEach((soal) => {
          const j = jw[soal.id];
          if (!j) return;
          const n = finalByJawaban.get(j.id);
          if (n != null) skors.push(n);
        });
        const rata = skors.length > 0 ? skors.reduce((a, b) => a + b, 0) / skors.length : 0;
        return {
          siswa_id: siswaId,
          bab_id: ujian.bab_id,
          nilai_uh: Math.round(rata * 100) / 100,
        };
      });

      const { error: nilaiError } = await supabase
        .from('nilai')
        .upsert(nilaiRows, { onConflict: 'siswa_id,bab_id' });

      if (nilaiError) {
        setSaving(false);
        setTerpilih([]);
        fetchData();
        customAlert('Jawaban tervalidasi, tapi gagal menyimpan ke nilai: ' + nilaiError.message, true);
        return;
      }
    }

    setSaving(false);
    setTerpilih([]);
    setPenilaianSiswa(null);
    fetchData();
    customAlert(`${siswaIds.length} siswa berhasil dinilai.`, false);
  };

  const bukaPenilaian = (siswa: Siswa) => {
    setPenilaianSiswa(siswa);
  };

  const bukaFeedback = (siswa: Siswa) => {
    setFbSiswa(siswa);
    setFbText(feedbackMap[siswa.id]?.umpan_balik || '');
    setFbFile(null);
    setFbLink('');
  };

  const simpanFeedback = async () => {
    if (!fbSiswa) return;
    const current = feedbackMap[fbSiswa.id] || { file_url: null };
    let fileKey: string | null = current.file_url || null;
    setSavingFb(true);
    try {
      if (fbFile) fileKey = await uploadFile(fbFile, 'ujian-feedback');
      else if (fbLink) fileKey = fbLink;
    } catch (e) {
      setSavingFb(false);
      customAlert('Gagal upload file feedback: ' + (e instanceof Error ? e.message : String(e)), true);
      return;
    }
    const { error } = await supabase.from('ujian_feedback').upsert({
      ujian_id: ujianId,
      siswa_id: fbSiswa.id,
      umpan_balik: fbText,
      file_url: fileKey,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ujian_id,siswa_id' });
    setSavingFb(false);
    if (error) { customAlert('Gagal simpan feedback: ' + error.message, true); return; }
    customAlert('Feedback tersimpan.', false);
    const { data: fb } = await supabase.from('ujian_feedback').select('*').eq('ujian_id', ujianId);
    const fbMap: Record<string, any> = {};
    (fb || []).forEach((f) => { fbMap[f.siswa_id] = f; });
    setFeedbackMap(fbMap);
    setFbSiswa(null);
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!ujian) return <div className="p-4 text-center">Ujian tidak ditemukan.</div>;

  const jwPenilaian = penilaianSiswa ? jawabanSiswa(penilaianSiswa.id) : {};
  const ringkasPenilaian = penilaianSiswa ? hitungBenarSalah(penilaianSiswa.id) : { benar: 0, salah: 0 };

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href={`/guru/ujian/${ujianId}`} className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <div>
            <h2 style={{ margin: 0 }}>Penilaian Ujian</h2>
            <p className="text-muted mb-0 text-sm">
              {ujian.kelas?.nama} — {ujian.jenis}{ujian.deskripsi ? ` — ${ujian.deskripsi}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="card card-body mb-4">
        <div className="d-flex justify-between align-center">
          <label className="d-flex align-center gap-2" style={{ cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" checked={semuaTerpilih} onChange={togglePilihSemua} style={{ transform: 'scale(1.2)' }} />
            <span className="font-bold">Pilih semua ({siswaBisaValidasi.length} siswa mengerjakan)</span>
          </label>
          <button className="btn btn-primary" onClick={() => validasi(terpilih)} disabled={saving || terpilih.length === 0}>
            {saving ? 'Menyimpan...' : `Simpan Penilaian ${terpilih.length} Siswa`}
          </button>
        </div>
      </div>

      {siswaList.length === 0 ? (
        <div className="card card-body">
          <p className="text-center text-muted my-4">Belum ada siswa di kelas ini.</p>
        </div>
      ) : (
        <div className="card card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={semuaTerpilih} onChange={togglePilihSemua} />
                  </th>
                  <th>Nama Siswa</th>
                  <th>Benar / Salah</th>
                  <th>Rata-rata</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((siswa) => {
                  const mengerjakan = sudahMengerjakan(siswa.id);
                  const bs = hitungBenarSalah(siswa.id);
                  const jw = jawabanSiswa(siswa.id);
                  const semuaFinal = mengerjakan && soalList.every((soal) => !jw[soal.id] || jw[soal.id].status === 'final');
                  const skors = soalList.map((soal) => skorEfektif(jw[soal.id])).filter((v): v is number => v != null);
                  const rata = skors.length > 0 ? skors.reduce((a, b) => a + b, 0) / skors.length : null;
                  return (
                    <tr key={siswa.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={terpilih.includes(siswa.id)}
                          disabled={!mengerjakan}
                          onChange={() => togglePilih(siswa.id)}
                        />
                      </td>
                      <td>
                        <strong>{siswa.nama}</strong>
                        {!mengerjakan && <div><span className="badge badge-secondary">belum mengerjakan</span></div>}
                      </td>
                      <td>
                        {mengerjakan
                          ? <span><span className="badge badge-success">✔ {bs.benar}</span> <span className="badge badge-danger">✘ {bs.salah}</span></span>
                          : '-'}
                      </td>
                      <td>{rata != null ? rata.toFixed(2) : '-'}</td>
                      <td>
                        {mengerjakan && (
                          <span className={`badge ${semuaFinal ? 'badge-success' : 'badge-warning'}`}>
                            {semuaFinal ? 'FINAL' : 'PENDING'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-primary" disabled={!mengerjakan} onClick={() => bukaPenilaian(siswa)}>Penilaian</button>
                          <button className="btn btn-sm btn-outline" disabled={!mengerjakan} onClick={() => bukaFeedback(siswa)}>Feedback</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal PENILAIAN — kiri jawaban siswa / kanan panel guru */}
      {penilaianSiswa && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '980px' }}>
            <div className="modal-header">
              <h3>Penilaian — {penilaianSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setPenilaianSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="d-flex justify-between align-center mb-3">
                <span className="badge badge-success">✔ Benar: {ringkasPenilaian.benar}</span>
                <span className="badge badge-danger">✘ Salah: {ringkasPenilaian.salah}</span>
              </div>

              <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                {soalList.map((soal, idx) => {
                  const j = jwPenilaian[soal.id];
                  const kunci = kunciMap[soal.id];
                  const skor = skorEfektif(j);
                  const dianggapBenar = skor != null && skor >= BENAR_THRESHOLD;
                  return (
                    <div key={soal.id} className="mb-3" style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
                      <p className="mb-2">
                        <strong>Soal {idx + 1}</strong>
                        <span className={`badge ${soal.tipe === 'pg' ? 'badge-primary' : 'badge-secondary'} text-sm`} style={{ marginLeft: '8px' }}>
                          {soal.tipe === 'pg' ? 'Pilgan' : 'Esai'}
                        </span>
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* KIRI — jawaban siswa */}
                        <div>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{soal.pertanyaan}</p>
                          {!j ? (
                            <p className="text-muted mb-0">Tidak dijawab.</p>
                          ) : (
                            <>
                              <p className="mb-1">
                                <strong>Jawaban siswa:</strong>{' '}
                                <span style={{ whiteSpace: 'pre-wrap' }}>{formatJawaban(j.jawaban_teks)}</span>
                              </p>
                              {kunci && (
                                <p className="mb-1 text-sm">
                                  <strong>Kunci/rubrik:</strong>{' '}
                                  <span style={{ whiteSpace: 'pre-wrap' }}>{formatJawaban(kunci)}</span>
                                </p>
                              )}
                              {soal.tipe === 'uraian' && j.feedback_ai && (
                                <p className="mb-1 text-sm">
                                  <span className="badge badge-primary">Skor AI: {j.skor_ai ?? '-'}</span>{' '}
                                  <span style={{ whiteSpace: 'pre-wrap' }}>{j.feedback_ai}</span>
                                </p>
                              )}
                              {j.foto_url && (
                                <p className="mb-0">
                                  <a href={fileUrl(j.foto_url)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat Bukti Jawaban</a>
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* KANAN — panel penilaian guru */}
                        <div>
                          <p className="mb-1 text-sm text-muted">Periksa hasil deteksi AI, tandai benar/salah, koreksi skor bila perlu.</p>
                          <div className="d-flex gap-2 mb-2">
                            <button
                              type="button"
                              className={`btn btn-sm ${dianggapBenar ? 'btn-success' : 'btn-outline'}`}
                              disabled={!j}
                              onClick={() => j && toggleBenarSalah(j.id, true)}
                            >
                              ✔ Benar
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${skor != null && !dianggapBenar ? 'btn-danger' : 'btn-outline'}`}
                              disabled={!j}
                              onClick={() => j && toggleBenarSalah(j.id, false)}
                            >
                              ✘ Salah
                            </button>
                          </div>
                          <label className="mb-0 text-sm"><strong>Skor final:</strong></label>
                          <input
                            type="number"
                            className="form-control"
                            style={{ maxWidth: '110px' }}
                            min={0}
                            max={100}
                            disabled={!j}
                            value={nilaiEdit[j?.id ?? ''] ?? (skor != null ? String(skor) : '')}
                            onChange={(e) => j && setNilaiEdit((prev) => ({ ...prev, [j.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-between mt-3">
                <button type="button" className="btn btn-secondary" onClick={() => setPenilaianSiswa(null)}>Tutup</button>
                <button type="button" className="btn btn-success" onClick={() => validasi([penilaianSiswa.id])} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Penilaian Siswa Ini'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal FEEDBACK */}
      {fbSiswa && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>Feedback — {fbSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setFbSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Umpan Balik</label>
                <textarea className="form-control" rows={4} value={fbText} onChange={(e) => setFbText(e.target.value)} placeholder="Catatan / perbaikan untuk siswa..." />
              </div>
              <div className="form-group">
                <label>File Perbaikan (opsional)</label>
                {feedbackMap[fbSiswa.id]?.file_url && (
                  <div className="mb-2">
                    <a href={fileUrl(feedbackMap[fbSiswa.id].file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat File Perbaikan</a>
                  </div>
                )}
                <input type="file" className="form-control mb-2" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setFbFile(e.target.files?.[0] || null)} />
                <input type="url" className="form-control" placeholder="atau link Google Drive (file besar)" value={fbLink} onChange={(e) => setFbLink(e.target.value)} />
              </div>
              <div className="d-flex justify-between mt-3">
                <button type="button" className="btn btn-secondary" onClick={() => setFbSiswa(null)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={simpanFeedback} disabled={savingFb}>
                  {savingFb ? 'Menyimpan...' : 'Simpan Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
