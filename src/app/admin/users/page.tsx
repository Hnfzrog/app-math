'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [nama, setNama] = useState('');
  const [role, setRole] = useState('guru');
  const [email, setEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
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
    if (confirm('Yakin ingin menghapus user ini?')) {
      await supabase.from('users').delete().eq('id', id);
      fetchUsers();
    }
  };

  const handleEdit = async (user: any) => {
    setEditingId(user.id);
    setNama(user.nama);
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
    setShowModal(true);
  };

  const handleSimpanUser = async (e: any) => {
    e.preventDefault();
    if (nama && email) {
      let targetUserId = editingId;
      
      if (editingId) {
        // Edit User
        const { error } = await supabase.from('users').update({
          nama,
          email,
          role
        }).eq('id', editingId);
        
        if (error) alert('Gagal update user: ' + error.message);
      } else {
        // Dummy Insert
        const fakeUuid = 'f' + Date.now() + '-1111-1111-1111-111111111111';
        targetUserId = fakeUuid;
        const { error } = await supabase.from('users').insert({
          id: fakeUuid,
          nama,
          email,
          role
        });
        if (error) alert('Gagal tambah user: ' + error.message);
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
    setEmail('');
    setRole('guru');
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
                    onChange={(e) => {
                      setNama(e.target.value);
                      setEmail(`${e.target.value.toLowerCase().replace(/\s+/g, '')}@eduschool.test`);
                    }} 
                    placeholder="Contoh: Budi Santoso"
                    required
                  />
                </div>

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
    </div>
  );
}
