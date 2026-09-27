-- ==========================================
-- APPMATH RLS POLICIES — strict per-role access
-- ==========================================
-- Jalankan SETELAH schema (V2/V3). Idempotent (DROP IF EXISTS).
-- Role: admin = full, guru = kelola kelasnya, siswa = data sendiri.

-- ---- HELPERS ----
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_guru_kelas(_kelas_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = _kelas_id);
$$;

-- ==========================================
-- USERS
-- ==========================================
DROP POLICY IF EXISTS "admin full users" ON public.users;
CREATE POLICY "admin full users" ON public.users FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ==========================================
-- KELAS
-- ==========================================
DROP POLICY IF EXISTS "kelas read" ON public.kelas;
CREATE POLICY "kelas read" ON public.kelas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full kelas" ON public.kelas;
CREATE POLICY "admin full kelas" ON public.kelas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==========================================
-- SISWA_KELAS / GURU_KELAS
-- ==========================================
DROP POLICY IF EXISTS "siswa_kelas read" ON public.siswa_kelas;
CREATE POLICY "siswa_kelas read" ON public.siswa_kelas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full siswa_kelas" ON public.siswa_kelas;
CREATE POLICY "admin full siswa_kelas" ON public.siswa_kelas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "guru_kelas read" ON public.guru_kelas;
CREATE POLICY "guru_kelas read" ON public.guru_kelas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full guru_kelas" ON public.guru_kelas;
CREATE POLICY "admin full guru_kelas" ON public.guru_kelas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==========================================
-- BAB
-- ==========================================
DROP POLICY IF EXISTS "bab read" ON public.bab;
CREATE POLICY "bab read" ON public.bab FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full bab" ON public.bab;
CREATE POLICY "admin full bab" ON public.bab FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage bab" ON public.bab;
CREATE POLICY "guru manage bab" ON public.bab FOR ALL TO authenticated
  USING (is_guru_kelas(bab.kelas_id)) WITH CHECK (is_guru_kelas(bab.kelas_id));

-- ==========================================
-- KONTEN
-- ==========================================
DROP POLICY IF EXISTS "konten read" ON public.konten;
CREATE POLICY "konten read" ON public.konten FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full konten" ON public.konten;
CREATE POLICY "admin full konten" ON public.konten FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage konten" ON public.konten;
CREATE POLICY "guru manage konten" ON public.konten FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bab b JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = konten.bab_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bab b JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = konten.bab_id AND gk.guru_id = auth.uid()));

-- ==========================================
-- SOAL
-- ==========================================
DROP POLICY IF EXISTS "soal read" ON public.soal;
CREATE POLICY "soal read" ON public.soal FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full soal" ON public.soal;
CREATE POLICY "admin full soal" ON public.soal FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage soal" ON public.soal;
CREATE POLICY "guru manage soal" ON public.soal FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM konten k JOIN bab b ON b.id = k.bab_id JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE k.id = soal.konten_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM konten k JOIN bab b ON b.id = k.bab_id JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE k.id = soal.konten_id AND gk.guru_id = auth.uid()));

-- ==========================================
-- JAWABAN_SISWA
-- ==========================================
DROP POLICY IF EXISTS "admin full jawaban_siswa" ON public.jawaban_siswa;
CREATE POLICY "admin full jawaban_siswa" ON public.jawaban_siswa FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "siswa insert own jawaban_siswa" ON public.jawaban_siswa;
CREATE POLICY "siswa insert own jawaban_siswa" ON public.jawaban_siswa FOR INSERT TO authenticated WITH CHECK (siswa_id = auth.uid());
DROP POLICY IF EXISTS "siswa read own jawaban_siswa" ON public.jawaban_siswa;
CREATE POLICY "siswa read own jawaban_siswa" ON public.jawaban_siswa FOR SELECT TO authenticated USING (siswa_id = auth.uid());

-- ==========================================
-- PRESENSI
-- ==========================================
DROP POLICY IF EXISTS "presensi read" ON public.presensi;
CREATE POLICY "presensi read" ON public.presensi FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full presensi" ON public.presensi;
CREATE POLICY "admin full presensi" ON public.presensi FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "siswa insert own presensi" ON public.presensi;
CREATE POLICY "siswa insert own presensi" ON public.presensi FOR INSERT TO authenticated WITH CHECK (siswa_id = auth.uid());
DROP POLICY IF EXISTS "guru validate presensi" ON public.presensi;
CREATE POLICY "guru validate presensi" ON public.presensi FOR UPDATE TO authenticated
  USING (is_guru_kelas(presensi.kelas_id))
  WITH CHECK (is_guru_kelas(presensi.kelas_id));

-- ==========================================
-- NILAI
-- ==========================================
DROP POLICY IF EXISTS "nilai read own" ON public.nilai;
CREATE POLICY "nilai read own" ON public.nilai FOR SELECT TO authenticated USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full nilai" ON public.nilai;
CREATE POLICY "admin full nilai" ON public.nilai FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage nilai" ON public.nilai;
CREATE POLICY "guru manage nilai" ON public.nilai FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bab b JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = nilai.bab_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bab b JOIN guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = nilai.bab_id AND gk.guru_id = auth.uid()));

