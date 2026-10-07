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

CREATE OR REPLACE FUNCTION public.is_guru()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'guru');
$$;

-- Apakah auth.uid() guru pengampu kelas dari ujian yang memiliki soal _soal_id.
-- Dipakai untuk membatasi akses kunci jawaban & validasi jawaban ujian.
CREATE OR REPLACE FUNCTION public.is_guru_soal_ujian(_soal_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.soal_ujian su
    JOIN public.ujian u ON u.id = su.ujian_id
    JOIN public.guru_kelas gk ON gk.kelas_id = u.kelas_id
    WHERE su.id = _soal_id AND gk.guru_id = auth.uid()
  );
$$;

-- ==========================================
-- USERS
-- ==========================================
DROP POLICY IF EXISTS "admin full users" ON public.users;
CREATE POLICY "admin full users" ON public.users FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Setiap user membaca barisnya sendiri (dipakai useCurrentUser / nama di topbar & pakta integritas).
DROP POLICY IF EXISTS "users read own" ON public.users;
CREATE POLICY "users read own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());

-- Guru perlu membaca identitas siswa di kelas yang diampu (daftar siswa, halaman hasil ujian).
-- Sengaja TIDAK menyentuh public.users di dalam USING agar tidak rekursi policy.
DROP POLICY IF EXISTS "guru read siswa kelasnya" ON public.users;
CREATE POLICY "guru read siswa kelasnya" ON public.users FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.siswa_kelas sk
    JOIN public.guru_kelas gk ON gk.kelas_id = sk.kelas_id
    WHERE sk.siswa_id = users.id AND gk.guru_id = auth.uid()
  ));

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
-- Guru mencatat presensi manual (per siswa / sekelas) untuk kelas yang diampu.
DROP POLICY IF EXISTS "guru insert presensi kelasnya" ON public.presensi;
CREATE POLICY "guru insert presensi kelasnya" ON public.presensi FOR INSERT TO authenticated
  WITH CHECK (is_guru_kelas(kelas_id));

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
-- Siswa hanya melihat ujian kelasnya yang sudah TERBIT (draf disembunyikan sampai guru
-- menerbitkan). Guru & admin tetap melihat semuanya.
DROP POLICY IF EXISTS "ujian read" ON public.ujian;
CREATE POLICY "ujian read" ON public.ujian FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_guru()
    OR (
      ujian.is_terbit
      AND EXISTS (
        SELECT 1 FROM public.siswa_kelas sk
        WHERE sk.kelas_id = ujian.kelas_id AND sk.siswa_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "admin full ujian" ON public.ujian;
CREATE POLICY "admin full ujian" ON public.ujian FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage ujian" ON public.ujian;
CREATE POLICY "guru manage ujian" ON public.ujian FOR ALL TO authenticated
  USING (is_guru_kelas(ujian.kelas_id)) WITH CHECK (is_guru_kelas(ujian.kelas_id));

-- ==========================================
-- SOAL_UJIAN
-- ==========================================
-- Siswa hanya boleh membaca soal ujian kelasnya; guru boleh semua (soal tanpa kunci dipakai
-- bersama antar guru untuk fitur "Ambil Soal dari Ujian Lain"). Kunci ada di soal_ujian_kunci.
DROP POLICY IF EXISTS "soal_ujian read" ON public.soal_ujian;
CREATE POLICY "soal_ujian read" ON public.soal_ujian FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_guru()
    OR EXISTS (
      SELECT 1 FROM public.ujian u
      JOIN public.siswa_kelas sk ON sk.kelas_id = u.kelas_id
      WHERE u.id = soal_ujian.ujian_id AND sk.siswa_id = auth.uid()
    )
  );
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

-- Guru membaca jawaban siswa di ujian kelasnya (halaman hasil ujian).
DROP POLICY IF EXISTS "guru read jawaban_ujian" ON public.jawaban_ujian;
CREATE POLICY "guru read jawaban_ujian" ON public.jawaban_ujian FOR SELECT TO authenticated
  USING (is_guru_soal_ujian(soal_id));

-- Guru memvalidasi nilai (set skor_final + status='final').
DROP POLICY IF EXISTS "guru validate jawaban_ujian" ON public.jawaban_ujian;
CREATE POLICY "guru validate jawaban_ujian" ON public.jawaban_ujian FOR UPDATE TO authenticated
  USING (is_guru_soal_ujian(soal_id))
  WITH CHECK (is_guru_soal_ujian(soal_id));

-- ==========================================
-- SOAL_UJIAN_KUNCI
-- ==========================================
-- Kunci jawaban hanya untuk guru pengampu kelas ujian tsb + admin. Siswa tidak punya policy
-- sama sekali, dan guru lain tidak bisa membaca kunci ujian bukan miliknya.
DROP POLICY IF EXISTS "admin full soal_ujian_kunci" ON public.soal_ujian_kunci;
CREATE POLICY "admin full soal_ujian_kunci" ON public.soal_ujian_kunci FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "guru manage soal_ujian_kunci" ON public.soal_ujian_kunci;
CREATE POLICY "guru manage soal_ujian_kunci" ON public.soal_ujian_kunci FOR ALL TO authenticated
  USING (is_guru_soal_ujian(soal_id))
  WITH CHECK (is_guru_soal_ujian(soal_id));

-- ==========================================
-- FORUM_BELAJAR
-- ==========================================
DROP POLICY IF EXISTS "forum_belajar read" ON public.forum_belajar;
CREATE POLICY "forum_belajar read" ON public.forum_belajar FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full forum_belajar" ON public.forum_belajar;
CREATE POLICY "admin full forum_belajar" ON public.forum_belajar FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "forum_belajar insert" ON public.forum_belajar;
CREATE POLICY "forum_belajar insert" ON public.forum_belajar FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Penulis mengedit pesannya sendiri (forum_belajar).
DROP POLICY IF EXISTS "forum_belajar update own" ON public.forum_belajar;
CREATE POLICY "forum_belajar update own" ON public.forum_belajar FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Guru pengampu kelas boleh moderasi (soft-delete) pesan apa pun di kelasnya.
DROP POLICY IF EXISTS "guru moderate forum_belajar" ON public.forum_belajar;
CREATE POLICY "guru moderate forum_belajar" ON public.forum_belajar FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bab b JOIN public.guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = forum_belajar.bab_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bab b JOIN public.guru_kelas gk ON gk.kelas_id = b.kelas_id WHERE b.id = forum_belajar.bab_id AND gk.guru_id = auth.uid()));

