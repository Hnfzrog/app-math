'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { generateKopPdf } from '@/lib/pdf';
import { fileUrl, uploadImage } from '@/lib/uploadClient';
import CameraCapture from '@/components/CameraCapture';

// Nilai status yang sah menurut CHECK constraint di DB: masuk / izin / sakit / alpha.
// (Sebelumnya kode memakai 'hadir' yang ditolak constraint, sehingga presensi tidak pernah tersimpan.)
const STATUS_PRESENSI = [
  { value: 'masuk', label: 'Hadir (Masuk)' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alpha', label: 'Alpha (Tanpa Keterangan)' },
];

const badgeStatus = (status: string) => {
  switch (status) {
    case 'masuk': return 'badge-success';
    case 'izin': return 'badge-primary';
    case 'sakit': return 'badge-warning';
    case 'alpha': return 'badge-danger';
    default: return 'badge-secondary';
  }
};

const labelStatus = (status: string) =>
  STATUS_PRESENSI.find(s => s.value === status)?.label || status;

const todayISO = () => new Date().toISOString().split('T')[0];

export default function GuruPresensi() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  
  const [presensiList, setPresensiList] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState<string>('');
  const [kelasList, setKelasList] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedPresensi, setSelectedPresensi] = useState<any>(null);
  const [feedback, setFeedback] = useState('');

  // Input presensi manual (per siswa / sekelas sekaligus)
  const [showManual, setShowManual] = useState(false);
  const [manualKelas, setManualKelas] = useState('');
  const [manualMode, setManualMode] = useState<'kelas' | 'siswa'>('kelas');
  const [siswaKelasList, setSiswaKelasList] = useState<any[]>([]);
  const [statusPerSiswa, setStatusPerSiswa] = useState<Record<string, string>>({});
  const [manualSiswaId, setManualSiswaId] = useState('');
  const [manualStatus, setManualStatus] = useState('masuk');
  const [manualFoto, setManualFoto] = useState<File | null>(null);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

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

  const resetModalManual = () => {
    setManualMode('kelas');
    setSiswaKelasList([]);
    setStatusPerSiswa({});
    setManualSiswaId('');
    setManualStatus('masuk');
    setManualFoto(null);
  };

  const bukaModalManual = () => {
    resetModalManual();
    setManualKelas(filterKelas || '');
    setShowManual(true);
    if (filterKelas) muatSiswaKelas(filterKelas);
  };

  // Ambil siswa kelas + presensi hari ini, supaya siswa yang sudah tercatat bisa ditandai
  // dan dilewati — inilah yang mencegah baris presensi ganda di hari yang sama.
  const muatSiswaKelas = async (kelasId: string) => {
    if (!kelasId) {
      setSiswaKelasList([]);
      setStatusPerSiswa({});
      return;
    }

    setLoadingSiswa(true);
    setManualFoto(null);

    const { data: siswaData } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama, nisn)')
      .eq('kelas_id', kelasId);

    const { data: presensiHariIni } = await supabase
      .from('presensi')
      .select('siswa_id')
      .eq('kelas_id', kelasId)
      .eq('tanggal', todayISO());

    const sudahPresensi = new Set((presensiHariIni || []).map((p: any) => p.siswa_id));

    const list = (siswaData || [])
      .map((s: any) => ({
        id: s.siswa_id,
        nama: s.users?.nama || '(tanpa nama)',
        nisn: s.users?.nisn || '',
        sudahPresensi: sudahPresensi.has(s.siswa_id),
      }))
      .sort((a: any, b: any) => a.nama.localeCompare(b.nama));

    // Default semua 'masuk'; guru cukup mengubah pengecualiannya.
    const defaultStatus: Record<string, string> = {};
    list.forEach((s: any) => { if (!s.sudahPresensi) defaultStatus[s.id] = 'masuk'; });

    setSiswaKelasList(list);
    setStatusPerSiswa(defaultStatus);
    setManualSiswaId(list.find((s: any) => !s.sudahPresensi)?.id || '');
    setLoadingSiswa(false);
  };

  const handleSimpanManual = async () => {
    if (!manualKelas) {
      customAlert('Pilih kelas terlebih dahulu.', true);
      return;
    }
    if (!manualFoto) {
      customAlert('Foto presensi wajib diambil langsung dari kamera.', true);
      return;
    }
    if (manualMode === 'siswa' && !manualSiswaId) {
      customAlert('Pilih siswa terlebih dahulu.', true);
      return;
    }

    const target = manualMode === 'siswa'
      ? siswaKelasList.filter(s => s.id === manualSiswaId && !s.sudahPresensi)
      : siswaKelasList.filter(s => !s.sudahPresensi);

    if (target.length === 0) {
      customAlert(
        manualMode === 'siswa'
          ? 'Siswa ini sudah presensi hari ini.'
          : 'Semua siswa di kelas ini sudah presensi hari ini.',
        true
      );
      return;
    }

    setSavingManual(true);
    try {
      const fotoUrl = await uploadImage(manualFoto, 'presensi');
      const tanggal = todayISO();

      const rows = target.map(s => ({
        siswa_id: s.id,
        kelas_id: manualKelas,
        tanggal,
        status: manualMode === 'siswa' ? manualStatus : (statusPerSiswa[s.id] || 'masuk'),
        // Satu foto bukti dipakai untuk semua baris pada mode sekelas — cukup satu kali upload.
        foto_url: fotoUrl,
        // Diinput guru sendiri, jadi tidak perlu dia validasi lagi.
        status_validasi: 'valid',
      }));

      const { error } = await supabase.from('presensi').insert(rows);
      if (error) {
        customAlert('Gagal menyimpan presensi: ' + error.message, true);
        setSavingManual(false);
        return;
      }

      setShowManual(false);
      resetModalManual();
      fetchPresensi();
      customAlert(`${rows.length} presensi berhasil disimpan.`, false);
    } catch (err: any) {
      customAlert('Gagal upload foto: ' + (err?.message || err), true);
    }
    setSavingManual(false);
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
        <div className="d-flex gap-2">
          <button onClick={bukaModalManual} className="btn btn-outline">Input Presensi Manual</button>
          <button onClick={handleExportPDF} className="btn btn-primary">Export PDF</button>
        </div>
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
                      <span className={`badge ${badgeStatus(p.status)}`}>
                        {labelStatus(p.status)}
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

      {/* Modal Input Presensi Manual */}
      {showManual && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Input Presensi Manual</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowManual(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Kelas</label>
                <select
                  className="form-control"
                  value={manualKelas}
                  onChange={e => { setManualKelas(e.target.value); muatSiswaKelas(e.target.value); }}
                >
                  <option value="">Pilih kelas...</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>

              {manualKelas && (
                <div className="form-group mt-3">
                  <label>Mode Input</label>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn ${manualMode === 'kelas' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setManualMode('kelas')}
                    >
                      Sekelas Sekaligus
                    </button>
                    <button
                      type="button"
                      className={`btn ${manualMode === 'siswa' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setManualMode('siswa')}
                    >
                      Per Siswa
                    </button>
                  </div>
                </div>
              )}

              {manualKelas && (
                loadingSiswa ? (
                  <p className="text-center my-3">Memuat siswa...</p>
                ) : siswaKelasList.length === 0 ? (
                  <p className="text-muted my-3">Belum ada siswa di kelas ini.</p>
                ) : manualMode === 'siswa' ? (
                  <>
                    <div className="form-group mt-3">
                      <label>Siswa</label>
                      <select
                        className="form-control"
                        value={manualSiswaId}
                        onChange={e => setManualSiswaId(e.target.value)}
                      >
                        <option value="">Pilih siswa...</option>
                        {siswaKelasList.map(s => (
                          <option key={s.id} value={s.id} disabled={s.sudahPresensi}>
                            {s.nama}{s.sudahPresensi ? ' — sudah presensi hari ini' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group mt-3">
                      <label>Status Kehadiran</label>
                      <select
                        className="form-control"
                        value={manualStatus}
                        onChange={e => setManualStatus(e.target.value)}
                      >
                        {STATUS_PRESENSI.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="mt-3">
                    <p className="text-muted" style={{ fontSize: '13px' }}>
                      Semua siswa default <strong>Hadir (Masuk)</strong>. Ubah hanya yang izin/sakit/alpha.
                      Siswa yang sudah presensi hari ini dikunci agar tidak tercatat dua kali.
                    </p>
                    <div style={{ maxHeight: '40vh', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)' }}>
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Nama Siswa</th>
                            <th style={{ width: '190px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siswaKelasList.map(s => (
                            <tr key={s.id}>
                              <td>
                                <strong>{s.nama}</strong><br />
                                <small className="text-muted">{s.nisn || '-'}</small>
                              </td>
                              <td>
                                {s.sudahPresensi ? (
                                  <span className="badge badge-secondary">Sudah presensi</span>
                                ) : (
                                  <select
                                    className="form-control"
                                    value={statusPerSiswa[s.id] || 'masuk'}
                                    onChange={e => setStatusPerSiswa(prev => ({ ...prev, [s.id]: e.target.value }))}
                                  >
                                    {STATUS_PRESENSI.map(o => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

              {manualKelas && !loadingSiswa && siswaKelasList.length > 0 && (
                <div className="form-group mt-3">
                  <label>Foto Presensi (Wajib, dari kamera)</label>
                  <CameraCapture onCapture={setManualFoto} />
                  <small className="text-muted">
                    {manualMode === 'kelas'
                      ? 'Satu foto ini dipakai sebagai bukti untuk semua siswa yang disimpan.'
                      : 'Foto diambil langsung dari kamera, lalu dikompres otomatis.'}
                  </small>
                </div>
              )}

              <div className="d-flex justify-between mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>Batal</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSimpanManual}
                  disabled={savingManual || !manualFoto || !manualKelas}
                >
                  {savingManual
                    ? 'Menyimpan...'
                    : manualMode === 'kelas'
                      ? `Simpan ${siswaKelasList.filter(s => !s.sudahPresensi).length} Siswa`
                      : 'Simpan Presensi'}
                </button>
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
