'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SiswaKelas() {
  const [loading, setLoading] = useState(true);
  const [kelasInfo, setKelasInfo] = useState<any>(null);
  const [guruKelas, setGuruKelas] = useState<any>(null);
  const [babs, setBabs] = useState<any[]>([]);
  const [teman, setTeman] = useState<any[]>([]);

  // Hardcoded ID Siswa Andi untuk MVP
  const SISWA_ID = 'e0000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchKelas();
  }, []);

  const fetchKelas = async () => {
    setLoading(true);

    // 1. Dapatkan kelas siswa
    const { data: siswaKelas } = await supabase
      .from('siswa_kelas')
      .select('kelas_id')
      .eq('siswa_id', SISWA_ID)
      .single();

    if (!siswaKelas) {
      setLoading(false);
      return;
    }

    const kelasId = siswaKelas.kelas_id;

    // 2. Info kelas
    const { data: kelas } = await supabase
      .from('kelas')
      .select('*')
      .eq('id', kelasId)
      .single();
    setKelasInfo(kelas);

    // 3. Wali kelas (guru yang mengajar di kelas ini)
    const { data: guruKelasData } = await supabase
      .from('guru_kelas')
      .select('guru_id')
      .eq('kelas_id', kelasId)
      .limit(1)
      .single();

    if (guruKelasData) {
      const { data: guru } = await supabase
        .from('users')
        .select('nama, email, nomor_hp')
        .eq('id', guruKelasData.guru_id)
        .single();
      setGuruKelas(guru);
    }

    // 4. Daftar bab di kelas ini
    const { data: babData } = await supabase
      .from('bab')
      .select('*, konten(count)')
      .eq('kelas_id', kelasId)
      .order('nomor');
    setBabs(babData || []);

    // 5. Teman sekelas
    const { data: temanData } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users:siswa_id(nama, nisn)')
      .eq('kelas_id', kelasId)
      .neq('siswa_id', SISWA_ID);
    setTeman(temanData || []);

    setLoading(false);
  };

  if (loading) return <div className="text-center mt-4">Memuat informasi kelas...</div>;

  if (!kelasInfo) return (
    <div className="card card-body">
      <p className="text-muted text-center">Kamu belum terdaftar di kelas manapun.</p>
    </div>
  );

  return (
    <div>
      {/* Info Kelas Card */}
      <div className="card card-body mb-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px'
          }}>🏫</div>
          <div>
            <h2 style={{ margin: 0 }}>Informasi Kelas {kelasInfo.nama}</h2>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>Tahun Ajaran 2025/2026</p>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--slate-200)', margin: '0 0 16px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Tingkat Kelas</span>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>Kelas {kelasInfo.nama} SMP</p>
          </div>
          <div>
            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Wali Kelas / Guru Pengajar</span>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas?.nama || '-'}</p>
          </div>
          {guruKelas?.nomor_hp && (
            <div>
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Kontak Guru</span>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas.nomor_hp}</p>
            </div>
          )}
          {guruKelas?.email && (
            <div>
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Email Guru</span>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas.email}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        {/* Daftar Bab / Kurikulum */}
        <div className="card">
          <div className="card-header"><h3>Kurikulum &amp; Bab Pembelajaran</h3></div>
          <div className="card-body">
            {babs.length === 0 ? (
              <p className="text-muted">Belum ada bab yang dibuat guru.</p>
            ) : (
              <ul className="notif-list">
                {babs.map(bab => (
                  <li key={bab.id} className="notif-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Bab {bab.nomor}: {bab.judul}</strong>
                    </div>
                    <Link href="/siswa/materi" className="btn btn-sm btn-outline">Buka Materi</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Teman Sekelas */}
        <div className="card">
          <div className="card-header"><h3>Teman Sekelas</h3></div>
          <div className="card-body">
            {teman.length === 0 ? (
              <p className="text-muted">Belum ada siswa lain di kelas ini.</p>
            ) : (
              <ul className="notif-list">
                {teman.map((t: any) => (
                  <li key={t.siswa_id} className="notif-item" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'var(--slate-200)', color: 'var(--slate-700)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, flexShrink: 0
                    }}>
                      {(t.users?.nama || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{t.users?.nama || '-'}</strong>
                      <div className="text-muted" style={{ fontSize: '11px' }}>NISN: {t.users?.nisn || '-'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
