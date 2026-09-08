'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';

export default function AdminMasterKelas() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [angkatan, setAngkatan] = useState('7');
  const [subKelas, setSubKelas] = useState('');

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
    setAngkatan(kelas.angkatan || '7');
    setSubKelas(kelas.sub_kelas || '');
    setShowModal(true);
  };

  const bukaModalBaru = () => {
    setEditingId(null);
    setAngkatan('7');
    setSubKelas('');
    setShowModal(true);
  };

  const hapusKelas = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDeleteKelas = async () => {
    if (!confirmDeleteId) return;
    const { error } = await supabase.from('kelas').delete().eq('id', confirmDeleteId);
    if (error) {
      customAlert('Gagal menghapus kelas: ' + error.message, true);
    } else {
      fetchKelas();
    }
    setConfirmDeleteId(null);
  };

  const handleSimpanKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubKelas = subKelas.trim() === '' ? null : subKelas.trim();
    const computedNama = `${angkatan}${finalSubKelas || ''}`;

    if (editingId) {
      // Edit
      const { error } = await supabase.from('kelas').update({ 
        nama: computedNama, 
        angkatan, 
        sub_kelas: finalSubKelas 
      }).eq('id', editingId);
      if (error) customAlert('Gagal update kelas: ' + error.message, true);
    } else {
      // Create new (database will generate UUID)
      const { error } = await supabase.from('kelas').insert({ 
        nama: computedNama, 
        angkatan, 
        sub_kelas: finalSubKelas 
      });
      if (error) customAlert('Gagal tambah kelas: ' + error.message, true);
    }

    setShowModal(false);
    setAngkatan('7');
    setSubKelas('');
    setEditingId(null);
    fetchKelas();
  };


  return (
    <div className="card card-body">
      <div className="d-flex justify-between align-center mb-4">
        <h3>Master Data Kelas</h3>
        <button className="btn btn-primary" onClick={bukaModalBaru}>
          + Tambah Kelas
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
                  <td>
                    <strong>Kelas {kelas.angkatan}{kelas.sub_kelas || ''}</strong>
                  </td>
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
                  <label>Angkatan</label>
                  <select 
                    className="form-control"
                    value={angkatan} 
                    onChange={(e) => setAngkatan(e.target.value)} 
                    required
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sub-kelas (Opsional)</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={subKelas} 
                    onChange={(e) => setSubKelas(e.target.value)} 
                    placeholder="Contoh: A, B, C"
                  />
                </div>
                <div className="mb-3">
                  <small className="text-muted">
                    Preview Nama Kelas: <strong>{angkatan}{subKelas}</strong>
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger, #dc3545)' }}>Konfirmasi Hapus</h3>
              <button type="button" className="btn-close-modal" onClick={() => setConfirmDeleteId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus kelas ini? Peringatan: Menghapus kelas akan menghapus semua data guru dan siswa yang terhubung.</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteId(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeDeleteKelas}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
