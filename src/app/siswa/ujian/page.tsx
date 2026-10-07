'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { badgeStatusUjian, formatJadwal, labelStatusUjian, statusUjian } from '@/lib/jadwalUjian';

export default function SiswaUjianList() {
  const [loading, setLoading] = useState(true);
  const [ujianList, setUjianList] = useState<any[]>([]);
  const [selesai, setSelesai] = useState<Set<string>>(new Set());
  const [jumlahSoalMap, setJumlahSoalMap] = useState<Record<string, number>>({});
  const { userId, loading: userLoading } = useCurrentUser();

  useEffect(() => {
    if (userId) fetchUjian();
  }, [userId]);

  const fetchUjian = async () => {
    setLoading(true);
    // Siswa bisa terdaftar di >1 kelas → ambil semua (dulu .single() gagal bila >1,
    // membuat daftar ujian kosong/inkonsisten).
    const { data: siswaKelas } = await supabase
      .from('siswa_kelas')
      .select('kelas_id')
      .eq('siswa_id', userId);

    const kelasIds = (siswaKelas || []).map((k) => k.kelas_id);
    if (kelasIds.length === 0) {
      setLoading(false);
      return;
    }

    // Hanya ujian yang sudah diterbitkan guru — draf tidak ditampilkan sama sekali.
    const { data: ujianData } = await supabase
      .from('ujian')
      .select('*, users:guru_id(nama)')
      .in('kelas_id', kelasIds)
      .eq('is_terbit', true)
      .order('mulai_at', { ascending: false });

    // Sembunyikan ujian remedial kecuali siswa terdaftar di remedial_target.
    const { data: rt } = await supabase
      .from('remedial_target')
      .select('item_id')
      .eq('item_type', 'ujian')
      .eq('siswa_id', userId);
    const remedialDiizinkan = new Set((rt || []).map((r) => r.item_id));
    const list = (ujianData || []).filter((u) => !u.is_remedial || remedialDiizinkan.has(u.id));
    setUjianList(list);

    // Tandai ujian yang sudah dikerjakan supaya tombolnya jadi "Lihat Hasil"
    if (list.length > 0) {
      const { data: soalU } = await supabase
        .from('soal_ujian')
        .select('id, ujian_id')
        .in('ujian_id', list.map((u: any) => u.id));

      // Jumlah soal per ujian — ditampilkan di kartu daftar ujian.
      const jumlahMap: Record<string, number> = {};
      (soalU || []).forEach((s) => {
        jumlahMap[s.ujian_id] = (jumlahMap[s.ujian_id] || 0) + 1;
      });
      setJumlahSoalMap(jumlahMap);

      const soalIds = (soalU || []).map((s: any) => s.id);
      if (soalIds.length > 0) {
        const { data: jw } = await supabase
          .from('jawaban_ujian')
          .select('soal_id')
          .eq('siswa_id', userId)
          .in('soal_id', soalIds);

        const dijawab = new Set((jw || []).map((j: any) => j.soal_id));
        const ujianSelesai = new Set(
          (soalU || [])
            .filter((s: any) => dijawab.has(s.id))
            .map((s: any) => s.ujian_id)
        );
        setSelesai(ujianSelesai);
      }
    }

    setLoading(false);
  };

  if (userLoading || loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Daftar Ujian / Evaluasi</h2>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Ujian yang sudah dibuka guru untuk kelasmu.
        </p>
      </div>

      <div className="card card-body">
        {ujianList.length === 0 ? (
          <p className="text-center text-muted my-4">Belum ada ujian yang dibuka.</p>
        ) : (
          <div className="grid-2 gap-4">
            {ujianList.map(u => {
              const status = statusUjian(u);
              const sudahSelesai = selesai.has(u.id);
              const bisaMulai = status === 'buka' && !sudahSelesai;

              const labelTombol = sudahSelesai
                ? 'Lihat Hasil'
                : status === 'buka'
                  ? 'Mulai Ujian'
                  : status === 'belum'
                    ? 'Belum Dibuka'
                    : 'Sudah Ditutup';

              return (
                <div
                  key={u.id}
                  className="card"
                  style={{ padding: '1rem', border: '1px solid var(--slate-200)' }}
                >
                  <div className="d-flex justify-between align-center mb-2">
                    <span className={`badge ${u.jenis === 'UH' ? 'badge-primary' : 'badge-warning'}`}>{u.jenis}</span>
                    <span className={`badge ${badgeStatusUjian(status)}`}>{labelStatusUjian(status)}</span>
                  </div>

                  <h3 className="mb-1">{u.deskripsi || 'Ujian'}</h3>
                  <p className="text-muted mb-2" style={{ fontSize: '13px' }}>Guru: {u.users?.nama}</p>

                  <div className="exam-info-box" style={{ fontSize: '13px', marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 4px' }}><strong>Dibuka:</strong> {formatJadwal(u.mulai_at)}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Ditutup:</strong> {formatJadwal(u.selesai_at)}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Durasi:</strong> {u.durasi_menit} menit</p>
                    <p style={{ margin: 0 }}><strong>Jumlah Soal:</strong> {jumlahSoalMap[u.id] ?? u.jumlah_soal ?? '-'}</p>
                  </div>

                  {bisaMulai || sudahSelesai ? (
                    <Link
                      href={`/siswa/ujian/${u.id}`}
                      className={`btn ${sudahSelesai ? 'btn-outline' : 'btn-primary'} btn-block`}
                      style={{ textAlign: 'center' }}
                    >
                      {labelTombol}
                    </Link>
                  ) : (
                    <button className="btn btn-secondary btn-block" disabled>
                      {labelTombol}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
