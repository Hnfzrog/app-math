'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

type Item = { id: string; judul: string; deskripsi: string; tayang_sampai: string };

/**
 * Menampilkan pengumuman yang ditujukan ke pengguna ini di dashboard.
 * Visibilitas: target 'semua' / role sama / kelas saya / user saya, dan belum lewat tayang_sampai.
 */
export default function PengumumanFeed({ role }: { role: 'guru' | 'siswa' }) {
  const { userId, loading } = useCurrentUser();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      let myKelas: string | null = null;
      if (role === 'siswa') {
        const { data: sk } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', userId).single();
        myKelas = sk?.kelas_id ?? null;
      }

      const { data: targets } = await supabase.from('pengumuman_target').select('pengumuman_id, role, kelas_id, user_id');
      const ids = new Set<string>();
      (targets || []).forEach((t) => {
        const cocok =
          t.role === 'semua' ||
          t.role === role ||
          (t.kelas_id && t.kelas_id === myKelas) ||
          t.user_id === userId;
        if (cocok) ids.add(t.pengumuman_id);
      });
      if (ids.size === 0) { setItems([]); return; }

      const { data } = await supabase
        .from('pengumuman')
        .select('id, judul, deskripsi, tayang_sampai')
        .in('id', Array.from(ids))
        .gt('tayang_sampai', new Date().toISOString())
        .order('created_at', { ascending: false });
      setItems(data || []);
    };
    load();
  }, [userId, role]);

  if (loading || items.length === 0) return null;

  return (
    <div className="card card-body mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
      <h3 className="mb-3">📢 Pengumuman</h3>
      <div className="d-flex flex-column gap-3">
        {items.map((p) => (
          <div key={p.id} className="p-3 border rounded" style={{ background: 'var(--slate-50)' }}>
            <strong className="d-block mb-1">{p.judul}</strong>
            <p className="mb-1" style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{p.deskripsi}</p>
            <small className="text-muted">Berlaku sampai {new Date(p.tayang_sampai).toLocaleString('id-ID')}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
