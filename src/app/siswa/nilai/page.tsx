'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SiswaNilai() {
  const [loading, setLoading] = useState(true);
  const [dataNilai, setDataNilai] = useState<any[]>([]);
  
  const SISWA_ID = 'e0000000-0000-0000-0000-000000000001'; // Mock ID

  useEffect(() => {
    fetchNilai();

    // Listen to updates from Guru
    const channel = supabase.channel('siswa-nilai-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa', filter: `siswa_id=eq.${SISWA_ID}` }, () => {
        fetchNilai();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNilai = async () => {
    setLoading(true);
    try {
      // 1. Ambil semua jawaban siswa ini
      const { data: jawabans, error: errJawabans } = await supabase.from('jawaban_siswa').select('*').eq('siswa_id', SISWA_ID);
      if (errJawabans) console.error('Error jawabans:', errJawabans);
      if (!jawabans || jawabans.length === 0) {
        setDataNilai([]);
        return;
      }
      
      const soalIds = jawabans.map(j => j.soal_id);
      
      // 2. Ambil referensi soal
      const { data: soals, error: errSoals } = await supabase.from('soal').select('id, konten_id').in('id', soalIds);
      if (errSoals) console.error('Error soals:', errSoals);
      if (!soals || soals.length === 0) return;
      
      const kontenIds = [...new Set(soals.map(s => s.konten_id))];
      
      // 3. Ambil konten
      const { data: kontens, error: errKontens } = await supabase.from('konten').select('id, bab_id, judul, tipe').in('id', kontenIds);
      if (errKontens) console.error('Error kontens:', errKontens);
      if (!kontens || kontens.length === 0) return;
      
      const babIds = [...new Set(kontens.map(k => k.bab_id))];
      
      // 4. Ambil bab
      const { data: babs } = await supabase.from('bab').select('id, judul').in('id', babIds);
      
      // Map semuanya menjadi data per modul
      const hasilAkhir: any[] = [];
      
      for (const konten of kontens) {
        const bab = babs?.find(b => b.id === konten.bab_id);
        const soalTerkait = soals.filter(s => s.konten_id === konten.id).map(s => s.id);
        const jawabanUntukKonten = jawabans.filter(j => soalTerkait.includes(j.soal_id));
        
        let totalSkor = 0;
        let isDinilaiGuru = true;
        
        jawabanUntukKonten.forEach(j => {
          if (j.skor_final !== null && j.skor_final !== undefined) {
            totalSkor += j.skor_final;
          } else {
            totalSkor += (j.skor_ai || 0);
            if (j.status !== 'final') {
              isDinilaiGuru = false;
            }
          }
        });
        
        hasilAkhir.push({
          id: konten.id,
          judulBab: bab ? bab.judul : 'Bab Tidak Diketahui',
          judulModul: konten.judul,
          tipe: konten.tipe,
          skor: totalSkor,
          status: isDinilaiGuru ? 'Sudah Dinilai' : 'Menunggu Verifikasi Guru'
        });
      }
      
      setDataNilai(hasilAkhir);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-4">Loading data nilai...</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Nilai Saya</h1>
      <div className="card card-body">
        {dataNilai.length === 0 ? (
          <p className="text-muted">Kamu belum mengerjakan tugas atau kuis apapun.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Bab / Topik</th>
                  <th>Kategori</th>
                  <th>Judul Tugas/Ujian</th>
                  <th>Nilai Total</th>
                  <th>Status Penilaian</th>
                </tr>
              </thead>
              <tbody>
                {dataNilai.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.judulBab}</td>
                    <td><span className="badge badge-info">{item.tipe.toUpperCase()}</span></td>
                    <td><strong>{item.judulModul}</strong></td>
                    <td>
                      <span className="text-primary font-bold" style={{ fontSize: '1.2rem' }}>
                        {item.skor}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${item.status === 'Sudah Dinilai' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
