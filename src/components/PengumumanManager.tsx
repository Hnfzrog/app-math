'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

type Kelas = { id: string; nama: string };
type UserRow = { id: string; nama: string; role: string };

/**
 * Pengelola pengumuman untuk admin & guru (revisi 6 Okt 2026).
 * - admin: audiens guru / siswa / beberapa pengguna / semua.
 * - guru : semua kelas / beberapa kelas / beberapa siswa.
 * Notifikasi ke penerima dibuat otomatis oleh trigger `trg_notif_pengumuman`.
 */
export default function PengumumanManager({ mode }: { mode: 'admin' | 'guru' }) {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<{ id: string; judul: string; deskripsi: string; tayang_sampai: string; created_at: string }[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [kandidatUser, setKandidatUser] = useState<UserRow[]>([]);

  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tayangSampai, setTayangSampai] = useState('');
  const [audiens, setAudiens] = useState(mode === 'admin' ? 'semua' : 'semua_kelas');
  const [pilihanKelas, setPilihanKelas] = useState<string[]>([]);
  const [pilihanUser, setPilihanUser] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) init();
  }, [userId]);

  const init = async () => {
    setLoading(true);
    const { data: listData } = await supabase
      .from('pengumuman')
      .select('id, judul, deskripsi, tayang_sampai, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    setList(listData || []);

    if (mode === 'guru') {
      const { data: gk } = await supabase.from('guru_kelas').select('kelas(id, nama)').eq('guru_id', userId);
      const kelas = (gk || [])
        .map((g) => g.kelas as unknown as Kelas | null)
        .filter(Boolean) as Kelas[];
      setKelasList(kelas);
      const kelasIds = kelas.map((k) => k.id);
      if (kelasIds.length > 0) {
        const { data: sk } = await supabase.from('siswa_kelas').select('siswa_id, users(nama)').in('kelas_id', kelasIds);
        const seen = new Set<string>();
        const siswa: UserRow[] = [];
        (sk || []).forEach((s) => {
          if (seen.has(s.siswa_id)) return;
          seen.add(s.siswa_id);
          const u = s.users as unknown as { nama?: string } | null;
          siswa.push({ id: s.siswa_id, nama: u?.nama || '(tanpa nama)', role: 'siswa' });
        });
        setKandidatUser(siswa.sort((a, b) => a.nama.localeCompare(b.nama)));
      }
    } else {
      const { data: users } = await supabase.from('users').select('id, nama, role').in('role', ['guru', 'siswa']).order('nama');
      setKandidatUser(users || []);
    }
    setLoading(false);
  };

  const toggle = (arr: string[], setArr: (v: string[]) => void, id: string) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  // Baris target (audiens) untuk disimpan ke pengumuman_target.
  const resolveTargetRows = (): { role: string | null; kelas_id: string | null; user_id: string | null }[] => {
    if (mode === 'admin') {
      if (audiens === 'beberapa') return pilihanUser.map((id) => ({ role: null, kelas_id: null, user_id: id }));
      return [{ role: audiens, kelas_id: null, user_id: null }]; // 'semua' | 'guru' | 'siswa'
    }
    if (audiens === 'beberapa_siswa') return pilihanUser.map((id) => ({ role: null, kelas_id: null, user_id: id }));
    const kelasIds = audiens === 'semua_kelas' ? kelasList.map((k) => k.id) : pilihanKelas;
    return kelasIds.map((kid) => ({ role: null, kelas_id: kid, user_id: null }));
  };

  const simpan = async () => {
    if (!judul.trim() || !deskripsi.trim() || !tayangSampai) {
      customAlert('Judul, deskripsi, dan batas waktu wajib diisi.', true);
      return;
    }
    const rows = resolveTargetRows();
    if (rows.length === 0) { customAlert('Pilih minimal satu penerima.', true); return; }

    setSaving(true);
    try {
      const { data: p, error: e1 } = await supabase.from('pengumuman').insert({
        author_id: userId,
        author_role: mode,
        judul: judul.trim(),
        deskripsi: deskripsi.trim(),
        tayang_sampai: new Date(tayangSampai).toISOString(),
      }).select().single();
      if (e1 || !p) throw e1 || new Error('Gagal menyimpan pengumuman.');

      const { error: e2 } = await supabase.from('pengumuman_target').insert(rows.map((r) => ({ ...r, pengumuman_id: p.id })));
      if (e2) throw e2;

      customAlert('Pengumuman terkirim.', false);
      setJudul(''); setDeskripsi(''); setTayangSampai(''); setPilihanKelas([]); setPilihanUser([]);
      init();
    } catch (e) {
      customAlert('Gagal: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (id: string) => {
    const { error } = await supabase.from('pengumuman').delete().eq('id', id);
    if (error) { customAlert('Gagal menghapus: ' + error.message, true); return; }
    init();
  };

  const opsiAudiens = mode === 'admin'
    ? [{ v: 'semua', l: 'Semua pengguna' }, { v: 'guru', l: 'Semua guru' }, { v: 'siswa', l: 'Semua siswa' }, { v: 'beberapa', l: 'Beberapa pengguna' }]
    : [{ v: 'semua_kelas', l: 'Semua kelas saya' }, { v: 'beberapa_kelas', l: 'Beberapa kelas' }, { v: 'beberapa_siswa', l: 'Beberapa siswa' }];

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Pengumuman</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Buat pengumuman untuk {mode === 'admin' ? 'guru/siswa' : 'kelas atau siswa yang Anda ampu'}. Muncul di dashboard penerima
          dan dikirim sebagai notifikasi; hilang otomatis setelah batas waktu.
        </p>
      </div>

      <div className="card card-body mb-4">
        <h3 className="mb-3">Buat Pengumuman</h3>
        <div className="form-group">
          <label htmlFor="pengumuman-judul">Judul</label>
          <input id="pengumuman-judul" type="text" className="form-control" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Pemeliharaan Website" />
        </div>
        <div className="form-group">
          <label htmlFor="pengumuman-deskripsi">Deskripsi</label>
          <textarea id="pengumuman-deskripsi" className="form-control" rows={4} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Contoh: Pada 10 Oktober 2026 pukul 11.00–16.00 akan dilakukan pemeliharaan website..." />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label htmlFor="pengumuman-audiens">Audiens</label>
            <select id="pengumuman-audiens" className="form-control" value={audiens} onChange={(e) => { setAudiens(e.target.value); setPilihanKelas([]); setPilihanUser([]); }}>
              {opsiAudiens.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="pengumuman-tayang">Batas Waktu Tayang</label>
            <input id="pengumuman-tayang" type="datetime-local" className="form-control" value={tayangSampai} onChange={(e) => setTayangSampai(e.target.value)} />
          </div>
        </div>

        {mode === 'guru' && audiens === 'beberapa_kelas' && (
          <div className="form-group">
            <label>Pilih Kelas</label>
            <div className="d-flex flex-column gap-1">
              {kelasList.map((k) => (
                <label key={k.id} className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={pilihanKelas.includes(k.id)} onChange={() => toggle(pilihanKelas, setPilihanKelas, k.id)} />
                  <span>{k.nama}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {((mode === 'admin' && audiens === 'beberapa') || (mode === 'guru' && audiens === 'beberapa_siswa')) && (
          <div className="form-group">
            <label>Pilih Pengguna</label>
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: '8px', padding: '8px' }}>
              {kandidatUser.length === 0 ? (
                <span className="text-muted">Tidak ada pengguna.</span>
              ) : (
                kandidatUser.map((u) => (
                  <label key={u.id} className="d-flex align-center gap-2" style={{ padding: '4px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={pilihanUser.includes(u.id)} onChange={() => toggle(pilihanUser, setPilihanUser, u.id)} />
                    <span>{u.nama}</span>
                    {mode === 'admin' && <span className="badge badge-info">{u.role}</span>}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="text-right mt-2">
          <button type="button" className="btn btn-primary" onClick={simpan} disabled={saving}>
            {saving ? 'Mengirim...' : 'Kirim Pengumuman'}
          </button>
        </div>
      </div>

      <div className="card card-body">
        <h3 className="mb-3">Pengumuman Saya</h3>
        {loading ? (
          <p className="text-center my-4">Memuat...</p>
        ) : list.length === 0 ? (
          <p className="text-muted text-center my-4">Belum ada pengumuman.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>Judul</th><th>Deskripsi</th><th>Tayang Sampai</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const kadaluarsa = new Date(p.tayang_sampai) < new Date();
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.judul}</strong></td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{p.deskripsi}</td>
                      <td>
                        {new Date(p.tayang_sampai).toLocaleString('id-ID')}
                        {kadaluarsa && <div><span className="badge badge-secondary">kadaluarsa</span></div>}
                      </td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => hapus(p.id)}>Hapus</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
