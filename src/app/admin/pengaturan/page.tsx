'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';

export default function AdminPengaturan() {
  const [loading, setLoading] = useState(true);
  const [pengaturanId, setPengaturanId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [form, setForm] = useState({
    nama_sekolah: '',
    alamat: '',
    kop_surat: '',
    latitude_pusat: '',
    longitude_pusat: '',
    radius_meter: '50'
  });

  useEffect(() => {
    fetchPengaturan();
  }, []);

  const fetchPengaturan = async () => {
    setLoading(true);
    const { data } = await supabase.from('pengaturan').select('*').limit(1).single();
    if (data) {
      setPengaturanId(data.id);
      setForm({
        nama_sekolah: data.nama_sekolah || '',
        alamat: data.alamat || '',
        kop_surat: data.kop_surat || '',
        latitude_pusat: data.latitude_pusat != null ? String(data.latitude_pusat) : '',
        longitude_pusat: data.longitude_pusat != null ? String(data.longitude_pusat) : '',
        radius_meter: data.radius_meter != null ? String(data.radius_meter) : '50'
      });
    }
    setLoading(false);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nama_sekolah: form.nama_sekolah,
      alamat: form.alamat,
      kop_surat: form.kop_surat,
      latitude_pusat: form.latitude_pusat ? parseFloat(form.latitude_pusat) : null,
      longitude_pusat: form.longitude_pusat ? parseFloat(form.longitude_pusat) : null,
      radius_meter: form.radius_meter ? parseInt(form.radius_meter) : 50
    };

    let error;
    if (pengaturanId) {
      ({ error } = await supabase.from('pengaturan').update(payload).eq('id', pengaturanId));
    } else {
      ({ error } = await supabase.from('pengaturan').insert(payload));
    }

    if (error) {
      customAlert('Gagal menyimpan: ' + error.message, true);
    } else {
      customAlert('Pengaturan berhasil disimpan!');
      fetchPengaturan();
    }
  };

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleAmbilGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      customAlert('Browser ini tidak mendukung GPS.', true);
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          latitude_pusat: pos.coords.latitude.toFixed(7),
          longitude_pusat: pos.coords.longitude.toFixed(7)
        }));
        setCapturing(false);
        customAlert('Koordinat berhasil diambil dari GPS! Periksa lalu klik Simpan.');
      },
      (err) => {
        setCapturing(false);
        customAlert('Gagal mengambil lokasi: ' + err.message, true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  if (loading) return <div className="text-center mt-4">Memuat pengaturan...</div>;

  const hasCoords = form.latitude_pusat && form.longitude_pusat;

  return (
    <div>
      {/* Header */}
      <div className="card card-body mb-4" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ fontSize: '28px', width: '56px', height: '56px', borderRadius: '14px', background: 'var(--primary-light, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ⚙️
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Pengaturan Sekolah & GPS</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Kelola identitas sekolah (kop surat) dan titik koordinat presensi.</p>
        </div>
      </div>

      <form onSubmit={handleSimpan}>
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Identitas Sekolah */}
          <div className="card card-body">
            <h4 className="mb-3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🏫 Identitas Sekolah</h4>
            <div className="form-group">
              <label>Nama Sekolah</label>
              <input className="form-control" value={form.nama_sekolah} onChange={e => set('nama_sekolah', e.target.value)} placeholder="Contoh: SMP Negeri 1" />
            </div>
            <div className="form-group mt-3">
              <label>Alamat</label>
              <textarea className="form-control" rows={2} value={form.alamat} onChange={e => set('alamat', e.target.value)} placeholder="Contoh: Jl. Merdeka No. 1" />
            </div>
            <div className="form-group mt-3">
              <label>Kop Surat</label>
              <input className="form-control" value={form.kop_surat} onChange={e => set('kop_surat', e.target.value)} placeholder="Contoh: Terakreditasi A" />
            </div>
          </div>

          {/* GPS */}
          <div className="card card-body">
            <h4 className="mb-3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📍 Titik Koordinat Presensi</h4>
            <div className="p-3" style={{ background: 'var(--slate-50, #f8fafc)', border: '1px solid var(--slate-200, #e2e8f0)', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--slate-500, #64748b)' }}>
                Koordinat diambil otomatis dari GPS (tanpa mengetik). Berdiri di lokasi sekolah, lalu klik tombol di bawah.
              </p>
            </div>
            <div className="grid-2 gap-3">
              <div className="form-group">
                <label>Latitude</label>
                <input type="number" step="any" className="form-control" value={form.latitude_pusat} readOnly placeholder="—" style={{ backgroundColor: 'var(--slate-100)' }} />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input type="number" step="any" className="form-control" value={form.longitude_pusat} readOnly placeholder="—" style={{ backgroundColor: 'var(--slate-100)' }} />
              </div>
            </div>
            <button type="button" className="btn btn-outline w-100 mt-3" onClick={handleAmbilGps} disabled={capturing}>
              {capturing ? 'Mengambil lokasi...' : '📍 Ambil Koordinat dari GPS'}
            </button>
            <div className="form-group mt-3">
              <label>Radius Presensi (meter)</label>
              <input type="number" className="form-control" value={form.radius_meter} onChange={e => set('radius_meter', e.target.value)} min="10" />
              <small className="text-muted">Siswa harus berada dalam radius ini dari titik pusat agar presensi valid.</small>
            </div>
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${form.latitude_pusat},${form.longitude_pusat}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 d-block"
              >
                📍 Lihat titik di Google Maps
              </a>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>💾 Simpan Pengaturan</button>
        </div>
      </form>
    </div>
  );
}
