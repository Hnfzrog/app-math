'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalKelas, setTotalKelas] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: guruCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'guru');
    const { count: siswaCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'siswa');
    const { count: kelasCount } = await supabase.from('kelas').select('*', { count: 'exact', head: true });
    
    setTotalGuru(guruCount || 0);
    setTotalSiswa(siswaCount || 0);
    setTotalKelas(kelasCount || 0);
  };

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon bg-blue">👨‍🏫</div>
          <div className="stat-info">
            <span className="label">Total Guru</span>
            <span className="value">{totalGuru}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-green">👨‍🎓</div>
          <div className="stat-info">
            <span className="label">Total Siswa</span>
            <span className="value">{totalSiswa}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-amber">🏫</div>
          <div className="stat-info">
            <span className="label">Total Kelas</span>
            <span className="value">{totalKelas}</span>
          </div>
        </div>
      </div>
      
      <div className="card card-body">
        <h3 className="mb-3">Informasi Sistem</h3>
        <p className="text-muted">EduSchool LMS berjalan stabil. Semua modul backend Supabase telah terhubung.</p>
      </div>
    </div>
  );
}
