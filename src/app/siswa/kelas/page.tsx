'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { judulBab } from '@/lib/judulBab';

// Hitung tahun ajaran otomatis berdasarkan bulan sekarang
function getTahunAjaran() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  if (month >= 7) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

export default function SiswaKelas() {
  const [loading, setLoading] = useState(true);
  const [kelasInfo, setKelasInfo] = useState<any>(null);
  const [guruKelas, setGuruKelas] = useState<any>(null);
  const [babs, setBabs] = useState<any[]>([]);
  const [cariBab, setCariBab] = useState('');
  const [teman, setTeman] = useState<any[]>([]);
  const [tugasPending, setTugasPending] = useState<{ id: string; judul: string; judulBab: string }[]>([]);
  
  // State Forum
  const [activeForum, setActiveForum] = useState<string | null>(null);
  const [forumMessages, setForumMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingForum, setSendingForum] = useState(false);
  // Balasan (satu level) + edit pesan sendiri
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const { userId: SISWA_ID, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (SISWA_ID) fetchKelas();
  }, [SISWA_ID]);

  // Subscribe to forum real-time updates
  useEffect(() => {
    if (!activeForum) return;

    fetchForum(activeForum);

    const channel = supabase.channel('forum-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_belajar', filter: `bab_id=eq.${activeForum}` }, () => {
        fetchForum(activeForum);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeForum]);

  const fetchKelas = async () => {
    if (!SISWA_ID) return;
    setLoading(true);

    const { data: siswaKelas } = await supabase
      .from('siswa_kelas')
      .select('kelas_id')
      .eq('siswa_id', SISWA_ID)
      .single();

    if (!siswaKelas) {
      setLoading(false);
      return;
    }

    const kelasId = siswaKelas.kelas_id;

    // Info kelas
    const { data: kelas } = await supabase.from('kelas').select('*').eq('id', kelasId).single();
    setKelasInfo(kelas);

    // Wali kelas
    const { data: guruKelasData } = await supabase.from('guru_kelas').select('guru_id').eq('kelas_id', kelasId).limit(1).single();
    if (guruKelasData) {
      const { data: guru } = await supabase.from('users').select('nama, email, nomor_hp').eq('id', guruKelasData.guru_id).single();
      setGuruKelas(guru);
    }

    // Bab
    const { data: babData } = await supabase.from('bab').select('*, konten(count)').eq('kelas_id', kelasId).order('nomor');
    setBabs(babData || []);

    // Pengingat: tugas/kuis (LKPD/bank soal/evaluasi) yang BELUM dikerjakan siswa.
    const babIds = (babData || []).map((b) => b.id);
    if (babIds.length > 0) {
      const { data: konten } = await supabase
        .from('konten')
        .select('id, judul, tipe, bab_id')
        .in('bab_id', babIds)
        .in('tipe', ['lkpd', 'banksoal', 'evaluasi']);
      const kontenList = konten || [];
      if (kontenList.length > 0) {
        const { data: soals } = await supabase.from('soal').select('id, konten_id').in('konten_id', kontenList.map((k) => k.id));
        const soalIds = (soals || []).map((s) => s.id);
        const answered = new Set<string>();
        if (soalIds.length > 0) {
          const { data: jw } = await supabase.from('jawaban_siswa').select('soal_id').eq('siswa_id', SISWA_ID).in('soal_id', soalIds);
          (jw || []).forEach((j) => answered.add(j.soal_id));
        }
        const doneKonten = new Set<string>();
        (soals || []).forEach((s) => { if (answered.has(s.id)) doneKonten.add(s.konten_id); });
        setTugasPending(
          kontenList
            .filter((k) => !doneKonten.has(k.id))
            .map((k) => {
              const bab = (babData || []).find((b) => b.id === k.bab_id);
              return { id: k.id, judul: k.judul, judulBab: bab ? judulBab(bab.nomor, bab.judul) : '' };
            })
        );
      }
    }

    // Teman sekelas
    const { data: temanData } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users:siswa_id(nama, nisn)')
      .eq('kelas_id', kelasId)
      .neq('siswa_id', SISWA_ID);
    setTeman(temanData || []);

    setLoading(false);
  };

  const fetchForum = async (babId: string) => {
    const { data } = await supabase
      .from('forum_belajar')
      .select('*, users:user_id(nama, role)')
      .eq('bab_id', babId)
      .order('created_at', { ascending: true });
    setForumMessages(data || []);
  };

  const kirimPesanForum = async (parentId: string | null = null) => {
    const teks = parentId ? replyText : newMessage;
    if (!activeForum || !teks.trim()) return;
    setSendingForum(true);

    const { error } = await supabase.from('forum_belajar').insert({
      bab_id: activeForum,
      user_id: SISWA_ID,
      pesan: teks.trim(),
      parent_id: parentId,
    });
    if (error) customAlert('Gagal kirim pesan: ' + error.message, true);

    if (parentId) { setReplyTo(null); setReplyText(''); }
    else setNewMessage('');
    setSendingForum(false);
    // Realtime akan re-fetch otomatis, tp jaga-jaga fetch lagi
    fetchForum(activeForum);
  };

  const editPesanForum = async (id: string) => {
    if (!activeForum || !editText.trim()) return;
    const { error } = await supabase.from('forum_belajar').update({
      pesan: editText.trim(),
      edited_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) customAlert('Gagal edit pesan: ' + error.message, true);
    setEditingId(null);
    setEditText('');
    fetchForum(activeForum);
  };

  const hapusPesanForum = async (id: string) => {
    if (!activeForum) return;
    const { error } = await supabase.from('forum_belajar').update({ is_deleted: true }).eq('id', id);
    if (error) customAlert('Gagal hapus pesan: ' + error.message, true);
    fetchForum(activeForum);
  };

  const renderForumBubble = (msg: any, isReply: boolean) => {
    const own = msg.user_id === SISWA_ID;
    if (msg.is_deleted) {
      return (
        <div style={{ marginLeft: isReply ? '18px' : 0, padding: '8px', borderRadius: '8px', border: '1px dashed #e2e8f0', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
          (pesan dihapus)
        </div>
      );
    }
    return (
      <div style={{ background: own ? '#e0f2fe' : 'white', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', marginLeft: isReply ? '18px' : 0, alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '90%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {msg.users?.nama || 'Anonim'}
          {msg.users?.role === 'guru' && <span className="badge badge-info" style={{ fontSize: '10px' }}>Guru</span>}
          <span style={{ fontWeight: 'normal' }}>• {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          {msg.edited_at && <span style={{ fontWeight: 'normal', fontStyle: 'italic' }}>(diedit)</span>}
        </div>
        {editingId === msg.id ? (
          <div className="d-flex gap-2 mt-1">
            <input type="text" className="form-control form-control-sm" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && editPesanForum(msg.id)} autoFocus />
            <button className="btn btn-sm btn-primary" onClick={() => editPesanForum(msg.id)} disabled={!editText.trim()}>Simpan</button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingId(null)}>Batal</button>
          </div>
        ) : (
          <div style={{ wordBreak: 'break-word' }}>{msg.pesan}</div>
        )}
        <div className="d-flex gap-2 mt-1" style={{ justifyContent: 'flex-end' }}>
          {!isReply && (
            <button className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setReplyTo(replyTo === msg.id ? null : msg.id)}>Balas</button>
          )}
          {own && editingId !== msg.id && (
            <>
              <button className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => { setEditingId(msg.id); setEditText(msg.pesan); }}>Edit</button>
              <button className="btn btn-sm btn-outline" style={{ fontSize: '11px', color: 'var(--danger, #dc3545)' }} onClick={() => hapusPesanForum(msg.id)}>Hapus</button>
            </>
          )}
        </div>
        {replyTo === msg.id && (
          <div className="d-flex gap-2 mt-2">
            <input type="text" className="form-control form-control-sm" placeholder="Tulis balasan..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && kirimPesanForum(msg.id)} />
            <button className="btn btn-sm btn-primary" onClick={() => kirimPesanForum(msg.id)} disabled={sendingForum || !replyText.trim()}>Balas</button>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center mt-4">Loading data kelas...</div>;
  if (userLoading) return <div className="text-center mt-4">Loading user...</div>;

  if (!kelasInfo) return (
    <div className="card card-body">
      <p className="text-muted text-center">Kamu belum terdaftar di kelas manapun.</p>
    </div>
  );

  return (
    <div>
      {/* Info Kelas Card */}
      <div className="card card-body mb-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px'
          }}>🏫</div>
          <div>
            <h2 style={{ margin: 0 }}>Informasi Kelas {kelasInfo.nama}</h2>
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>Tahun Ajaran {getTahunAjaran()}</p>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--slate-200)', margin: '0 0 16px' }} />

        <div className="grid-2" style={{ gap: '12px' }}>
          <div>
            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Tingkat Kelas</span>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>Kelas {kelasInfo.nama} SMP</p>
          </div>
          <div>
            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Wali Kelas / Guru Pengajar</span>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas?.nama || '-'}</p>
          </div>
          {guruKelas?.nomor_hp && (
            <div>
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Kontak Guru</span>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas.nomor_hp}</p>
            </div>
          )}
          {guruKelas?.email && (
            <div>
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Email Guru</span>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{guruKelas.email}</p>
            </div>
          )}
        </div>
      </div>

      {tugasPending.length > 0 && (
        <div className="card card-body mb-4" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3 className="mb-3" style={{ fontSize: '16px' }}>📌 Tugas/Kuis Perlu Dikerjakan ({tugasPending.length})</h3>
          <ul className="notif-list">
            {tugasPending.map((t) => (
              <li key={t.id} className="notif-item d-flex justify-between align-center">
                <div>
                  <strong>{t.judul}</strong>
                  <div className="text-muted" style={{ fontSize: '12px' }}>{t.judulBab}</div>
                </div>
                <Link href="/siswa/tugas" className="btn btn-sm btn-primary">Kerjakan</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid-2">
        {/* Daftar Bab / Kurikulum */}
        <div className="card">
          <div className="card-header"><h3>Kurikulum &amp; Bab Pembelajaran</h3></div>
          <div className="card-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="🔍 Cari bab..."
              value={cariBab}
              onChange={e => setCariBab(e.target.value)}
            />
            {babs.length === 0 ? (
              <p className="text-muted">Belum ada bab yang dibuat guru.</p>
            ) : (
              <ul className="notif-list">
                {babs
                  .filter(b => b.judul.toLowerCase().includes(cariBab.toLowerCase()) || `bab ${b.nomor}`.toLowerCase().includes(cariBab.toLowerCase()))
                  .map(bab => (
                  <li key={bab.id} className="notif-item" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: '6px' }}>
                      <strong>{judulBab(bab.nomor, bab.judul)}</strong>
                      <div className="d-flex gap-2">
                        <Link href="/siswa/materi" className="btn btn-sm btn-outline">Materi</Link>
                        <button 
                          onClick={() => setActiveForum(activeForum === bab.id ? null : bab.id)} 
                          className="btn btn-sm btn-outline text-primary border-primary"
                        >
                          Diskusi
                        </button>
                      </div>
                    </div>
                    
                    {activeForum === bab.id && (
                      <div className="mt-3 p-3 bg-slate-50 border rounded" style={{ fontSize: '14px' }}>
                        <h4 className="mb-2" style={{ fontSize: '14px' }}>Forum Diskusi (Bab {bab.nomor})</h4>
                        <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {forumMessages.length === 0 ? (
                            <p className="text-muted text-sm m-0">Belum ada pesan di forum ini. Jadilah yang pertama!</p>
                          ) : (
                            forumMessages.filter((m: any) => !m.parent_id).map((msg: any) => (
                              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {renderForumBubble(msg, false)}
                                {forumMessages.filter((r: any) => r.parent_id === msg.id).map((r: any) => (
                                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                    {renderForumBubble(r, true)}
                                  </div>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="d-flex gap-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Tulis pesan..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && kirimPesanForum()}
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => kirimPesanForum()} disabled={sendingForum || !newMessage.trim()}>Kirim</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Teman Sekelas */}
        <div className="card" style={{ height: 'max-content' }}>
          <div className="card-header"><h3>Teman Sekelas</h3></div>
          <div className="card-body">
            {teman.length === 0 ? (
              <p className="text-muted">Belum ada siswa lain di kelas ini.</p>
            ) : (
              <ul className="notif-list">
                {teman.map((t: any) => (
                  <li key={t.siswa_id} className="notif-item" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'var(--slate-200)', color: 'var(--slate-700)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, flexShrink: 0
                    }}>
                      {(t.users?.nama || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{t.users?.nama || '-'}</strong>
                      <div className="text-muted" style={{ fontSize: '11px' }}>NISN: {t.users?.nisn || '-'}</div>
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
