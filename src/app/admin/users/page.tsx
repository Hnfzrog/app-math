'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [nama, setNama] = useState('');
  const [nisn, setNisn] = useState('');
  const [role, setRole] = useState('guru');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    
    // Fetch associations
    const { data: guruKelas } = await supabase.from('guru_kelas').select('guru_id, kelas_id');
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('siswa_id, kelas_id');
    
    // Fetch all classes for modal
    const { data: classesData } = await supabase.from('kelas').select('id, nama').order('nama');
    if (classesData) setAllClasses(classesData);

    if (!error && usersData) {
      const classMap: Record<string, string> = {};
      classesData?.forEach(c => { classMap[c.id] = c.nama; });

      const enrichedUsers = usersData.map(u => {
        let kelasText = '-';
        if (u.role === 'guru') {
          const classIds = guruKelas?.filter(g => g.guru_id === u.id).map(g => g.kelas_id) || [];
          const classNames = classIds.map(id => classMap[id]).filter(Boolean);
          if (classNames.length > 0) kelasText = `Kelas ${classNames.join(', ')}`;
        } else if (u.role === 'siswa') {
          const classIds = siswaKelas?.filter(s => s.siswa_id === u.id).map(s => s.kelas_id) || [];
          const classNames = classIds.map(id => classMap[id]).filter(Boolean);
          if (classNames.length > 0) kelasText = `Kelas ${classNames.join(', ')}`;
        }
        return { ...u, detail_kelas: kelasText };
      });
      setUsers(enrichedUsers);
    }
    setLoading(false);
  };

  const hapusUser = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: confirmDeleteId }),
      });
      const json = await res.json();
      
      if (!res.ok) {
        customAlert('Gagal menghapus user: ' + (json.error || 'Unknown error'), true);
      } else {
        fetchUsers();
      }
    } catch (err: any) {
      customAlert('Terjadi kesalahan: ' + err.message, true);
    }
    setConfirmDeleteId(null);
  };


  const handleEdit = async (user: any) => {
    setEditingId(user.id);
    setNama(user.nama);
    setNisn(user.nisn || '');
    setEmail(user.email || '');
    setRole(user.role);
    
    // Load existing classes for this user
    let userClasses: string[] = [];
    if (user.role === 'guru') {
      const { data } = await supabase.from('guru_kelas').select('kelas_id').eq('guru_id', user.id);
      if (data) userClasses = data.map(d => d.kelas_id);
    } else if (user.role === 'siswa') {
      const { data } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', user.id);
      if (data) userClasses = data.map(d => d.kelas_id);
    }
    setSelectedClasses(userClasses);
    setPassword('');
    setShowModal(true);
  };

  const handleSimpanUser = async (e: any) => {
    e.preventDefault();
    if (nama && email) {
      let targetUserId = editingId;
      
      if (editingId) {
        // Edit User — update profil
        const { error } = await supabase.from('users').update({
          nama,
          nisn: role === 'siswa' ? nisn : null,
          email,
          role
        }).eq('id', editingId);
        
        if (error) { customAlert('Gagal update user: ' + error.message, true); return; }

        // Ganti password jika diisi
        if (password) {
          const res = await fetch('/api/admin/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingId, password }),
          });
          const json = await res.json();
          if (!res.ok) { customAlert('Gagal ganti password: ' + json.error, true); return; }
        }
      } else {
        // Buat user via server-side API Route (pakai auth.admin untuk penuhi FK constraint)
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, email, password, role, nisn }),
        });
        const json = await res.json();
        if (!res.ok) {
          customAlert('Gagal tambah user: ' + json.error, true);
          return;
        }
        targetUserId = json.id;
      }
      
      // Update Kelas Assignment
      if (targetUserId && role !== 'admin') {
        const table = role === 'guru' ? 'guru_kelas' : 'siswa_kelas';
        const idCol = role === 'guru' ? 'guru_id' : 'siswa_id';
        
        // Hapus mapping lama
        await supabase.from(table).delete().eq(idCol, targetUserId);
        
        // Insert mapping baru
        if (selectedClasses.length > 0) {
          const insertData = selectedClasses.map(kelas_id => ({
            [idCol]: targetUserId,
            kelas_id
          }));
          await supabase.from(table).insert(insertData);
        }
      }
      
      setShowModal(false);
      setNama('');
      setNisn('');
      setEmail('');
      setRole('guru');
      setEditingId(null);
      setSelectedClasses([]);
      fetchUsers();
    }
  };

  const toggleClass = (kelasId: string) => {
    setSelectedClasses(prev => 
      prev.includes(kelasId) ? prev.filter(id => id !== kelasId) : [...prev, kelasId]
    );
  };

  const bukaModalBaru = () => {
    setEditingId(null);
    setNama('');
    setNisn('');
    setEmail('');
    setRole('guru');
    setPassword('');
    setSelectedClasses([]);
    setShowModal(true);
  };

  return (
    <div className="card card-body">
      <div className="table-controls">
        <h3>Manajemen User (Pengguna)</h3>
        <button className="btn btn-primary" onClick={bukaModalBaru}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
          Tambah User Baru
        </button>
      </div>

      <div className="table-responsive">
        {loading ? (
          <p className="text-center mt-3 mb-3">Loading data...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted mt-3 mb-3">Belum ada data user.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Kelas Terkait</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.nama}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === 'guru' ? 'badge-primary' : (user.role === 'admin' ? 'badge-danger' : 'badge-info')}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.detail_kelas}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(user)} className="btn btn-sm btn-outline">Edit</button>
                      <button onClick={() => hapusUser(user.id)} className="btn btn-sm btn-danger">Hapus</button>
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
              <h3>{editingId ? 'Edit User' : 'Tambah User Baru'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpanUser}>
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={nama} 
                    onChange={(e) => setNama(e.target.value)} 
                    placeholder="Contoh: Budi Santoso"
                    required
                  />
                </div>

                {role === 'siswa' && (
                  <div className="form-group">
                    <label>NISN</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={nisn} 
                      onChange={(e) => setNisn(e.target.value)}
                      placeholder="Masukkan NISN Siswa"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Email (Otomatis)</label>
                  <input 
                    type="email" 
                    className="form-control"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Password{editingId && <span style={{ fontWeight: 'normal', color: 'var(--text-muted, #888)', marginLeft: '6px', fontSize: '0.85em' }}>(kosongkan jika tidak diganti)</span>}
                  </label>
                  <input 
                    type="password" 
                    className="form-control"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingId ? 'Isi untuk ganti password' : 'Minimal 6 karakter'}
                    minLength={password.length > 0 ? 6 : undefined}
                    required={!editingId}
                  />
                </div>
                
                <div className="form-group">
                  <label>Role User</label>
                  <select 
                    className="form-control"
                    value={role} 
                    onChange={(e) => {
                      setRole(e.target.value);
                      setSelectedClasses([]);
                    }}
                    required
                  >
                    <option value="guru">Guru</option>
                    <option value="siswa">Siswa</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                {role !== 'admin' && (
                  <div className="form-group">
                    <label>Pilih Kelas ({role === 'guru' ? 'Mengajar di' : 'Siswa di'})</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}>
                      {allClasses.map(kelas => (
                        <label key={kelas.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedClasses.includes(kelas.id)}
                            onChange={() => toggleClass(kelas.id)}
                          />
                          {kelas.nama}
                        </label>
                      ))}
                      {allClasses.length === 0 && <span className="text-muted text-sm">Belum ada kelas. Buat di Master Kelas dulu.</span>}
                    </div>
                  </div>
                )}

                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan User</button>
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
              <p>Apakah kamu yakin ingin menghapus pengguna ini? Tindakan ini tidak bisa dibatalkan dan semua data terkait (termasuk nilai) akan ikut terhapus.</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteId(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeDelete}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
