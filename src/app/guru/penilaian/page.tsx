'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GuruPenilaian() {
  const [kelas, setKelas] = useState('7');
  const [bab, setBab] = useState('');
  const [babs, setBabs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [siswaAnswers, setSiswaAnswers] = useState<any[]>([]);
  const [keaktifan, setKeaktifan] = useState<Record<string, number>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);

  useEffect(() => {
    fetchBabs();
  }, [kelas]);

  useEffect(() => {
    if (bab) {
      fetchJawaban();
      
      // Realtime listener
      const channel = supabase.channel('guru-penilaian-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa' }, () => {
          fetchJawaban();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [bab]);

  const fetchBabs = async () => {
    const { data: dataKelas } = await supabase.from('kelas').select('id').eq('nama', kelas).single();
    if (dataKelas) {
      const { data } = await supabase.from('bab').select('*').eq('kelas_id', dataKelas.id).order('nomor');
      setBabs(data || []);
      if (data && data.length > 0) setBab(data[0].id);
      else {
        setBab('');
        setSiswaAnswers([]);
      }
    }
  };

  const fetchJawaban = async () => {
    setLoading(true);
    // Cari semua jawaban_siswa di bab ini. Karena soal berelasi ke konten, konten ke bab.
    // Untuk MVP, kita group berdasarkan siswa_id yang mengerjakan soal dari bab ini.
    
    // 1. Dapatkan semua ID soal di bab ini
    const { data: kontens } = await supabase.from('konten').select('id').eq('bab_id', bab);
    if (!kontens || kontens.length === 0) {
      setSiswaAnswers([]);
      setLoading(false);
      return;
    }
    
    const kontenIds = kontens.map(k => k.id);
    const { data: soals } = await supabase.from('soal').select('id, pertanyaan').in('konten_id', kontenIds);
    
    const mapSoal: Record<string, string> = {};
    if (soals) {
      soals.forEach(s => mapSoal[s.id] = s.pertanyaan);
    }
    
    const idsToFilter = soals?.map(s => s.id) || [];

    if (idsToFilter.length > 0) {
      const { data: jawabanData, error: errJawaban } = await supabase
        .from('jawaban_siswa')
        .select('id, siswa_id, skor_ai, skor_final, status, jawaban, soal_id, users!inner(nama)')
        .in('soal_id', idsToFilter);
        
      if (errJawaban) {
        console.error('Error fetching jawabanData:', errJawaban);
        
        // Fallback kalau join users gagal (misal FK beda nama)
        const { data: fallbackData } = await supabase
          .from('jawaban_siswa')
          .select('*')
          .in('soal_id', idsToFilter);
          
        if (fallbackData) {
          // Bikin data mock buat nama siswa
          const mapSiswa: Record<string, any> = {};
          fallbackData.forEach(j => {
            if (!mapSiswa[j.siswa_id]) {
              mapSiswa[j.siswa_id] = { id: j.siswa_id, nama: 'Siswa ID: ' + j.siswa_id.substring(0,6), total_ai: 0, count: 0, status: j.status, id_jawaban: [], has_pending: false, details: [] };
            }
            mapSiswa[j.siswa_id].total_ai += Number(j.skor_ai || 0);
            mapSiswa[j.siswa_id].count += 1;
            mapSiswa[j.siswa_id].id_jawaban.push(j.id);
            mapSiswa[j.siswa_id].details.push({ pertanyaan: mapSoal[j.soal_id] || '-', jawaban: j.jawaban, skor_ai: j.skor_ai, status: j.status });
            if (j.status === 'pending_verifikasi') mapSiswa[j.siswa_id].has_pending = true;
          });
          
          setSiswaAnswers(Object.values(mapSiswa).map((s: any) => {
            if (!s.has_pending) setVerified(prev => ({ ...prev, [s.id]: true }));
            else setVerified(prev => ({ ...prev, [s.id]: false }));
            return { ...s, avg_ai: Math.round(s.total_ai / s.count) };
          }));
          setLoading(false);
          return;
        }
      }
        
      if (jawabanData) {
        // Gabungkan nilai berdasarkan siswa
        const mapSiswa: Record<string, any> = {};
        jawabanData.forEach(j => {
          if (!mapSiswa[j.siswa_id]) {
            mapSiswa[j.siswa_id] = { id: j.siswa_id, nama: j.users?.nama, total_ai: 0, count: 0, status: j.status, id_jawaban: [], has_pending: false, details: [] };
          }
          mapSiswa[j.siswa_id].total_ai += Number(j.skor_ai || 0);
          mapSiswa[j.siswa_id].count += 1;
          mapSiswa[j.siswa_id].id_jawaban.push(j.id);
          mapSiswa[j.siswa_id].details.push({ pertanyaan: mapSoal[j.soal_id] || '-', jawaban: j.jawaban, skor_ai: j.skor_ai, status: j.status });
          
          if (j.status === 'pending_verifikasi') {
            mapSiswa[j.siswa_id].has_pending = true;
          }
        });
        
        const finalArr = Object.values(mapSiswa).map((s: any) => {
          if (!s.has_pending) {
            setVerified(prev => ({ ...prev, [s.id]: true }));
          } else {
            setVerified(prev => ({ ...prev, [s.id]: false }));
          }
          return {
            ...s,
            avg_ai: Math.round(s.total_ai / s.count)
          };
        });
        
        setSiswaAnswers(finalArr);
      }
    } else {
      setSiswaAnswers([]);
    }
    
    setLoading(false);
  };

  const handleVerifikasi = async (siswaId: string, avgAi: number, ids: string[]) => {
    const nilaiAktif = keaktifan[siswaId] || 0;
    const totalAkhir = Math.round((nilaiAktif * 0.2) + (avgAi * 0.8));
    
    // Update ke DB
    let hasError = false;
    for (const jid of ids) {
      const { data: updatedData, error } = await supabase.from('jawaban_siswa').update({
        skor_final: totalAkhir,
        status: 'final'
      }).eq('id', jid).select();
      
      if (error || !updatedData || updatedData.length === 0) {
        console.error('Update gagal atau diblokir RLS:', error);
        hasError = true;
      }
    }
    
    if (hasError) {
      alert('Gagal memverifikasi nilai. Hal ini biasanya terjadi karena Row Level Security (RLS) di Supabase memblokir operasi UPDATE. Silakan matikan RLS pada tabel jawaban_siswa.');
    } else {
      setVerified(prev => ({ ...prev, [siswaId]: true }));
      alert('Nilai berhasil dikunci dan dikirim ke siswa!');
    }
  };

  return (
    <div>
      <div className="card card-body mb-4">
        <div className="grid-2 align-center">
          <div className="form-group mb-0">
            <label>Pilih Kelas</label>
            <select className="form-control" value={kelas} onChange={(e) => setKelas(e.target.value)}>
              <option value="7">Kelas 7</option>
              <option value="8">Kelas 8</option>
              <option value="9">Kelas 9</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label>Pilih Bab Modul</label>
            <select className="form-control" value={bab} onChange={(e) => setBab(e.target.value)}>
              {babs.map(b => (
                <option key={b.id} value={b.id}>{b.judul}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card card-body">
        <div className="table-controls">
          <h3>Data Nilai & Verifikasi</h3>
        </div>

        <div className="table-responsive">
          {loading ? (
            <p className="text-center p-3">Loading data...</p>
          ) : siswaAnswers.length === 0 ? (
            <p className="text-center text-muted p-3">Belum ada siswa yang mengerjakan kuis di bab ini.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Siswa</th>
                  <th>Keaktifan (20%)</th>
                  <th>Hasil Kuis AI (80%)</th>
                  <th>Total Nilai Akhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {siswaAnswers.map(siswa => {
                  const nilaiAktif = keaktifan[siswa.id] || 0;
                  const isVerified = verified[siswa.id];
                  const totalAkhir = Math.round((nilaiAktif * 0.2) + (siswa.avg_ai * 0.8));

                  return (
                    <tr key={siswa.id} style={{ backgroundColor: isVerified ? '#F5FAFF' : 'transparent' }}>
                      <td><strong>{siswa.nama}</strong></td>
                      <td>
                        <input 
                          type="number" 
                          className="form-control"
                          value={nilaiAktif === 0 ? '' : nilaiAktif} 
                          onChange={(e) => setKeaktifan(prev => ({ ...prev, [siswa.id]: parseInt(e.target.value) || 0 }))}
                          disabled={isVerified}
                          style={{ width: '80px' }} 
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <span className="text-primary font-bold">{siswa.avg_ai}</span> <span className="text-sm text-muted">AI</span>
                      </td>
                      <td>
                        <span className="font-bold" style={{ fontSize: '1.2rem' }}>{totalAkhir}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setSelectedSiswa(siswa)} className="btn btn-sm btn-info">Detail</button>
                          {isVerified ? (
                            <span className="badge badge-success">Terverifikasi</span>
                          ) : (
                            <button onClick={() => handleVerifikasi(siswa.id, siswa.avg_ai, siswa.id_jawaban)} className="btn btn-sm btn-outline">Kunci Nilai</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-sm text-muted">* Kolom keaktifan (manual guru) berbobot 20% dan hasil kuis (AI Grading) berbobot 80% ke total nilai akhir.</p>
      </div>

      {selectedSiswa && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Detail Jawaban: {selectedSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setSelectedSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {selectedSiswa.details.map((det: any, idx: number) => (
                <div key={idx} className="card card-body mb-3" style={{ border: '1px solid #ddd', padding: '15px' }}>
                  <p><strong>Soal:</strong> {det.pertanyaan}</p>
                  <p><strong>Jawaban Siswa:</strong> <br /> <span style={{ whiteSpace: 'pre-wrap' }}>{det.jawaban || '-'}</span></p>
                  <div className="d-flex justify-between mt-3">
                    <span className="badge badge-info">Skor AI: {det.skor_ai}</span>
                    <span className={`badge ${det.status === 'final' ? 'badge-success' : 'badge-warning'}`}>
                      {det.status === 'final' ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                </div>
              ))}
              <div className="d-flex justify-between mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedSiswa(null)}>Tutup</button>
                {!verified[selectedSiswa.id] && (
                  <button type="button" className="btn btn-primary" onClick={() => {
                    handleVerifikasi(selectedSiswa.id, selectedSiswa.avg_ai, selectedSiswa.id_jawaban);
                    setSelectedSiswa(null);
                  }}>Kunci Nilai Siswa Ini</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
