'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function GuruUjian() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [ujianList, setUjianList] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    kelas_id: '',
    jenis: 'UH',
    deskripsi: '',
    durasi_menit: 60
  });

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch kelas
    const { data: guruKelas } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama)')
      .eq('guru_id', userId);
      
    if (guruKelas) {
      // @ts-ignore
      setKelasList(guruKelas.map(gk => gk.kelas).filter(Boolean));
    }

    // Fetch Ujian
    const { data: ujianData } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi, durasi_menit, created_at, kelas(nama)')
      .eq('guru_id', userId)
      .order('created_at', { ascending: false });

    if (ujianData) {
      setUjianList(ujianData);
    }
    
    setLoading(false);
  };

  const handleSimpanUjian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kelas_id) {
      customAlert('Pilih kelas terlebih dahulu!', true);
      return;
    }

    const { error } = await supabase.from('ujian').insert({
      guru_id: userId,
      kelas_id: formData.kelas_id,
      jenis: formData.jenis,
      deskripsi: formData.deskripsi,
      durasi_menit: formData.durasi_menit
    });

    if (error) {
      customAlert('Gagal membuat ujian: ' + error.message, true);
    } else {
      setShowModal(false);
      setFormData({ kelas_id: '', jenis: 'UH', deskripsi: '', durasi_menit: 60 });
      fetchData();
    }
  };

  const hapusUjian = async (id: string) => {
    if (!confirm('Yakin ingin menghapus ujian ini? Semua soal di dalamnya akan terhapus.')) return;
    const { error } = await supabase.from('ujian').delete().eq('id', id);
    if (error) {
      customAlert('Gagal menghapus: ' + error.message, true);
    } else {
      fetchData();
    }
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div>
          <h2 style={{ margin: 0 }}>Manajemen Ujian</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Kelola ujian (UH, UTS, UAS) untuk kelas Anda.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">+ Buat Ujian Baru</button>
      </div>

      <div className="card card-body">
        {loading ? (
          <p className="text-center my-4">Memuat data...</p>
        ) : ujianList.length === 0 ? (
          <p className="text-center text-muted my-4">Belum ada ujian yang dibuat.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal Dibuat</th>
                  <th>Kelas</th>
                  <th>Jenis</th>
                  <th>Deskripsi</th>
                  <th>Durasi (Menit)</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ujianList.map(u => (
                  <tr key={u.id}>
                    <td>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                    <td><strong>{u.kelas?.nama}</strong></td>
                    <td>
                      <span className={`badge ${u.jenis === 'UH' ? 'badge-info' : (u.jenis === 'UTS' ? 'badge-warning' : 'badge-danger')}`}>
                        {u.jenis}
                      </span>
                    </td>
                    <td>{u.deskripsi}</td>
                    <td>{u.durasi_menit}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/guru/ujian/${u.id}`} className="btn btn-sm btn-outline">
                          Kelola Soal
                        </Link>
                        <button onClick={() => hapusUjian(u.id)} className="btn btn-sm btn-danger">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Buat Ujian Baru</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpanUjian}>
                <div className="form-group">
                  <label>Pilih Kelas</label>
                  <select 
                    className="form-control" 
                    value={formData.kelas_id} 
                    onChange={e => setFormData({...formData, kelas_id: e.target.value})}
                    required
                  >
                    <option value="">Pilih...</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mt-3">
                  <label>Jenis Ujian</label>
                  <select 
                    className="form-control" 
                    value={formData.jenis} 
                    onChange={e => setFormData({...formData, jenis: e.target.value})}
                  >
                    <option value="UH">Ulangan Harian (UH)</option>
                    <option value="UTS">Ujian Tengah Semester (UTS)</option>
                    <option value="UAS">Ujian Akhir Semester (UAS)</option>
                  </select>
                </div>

                <div className="form-group mt-3">
                  <label>Deskripsi (Opsional)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.deskripsi} 
                    onChange={e => setFormData({...formData, deskripsi: e.target.value})}
                    placeholder="Contoh: UH Matematika Bab 1"
                  />
                </div>

                <div className="form-group mt-3">
                  <label>Batas Waktu / Durasi Pengerjaan (Menit)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={formData.durasi_menit} 
                    onChange={e => setFormData({...formData, durasi_menit: parseInt(e.target.value) || 60})}
                    min="10"
                    required
                  />
                </div>

                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Ujian</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
