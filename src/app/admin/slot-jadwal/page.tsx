'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';

export default function AdminSlotJadwal() {
  const [slots, setSlots] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form slot jam
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');

  // Form hari
  const [newHari, setNewHari] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [slotRes, hariRes] = await Promise.all([
      supabase.from('slot_jam').select('*').order('jam_mulai'),
      supabase.from('hari').select('*').order('urutan')
    ]);
    if (slotRes.data) setSlots(slotRes.data);
    if (hariRes.data) setDays(hariRes.data);
    setLoading(false);
  };

  // ---- Hari ----
  const handleTambahHari = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHari.trim()) {
      customAlert('Isi nama hari.', true);
      return;
    }
    const { data: last } = await supabase.from('hari').select('urutan').order('urutan', { ascending: false }).limit(1);
    const urutan = (last && last.length > 0 ? last[0].urutan : 0) + 1;
    const { error } = await supabase.from('hari').insert({ nama: newHari.trim(), urutan });
    if (error) {
      customAlert('Gagal menambah hari: ' + error.message, true);
    } else {
      setNewHari('');
      fetchAll();
    }
  };

  const handleHapusHari = async (id: string) => {
    if (!confirm('Hapus hari ini?')) return;
    const { error } = await supabase.from('hari').delete().eq('id', id);
    if (error) customAlert('Gagal menghapus hari: ' + error.message, true);
    else fetchAll();
  };

  // ---- Slot jam ----
  const handleTambahSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jamMulai || !jamSelesai) {
      customAlert('Isi jam mulai dan jam selesai.', true);
      return;
    }
    if (jamMulai >= jamSelesai) {
      customAlert('Jam selesai harus lebih besar dari jam mulai.', true);
      return;
    }
    const { error } = await supabase.from('slot_jam').insert({
      jam_mulai: jamMulai + ':00',
      jam_selesai: jamSelesai + ':00'
    });
    if (error) {
      customAlert('Gagal menambah slot: ' + error.message, true);
    } else {
      setJamMulai('');
      setJamSelesai('');
      fetchAll();
    }
  };

  const handleHapusSlot = async (id: string) => {
    if (!confirm('Hapus slot jam ini?')) return;
    const { error } = await supabase.from('slot_jam').delete().eq('id', id);
    if (error) customAlert('Gagal menghapus slot: ' + error.message, true);
    else fetchAll();
  };

  if (loading) return <div className="text-center mt-4">Memuat data...</div>;

  return (
    <div>
      {/* Header */}
      <div className="card card-body mb-4" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ fontSize: '28px', width: '56px', height: '56px', borderRadius: '14px', background: 'var(--primary-light, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          🗓️
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Master Grid Jadwal</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Atur hari dan slot jam untuk grid jadwal pelajaran.</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Hari */}
        <div className="card card-body">
          <h4 className="mb-3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📅 Hari</h4>
          <form onSubmit={handleTambahHari} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" className="form-control" value={newHari} onChange={e => setNewHari(e.target.value)} placeholder="Contoh: Sabtu" />
            <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Tambah</button>
          </form>
          <div className="table-responsive mt-3">
            {days.length === 0 ? (
              <p className="text-muted text-center my-3">Belum ada hari.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>No</th><th>Nama Hari</th><th style={{ width: '90px' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {days.map((d, i) => (
                    <tr key={d.id}>
                      <td>{i + 1}</td>
                      <td><strong>{d.nama}</strong></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => handleHapusHari(d.id)}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Slot Jam */}
        <div className="card card-body">
          <h4 className="mb-3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⏰ Slot Jam</h4>
          <form onSubmit={handleTambahSlot} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group mb-0">
              <label>Mulai</label>
              <input type="time" className="form-control" value={jamMulai} onChange={e => setJamMulai(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label>Selesai</label>
              <input type="time" className="form-control" value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">+ Tambah</button>
          </form>
          <div className="table-responsive mt-3">
            {slots.length === 0 ? (
              <p className="text-muted text-center my-3">Belum ada slot jam.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>No</th><th>Jam Mulai</th><th>Jam Selesai</th><th style={{ width: '90px' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {slots.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>{s.jam_mulai.slice(0, 5)}</td>
                      <td>{s.jam_selesai.slice(0, 5)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => handleHapusSlot(s.id)}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
