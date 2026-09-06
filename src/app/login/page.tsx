'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

    // In a real implementation with Supabase Auth:
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    // For MVP simulation without backend fully hooked to UI yet:
    
    setTimeout(() => {
      // Dummy logic
      if (email.includes('admin')) {
        document.cookie = "user-role=admin; path=/";
        router.push('/admin/dashboard');
      } else if (email.includes('guru')) {
        document.cookie = "user-role=guru; path=/";
        router.push('/guru/dashboard');
      } else {
        document.cookie = "user-role=siswa; path=/";
        router.push('/siswa/dashboard');
      }
    }, 1000);
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
