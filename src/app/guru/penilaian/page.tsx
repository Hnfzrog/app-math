'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { uploadFile, fileUrl } from '@/lib/uploadClient';
import { generateKopPdf } from '@/lib/pdf';
import Link from 'next/link';
import { badgeStatusUjian, labelStatusUjian, statusUjian } from '@/lib/jadwalUjian';
import { judulBab } from '@/lib/judulBab';
import { hitungRataRata } from '@/lib/nilai';

// Komponen penilaian per bab (revisi 6 Okt 2026).
type KomponenKey = 'lkpd' | 'tugas' | 'uh' | 'keaktifan';
const KOMPONEN_LABEL: Record<KomponenKey, string> = {
  lkpd: 'LKPD',
  tugas: 'Tugas',
  uh: 'UH',
  keaktifan: 'Keaktifan',
};

type NilaiRow = {
  id: string;
  siswa_id: string;
  nilai_lkpd: number | null;
  nilai_tugas: number | null;
  nilai_uh: number | null;
  nilai_keaktifan: number | null;
  nilai_akhir: number | null;
  umpan_balik: string | null;
  umpan_balik_file_url: string | null;
};
type Siswa = { id: string; nama: string; nisn: string };
type JawabanItem = { id: string; no?: number; pertanyaan?: string; jawaban?: string; jawaban_teks?: string; skor_ai?: number | null; file_url?: string | null; tipe?: string };

