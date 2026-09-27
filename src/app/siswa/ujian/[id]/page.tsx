'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useRouter } from 'next/navigation';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadImage, fileUrl } from '@/lib/uploadClient';

export default function SiswaUjianTake({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  
  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [jawabanSiswa, setJawabanSiswa] = useState<Record<string, string>>({});
  
  // States
  const [step, setStep] = useState<'rules' | 'pakta' | 'exam'>('rules');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [paktaAgreed, setPaktaAgreed] = useState(false);
  const [currentSoalIndex, setCurrentSoalIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [submitting, setSubmitting] = useState(false);
  const [fotoJawaban, setFotoJawaban] = useState<Record<string, File | null>>({});
  const [fotoLink, setFotoLink] = useState<Record<string, string>>({});

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
    
    // Cek apakah sudah submit ujian ini (jika tabel jawaban_ujian ada record untuk ujian ini)
    // Untuk MVP kita cek satu soal dari ujian ini
    const { data: soalCheck } = await supabase.from('soal_ujian').select('id').eq('ujian_id', params.id).limit(1);
    if (soalCheck && soalCheck.length > 0) {
      const { data: ansCheck } = await supabase.from('jawaban_ujian').select('id').eq('soal_id', soalCheck[0].id).eq('siswa_id', userId).limit(1);
      if (ansCheck && ansCheck.length > 0) {
        customAlert('Anda sudah mengerjakan ujian ini.', true);
        router.push('/siswa/ujian');
        return;
      }
    }

    const { data: u } = await supabase.from('ujian').select('*').eq('id', params.id).single();
    if (u) {
      setUjian(u);
      setTimeLeft(u.durasi_menit * 60);
      
      const { data: sData } = await supabase.from('soal_ujian').select('*').eq('ujian_id', u.id).order('id');
      if (sData) setSoalList(sData);
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

  const handleJawaban = (val: string) => {
    const soal = soalList[currentSoalIndex];
    if (!soal) return;
    setJawabanSiswa(prev => ({ ...prev, [soal.id]: val }));
  };

  const autoSubmit = () => {
    customAlert('Waktu habis! Jawaban akan dikirim otomatis.', false);
    submitUjian();
  };

  const submitUjian = async () => {
    if (submitting) return;
    setSubmitting(true);
    
    let fotoUrlMap: Record<string, string> = {};
    try {
      for (const [soalId, file] of Object.entries(fotoJawaban)) {
        if (file) fotoUrlMap[soalId] = await uploadImage(file, 'ujian');
      }
    } catch (err: any) {
      customAlert('Gagal upload foto jawaban: ' + (err?.message || err), true);
      setSubmitting(false);
      return;
    }
    // Link Google Drive (untuk file besar/video)
    for (const [soalId, url] of Object.entries(fotoLink)) {
      if (url) fotoUrlMap[soalId] = url;
    }

    const inserts = soalList.map(s => ({
      soal_id: s.id,
      siswa_id: userId,
      jawaban_teks: jawabanSiswa[s.id] || '',
      foto_url: fotoUrlMap[s.id] || null
    }));

    if (inserts.length > 0) {
      const { error } = await supabase.from('jawaban_ujian').insert(inserts);
      if (error) {
        customAlert('Gagal mengirim jawaban: ' + error.message, true);
        setSubmitting(false);
        return;
      }
    }

    customAlert('Ujian berhasil diselesaikan!', false);
    router.push('/siswa/ujian');
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || userLoading) return <div className="p-4 text-center">Loading...</div>;
  if (!ujian) return <div className="p-4 text-center">Ujian tidak ditemukan.</div>;

  if (step === 'rules') {
    const jumlahSoal = soalList.length;
    return (
      <div className="card card-body mx-auto" style={{ maxWidth: '600px' }}>
        <h2 className="mb-3 text-center">Peraturan Ujian</h2>
        <div className="bg-slate-50 p-4 border rounded mb-4" style={{ fontSize: '14px', lineHeight: '1.7' }}>
          <p><strong>Jenis:</strong> {ujian.jenis}</p>
          {ujian.deskripsi && <p><strong>Deskripsi:</strong> {ujian.deskripsi}</p>}
          <p><strong>Waktu Pengerjaan:</strong> {ujian.durasi_menit} menit</p>
          <p><strong>Jumlah Soal:</strong> {jumlahSoal}</p>
          <hr />
          <p><strong>Ketentuan:</strong></p>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Pastikan koneksi internet stabil selama mengerjakan.</li>
            <li>Jawaban tidak dapat diubah setelah dikumpulkan.</li>
            <li>Waktu akan terus berjalan; saat habis, jawaban dikirim otomatis.</li>
          </ol>
        </div>
        <button className="btn btn-primary w-100" onClick={() => setStep('pakta')} style={{ padding: '12px' }}>
          Saya Paham, Lanjut
        </button>
      </div>
    );
  }

  if (step === 'pakta') {
    return (
      <div className="card card-body mx-auto" style={{ maxWidth: '600px' }}>
        <h2 className="mb-3 text-center">Pakta Integritas</h2>
        <div className="bg-slate-50 p-4 border rounded mb-4" style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p>&ldquo;Demi Tuhan Yang Maha Esa, saya, <strong>{namaSiswa || '...'}</strong>, berjanji akan mengerjakan seluruh soal ujian ini dengan jujur dan mengandalkan kemampuan diri saya sendiri.&rdquo;</p>
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
          className="btn btn-primary w-100"
          onClick={mulaiUjian}
          disabled={!paktaAgreed}
          style={{ padding: '12px' }}
        >
          Setuju &amp; Mulai Ujian ({ujian.durasi_menit} Menit)
        </button>
      </div>
    );
  }

  // Tampilan Ujian
  const currentSoal = soalList[currentSoalIndex];

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 bg-white p-3 rounded border sticky" style={{ top: '0', zIndex: 10 }}>
        <div>
          <h3 className="m-0">{ujian.jenis} - {ujian.deskripsi}</h3>
        </div>
        <div className={`badge ${timeLeft < 300 ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '1.2rem', padding: '8px 16px' }}>
          ⏳ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 300px' }}>
        {/* Soal Area */}
        <div className="card card-body" style={{ minHeight: '400px' }}>
          {currentSoal ? (
            <>
              <div className="d-flex justify-between mb-3 border-bottom pb-2">
                <strong>Soal No. {currentSoalIndex + 1}</strong>
              </div>
              <div
                className="mb-4 text-lg"
                dangerouslySetInnerHTML={{ __html: currentSoal.pertanyaan }}
              />

              {currentSoal.lampiran_url && (
                /\.(jpg|jpeg|png|gif|webp)$/i.test(currentSoal.lampiran_url) ? (
                  <img src={fileUrl(currentSoal.lampiran_url)!} alt="Lampiran soal" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', marginBottom: '12px', display: 'block' }} />
                ) : (
                  <a href={fileUrl(currentSoal.lampiran_url)!} target="_blank" rel="noopener noreferrer" className="text-primary" style={{ display: 'block', marginBottom: '12px' }}>📎 Lihat Lampiran Soal</a>
                )
              )}
              
              <div className="form-group">
                <label>Jawaban Anda:</label>
                <textarea 
                  className="form-control" 
                  rows={6}
                  value={jawabanSiswa[currentSoal.id] || ''}
                  onChange={e => handleJawaban(e.target.value)}
                  placeholder="Ketik jawaban / penyelesaian di sini..."
                ></textarea>
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
                <button 
                  className="btn btn-outline" 
                  disabled={currentSoalIndex === soalList.length - 1}
                  onClick={() => setCurrentSoalIndex(p => p + 1)}
                >
                  Selanjutnya &raquo;
                </button>
              </div>
            </>
          ) : (
            <p>Tidak ada soal.</p>
          )}
        </div>

        {/* Navigator */}
        <div className="card card-body" style={{ height: 'max-content' }}>
          <h4 className="mb-3">Navigasi Soal</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {soalList.map((s, idx) => {
              const isAnswered = (jawabanSiswa[s.id] || '').trim().length > 0;
              const isCurrent = currentSoalIndex === idx;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentSoalIndex(idx)}
                  style={{
                    width: '100%', aspectRatio: '1/1',
                    borderRadius: '4px', border: '1px solid',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', cursor: 'pointer',
                    background: isCurrent ? 'var(--primary)' : isAnswered ? 'var(--primary-light)' : 'white',
                    color: isCurrent ? 'white' : isAnswered ? 'var(--primary)' : '#333',
                    borderColor: isCurrent ? 'var(--primary)' : isAnswered ? 'var(--primary)' : '#ddd',
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          
          <hr className="my-4" />
          
          <button 
            className="btn btn-success w-100" 
            onClick={() => {
              if (window.confirm('Yakin ingin menyelesaikan ujian? Jawaban tidak bisa diubah lagi.')) {
                submitUjian();
              }
            }}
            disabled={submitting}
          >
            {submitting ? 'Mengirim...' : 'Selesai & Kumpulkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
