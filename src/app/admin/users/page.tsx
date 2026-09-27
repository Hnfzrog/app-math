'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { generateKopPdf } from '@/lib/pdf';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs: 'siswa', 'guru', 'admin'
  const [activeTab, setActiveTab] = useState('siswa');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [nama, setNama] = useState('');
  const [nisn, setNisn] = useState('');
  const [role, setRole] = useState('siswa');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  
  // Filter states
  const [filterTahun, setFilterTahun] = useState('');
  const [filterKelas, setFilterKelas] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData, error } = await supabase.from('users').select('*').eq('role', activeTab).order('nama', { ascending: true });
    
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
          if (classNames.length > 0) kelasText = classNames.join(', ');
        } else if (u.role === 'siswa') {
          const classIds = siswaKelas?.filter(s => s.siswa_id === u.id).map(s => s.kelas_id) || [];
          const classNames = classIds.map(id => classMap[id]).filter(Boolean);
          if (classNames.length > 0) kelasText = classNames.join(', ');
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
    setTahunAjaran(user.tahun_ajaran || '2026/2027');
    
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
        const { error } = await supabase.from('users').update({
          nama,
          nisn: role === 'siswa' ? nisn : null,
          email,
          role,
          tahun_ajaran: role !== 'admin' ? tahunAjaran : null
        }).eq('id', editingId);
        
        if (error) { customAlert('Gagal update user: ' + error.message, true); return; }

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
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, email, password, role, nisn, tahun_ajaran: role !== 'admin' ? tahunAjaran : null }),
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
        
        await supabase.from(table).delete().eq(idCol, targetUserId);
        
        if (selectedClasses.length > 0) {
          const insertData = selectedClasses.map(kelas_id => ({
            [idCol]: targetUserId,
            kelas_id
          }));
          await supabase.from(table).insert(insertData);
        }
      }
      
      setShowModal(false);
      fetchUsers();
    }
  };

  const toggleClass = (kelasId: string) => {
    setSelectedClasses(prev => 
      prev.includes(kelasId) ? prev.filter(id => id !== kelasId) : [...prev, kelasId]
    );
  };

  const generateEmail = (namaVal: string, nisnVal: string, roleVal: string) => {
    const words = namaVal.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const prefix = words.slice(0, 2).join('').replace(/[^a-z0-9]/g, '');
    if (!prefix) return '';
    if (roleVal === 'siswa') {
      const nisnSuffix = nisnVal.trim().slice(-3);
      return nisnSuffix ? `${prefix}${nisnSuffix}@gmail.com` : '';
    }
    return `${prefix}@gmail.com`;
  };

  const handleNamaChange = (val: string) => {
    setNama(val);
    if (!editingId) setEmail(generateEmail(val, nisn, role));
  };

  const handleNisnChange = (val: string) => {
    setNisn(val);
    if (!editingId) setEmail(generateEmail(nama, val, role));
  };

  const bukaModalBaru = () => {
    setEditingId(null);
    setNama('');
    setNisn('');
    setEmail('');
    setRole(activeTab);
    setPassword('');
    setTahunAjaran('2026/2027');
    setSelectedClasses([]);
    setShowModal(true);
  };

  const printPdf = async () => {
    let columns: string[] = [];
    let rows: (string | number)[][] = [];
    let title = '';
    let filename = '';

    if (activeTab === 'siswa') {
      title = `Daftar Peserta Didik ${filterKelas ? 'Kelas ' + filterKelas + ' ' : ''}Tahun Ajaran ${filterTahun || 'Semua'}`;
      columns = ['No', 'Nama Siswa', 'Email', 'NISN', 'No. Telp', 'Nama Wali', 'Alamat'];
      rows = filteredUsers.map((u, i) => [i + 1, u.nama, u.email || '-', u.nisn || '-', u.nomor_hp || '-', u.nama_wali || '-', u.alamat || '-']);
      filename = 'daftar-peserta-didik.pdf';
    } else if (activeTab === 'guru') {
      title = `Daftar Guru Matematika Tahun Ajaran ${filterTahun || 'Semua'}`;
      columns = ['No', 'Nama Guru', 'Email', 'Kelas yang Diampu'];
      rows = filteredUsers.map((u, i) => [i + 1, u.nama, u.email || '-', u.detail_kelas || '-']);
      filename = 'daftar-guru.pdf';
    } else {
      title = 'Daftar Admin';
      columns = ['No', 'Nama Admin', 'Email'];
      rows = filteredUsers.map((u, i) => [i + 1, u.nama, u.email || '-']);
      filename = 'daftar-admin.pdf';
    }

    await generateKopPdf({ title, columns, rows, filename });
  };

  const filteredUsers = users.filter(u => {
    if (filterTahun && u.tahun_ajaran !== filterTahun) return false;
    if (filterKelas && !u.detail_kelas.includes(filterKelas)) return false;
    return true;
  });

  return (
    <div>
      <div className="card card-body mb-4">
        <h3 className="mb-3">Daftar Populasi (Kelola User)</h3>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
          {['siswa', 'guru', 'admin'].map(t => (
            <button
              key={t}
              className={`btn ${activeTab === t ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setActiveTab(t);
                setFilterTahun('');
                setFilterKelas('');
              }}
              style={{ textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Toolbar (Filters & Actions) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeTab !== 'admin' && (
              <select className="form-control" style={{ width: 'auto' }} value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
                <option value="">Semua Tahun Ajaran</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
            )}
            {activeTab === 'siswa' && (
              <select className="form-control" style={{ width: 'auto' }} value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
                <option value="">Semua Kelas</option>
                {allClasses.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={printPdf}>
              📄 Download / Print PDF
            </button>
            <button className="btn btn-primary" onClick={bukaModalBaru}>
              + Tambah {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="card card-body print-section">
        <div className="table-responsive">
          {loading ? (
            <p className="text-center my-4">Loading data...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted my-4">Belum ada data.</p>
          ) : (
            <table className="table">
              <thead>
                {activeTab === 'siswa' && (
                  <tr>
                    <th>No</th>
                    <th>Nama Siswa</th>
                    <th>Email</th>
                    <th>NISN</th>
                    <th>Kelas</th>
                    <th>No. Telp</th>
                    <th>Nama Wali</th>
                    <th>Alamat</th>
                    <th>Aksi</th>
                  </tr>
                )}
                {activeTab === 'guru' && (
                  <tr>
                    <th>No</th>
                    <th>Nama Guru</th>
                    <th>Email</th>
                    <th>Kelas yg Diampu</th>
                    <th>No. Telp</th>
                    <th>Aksi</th>
                  </tr>
                )}
                {activeTab === 'admin' && (
                  <tr>
                    <th>No</th>
                    <th>Nama Admin</th>
                    <th>Email</th>
                    <th>Aksi</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr key={user.id}>
                    <td>{idx + 1}</td>
                    <td><strong>{user.nama}</strong></td>
                    
                    {activeTab === 'siswa' && (
                      <>
                        <td>{user.email || '-'}</td>
                        <td>{user.nisn || '-'}</td>
                        <td>{user.detail_kelas}</td>
                        <td>{user.nomor_hp || '-'}</td>
                        <td>{user.nama_wali || '-'}</td>
                        <td>{user.alamat || '-'}</td>
                      </>
                    )}

                    {activeTab === 'guru' && (
                      <>
                        <td>{user.email || '-'}</td>
                        <td>{user.detail_kelas}</td>
                        <td>{user.nomor_hp || '-'}</td>
                      </>
                    )}

                    {activeTab === 'admin' && (
                      <>
                        <td>{user.email}</td>
                      </>
                    )}

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
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>{editingId ? `Edit ${role}` : `Tambah ${role} Baru`}</h3>
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
                    onChange={(e) => handleNamaChange(e.target.value)} 
                    placeholder="Contoh: Budi Santoso"
                    required
                  />
                </div>

                {role === 'siswa' && (
                  <div className="form-group mt-3">
                    <label>NISN</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={nisn} 
                      onChange={(e) => handleNisnChange(e.target.value)}
                      placeholder="Masukkan NISN Siswa"
                    />
                  </div>
                )}

                {role !== 'admin' && (
                  <div className="form-group mt-3">
                    <label>Tahun Ajaran</label>
                    <select className="form-control" value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                      <option value="2025/2026">2025/2026</option>
                      <option value="2026/2027">2026/2027</option>
                    </select>
                  </div>
                )}

                <div className="form-group mt-3">
                  <label>
                    Email
                    {!editingId && role === 'siswa' && (
                      <span className="text-muted text-sm ml-2">(otomatis)</span>
                    )}
                  </label>
                  <input 
                    type="email" 
                    className="form-control"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh: budi@gmail.com"
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label>
                    Password{editingId && <span className="text-muted text-sm ml-2">(kosongkan jika tidak diganti)</span>}
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
                
                {role !== 'admin' && (
                  <div className="form-group mt-3">
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
              <h3 className="text-danger">Konfirmasi Hapus</h3>
              <button type="button" className="btn-close-modal" onClick={() => setConfirmDeleteId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus pengguna ini? Tindakan ini tidak bisa dibatalkan.</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteId(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeDelete}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* CSS untuk menyembunyikan elemen saat Print (PDF Export Mock) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-section::before {
            content: "DAFTAR ${activeTab.toUpperCase()} TAHUN AJARAN ${filterTahun || 'SEMUA'}";
            display: block;
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
          }
          .btn, .table-controls { display: none !important; }
          td:last-child, th:last-child { display: none !important; }
        }
      `}} />
    </div>
  );
}
