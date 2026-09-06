-- SCRIPT DARURAT UNTUK DEMO (BYPASS RLS)
-- Jalankan ini di SQL Editor Supabase agar semua tabel bisa dibaca & ditulis tanpa error.

-- 1. Buat Policy agar public (anon) bisa full akses untuk keperluan Prototype.
DROP POLICY IF EXISTS "Public Full Access" ON public.users;
CREATE POLICY "Public Full Access" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.kelas;
CREATE POLICY "Public Full Access" ON public.kelas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.siswa_kelas;
CREATE POLICY "Public Full Access" ON public.siswa_kelas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.guru_kelas;
CREATE POLICY "Public Full Access" ON public.guru_kelas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.bab;
CREATE POLICY "Public Full Access" ON public.bab FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.konten;
CREATE POLICY "Public Full Access" ON public.konten FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.soal;
CREATE POLICY "Public Full Access" ON public.soal FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.jawaban_siswa;
CREATE POLICY "Public Full Access" ON public.jawaban_siswa FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.presensi;
CREATE POLICY "Public Full Access" ON public.presensi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access" ON public.nilai;
CREATE POLICY "Public Full Access" ON public.nilai FOR ALL USING (true) WITH CHECK (true);
