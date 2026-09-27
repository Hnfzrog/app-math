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
  const [kunciMap, setKunciMap] = useState<Record<string, { kunci_jawaban: string; pembahasan: string }>>({});
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [pertanyaan, setPertanyaan] = useState('');
  const [tipeSoal, setTipeSoal] = useState<'pg' | 'uraian'>('pg');
  const [opsiPG, setOpsiPG] = useState<string[]>(['', '', '', '']);
  const [kunciPG, setKunciPG] = useState<number[]>([0]);
  const [kunciUraian, setKunciUraian] = useState('');
  const [pembahasan, setPembahasan] = useState('');
  // Untuk upload foto PENDING
  const [butuhFoto, setButuhFoto] = useState(false);
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);
  const [lampiranLink, setLampiranLink] = useState('');
  const [editModeId, setEditModeId] = useState<string | null>(null);

  // Ambil soal dari ujian lain
  const [showImportModal, setShowImportModal] = useState(false);
  const [ujianLainList, setUjianLainList] = useState<any[]>([]);
  const [loadingUjianLain, setLoadingUjianLain] = useState(false);
  const [sumberUjianId, setSumberUjianId] = useState('');
  const [soalSumber, setSoalSumber] = useState<any[]>([]);
  const [loadingSoalSumber, setLoadingSoalSumber] = useState(false);
  const [soalDipilih, setSoalDipilih] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

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

    const soal = dataSoal || [];
    setSoalList(soal);

    // Kunci diambil lewat query terpisah (bukan embed) supaya tidak bergantung pada
    // deteksi relasi PostgREST. Kunci hanya terbaca guru pengampu kelas ujian ini.
    if (soal.length > 0) {
      const { data: kunci } = await supabase
        .from('soal_ujian_kunci')
        .select('soal_id, kunci_jawaban, pembahasan')
        .in('soal_id', soal.map((s: any) => s.id));

      const map: Record<string, { kunci_jawaban: string; pembahasan: string }> = {};
      (kunci || []).forEach((k: any) => {
        map[k.soal_id] = { kunci_jawaban: k.kunci_jawaban, pembahasan: k.pembahasan };
      });
      setKunciMap(map);
    } else {
      setKunciMap({});
    }

    setLoading(false);
  };

  const ambilKunci = (s: any) => kunciMap[s.id] || null;

  const resetFormSoal = () => {
    setPertanyaan('');
    setTipeSoal('pg');
    setOpsiPG(['', '', '', '']);
    setKunciPG([0]);
    setKunciUraian('');
    setPembahasan('');
    setButuhFoto(false);
    setLampiranFile(null);
    setLampiranLink('');
  };

  const bukaModalTambah = () => {
    setEditModeId(null);
    resetFormSoal();
    setShowModal(true);
  };

  const bukaModalEdit = (s: any) => {
    setEditModeId(s.id);
    setPertanyaan(s.pertanyaan);
    setTipeSoal(s.tipe === 'pg' ? 'pg' : 'uraian');
    setButuhFoto(s.butuh_foto_jawaban);
    setLampiranFile(null);
    setLampiranLink('');

    const kunci = ambilKunci(s);
    if (s.tipe === 'pg') {
      const opsi: string[] = Array.isArray(s.opsi) ? s.opsi : [];
      setOpsiPG(opsi.length >= 2 ? opsi : ['', '', '', '']);
      // Kunci pg disimpan sebagai JSON array teks opsi benar -> ubah balik jadi indeks.
      try {
        const kunciTeks: string[] = kunci ? JSON.parse(kunci.kunci_jawaban) : [];
        const idx = kunciTeks.map(t => opsi.indexOf(t)).filter(i => i >= 0);
        setKunciPG(idx.length > 0 ? idx : [0]);
      } catch {
        setKunciPG([0]);
      }
      setKunciUraian('');
    } else {
      setOpsiPG(['', '', '', '']);
      setKunciPG([0]);
      setKunciUraian(kunci?.kunci_jawaban || '');
    }
    setPembahasan(kunci?.pembahasan || '');
    setShowModal(true);
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
    // Indeks kunci ikut bergeser setelah opsi dihapus.
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

  const insertSymbol = (symbol: string) => {
    setPertanyaan(prev => prev + symbol);
  };

  const handleSimpanSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pertanyaan.trim()) {
      customAlert('Pertanyaan tidak boleh kosong!', true);
      return;
    }
    if (tipeSoal === 'pg') {
      if (opsiPG.some(opt => !opt.trim())) {
        customAlert('Semua opsi pilihan ganda harus diisi!', true);
        return;
      }
      if (kunciPG.length === 0) {
        customAlert('Tandai minimal satu opsi sebagai jawaban benar!', true);
        return;
      }
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

    const payload: any = {
      pertanyaan: pertanyaan,
      tipe: tipeSoal,
      opsi: tipeSoal === 'pg' ? opsiPG : null,
      // Lebih dari satu kunci = soal multi-jawaban; dipakai siswa untuk memilih radio/checkbox.
      multi_jawaban: tipeSoal === 'pg' && kunciPG.length > 1,
      butuh_foto_jawaban: butuhFoto,
      lampiran_url: lampiranUrl,
    };

    // Kunci disimpan di tabel terpisah supaya tidak terbaca siswa.
    const kunciTeks = tipeSoal === 'pg'
      ? JSON.stringify(kunciPG.map(i => opsiPG[i]))
      : kunciUraian.trim();

    let soalId = editModeId;

    if (editModeId) {
      const { error } = await supabase.from('soal_ujian').update(payload).eq('id', editModeId);
      if (error) {
        customAlert('Gagal update soal: ' + error.message, true);
        return;
      }
    } else {
      const { data: created, error } = await supabase
        .from('soal_ujian')
        .insert({ ...payload, ujian_id: ujianId })
        .select('id')
        .single();

      if (error || !created) {
        customAlert('Gagal tambah soal: ' + (error?.message || ''), true);
        return;
      }
      soalId = created.id;
    }

    if (soalId) {
      if (kunciTeks) {
        const { error: errKunci } = await supabase
          .from('soal_ujian_kunci')
          .upsert({
            soal_id: soalId,
            kunci_jawaban: kunciTeks,
            pembahasan: pembahasan.trim() || null,
          });

        if (errKunci) {
          customAlert('Soal tersimpan, tapi kunci gagal disimpan: ' + errKunci.message, true);
        }
      } else {
        // Kunci dikosongkan guru -> hapus baris kunci lama bila ada.
        await supabase.from('soal_ujian_kunci').delete().eq('soal_id', soalId);
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

  const bukaModalImport = async () => {
    setShowImportModal(true);
    setSumberUjianId('');
    setSoalSumber([]);
    setSoalDipilih([]);
    setLoadingUjianLain(true);

    const { data } = await supabase
      .from('ujian')
      .select('id, jenis, deskripsi, created_at, kelas(nama)')
      .neq('id', ujianId)
      .order('created_at', { ascending: false });

    if (data) setUjianLainList(data);
    setLoadingUjianLain(false);
  };

  const pilihSumberUjian = async (id: string) => {
    setSumberUjianId(id);
    setSoalDipilih([]);
    setSoalSumber([]);
    if (!id) return;

    setLoadingSoalSumber(true);
    const { data } = await supabase
      .from('soal_ujian')
      .select('id, pertanyaan, tipe, opsi, butuh_foto_jawaban')
      .eq('ujian_id', id)
      .order('created_at', { ascending: true });

    if (data) setSoalSumber(data);
    setLoadingSoalSumber(false);
  };

  const togglePilihSoal = (id: string) => {
    setSoalDipilih(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleImportSoal = async () => {
    if (soalDipilih.length === 0) {
      customAlert('Pilih minimal satu soal untuk diambil.', true);
      return;
    }

    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ujian/import-soal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ target_ujian_id: ujianId, soal_ids: soalDipilih }),
      });
      const data = await res.json();

      if (!res.ok) {
        customAlert(data.error || 'Gagal mengambil soal.', true);
        setImporting(false);
        return;
      }

      setShowImportModal(false);
      fetchData();
      customAlert(`${data.jumlah} soal berhasil diambil.`, false);
    } catch (err: any) {
      customAlert('Gagal mengambil soal: ' + (err?.message || err), true);
    }
    setImporting(false);
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href="/guru/ujian" className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <h2 style={{ margin: 0 }}>Kelola Soal Ujian</h2>
        </div>
        <div className="d-flex gap-2">
          <Link href={`/guru/ujian/${ujianId}/hasil`} className="btn btn-outline">Hasil Ujian</Link>
          <button onClick={bukaModalImport} className="btn btn-outline">⤓ Ambil Soal dari Ujian Lain</button>
          <button onClick={bukaModalTambah} className="btn btn-primary">+ Tambah Soal</button>
        </div>
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
            {soalList.map((s, idx) => {
              const kunci = ambilKunci(s);
              return (
                <div key={s.id} className="card card-body p-3" style={{ border: '1px solid var(--slate-200)', boxShadow: 'none' }}>
                  <div className="d-flex justify-between">
                    <div style={{ flex: 1 }}>
                      <h5 className="mb-2">
                        Soal {idx + 1}
                        <span className={`badge ${s.tipe === 'pg' ? 'badge-primary' : 'badge-secondary'} text-sm`} style={{ marginLeft: '8px' }}>
                          {s.tipe === 'pg' ? 'Pilgan' : 'Esai'}
                        </span>
                      </h5>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{s.pertanyaan}</p>

                      {s.tipe === 'pg' && Array.isArray(s.opsi) && (
                        <div className="mb-2">
                          {s.opsi.map((opt: string, i: number) => {
                            let kunciTeks: string[] = [];
                            try { kunciTeks = kunci ? JSON.parse(kunci.kunci_jawaban) : []; } catch { kunciTeks = []; }
                            const isKunci = kunciTeks.includes(opt);
                            return (
                              <p key={i} className="mb-1 text-sm" style={{ color: isKunci ? 'var(--success)' : undefined, fontWeight: isKunci ? 700 : 400 }}>
                                {String.fromCharCode(65 + i)}. {opt} {isKunci && '✓'}
                              </p>
                            );
                          })}
                        </div>
                      )}

                      {s.tipe === 'pg' && !kunci && (
                        <span className="badge badge-warning text-sm">Kunci belum diatur</span>
                      )}
                      {s.tipe === 'uraian' && !kunci && (
                        <span className="badge badge-warning text-sm">Kunci/rubrik belum diisi</span>
                      )}
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
              );
            })}
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
                  <label>Tipe Soal</label>
                  <select
                    className="form-control"
                    value={tipeSoal}
                    onChange={e => setTipeSoal(e.target.value as 'pg' | 'uraian')}
                  >
                    <option value="pg">Pilihan Ganda</option>
                    <option value="uraian">Esai / Uraian</option>
                  </select>
                </div>

                <div className="form-group mt-3">
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

                {tipeSoal === 'pg' ? (
                  <div className="form-group mt-3">
                    <label className="d-flex justify-between align-center mb-2">
                      <span>Opsi Pilihan Ganda</span>
                      <button type="button" className="btn btn-sm btn-outline" onClick={tambahOpsiPG}>+ Tambah Opsi</button>
                    </label>
                    <p className="text-sm text-muted mb-2">Centang opsi yang benar. Centang lebih dari satu untuk soal multi-jawaban.</p>
                    <div className="d-flex flex-column gap-2">
                      {opsiPG.map((opt, idx) => (
                        <div key={idx} className="d-flex gap-2 align-center">
                          <input
                            type="checkbox"
                            checked={kunciPG.includes(idx)}
                            onChange={() => toggleKunciPG(idx)}
                            title="Tandai sebagai jawaban benar"
                            style={{ transform: 'scale(1.2)' }}
                          />
                          <span className="font-bold">{String.fromCharCode(65 + idx)}.</span>
                          <input
                            type="text"
                            className="form-control"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...opsiPG];
                              newOpts[idx] = e.target.value;
                              setOpsiPG(newOpts);
                            }}
                            placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                          />
                          {opsiPG.length > 2 && (
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => hapusOpsiPG(idx)}>Hapus</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="form-group mt-3">
                    <label>Kunci Jawaban / Rubrik Esai (acuan penilaian AI)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={kunciUraian}
                      onChange={e => setKunciUraian(e.target.value)}
                      placeholder="Tulis langkah pengerjaan / poin yang diharapkan..."
                    />
                  </div>
                )}

                <div className="form-group mt-3">
                  <label>Pembahasan (opsional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={pembahasan}
                    onChange={e => setPembahasan(e.target.value)}
                    placeholder="Catatan pembahasan untuk guru..."
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
                  {/* Sengaja tidak `disabled` — kalau nonaktif, guru tidak tahu apa yang kurang.
                      Validasi & pesannya ditangani handleSimpanSoal. */}
                  <button type="submit" className="btn btn-primary">Simpan Soal</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Ambil Soal dari Ujian Lain</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowImportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Sumber Ujian</label>
                <select
                  className="form-control"
                  value={sumberUjianId}
                  onChange={e => pilihSumberUjian(e.target.value)}
                  disabled={loadingUjianLain}
                >
                  <option value="">{loadingUjianLain ? 'Memuat...' : 'Pilih ujian...'}</option>
                  {ujianLainList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.kelas?.nama ? `${u.kelas.nama} — ` : ''}{u.jenis}{u.deskripsi ? ` — ${u.deskripsi}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {sumberUjianId && (
                <div className="mt-3">
                  {loadingSoalSumber ? (
                    <p className="text-center my-4">Memuat soal...</p>
                  ) : soalSumber.length === 0 ? (
                    <p className="text-muted text-center my-4">Ujian ini belum punya soal.</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted mb-2">
                        Pilih soal yang ingin diambil. Soal dikopi ke ujian ini dan bisa diedit bebas —
                        soal aslinya tidak berubah.
                      </p>
                      <div className="d-flex flex-column gap-2" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                        {soalSumber.map((s, idx) => (
                          <label
                            key={s.id}
                            className="d-flex gap-2"
                            style={{
                              cursor: 'pointer',
                              padding: '0.75rem',
                              border: '1px solid var(--slate-200)',
                              borderRadius: 'var(--radius-md)',
                              background: soalDipilih.includes(s.id) ? 'var(--primary-light)' : 'var(--white)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={soalDipilih.includes(s.id)}
                              onChange={() => togglePilihSoal(s.id)}
                              style={{ transform: 'scale(1.2)', marginTop: '2px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <p className="mb-1">
                                <strong>Soal {idx + 1}</strong>
                                <span className={`badge ${s.tipe === 'pg' ? 'badge-primary' : 'badge-secondary'} text-sm`} style={{ marginLeft: '8px' }}>
                                  {s.tipe === 'pg' ? 'Pilgan' : 'Esai'}
                                </span>
                              </p>
                              <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{s.pertanyaan}</p>
                              {s.tipe === 'pg' && Array.isArray(s.opsi) && (
                                <p className="text-sm text-muted mb-0">
                                  {s.opsi.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`).join('   ')}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="d-flex justify-between mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Batal</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleImportSoal}
                  disabled={importing || soalDipilih.length === 0}
                >
                  {importing ? 'Menyalin...' : `Tambahkan ${soalDipilih.length} Soal Terpilih`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