export default function GuruPenilaian() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  const [kelasList, setKelasList] = useState<any[]>([]);
  const [babList, setBabList] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState<string>('');
  const [filterBab, setFilterBab] = useState<string>('');
  const [tampilan, setTampilan] = useState<'menyeluruh' | 'bab' | 'ujian'>('bab');

  const [siswaList, setSiswaList] = useState<Siswa[]>([]);

  // Per bab
  const [nilaiMap, setNilaiMap] = useState<Record<string, NilaiRow>>({});
  const [komponen, setKomponen] = useState({ lkpd: false, tugas: false, uh: false });
  const [keaktifanAuto, setKeaktifanAuto] = useState<Record<string, number>>({});
  const [draftKeaktifan, setDraftKeaktifan] = useState<Record<string, string>>({});

  // Menyeluruh
  const [menyeluruhMatrix, setMenyeluruhMatrix] = useState<Record<string, { nama: string; nisn: string; bab: Record<string, number | null> }>>({});

  // Ujian UTS/UAS
  const [ujianList, setUjianList] = useState<any[]>([]);

  // Modal PENILAIAN per item (Opsi B)
  const [nilaiSiswa, setNilaiSiswa] = useState<Siswa | null>(null);
  const [nilaiKomponen, setNilaiKomponen] = useState<'lkpd' | 'tugas' | 'uh'>('lkpd');
  const [items, setItems] = useState<{ key: string; id: string; type: 'konten' | 'ujian'; label: string }[]>([]);
  const [itemKey, setItemKey] = useState('');
  const [itemSkor, setItemSkor] = useState<Record<string, string>>({});
  const [jawabanList, setJawabanList] = useState<JawabanItem[]>([]);
  const [loadingJawaban, setLoadingJawaban] = useState(false);
  const [savingSkor, setSavingSkor] = useState(false);

  // Modal FEEDBACK
  const [fbSiswa, setFbSiswa] = useState<Siswa | null>(null);
  const [fbText, setFbText] = useState('');
  const [fbFile, setFbFile] = useState<File | null>(null);
  const [fbLink, setFbLink] = useState('');
  const [fbExisting, setFbExisting] = useState<string>('');
  const [savingFb, setSavingFb] = useState(false);

  // Modal REMEDIAL (tugas/UH khusus siswa < 75)
  const [showRemedial, setShowRemedial] = useState(false);
  const [remedialItems, setRemedialItems] = useState<{ key: string; label: string; type: 'konten' | 'ujian'; id: string }[]>([]);
  const [remedialKey, setRemedialKey] = useState('');
  const [remedialSiswa, setRemedialSiswa] = useState<string[]>([]);
  const [savingRemedial, setSavingRemedial] = useState(false);

  useEffect(() => {
    if (userId) fetchKelas();
  }, [userId]);

  useEffect(() => {
    if (filterKelas) {
      fetchBabDanSiswa();
    } else {
      setBabList([]);
      setSiswaList([]);
      setNilaiMap({});
      setMenyeluruhMatrix({});
    }
  }, [filterKelas]);

  useEffect(() => {
    if (!filterKelas) return;
    if (tampilan === 'bab' && filterBab) fetchNilaiBab();
    else if (tampilan === 'menyeluruh') fetchMenyeluruh();
  }, [tampilan, filterBab, siswaList]);

  useEffect(() => {
    if (userId && tampilan === 'ujian') fetchUjian();
  }, [userId, tampilan, filterKelas]);

  const fetchKelas = async () => {
    const { data } = await supabase.from('guru_kelas').select('kelas(id, nama)').eq('guru_id', userId);
    if (data) setKelasList(data.map((gk) => gk.kelas).filter(Boolean));
    setLoading(false);
  };

  const fetchBabDanSiswa = async () => {
    setLoading(true);
    const { data: babs } = await supabase.from('bab').select('id, nomor, judul').eq('kelas_id', filterKelas).order('nomor');
    setBabList(babs || []);

    const { data: dataSiswa } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, users(nama, nisn)')
      .eq('kelas_id', filterKelas);
    if (dataSiswa) {
      setSiswaList(
        dataSiswa.map((s) => {
          // Relasi users bisa terinferensi sebagai array; ambil sebagai objek tunggal.
          const u = s.users as unknown as { nama?: string; nisn?: string } | null;
          return { id: s.siswa_id, nama: u?.nama || 'Unknown', nisn: u?.nisn || '-' };
        })
      );
    }
    setLoading(false);
  };

  // Ambil nilai per bab + komponen tersedia + keaktifan otomatis.
  const fetchNilaiBab = async () => {
    setLoading(true);
    const { data: nilaiRows } = await supabase
      .from('nilai')
      .select('id, siswa_id, nilai_lkpd, nilai_tugas, nilai_uh, nilai_keaktifan, nilai_akhir, umpan_balik, umpan_balik_file_url')
      .eq('bab_id', filterBab);

    const map: Record<string, NilaiRow> = {};
    (nilaiRows || []).forEach((n) => { map[n.siswa_id] = n as NilaiRow; });
    setNilaiMap(map);

    // Komponen yang tersedia di bab ini.
    const { data: konten } = await supabase.from('konten').select('tipe').eq('bab_id', filterBab);
    const tipe = (konten || []).map((k) => k.tipe);
    const { data: uh } = await supabase.from('ujian').select('id').eq('bab_id', filterBab).eq('jenis', 'UH').limit(1);
    setKomponen({
      lkpd: tipe.includes('lkpd'),
      tugas: tipe.includes('banksoal') || tipe.includes('evaluasi'),
      uh: (uh || []).length > 0,
    });

    // Keaktifan otomatis = persen presensi 'masuk'.
    if (siswaList.length > 0) {
      const ids = siswaList.map((s) => s.id);
      const { data: pres } = await supabase.from('presensi').select('siswa_id, status').in('siswa_id', ids);
      const agg: Record<string, { masuk: number; total: number }> = {};
      (pres || []).forEach((p) => {
        if (!agg[p.siswa_id]) agg[p.siswa_id] = { masuk: 0, total: 0 };
        agg[p.siswa_id].total += 1;
        if (p.status === 'masuk') agg[p.siswa_id].masuk += 1;
      });
      const auto: Record<string, number> = {};
      Object.entries(agg).forEach(([sid, v]) => {
        auto[sid] = v.total > 0 ? Math.round((v.masuk / v.total) * 100) : 0;
      });
      setKeaktifanAuto(auto);
    }
    setLoading(false);
  };

  const fetchMenyeluruh = async () => {
    const ids = siswaList.map((s) => s.id);
    if (ids.length === 0) { setMenyeluruhMatrix({}); return; }
    const { data } = await supabase.from('nilai').select('siswa_id, bab_id, nilai_akhir').in('siswa_id', ids);
    const matrix: Record<string, { nama: string; nisn: string; bab: Record<string, number | null> }> = {};
    siswaList.forEach((s) => { matrix[s.id] = { nama: s.nama, nisn: s.nisn, bab: {} }; });
    (data || []).forEach((n) => {
      if (matrix[n.siswa_id]) matrix[n.siswa_id].bab[n.bab_id] = n.nilai_akhir;
    });
    setMenyeluruhMatrix(matrix);
  };

  const fetchUjian = async () => {
    let q = supabase
      .from('ujian')
      .select('id, jenis, deskripsi, mulai_at, selesai_at, is_terbit, kelas(nama)')
      .eq('guru_id', userId)
      .neq('jenis', 'UH')
      .order('created_at', { ascending: false });
    if (filterKelas) q = q.eq('kelas_id', filterKelas);
    const { data } = await q;
    setUjianList(data || []);
  };

  // Simpan satu komponen nilai (upsert baris nilai siswa+bab).
  const simpanKomponen = async (siswaId: string, patch: Partial<NilaiRow>) => {
    const existing = nilaiMap[siswaId];
    if (existing?.id) {
      const { error } = await supabase.from('nilai').update(patch).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('nilai').insert({ siswa_id: siswaId, bab_id: filterBab, ...patch });
      if (error) throw error;
    }
  };

  // Rata-rata komponen — logika bersama di src/lib/nilai.ts (diuji unit-test).
  // DB trigger tetap menyimpan nilai_akhir; ini hanya untuk update UI segera.
  const hitungRataLokal = (row: Partial<NilaiRow>) => hitungRataRata(row);

  const bukaPenilaian = async (siswa: Siswa, komponenKey: 'lkpd' | 'tugas' | 'uh') => {
    setNilaiSiswa(siswa);
    setNilaiKomponen(komponenKey);
    setItems([]);
    setItemKey('');
    setJawabanList([]);
    setItemSkor({});
    setLoadingJawaban(true);

    // Daftar ITEM untuk komponen ini (semua tugas/LKPD/UH di bab).
    let daftar: { key: string; id: string; type: 'konten' | 'ujian'; label: string }[] = [];
    if (komponenKey === 'uh') {
      const { data } = await supabase.from('ujian').select('id, deskripsi').eq('bab_id', filterBab).eq('jenis', 'UH').order('created_at');
      daftar = (data || []).map((u) => ({ key: `ujian:${u.id}`, id: u.id, type: 'ujian' as const, label: `UH — ${u.deskripsi || 'Ujian'}` }));
    } else {
      const tipe = komponenKey === 'lkpd' ? ['lkpd'] : ['banksoal', 'evaluasi'];
      const { data } = await supabase.from('konten').select('id, judul').eq('bab_id', filterBab).in('tipe', tipe).order('created_at');
      daftar = (data || []).map((k) => ({ key: `konten:${k.id}`, id: k.id, type: 'konten' as const, label: k.judul }));
    }
    setItems(daftar);

    // Skor item yang sudah tersimpan
    const { data: existing } = await supabase.from('nilai_item').select('item_type, item_id, skor').eq('siswa_id', siswa.id);
    const sk: Record<string, string> = {};
    (existing || []).forEach((r) => { sk[`${r.item_type}:${r.item_id}`] = r.skor != null ? String(r.skor) : ''; });
    setItemSkor(sk);

    if (daftar.length > 0) await pilihItem(siswa, daftar[0]);
    setLoadingJawaban(false);
  };

  // Tampilkan SEMUA soal item terpilih (sub-item) + jawaban siswa + skor AI.
  const pilihItem = async (siswa: Siswa, item: { key: string; id: string; type: 'konten' | 'ujian' }) => {
    setItemKey(item.key);
    setLoadingJawaban(true);
    setJawabanList([]);

    if (item.type === 'ujian') {
      const { data: soals } = await supabase.from('soal_ujian').select('id, pertanyaan, tipe').eq('ujian_id', item.id).order('created_at');
      const ids = (soals || []).map((s) => s.id);
      const jwMap = new Map<string, any>();
      if (ids.length > 0) {
        const { data: jw } = await supabase.from('jawaban_ujian').select('*').eq('siswa_id', siswa.id).in('soal_id', ids);
        (jw || []).forEach((j) => jwMap.set(j.soal_id, j));
      }
      setJawabanList((soals || []).map((s, i) => {
        const j = jwMap.get(s.id);
        return { id: s.id, no: i + 1, pertanyaan: s.pertanyaan?.split('|||')[0] || '-', jawaban_teks: j?.jawaban_teks, skor_ai: j?.skor_ai, file_url: j?.foto_url, tipe: s.tipe };
      }));
    } else {
      const { data: soals } = await supabase.from('soal').select('id, pertanyaan, tipe').eq('konten_id', item.id).order('created_at');
      const ids = (soals || []).map((s) => s.id);
      const jwMap = new Map<string, any>();
      if (ids.length > 0) {
        const { data: jw } = await supabase.from('jawaban_siswa').select('*').eq('siswa_id', siswa.id).in('soal_id', ids);
        (jw || []).forEach((j) => jwMap.set(j.soal_id, j));
      }
      setJawabanList((soals || []).map((s, i) => {
        const j = jwMap.get(s.id);
        return { id: s.id, no: i + 1, pertanyaan: s.pertanyaan?.split('|||')[0] || '-', jawaban: j?.jawaban, skor_ai: j?.skor_ai, file_url: j?.file_url, tipe: s.tipe };
      }));
    }
    setLoadingJawaban(false);
  };

  // Simpan skor SATU item (ke nilai_item). Trigger DB menghitung rata-rata komponen.
  const simpanItem = async () => {
    if (!nilaiSiswa) return;
    const item = items.find((x) => x.key === itemKey);
    if (!item) return;
    const raw = (itemSkor[itemKey] ?? '').trim();
    const angka = parseFloat(raw);
    if (raw !== '' && (isNaN(angka) || angka < 0 || angka > 100)) {
      customAlert('Skor item harus angka 0–100.', true);
      return;
    }
    setSavingSkor(true);
    try {
      const { error } = await supabase.from('nilai_item').upsert({
        siswa_id: nilaiSiswa.id,
        item_type: item.type,
        item_id: item.id,
        skor: raw === '' ? null : angka,
        dinilai_at: new Date().toISOString(),
      }, { onConflict: 'siswa_id,item_type,item_id' });
      if (error) throw error;
      customAlert('Nilai item tersimpan.', false);
      fetchNilaiBab(); // komponen (rata-rata item) & rata-rata bab ikut ter-update
    } catch (e) {
      customAlert('Gagal menyimpan: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSavingSkor(false);
    }
  };

  const simpanKeaktifan = async (siswaId: string, value: string) => {
    const angka = parseFloat(value);
    if (isNaN(angka)) return;
    try {
      await simpanKomponen(siswaId, { nilai_keaktifan: angka });
      setNilaiMap((prev) => ({ ...prev, [siswaId]: { ...(prev[siswaId] || {}), nilai_keaktifan: angka } as NilaiRow }));
      fetchNilaiBab();
    } catch (e) {
      customAlert('Gagal menyimpan keaktifan: ' + (e instanceof Error ? e.message : String(e)), true);
    }
  };

  const bukaFeedback = (siswa: Siswa) => {
    const row = nilaiMap[siswa.id];
    setFbSiswa(siswa);
    setFbText(row?.umpan_balik || '');
    setFbExisting(row?.umpan_balik_file_url || '');
    setFbFile(null);
    setFbLink('');
  };

  const simpanFeedback = async () => {
    if (!fbSiswa) return;
    setSavingFb(true);
    try {
      let fileKey: string | null = fbExisting || null;
      if (fbFile) fileKey = await uploadFile(fbFile, 'umpan-balik');
      else if (fbLink) fileKey = fbLink;
      await simpanKomponen(fbSiswa.id, { umpan_balik: fbText, umpan_balik_file_url: fileKey });
      customAlert('Feedback tersimpan.', false);
      setFbSiswa(null);
      fetchNilaiBab();
    } catch (e) {
      customAlert('Gagal menyimpan feedback: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSavingFb(false);
    }
  };

  const bukaRemedial = async () => {
    // Kandidat remedial: konten tugas (banksoal/evaluasi) + ujian UH di bab ini.
    const { data: konten } = await supabase.from('konten').select('id, judul, tipe').eq('bab_id', filterBab).in('tipe', ['banksoal', 'evaluasi']);
    const { data: ujian } = await supabase.from('ujian').select('id, deskripsi').eq('bab_id', filterBab).eq('jenis', 'UH');
    const items = [
      ...(konten || []).map((k) => ({ key: `konten:${k.id}`, label: `Tugas — ${k.judul}`, type: 'konten' as const, id: k.id })),
      ...(ujian || []).map((u) => ({ key: `ujian:${u.id}`, label: `UH — ${u.deskripsi || 'Ujian'}`, type: 'ujian' as const, id: u.id })),
    ];
    setRemedialItems(items);
    setRemedialKey('');
    setRemedialSiswa([]);
    setShowRemedial(true);
  };

  const pilihRemedialItem = async (key: string) => {
    setRemedialKey(key);
    const item = remedialItems.find((i) => i.key === key);
    if (!item) { setRemedialSiswa([]); return; }
    const { data } = await supabase.from('remedial_target').select('siswa_id').eq('item_type', item.type).eq('item_id', item.id);
    setRemedialSiswa((data || []).map((r) => r.siswa_id));
  };

  const toggleRemedialSiswa = (id: string) => {
    setRemedialSiswa((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const simpanRemedial = async () => {
    const item = remedialItems.find((i) => i.key === remedialKey);
    if (!item) { customAlert('Pilih item remedial dulu.', true); return; }
    setSavingRemedial(true);
    try {
      const tandai = { is_remedial: remedialSiswa.length > 0 };
      const { error: e1 } = item.type === 'konten'
        ? await supabase.from('konten').update(tandai).eq('id', item.id)
        : await supabase.from('ujian').update(tandai).eq('id', item.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('remedial_target').delete().eq('item_type', item.type).eq('item_id', item.id);
      if (e2) throw e2;

      if (remedialSiswa.length > 0) {
        const { error: e3 } = await supabase.from('remedial_target').insert(
          remedialSiswa.map((sid) => ({ item_type: item.type, item_id: item.id, siswa_id: sid }))
        );
        if (e3) throw e3;
      }
      customAlert('Remedial tersimpan.', false);
      setShowRemedial(false);
    } catch (e) {
      customAlert('Gagal menyimpan remedial: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSavingRemedial(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filterKelas) return;
    const kelasNama = kelasList.find((k) => k.id === filterKelas)?.nama || '';

    if (tampilan === 'menyeluruh') {
      const columns = ['No', 'Nama Siswa', ...babList.map((b) => `Bab ${b.nomor}`), 'Rata-rata'];
      const rows = siswaList.map((s, i) => {
        const row = menyeluruhMatrix[s.id] || { bab: {} };
        const vals = babList.map((b) => row.bab[b.id]).filter((v) => v != null).map(Number);
        const rata = vals.length > 0 ? (vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(2) : '-';
        return [i + 1, s.nama, ...babList.map((b) => (row.bab[b.id] != null ? Number(row.bab[b.id]).toFixed(2) : '-')), rata];
      });
      await generateKopPdf({ title: `Daftar Nilai Menyeluruh Kelas ${kelasNama}`, columns, rows, filename: 'nilai-menyeluruh.pdf' });
    } else if (tampilan === 'bab') {
      const babNama = babList.find((b) => b.id === filterBab)?.judul || '';
      const komponenCols: string[] = [];
      if (komponen.lkpd) komponenCols.push('LKPD');
      if (komponen.tugas) komponenCols.push('Tugas');
      if (komponen.uh) komponenCols.push('UH');
      komponenCols.push('Keaktifan');
      const columns = ['No', 'Nama Siswa', ...komponenCols, 'Rata-rata'];
      const rows = siswaList.map((s, i) => {
        const row = nilaiMap[s.id] || ({} as NilaiRow);
        return [
          i + 1,
          s.nama,
          ...komponenCols.map((c) => {
            const key = c === 'LKPD' ? 'nilai_lkpd' : c === 'Tugas' ? 'nilai_tugas' : c === 'UH' ? 'nilai_uh' : 'nilai_keaktifan';
            const v = row[key as keyof NilaiRow];
            return v != null ? Number(v).toFixed(2) : '-';
          }),
          row.nilai_akhir != null ? Number(row.nilai_akhir).toFixed(2) : '-',
        ];
      });
      await generateKopPdf({ title: `Penilaian ${babNama} — Kelas ${kelasNama}`, columns, rows, filename: 'penilaian-bab.pdf' });
    }
  };

  if (userLoading) return <div className="p-4 text-center">Loading...</div>;

  const komponenKeys: ('lkpd' | 'tugas' | 'uh')[] = [];
  if (komponen.lkpd) komponenKeys.push('lkpd');
  if (komponen.tugas) komponenKeys.push('tugas');
  if (komponen.uh) komponenKeys.push('uh');

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Penilaian & Evaluasi</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Nilai per bab dari komponen yang tersedia (LKPD/Tugas/UH) + Keaktifan. Rata-rata = rata-rata sederhana komponen terisi.
          </p>
        </div>
        <button onClick={handleExportPDF} className="btn btn-primary" disabled={!filterKelas}>Export PDF</button>
      </div>

      <div className="card card-body mb-4 hide-on-print">
        <div className="grid-2 align-center">
          <div className="form-group mb-0">
            <label>Pilih Kelas</label>
            <select className="form-control" value={filterKelas} onChange={(e) => { setFilterKelas(e.target.value); setFilterBab(''); }}>
              <option value="">-- Pilih Kelas --</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label>Tampilan</label>
            <select className="form-control" value={tampilan} onChange={(e) => setTampilan(e.target.value as 'menyeluruh' | 'bab' | 'ujian')}>
              <option value="bab">Penilaian per Bab</option>
              <option value="menyeluruh">Tabel Menyeluruh (Semua Bab)</option>
              <option value="ujian">Ujian (UTS/UAS)</option>
            </select>
          </div>
        </div>

        {tampilan === 'bab' && (
          <div className="form-group mt-3 mb-0">
            <label>Pilih Bab</label>
            <select className="form-control" value={filterBab} onChange={(e) => setFilterBab(e.target.value)}>
              <option value="">-- Pilih Bab --</option>
              {babList.map((b) => <option key={b.id} value={b.id}>{judulBab(b.nomor, b.judul)}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center my-4">Memuat data...</p>
      ) : !filterKelas ? (
        <p className="text-center text-muted my-4 card card-body">Silakan pilih kelas terlebih dahulu.</p>
      ) : siswaList.length === 0 ? (
        <p className="text-center text-muted my-4 card card-body">Belum ada siswa di kelas ini.</p>
      ) : tampilan === 'menyeluruh' ? (
        <div className="card card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Siswa (NISN)</th>
                  {babList.map((b) => <th key={b.id}>{judulBab(b.nomor, b.judul)}</th>)}
                  <th>Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((s, idx) => {
                  const row = menyeluruhMatrix[s.id] || { bab: {} };
                  const vals = babList.map((b) => row.bab[b.id]).filter((v) => v !== undefined && v !== null).map(Number);
                  const rata = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                  return (
                    <tr key={s.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{s.nama}</strong><br /><small className="text-muted">{s.nisn}</small></td>
                      {babList.map((b) => (
                        <td key={b.id}>{row.bab[b.id] !== undefined && row.bab[b.id] !== null ? Number(row.bab[b.id]).toFixed(2) : '-'}</td>
                      ))}
                      <td><strong>{rata !== null ? rata.toFixed(2) : '-'}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tampilan === 'ujian' ? (
        <div className="card card-body">
          <h4 className="mb-3">Ujian UTS / UAS</h4>
          <p className="text-muted">Validasi hasil ujian UTS/UAS di sini. UH sudah otomatis masuk ke nilai per-bab.</p>
          {ujianList.length === 0 ? (
            <p className="text-center text-muted my-4">Belum ada ujian UTS/UAS.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Kelas</th><th>Jenis</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {ujianList.map((u) => {
                    const st = statusUjian(u);
                    return (
                      <tr key={u.id}>
                        <td>{u.kelas?.nama}</td>
                        <td>{u.jenis}</td>
                        <td>{u.deskripsi}</td>
                        <td><span className={`badge ${badgeStatusUjian(st)}`}>{labelStatusUjian(st)}</span></td>
                        <td><Link href={`/guru/ujian/${u.id}/hasil`} className="btn btn-sm btn-outline">Penilaian</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Tampilan per bab (komponen)
        !filterBab ? (
          <p className="text-center text-muted my-4 card card-body">Silakan pilih bab terlebih dahulu.</p>
        ) : (
          <div className="card card-body">
            <div className="d-flex justify-between align-center mb-3 hide-on-print">
              <h4 className="mb-0">Penilaian Bab</h4>
              <button type="button" className="btn btn-sm btn-outline" onClick={bukaRemedial}>Kelola Remedial</button>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Siswa</th>
                    {komponen.lkpd && <th>{KOMPONEN_LABEL.lkpd}</th>}
                    {komponen.tugas && <th>{KOMPONEN_LABEL.tugas}</th>}
                    {komponen.uh && <th>{KOMPONEN_LABEL.uh}</th>}
                    <th>{KOMPONEN_LABEL.keaktifan}</th>
                    <th>Rata-rata</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {siswaList.map((s, idx) => {
                    const row = nilaiMap[s.id] || ({} as NilaiRow);
                    const auto = keaktifanAuto[s.id];
                    const keaktifanVal: number | '' = row.nilai_keaktifan ?? (typeof auto === 'number' ? auto : '');
                    const rata = row.nilai_akhir != null ? Number(row.nilai_akhir) : hitungRataLokal(row);
                    return (
                      <tr key={s.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{s.nama}</strong><br /><small className="text-muted">{s.nisn}</small></td>
                        {komponen.lkpd && <td>{row.nilai_lkpd != null ? Number(row.nilai_lkpd).toFixed(2) : '-'}</td>}
                        {komponen.tugas && <td>{row.nilai_tugas != null ? Number(row.nilai_tugas).toFixed(2) : '-'}</td>}
                        {komponen.uh && <td>{row.nilai_uh != null ? Number(row.nilai_uh).toFixed(2) : '-'}</td>}
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: '80px' }}
                            value={draftKeaktifan[s.id] ?? (keaktifanVal === '' ? '' : String(keaktifanVal))}
                            onChange={(e) => setDraftKeaktifan((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            onBlur={(e) => { const v = e.target.value.trim(); if (v !== '' && String(keaktifanVal) !== v) simpanKeaktifan(s.id, v); }}
                          />
                          {typeof auto === 'number' && row.nilai_keaktifan == null && (
                            <small className="text-muted">auto: {auto}%</small>
                          )}
                        </td>
                        <td>
                          <strong className={rata == null ? '' : rata >= 75 ? 'text-success' : 'text-danger'}>
                            {rata != null ? Number(rata).toFixed(2) : '-'}
                          </strong>
                          {rata != null && rata < 75 && <div><span className="badge badge-warning">Remedial</span></div>}
                        </td>
                        <td>
                          <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                            {komponenKeys.map((k) => (
                              <button
                                key={k}
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => bukaPenilaian(s, k)}
                              >
                                Penilaian {KOMPONEN_LABEL[k]}
                              </button>
                            ))}
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => bukaFeedback(s)}>Feedback</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {komponenKeys.length === 0 && (
              <p className="text-muted text-center mt-3 mb-0">Bab ini belum punya komponen LKPD/Tugas/UH. Keaktifan tetap bisa diisi.</p>
            )}
          </div>
        )
      )}

      {/* Modal PENILAIAN — jawaban siswa (kiri) + panel guru (kanan) */}
      {nilaiSiswa && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Penilaian {KOMPONEN_LABEL[nilaiKomponen]} — {nilaiSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setNilaiSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Pemilih item (tugas/LKPD/UH) */}
              <div className="form-group">
                <label>Pilih Item ({KOMPONEN_LABEL[nilaiKomponen]})</label>
                <select
                  className="form-control"
                  value={itemKey}
                  onChange={(e) => { const it = items.find((x) => x.key === e.target.value); if (it && nilaiSiswa) pilihItem(nilaiSiswa, it); }}
                >
                  {items.length === 0 && <option value="">(belum ada item)</option>}
                  {items.map((it) => (
                    <option key={it.key} value={it.key}>
                      {it.label}{itemSkor[it.key] ? ` — ${itemSkor[it.key]}` : ' — belum dinilai'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-item: semua soal item terpilih + jawaban siswa + skor AI */}
              {loadingJawaban ? (
                <p className="text-muted">Memuat soal...</p>
              ) : jawabanList.length === 0 ? (
                <p className="text-muted">Item ini belum punya soal.</p>
              ) : (
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '46vh', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: 8, padding: 8 }}>
                  {jawabanList.map((j) => {
                    const jawab = j.jawaban ?? j.jawaban_teks;
                    return (
                      <div key={j.id} className="p-2 border rounded">
                        <p className="mb-1"><strong>Soal {j.no}:</strong> {j.pertanyaan}</p>
                        <p className="mb-1" style={{ whiteSpace: 'pre-wrap', color: jawab ? undefined : '#94a3b8' }}>
                          Jawaban: {jawab || '(belum dijawab)'}
                        </p>
                        {j.skor_ai != null && <span className="badge badge-info">Skor AI: {j.skor_ai}</span>}
                        {j.file_url && <a href={fileUrl(j.file_url)!} target="_blank" rel="noopener noreferrer" className="text-primary" style={{ marginLeft: 8 }}>📎 Lampiran</a>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Panel nilai ITEM — komponen = rata-rata item */}
              <div className="grid-2 mt-3 align-center">
                <div className="form-group mb-0">
                  <label>Skor item ini (0–100)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={0}
                    max={100}
                    disabled={!itemKey}
                    value={itemSkor[itemKey] ?? ''}
                    onChange={(e) => setItemSkor((p) => ({ ...p, [itemKey]: e.target.value }))}
                  />
                  <small className="text-muted">Nilai {KOMPONEN_LABEL[nilaiKomponen]} di tabel = rata-rata item yang dinilai (otomatis).</small>
                </div>
                <div className="text-right">
                  <button type="button" className="btn btn-primary" onClick={simpanItem} disabled={savingSkor || !itemKey}>
                    {savingSkor ? 'Menyimpan...' : 'Simpan Item Ini'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => setNilaiSiswa(null)}>Tutup</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal FEEDBACK */}
      {fbSiswa && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>Feedback — {fbSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setFbSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Umpan Balik</label>
                <textarea className="form-control" rows={4} value={fbText} onChange={(e) => setFbText(e.target.value)} placeholder="Contoh: Tingkatkan lagi belajarnya..." />
              </div>
              <div className="form-group">
                <label>File Perbaikan (opsional)</label>
                {fbExisting && (
                  <div className="d-flex align-center gap-2 mb-2">
                    <a href={fileUrl(fbExisting)!} target="_blank" rel="noopener noreferrer" className="text-primary">📎 Lihat File Perbaikan</a>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setFbExisting('')}>Hapus</button>
                  </div>
                )}
                <input type="file" className="form-control" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setFbFile(e.target.files?.[0] || null)} />
                <label style={{ fontSize: '13px', display: 'block', marginTop: '8px' }}>atau link Google Drive (file besar)</label>
                <input type="url" className="form-control" placeholder="https://drive.google.com/..." value={fbLink} onChange={(e) => setFbLink(e.target.value)} />
              </div>
              <div className="d-flex justify-between mt-3">
                <button type="button" className="btn btn-secondary" onClick={() => setFbSiswa(null)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={simpanFeedback} disabled={savingFb}>
                  {savingFb ? 'Menyimpan...' : 'Simpan Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal REMEDIAL */}
      {showRemedial && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h3>Kelola Remedial</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowRemedial(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: '13px' }}>
                Tandai tugas/UH sebagai remedial dan pilih siswa yang boleh mengerjakannya (biasanya rata-rata &lt; 75).
              </p>
              <div className="form-group">
                <label>Item Remedial</label>
                <select className="form-control" value={remedialKey} onChange={(e) => pilihRemedialItem(e.target.value)}>
                  <option value="">-- Pilih Tugas/UH --</option>
                  {remedialItems.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
                {remedialItems.length === 0 && <small className="text-muted">Belum ada tugas/UH di bab ini.</small>}
              </div>
              {remedialKey && (
                <div className="form-group">
                  <label>Pilih Siswa (rata-rata &lt; 75 ditandai)</label>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: '8px', padding: '8px' }}>
                    {siswaList.map((s) => {
                      const row = nilaiMap[s.id];
                      const rata = row?.nilai_akhir != null ? Number(row.nilai_akhir) : hitungRataLokal(row || {});
                      const perluRemedial = rata != null && rata < 75;
                      return (
                        <label key={s.id} className="d-flex align-center gap-2" style={{ padding: '4px 0', cursor: 'pointer' }}>
                          <input type="checkbox" checked={remedialSiswa.includes(s.id)} onChange={() => toggleRemedialSiswa(s.id)} />
                          <span>{s.nama}</span>
                          {rata != null && (
                            <span className={`badge ${perluRemedial ? 'badge-warning' : 'badge-success'}`}>{Number(rata).toFixed(1)}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="d-flex justify-between mt-3">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRemedial(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={simpanRemedial} disabled={savingRemedial || !remedialKey}>
                  {savingRemedial ? 'Menyimpan...' : 'Simpan Remedial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles for print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .hide-on-print { display: none !important; }
          .print-only { display: block !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 2rem !important; }
          .table th { background-color: #f1f5f9 !important; color: #0f172a !important; }
          body { background: white; }
          @page { margin: 1cm; }
        }
      ` }} />
    </div>
  );
}
