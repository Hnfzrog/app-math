'use client';
import { useState, use, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import Link from 'next/link';

export default function GuruKelasDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const kelasId = unwrappedParams.id;
  
  // Dari halaman daftar kelas, kita sekarang mengirimkan ID (UUID) asli dari tabel kelas.
  const [realKelasId, setRealKelasId] = useState<string | null>(kelasId);
  const [kelasNama, setKelasNama] = useState<string>('');

  const [babs, setBabs] = useState<any[]>([]);
  const [materi, setMateri] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [activeBabId, setActiveBabId] = useState<string | null>(null);
  const [formTipe, setFormTipe] = useState('emateri');
  const [formJudul, setFormJudul] = useState('');
  const [formLink, setFormLink] = useState('');
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [confirmDeleteMateriId, setConfirmDeleteMateriId] = useState<string | null>(null);
  const [confirmDeleteBabId, setConfirmDeleteBabId] = useState<string | null>(null);
  const [confirmDeleteSoalIdx, setConfirmDeleteSoalIdx] = useState<number | null>(null);
  
  const [showAddBabModal, setShowAddBabModal] = useState(false);
  const [newBabJudul, setNewBabJudul] = useState('');
  
  // State form kuis
  const [soalList, setSoalList] = useState<any[]>([]);
  const [tipeSoal, setTipeSoal] = useState('pg');
  const [pertanyaan, setPertanyaan] = useState('');
  const [kunciUraian, setKunciUraian] = useState('');
  const [opsiPG, setOpsiPG] = useState(['', '', '', '']);
  const [kunciPG, setKunciPG] = useState<number[]>([0]);

  useEffect(() => {
    fetchDataKelas();
  }, [kelasId]);

  const fetchDataKelas = async () => {
    setLoading(true);
    // Kita langsung gunakan kelasId karena sekarang sudah berupa UUID dari database
    setRealKelasId(kelasId);
    
    // Fetch nama kelas
    const { data: dataKelas } = await supabase.from('kelas').select('nama').eq('id', kelasId).single();
    if (dataKelas) setKelasNama(dataKelas.nama);
    
    // 2. Fetch data Bab
    const { data: babsData } = await supabase.from('bab').select('*').eq('kelas_id', kelasId).order('nomor', { ascending: true });
    if (babsData) setBabs(babsData);

    // 3. Tarik data Konten untuk tiap bab
    const materiMap: Record<string, any[]> = {};
    if (babsData) {
      for (const bab of babsData) {
        const { data: dataKonten } = await supabase.from('konten').select('*').eq('bab_id', bab.id).order('created_at');
        materiMap[bab.id] = dataKonten || [];
      }
    }
    setMateri(materiMap);
    setLoading(false);
  };

  const handleTambahBab = () => {
    setNewBabJudul('');
    setShowAddBabModal(true);
  };

  const executeTambahBab = async (e: any) => {
    e.preventDefault();
    if (newBabJudul.trim() && realKelasId) {
      await supabase.from('bab').insert({
        kelas_id: realKelasId,
        nomor: babs.length + 1,
        judul: newBabJudul.trim()
      });
      fetchDataKelas();
      setShowAddBabModal(false);
    }
  };

  const bukaModalTambah = (babId: string) => {
    setEditModeId(null);
    setActiveBabId(babId);
    setFormTipe('emateri');
    setFormJudul('');
    setFormLink('');
    setSoalList([]);
    setShowModal(true);
  };

  const bukaModalEdit = async (materiId: string, babId: string) => {
    setEditModeId(materiId);
    setActiveBabId(babId);
    const m = materi[babId].find(x => x.id === materiId);
    if (m) {
      setFormTipe(m.tipe);
      setFormJudul(m.judul);
      setFormLink(m.file_url || '');
      
      // Ambil soal yang sudah ada jika tipe kuis
      if (m.tipe !== 'emateri') {
        const { data: soal } = await supabase.from('soal').select('*').eq('konten_id', materiId);
        setSoalList(soal || []);
      } else {
        setSoalList([]);
      }
      setShowModal(true);
    }
  };

  const hapusMateri = async (idKonten: string) => {
    setConfirmDeleteMateriId(idKonten);
  };

  const executeHapusMateri = async () => {
    if (!confirmDeleteMateriId) return;
    await supabase.from('konten').delete().eq('id', confirmDeleteMateriId);
    fetchDataKelas();
    setConfirmDeleteMateriId(null);
  };

  const hapusBab = async (idBab: string) => {
    setConfirmDeleteBabId(idBab);
  };

  const executeHapusBab = async () => {
    if (!confirmDeleteBabId) return;
    const { error } = await supabase.from('bab').delete().eq('id', confirmDeleteBabId);
    if (error) {
      customAlert('Gagal menghapus bab: ' + error.message, true);
    } else {
      fetchDataKelas();
    }
    setConfirmDeleteBabId(null);
  };

  const tambahOpsiPG = () => {
    setOpsiPG([...opsiPG, '']);
  };

  const hapusOpsiPG = (index: number) => {
    if (opsiPG.length <= 2) {
      customAlert('Minimal harus ada 2 opsi pilihan ganda.', true);
      return;
    }
    const newOpsi = opsiPG.filter((_, i) => i !== index);
    setOpsiPG(newOpsi);
    // Adjust kunciPG indexes after removal
    const newKunci = kunciPG
      .filter(k => k !== index)
      .map(k => k > index ? k - 1 : k);
    setKunciPG(newKunci.length > 0 ? newKunci : [0]);
  };

  const toggleKunciPG = (index: number) => {
    setKunciPG(prev => 
      prev.includes(index) 
        ? prev.filter(k => k !== index)
        : [...prev, index]
    );
  };

  const hapusSoalSementara = (idx: number) => {
    setConfirmDeleteSoalIdx(idx);
  };

  const executeHapusSoal = () => {
    if (confirmDeleteSoalIdx === null) return;
    setSoalList(soalList.filter((_, i) => i !== confirmDeleteSoalIdx));
    setConfirmDeleteSoalIdx(null);
  };

  const handleSimpanSoalSementara = () => {
    const isMultiple = kunciPG.length > 1;
    const soalBaru = {
      tipe: tipeSoal,
      pertanyaan: tipeSoal === 'pg' ? `${pertanyaan}|||${JSON.stringify(opsiPG)}|||${isMultiple}` : pertanyaan,
      kunci_jawaban: tipeSoal === 'pg' ? JSON.stringify(kunciPG.map(idx => opsiPG[idx])) : kunciUraian
    };
    setSoalList([...soalList, soalBaru]);
    setPertanyaan('');
    setKunciUraian('');
    setOpsiPG(['', '', '', '']);
    setKunciPG([0]);
  };

  const insertSymbol = (symbol: string) => {
    setPertanyaan(prev => prev + symbol);
  };

  const isSoalValid = () => {
    if (!pertanyaan.trim()) return false;
    if (tipeSoal === 'pg') {
      if (opsiPG.length < 2) return false;
      if (opsiPG.some(opt => !opt.trim())) return false;
      if (kunciPG.length === 0) return false;
    } else {
      if (!kunciUraian.trim()) return false;
    }
    return true;
  };

  const isFormValid = () => {
    if (!formJudul.trim()) return false;
    
    if (formTipe === 'emateri') {
      if (!formLink.trim()) return false;
    } else {
      if (soalList.length === 0) return false;
      if (pertanyaan.trim().length > 0) return false; // Memaksa guru klik simpan soal dulu kalau ada ketikan
    }
    
    return true;
  };

  const handleSimpanKontenFinal = async (e: any) => {
    e.preventDefault();
    if (!activeBabId || !formJudul) return;
    
    // Validasi: Kalau tipe kuis/lkpd, pastikan minimal ada 1 soal yang udah disave ke daftar
    if (formTipe !== 'emateri' && soalList.length === 0) {
      // Cek apakah user sedang ngetik soal tapi lupa klik "Simpan Soal"
      if (pertanyaan.trim().length > 0) {
        customAlert('Kamu belum menyimpan soal yang sedang diketik! Klik "Simpan Soal ke Daftar" terlebih dahulu.', true);
      } else {
        customAlert('Modul evaluasi/kuis minimal harus punya 1 soal! Tambahkan soal ke daftar terlebih dahulu.', true);
      }
      return;
    }
    
    let kontenIdToUse = editModeId;

    if (editModeId) {
      // 1. Update KONTEN
      const { error: errKonten } = await supabase.from('konten').update({
        tipe: formTipe,
        judul: formJudul,
        file_url: formLink || null
      }).eq('id', editModeId);

      if (errKonten) {
        customAlert('Gagal mengupdate konten!', true);
        return;
      }
      
      // Hapus soal lama dan replace (Workaround MVP)
      // KITA TIDAK LAGI MENGHAPUS SEMUA SOAL, karena bisa error FK constraint jika sudah ada jawaban siswa.
    } else {
      // 1. Insert KONTEN
      const { data: newKonten, error: errKonten } = await supabase.from('konten').insert({
        bab_id: activeBabId,
        tipe: formTipe,
        judul: formJudul,
        file_url: formLink || null
      }).select().single();

      if (errKonten || !newKonten) {
        customAlert('Gagal menyimpan konten!', true);
        return;
      }
      kontenIdToUse = newKonten.id;
    }

    // 2. Insert/Update SOAL
    if (kontenIdToUse && formTipe !== 'emateri') {
      const soalBaru = soalList.filter(s => !s.id).map(s => ({
        konten_id: kontenIdToUse,
        pertanyaan: s.pertanyaan,
        tipe: s.tipe,
        kunci_jawaban: s.kunci_jawaban
      }));
      
      const soalLama = soalList.filter(s => s.id).map(s => ({
        id: s.id,
        konten_id: kontenIdToUse,
        pertanyaan: s.pertanyaan,
        tipe: s.tipe,
        kunci_jawaban: s.kunci_jawaban
      }));

      if (soalBaru.length > 0) {
        const { error: errInsert } = await supabase.from('soal').insert(soalBaru);
        if (errInsert) {
          customAlert('Gagal menyimpan soal baru: ' + errInsert.message, true);
          return;
        }
      }
      
      if (soalLama.length > 0) {
        const { error: errUpdate } = await supabase.from('soal').upsert(soalLama);
        if (errUpdate) {
          customAlert('Gagal mengupdate soal lama: ' + errUpdate.message, true);
          return;
        }
      }
    }

    setShowModal(false);
    setEditModeId(null);
    setFormJudul('');
    setFormLink('');
    setSoalList([]);
    fetchDataKelas();
  };

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href="/guru/kelas" className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <h2 style={{ margin: 0 }}>Alur Tujuan Pembelajaran (ATP) - Kelas {kelasNama || '...'}</h2>
        </div>
        <button onClick={handleTambahBab} disabled={!realKelasId} className="btn btn-primary">+ Tambah Bab (Topik)</button>
      </div>
      
      {loading ? (
        <p className="text-center mt-4">Loading data...</p>
      ) : babs.map((bab, index) => (
        <div key={bab.id} className="card card-body mb-4">
          <div className="d-flex justify-between align-center mb-3">
            <h3 className="text-primary">
              <span className="badge badge-info mr-2">{index + 1}</span>
              {bab.judul}
            </h3>
            <div className="d-flex gap-2">
              <button onClick={() => bukaModalTambah(bab.id)} className="btn btn-sm btn-outline">+ Tambah Modul/Kuis</button>
              <button onClick={() => hapusBab(bab.id)} className="btn btn-sm btn-danger">Hapus Bab</button>
            </div>
          </div>
          
          {(!materi[bab.id] || materi[bab.id].length === 0) ? (
            <p className="text-center text-muted p-3">Belum ada modul di topik ini.</p>
          ) : (
            <ul className="notif-list">
              {materi[bab.id].map(m => (
                <li key={m.id} className="notif-item d-flex justify-between align-center">
                  <div>
                    <strong className="d-block mb-1">
                      {m.tipe === 'emateri' ? '📄' : (m.tipe === 'lkpd' ? '📝' : '📚')} {m.judul}
                    </strong>
                    <div className="d-flex align-center gap-2">
                      <span className="badge badge-primary">{m.tipe.toUpperCase()}</span>
                      {m.file_url && <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">Lampiran</a>}
                    </div>
                  </div>
                  <div>
                    <button onClick={() => bukaModalEdit(m.id, bab.id)} className="btn btn-sm btn-outline mr-2">Edit</button>
                    <button onClick={() => hapusMateri(m.id)} className="btn btn-sm btn-danger">Hapus</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* MODAL BIKIN KONTEN */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editModeId ? 'Edit Modul Pembelajaran' : 'Tambah Modul Pembelajaran'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSimpanKontenFinal}>
                <div className="form-group">
                  <label>Tipe Konten</label>
                  <select className="form-control" value={formTipe} onChange={(e) => setFormTipe(e.target.value)} required>
                    <option value="emateri">E-Materi (PDF/Video)</option>
                    <option value="lkpd">LKPD (Tugas)</option>
                    <option value="banksoal">Bank Soal / Evaluasi</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Judul Konten</label>
                  <input type="text" className="form-control" value={formJudul} onChange={e => setFormJudul(e.target.value)} placeholder="Contoh: Kuis Harian SPLDV" required />
                </div>

                {formTipe === 'emateri' && (
                  <div className="form-group">
                    <label>Link / Isi Materi (G-Drive / YouTube)</label>
                    <input type="url" className="form-control" value={formLink} onChange={e => setFormLink(e.target.value)} placeholder="https://..." required />
                  </div>
                )}

                {/* Form pembuat soal */}
                {(formTipe === 'lkpd' || formTipe === 'banksoal' || formTipe === 'evaluasi') && (
                  <div className="card card-body bg-light mb-3">
                    <h4 className="mb-3 text-primary">+ Rancang Bank Soal</h4>
                    
                    <div className="form-group">
                      <label>Tipe Soal</label>
                      <select className="form-control" value={tipeSoal} onChange={e => setTipeSoal(e.target.value)}>
                        <option value="pg">Pilihan Ganda</option>
                        <option value="uraian">Uraian / Essay (Auto Grading AI)</option>
                      </select>
                    </div>
                    
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
                      <textarea className="form-control textarea-math" rows={3} value={pertanyaan} onChange={e => setPertanyaan(e.target.value)} placeholder="Tulis pertanyaan (gunakan toolbar untuk simbol MTK)..." />
                    </div>

                    {tipeSoal === 'pg' ? (
                      <div className="form-group">
                        <label className="d-flex justify-between align-center mb-2">
                          <span>Opsi Pilihan Ganda</span>
                          <button type="button" className="btn btn-sm btn-outline" onClick={tambahOpsiPG}>+ Tambah Opsi</button>
                        </label>
                        <p className="text-sm text-muted mb-2">Pilih satu atau lebih jawaban yang benar menggunakan *checkbox*.</p>
                        <div className="d-flex flex-column gap-2 mt-2">
                          {opsiPG.map((opt, idx) => (
                            <div key={idx} className="d-flex gap-2 align-center">
                              <input 
                                type="checkbox" 
                                checked={kunciPG.includes(idx)} 
                                onChange={() => toggleKunciPG(idx)} 
                                title="Tandai sebagai jawaban benar"
                                style={{ transform: 'scale(1.2)' }}
                              />
                              <input 
                                type="text" 
                                className="form-control" 
                                value={opt} 
                                onChange={e => { 
                                  const newOpts = [...opsiPG]; 
                                  newOpts[idx] = e.target.value; 
                                  setOpsiPG(newOpts); 
                                }} 
                                placeholder={`Opsi ${idx + 1}`} 
                              />
                              {opsiPG.length > 2 && (
                                <button type="button" className="btn btn-sm btn-danger" onClick={() => hapusOpsiPG(idx)}>Hapus</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Kunci Jawaban Uraian (Untuk patokan AI)</label>
                        <textarea className="form-control" rows={3} value={kunciUraian} onChange={e => setKunciUraian(e.target.value)} placeholder="Tulis langkah pengerjaan yang benar..." />
                      </div>
                    )}

                    <button 
                      type="button" 
                      onClick={handleSimpanSoalSementara} 
                      disabled={!isSoalValid()}
                      className="btn btn-outline w-100"
                    >
                      Simpan Soal ke Daftar ({soalList.length} Soal)
                    </button>
                    {!isSoalValid() && (
                      <p className="text-danger text-sm text-center mt-2">
                        *Tombol terkunci. Pastikan teks pertanyaan terisi, <strong>semua kotak opsi tidak ada yang kosong</strong> (hapus opsi jika berlebih), dan pilih minimal 1 kotak sebagai kunci jawaban.
                      </p>
                    )}
                    
                    {soalList.length > 0 && (
                      <div className="mt-3">
                        <p className="text-success font-bold text-center mb-2">✅ {soalList.length} soal siap disimpan.</p>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '8px', padding: '0.5rem' }}>
                          {soalList.map((s, idx) => (
                            <div key={idx} className="d-flex justify-between p-2" style={{ borderBottom: '1px solid #eee' }}>
                              <div>
                                <strong>Soal {idx+1}:</strong> {s.pertanyaan.split('|||')[0].substring(0, 30)}... <span className="badge badge-info">{s.tipe}</span>
                              </div>
                              <button type="button" onClick={() => hapusSoalSementara(idx)} className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="d-flex justify-between mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!isFormValid()}
                  >
                    Simpan Modul ke Kelas
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modals */}
      {confirmDeleteMateriId && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger, #dc3545)' }}>Konfirmasi Hapus</h3>
              <button type="button" className="btn-close-modal" onClick={() => setConfirmDeleteMateriId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus materi dari database?</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteMateriId(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeHapusMateri}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteBabId && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger, #dc3545)' }}>Konfirmasi Hapus</h3>
              <button type="button" className="btn-close-modal" onClick={() => setConfirmDeleteBabId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus bab ini? SEMUA materi dan soal di dalamnya akan ikut terhapus permanen.</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteBabId(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeHapusBab}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSoalIdx !== null && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-dialog" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger, #dc3545)' }}>Konfirmasi Hapus</h3>
              <button type="button" className="btn-close-modal" onClick={() => setConfirmDeleteSoalIdx(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus soal ini dari daftar?</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmDeleteSoalIdx(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeHapusSoal}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Bab Modal */}
      {showAddBabModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Tambah Bab Baru</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowAddBabModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={executeTambahBab}>
                <div className="form-group">
                  <label>Judul Bab</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={newBabJudul}
                    onChange={(e) => setNewBabJudul(e.target.value)}
                    placeholder="Contoh: Bab 2: Aljabar"
                    autoFocus
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddBabModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Bab</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
