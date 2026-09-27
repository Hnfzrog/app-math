'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadImage } from '@/lib/uploadClient';

const DEFAULT_LAT = -6.200000; // fallback bila pengaturan belum diisi
const DEFAULT_LNG = 106.816666;
const DEFAULT_RADIUS = 50; // meter

export default function SiswaPresensi() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [kelasId, setKelasId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('hadir');
  const [presensiHariIni, setPresensiHariIni] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [lokasiError, setLokasiError] = useState('');
  const [pendingFoto, setPendingFoto] = useState<File | null>(null);
  const [sekolah, setSekolah] = useState<{ lat: number | null, lng: number | null, radius: number }>({ lat: null, lng: null, radius: DEFAULT_RADIUS });

  useEffect(() => {
    if (userId) {
      fetchPresensiData();
    }
  }, [userId]);

  const fetchPresensiData = async () => {
    setLoading(true);
    
    // 1. Dapatkan kelas siswa
    const { data: siswaKelas } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', userId).single();
    if (siswaKelas) {
      setKelasId(siswaKelas.kelas_id);
    }

    // Titik pusat + radius dari master pengaturan
    const { data: peng } = await supabase.from('pengaturan').select('latitude_pusat, longitude_pusat, radius_meter').limit(1).single();
    if (peng) {
      setSekolah({
        lat: peng.latitude_pusat != null ? Number(peng.latitude_pusat) : null,
        lng: peng.longitude_pusat != null ? Number(peng.longitude_pusat) : null,
        radius: peng.radius_meter != null ? Number(peng.radius_meter) : DEFAULT_RADIUS
      });
    }
    
    // 2. Cek presensi hari ini
    const today = new Date().toISOString().split('T')[0];
    const { data: pToday } = await supabase
      .from('presensi')
      .select('*')
      .eq('siswa_id', userId)
      .eq('tanggal', today)
      .single();
      
    if (pToday) {
      setPresensiHariIni(pToday);
    }

    // 3. Ambil history (5 terakhir)
    const { data: pHistory } = await supabase
      .from('presensi')
      .select('*')
      .eq('siswa_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (pHistory) {
      setHistory(pHistory);
    }

    setLoading(false);
  };

  // Fungsi Haversine untuk hitung jarak dalam meter
  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radius bumi dalam meter
    const p = Math.PI / 180;
    const a = 0.5 - Math.cos((lat2 - lat1) * p)/2 + 
              Math.cos(lat1 * p) * Math.cos(lat2 * p) * 
              (1 - Math.cos((lon2 - lon1) * p))/2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const submitPresensi = async (lat: number | null, lng: number | null) => {
    if (!kelasId) {
      customAlert("Anda belum masuk ke kelas manapun.", true);
      setSubmitting(false);
      return;
    }

    let fotoUrl: string | null = null;
    if (pendingFoto) {
      try {
        fotoUrl = await uploadImage(pendingFoto, 'presensi');
      } catch (err: any) {
        customAlert('Gagal upload foto: ' + (err?.message || err), true);
        setSubmitting(false);
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const newPresensi = {
      siswa_id: userId,
      kelas_id: kelasId,
      tanggal: today,
      status: status,
      latitude: lat,
      longitude: lng,
      foto_url: fotoUrl,
      status_validasi: 'pending' // Menunggu validasi guru
    };

    const { error } = await supabase.from('presensi').insert(newPresensi);
    if (error) {
      customAlert("Gagal mengirim presensi: " + error.message, true);
    } else {
      customAlert("Presensi berhasil dikirim!", false);
      fetchPresensiData();
    }
    setSubmitting(false);
  };

  const handlePresensi = () => {
    setSubmitting(true);
    setLokasiError('');

    if (status === 'hadir') {
      if (!pendingFoto) {
        customAlert('Foto presensi wajib diambil langsung dari kamera.', true);
        setSubmitting(false);
        return;
      }
      if (!navigator.geolocation) {
        setLokasiError('Geolocation tidak didukung oleh browser Anda.');
        setSubmitting(false);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const pusatLat = sekolah.lat ?? DEFAULT_LAT;
          const pusatLng = sekolah.lng ?? DEFAULT_LNG;
          const maxRadius = sekolah.radius ?? DEFAULT_RADIUS;
          const distance = getDistanceFromLatLonInM(latitude, longitude, pusatLat, pusatLng);

          if (distance > maxRadius) {
            setLokasiError(`Lokasi Anda terlalu jauh dari sekolah (${Math.round(distance)}m). Maksimal ${maxRadius}m.`);
            setSubmitting(false);
          } else {
            submitPresensi(latitude, longitude);
          }
        },
        (error) => {
          console.error("GPS Error:", error);
          setLokasiError('Gagal mendapatkan lokasi. Pastikan GPS aktif dan izinkan browser mengakses lokasi.');
          setSubmitting(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // Izin atau Sakit tidak perlu GPS
      submitPresensi(null, null);
    }
  };

  if (userLoading || loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Presensi Mandiri</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Batas GPS untuk kehadiran: 50 meter dari sekolah.</p>
      </div>

      <div className="grid-2">
        {/* Form Presensi */}
        <div className="card">
          <div className="card-header">
            <h3>Kirim Presensi Hari Ini</h3>
          </div>
          <div className="card-body">
            {presensiHariIni ? (
              <div className="text-center py-4">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h4>Anda sudah mengisi presensi hari ini.</h4>
                <p>Status: <strong>{presensiHariIni.status.toUpperCase()}</strong></p>
                <div className="mt-2">
                  Status Validasi Guru: <br/>
                  <span className={`badge ${
                    presensiHariIni.status_validasi === 'valid' ? 'badge-primary' : 
                    presensiHariIni.status_validasi === 'invalid' ? 'badge-danger' : 
                    'badge-warning'
                  }`}>
                    {presensiHariIni.status_validasi?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
                {presensiHariIni.feedback_guru && (
                  <p className="mt-2 text-danger text-sm">
                    Catatan Guru: {presensiHariIni.feedback_guru}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>Status Kehadiran</label>
                  <select 
                    className="form-control" 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="hadir">Hadir (Wajib GPS)</option>
                    <option value="sakit">Sakit</option>
                    <option value="izin">Izin</option>
                  </select>
                </div>
                
                {status === 'hadir' && (
                  <div className="alert alert-info mb-3">
                    <small>Pastikan Anda berada di area sekolah. Browser akan meminta izin akses lokasi Anda.</small>
                  </div>
                )}

                <div className="form-group">
                  <label>{status === 'hadir' ? 'Foto Presensi (Wajib, dari kamera)' : 'Bukti/Surat (opsional)'}</label>
                  <PhotoUpload value={null} onFileChange={setPendingFoto} label="Foto Presensi" capture={status === 'hadir'} />
                  {status === 'hadir' && <small className="text-muted">Foto diambil langsung dari kamera, tidak bisa dari galeri.</small>}
                </div>

                {lokasiError && (
                  <div className="alert alert-danger mb-3">
                    {lokasiError}
                  </div>
                )}
                
                <button 
                  onClick={handlePresensi} 
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  {submitting ? 'Memproses...' : 'Kirim Presensi'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="card">
          <div className="card-header">
            <h3>Riwayat Kehadiran Terakhir</h3>
          </div>
          <div className="card-body">
            {history.length === 0 ? (
              <p className="text-muted">Belum ada riwayat.</p>
            ) : (
              <ul className="notif-list">
                {history.map(h => (
                  <li key={h.id} className="notif-item">
                    <div className="d-flex justify-between w-100">
                      <div>
                        <strong>{new Date(h.tanggal).toLocaleDateString('id-ID')}</strong>
                        <div>
                          Status: <span className={`badge ${h.status === 'hadir' ? 'badge-primary' : 'badge-warning'}`}>{h.status.toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div>
                          Validasi: <span className={`badge ${
                            h.status_validasi === 'valid' ? 'badge-primary' : 
                            h.status_validasi === 'invalid' ? 'badge-danger' : 
                            'badge-warning'
                          }`}>
                            {h.status_validasi?.toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                      </div>
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