-- ==========================================
-- LAPORAN
-- ==========================================
DROP POLICY IF EXISTS "laporan read own" ON public.laporan;
CREATE POLICY "laporan read own" ON public.laporan FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "admin full laporan" ON public.laporan;
CREATE POLICY "admin full laporan" ON public.laporan FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "laporan insert own" ON public.laporan;
CREATE POLICY "laporan insert own" ON public.laporan FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ==========================================
-- JADWAL
-- ==========================================
DROP POLICY IF EXISTS "jadwal read" ON public.jadwal;
CREATE POLICY "jadwal read" ON public.jadwal FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full jadwal" ON public.jadwal;
CREATE POLICY "admin full jadwal" ON public.jadwal FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage own jadwal" ON public.jadwal;
CREATE POLICY "guru manage own jadwal" ON public.jadwal FOR ALL TO authenticated
  USING (guru_id = auth.uid()) WITH CHECK (guru_id = auth.uid());

-- ==========================================
-- UJIAN
-- ==========================================
DROP POLICY IF EXISTS "ujian read" ON public.ujian;
CREATE POLICY "ujian read" ON public.ujian FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full ujian" ON public.ujian;
CREATE POLICY "admin full ujian" ON public.ujian FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage ujian" ON public.ujian;
CREATE POLICY "guru manage ujian" ON public.ujian FOR ALL TO authenticated
  USING (is_guru_kelas(ujian.kelas_id)) WITH CHECK (is_guru_kelas(ujian.kelas_id));

-- ==========================================
-- SOAL_UJIAN
-- ==========================================
DROP POLICY IF EXISTS "soal_ujian read" ON public.soal_ujian;
CREATE POLICY "soal_ujian read" ON public.soal_ujian FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full soal_ujian" ON public.soal_ujian;
CREATE POLICY "admin full soal_ujian" ON public.soal_ujian FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage soal_ujian" ON public.soal_ujian;
CREATE POLICY "guru manage soal_ujian" ON public.soal_ujian FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ujian u JOIN guru_kelas gk ON gk.kelas_id = u.kelas_id WHERE u.id = soal_ujian.ujian_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM ujian u JOIN guru_kelas gk ON gk.kelas_id = u.kelas_id WHERE u.id = soal_ujian.ujian_id AND gk.guru_id = auth.uid()));

-- ==========================================
-- JAWABAN_UJIAN
-- ==========================================
DROP POLICY IF EXISTS "admin full jawaban_ujian" ON public.jawaban_ujian;
CREATE POLICY "admin full jawaban_ujian" ON public.jawaban_ujian FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "siswa insert own jawaban_ujian" ON public.jawaban_ujian;
CREATE POLICY "siswa insert own jawaban_ujian" ON public.jawaban_ujian FOR INSERT TO authenticated WITH CHECK (siswa_id = auth.uid());
DROP POLICY IF EXISTS "siswa read own jawaban_ujian" ON public.jawaban_ujian;
CREATE POLICY "siswa read own jawaban_ujian" ON public.jawaban_ujian FOR SELECT TO authenticated USING (siswa_id = auth.uid());

-- ==========================================
-- FORUM_BELAJAR
-- ==========================================
DROP POLICY IF EXISTS "forum_belajar read" ON public.forum_belajar;
CREATE POLICY "forum_belajar read" ON public.forum_belajar FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full forum_belajar" ON public.forum_belajar;
CREATE POLICY "admin full forum_belajar" ON public.forum_belajar FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "forum_belajar insert" ON public.forum_belajar;
CREATE POLICY "forum_belajar insert" ON public.forum_belajar FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ==========================================
-- NOTIFIKASI
-- ==========================================
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifikasi;
CREATE POLICY "Users read own notifications" ON public.notifikasi FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifikasi;
CREATE POLICY "Users update own notifications" ON public.notifikasi FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "admin full notifikasi" ON public.notifikasi;
CREATE POLICY "admin full notifikasi" ON public.notifikasi FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==========================================
-- PENGATURAN
-- ==========================================
DROP POLICY IF EXISTS "Authenticated can read pengaturan" ON public.pengaturan;
CREATE POLICY "Authenticated can read pengaturan" ON public.pengaturan FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage pengaturan" ON public.pengaturan;
CREATE POLICY "Admin can manage pengaturan" ON public.pengaturan FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ==========================================
-- SLOT_JAM (master grid jadwal)
-- ==========================================
DROP POLICY IF EXISTS "slot_jam read" ON public.slot_jam;
CREATE POLICY "slot_jam read" ON public.slot_jam FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full slot_jam" ON public.slot_jam;
CREATE POLICY "admin full slot_jam" ON public.slot_jam FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==========================================
-- HARI (master hari)
-- ==========================================
DROP POLICY IF EXISTS "hari read" ON public.hari;
CREATE POLICY "hari read" ON public.hari FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full hari" ON public.hari;
CREATE POLICY "admin full hari" ON public.hari FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
