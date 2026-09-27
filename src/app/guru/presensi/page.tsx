'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { generateKopPdf } from '@/lib/pdf';
import { fileUrl } from '@/lib/uploadClient';

export default function GuruPresensi() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  
  const [presensiList, setPresensiList] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState<string>('');
  const [kelasList, setKelasList] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedPresensi, setSelectedPresensi] = useState<any>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (userId) {
      fetchKelas();
      fetchPresensi();
    }
  }, [userId, filterKelas]);

  const fetchKelas = async () => {
    const { data } = await supabase
      .from('guru_kelas')
      .select('kelas(id, nama)')
      .eq('guru_id', userId);
    
    if (data) {
      // @ts-ignore
      setKelasList(data.map(gk => gk.kelas).filter(Boolean));
    }
  };

  const fetchPresensi = async () => {
    setLoading(true);
    let query = supabase
      .from('presensi')
      .select(`
        id, created_at, status, status_validasi, feedback_guru, latitude, longitude, foto_url,
        users!inner(nama, nisn),
        kelas!inner(id, nama)
      `)
      .order('created_at', { ascending: false });

    if (filterKelas) {
      query = query.eq('kelas_id', filterKelas);
    } else {
      // Hanya tampilkan presensi dari kelas yang diajarkan guru ini
      const { data: gk } = await supabase.from('guru_kelas').select('kelas_id').eq('guru_id', userId);
      const kIds = gk?.map(g => g.kelas_id) || [];
      if (kIds.length > 0) {
        query = query.in('kelas_id', kIds);
      }
    }

    const { data, error } = await query;
    if (data) {
      setPresensiList(data);
    }
    setLoading(false);
  };

  const handleValidasi = async (status_validasi: string) => {
    if (!selectedPresensi) return;

    const { error } = await supabase
      .from('presensi')
      .update({
        status_validasi,
        feedback_guru: feedback || null
      })
      .eq('id', selectedPresensi.id);

    if (error) {
      customAlert('Gagal update validasi: ' + error.message, true);
    } else {
      setShowModal(false);
      fetchPresensi();
    }
  };

  const bukaModalValidasi = (p: any) => {
    setSelectedPresensi(p);
    setFeedback(p.feedback_guru || '');
    setShowModal(true);
  };

  const handleExportPDF = async () => {
    const kelasNama = filterKelas ? (kelasList.find(k => k.id === filterKelas)?.nama || '') : '';
    const title = `Daftar Presensi Siswa ${filterKelas ? 'Kelas ' + kelasNama + ' ' : ''}`;
    const columns = ['No', 'Tanggal', 'Nama Siswa', 'NISN', 'Kelas', 'Status', 'Validasi'];
    const rows = presensiList.map((p, i) => [
      i + 1,
      new Date(p.created_at).toLocaleDateString('id-ID'),
      p.users?.nama || '-',
      p.users?.nisn || '-',
      p.kelas?.nama || '-',
      (p.status || '-').toUpperCase(),
      (p.status_validasi || 'pending').toUpperCase()
    ]);
    await generateKopPdf({ title, columns, rows, filename: 'daftar-presensi.pdf' });
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Validasi Presensi GPS</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Validasi kehadiran siswa (Radius 50m).</p>
        </div>
        <button onClick={handleExportPDF} className="btn btn-primary">Export PDF</button>
      </div>

      <div className="card card-body mb-4 hide-on-print">
        <div className="form-group mb-0">
          <label>Filter Kelas</label>
          <select 
            className="form-control" 
            value={filterKelas} 
            onChange={e => setFilterKelas(e.target.value)}
          >
            <option value="">Semua Kelas Saya</option>
            {kelasList.map(k => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card card-body">
        {loading ? (
          <p className="text-center my-4">Memuat data...</p>
        ) : presensiList.length === 0 ? (
          <p className="text-center text-muted my-4">Belum ada data presensi.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Siswa</th>
                  <th>Kelas</th>
                  <th>Status Presensi</th>
                  <th>Lokasi (GPS)</th>
                  <th>Foto</th>
                  <th>Validasi Guru</th>
                  <th className="hide-on-print">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {presensiList.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleString('id-ID')}</td>
                    <td>
                      <strong>{p.users?.nama}</strong><br/>
                      <small className="text-muted">{p.users?.nisn || '-'}</small>
                    </td>
                    <td>{p.kelas?.nama}</td>
                    <td>
                      <span className={`badge ${p.status === 'hadir' ? 'badge-primary' : (p.status === 'izin' ? 'badge-info' : (p.status === 'sakit' ? 'badge-warning' : 'badge-danger'))}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {p.latitude && p.longitude ? (
                        <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">
                          Lihat Peta
                        </a>
                      ) : (
                        <span className="text-muted text-sm">Tidak ada GPS</span>
                      )}
                    </td>
                    <td>
                      {p.foto_url ? (
                        <a href={fileUrl(p.foto_url)!} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">Lihat Foto</a>
                      ) : (
                        <span className="text-muted text-sm">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        p.status_validasi === 'valid' ? 'badge-primary' : 
                        p.status_validasi === 'invalid' ? 'badge-danger' : 
                        'badge-warning'
                      }`}>
                        {p.status_validasi?.toUpperCase() || 'PENDING'}
                      </span>
                      {p.feedback_guru && <div className="text-sm mt-1"><em>Catatan: {p.feedback_guru}</em></div>}
                    </td>
                    <td className="hide-on-print">
                      <button onClick={() => bukaModalValidasi(p)} className="btn btn-sm btn-outline">Validasi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Validasi */}
      {showModal && selectedPresensi && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Validasi Presensi</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <p><strong>Nama:</strong> {selectedPresensi.users?.nama}</p>
                <p><strong>Status Ajuan:</strong> {selectedPresensi.status.toUpperCase()}</p>
                {selectedPresensi.foto_url && (
                  <div className="mt-2">
                    <img src={fileUrl(selectedPresensi.foto_url)!} alt="Foto presensi" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px' }} />
                  </div>
                )}
                {selectedPresensi.latitude && selectedPresensi.longitude && (
                  <p className="mt-2">
                    <a href={`https://maps.google.com/?q=${selectedPresensi.latitude},${selectedPresensi.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary">📍 Lihat lokasi di Maps</a>
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Catatan / Feedback (Opsional)</label>
                <textarea 
                  className="form-control" 
                  rows={3} 
                  value={feedback} 
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Contoh: Lokasi terlalu jauh, tolong konfirmasi wali kelas."
                />
              </div>

              <div className="d-flex justify-between mt-4">
                <button className="btn btn-danger" onClick={() => handleValidasi('invalid')}>Tolak (Invalid)</button>
                <button className="btn btn-primary" onClick={() => handleValidasi('valid')}>Terima (Valid)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles for print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .hide-on-print { display: none !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .table th { background-color: #f1f5f9 !important; color: #0f172a !important; }
          .badge { border: 1px solid #ccc; color: #000; background: none; }
        }
      `}} />
    </div>
  );
}
