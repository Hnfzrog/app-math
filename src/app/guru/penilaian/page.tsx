'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function GuruPenilaian() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [kelas, setKelas] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);
  const [bab, setBab] = useState('');
  const [babs, setBabs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [siswaAnswers, setSiswaAnswers] = useState<any[]>([]);
  const [keaktifan, setKeaktifan] = useState<Record<string, number>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      fetchAssignedClasses();
    }
  }, [userId]);

  const fetchAssignedClasses = async () => {
    const { data } = await supabase
      .from('guru_kelas')
      .select('kelas_id, kelas:kelas_id(id, nama)')
      .eq('guru_id', userId);
    
    if (data && data.length > 0) {
      const classes = data.map(d => d.kelas);
      // Sort classes by name
      classes.sort((a: any, b: any) => a.nama.localeCompare(b.nama));
      setAssignedClasses(classes);
      setKelas(classes[0].id);
    }
  };

  useEffect(() => {
    if (kelas) fetchBabs();
  }, [kelas]);

  useEffect(() => {
    if (bab) {
      fetchJawaban();
      
      // Realtime listener
      const channel = supabase.channel('guru-penilaian-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa' }, () => {
          fetchJawaban(true);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [bab]);

  const fetchBabs = async () => {
    if (!kelas) return;
    const { data } = await supabase.from('bab').select('*').eq('kelas_id', kelas).order('nomor');
    setBabs(data || []);
    if (data && data.length > 0) setBab(data[0].id);
    else {
      setBab('');
      setSiswaAnswers([]);
    }
  };

  const fetchJawaban = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
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
        .select('id, siswa_id, skor_ai, skor_final, status, jawaban, soal_id')
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
            mapSiswa[j.siswa_id].details.push({ id: j.id, pertanyaan: mapSoal[j.soal_id] || '-', jawaban: j.jawaban, skor_ai: j.skor_ai, status: j.status });
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
        // Fetch user names separately to avoid TS inference issues
        const uniqueSiswaIds = [...new Set(jawabanData.map(j => j.siswa_id))];
        const { data: usersData } = await supabase.from('users').select('id, nama').in('id', uniqueSiswaIds);
        const mapNama: Record<string, string> = {};
        usersData?.forEach(u => { mapNama[u.id] = u.nama; });

        // Gabungkan nilai berdasarkan siswa
        const mapSiswa: Record<string, any> = {};
        jawabanData.forEach(j => {
          if (!mapSiswa[j.siswa_id]) {
            mapSiswa[j.siswa_id] = { id: j.siswa_id, nama: mapNama[j.siswa_id] || 'Siswa', total_ai: 0, count: 0, status: j.status, id_jawaban: [], has_pending: false, details: [] };
          }
          mapSiswa[j.siswa_id].total_ai += Number(j.skor_ai || 0);
          mapSiswa[j.siswa_id].count += 1;
          mapSiswa[j.siswa_id].id_jawaban.push(j.id);
          mapSiswa[j.siswa_id].details.push({ id: j.id, pertanyaan: mapSoal[j.soal_id] || '-', jawaban: j.jawaban, skor_ai: j.skor_ai, status: j.status });
          
          if (j.status === 'pending_verifikasi') {
            mapSiswa[j.siswa_id].has_pending = true;
          }
        });
        
        // Load nilai keaktifan dari tabel nilai
        const { data: nilaiData } = await supabase.from('nilai').select('siswa_id, kreativitas').eq('bab_id', bab);
        const verifiedIds = new Set(nilaiData?.map(n => n.siswa_id) || []);

        const finalArr = Object.values(mapSiswa).map((s: any) => {
          if (verifiedIds.has(s.id)) {
            s.has_pending = false;
          }

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

        const newKeaktifan: Record<string, number> = {};
        if (nilaiData) {
           nilaiData.forEach(n => {
              let val = n.kreativitas || 0;
              if (val > 100) val = 100;
              if (val < 0) val = 0;
              newKeaktifan[n.siswa_id] = val;
           });
        }
        setKeaktifan(newKeaktifan);
      }
    } else {
      setSiswaAnswers([]);
    }
    
    setLoading(false);
  };

  const handleUpdateSkorAI = async (idJawaban: string, newSkor: number) => {
    if (newSkor < 0 || newSkor > 100) {
       customAlert('Skor harus antara 0 dan 100', true);
       return;
    }
    const { error } = await supabase.from('jawaban_siswa').update({ skor_ai: newSkor }).eq('id', idJawaban);
    if (error) {
       console.error('Gagal update skor AI:', error);
       customAlert('Gagal mengupdate skor AI.', true);
    } else {
       fetchJawaban();
    }
  };

  const handleVerifikasi = async (siswaId: string, avgAi: number, ids: string[]) => {
    const nilaiAktif = keaktifan[siswaId] || 0;
    const totalAkhir = Math.round((nilaiAktif * 0.2) + (avgAi * 0.8));
    
    // Update ke DB (status jawaban_siswa)
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
    
    // Simpan ke tabel nilai (Hapus nilai lama untuk bab ini jika ada, lalu insert baru)
    if (!hasError && bab) {
      const { error: delError } = await supabase.from('nilai').delete().eq('siswa_id', siswaId).eq('bab_id', bab);
      if (delError) console.error('Gagal hapus nilai lama:', delError);
      
      const { error: insError } = await supabase.from('nilai').insert({
        siswa_id: siswaId,
        bab_id: bab,
        pengetahuan: avgAi,
        kreativitas: nilaiAktif
      });
      
      if (insError) {
        console.error('Gagal insert ke tabel nilai:', insError);
        hasError = true;
      }
    }
    
    if (hasError) {
      customAlert('Gagal memverifikasi nilai. Hal ini biasanya terjadi karena Row Level Security (RLS) di Supabase memblokir operasi UPDATE. Silakan matikan RLS pada tabel jawaban_siswa.', true);
    } else {
      setVerified(prev => ({ ...prev, [siswaId]: true }));
      customAlert('Nilai berhasil dikunci dan dikirim ke siswa!');
    }
  };

  return (
    <div>
      <div className="card card-body mb-4">
        <div className="grid-2 align-center">
          <div className="form-group mb-0">
            <label>Pilih Kelas</label>
            <select className="form-control" value={kelas} onChange={(e) => setKelas(e.target.value)} disabled={assignedClasses.length === 0}>
              {assignedClasses.length === 0 && <option value="">Tidak ada kelas</option>}
              {assignedClasses.map(c => (
                <option key={c.id} value={c.id}>Kelas {c.nama}</option>
              ))}
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
                          onChange={(e) => {
                             let val = parseInt(e.target.value) || 0;
                             if (val > 100) val = 100;
                             if (val < 0) val = 0;
                             setKeaktifan(prev => ({ ...prev, [siswa.id]: val }));
                          }}
                          min="0"
                          max="100"
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
                            <button onClick={() => handleVerifikasi(siswa.id, siswa.avg_ai, siswa.id_jawaban)} className="btn btn-sm btn-primary">Update Nilai</button>
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
                  <div className="d-flex justify-between mt-3 align-center">
                    <div className="d-flex gap-2 align-center">
                      <span className="text-sm font-bold">Skor AI:</span>
                      <input 
                        type="number" 
                        className="form-control form-control-sm" 
                        defaultValue={det.skor_ai} 
                        onBlur={(e) => {
                          const newScore = parseInt(e.target.value);
                          if (!isNaN(newScore) && newScore !== det.skor_ai) {
                            handleUpdateSkorAI(det.id, newScore);
                            const updatedSiswa = { ...selectedSiswa };
                            const targetDet = updatedSiswa.details.find((d: any) => d.id === det.id);
                            if (targetDet) targetDet.skor_ai = newScore;
                            
                            // Recalculate avg_ai on the fly so it's instantly correct
                            let total = 0;
                            updatedSiswa.details.forEach((d: any) => total += Number(d.skor_ai || 0));
                            updatedSiswa.avg_ai = Math.round(total / updatedSiswa.details.length);
                            
                            setSelectedSiswa(updatedSiswa);
                          }
                        }}
                        style={{ width: '70px' }} 
                        title="Klik untuk mengedit skor yang diberikan AI"
                      />
                    </div>
                    <span className={`badge ${det.status === 'final' ? 'badge-success' : 'badge-warning'}`}>
                      {det.status === 'final' ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                </div>
              ))}
              <div className="d-flex justify-between mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedSiswa(null)}>Tutup</button>
                <button type="button" className="btn btn-primary" onClick={() => {
                  handleVerifikasi(selectedSiswa.id, selectedSiswa.avg_ai, selectedSiswa.id_jawaban);
                  setSelectedSiswa(null);
                }}>
                  {verified[selectedSiswa.id] ? 'Update Nilai Siswa Ini' : 'Kunci Nilai Siswa Ini'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
