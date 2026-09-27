'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import PhotoUpload from '@/components/PhotoUpload';
import { updateProfile } from '@/lib/uploadClient';

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nama: '', email: '', nomor_hp: '', alamat: '', foto_profil_url: '' });
  const [pendingFoto, setPendingFoto] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  // State untuk ganti password
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);

  const { userId: ADMIN_ID, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (ADMIN_ID) fetchProfile();
  }, [ADMIN_ID]);

  const fetchProfile = async () => {
    if (!ADMIN_ID) return;
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('nama, email, nomor_hp, alamat, foto_profil_url')
      .eq('id', ADMIN_ID)
      .single();

    if (data) {
      setFormData({
        nama: data.nama || '',
        email: data.email || '',
        nomor_hp: data.nomor_hp || '',
        alamat: data.alamat || '',
        foto_profil_url: data.foto_profil_url || ''
      });
    }
    setLoading(false);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_ID) return;
    
    setSavingProfile(true);
    setProfileMessage({ type: '', text: '' });

    try {
      await updateProfile(
        { nama: formData.nama, nomor_hp: formData.nomor_hp, alamat: formData.alamat },
        pendingFoto
      );
      setProfileMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
      setPendingFoto(null);
      fetchProfile();
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: 'Gagal menyimpan profil: ' + (err?.message || err) });
    }
    setSavingProfile(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
    if (error) {
      setPasswordMessage({ type: 'error', text: 'Gagal mengganti password: ' + error.message });
    } else {
      setPasswordMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    }
    setSavingPassword(false);
  };

  if (loading || userLoading) return <div className="text-center mt-4">Memuat profil...</div>;

  return (
    <div>
      {/* Info Akun */}
      <div className="card card-body" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 className="mb-4">Profil Admin</h2>
        
        {profileMessage.text && (
          <div className={`alert ${profileMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleProfileUpdate}>
          <div className="form-group">
            <label>Email (Tidak bisa diubah)</label>
            <input
              type="email"
              value={formData.email}
              className="form-control"
              readOnly
              style={{ backgroundColor: 'var(--slate-100)', cursor: 'not-allowed', color: 'var(--slate-500)' }}
            />
          </div>
          
          <div className="form-group mt-3">
            <label>Nama Lengkap</label>
            <input
              type="text"
              value={formData.nama}
              onChange={(e) => setFormData({...formData, nama: e.target.value})}
              className="form-control"
              required
            />
          </div>

          <div className="form-group mt-3">
            <label>No. Telepon</label>
            <input
              type="text"
              value={formData.nomor_hp}
              onChange={(e) => setFormData({...formData, nomor_hp: e.target.value})}
              className="form-control"
              placeholder="Contoh: 08123456789"
            />
          </div>

          <div className="form-group mt-3">
            <label>Alamat</label>
            <textarea
              value={formData.alamat}
              onChange={(e) => setFormData({...formData, alamat: e.target.value})}
              className="form-control"
              rows={3}
              placeholder="Alamat lengkap"
            ></textarea>
          </div>
          
          <div className="form-group mt-3">
            <label>Foto Profil</label>
            <PhotoUpload value={formData.foto_profil_url} onFileChange={setPendingFoto} label="Foto Profil" />
          </div>

          <div className="mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--slate-200)' }}>
            <button
              type="submit"
              disabled={savingProfile}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>

      {/* Ganti Password */}
      <div className="card card-body" style={{ maxWidth: '600px', margin: '1.5rem auto 0' }}>
        <h3 className="mb-4" style={{ fontSize: '16px', fontWeight: 700 }}>🔒 Ganti Password</h3>

        {passwordMessage.text && (
          <div className={`alert ${passwordMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label>Password Baru</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="form-control"
                placeholder="Minimal 6 karakter"
                required
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--slate-500)'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-group mt-3">
            <label>Konfirmasi Password Baru</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={e => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="form-control"
              placeholder="Ulangi password baru"
              required
            />
          </div>

          <div className="mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid var(--slate-200)' }}>
            <button
              type="submit"
              disabled={savingPassword}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              {savingPassword ? 'Menyimpan...' : 'Perbarui Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