-- Hapus: penulis sendiri, guru pengampu kelas bab tsb, atau admin.
DROP POLICY IF EXISTS "forum_belajar delete" ON public.forum_belajar;
CREATE POLICY "forum_belajar delete" ON public.forum_belajar FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.bab b
      JOIN public.guru_kelas gk ON gk.kelas_id = b.kelas_id
      WHERE b.id = forum_belajar.bab_id AND gk.guru_id = auth.uid()
    )
  );

-- ==========================================
-- UJIAN_FEEDBACK (satu arah guru → siswa)
-- ==========================================
DROP POLICY IF EXISTS "ujian_feedback read own" ON public.ujian_feedback;
CREATE POLICY "ujian_feedback read own" ON public.ujian_feedback FOR SELECT TO authenticated
  USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full ujian_feedback" ON public.ujian_feedback;
CREATE POLICY "admin full ujian_feedback" ON public.ujian_feedback FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage ujian_feedback" ON public.ujian_feedback;
CREATE POLICY "guru manage ujian_feedback" ON public.ujian_feedback FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ujian u JOIN guru_kelas gk ON gk.kelas_id = u.kelas_id WHERE u.id = ujian_feedback.ujian_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM ujian u JOIN guru_kelas gk ON gk.kelas_id = u.kelas_id WHERE u.id = ujian_feedback.ujian_id AND gk.guru_id = auth.uid()));

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

-- ==========================================
-- REMEDIAL_TARGET (revisi 6 Okt 2026)
-- ==========================================
DROP POLICY IF EXISTS "remedial_target read" ON public.remedial_target;
CREATE POLICY "remedial_target read" ON public.remedial_target FOR SELECT TO authenticated
  USING (siswa_id = auth.uid() OR is_admin() OR is_guru());
DROP POLICY IF EXISTS "admin full remedial_target" ON public.remedial_target;
CREATE POLICY "admin full remedial_target" ON public.remedial_target FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage remedial_target" ON public.remedial_target;
CREATE POLICY "guru manage remedial_target" ON public.remedial_target FOR ALL TO authenticated
  USING (is_guru()) WITH CHECK (is_guru());

-- ==========================================
-- PENGUMUMAN (revisi 6 Okt 2026)
-- ==========================================
DROP POLICY IF EXISTS "pengumuman read" ON public.pengumuman;
CREATE POLICY "pengumuman read" ON public.pengumuman FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full pengumuman" ON public.pengumuman;
CREATE POLICY "admin full pengumuman" ON public.pengumuman FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru insert pengumuman" ON public.pengumuman;
CREATE POLICY "guru insert pengumuman" ON public.pengumuman FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_guru());
DROP POLICY IF EXISTS "guru delete own pengumuman" ON public.pengumuman;
CREATE POLICY "guru delete own pengumuman" ON public.pengumuman FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND is_guru());

