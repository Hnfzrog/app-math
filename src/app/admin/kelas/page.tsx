'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminMasterKelas() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [namaKelas, setNamaKelas] = useState('');

  useEffect(() => {
    fetchKelas();
  }, []);

  const fetchKelas = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('kelas').select('*').order('nama', { ascending: true });
    
    if (!error && data) {
      setKelasList(data);
    }
    setLoading(false);
  };

  const handleEdit = (kelas: any) => {
    setEditingId(kelas.id);
    setNamaKelas(kelas.nama);
    setShowModal(true);
  };

  const hapusKelas = async (id: string) => {
    if (confirm('Yakin ingin menghapus kelas ini? Peringatan: Menghapus kelas mungkin akan error jika ada data guru/siswa yang terhubung (Foreign Key Constraint).')) {
      const { error } = await supabase.from('kelas').delete().eq('id', id);
      if (error) {
        alert('Gagal menghapus kelas: ' + error.message);
      } else {
        fetchKelas();
      }
    }
  };

  const handleSimpanKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (namaKelas.trim() === '') return;

    if (editingId) {
      // Edit
      const { error } = await supabase.from('kelas').update({ nama: namaKelas }).eq('id', editingId);
      if (error) alert('Gagal update kelas: ' + error.message);
    } else {
      // Create new (generate mock UUID for id)
      const fakeUuid = 'c' + Date.now() + '-1111-1111-1111-111111111111';
      const { error } = await supabase.from('kelas').insert({ id: fakeUuid, nama: namaKelas });
      if (error) alert('Gagal tambah kelas: ' + error.message);
    }

    setShowModal(false);
    setNamaKelas('');
    setEditingId(null);
    fetchKelas();
  };

  const bukaModalBaru = () => {
    setEditingId(null);
    setNamaKelas('');
    setShowModal(true);
  };

  return (
    <div className="card card-body">
      <div className="table-controls">
        <h3>Master Data Kelas</h3>
        <button className="btn btn-primary" onClick={bukaModalBaru}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
          Tambah Kelas Baru
        </button>
      </div>

      <div className="table-responsive">
        {loading ? (
          <p className="text-center mt-3 mb-3">Loading data...</p>
        ) : kelasList.length === 0 ? (
          <p className="text-center text-muted mt-3 mb-3">Belum ada data kelas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID Kelas</th>
                <th>Nama Kelas</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kelasList.map(kelas => (
                <tr key={kelas.id}>
                  <td><span className="text-muted text-sm">{kelas.id.substring(0, 8)}...</span></td>
                  <td><strong>{kelas.nama}</strong></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(kelas)} className="btn btn-sm btn-outline">Edit</button>
                      <button onClick={() => hapusKelas(kelas.id)} className="btn btn-sm btn-danger">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>{editingId ? 'Edit Kelas' : 'Tambah Kelas Baru'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpanKelas}>
                <div className="form-group">
                  <label>Nama Kelas</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={namaKelas} 
                    onChange={(e) => setNamaKelas(e.target.value)} 
                    placeholder="Contoh: 7 (saat ini hanya menerima 7, 8, atau 9)"
                    required
                  />
                  <small className="text-muted mt-1" style={{ display: 'block' }}>
                    *Info: Default database mungkin hanya menerima input '7', '8', atau '9'. Hubungi tim teknis (jalankan SQL DROP CONSTRAINT) jika ingin nama bebas.
                  </small>
                </div>
                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Kelas</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
