'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { customAlert } from '@/lib/customAlert';

export default function SiswaMateri() {
  const [babs, setBabs] = useState<any[]>([]);
  const [materi, setMateri] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (SISWA_ID) fetchMateri();

    if (!SISWA_ID) return;

    const channel = supabase.channel('siswa-materi-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bab' }, () => fetchMateri())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konten' }, () => fetchMateri())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [SISWA_ID]);

  const fetchMateri = async () => {
    setLoading(true);
    // 1. Dapatkan kelas dari siswa
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).single();
    
    if (siswaKelas) {
      // 2. Dapatkan Bab
      const { data: dataBabs } = await supabase.from('bab').select('*').eq('kelas_id', siswaKelas.kelas_id).order('created_at');
      
      if (dataBabs) {
        setBabs(dataBabs);
        const babIds = dataBabs.map(b => b.id);
        
        // 3. Dapatkan Semua Konten
        const { data: dataKonten } = await supabase
          .from('konten')
          .select('*')
          .in('bab_id', babIds)
          .order('created_at');
          
        const materiMap: Record<string, any[]> = {};
        if (dataKonten) {
          dataKonten.forEach(k => {
            if (!materiMap[k.bab_id]) materiMap[k.bab_id] = [];
            materiMap[k.bab_id].push(k);
          });
        }
        setMateri(materiMap);
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center mt-4">Loading materi belajar...</div>;

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="card card-body">
      <h3 className="mb-3">Modul Bacaan & Materi Pembelajaran</h3>
      
      {babs.length === 0 ? (
        <p className="text-muted">Belum ada materi dari guru.</p>
      ) : (
        <div className="grid-2 mt-3">
          {babs.map(bab => (
            <div key={bab.id} className="card card-body">
              <span className="badge badge-primary mb-2">Bab: {bab.judul}</span>
              
              {(!materi[bab.id] || materi[bab.id].length === 0) ? (
                <p className="text-muted mt-2">Belum ada konten di bab ini.</p>
              ) : (
                <ul className="notif-list mt-3">
                  {materi[bab.id].map(m => (
                    <li key={m.id} className="notif-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="d-flex align-center gap-2">
                        <span style={{ fontSize: '1.2rem' }}>
                          {m.tipe === 'emateri' ? '📄' : (m.tipe === 'lkpd' ? '📝' : '📚')}
                        </span>
                        <div>
                          <strong style={{ display: 'block' }}>{m.judul}</strong>
                          <span className="time">Tipe: {m.tipe.toUpperCase()}</span>
                        </div>
                      </div>
                      
                      <div>
                        {m.tipe === 'emateri' ? (
                          <a 
                            href={m.file_url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-sm btn-primary"
                            onClick={(e) => { if (!m.file_url) { e.preventDefault(); customAlert('Link materi belum ditambahkan oleh guru.', true); } }}
                          >
                            Buka / Download
                          </a>
                        ) : (
                          <Link 
                            href="/siswa/tugas" 
                            className="btn btn-sm btn-outline"
                          >
                            Kerjakan di Tugas
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
