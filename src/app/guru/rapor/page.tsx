'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { generateKopPdf } from '@/lib/pdf';
import { generateRaporPdf } from '@/lib/raporPdf';
import { judulBab } from '@/lib/judulBab';
import { rataRapor, labelSemester, hitungKetidakhadiran, nilaiHuruf } from '@/lib/rapor';

type Siswa = { id: string; nama: string; nisn: string; tahunAjaran: string; namaWali: string };
type Bab = { id: string; nomor: number; judul: string };
type Ketidakhadiran = { sakit: number; izin: number; tanpaKeterangan: number };

export default function GuruRapor() {
  const { userId, userName, loading: userLoading } = useCurrentUser();

  const [kelasList, setKelasList] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState('');
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil');

  const [babList, setBabList] = useState<Bab[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [nilaiPerSiswa, setNilaiPerSiswa] = useState<Record<string, Record<string, number | null>>>({});
  const [rataPerSiswa, setRataPerSiswa] = useState<Record<string, number | null>>({});
  const [ketidakhadiranMap, setKetidakhadiranMap] = useState<Record<string, Ketidakhadiran>>({});

  const [rapor, setRapor] = useState<any>(null);
  const [raporSiswaMap, setRaporSiswaMap] = useState<Record<string, any>>({});
  const [pengaturan, setPengaturan] = useState<{ namaSekolah: string; kopSurat: string; alamat: string; kkm: number }>({
    namaSekolah: 'SMP Matematika',
    kopSurat: '',
    alamat: '',
    kkm: 75,
  });

  // Init false: halaman harus langsung render pemilih kelas (fetchData baru jalan
  // setelah kelas dipilih — kalau init true, gate loading memblokir pemilihnya = deadlock).
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Modal Isi Deskripsi
  const [deskripsiSiswa, setDeskripsiSiswa] = useState<Siswa | null>(null);
  const [kpdList, setKpdList] = useState<{ kegiatan: string; deskripsi: string }[]>([]);
  const [akhlakList, setAkhlakList] = useState<{ deskripsi: string }[]>([]);
  const [catatan, setCatatan] = useState('');
  const [savingDeskripsi, setSavingDeskripsi] = useState(false);

  const fetchKelas = async () => {
    const { data } = await supabase.from('guru_kelas').select('kelas(id, nama)').eq('guru_id', userId);
    if (data) setKelasList(data.map((gk) => gk.kelas).filter(Boolean));
  };

  const ensureRapor = async (tahunAjaran: string) => {
    const { data: existing } = await supabase
      .from('rapor')
      .select('*')
      .eq('kelas_id', filterKelas)
      .eq('semester', semester)
      .maybeSingle();

    let raporRow = existing;
    if (!raporRow) {
      const { data: inserted } = await supabase
        .from('rapor')
        .insert({ kelas_id: filterKelas, semester, tahun_ajaran: tahunAjaran, is_terbit: false })
        .select()
        .single();
      raporRow = inserted;
    }
    setRapor(raporRow);

    if (raporRow?.id) {
      const { data: rs } = await supabase.from('rapor_siswa').select('*').eq('rapor_id', raporRow.id);
      const map: Record<string, any> = {};
      (rs || []).forEach((r) => { map[r.siswa_id] = r; });
      setRaporSiswaMap(map);
    } else {
      setRaporSiswaMap({});
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Bab semester ini
      const { data: babs } = await supabase
        .from('bab')
        .select('id, nomor, judul')
        .eq('kelas_id', filterKelas)
        .eq('semester', semester)
        .order('nomor');
      const babIds = (babs || []).map((b) => b.id);
      setBabList(babs || []);

      // Siswa kelas ini
      const { data: dataSiswa } = await supabase
        .from('siswa_kelas')
        .select('siswa_id, users(nama, nisn, tahun_ajaran, nama_wali)')
        .eq('kelas_id', filterKelas);
      const siswa: Siswa[] = (dataSiswa || []).map((s) => {
        const u = s.users as unknown as { nama?: string; nisn?: string; tahun_ajaran?: string; nama_wali?: string } | null;
        return {
          id: s.siswa_id,
          nama: u?.nama || 'Unknown',
          nisn: u?.nisn || '-',
          tahunAjaran: u?.tahun_ajaran || '',
          namaWali: u?.nama_wali || '',
        };
      });
      setSiswaList(siswa);
      const siswaIds = siswa.map((s) => s.id);

      // Nilai akhir per bab (semester ini)
      if (babIds.length > 0 && siswaIds.length > 0) {
        const { data: nilaiRows } = await supabase
          .from('nilai')
          .select('siswa_id, bab_id, nilai_akhir')
          .in('bab_id', babIds)
          .in('siswa_id', siswaIds);
        const perSiswa: Record<string, Record<string, number | null>> = {};
        siswa.forEach((s) => { perSiswa[s.id] = {}; });
        (nilaiRows || []).forEach((n) => {
          if (perSiswa[n.siswa_id]) perSiswa[n.siswa_id][n.bab_id] = n.nilai_akhir ?? null;
        });
        setNilaiPerSiswa(perSiswa);

        const rata: Record<string, number | null> = {};
        siswa.forEach((s) => {
          rata[s.id] = rataRapor(babIds.map((b) => perSiswa[s.id][b] ?? null));
        });
        setRataPerSiswa(rata);
      } else {
        setNilaiPerSiswa({});
        setRataPerSiswa({});
      }

      // Ketidakhadiran dari presensi (di-scope per semester lewat tanggal).
      if (siswaIds.length > 0) {
        const { data: pres } = await supabase.from('presensi').select('siswa_id, status, tanggal').in('siswa_id', siswaIds);
        const agg: Record<string, { status: string; tanggal?: string | null }[]> = {};
        siswa.forEach((s) => { agg[s.id] = []; });
        (pres || []).forEach((p) => { if (agg[p.siswa_id]) agg[p.siswa_id].push({ status: p.status, tanggal: p.tanggal }); });
        const map: Record<string, Ketidakhadiran> = {};
        siswa.forEach((s) => { map[s.id] = hitungKetidakhadiran(agg[s.id], semester); });
        setKetidakhadiranMap(map);
      } else {
        setKetidakhadiranMap({});
      }

      // Rapor (status terbit) untuk kelas+semester — buat draf bila belum ada.
      await ensureRapor(siswa[0]?.tahunAjaran || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchKelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (filterKelas) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKelas, semester]);

  useEffect(() => {
    const p = async () => {
      const { data } = await supabase.from('pengaturan').select('nama_sekolah, kop_surat, alamat, kkm').limit(1).single();
      if (data) setPengaturan({
        namaSekolah: data.nama_sekolah || 'SMP Matematika',
        kopSurat: data.kop_surat || '',
        alamat: data.alamat || '',
        kkm: data.kkm != null ? Number(data.kkm) : 75,
      });
    };
    p();
  }, []);

  const terbitkanRapor = async () => {
    if (!rapor) { customAlert('Rapor belum tersedia. Pilih kelas & semester dulu.', true); return; }
    setPublishing(true);
    try {
      const { error } = await supabase
        .from('rapor')
        .update({ is_terbit: true, terbit_at: new Date().toISOString() })
        .eq('id', rapor.id);
      if (error) throw error;
      setRapor((prev: any) => ({ ...prev, is_terbit: true }));
      customAlert(`Rapor kelas semester ${labelSemester(semester)} berhasil diterbitkan. Siswa sekarang bisa mengunduhnya.`, false);
    } catch (e) {
      customAlert('Gagal menerbitkan: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setPublishing(false);
    }
  };

  const buildPdfData = (siswa: Siswa) => {
    const rs = raporSiswaMap[siswa.id];
    const ket = ketidakhadiranMap[siswa.id] ?? { sakit: 0, izin: 0, tanpaKeterangan: 0 };
    const kelasNama = kelasList.find((k) => k.id === filterKelas)?.nama || '';
    const rata = rataPerSiswa[siswa.id] ?? null;
    return {
      namaSekolah: pengaturan.namaSekolah,
      kopSurat: pengaturan.kopSurat,
      alamat: pengaturan.alamat,
      siswa: {
        nama: siswa.nama,
        nisn: siswa.nisn,
        kelas: kelasNama,
        semester,
        tahunAjaran: siswa.tahunAjaran || rapor?.tahun_ajaran || '',
      },
      kkm: pengaturan.kkm,
      nilai: babList.map((b) => ({
        judul: judulBab(b.nomor, b.judul),
        nilaiAkhir: nilaiPerSiswa[siswa.id]?.[b.id] ?? null,
      })),
      kegiatanPengembangan: (rs?.kegiatan_pengembangan as { kegiatan: string; deskripsi: string }[]) || [],
      akhlakKepribadian: (rs?.akhlak_kepribadian as { deskripsi: string }[]) || [],
      ketidakhadiran: ket,
      catatanWaliKelas: rs?.catatan_wali_kelas || '',
      waliKelas: userName || 'Guru',
      namaWali: siswa.namaWali || '',
      rataRata: rata,
    };
  };

  const unduhRapor = async (siswa: Siswa) => {
    await generateRaporPdf(buildPdfData(siswa));
  };

  const bukaDeskripsi = (siswa: Siswa) => {
    const rs = raporSiswaMap[siswa.id];
    setDeskripsiSiswa(siswa);
    setKpdList((rs?.kegiatan_pengembangan as { kegiatan: string; deskripsi: string }[]) || []);
    setAkhlakList((rs?.akhlak_kepribadian as { deskripsi: string }[]) || []);
    setCatatan(rs?.catatan_wali_kelas || '');
  };

  const simpanDeskripsi = async () => {
    if (!deskripsiSiswa || !rapor?.id) return;
    setSavingDeskripsi(true);
    try {
      const { error } = await supabase.from('rapor_siswa').upsert(
        {
          rapor_id: rapor.id,
          siswa_id: deskripsiSiswa.id,
          kegiatan_pengembangan: kpdList,
          akhlak_kepribadian: akhlakList,
          catatan_wali_kelas: catatan,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'rapor_id,siswa_id' }
      );
      if (error) throw error;
      setRaporSiswaMap((prev) => ({
        ...prev,
        [deskripsiSiswa.id]: {
          ...(prev[deskripsiSiswa.id] || {}),
          kegiatan_pengembangan: kpdList,
          akhlak_kepribadian: akhlakList,
          catatan_wali_kelas: catatan,
        },
      }));
      customAlert('Deskripsi rapor tersimpan.', false);
      setDeskripsiSiswa(null);
    } catch (e) {
      customAlert('Gagal menyimpan deskripsi: ' + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setSavingDeskripsi(false);
    }
  };

  const exportRanking = async () => {
    const kelasNama = kelasList.find((k) => k.id === filterKelas)?.nama || '';
    const ranking = [...siswaList].sort((a, b) => {
      const ra = rataPerSiswa[a.id];
      const rb = rataPerSiswa[b.id];
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra;
    });
    const columns = ['No', 'Nama Siswa', 'Rata-rata', 'Nilai Huruf', 'Peringkat'];
    const rows = ranking.map((s, i) => [
      i + 1,
      s.nama,
      rataPerSiswa[s.id] != null ? Number(rataPerSiswa[s.id]).toFixed(2) : '-',
      nilaiHuruf(rataPerSiswa[s.id]) ?? '-',
      i + 1,
    ]);
    await generateKopPdf({
      title: `Perangkingan Kelas ${kelasNama} — Semester ${labelSemester(semester)}`,
      columns,
      rows,
      filename: 'perangkingan.pdf',
    });
  };

  if (userLoading || loading) return <div className="text-center mt-4">Loading data rapor...</div>;

  const ranking = [...siswaList].sort((a, b) => {
    const ra = rataPerSiswa[a.id];
    const rb = rataPerSiswa[b.id];
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return rb - ra;
  });

  const kelasNama = kelasList.find((k) => k.id === filterKelas)?.nama || '';

  return (
    <div>
      <div className="d-flex justify-between align-center mb-4 hide-on-print">
        <div>
          <h2 style={{ margin: 0 }}>Rapor & Perangkingan</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Cetak rapor per siswa, terbitkan untuk kelas, dan lihat perangkingan.
          </p>
        </div>
      </div>

      <div className="card card-body mb-4 hide-on-print">
        <div className="grid-2 align-center">
          <div className="form-group mb-0">
            <label>Pilih Kelas</label>
            <select className="form-control" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
              <option value="">-- Pilih Kelas --</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label>Semester</label>
            <select className="form-control" value={semester} onChange={(e) => setSemester(e.target.value as 'ganjil' | 'genap')}>
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </div>
        </div>

        {filterKelas && rapor && (
          <div className="d-flex align-center gap-3 mt-3" style={{ flexWrap: 'wrap' }}>
            {rapor.is_terbit ? (
              <span className="badge badge-success" style={{ fontSize: '14px' }}>Rapor sudah diterbitkan</span>
            ) : (
              <span className="badge badge-warning" style={{ fontSize: '14px' }}>Rapor belum diterbitkan</span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={terbitkanRapor}
              disabled={publishing || rapor.is_terbit}
            >
              {publishing ? 'Menerbitkan...' : rapor.is_terbit ? 'Sudah Terbit' : 'Terbitkan Rapor'}
            </button>
            <button type="button" className="btn btn-outline" onClick={exportRanking} disabled={siswaList.length === 0}>
              Export Perangkingan PDF
            </button>
          </div>
        )}
      </div>

      {!filterKelas ? (
        <p className="text-center text-muted my-4 card card-body">Silakan pilih kelas terlebih dahulu.</p>
      ) : siswaList.length === 0 ? (
        <p className="text-center text-muted my-4 card card-body">Belum ada siswa di kelas ini.</p>
      ) : (
        <>
          <div className="card card-body mb-4">
            <h4 className="mb-3">Daftar Siswa — Semester {labelSemester(semester)}</h4>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Siswa</th>
                    <th>Rata-rata</th>
                    <th>Nilai Huruf</th>
                    <th>Deskripsi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {siswaList.map((s, idx) => {
                    const rata = rataPerSiswa[s.id];
                    return (
                      <tr key={s.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{s.nama}</strong><br /><small className="text-muted">NISN: {s.nisn}</small></td>
                        <td><strong>{rata != null ? Number(rata).toFixed(2) : '-'}</strong></td>
                        <td>{nilaiHuruf(rata) ?? '-'}</td>
                        <td>
                          {raporSiswaMap[s.id] ? (
                            <span className="badge badge-success">Terisi</span>
                          ) : (
                            <span className="badge badge-secondary">Belum</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => bukaDeskripsi(s)}>Isi Deskripsi</button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => unduhRapor(s)}>Unduh Rapor</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-body">
            <h4 className="mb-3">Perangkingan Kelas {kelasNama}</h4>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Peringkat</th><th>Nama Siswa</th><th>Rata-rata</th><th>Nilai Huruf</th></tr>
                </thead>
                <tbody>
                  {ranking.map((s, idx) => (
                    <tr key={s.id}>
                      <td>{idx + 1}</td>
                      <td>{s.nama}</td>
                      <td>{rataPerSiswa[s.id] != null ? Number(rataPerSiswa[s.id]).toFixed(2) : '-'}</td>
                      <td>{nilaiHuruf(rataPerSiswa[s.id]) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Isi Deskripsi */}
      {deskripsiSiswa && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-dialog" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>Isi Deskripsi — {deskripsiSiswa.nama}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setDeskripsiSiswa(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Kegiatan Pengembangan Diri</label>
                {kpdList.map((k, i) => (
                  <div key={i} className="d-flex gap-2 mb-2">
                    <input className="form-control" placeholder="Kegiatan" value={k.kegiatan}
                      onChange={(e) => setKpdList((p) => p.map((x, j) => j === i ? { ...x, kegiatan: e.target.value } : x))} />
                    <input className="form-control" placeholder="Deskripsi" value={k.deskripsi}
                      onChange={(e) => setKpdList((p) => p.map((x, j) => j === i ? { ...x, deskripsi: e.target.value } : x))} />
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setKpdList((p) => p.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setKpdList((p) => [...p, { kegiatan: '', deskripsi: '' }])}>+ Tambah Kegiatan</button>
              </div>

              <div className="form-group">
                <label>Akhlak Mulia & Kepribadian</label>
                {akhlakList.map((a, i) => (
                  <div key={i} className="d-flex gap-2 mb-2">
                    <input className="form-control" placeholder="Deskripsi" value={a.deskripsi}
                      onChange={(e) => setAkhlakList((p) => p.map((x, j) => j === i ? { deskripsi: e.target.value } : x))} />
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setAkhlakList((p) => p.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setAkhlakList((p) => [...p, { deskripsi: '' }])}>+ Tambah Deskripsi</button>
              </div>

              <div className="form-group">
                <label>Catatan Wali Kelas</label>
                <textarea className="form-control" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan wali kelas..." />
              </div>

              <div className="d-flex justify-between mt-3">
                <button type="button" className="btn btn-secondary" onClick={() => setDeskripsiSiswa(null)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={simpanDeskripsi} disabled={savingDeskripsi}>
                  {savingDeskripsi ? 'Menyimpan...' : 'Simpan Deskripsi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .hide-on-print { display: none !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .table th { background-color: #f1f5f9 !important; color: #0f172a !important; }
          body { background: white; }
        }
      ` }} />
    </div>
  );
}
