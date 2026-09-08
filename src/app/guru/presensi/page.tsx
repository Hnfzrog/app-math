'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function GuruPresensi() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [kelas, setKelas] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [kehadiran, setKehadiran] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [realKelasId, setRealKelasId] = useState<string | null>(null);

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
      classes.sort((a: any, b: any) => a.nama.localeCompare(b.nama));
      setAssignedClasses(classes);
      setKelas(classes[0].id);
    }
  };

  useEffect(() => {
    if (kelas && tanggal) fetchSiswa();
  }, [kelas, tanggal]);

  const fetchSiswa = async () => {
    if (!kelas) return;
    setLoading(true);
    setSaved(false);
    setRealKelasId(kelas);
    
    // 2. Cari Siswa di kelas tersebut via siswa_kelas join users
    const { data: dataSiswa } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama)')
      .eq('kelas_id', kelas);
      
    if (dataSiswa) {
      const formatted = dataSiswa.map((s: any) => ({
        id: s.siswa_id,
        nama: s.users?.nama || 'Unknown'
      }));
      setSiswaList(formatted);
      
      // 3. Tarik presensi hari ini jika ada
      const { data: presensiHariIni } = await supabase
        .from('presensi')
        .select('siswa_id, status')
        .eq('kelas_id', kelas)
        .eq('tanggal', tanggal);
        
      const kehMap: Record<string, string> = {};
      if (presensiHariIni && presensiHariIni.length > 0) {
        presensiHariIni.forEach(p => { kehMap[p.siswa_id] = p.status; });
      } else {
        // default masuk
        formatted.forEach(s => { kehMap[s.id] = 'masuk'; });
      }
      setKehadiran(kehMap);
    }
    
    setLoading(false);
  };

  const handleStatusChange = (id: string, status: string) => {
    setKehadiran(prev => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const handleSimpan = async () => {
    if (!realKelasId) return;
    setLoading(true);
    
    try {
      // Karena kita butuh update or insert, kita delete dulu yang di tanggal ini
      await supabase.from('presensi').delete().eq('kelas_id', realKelasId).eq('tanggal', tanggal);
      
      const inserts = siswaList.map(s => ({
        siswa_id: s.id,
        kelas_id: realKelasId,
        tanggal,
        status: kehadiran[s.id] || 'masuk'
      }));
      
      const { error } = await supabase.from('presensi').insert(inserts);
      
      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      customAlert("Gagal menyimpan presensi: " + err.message, true);
    } finally {
      setLoading(false);
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
            <label>Tanggal Presensi</label>
            <input type="date" className="form-control" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card card-body">
        <div className="table-controls">
          <h3>Form Kehadiran Siswa</h3>
        </div>

        <div className="table-responsive">
          {loading ? (
            <p className="text-center p-3">Loading data...</p>
          ) : siswaList.length === 0 ? (
            <p className="text-center text-muted p-3">Belum ada siswa di kelas ini.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Siswa</th>
                    <th>Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {siswaList.map(siswa => (
                    <tr key={siswa.id}>
                      <td><strong>{siswa.nama}</strong></td>
                      <td>
                        <select 
                          className="form-control"
                          value={kehadiran[siswa.id] || 'masuk'} 
                          onChange={(e) => handleStatusChange(siswa.id, e.target.value)}
                          style={{ width: '200px' }}
                        >
                          <option value="masuk">Masuk</option>
                          <option value="izin">Izin</option>
                          <option value="sakit">Sakit</option>
                          <option value="alpha">Alpha</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="d-flex align-center gap-3 mt-4">
                <button 
                  onClick={handleSimpan}
                  disabled={loading}
                  className="btn btn-primary">
                  {loading ? 'Menyimpan...' : 'Simpan Presensi'}
                </button>
                {saved && <span className="text-success font-bold">✅ Tersimpan!</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
