'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nama: '', email: '' });

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
      .select('nama, email')
      .eq('id', ADMIN_ID)
      .single();

    if (data) {
      setFormData({ nama: data.nama || '', email: data.email || '' });
    }
    setLoading(false);
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

        <div className="form-group">
          <label>Nama Lengkap</label>
          <input
            type="text"
            value={formData.nama}
            className="form-control"
            readOnly
            style={{ backgroundColor: 'var(--slate-100)', cursor: 'not-allowed', color: 'var(--slate-500)' }}
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            className="form-control"
            readOnly
            style={{ backgroundColor: 'var(--slate-100)', cursor: 'not-allowed', color: 'var(--slate-500)' }}
          />
        </div>

        <div className="mt-3" style={{ padding: '12px', background: 'var(--slate-50)', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
          <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
            ℹ️ Data akun admin hanya bisa diubah melalui panel Supabase atau oleh superadmin sistem.
          </p>
        </div>
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

          <div className="form-group">
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