-- ==========================================
-- NILAI_ITEM (per-item grading, Opsi B)
-- ==========================================
DROP POLICY IF EXISTS "nilai_item read own" ON public.nilai_item;
CREATE POLICY "nilai_item read own" ON public.nilai_item FOR SELECT TO authenticated USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full nilai_item" ON public.nilai_item;
CREATE POLICY "admin full nilai_item" ON public.nilai_item FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage nilai_item" ON public.nilai_item;
CREATE POLICY "guru manage nilai_item" ON public.nilai_item FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = (
      CASE WHEN nilai_item.item_type = 'konten'
        THEN (SELECT b.kelas_id FROM public.konten k JOIN public.bab b ON b.id = k.bab_id WHERE k.id = nilai_item.item_id)
        ELSE (SELECT u.kelas_id FROM public.ujian u WHERE u.id = nilai_item.item_id) END)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = (
      CASE WHEN nilai_item.item_type = 'konten'
        THEN (SELECT b.kelas_id FROM public.konten k JOIN public.bab b ON b.id = k.bab_id WHERE k.id = nilai_item.item_id)
        ELSE (SELECT u.kelas_id FROM public.ujian u WHERE u.id = nilai_item.item_id) END)
  ));

DROP POLICY IF EXISTS "pengumuman_target read" ON public.pengumuman_target;
CREATE POLICY "pengumuman_target read" ON public.pengumuman_target FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full pengumuman_target" ON public.pengumuman_target;
CREATE POLICY "admin full pengumuman_target" ON public.pengumuman_target FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage pengumuman_target" ON public.pengumuman_target;
CREATE POLICY "guru manage pengumuman_target" ON public.pengumuman_target FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pengumuman p WHERE p.id = pengumuman_target.pengumuman_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pengumuman p WHERE p.id = pengumuman_target.pengumuman_id AND p.author_id = auth.uid()));

-- ==========================================
-- PELANGGARAN_UJIAN (revisi 6 Okt 2026)
-- ==========================================
DROP POLICY IF EXISTS "siswa insert own pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "siswa insert own pelanggaran" ON public.pelanggaran_ujian FOR INSERT TO authenticated WITH CHECK (siswa_id = auth.uid());
DROP POLICY IF EXISTS "siswa read own pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "siswa read own pelanggaran" ON public.pelanggaran_ujian FOR SELECT TO authenticated USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "admin full pelanggaran" ON public.pelanggaran_ujian FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru read pelanggaran kelasnya" ON public.pelanggaran_ujian;
CREATE POLICY "guru read pelanggaran kelasnya" ON public.pelanggaran_ujian FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ujian uj JOIN public.guru_kelas gk ON gk.kelas_id = uj.kelas_id
    WHERE uj.id = pelanggaran_ujian.ujian_id AND gk.guru_id = auth.uid()
  ));

-- ==========================================
-- RAPOR (cetak & perangkingan) — 7 Okt 2026
-- ==========================================
DROP POLICY IF EXISTS "rapor read" ON public.rapor;
CREATE POLICY "rapor read" ON public.rapor FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_guru_kelas(rapor.kelas_id)
    OR (rapor.is_terbit AND EXISTS (
      SELECT 1 FROM public.siswa_kelas sk
      WHERE sk.kelas_id = rapor.kelas_id AND sk.siswa_id = auth.uid()
    ))
  );
DROP POLICY IF EXISTS "admin full rapor" ON public.rapor;
CREATE POLICY "admin full rapor" ON public.rapor FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage rapor" ON public.rapor;
CREATE POLICY "guru manage rapor" ON public.rapor FOR ALL TO authenticated
  USING (is_guru_kelas(rapor.kelas_id)) WITH CHECK (is_guru_kelas(rapor.kelas_id));

DROP POLICY IF EXISTS "rapor_siswa read" ON public.rapor_siswa;
CREATE POLICY "rapor_siswa read" ON public.rapor_siswa FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM public.rapor r WHERE r.id = rapor_siswa.rapor_id AND is_guru_kelas(r.kelas_id))
    OR (
      rapor_siswa.siswa_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.rapor r WHERE r.id = rapor_siswa.rapor_id AND r.is_terbit)
    )
  );
DROP POLICY IF EXISTS "admin full rapor_siswa" ON public.rapor_siswa;
CREATE POLICY "admin full rapor_siswa" ON public.rapor_siswa FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "guru manage rapor_siswa" ON public.rapor_siswa;
CREATE POLICY "guru manage rapor_siswa" ON public.rapor_siswa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rapor r WHERE r.id = rapor_siswa.rapor_id AND is_guru_kelas(r.kelas_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rapor r WHERE r.id = rapor_siswa.rapor_id AND is_guru_kelas(r.kelas_id)));
