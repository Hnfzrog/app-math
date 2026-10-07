'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { judulBab } from '@/lib/judulBab';
import {
  badgeStatusUjian,
  formatJadwal,
  labelStatusUjian,
  statusUjian,
  toLocalInput,
} from '@/lib/jadwalUjian';

export default function GuruUjian() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  const [kelasList, setKelasList] = useState<any[]>([]);
  const [ujianList, setUjianList] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [babList, setBabList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    kelas_id: '',
    jenis: 'UH',
    deskripsi: '',
    durasi_menit: 60,
    mulai_at: '',
    selesai_at: '',
    is_terbit: false,
    bab_id: ''
  });

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  // Muat daftar bab setiap kali kelas di form berubah (untuk dropdown Bab pada UH).
  useEffect(() => {
    if (!formData.kelas_id) {
      setBabList([]);
      return;
    }
    supabase
      .from('bab')
      .select('id, nomor, judul')
      .eq('kelas_id', formData.kelas_id)
      .order('nomor')
      .then(({ data }) => setBabList(data || []));
  }, [formData.kelas_id]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch kelas
    const { data: guruKelas } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama)')
      .eq('guru_id', userId);

    if (guruKelas) {
      // @ts-ignore
      setKelasList(guruKelas.map(gk => gk.kelas).filter(Boolean));
    }

    // Fetch Ujian
    const { data: ujianData } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi, durasi_menit, created_at, mulai_at, selesai_at, is_terbit, kelas_id, bab_id, kelas(nama)')
      .eq('guru_id', userId)
      .order('created_at', { ascending: false });

    if (ujianData) {
      setUjianList(ujianData);
    }

    setLoading(false);
  };

  const resetForm = () => {
    setEditModeId(null);
    setFormData({
      kelas_id: '',
      jenis: 'UH',
      deskripsi: '',
      durasi_menit: 60,
      mulai_at: '',
      selesai_at: '',
      is_terbit: false,
      bab_id: ''
    });
  };

  const bukaModalTambah = () => {
    resetForm();
    setShowModal(true);
  };

  const bukaModalEdit = (u: any) => {
    setEditModeId(u.id);
    setFormData({
      kelas_id: u.kelas_id || '',
      jenis: u.jenis,
      deskripsi: u.deskripsi || '',
      durasi_menit: u.durasi_menit,
      mulai_at: toLocalInput(u.mulai_at),
      selesai_at: toLocalInput(u.selesai_at),
      is_terbit: !!u.is_terbit,
      bab_id: u.bab_id || ''
    });
    setShowModal(true);
  };

  const jadwalValid = () => {
    if (!formData.mulai_at || !formData.selesai_at) return false;
    return new Date(formData.selesai_at).getTime() > new Date(formData.mulai_at).getTime();
  };

  const handleSimpanUjian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.mulai_at || !formData.selesai_at) {
      customAlert('Jadwal buka dan tutup ujian wajib diisi!', true);
      return;
    }
    if (new Date(formData.selesai_at).getTime() <= new Date(formData.mulai_at).getTime()) {
      customAlert('Jadwal tutup harus setelah jadwal buka!', true);
      return;
    }
    if (formData.is_terbit && !jadwalValid()) {
      customAlert('Jadwal belum lengkap, ujian belum bisa diterbitkan.', true);
      return;
    }
    // UH wajib terhubung ke satu bab supaya nilainya masuk ke nilai per-bab.
    if (formData.jenis === 'UH' && !formData.bab_id) {
      customAlert('Pilih bab untuk ujian UH!', true);
      return;
    }

    const payload = {
      jenis: formData.jenis,
      deskripsi: formData.deskripsi,
      durasi_menit: formData.durasi_menit,
      mulai_at: new Date(formData.mulai_at).toISOString(),
      selesai_at: new Date(formData.selesai_at).toISOString(),
      is_terbit: formData.is_terbit,
      bab_id: formData.jenis === 'UH' ? formData.bab_id : null
    };

    if (editModeId) {
      // kelas_id sengaja tidak diubah saat edit — memindah kelas setelah ada siswa
      // mengerjakan akan memutus relasi jawaban ujian.
      const { error } = await supabase.from('ujian').update(payload).eq('id', editModeId);
      if (error) {
        customAlert('Gagal mengubah ujian: ' + error.message, true);
        return;
      }
    } else {
      if (!formData.kelas_id) {
        customAlert('Pilih kelas terlebih dahulu!', true);
        return;
      }
      const { error } = await supabase.from('ujian').insert({
        guru_id: userId,
        kelas_id: formData.kelas_id,
        ...payload
      });
      if (error) {
        customAlert('Gagal membuat ujian: ' + error.message, true);
        return;
      }
    }

    setShowModal(false);
    resetForm();
    fetchData();
  };

  const hapusUjian = async (id: string) => {
    if (!confirm('Yakin ingin menghapus ujian ini? Semua soal di dalamnya akan terhapus.')) return;
    const { error } = await supabase.from('ujian').delete().eq('id', id);
    if (error) {
      customAlert('Gagal menghapus: ' + error.message, true);
    } else {
      fetchData();
    }
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div>
          <h2 style={{ margin: 0 }}>Manajemen Ujian</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Kelola ujian (UH, UTS, UAS), atur jadwal buka/tutup, lalu terbitkan agar bisa dikerjakan siswa.
          </p>
        </div>
        <button onClick={bukaModalTambah} className="btn btn-primary">+ Buat Ujian Baru</button>
      </div>

      <div className="card card-body">
        {loading ? (
          <p className="text-center my-4">Memuat data...</p>
        ) : ujianList.length === 0 ? (
          <p className="text-center text-muted my-4">Belum ada ujian yang dibuat.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Jenis</th>
                  <th>Deskripsi</th>
                  <th>Jadwal Buka</th>
                  <th>Jadwal Tutup</th>
                  <th>Durasi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ujianList.map(u => {
                  const status = statusUjian(u);
                  return (
                    <tr key={u.id}>
                      <td><strong>{u.kelas?.nama}</strong></td>
                      <td>
                        <span className={`badge ${u.jenis === 'UH' ? 'badge-primary' : (u.jenis === 'UTS' ? 'badge-warning' : 'badge-danger')}`}>
                          {u.jenis}
                        </span>
                      </td>
                      <td>{u.deskripsi}</td>
                      <td>{formatJadwal(u.mulai_at)}</td>
                      <td>{formatJadwal(u.selesai_at)}</td>
                      <td>{u.durasi_menit} menit</td>
                      <td>
                        <span className={`badge ${badgeStatusUjian(status)}`}>{labelStatusUjian(status)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Link href={`/guru/ujian/${u.id}`} className="btn btn-sm btn-outline">
                            Kelola Soal
                          </Link>
                          <button onClick={() => bukaModalEdit(u)} className="btn btn-sm btn-outline">Edit</button>
                          <button onClick={() => hapusUjian(u.id)} className="btn btn-sm btn-danger">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>{editModeId ? 'Edit Ujian' : 'Buat Ujian Baru'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpanUjian}>
                <div className="form-group">
                  <label>Pilih Kelas</label>
                  <select
                    className="form-control"
                    value={formData.kelas_id}
                    onChange={e => setFormData({...formData, kelas_id: e.target.value})}
                    disabled={!!editModeId}
                    required
                  >
                    <option value="">Pilih...</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                  {editModeId && (
                    <small className="text-muted">Kelas tidak bisa diubah setelah ujian dibuat.</small>
                  )}
                </div>

                <div className="form-group mt-3">
                  <label>Jenis Ujian</label>
                  <select
                    className="form-control"
                    value={formData.jenis}
                    onChange={e => setFormData({...formData, jenis: e.target.value, bab_id: e.target.value === 'UH' ? formData.bab_id : ''})}
                  >
                    <option value="UH">Ulangan Harian (UH)</option>
                    <option value="UTS">Ujian Tengah Semester (UTS)</option>
                    <option value="UAS">Ujian Akhir Semester (UAS)</option>
                  </select>
                </div>

                {formData.jenis === 'UH' && (
                  <div className="form-group mt-3">
                    <label>Bab (masuk ke nilai per-bab)</label>
                    <select
                      className="form-control"
                      value={formData.bab_id}
                      onChange={e => setFormData({...formData, bab_id: e.target.value})}
                      required
                    >
                      <option value="">Pilih bab...</option>
                      {babList.map(b => (
                        <option key={b.id} value={b.id}>{judulBab(b.nomor, b.judul)}</option>
                      ))}
                    </select>
                    {babList.length === 0 && formData.kelas_id && (
                      <small className="text-muted">Kelas ini belum punya bab.</small>
                    )}
                  </div>
                )}

                <div className="form-group mt-3">
                  <label>Deskripsi (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.deskripsi}
                    onChange={e => setFormData({...formData, deskripsi: e.target.value})}
                    placeholder="Contoh: UH Matematika Bab 1"
                  />
                </div>

                <div className="form-group mt-3">
                  <label>Batas Waktu / Durasi Pengerjaan (Menit)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.durasi_menit}
                    onChange={e => setFormData({...formData, durasi_menit: parseInt(e.target.value) || 60})}
                    min="10"
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label>Jadwal Buka</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.mulai_at}
                    onChange={e => setFormData({...formData, mulai_at: e.target.value})}
                    required
                  />
                  <small className="text-muted">Siswa tidak bisa memulai ujian sebelum waktu ini.</small>
                </div>

                <div className="form-group mt-3">
                  <label>Jadwal Tutup</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.selesai_at}
                    onChange={e => setFormData({...formData, selesai_at: e.target.value})}
                    required
                  />
                  <small className="text-muted">Setelah waktu ini siswa tidak bisa memulai ujian lagi.</small>
                </div>

                <div className="form-group mt-3">
                  <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_terbit}
                      onChange={e => setFormData({...formData, is_terbit: e.target.checked})}
                      disabled={!jadwalValid()}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <span>Terbitkan ujian ini (siswa bisa melihat &amp; mengerjakan)</span>
                  </label>
                  {!formData.is_terbit && (
                    <small className="text-muted">Selama belum diterbitkan, ujian berstatus DRAF dan tidak muncul di daftar siswa.</small>
                  )}
                </div>

                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Ujian</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
