'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminDashboard() {
  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalKelas, setTotalKelas] = useState(0);

  const [laporanStats, setLaporanStats] = useState({ selesai: 0, menunggu: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: guruCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'guru');
    const { count: siswaCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'siswa');
    const { count: kelasCount } = await supabase.from('kelas').select('*', { count: 'exact', head: true });
    const { count: selesaiCount } = await supabase.from('laporan').select('*', { count: 'exact', head: true }).eq('status', 'selesai');
    const { count: menungguCount } = await supabase.from('laporan').select('*', { count: 'exact', head: true }).eq('status', 'menunggu');

    setTotalGuru(guruCount || 0);
    setTotalSiswa(siswaCount || 0);
    setTotalKelas(kelasCount || 0);
    setLaporanStats({ selesai: selesaiCount || 0, menunggu: menungguCount || 0 });
  };

  const maxLaporan = laporanStats.selesai + laporanStats.menunggu;
  const selesaiHeight = maxLaporan > 0 ? (laporanStats.selesai / maxLaporan) * 100 : 0;
  const menungguHeight = maxLaporan > 0 ? (laporanStats.menunggu / maxLaporan) * 100 : 0;

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
      
      <div className="grid-2" style={{ marginTop: '20px' }}>
        {/* Shortcut Section */}
        <div className="card card-body">
          <h3 className="mb-3">Shortcut Laporan</h3>
          <p className="text-muted" style={{ marginBottom: '20px' }}>Akses cepat ke laporan kendala pengguna</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <Link href="/admin/laporan?role=siswa" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa' }}>
              <span style={{ fontSize: '24px' }}>👨‍🎓</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Laporan Siswa</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Lihat kendala dari siswa</div>
              </div>
            </Link>
            <Link href="/admin/laporan?role=guru" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa' }}>
              <span style={{ fontSize: '24px' }}>👨‍🏫</span>
              <div>
                <div style={{ fontWeight: 'bold' }}>Laporan Guru</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Lihat kendala dari guru</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Chart Section */}
        <div className="card card-body">
          <h3 className="mb-3">Statistik Laporan Pekerjaan</h3>
          <p className="text-muted" style={{ marginBottom: '30px' }}>Berdasarkan jumlah laporan yang telah diselesaikan vs menunggu</p>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '50px', height: '200px', paddingBottom: '30px', borderBottom: '1px solid #eee' }}>
            {/* Bar Selesai */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{laporanStats.selesai}</div>
              <div style={{ width: '60px', height: `${selesaiHeight}%`, minHeight: '10px', background: '#10b981', borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }}></div>
              <div style={{ fontWeight: '500' }}>Selesai</div>
            </div>
            
            {/* Bar Menunggu */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{laporanStats.menunggu}</div>
              <div style={{ width: '60px', height: `${menungguHeight}%`, minHeight: '10px', background: '#f59e0b', borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }}></div>
              <div style={{ fontWeight: '500' }}>Menunggu</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
