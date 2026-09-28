'use client';
import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { uploadFile, fileUrl } from '@/lib/uploadClient';
import Link from 'next/link';

export default function GuruUjianHasil({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const ujianId = unwrappedParams.id;

  const [loading, setLoading] = useState(true);
  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [kunciMap, setKunciMap] = useState<Record<string, string>>({});
  const [siswaList, setSiswaList] = useState<any[]>([]);
  // jawabanMap[siswa_id][soal_id] = baris jawaban_ujian
  const [jawabanMap, setJawabanMap] = useState<Record<string, Record<string, any>>>({});
  // nilaiEdit[jawaban_id] = skor_final yang diketik guru
  const [nilaiEdit, setNilaiEdit] = useState<Record<string, string>>({});
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Feedback guru per siswa (ujian_feedback)
  const [feedbackMap, setFeedbackMap] = useState<Record<string, any>>({});
  const [feedbackPendingFile, setFeedbackPendingFile] = useState<Record<string, File | null>>({});
  const [feedbackLink, setFeedbackLink] = useState<Record<string, string>>({});

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

    const soalIds = soal.map((s: any) => s.id);

    // Kunci jawaban (guru pengampu kelas ini boleh membacanya)
    if (soalIds.length > 0) {
      const { data: kunci } = await supabase
        .from('soal_ujian_kunci')
        .select('soal_id, kunci_jawaban')
        .in('soal_id', soalIds);

      const map: Record<string, string> = {};
      (kunci || []).forEach((k: any) => { map[k.soal_id] = k.kunci_jawaban; });
      setKunciMap(map);
    }

    // Daftar siswa kelas ujian ini
    const { data: dataSiswa } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama, nisn)')
      .eq('kelas_id', dataUjian.kelas_id);

    const siswa = (dataSiswa || [])
      .map((s: any) => ({ id: s.siswa_id, nama: s.users?.nama || '(tanpa nama)', nisn: s.users?.nisn || '' }))
      .sort((a: any, b: any) => a.nama.localeCompare(b.nama));
    setSiswaList(siswa);

    // Semua jawaban untuk soal-soal ujian ini (policy guru: hanya ujian kelasnya)
    if (soalIds.length > 0) {
      const { data: jawaban } = await supabase
        .from('jawaban_ujian')
        .select('*')
        .in('soal_id', soalIds);

      const map: Record<string, Record<string, any>> = {};
      (jawaban || []).forEach((j: any) => {
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
    (fb || []).forEach((f: any) => { fbMap[f.siswa_id] = f; });
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

  const nilaiTersimpan = (j: any): number | null => {
    if (j?.skor_final != null) return Number(j.skor_final);
    if (j?.skor_ai != null) return Number(j.skor_ai);
    return null;
  };

  const ringkasanSiswa = (siswaId: string) => {
    const jw = jawabanSiswa(siswaId);
    let pgBenar = 0, pgTotal = 0, esaiMenunggu = 0, semuaFinal = true, adaNilai = false;
    let totalNilai = 0, totalSoal = 0;

    soalList.forEach(soal => {
      const j = jw[soal.id];
      if (!j) return;

      if (soal.tipe === 'pg') {
        pgTotal++;
        if (Number(j.skor_ai) === 100) pgBenar++;
      } else if (j.status !== 'final') {
        esaiMenunggu++;
      }

      if (j.status !== 'final') semuaFinal = false;
      const n = nilaiTersimpan(j);
      if (n != null) { totalNilai += n; totalSoal++; adaNilai = true; }
    });

    return {
      pgBenar,
      pgTotal,
      esaiMenunggu,
      semuaFinal,
      rataRata: adaNilai && totalSoal > 0 ? totalNilai / totalSoal : null,
    };
  };

  const togglePilih = (siswaId: string) => {
    setTerpilih(prev => prev.includes(siswaId) ? prev.filter(s => s !== siswaId) : [...prev, siswaId]);
  };

  const siswaBisaValidasi = siswaList.filter(s => sudahMengerjakan(s.id));
  const semuaTerpilih = siswaBisaValidasi.length > 0 && terpilih.length === siswaBisaValidasi.length;

  const togglePilihSemua = () => {
    setTerpilih(semuaTerpilih ? [] : siswaBisaValidasi.map(s => s.id));
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
      rows.map(r =>
        supabase
          .from('jawaban_ujian')
          .update({ skor_final: r.skor_final, status: r.status, dinilai_at: r.dinilai_at })
          .eq('id', r.id)
      )
    );

    const gagal = hasilUpdate.find(h => h.error);

    if (gagal?.error) {
      setSaving(false);
      setTerpilih([]);
      fetchData();
      customAlert('Sebagian nilai gagal divalidasi: ' + gagal.error.message, true);
      return;
    }

    // UH: masukkan rata-rata skor ujian ke nilai per-bab (skor_benar), supaya muncul
    // di menu Penilaian (guru) dan Nilai Saya (siswa). UTS/UAS tidak punya bab_id.
    if (ujian?.bab_id && ujian.jenis === 'UH') {
      const finalByJawaban = new Map(rows.map(r => [r.id, r.skor_final]));
      const nilaiRows = siswaIds.map(siswaId => {
        const jw = jawabanSiswa(siswaId);
        const skors: number[] = [];
        soalList.forEach(soal => {
          const j = jw[soal.id];
          if (!j) return;
          const n = finalByJawaban.get(j.id);
          if (n != null) skors.push(n);
        });
        const rata = skors.length > 0
          ? skors.reduce((a, b) => a + b, 0) / skors.length
          : 0;
        return {
          siswa_id: siswaId,
          bab_id: ujian.bab_id,
          skor_benar: Math.round(rata * 100) / 100,
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
    fetchData();
    customAlert(`${siswaIds.length} siswa berhasil divalidasi.`, false);
  };

  const simpanFeedback = async (siswaId: string) => {
    const current = feedbackMap[siswaId] || { umpan_balik: '', file_url: null };
    let fileKey: string | null = current.file_url || null;
    const pending = feedbackPendingFile[siswaId];
    const link = feedbackLink[siswaId];
    try {
      if (pending) fileKey = await uploadFile(pending, 'ujian-feedback');
      else if (link) fileKey = link;
    } catch (e: any) {
      customAlert('Gagal upload file feedback: ' + (e?.message || e), true);
      return;
    }
    const { error } = await supabase.from('ujian_feedback').upsert({
      ujian_id: ujianId,
      siswa_id: siswaId,
      umpan_balik: current.umpan_balik || '',
      file_url: fileKey,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ujian_id,siswa_id' });
    if (error) { customAlert('Gagal simpan feedback: ' + error.message, true); return; }
    customAlert('Feedback tersimpan.', false);
    const { data: fb } = await supabase.from('ujian_feedback').select('*').eq('ujian_id', ujianId);
    const fbMap: Record<string, any> = {};
    (fb || []).forEach((f: any) => { fbMap[f.siswa_id] = f; });
    setFeedbackMap(fbMap);
    setFeedbackPendingFile(prev => ({ ...prev, [siswaId]: null }));
    setFeedbackLink(prev => ({ ...prev, [siswaId]: '' }));
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!ujian) return <div className="p-4 text-center">Ujian tidak ditemukan.</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href={`/guru/ujian/${ujianId}`} className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <div>
            <h2 style={{ margin: 0 }}>Hasil Ujian</h2>
            <p className="text-muted mb-0 text-sm">
              {ujian.kelas?.nama} — {ujian.jenis}{ujian.deskripsi ? ` — ${ujian.deskripsi}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="card card-body mb-4">
        <div className="d-flex justify-between align-center">
          <label className="d-flex align-center gap-2" style={{ cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={semuaTerpilih}
              onChange={togglePilihSemua}
              style={{ transform: 'scale(1.2)' }}
            />
            <span className="font-bold">Pilih semua ({siswaBisaValidasi.length} siswa mengerjakan)</span>
          </label>
          <button
            className="btn btn-primary"
            onClick={() => validasi(terpilih)}
            disabled={saving || terpilih.length === 0}
          >
            {saving ? 'Menyimpan...' : `Validasi ${terpilih.length} Siswa Terpilih`}
          </button>
        </div>
      </div>

      {siswaList.length === 0 ? (
        <div className="card card-body">
          <p className="text-center text-muted my-4">Belum ada siswa di kelas ini.</p>
        </div>
      ) : (
        siswaList.map(siswa => {
          const jw = jawabanSiswa(siswa.id);
          const mengerjakan = sudahMengerjakan(siswa.id);
          const ringkas = ringkasanSiswa(siswa.id);
          const semuaFinal = ringkas.semuaFinal && mengerjakan;

          return (
            <details key={siswa.id} className="accordion">
              <summary>
                <span
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePilih(siswa.id); }}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <input
                    type="checkbox"
                    checked={terpilih.includes(siswa.id)}
                    readOnly
                    disabled={!mengerjakan}
                    style={{ transform: 'scale(1.2)' }}
                  />
                </span>

                <span className="font-bold">{siswa.nama}</span>

                {mengerjakan ? (
                  <span className="text-sm text-muted">
                    PG: {ringkas.pgBenar}/{ringkas.pgTotal} benar
                    {ringkas.esaiMenunggu > 0 && ` · ${ringkas.esaiMenunggu} esai perlu dikoreksi`}
                    {ringkas.rataRata != null && ` · Rata-rata: ${ringkas.rataRata.toFixed(1)}`}
                    {(feedbackMap[siswa.id]?.umpan_balik || feedbackMap[siswa.id]?.file_url) && ' · 📝 ada feedback'}
                  </span>
                ) : (
                  <span className="text-sm text-muted">belum mengerjakan</span>
                )}

                {mengerjakan && (
                  <span className={`badge ${semuaFinal ? 'badge-success' : 'badge-warning'}`}>
                    {semuaFinal ? 'FINAL' : 'PENDING'}
                  </span>
                )}

                <span className="accordion-chevron">›</span>
              </summary>

              <div className="accordion-body">
                {!mengerjakan ? (
                  <p className="text-muted mb-0">Siswa ini belum mengumpulkan jawaban.</p>
                ) : (
                  <>
                    {soalList.map((soal, idx) => {
                      const j = jw[soal.id];
                      const kunci = kunciMap[soal.id];
                      const nilai = nilaiTersimpan(j);

                      return (
                        <div key={soal.id} className="mb-3" style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', padding: '0.9rem' }}>
                          <p className="mb-1">
                            <strong>Soal {idx + 1}</strong>
                            <span className={`badge ${soal.tipe === 'pg' ? 'badge-primary' : 'badge-secondary'} text-sm`} style={{ marginLeft: '8px' }}>
                              {soal.tipe === 'pg' ? 'Pilgan' : 'Esai'}
                            </span>
                          </p>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{soal.pertanyaan}</p>

                          {!j ? (
                            <p className="text-muted mb-0">Tidak dijawab.</p>
                          ) : (
                            <>
                              <p className="mb-1">
                                <strong>Jawaban siswa:</strong>{' '}
                                <span style={{ whiteSpace: 'pre-wrap' }}>{formatJawaban(j.jawaban_teks)}</span>
                              </p>

                              {soal.tipe === 'pg' && (
                                <>
                                  <p className="mb-1 text-sm">
                                    <strong>Kunci:</strong>{' '}
                                    {kunci ? formatJawaban(kunci) : <em className="text-muted">belum diatur</em>}
                                  </p>
                                  <p className="mb-1">
                                    {j.skor_ai == null ? (
                                      <span className="badge badge-warning">Perlu dikoreksi manual</span>
                                    ) : Number(j.skor_ai) === 100 ? (
                                      <span className="badge badge-success">✔ Benar</span>
                                    ) : (
                                      <span className="badge badge-danger">✘ Salah</span>
                                    )}
                                  </p>
                                </>
                              )}

                              {soal.tipe === 'uraian' && (
                                <>
                                  {kunci && (
                                    <p className="mb-1 text-sm">
                                      <strong>Kunci/rubrik:</strong>{' '}
                                      <span style={{ whiteSpace: 'pre-wrap' }}>{kunci}</span>
                                    </p>
                                  )}
                                  {j.feedback_ai && (
                                    <p className="mb-1 text-sm">
                                      <span className="badge badge-primary">Skor AI: {j.skor_ai ?? '-'}</span>{' '}
                                      {/* Teks dari AI dirender sebagai teks biasa, bukan HTML. */}
                                      <span style={{ whiteSpace: 'pre-wrap' }}>{j.feedback_ai}</span>
                                    </p>
                                  )}
                                </>
                              )}

                              {j.foto_url && (
                                <p className="mb-1">
                                  <a href={fileUrl(j.foto_url)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat Bukti Jawaban</a>
                                </p>
                              )}

                              <div className="d-flex align-center gap-2 mt-2">
                                <label className="mb-0"><strong>Nilai final:</strong></label>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ maxWidth: '110px' }}
                                  min="0"
                                  max="100"
                                  value={nilaiEdit[j.id] ?? (nilai != null ? String(nilai) : '')}
                                  onChange={e => setNilaiEdit(prev => ({ ...prev, [j.id]: e.target.value }))}
                                />
                                {j.status === 'final' && <span className="badge badge-success">Sudah divalidasi</span>}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', padding: '0.9rem', marginTop: '0.9rem' }}>
                      <p className="mb-2"><strong>Feedback Guru</strong> <small className="text-muted">(tulisan + file perbaikan, terlihat oleh siswa)</small></p>
                      <textarea
                        className="form-control mb-2"
                        rows={2}
                        placeholder="Catatan / perbaikan untuk siswa..."
                        value={feedbackMap[siswa.id]?.umpan_balik || ''}
                        onChange={e => setFeedbackMap(prev => ({ ...prev, [siswa.id]: { ...prev[siswa.id], umpan_balik: e.target.value } }))}
                      />
                      {feedbackMap[siswa.id]?.file_url && (
                        <div className="mb-2">
                          <a href={fileUrl(feedbackMap[siswa.id].file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat File Perbaikan</a>
                        </div>
                      )}
                      <input
                        type="file"
                        className="form-control mb-2"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={e => setFeedbackPendingFile(prev => ({ ...prev, [siswa.id]: e.target.files?.[0] || null }))}
                      />
                      <input
                        type="url"
                        className="form-control mb-2"
                        placeholder="atau link Google Drive (file besar)"
                        value={feedbackLink[siswa.id] || ''}
                        onChange={e => setFeedbackLink(prev => ({ ...prev, [siswa.id]: e.target.value }))}
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => simpanFeedback(siswa.id)}>Simpan Feedback</button>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-success"
                        onClick={() => validasi([siswa.id])}
                        disabled={saving}
                      >
                        Validasi Siswa Ini
                      </button>
                    </div>
                  </>
                )}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
