'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function SiswaProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State for form
  const [formData, setFormData] = useState({
    nama: '',
    nisn: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    nomor_hp: ''
  });

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (SISWA_ID) fetchProfile();
  }, [SISWA_ID]);

  const fetchProfile = async () => {
    if (!SISWA_ID) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('nama, nisn, tanggal_lahir, jenis_kelamin, nomor_hp')
      .eq('id', SISWA_ID)
      .single();
      
    if (data) {
      setFormData({
        nama: data.nama || '',
        nisn: data.nisn || '',
        tanggal_lahir: data.tanggal_lahir || '',
        jenis_kelamin: data.jenis_kelamin || '',
        nomor_hp: data.nomor_hp || ''
      });
    } else if (error) {
      console.error('Error fetching profile:', error);
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    const { error } = await supabase
      .from('users')
      .update({
        tanggal_lahir: formData.tanggal_lahir || null,
        jenis_kelamin: formData.jenis_kelamin || null,
        nomor_hp: formData.nomor_hp || null
      })
      .eq('id', SISWA_ID);
      
    if (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Gagal menyimpan profil: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center mt-4">Memuat profil...</div>;

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="card card-body" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="mb-4">Profil Saya</h2>
      
      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nama Lengkap (Tidak bisa diubah)</label>
          <input 
            type="text" 
            name="nama" 
            value={formData.nama} 
            onChange={handleChange} 
            className="form-control" 
            required 
            readOnly
            style={{ backgroundColor: 'var(--slate-100)', cursor: 'not-allowed', color: 'var(--slate-500)' }}
          />
        </div>
        
        <div className="form-group">
          <label>NISN (Tidak bisa diubah)</label>
          <input 
            type="text" 
            name="nisn" 
            value={formData.nisn} 
            onChange={handleChange} 
            className="form-control" 
            placeholder="Belum diatur"
            readOnly
            style={{ backgroundColor: 'var(--slate-100)', cursor: 'not-allowed', color: 'var(--slate-500)' }}
          />
        </div>

        <div className="form-group">
          <label>Tanggal Lahir</label>
          <input 
            type="date" 
            name="tanggal_lahir" 
            value={formData.tanggal_lahir} 
            onChange={handleChange} 
            className="form-control" 
          />
        </div>

        <div className="form-group">
          <label>Jenis Kelamin</label>
          <select 
            name="jenis_kelamin" 
            value={formData.jenis_kelamin} 
            onChange={handleChange}
            className="form-control"
          >
            <option value="">-- Pilih Jenis Kelamin --</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </div>

        <div className="form-group">
          <label>Nomor HP</label>
          <input 
            type="text" 
            name="nomor_hp" 
            value={formData.nomor_hp} 
            onChange={handleChange} 
            className="form-control" 
            placeholder="Contoh: 0812..."
          />
        </div>
        
        <div className="mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--slate-200)' }}>
          <button 
            type="submit" 
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
