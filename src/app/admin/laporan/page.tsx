'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useSearchParams } from 'next/navigation';

function AdminLaporanInner() {
  const searchParams = useSearchParams();
  const roleFilterInit = searchParams.get('role') || 'all';

  const [laporan, setLaporan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState(roleFilterInit);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchLaporan();
  }, [roleFilter, statusFilter]);

  const fetchLaporan = async () => {
    setLoading(true);
    
    let query = supabase
      .from('laporan')
      .select(`
        id, deskripsi, status, role, created_at,
        users:user_id (nama)
      `)
      .order('created_at', { ascending: false });

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(error);
    } else {
      setLaporan(data || []);
    }
    
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'menunggu' ? 'selesai' : 'menunggu';
    
    const { error } = await supabase
      .from('laporan')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (error) {
      customAlert('Gagal mengupdate status: ' + error.message, true);
    } else {
      fetchLaporan();
    }
  };

  const hapusLaporan = async (id: string) => {
    const confirm = window.confirm('Yakin ingin menghapus laporan ini?');
    if (!confirm) return;
    
    const { error } = await supabase.from('laporan').delete().eq('id', id);
    if (error) {
      customAlert('Gagal menghapus laporan: ' + error.message, true);
    } else {
      fetchLaporan();
    }
  };

  return (
    <div className="card card-body">
      <div className="toolbar-row" style={{ marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Helpdesk / Laporan Kendala</h3>
          <p className="text-muted" style={{ margin: '5px 0 0' }}>Pantau dan selesaikan kendala yang dilaporkan oleh Siswa dan Guru.</p>
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <select 
            className="form-control" 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">Semua Role</option>
            <option value="siswa">Siswa</option>
            <option value="guru">Guru</option>
          </select>

          <select 
            className="form-control" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="menunggu">Menunggu</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        {loading ? (
          <p className="text-center my-4">Memuat data...</p>
        ) : laporan.length === 0 ? (
          <p className="text-center text-muted my-4">Tidak ada laporan ditemukan.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tgl & Waktu</th>
                <th>Nama Pelapor</th>
                <th>Role</th>
                <th style={{ width: '40%' }}>Deskripsi Kendala</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {laporan.map((item) => (
                <tr key={item.id}>
                  <td className="text-muted" style={{ fontSize: '12px' }}>
                    {new Date(item.created_at).toLocaleString('id-ID')}
                  </td>
                  <td><strong>{item.users?.nama || 'Unknown User'}</strong></td>
                  <td>
                    <span className={`badge ${item.role === 'guru' ? 'badge-primary' : 'badge-info'}`}>
                      {item.role}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{item.deskripsi}</td>
                  <td>
                    <span className={`badge ${item.status === 'selesai' ? 'badge-success' : 'badge-warning'}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => toggleStatus(item.id, item.status)}
                        className={`btn btn-sm ${item.status === 'selesai' ? 'btn-outline' : 'btn-success'}`}
                        style={item.status === 'selesai' ? {} : { color: 'white' }}
                      >
                        {item.status === 'selesai' ? 'Tandai Menunggu' : 'Tandai Selesai'}
                      </button>
                      <button 
                        onClick={() => hapusLaporan(item.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AdminLaporan() {
  return (
    <Suspense fallback={<div className="text-center mt-4">Memuat laporan...</div>}>
      <AdminLaporanInner />
    </Suspense>
  );
}
