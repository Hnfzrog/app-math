'use client';
import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useRouter } from 'next/navigation';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadImage, fileUrl } from '@/lib/uploadClient';
import { badgeStatusUjian, formatJadwal, labelStatusUjian, statusUjian } from '@/lib/jadwalUjian';

export default function SiswaUjianTake({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 16 menghapus akses params sinkron — wajib di-await lewat use().
  const unwrappedParams = use(params);
  const ujianId = unwrappedParams.id;
  const router = useRouter();
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  // Jawaban pg satu pilihan disimpan sebagai string, pg multi-jawaban sebagai array.
  const [jawabanSiswa, setJawabanSiswa] = useState<Record<string, string | string[]>>({});
  // Soal yang ditandai siswa untuk dicek ulang sebelum submit.
  const [soalDitandai, setSoalDitandai] = useState<Record<string, boolean>>({});

  // States
  const [step, setStep] = useState<'rules' | 'pakta' | 'exam' | 'hasil'>('rules');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [paktaAgreed, setPaktaAgreed] = useState(false);
  const [currentSoalIndex, setCurrentSoalIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [submitting, setSubmitting] = useState(false);
  const [fotoJawaban, setFotoJawaban] = useState<Record<string, File | null>>({});
  const [fotoLink, setFotoLink] = useState<Record<string, string>>({});
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [hasilList, setHasilList] = useState<Record<string, any>>({});

  useEffect(() => {
    if (userId) fetchUjianDetail();
  }, [userId]);

  useEffect(() => {
    if (userId) {
      supabase.from('users').select('nama').eq('id', userId).single().then(({ data }) => {
        if (data?.nama) setNamaSiswa(data.nama);
      });
    }
  }, [userId]);

  useEffect(() => {
    let timer: any;
    if (step === 'exam' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            autoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const fetchUjianDetail = async () => {
    setLoading(true);

    const { data: u } = await supabase.from('ujian').select('*').eq('id', ujianId).single();
    if (!u) {
      setUjian(null);
      setLoading(false);
      return;
    }

    setUjian(u);
    setTimeLeft(u.durasi_menit * 60);

    const { data: sData } = await supabase.from('soal_ujian').select('*').eq('ujian_id', u.id).order('id');
    const soal = sData || [];
    setSoalList(soal);

    // Sudah pernah mengumpulkan? Tampilkan hasilnya, bukan mulai ulang.
    if (soal.length > 0) {
      const { data: jw } = await supabase
        .from('jawaban_ujian')
        .select('*')
        .eq('siswa_id', userId)
        .in('soal_id', soal.map((s: any) => s.id));

      if (jw && jw.length > 0) {
        const map: Record<string, any> = {};
        jw.forEach((j: any) => { map[j.soal_id] = j; });
        setHasilList(map);
        setStep('hasil');
      }
    }

    setLoading(false);
  };

  const mulaiUjian = () => {
    if (!paktaAgreed) {
      customAlert('Harap setujui pakta integritas terlebih dahulu!', true);
      return;
    }
    setStep('exam');
  };

  const sudahDijawab = (soal: any): boolean => {
    const v = jawabanSiswa[soal.id];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === 'string' && v.trim().length > 0;
  };

  const handleJawaban = (val: string) => {
    const soal = soalList[currentSoalIndex];
    if (!soal) return;
    setJawabanSiswa(prev => ({ ...prev, [soal.id]: val }));
  };

  // Soal multi-jawaban: pilihan disimpan sebagai array agar bisa dibandingkan dengan kunci.
  const handlePilihanGandaMulti = (opt: string) => {
    const soal = soalList[currentSoalIndex];
    if (!soal) return;
    setJawabanSiswa(prev => {
      const current = Array.isArray(prev[soal.id]) ? prev[soal.id] as string[] : [];
      const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
      return { ...prev, [soal.id]: next };
    });
  };

  const toggleTandai = (soalId: string) => {
    setSoalDitandai(prev => ({ ...prev, [soalId]: !prev[soalId] }));
  };

  const autoSubmit = () => {
    customAlert('Waktu habis! Jawaban akan dikirim otomatis.', false);
    // Waktu habis tidak bisa ditawar — kirim apa adanya tanpa validasi.
    submitUjian(true);
  };

  const kirimKeServer = async () => {
    let fotoUrlMap: Record<string, string> = {};
    try {
      for (const [soalId, file] of Object.entries(fotoJawaban)) {
        if (file) fotoUrlMap[soalId] = await uploadImage(file, 'ujian');
      }
    } catch (err: any) {
      customAlert('Gagal upload foto jawaban: ' + (err?.message || err), true);
      return false;
    }
    // Link Google Drive (untuk file besar/video)
    for (const [soalId, url] of Object.entries(fotoLink)) {
      if (url) fotoUrlMap[soalId] = url;
    }

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch('/api/ujian/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        ujian_id: ujianId,
        jawaban: soalList.map(s => ({
          soal_id: s.id,
          jawaban_teks: jawabanSiswa[s.id] ?? '',
          foto_url: fotoUrlMap[s.id] || null,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      customAlert(data.error || 'Gagal mengirim jawaban.', true);
      return false;
    }

    // Muat ulang hasil dari server supaya skor yang tampil adalah yang tersimpan.
    const { data: jw } = await supabase
      .from('jawaban_ujian')
      .select('*')
      .eq('siswa_id', userId)
      .in('soal_id', soalList.map(s => s.id));

    const map: Record<string, any> = {};
    (jw || []).forEach((j: any) => { map[j.soal_id] = j; });
    setHasilList(map);
    return true;
  };

  const submitUjian = async (dariAutoSubmit = false) => {
    if (submitting) return;
    if (!dariAutoSubmit) setShowKonfirmasi(false);
    setSubmitting(true);

    const sukses = await kirimKeServer();
    if (sukses) {
      setStep('hasil');
      if (!dariAutoSubmit) customAlert('Ujian berhasil diselesaikan!', false);
    }
    setSubmitting(false);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  if (loading || userLoading) return <div className="p-4 text-center">Loading...</div>;
  if (!ujian) return <div className="p-4 text-center">Ujian tidak ditemukan.</div>;

  const status = statusUjian(ujian);

  // Gerbang masuk: siswa tidak boleh MEMULAI di luar jendela jadwal. Begitu ujian berjalan
  // (step === 'exam'), guard ini tidak berlaku lagi — yang mengatur hanya timer durasi.
  if ((step === 'rules' || step === 'pakta') && status !== 'buka') {
    return (
      <div className="card card-body exam-sheet">
        <div className="d-flex justify-between align-center mb-3">
          <h2 style={{ margin: 0 }}>{ujian.jenis}</h2>
          <span className={`badge ${badgeStatusUjian(status)}`}>{labelStatusUjian(status)}</span>
        </div>

        <div className="exam-info-box">
          {ujian.deskripsi && <p style={{ margin: '0 0 8px' }}><strong>Deskripsi:</strong> {ujian.deskripsi}</p>}
          <p style={{ margin: '0 0 4px' }}><strong>Dibuka:</strong> {formatJadwal(ujian.mulai_at)}</p>
          <p style={{ margin: 0 }}><strong>Ditutup:</strong> {formatJadwal(ujian.selesai_at)}</p>
        </div>

        <p className="text-muted mb-4">
          {status === 'belum'
            ? 'Ujian ini belum dibuka. Silakan kembali lagi sesuai jadwal di atas.'
            : 'Ujian ini sudah ditutup dan tidak bisa dikerjakan lagi.'}
        </p>

        <button className="btn btn-secondary btn-block" onClick={() => router.push('/siswa/ujian')} style={{ padding: '12px' }}>
          Kembali ke Daftar Ujian
        </button>
      </div>
    );
  }

  if (step === 'rules') {
    const jumlahSoal = soalList.length;
    return (
      <div className="card card-body exam-sheet">
        <h2 className="mb-3 text-center">Peraturan Ujian</h2>
        <div className="exam-info-box">
          <p><strong>Jenis:</strong> {ujian.jenis}</p>
          {ujian.deskripsi && <p><strong>Deskripsi:</strong> {ujian.deskripsi}</p>}
          <p><strong>Waktu Pengerjaan:</strong> {ujian.durasi_menit} menit</p>
          <p><strong>Jumlah Soal:</strong> {jumlahSoal}</p>
          <p><strong>Jadwal Buka:</strong> {formatJadwal(ujian.mulai_at)}</p>
          <p><strong>Jadwal Tutup:</strong> {formatJadwal(ujian.selesai_at)}</p>
          <hr />
          <p><strong>Ketentuan:</strong></p>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Pastikan koneksi internet stabil selama mengerjakan.</li>
            <li>Jawaban tidak dapat diubah setelah dikumpulkan.</li>
            <li>Waktu akan terus berjalan; saat habis, jawaban dikirim otomatis.</li>
          </ol>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => setStep('pakta')} style={{ padding: '12px' }}>
          Saya Paham, Lanjut
        </button>
      </div>
    );
  }

  if (step === 'pakta') {
    return (
      <div className="card card-body exam-sheet">
        <h2 className="mb-3 text-center">Pakta Integritas</h2>
        <div className="exam-info-box" style={{ lineHeight: '1.6' }}>
          <p style={{ margin: 0 }}>&ldquo;Demi Tuhan Yang Maha Esa, saya, <strong>{namaSiswa || '...'}</strong>, berjanji akan mengerjakan seluruh soal ujian ini dengan jujur dan mengandalkan kemampuan diri saya sendiri.&rdquo;</p>
        </div>
        <div className="form-group d-flex align-center gap-2 mb-4">
          <input
            type="checkbox"
            id="pakta"
            checked={paktaAgreed}
            onChange={e => setPaktaAgreed(e.target.checked)}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <label htmlFor="pakta" style={{ cursor: 'pointer', margin: 0, userSelect: 'none' }}>
            Saya menyetujui pakta integritas di atas.
          </label>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={mulaiUjian}
          disabled={!paktaAgreed}
          style={{ padding: '12px' }}
        >
          Setuju &amp; Mulai Ujian ({ujian.durasi_menit} Menit)
        </button>
      </div>
    );
  }

  if (step === 'hasil') {
    return (
      <div>
        <div className="card card-body mb-4">
          <h2 className="mb-1">Hasil Ujian</h2>
          <p className="text-muted mb-0">
            {ujian.jenis}{ujian.deskripsi ? ` — ${ujian.deskripsi}` : ''}
          </p>
        </div>

        {soalList.map((soal, idx) => {
          const j = hasilList[soal.id];
          const nilai = j?.skor_final ?? j?.skor_ai;

          return (
            <div key={soal.id} className="card card-body mb-3">
              <p className="mb-2">
                <strong>Soal {idx + 1}</strong>
                <span className={`badge ${soal.tipe === 'pg' ? 'badge-primary' : 'badge-secondary'} text-sm`} style={{ marginLeft: '8px' }}>
                  {soal.tipe === 'pg' ? 'Pilgan' : 'Esai'}
                </span>
              </p>
              <div className="mb-3" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />

              <p className="mb-2">
                <strong>Jawabanmu:</strong>{' '}
                <span style={{ whiteSpace: 'pre-wrap' }}>{formatJawaban(j?.jawaban_teks)}</span>
              </p>

              {!j ? (
                <span className="badge badge-secondary">Tidak dikerjakan</span>
              ) : soal.tipe === 'pg' ? (
                nilai == null ? (
                  <span className="badge badge-warning">Menunggu validasi guru</span>
                ) : Number(nilai) === 100 ? (
                  <span className="badge badge-success">✔ Benar — Skor {Number(nilai)}</span>
                ) : (
                  <span className="badge badge-danger">✘ Salah — Skor {Number(nilai)}</span>
                )
              ) : j.status === 'final' ? (
                <div>
                  <span className="badge badge-success">Skor {nilai}</span>
                  {j.feedback_ai && (
                    // Teks dari AI dirender sebagai teks biasa, bukan HTML.
                    <p className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>{j.feedback_ai}</p>
                  )}
                </div>
              ) : (
                <span className="badge badge-warning">Menunggu validasi guru</span>
              )}
            </div>
          );
        })}

        <button className="btn btn-primary" onClick={() => router.push('/siswa/ujian')}>
          Kembali ke Daftar Ujian
        </button>
      </div>
    );
  }

  // Tampilan Ujian
  const currentSoal = soalList[currentSoalIndex];
  const belumDikerjakan = soalList.map((s, i) => ({ s, i })).filter(({ s }) => !sudahDijawab(s));
  const masihDitandai = soalList.map((s, i) => ({ s, i })).filter(({ s }) => soalDitandai[s.id]);
  const bisaSubmit = belumDikerjakan.length === 0 && masihDitandai.length === 0;

  const lompatKeSoal = (index: number) => {
    setCurrentSoalIndex(index);
    setShowKonfirmasi(false);
  };

  const kelasNavigasi = (soal: any, idx: number) => {
    const kelas = ['nav-soal'];
    if (soalDitandai[soal.id]) kelas.push('ditandai');
    else if (sudahDijawab(soal)) kelas.push('dikerjakan');
    if (currentSoalIndex === idx) kelas.push('aktif');
    return kelas.join(' ');
  };

  return (
    <div>
      <div className="exam-page-header">
        <div>
          <h3 style={{ margin: 0 }}>{ujian.jenis}{ujian.deskripsi ? ` — ${ujian.deskripsi}` : ''}</h3>
        </div>
        <div className={`badge ${timeLeft < 300 ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '1.2rem', padding: '8px 16px' }}>
          ⏳ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="exam-layout">
        {/* Navigator — di kiri agar mudah dipantau siswa */}
        <div className="card card-body" style={{ height: 'max-content' }}>
          <h4 className="mb-3">Navigasi Soal</h4>
          <div className="nav-soal-grid">
            {soalList.map((s, idx) => (
              <button
                key={s.id}
                className={kelasNavigasi(s, idx)}
                onClick={() => lompatKeSoal(idx)}
                title={
                  soalDitandai[s.id] ? 'Ditandai untuk dicek ulang'
                    : sudahDijawab(s) ? 'Sudah dikerjakan' : 'Belum dikerjakan'
                }
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <div className="mt-3 text-muted" style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <p style={{ margin: 0 }}><span className="legend-dot belum" />Belum dikerjakan</p>
            <p style={{ margin: 0 }}><span className="legend-dot dikerjakan" />Sudah dikerjakan</p>
            <p style={{ margin: 0 }}><span className="legend-dot ditandai" />Ditandai untuk dicek ulang</p>
          </div>

          <hr className="my-4" />

          <button
            className="btn btn-success btn-block"
            onClick={() => setShowKonfirmasi(true)}
            disabled={submitting}
          >
            {submitting ? 'Mengirim...' : 'Selesai & Kumpulkan'}
          </button>
        </div>

        {/* Soal Area */}
        <div className="card card-body" style={{ minHeight: '400px' }}>
          {currentSoal ? (
            <>
              <div
                className="d-flex justify-between align-center mb-3"
                style={{ borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.5rem' }}
              >
                <strong>Soal {currentSoalIndex + 1} dari {soalList.length}</strong>
                <button
                  type="button"
                  className={`btn btn-sm ${soalDitandai[currentSoal.id] ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => toggleTandai(currentSoal.id)}
                  title={soalDitandai[currentSoal.id] ? 'Klik untuk melepas tanda' : 'Tandai untuk dicek ulang nanti'}
                >
                  {soalDitandai[currentSoal.id] ? '★ Ditandai' : '☆ Tandai'}
                </button>
              </div>
              <div
                className="mb-4 exam-question-text"
                dangerouslySetInnerHTML={{ __html: currentSoal.pertanyaan }}
              />

              {currentSoal.lampiran_url && (
                /\.(jpg|jpeg|png|gif|webp)$/i.test(currentSoal.lampiran_url) ? (
                  <img src={fileUrl(currentSoal.lampiran_url)!} alt="Lampiran soal" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', marginBottom: '12px', display: 'block' }} />
                ) : (
                  <a href={fileUrl(currentSoal.lampiran_url)!} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: '12px', color: 'var(--primary)' }}>📎 Lihat Lampiran Soal</a>
                )
              )}

              <div className="form-group">
                <label>Jawaban Anda:</label>

                {currentSoal.tipe === 'pg' && Array.isArray(currentSoal.opsi) && currentSoal.opsi.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {currentSoal.multi_jawaban && (
                      <p className="text-muted mb-1" style={{ fontSize: '13px' }}>Pilih semua jawaban yang benar.</p>
                    )}
                    {currentSoal.opsi.map((opt: string, i: number) => {
                      const nilaiSekarang = jawabanSiswa[currentSoal.id];
                      const dipilih = currentSoal.multi_jawaban
                        ? Array.isArray(nilaiSekarang) && nilaiSekarang.includes(opt)
                        : nilaiSekarang === opt;

                      return (
                        <label
                          key={i}
                          className="d-flex align-center gap-2"
                          style={{
                            cursor: 'pointer',
                            padding: '0.75rem 1rem',
                            border: `1px solid ${dipilih ? 'var(--primary)' : 'var(--slate-300)'}`,
                            borderRadius: 'var(--radius-md)',
                            background: dipilih ? 'var(--primary-light)' : 'var(--white)',
                            margin: 0,
                          }}
                        >
                          <input
                            type={currentSoal.multi_jawaban ? 'checkbox' : 'radio'}
                            name={`soal-${currentSoal.id}`}
                            value={opt}
                            checked={dipilih}
                            onChange={() => currentSoal.multi_jawaban ? handlePilihanGandaMulti(opt) : handleJawaban(opt)}
                            style={{ transform: 'scale(1.2)' }}
                          />
                          <span><strong>{String.fromCharCode(65 + i)}.</strong> {opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    className="form-control"
                    rows={6}
                    value={(jawabanSiswa[currentSoal.id] as string) || ''}
                    onChange={e => handleJawaban(e.target.value)}
                    placeholder="Ketik jawaban / penyelesaian di sini..."
                  ></textarea>
                )}
              </div>

              {currentSoal.butuh_foto_jawaban && (
                <div className="form-group mb-3">
                  <label>Upload Bukti Jawaban (Wajib) — foto/dokumen, maks 2MB</label>
                  <PhotoUpload
                    value={null}
                    onFileChange={(file) => setFotoJawaban(prev => ({ ...prev, [currentSoal.id]: file }))}
                    onLinkChange={(url) => setFotoLink(prev => ({ ...prev, [currentSoal.id]: url }))}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    showDrive
                    label="Foto Jawaban"
                  />
                </div>
              )}

              <div className="d-flex justify-between mt-4">
                <button
                  className="btn btn-outline"
                  disabled={currentSoalIndex === 0}
                  onClick={() => setCurrentSoalIndex(p => p - 1)}
                >
                  &laquo; Sebelumnya
                </button>
                {/* Tombol "Selanjutnya" disembunyikan di soal terakhir. */}
                {currentSoalIndex < soalList.length - 1 && (
                  <button
                    className="btn btn-outline"
                    onClick={() => setCurrentSoalIndex(p => p + 1)}
                  >
                    Selanjutnya &raquo;
                  </button>
                )}
              </div>
            </>
          ) : (
            <p>Tidak ada soal.</p>
          )}
        </div>
      </div>

      {showKonfirmasi && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Kumpulkan Ujian?</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowKonfirmasi(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {belumDikerjakan.length > 0 && (
                <div className="alert alert-danger">
                  <p className="mb-2">
                    <strong>Masih ada {belumDikerjakan.length} soal yang belum dikerjakan.</strong>{' '}
                    Klik nomornya untuk mengerjakan.
                  </p>
                  <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {belumDikerjakan.map(({ i }) => (
                      <button key={i} type="button" className="nomor-tautan belum" onClick={() => lompatKeSoal(i)}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {masihDitandai.length > 0 && (
                <div className="alert alert-warning">
                  <p className="mb-2">
                    <strong>Masih ada {masihDitandai.length} soal yang kamu tandai untuk dicek ulang.</strong>{' '}
                    Lepas tandanya kalau kamu sudah yakin.
                  </p>
                  <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {masihDitandai.map(({ i }) => (
                      <button key={i} type="button" className="nomor-tautan ditandai" onClick={() => lompatKeSoal(i)}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bisaSubmit ? (
                <p className="mb-0">
                  Semua soal sudah dikerjakan dan tidak ada yang ditandai.
                  <strong> Jawaban tidak bisa diubah setelah dikumpulkan.</strong>
                </p>
              ) : (
                <p className="text-muted mb-0">
                  Selesaikan dulu soal di atas sebelum mengumpulkan.
                </p>
              )}

              <div className="d-flex justify-between mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKonfirmasi(false)}>
                  Kembali Mengerjakan
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => submitUjian(false)}
                  disabled={submitting || !bisaSubmit}
                >
                  {submitting ? 'Mengirim...' : 'Ya, Kumpulkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
