'use client';
import { useState, use, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import PhotoUpload from '@/components/PhotoUpload';
import { uploadFile, fileUrl } from '@/lib/uploadClient';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { judulBab } from '@/lib/judulBab';
import Link from 'next/link';

export default function GuruKelasDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const kelasId = unwrappedParams.id;
  const { userId } = useCurrentUser();
  
  const [realKelasId, setRealKelasId] = useState<string | null>(kelasId);
  const [kelasNama, setKelasNama] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'materi' | 'siswa' | 'forum'>('materi');

  const [babs, setBabs] = useState<any[]>([]);
  const [materi, setMateri] = useState<Record<string, any[]>>({});
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [forumBabId, setForumBabId] = useState('');
  const [forumMessages, setForumMessages] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [activeBabId, setActiveBabId] = useState<string | null>(null);
  const [formTipe, setFormTipe] = useState('emateri');
  const [formJudul, setFormJudul] = useState('');
  const [formLinks, setFormLinks] = useState<string[]>(['']);
  const addLink = () => setFormLinks(prev => [...prev, '']);
  const removeLink = (i: number) => setFormLinks(prev => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) => setFormLinks(prev => prev.map((l, idx) => (idx === i ? val : l)));
  const [formDeadline, setFormDeadline] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [confirmDeleteMateriId, setConfirmDeleteMateriId] = useState<string | null>(null);
  const [confirmDeleteBabId, setConfirmDeleteBabId] = useState<string | null>(null);
  const [confirmDeleteSoalIdx, setConfirmDeleteSoalIdx] = useState<number | null>(null);
  
  const [showAddBabModal, setShowAddBabModal] = useState(false);
  const [newBabJudul, setNewBabJudul] = useState('');
  const [newBabSemester, setNewBabSemester] = useState<'ganjil' | 'genap'>('ganjil');
  
  // State form kuis
  const [soalList, setSoalList] = useState<any[]>([]);
  const [tipeSoal, setTipeSoal] = useState('pg');
  const [pertanyaan, setPertanyaan] = useState('');
  const [kunciUraian, setKunciUraian] = useState('');
  const [opsiPG, setOpsiPG] = useState(['', '', '', '']);
  const [kunciPG, setKunciPG] = useState<number[]>([0]);
  const [butuhUpload, setButuhUpload] = useState(false);
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);
  const [lampiranLink, setLampiranLink] = useState('');
  // Pembahasan tugas/LKPD (D3)
  const [formPembahasanFile, setFormPembahasanFile] = useState<File | null>(null);
  const [formPembahasanTerbit, setFormPembahasanTerbit] = useState(false);

  useEffect(() => {
    fetchDataKelas();
  }, [kelasId]);

  const fetchDataKelas = async () => {
    setLoading(true);
    setRealKelasId(kelasId);
    
    // Fetch nama kelas
    const { data: dataKelas } = await supabase.from('kelas').select('nama').eq('id', kelasId).single();
    if (dataKelas) setKelasNama(dataKelas.nama);
    
    // Fetch data Bab
    const { data: babsData } = await supabase.from('bab').select('*').eq('kelas_id', kelasId).order('nomor', { ascending: true });
    if (babsData) setBabs(babsData);

    // Fetch data Konten untuk tiap bab
    const materiMap: Record<string, any[]> = {};
    if (babsData) {
      for (const bab of babsData) {
        const { data: dataKonten } = await supabase.from('konten').select('*').eq('bab_id', bab.id).order('created_at');
        materiMap[bab.id] = dataKonten || [];
      }
    }
    setMateri(materiMap);

    // Fetch daftar siswa
    const { data: siswaData } = await supabase
      .from('siswa_kelas')
      .select('users(id, nama, email, nisn, nomor_hp)')
      .eq('kelas_id', kelasId);
    
    if (siswaData) {
      // @ts-ignore
      setSiswaList(siswaData.map(s => s.users).filter(Boolean));
    }

    setLoading(false);
  };

  const fetchForum = async (babId: string) => {
    const { data } = await supabase.from('forum_belajar').select('*, users:user_id(nama, role)').eq('bab_id', babId).order('created_at');
    setForumMessages(data || []);
  };

  useEffect(() => {
    if (activeTab === 'forum' && forumBabId) {
      fetchForum(forumBabId);
    }
  }, [activeTab, forumBabId]);

  // Realtime forum: tambah/edit/hapus langsung tampil tanpa refresh.
  useEffect(() => {
    if (activeTab !== 'forum' || !forumBabId) return;
    const channel = supabase.channel('guru-forum-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_belajar', filter: `bab_id=eq.${forumBabId}` }, () => {
        fetchForum(forumBabId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab, forumBabId]);

  const kirimPost = async (parentId: string | null = null) => {
    const teks = parentId ? replyText : newPost;
    if (!teks.trim() || !forumBabId || !userId) return;
    const { error } = await supabase.from('forum_belajar').insert({ bab_id: forumBabId, user_id: userId, pesan: teks.trim(), parent_id: parentId });
    if (error) { customAlert('Gagal kirim: ' + error.message, true); return; }
    if (parentId) { setReplyTo(null); setReplyText(''); }
    else setNewPost('');
    fetchForum(forumBabId);
  };

  const editPost = async (id: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase.from('forum_belajar').update({ pesan: editText.trim(), edited_at: new Date().toISOString() }).eq('id', id);
    if (error) customAlert('Gagal edit: ' + error.message, true);
    setEditingId(null);
    setEditText('');
    fetchForum(forumBabId);
  };

  const hapusPost = async (id: string) => {
    const { error } = await supabase.from('forum_belajar').update({ is_deleted: true }).eq('id', id);
    if (error) customAlert('Gagal hapus: ' + error.message, true);
    fetchForum(forumBabId);
  };

  const renderForumBubble = (m: any, isReply: boolean) => {
    const own = m.user_id === userId;
    if (m.is_deleted) {
      return (
        <div className="p-2 border rounded" style={{ background: 'var(--slate-50)', marginLeft: isReply ? '18px' : 0, color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
          (pesan dihapus)
        </div>
      );
    }
    return (
      <div className="p-2 border rounded" style={{ background: own ? '#e0f2fe' : 'var(--slate-50)', marginLeft: isReply ? '18px' : 0 }}>
        <div className="d-flex justify-between align-center mb-1" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13px' }}>
            {m.users?.nama || 'Pengguna'}{' '}
            <span className="badge badge-info" style={{ fontSize: '10px' }}>{m.users?.role}</span>
          </strong>
          <small className="text-muted">
            {new Date(m.created_at).toLocaleString('id-ID')}
            {m.edited_at && ' · diedit'}
          </small>
        </div>
        {editingId === m.id ? (
          <div className="d-flex gap-2 mt-1">
            <input type="text" className="form-control form-control-sm" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && editPost(m.id)} autoFocus />
            <button className="btn btn-sm btn-primary" onClick={() => editPost(m.id)} disabled={!editText.trim()}>Simpan</button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingId(null)}>Batal</button>
          </div>
        ) : (
          <p className="m-0" style={{ fontSize: '14px', wordBreak: 'break-word' }}>{m.pesan}</p>
        )}
        <div className="d-flex gap-2 mt-2" style={{ justifyContent: 'flex-end' }}>
          {!isReply && (
            <button className="btn btn-sm btn-outline" onClick={() => setReplyTo(replyTo === m.id ? null : m.id)}>Balas</button>
          )}
          {own && editingId !== m.id && (
            <button className="btn btn-sm btn-outline" onClick={() => { setEditingId(m.id); setEditText(m.pesan); }}>Edit</button>
          )}
          <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger, #dc3545)' }} onClick={() => hapusPost(m.id)}>Hapus</button>
        </div>
        {replyTo === m.id && (
          <div className="d-flex gap-2 mt-2">
            <input type="text" className="form-control" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Tulis balasan..." onKeyDown={e => { if (e.key === 'Enter') kirimPost(m.id); }} />
            <button className="btn btn-primary" onClick={() => kirimPost(m.id)} disabled={!replyText.trim()}>Balas</button>
          </div>
        )}
      </div>
    );
  };

  const handleTambahBab = () => {
    setNewBabJudul('');
    setNewBabSemester('ganjil');
    setShowAddBabModal(true);
  };

  const executeTambahBab = async (e: any) => {
    e.preventDefault();
    if (newBabJudul.trim() && realKelasId) {
      await supabase.from('bab').insert({
        kelas_id: realKelasId,
        nomor: babs.length + 1,
        judul: newBabJudul.trim(),
        semester: newBabSemester
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
    setFormLinks(['']);
    setFormDeadline('');
    setSoalList([]);
    setFormPembahasanFile(null);
    setFormPembahasanTerbit(false);
    setShowModal(true);
  };

  const bukaModalEdit = async (materiId: string, babId: string) => {
    setEditModeId(materiId);
    setActiveBabId(babId);
    const m = materi[babId].find(x => x.id === materiId);
    if (m) {
      setFormTipe(m.tipe);
      setFormJudul(m.judul);
      setFormLinks(m.file_url ? m.file_url.split('\n').filter(Boolean) : ['']);
      setFormDeadline(m.deadline ? m.deadline.slice(0, 16) : '');
      setFormPembahasanFile(null);
      setFormPembahasanTerbit(!!m.pembahasan_is_terbit);
      
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
      kunci_jawaban: tipeSoal === 'pg' ? JSON.stringify(kunciPG.map(idx => opsiPG[idx])) : kunciUraian,
      butuh_upload: butuhUpload,
      lampiran_file: lampiranFile,
      lampiran_link: lampiranLink
    };
    setSoalList([...soalList, soalBaru]);
    setPertanyaan('');
    setKunciUraian('');
    setOpsiPG(['', '', '', '']);
    setKunciPG([0]);
    setButuhUpload(false);
    setLampiranFile(null);
    setLampiranLink('');
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
      if (!formLinks.some(l => l.trim()) && !formFile) return false;
    } else {
      if (soalList.length === 0) return false;
      if (pertanyaan.trim().length > 0) return false;
    }
    
    return true;
  };

  const handleSimpanKontenFinal = async (e: any) => {
    e.preventDefault();
    if (!activeBabId || !formJudul) return;
    
    if (formTipe !== 'emateri' && soalList.length === 0) {
      if (pertanyaan.trim().length > 0) {
        customAlert('Kamu belum menyimpan soal yang sedang diketik! Klik "Simpan Soal ke Daftar" terlebih dahulu.', true);
      } else {
        customAlert('Modul evaluasi/kuis minimal harus punya 1 soal! Tambahkan soal ke daftar terlebih dahulu.', true);
      }
      return;
    }
    
    let fileUrl: string | null = formLinks.filter(l => l.trim()).join('\n') || null;
    if (formTipe === 'emateri' && formFile) {
      try {
        fileUrl = await uploadFile(formFile, 'materi');
      } catch (e: any) {
        customAlert('Gagal upload file materi: ' + (e?.message || e), true);
        return;
      }
    }

    // Pembahasan tugas/LKPD (opsional)
    let pembahasanUrl: string | null = null;
    if (formPembahasanFile) {
      try {
        pembahasanUrl = await uploadFile(formPembahasanFile, 'pembahasan');
      } catch (e: any) {
        customAlert('Gagal upload pembahasan: ' + (e?.message || e), true);
        return;
      }
    }

    let kontenIdToUse = editModeId;

    if (editModeId) {
      const { error: errKonten } = await supabase.from('konten').update({
        tipe: formTipe,
        judul: formJudul,
        file_url: fileUrl,
        deadline: formDeadline ? new Date(formDeadline).toISOString() : null,
        pembahasan_is_terbit: formPembahasanTerbit,
        ...(pembahasanUrl ? { pembahasan_file_url: pembahasanUrl } : {})
      }).eq('id', editModeId);

      if (errKonten) {
        customAlert('Gagal mengupdate konten!', true);
        return;
      }
    } else {
      const { data: newKonten, error: errKonten } = await supabase.from('konten').insert({
        bab_id: activeBabId,
        tipe: formTipe,
        judul: formJudul,
        file_url: fileUrl,
        deadline: formDeadline ? new Date(formDeadline).toISOString() : null,
        pembahasan_file_url: pembahasanUrl,
        pembahasan_is_terbit: formPembahasanTerbit
      }).select().single();

      if (errKonten || !newKonten) {
        customAlert('Gagal menyimpan konten!', true);
        return;
      }
      kontenIdToUse = newKonten.id;
    }

    if (kontenIdToUse && formTipe !== 'emateri') {
      // Upload lampiran soal (jika guru memilih file baru)
      const soalDenganLampiran: any[] = [];
      for (const s of soalList) {
        let lampiranUrl = s.lampiran_url || s.lampiran_link || null;
        if (s.lampiran_file) {
          try {
            lampiranUrl = await uploadFile(s.lampiran_file, 'soal');
          } catch (e: any) {
            customAlert('Gagal upload lampiran soal: ' + (e?.message || e), true);
            return;
          }
        }
        soalDenganLampiran.push({ ...s, lampiran_url: lampiranUrl });
      }

      const soalBaru = soalDenganLampiran.filter(s => !s.id).map(s => ({
        konten_id: kontenIdToUse,
        pertanyaan: s.pertanyaan,
        tipe: s.tipe,
        kunci_jawaban: s.kunci_jawaban,
        butuh_upload: !!s.butuh_upload,
        lampiran_url: s.lampiran_url || null
      }));

      const soalLama = soalDenganLampiran.filter(s => s.id).map(s => ({
        id: s.id,
        konten_id: kontenIdToUse,
        pertanyaan: s.pertanyaan,
        tipe: s.tipe,
        kunci_jawaban: s.kunci_jawaban,
        butuh_upload: !!s.butuh_upload,
        lampiran_url: s.lampiran_url || null
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
    setFormLinks(['']);
    setFormDeadline('');
    setFormFile(null);
    setSoalList([]);
    fetchDataKelas();
  };

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4">
        <div className="d-flex align-center gap-2">
          <Link href="/guru/kelas" className="btn btn-outline" style={{ padding: '0.5rem' }}>←</Link>
          <h2 style={{ margin: 0 }}>Ruang Kelas - {kelasNama || '...'}</h2>
        </div>
        {activeTab === 'materi' && (
          <button onClick={handleTambahBab} disabled={!realKelasId} className="btn btn-primary">+ Tambah Topik (Bab)</button>
        )}
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'materi' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('materi')}
        >
          Materi & Tugas (ATP)
        </button>
        <button
          className={`btn ${activeTab === 'siswa' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('siswa')}
        >
          Daftar Siswa
        </button>
        <button
          className={`btn ${activeTab === 'forum' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('forum')}
        >
          💬 Forum Belajar
        </button>
      </div>
      
      {loading ? (
        <p className="text-center mt-4">Loading data...</p>
      ) : activeTab === 'materi' ? (
        <>
          {babs.length === 0 ? (
            <p className="text-center text-muted p-4 border rounded bg-light">Belum ada topik (bab) di kelas ini. Klik "Tambah Topik" untuk memulai.</p>
          ) : babs.map((bab, index) => (
            <div key={bab.id} className="card card-body mb-4">
              <div className="d-flex justify-between align-center mb-3">
                <h3 className="text-primary">
                  <span className="badge badge-info mr-2">{index + 1}</span>
                  {judulBab(null, bab.judul)}
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
                          {m.file_url && <a href={fileUrl(m.file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">Lampiran</a>}
                          {m.deadline && <span className="text-sm text-danger">⏰ {new Date(m.deadline).toLocaleString('id-ID')}</span>}
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
        </>
      ) : activeTab === 'siswa' ? (
        <div className="card card-body">
          <h3 className="mb-4">Daftar Siswa Kelas {kelasNama}</h3>
          {siswaList.length === 0 ? (
            <p className="text-center text-muted">Belum ada siswa yang terdaftar di kelas ini.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Siswa</th>
                    <th>NISN</th>
                    <th>No. HP</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {siswaList.map((siswa, i) => (
                    <tr key={siswa.id}>
                      <td>{i + 1}</td>
                      <td><strong>{siswa.nama}</strong></td>
                      <td>{siswa.nisn || '-'}</td>
                      <td>{siswa.nomor_hp || '-'}</td>
                      <td>{siswa.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-body">
          <h3 className="mb-3">💬 Forum Belajar</h3>
          <p className="text-muted" style={{ fontSize: '13px' }}>Diskusi per bab. Guru juga bisa ikut berdiskusi dengan siswa.</p>
          <div className="form-group">
            <label>Pilih Bab</label>
            <select className="form-control" value={forumBabId} onChange={e => setForumBabId(e.target.value)}>
              <option value="">-- Pilih Bab --</option>
              {babs.map((b: any) => <option key={b.id} value={b.id}>{judulBab(b.nomor, b.judul)}</option>)}
            </select>
          </div>
          {forumBabId && (
            <>
              <div className="d-flex flex-column gap-2 mt-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {forumMessages.length === 0 ? (
                  <p className="text-muted text-center my-3">Belum ada diskusi di bab ini.</p>
                ) : (
                  forumMessages.filter((m: any) => !m.parent_id).map((m: any) => (
                    <div key={m.id} className="d-flex flex-column gap-2">
                      {renderForumBubble(m, false)}
                      {forumMessages.filter((r: any) => r.parent_id === m.id).map((r: any) => (
                        <div key={r.id} className="d-flex flex-column">
                          {renderForumBubble(r, true)}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
              <div className="d-flex gap-2 mt-3">
                <input
                  type="text"
                  className="form-control"
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="Tulis pesan untuk siswa..."
                  onKeyDown={e => { if (e.key === 'Enter') kirimPost(); }}
                />
                <button className="btn btn-primary" onClick={() => kirimPost()} disabled={!newPost.trim()}>Kirim</button>
              </div>
            </>
          )}
        </div>
      )}

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
                  <>
                    <div className="form-group">
                      <label>Link Materi (G-Drive / YouTube / web) — bisa lebih dari satu</label>
                      {formLinks.map((link, i) => (
                        <div key={i} className="d-flex gap-2 mt-2" style={{ alignItems: 'center' }}>
                          <input type="url" className="form-control" value={link} onChange={e => updateLink(i, e.target.value)} placeholder={`Link ${i + 1}: https://...`} />
                          {formLinks.length > 1 && (
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeLink(i)} style={{ flexShrink: 0 }}>✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="btn btn-sm btn-outline mt-2" onClick={addLink}>+ Tambah Link</button>
                    </div>
                    <div className="form-group">
                      <label>atau Upload File Materi (pdf/doc/ppt/gambar, maks 2MB)</label>
                      <PhotoUpload
                        value={null}
                        onFileChange={setFormFile}
                        accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        label="File Materi"
                      />
                    </div>
                  </>
                )}

                {formTipe !== 'emateri' && (
                  <div className="form-group">
                    <label>Deadline (Tanggal & Jam)</label>
                    <input type="datetime-local" className="form-control" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} />
                  </div>
                )}

                {formTipe !== 'emateri' && (
                  <div className="form-group">
                    <label>Pembahasan (opsional) — pdf/doc/gambar, maks 2MB</label>
                    <input type="file" className="form-control" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={e => setFormPembahasanFile(e.target.files?.[0] || null)} />
                    <label className="d-flex align-center gap-2 mt-2" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={formPembahasanTerbit} onChange={e => setFormPembahasanTerbit(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                      <span className="text-sm">Terbitkan pembahasan (tampil ke siswa)</span>
                    </label>
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

                    <div className="form-group mt-3">
                      <label className="d-flex align-center gap-2" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={butuhUpload}
                          onChange={e => setButuhUpload(e.target.checked)}
                          style={{ transform: 'scale(1.2)' }}
                        />
                        <span>Soal ini wajib upload jawaban (foto/dokumen, maks 2MB)</span>
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
                                <strong>Soal {idx+1}:</strong> {s.pertanyaan.split('|||')[0].substring(0, 30)}... <span className="badge badge-info">{s.tipe}</span>{s.butuh_upload && <span className="badge badge-warning" style={{ marginLeft: '6px' }}>Wajib Upload</span>}{(s.lampiran_url || s.lampiran_file || s.lampiran_link) && <span className="badge badge-primary" style={{ marginLeft: '6px' }}>Ada Lampiran</span>}
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
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    className="form-control"
                    value={newBabSemester}
                    onChange={(e) => setNewBabSemester(e.target.value as 'ganjil' | 'genap')}
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                  </select>
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
