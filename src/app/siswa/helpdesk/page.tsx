'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function SiswaHelpdesk() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [deskripsi, setDeskripsi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userId) fetchLaporan();
  }, [userId]);

  const fetchLaporan = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('laporan')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) console.error(error);
    if (data) setLaporanList(data);
    setLoading(false);
  };

  const handleKirim = async () => {
    if (!deskripsi.trim()) {
      customAlert('Deskripsi laporan tidak boleh kosong.', true);
      return;
    }
    
    setSubmitting(true);
    const { error } = await supabase.from('laporan').insert({
      user_id: userId,
      role: 'siswa',
      deskripsi: deskripsi.trim(),
      status: 'menunggu'
    });

    if (error) {
      customAlert('Gagal mengirim laporan: ' + error.message, true);
    } else {
      customAlert('Laporan berhasil dikirim!', false);
      setDeskripsi('');
      fetchLaporan();
    }
    setSubmitting(false);
  };

  if (userLoading || loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Helpdesk Siswa</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Laporkan kendala aplikasi kepada Admin.</p>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-body h-max">
          <h3 className="mb-3">Buat Laporan Baru</h3>
          <div className="form-group">
            <label>Deskripsi Kendala</label>
            <textarea
              className="form-control"
              rows={5}
              placeholder="Jelaskan kendala yang Anda alami..."
              value={deskripsi}
              onChange={e => setDeskripsi(e.target.value)}
            ></textarea>
          </div>
          <button 
            className="btn btn-primary w-100 mt-2"
            onClick={handleKirim}
            disabled={submitting}
          >
            {submitting ? 'Mengirim...' : 'Kirim Laporan'}
          </button>
        </div>

        <div className="card card-body">
          <h3 className="mb-3">Riwayat Laporan</h3>
          {laporanList.length === 0 ? (
            <p className="text-muted">Belum ada laporan yang Anda buat.</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {laporanList.map(l => (
                <div key={l.id} className="p-3 border rounded">
                  <div className="d-flex justify-between align-center mb-2">
                    <small className="text-muted">{new Date(l.created_at).toLocaleString('id-ID')}</small>
                    <span className={`badge ${l.status === 'selesai' ? 'badge-success' : 'badge-warning'}`}>
                      {l.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="m-0" style={{ fontSize: '14px', lineHeight: '1.5' }}>{l.deskripsi}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
