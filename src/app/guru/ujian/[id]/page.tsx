'use client';
import { useState, use, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadFile } from '@/lib/uploadClient';
import Link from 'next/link';

export default function GuruUjianDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const ujianId = unwrappedParams.id;
  
  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [pertanyaan, setPertanyaan] = useState('');
  // Untuk upload foto PENDING
  const [butuhFoto, setButuhFoto] = useState(false);
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);
  const [lampiranLink, setLampiranLink] = useState('');
  const [editModeId, setEditModeId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [ujianId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch info ujian
    const { data: dataUjian } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi, durasi_menit, kelas(nama)')
      .eq('id', ujianId)
      .single();
      
    if (dataUjian) {
      setUjian(dataUjian);
    }

    // Fetch daftar soal
    const { data: dataSoal } = await supabase
      .from('soal_ujian')
      .select('*')
      .eq('ujian_id', ujianId)
      .order('created_at', { ascending: true });

    if (dataSoal) {
      setSoalList(dataSoal);
    }
    
    setLoading(false);
  };

  const bukaModalTambah = () => {
    setEditModeId(null);
    setPertanyaan('');
    setButuhFoto(false);
    setLampiranFile(null);
    setLampiranLink('');
    setShowModal(true);
  };

  const bukaModalEdit = (s: any) => {
    setEditModeId(s.id);
    setPertanyaan(s.pertanyaan);
    setButuhFoto(s.butuh_foto_jawaban);
    setLampiranFile(null);
    setLampiranLink('');
    setShowModal(true);
  };

  const insertSymbol = (symbol: string) => {
    setPertanyaan(prev => prev + symbol);
  };

  const handleSimpanSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pertanyaan.trim()) {
      customAlert('Pertanyaan tidak boleh kosong!', true);
      return;
    }

    // Upload lampiran soal (jika ada file baru)
    let lampiranUrl: string | null = lampiranLink || null;
    if (lampiranFile) {
      try {
        lampiranUrl = await uploadFile(lampiranFile, 'soal');
      } catch (err: any) {
        customAlert('Gagal upload lampiran: ' + (err?.message || err), true);
        return;
      }
    }

    if (editModeId) {
      const { error } = await supabase.from('soal_ujian').update({
        pertanyaan: pertanyaan,
        butuh_foto_jawaban: butuhFoto,
        lampiran_url: lampiranUrl
      }).eq('id', editModeId);

      if (error) {
        customAlert('Gagal update soal: ' + error.message, true);
      }
    } else {
      const { error } = await supabase.from('soal_ujian').insert({
        ujian_id: ujianId,
        pertanyaan: pertanyaan,
        butuh_foto_jawaban: butuhFoto,
        lampiran_url: lampiranUrl
      });

      if (error) {
        customAlert('Gagal tambah soal: ' + error.message, true);
      }
    }
    
    setShowModal(false);
    fetchData();
  };

  const hapusSoal = async (id: string) => {
    if (!confirm('Yakin hapus soal ini?')) return;
    const { error } = await supabase.from('soal_ujian').delete().eq('id', id);
    if (error) {
      customAlert('Gagal menghapus: ' + error.message, true);
    } else {
      fetchData();
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href="/guru/ujian" className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <h2 style={{ margin: 0 }}>Kelola Soal Ujian</h2>
        </div>
        <button onClick={bukaModalTambah} className="btn btn-primary">+ Tambah Soal</button>
      </div>

      {ujian && (
        <div className="card card-body bg-light mb-4">
          <h4 className="mb-2">Informasi Ujian</h4>
          <p className="mb-1"><strong>Kelas:</strong> {ujian.kelas?.nama}</p>
          <p className="mb-1"><strong>Jenis:</strong> {ujian.jenis}</p>
          <p className="mb-1"><strong>Deskripsi:</strong> {ujian.deskripsi}</p>
          <p className="mb-0"><strong>Durasi:</strong> {ujian.durasi_menit} Menit</p>
        </div>
      )}

      <div className="card card-body">
        <h4 className="mb-3">Daftar Soal ({soalList.length})</h4>
        
        {soalList.length === 0 ? (
          <p className="text-center text-muted p-4">Belum ada soal untuk ujian ini. Klik "Tambah Soal" untuk memulai.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {soalList.map((s, idx) => (
              <div key={s.id} className="card card-body p-3" style={{ border: '1px solid var(--slate-200)', boxShadow: 'none' }}>
                <div className="d-flex justify-between">
                  <div>
                    <h5 className="mb-2">Soal {idx + 1}</h5>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{s.pertanyaan}</p>
                    {s.butuh_foto_jawaban && (
                      <span className="badge badge-warning text-sm">Butuh Upload Bukti Jawaban</span>
                    )}
                    {s.lampiran_url && (
                      <span className="badge badge-primary text-sm" style={{ marginLeft: '6px' }}>Ada Lampiran</span>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button onClick={() => bukaModalEdit(s)} className="btn btn-sm btn-outline">Edit</button>
                    <button onClick={() => hapusSoal(s.id)} className="btn btn-sm btn-danger">Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editModeId ? 'Edit Soal' : 'Tambah Soal Baru'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpanSoal}>
                
                <div className="form-group">
                  <label>Pertanyaan</label>
                  <div className="math-toolbar">
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('√')}>√</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('²')}>²</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('π')}>π</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('×')}>×</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('÷')}>÷</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('°')}>°</button>
                    <button type="button" className="btn-symbol" onClick={() => insertSymbol('θ')}>θ</button>
                  </div>
                  <textarea 
                    className="form-control textarea-math" 
                    rows={4} 
                    value={pertanyaan} 
                    onChange={e => setPertanyaan(e.target.value)} 
                    placeholder="Tulis pertanyaan (gunakan toolbar untuk simbol MTK)..." 
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={butuhFoto}
                      onChange={e => setButuhFoto(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <span>Siswa wajib upload bukti jawaban (foto/dokumen, maks 2MB)</span>
                  </label>
                </div>

                <div className="form-group mt-3">
                  <label>Lampiran Soal (opsional): gambar/dokumen untuk soal — maks 2MB</label>
                  <PhotoUpload
                    value={null}
                    onFileChange={setLampiranFile}
                    onLinkChange={setLampiranLink}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    showDrive
                    label="Lampiran Soal"
                  />
                </div>

                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Soal</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
