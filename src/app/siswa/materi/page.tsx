'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { fileUrl } from '@/lib/uploadClient';
import { judulBab } from '@/lib/judulBab';

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function driveId(url: string): string | null {
  const m = url.match(/\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

// Render satu link materi dengan preview yang sesuai jenisnya
function MateriItem({ url, index }: { url: string; index: number }) {
  const yt = youtubeId(url);
  if (yt) {
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
          <iframe
            src={`https://www.youtube.com/embed/${yt}`}
            title={`Materi ${index + 1}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  const drv = driveId(url);
  if (drv) {
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ position: 'relative', paddingBottom: '75%', height: 0, borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
          <iframe
            src={`https://drive.google.com/file/d/${drv}/preview`}
            title={`Materi ${index + 1}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (url.startsWith('http') && isImage(url)) {
    return <img src={url} alt={`Materi ${index + 1}`} style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '10px', display: 'block' }} />;
  }

  // Storage key (file yang diupload) atau link biasa
  const href = url.startsWith('http') ? url : fileUrl(url)!;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ marginTop: '10px' }}>
      {url.startsWith('http') ? `🔗 Buka Link ${index + 1}` : '📎 Unduh File Materi'}
    </a>
  );
}

export default function SiswaMateri() {
  const [babs, setBabs] = useState<any[]>([]);
  const [materi, setMateri] = useState<Record<string, any[]>>({});
  const [doneKonten, setDoneKonten] = useState<Set<string>>(new Set());
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
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID).single();

    if (siswaKelas) {
      const { data: dataBabs } = await supabase.from('bab').select('*').eq('kelas_id', siswaKelas.kelas_id).order('nomor');
      if (dataBabs) {
        setBabs(dataBabs);
        const babIds = dataBabs.map(b => b.id);
        const { data: dataKonten } = await supabase.from('konten').select('*').in('bab_id', babIds).order('created_at');
        const materiMap: Record<string, any[]> = {};
        if (dataKonten) {
          dataKonten.forEach(k => {
            if (!materiMap[k.bab_id]) materiMap[k.bab_id] = [];
            materiMap[k.bab_id].push(k);
          });
        }
        setMateri(materiMap);

        // Tandai konten tugas/LKPD yang SUDAH dikerjakan (ada jawaban_siswa minimal 1 soal).
        const kontenIds = (dataKonten || []).map((k) => k.id);
        if (kontenIds.length > 0) {
          const { data: soals } = await supabase.from('soal').select('id, konten_id').in('konten_id', kontenIds);
          const soalIds = (soals || []).map((s) => s.id);
          if (soalIds.length > 0) {
            const { data: jw } = await supabase.from('jawaban_siswa').select('soal_id').eq('siswa_id', SISWA_ID).in('soal_id', soalIds);
            const answered = new Set((jw || []).map((j) => j.soal_id));
            const done = new Set<string>();
            (soals || []).forEach((s) => { if (answered.has(s.id)) done.add(s.konten_id); });
            setDoneKonten(done);
          }
        }
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
        <div className="d-flex flex-column gap-4 mt-3">
          {babs.map(bab => (
            <div key={bab.id} className="card card-body">
              <span className="badge badge-primary mb-3" style={{ alignSelf: 'flex-start' }}>{judulBab(bab.nomor, bab.judul)}</span>

              {(!materi[bab.id] || materi[bab.id].length === 0) ? (
                <p className="text-muted">Belum ada konten di bab ini.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {materi[bab.id].map(m => {
                    const links = (m.file_url || '').split('\n').filter((l: string) => l.trim());
                    return (
                      <div key={m.id} className="p-3 border rounded" style={{ background: 'var(--slate-50)' }}>
                        <div className="d-flex justify-between align-center mb-1">
                          <strong>{m.tipe === 'emateri' ? '📄' : (m.tipe === 'lkpd' ? '📝' : '📚')} {m.judul}</strong>
                          {m.tipe !== 'emateri' && (
                            doneKonten.has(m.id)
                              ? <span className="badge badge-success">✓ Sudah dikerjakan</span>
                              : <Link href="/siswa/tugas" className="btn btn-sm btn-outline">Kerjakan di Tugas</Link>
                          )}
                        </div>

                        {m.tipe === 'emateri' ? (
                          links.length === 0 ? (
                            <p className="text-muted small m-0">Belum ada materi.</p>
                          ) : (
                            links.map((url: string, i: number) => <MateriItem key={i} url={url} index={i} />)
                          )
                        ) : (
                          <p className="text-muted small m-0">Kerjakan soal melalui menu Tugas.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
