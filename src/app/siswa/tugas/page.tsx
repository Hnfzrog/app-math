'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function SiswaTugas() {
  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [kuisList, setKuisList] = useState<any[]>([]); // Menyimpan daftar Kuis (Konten)
  const [submittedKuis, setSubmittedKuis] = useState<Record<string, boolean>>({});
  const [selectedKuis, setSelectedKuis] = useState<any | null>(null);
  const [soalKuis, setSoalKuis] = useState<any[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<'milih_kuis' | 'mengerjakan' | 'loading' | 'selesai'>('milih_kuis');
  const [hasil, setHasil] = useState<{ totalSkor: number, detail: any[] } | null>(null);

  useEffect(() => {
    if (SISWA_ID) fetchAvailableKuis();

    // Listen to updates from Guru adding new Kuis, Bab, or Soal
    const channel = supabase.channel('siswa-tugas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konten' }, () => {
        if (SISWA_ID) fetchAvailableKuis();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bab' }, () => {
        if (SISWA_ID) fetchAvailableKuis();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soal' }, () => {
        if (SISWA_ID) fetchAvailableKuis();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [SISWA_ID]);

  const fetchAvailableKuis = async () => {
    setLoading(true);
    // 1. Dapatkan kelas dari siswa
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).single();
    
    if (siswaKelas) {
      // 2. Dapatkan Bab
      const { data: babs } = await supabase.from('bab').select('id, judul').eq('kelas_id', siswaKelas.kelas_id);
      const babIds = babs?.map(b => b.id) || [];
      
      if (babIds.length > 0) {
        // 3. Dapatkan Kuis (Bank Soal / LKPD)
        const { data: konten } = await supabase
          .from('konten')
          .select('*')
          .in('bab_id', babIds)
          .in('tipe', ['lkpd', 'banksoal', 'evaluasi']);
          
        const kontenWithBab = konten?.map(k => {
          const bab = babs?.find(b => b.id === k.bab_id);
          return { ...k, judul_bab: bab ? bab.judul : 'Bab Tidak Diketahui' };
        });
          
        setKuisList(kontenWithBab || []);

        // 4. Cek kuis mana saja yang sudah dikerjakan
        if (konten && konten.length > 0) {
          const kuisIds = konten.map(k => k.id);
          // Cari soal dari konten ini
          const { data: soals } = await supabase.from('soal').select('id, konten_id').in('konten_id', kuisIds);
          
          if (soals && soals.length > 0) {
            const soalIds = soals.map(s => s.id);
            // Cari jawaban_siswa
            const { data: jawabans } = await supabase.from('jawaban_siswa').select('soal_id').eq('siswa_id', SISWA_ID).in('soal_id', soalIds);
            
            if (jawabans) {
              const answeredSoalIds = new Set(jawabans.map(j => j.soal_id));
              const submittedStatus: Record<string, boolean> = {};
              
              // Kuis dianggap sudah dikerjakan jika ada minimal 1 soal yang sudah dijawab
              soals.forEach(s => {
                if (answeredSoalIds.has(s.id)) {
                  submittedStatus[s.konten_id] = true;
                }
              });
              
              setSubmittedKuis(submittedStatus);
            }
          }
        }
      }
    }
    setLoading(false);
  };

  const startKuis = async (kuis: any) => {
    setSelectedKuis(kuis);
    setLoading(true);
    // Fetch soal
    const { data: soal } = await supabase.from('soal').select('*').eq('konten_id', kuis.id).order('created_at');
    setSoalKuis(soal || []);
    setJawaban({});
    setCurrentIndex(0);
    setStatus('mengerjakan');
    setLoading(false);
    
    // Exam Mode Effect
    setTimeout(() => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen failed:', e));
      }
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const topbar = document.querySelector('.topbar') as HTMLElement;
      if (sidebar) sidebar.style.display = 'none';
      if (topbar) topbar.style.display = 'none';
    }, 100);
  };

  const soal = soalKuis[currentIndex];
  const isLastQuestion = currentIndex === soalKuis.length - 1;

  const handleJawabanChange = (val: string) => {
    if (!soal) return;
    setJawaban(prev => ({ ...prev, [soal.id]: val }));
  };

  const handleCheckboxChange = (opt: string) => {
    if (!soal) return;
    setJawaban(prev => {
      const current = Array.isArray(prev[soal.id]) ? prev[soal.id] : [];
      const isChecked = current.includes(opt);
      const newAnswers = isChecked ? current.filter((x: string) => x !== opt) : [...current, opt];
      return { ...prev, [soal.id]: newAnswers };
    });
  };
  
  const insertSymbol = (symbol: string) => {
    if (soal) {
      const currentVal = jawaban[soal.id] || '';
      setJawaban(prev => ({ ...prev, [soal.id]: currentVal + symbol }));
    }
  };

  const handleNext = () => {
    if (!isLastQuestion) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setStatus('loading');
    
    let sumAi = 0;
    const detailHasil: any[] = [];
    const dbInserts: any[] = [];
    const soalIds: string[] = [];

    // Evaluasi setiap soal
    for (const item of soalKuis) {
      soalIds.push(item.id);
      const jawabSiswa = jawaban[item.id] || '';
      
      if (item.tipe === 'pg') {
        let isBenar = false;
        
        try {
          const kunciArray = JSON.parse(item.kunci_jawaban);
          const jawabArray = Array.isArray(jawabSiswa) ? jawabSiswa : [jawabSiswa];
          
          // Sort both arrays and compare stringified version for exact match
          const kStr = JSON.stringify([...kunciArray].sort());
          const jStr = JSON.stringify([...jawabArray].sort());
          isBenar = kStr === jStr;
        } catch (e) {
          // Fallback if parsing fails (e.g. old data or plain string)
          isBenar = jawabSiswa === item.kunci_jawaban;
        }

        const skorAi = isBenar ? 100 : 0;
        sumAi += skorAi;
        
        detailHasil.push({
          soal: item.pertanyaan.split('|||')[0], // Clean up UI rendering for feedback
          skor: skorAi,
          maksSkor: 100,
          feedback: isBenar ? 'Benar!' : `Salah. Jawaban yang benar tidak sesuai.`
        });

        dbInserts.push({
          soal_id: item.id,
          siswa_id: SISWA_ID,
          jawaban: typeof jawabSiswa === 'string' ? jawabSiswa : JSON.stringify(jawabSiswa),
          skor_ai: isBenar ? 100 : 0, // Selalu simpan skala 0-100 di database
          feedback_ai: isBenar ? 'Auto-Graded: Benar' : 'Auto-Graded: Salah',
          status: 'pending_verifikasi'
        });

      } else if (item.tipe === 'uraian') {
        // Panggil AI
        try {
          const res = await fetch('/api/ai/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pertanyaan: item.pertanyaan,
              kunciJawaban: item.kunci_jawaban,
              jawabanSiswa: jawabSiswa
            })
          });
          const data = await res.json();
          
          if (!res.ok || typeof data.skor !== 'number') {
            throw new Error(data.error || data.feedback || 'Invalid response from AI');
          }
          
          sumAi += data.skor;
          
          detailHasil.push({
            soal: item.pertanyaan,
            skor: data.skor,
            maksSkor: 100,
            feedback: `(AI) ${data.feedback}`
          });

          dbInserts.push({
            soal_id: item.id,
            siswa_id: SISWA_ID,
            jawaban: jawabSiswa,
            skor_ai: data.skor, // Selalu simpan skala 0-100 dari AI
            feedback_ai: data.feedback,
            status: 'pending_verifikasi'
          });

        } catch (e: any) {
          detailHasil.push({
            soal: item.pertanyaan,
            skor: 0,
            maksSkor: 100,
            feedback: 'Gagal menghubungi AI untuk koreksi.'
          });
          dbInserts.push({
            soal_id: item.id,
            siswa_id: SISWA_ID,
            jawaban: jawabSiswa,
            skor_ai: 0,
            feedback_ai: 'Gagal koreksi AI',
            status: 'pending_verifikasi'
          });
        }
      }
    }

    // Hapus jawaban lama untuk kuis ini agar tidak duplikat jika siswa resubmit
    if (soalIds.length > 0) {
      const { error: delError } = await supabase.from('jawaban_siswa')
        .delete()
        .eq('siswa_id', SISWA_ID)
        .in('soal_id', soalIds);
      if (delError) console.error('Error delete old answers:', delError);
    }

    // Insert ke DB!
    const { error: dbError } = await supabase.from('jawaban_siswa').insert(dbInserts);
    if (dbError) {
      console.error('Error insert jawaban:', dbError);
      customAlert('Gagal mengirim jawaban ke server: ' + dbError.message, true);
      setStatus('milih_kuis');
      return;
    }

    const finalSkor = Math.round(sumAi / Math.max(1, soalKuis.length));
    setHasil({ totalSkor: finalSkor, detail: detailHasil });
    setStatus('selesai');
    
    // Update local state directly so it reflects instantly without relying on a refetch
    if (selectedKuis) {
      setSubmittedKuis(prev => ({ ...prev, [selectedKuis.id]: true }));
    }
    
    // Exit Exam Mode
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log(e));
    }
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const topbar = document.querySelector('.topbar') as HTMLElement;
    if (sidebar) {
      sidebar.style.display = ''; // Reset inline style
    }
    if (topbar) {
      topbar.style.display = ''; // Reset inline style
    }
  };

  if (loading || userLoading) return <div className="text-center mt-4">Loading data...</div>;

  if (status === 'milih_kuis') {
    return (
      <div className="card card-body">
        <h3 className="mb-3">Daftar Kuis & Tugas Tersedia</h3>
        {kuisList.length === 0 ? (
          <p className="text-muted">Belum ada tugas/kuis dari guru.</p>
        ) : (
          <div className="table-responsive mt-3">
            <table className="table">
              <thead><tr><th>Bab / Topik</th><th>Judul Tugas</th><th>Tipe</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {kuisList.map(kuis => (
                  <tr key={kuis.id}>
                    <td>{kuis.judul_bab}</td>
                    <td><strong>{kuis.judul}</strong></td>
                    <td><span className="badge badge-info">{kuis.tipe.toUpperCase()}</span></td>
                    <td>
                      {submittedKuis[kuis.id] ? (
                        <span className="badge badge-success">Selesai</span>
                      ) : (
                        <span className="badge badge-warning">Belum Dikerjakan</span>
                      )}
                    </td>
                    <td>
                      {submittedKuis[kuis.id] ? (
                        <button disabled className="btn btn-sm btn-outline">Sudah Dikerjakan</button>
                      ) : (
                        <button onClick={() => startKuis(kuis)} className="btn btn-sm btn-primary">Kerjakan Sekarang</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (status === 'selesai' && hasil) {
    return (
      <div className="card card-body text-center">
        <h3 className="text-primary">Hasil Kuis Disimpan</h3>
        <p style={{ fontSize: '4rem', fontWeight: 'bold', margin: '1.5rem 0' }} className="text-dark">{hasil.totalSkor}</p>
        <p className="text-success font-bold mb-4">Jawaban berhasil dikirim ke guru untuk diverifikasi!</p>
        
        <div className="text-left" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h4 className="mb-3">Rincian Koreksi:</h4>
          <ul className="notif-list">
            {hasil.detail.map((d, i) => (
              <li key={i} className="notif-item" style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'var(--slate-50)', borderRadius: '8px' }}>
                <p className="font-bold d-flex justify-between">
                  Soal {i+1} 
                  <span className="text-primary">{d.skor}/{d.maksSkor} poin</span>
                </p>
                <p className="text-muted mt-2">{d.feedback}</p>
              </li>
            ))}
          </ul>
        </div>
        
        <button onClick={() => {
          setStatus('milih_kuis');
          setSelectedKuis(null);
          // Just in case, ensure exam mode is fully exited
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(e => console.log(e));
          }
          const sidebar = document.querySelector('.sidebar') as HTMLElement;
          const topbar = document.querySelector('.topbar') as HTMLElement;
          if (sidebar) sidebar.style.display = '';
          if (topbar) topbar.style.display = '';
        }} className="btn btn-primary mt-4">Kembali ke Daftar Tugas</button>
      </div>
    );
  }

  if (!soal) return <div>Tidak ada soal di kuis ini.</div>;

  return (
    <div className="exam-card">
      <div className="exam-top-bar">
        <h3>{selectedKuis?.judul}</h3>
        <div className="exam-timer">Siswa: Andi</div>
      </div>
      
      <div className="mb-3 d-flex justify-between align-center">
        <h4 className="text-dark">Soal {currentIndex + 1} / {soalKuis.length}</h4>
        <span className="badge badge-primary">{soal.tipe.toUpperCase()}</span>
      </div>
      
      <p className="exam-question-text" style={{ whiteSpace: 'pre-wrap' }}>
        {soal.pertanyaan.includes('|||') ? soal.pertanyaan.split('|||')[0] : soal.pertanyaan}
      </p>
      
      <div className="form-group mt-4">
        <label>Jawaban Kamu:</label>
        {soal.tipe === 'uraian' && (
          <div className="math-toolbar">
            <button type="button" className="btn-symbol" onClick={() => insertSymbol('√')}>√</button>
            <button type="button" className="btn-symbol" onClick={() => insertSymbol('²')}>²</button>
            <button type="button" className="btn-symbol" onClick={() => insertSymbol('π')}>π</button>
            <button type="button" className="btn-symbol" onClick={() => insertSymbol('×')}>×</button>
            <button type="button" className="btn-symbol" onClick={() => insertSymbol('÷')}>÷</button>
          </div>
        )}
        
        {soal.tipe === 'pg' ? (
          <div className="options-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             {(() => {
                 let options: string[] = [];
                 let isMultiple = false;
                 if (soal.pertanyaan.includes('|||')) {
                    const parts = soal.pertanyaan.split('|||');
                    try { options = JSON.parse(parts[1]); } catch(e) {}
                    if (parts.length > 2) isMultiple = parts[2] === 'true';
                 }
                 return options.length > 0 ? (
                    options.map((opt, i) => {
                      const isChecked = isMultiple 
                        ? (Array.isArray(jawaban[soal.id]) && jawaban[soal.id].includes(opt))
                        : jawaban[soal.id] === opt;
                      
                      return (
                        <label key={i} className="d-flex align-center gap-2 p-3 border rounded" style={{ cursor: 'pointer', background: isChecked ? 'var(--blue-50)' : 'transparent', borderColor: isChecked ? 'var(--blue-500)' : '#ddd', margin: 0 }}>
                           <input 
                             type={isMultiple ? "checkbox" : "radio"} 
                             name={`soal-${soal.id}`} 
                             value={opt} 
                             checked={isChecked} 
                             onChange={e => isMultiple ? handleCheckboxChange(opt) : handleJawabanChange(e.target.value)} 
                             style={{ transform: 'scale(1.2)', marginRight: '8px' }} 
                           />
                           {opt}
                        </label>
                      );
                    })
                 ) : (
                    <input type="text" className="form-control" value={jawaban[soal.id] || ''} onChange={e => handleJawabanChange(e.target.value)} placeholder="Ketik persis opsi jawabannya..." />
                 );
             })()}
          </div>
        ) : (
          <textarea 
            className="form-control textarea-math" 
            rows={5}
            placeholder="Ketik jawaban dan langkah-langkahmu di sini..."
            value={jawaban[soal.id] || ''}
            onChange={(e) => handleJawabanChange(e.target.value)}
          />
        )}
      </div>
      
      <div className="d-flex justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--slate-200)' }}>
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0 || status === 'loading'}
          className="btn btn-outline"
        >
          Sebelumnya
        </button>
        
        {isLastQuestion ? (
          <button 
            onClick={handleSubmit}
            disabled={status === 'loading'}
            className="btn btn-success"
          >
            {status === 'loading' ? 'Mengoreksi...' : 'Kirim & Selesai'}
          </button>
        ) : (
          <button 
            onClick={handleNext}
            className="btn btn-primary"
          >
            Selanjutnya
          </button>
        )}
      </div>
    </div>
  );
}
