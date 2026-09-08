'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (authError || !authData.session) {
      setErrorMsg('Email atau password salah!');
      setLoading(false);
      return;
    }

    // Ambil role dari tabel public.users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.session.user.id)
      .single();

    if (userError || !userData) {
      setErrorMsg('Gagal mengambil data profil.');
      setLoading(false);
      return;
    }

    document.cookie = `user-role=${userData.role}; path=/`;
    
    if (userData.role === 'admin') {
      router.push('/admin/dashboard');
    } else if (userData.role === 'guru') {
      router.push('/guru/dashboard');
    } else {
      router.push('/siswa/dashboard');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Welcome Back! ✨</h1>
          <p>Login untuk masuk ke kelas matematika kamu</p>
        </div>
        
        {errorMsg && <div className={styles.error}>{errorMsg}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Email</label>
            <input 
              type="email" 
              placeholder="Contoh: andi@siswa.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Masuk...' : 'Login'}
          </button>
        </form>
        
        <div className={styles.footer}>
          <p>Lupa password? Hubungi Admin sekolah ya!</p>
        </div>
      </div>
    </div>
  );
}
