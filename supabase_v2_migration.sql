-- ==========================================
-- APPMATH V2 MIGRATION FOR EXISTING PROJECT
-- ==========================================
-- Jalankan file ini di Supabase SQL Editor pada project lama.
-- Jangan jalankan ulang schema dasar atau insert auth.users.
-- Migration ini hanya menambah kolom, tabel, RLS, dan policy V2.

-- 1. Kolom tambahan USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tahun_ajaran varchar(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS foto_profil_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_wali text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alamat text;

-- 2. Kolom tambahan PRESENSI
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS status_validasi text DEFAULT 'pending'
  CHECK (status_validasi IN ('pending', 'valid', 'invalid'));
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS feedback_guru text;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS foto_url text;

-- 3. Kolom tambahan NILAI
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS skor_benar numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS skor_presensi numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_akhir numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS umpan_balik text;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS umpan_balik_foto_url text;

-- 4. Tabel fitur baru
CREATE TABLE IF NOT EXISTS public.laporan (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('guru', 'siswa')),
  deskripsi text NOT NULL,
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'selesai')),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jadwal (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guru_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
  hari text NOT NULL,
  jam_mulai time NOT NULL,
  jam_selesai time NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifikasi (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  pesan text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ujian (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guru_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
  jenis text NOT NULL CHECK (jenis IN ('UH', 'UTS', 'UAS')),
  deskripsi text,
  durasi_menit integer NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.soal_ujian (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ujian_id uuid REFERENCES public.ujian ON DELETE CASCADE NOT NULL,
  pertanyaan text NOT NULL,
  butuh_foto_jawaban boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jawaban_ujian (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  soal_id uuid REFERENCES public.soal_ujian ON DELETE CASCADE NOT NULL,
  siswa_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  jawaban_teks text,
  foto_url text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.forum_belajar (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  bab_id uuid REFERENCES public.bab ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  pesan text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. RLS tabel fitur baru
ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_belajar ENABLE ROW LEVEL SECURITY;

-- 6. UJIAN: soal pilihan ganda + penilaian & validasi guru
ALTER TABLE public.soal_ujian ADD COLUMN IF NOT EXISTS tipe text NOT NULL DEFAULT 'uraian'
  CHECK (tipe IN ('pg', 'uraian'));
ALTER TABLE public.soal_ujian ADD COLUMN IF NOT EXISTS opsi jsonb;
ALTER TABLE public.soal_ujian ADD COLUMN IF NOT EXISTS multi_jawaban boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.soal_ujian_kunci (
  soal_id uuid PRIMARY KEY REFERENCES public.soal_ujian ON DELETE CASCADE,
  kunci_jawaban text NOT NULL,
  pembahasan text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.jawaban_ujian ADD COLUMN IF NOT EXISTS skor_ai numeric;
ALTER TABLE public.jawaban_ujian ADD COLUMN IF NOT EXISTS feedback_ai text;
ALTER TABLE public.jawaban_ujian ADD COLUMN IF NOT EXISTS skor_final numeric;
ALTER TABLE public.jawaban_ujian ADD COLUMN IF NOT EXISTS dinilai_at timestamptz;
ALTER TABLE public.jawaban_ujian ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_verifikasi'
  CHECK (status IN ('pending_verifikasi', 'final'));

ALTER TABLE public.soal_ujian_kunci ENABLE ROW LEVEL SECURITY;

-- 6a. Guru memvalidasi jawaban ujian → notif ke siswa
CREATE OR REPLACE FUNCTION public.notif_ujian_divalidasi()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'final' AND OLD.status IS DISTINCT FROM 'final' THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    VALUES (NEW.siswa_id, 'Nilaimu sudah keluar! Guru telah memvalidasi jawaban ujianmu.');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_ujian_divalidasi ON public.jawaban_ujian;
CREATE TRIGGER trg_notif_ujian_divalidasi AFTER UPDATE ON public.jawaban_ujian FOR EACH ROW EXECUTE FUNCTION public.notif_ujian_divalidasi();

-- 8. UJIAN: jadwal buka/tutup + status terbit
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS mulai_at timestamptz;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS selesai_at timestamptz;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS is_terbit boolean NOT NULL DEFAULT false;

ALTER TABLE public.ujian DROP CONSTRAINT IF EXISTS ujian_jadwal_check;
ALTER TABLE public.ujian ADD CONSTRAINT ujian_jadwal_check CHECK (
  NOT is_terbit OR (mulai_at IS NOT NULL AND selesai_at IS NOT NULL AND selesai_at > mulai_at)
);

-- Notif ujian HANYA saat terbit; menggantikan trg_notif_ujian yang menembak saat INSERT.
DROP TRIGGER IF EXISTS trg_notif_ujian ON public.ujian;

CREATE OR REPLACE FUNCTION public.notif_ujian_terbit_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_terbit THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT sk.siswa_id, 'Ujian baru (' || NEW.jenis || ') sudah dibuka untuk kelas Anda.'
    FROM public.siswa_kelas sk WHERE sk.kelas_id = NEW.kelas_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notif_ujian_terbit_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_terbit AND NOT OLD.is_terbit THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT sk.siswa_id, 'Ujian baru (' || NEW.jenis || ') sudah dibuka untuk kelas Anda.'
    FROM public.siswa_kelas sk WHERE sk.kelas_id = NEW.kelas_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_ujian_terbit_ins ON public.ujian;
CREATE TRIGGER trg_notif_ujian_terbit_ins AFTER INSERT ON public.ujian FOR EACH ROW EXECUTE FUNCTION public.notif_ujian_terbit_insert();

DROP TRIGGER IF EXISTS trg_notif_ujian_terbit_upd ON public.ujian;
CREATE TRIGGER trg_notif_ujian_terbit_upd AFTER UPDATE ON public.ujian FOR EACH ROW EXECUTE FUNCTION public.notif_ujian_terbit_update();

-- 8b. Perbaikan RLS untuk trigger notifikasi LAMA (dibuat saat setup awal sebagai SECURITY
-- INVOKER, sehingga INSERT ke notifikasi gagal ketika yang memicu adalah guru/siswa).
-- CREATE OR REPLACE ini idempotent dan hanya mengubah atribut keamanannya.
CREATE OR REPLACE FUNCTION public.notif_konten_baru()
RETURNS trigger AS $$
DECLARE kelas uuid;
BEGIN
  SELECT kelas_id INTO kelas FROM public.bab WHERE id = NEW.bab_id;
  IF kelas IS NOT NULL THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT sk.siswa_id, 'Materi/Tugas baru: ' || NEW.judul
    FROM public.siswa_kelas sk WHERE sk.kelas_id = kelas;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notif_nilai_baru()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifikasi (user_id, pesan)
  VALUES (NEW.siswa_id, 'Guru telah memberi nilai/umpan balik untuk salah satu bab.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notif_laporan_selesai()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'selesai' AND OLD.status IS DISTINCT FROM 'selesai' THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    VALUES (NEW.user_id, 'Laporan Anda telah diselesaikan oleh admin.');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8c. UJIAN: hubungkan ke bab (UH → nilai per-bab)
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS bab_id uuid REFERENCES public.bab ON DELETE SET NULL;

-- 10. Feedback, Forum & Kamera (28 Sep 2026)

-- 10a. FORUM_BELAJAR: thread + edit + soft-delete
ALTER TABLE public.forum_belajar ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.forum_belajar(id) ON DELETE CASCADE;
ALTER TABLE public.forum_belajar ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.forum_belajar ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 10b. NILAI: file perbaikan umum
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS umpan_balik_file_url text;

-- 10c. UJIAN_FEEDBACK: feedback guru per siswa per ujian
CREATE TABLE IF NOT EXISTS public.ujian_feedback (
  id uuid default uuid_generate_v4() primary key,
  ujian_id uuid references public.ujian on delete cascade not null,
  siswa_id uuid references public.users on delete cascade not null,
  umpan_balik text,
  file_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz,
  unique (ujian_id, siswa_id)
);
ALTER TABLE public.ujian_feedback ENABLE ROW LEVEL SECURITY;

-- 10d. NOTIFIKASI forum baru
CREATE OR REPLACE FUNCTION public.notif_forum_baru()
RETURNS trigger AS $$
DECLARE parent_author uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.forum_belajar WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id THEN
      INSERT INTO public.notifikasi (user_id, pesan)
      VALUES (parent_author, 'Ada balasan baru di forum diskusi Anda.');
    END IF;
  ELSE
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT gk.guru_id, 'Ada pertanyaan baru di forum kelas Anda.'
    FROM public.bab b
    JOIN public.guru_kelas gk ON gk.kelas_id = b.kelas_id
    WHERE b.id = NEW.bab_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_forum ON public.forum_belajar;
CREATE TRIGGER trg_notif_forum AFTER INSERT ON public.forum_belajar FOR EACH ROW EXECUTE FUNCTION public.notif_forum_baru();

-- 10e. NOTIFIKASI feedback ujian
CREATE OR REPLACE FUNCTION public.notif_ujian_feedback()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifikasi (user_id, pesan)
  VALUES (NEW.siswa_id, 'Guru memberi feedback untuk ujianmu. Cek halaman hasil ujian.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_ujian_feedback ON public.ujian_feedback;
CREATE TRIGGER trg_notif_ujian_feedback AFTER INSERT OR UPDATE ON public.ujian_feedback FOR EACH ROW EXECUTE FUNCTION public.notif_ujian_feedback();

-- 9. Verifikasi hasil migration
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'laporan', 'jadwal', 'notifikasi', 'ujian',
    'soal_ujian', 'jawaban_ujian', 'forum_belajar', 'soal_ujian_kunci'
  )
ORDER BY table_name;

-- ==========================================
-- BATCH REVISI (6 Okt 2026) — Penilaian per bab + Remedial
-- ==========================================

-- R1. NILAI: komponen per bab. nilai_akhir = rata-rata sederhana komponen terisi.
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_lkpd numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_tugas numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_uh numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_keaktifan numeric;

CREATE OR REPLACE FUNCTION public.set_nilai_akhir()
RETURNS trigger AS $$
DECLARE
  jumlah numeric;
  n integer;
BEGIN
  n := (NEW.nilai_lkpd IS NOT NULL)::int
     + (NEW.nilai_tugas IS NOT NULL)::int
     + (NEW.nilai_uh IS NOT NULL)::int
     + (NEW.nilai_keaktifan IS NOT NULL)::int;
  IF n > 0 THEN
    jumlah := COALESCE(NEW.nilai_lkpd, 0) + COALESCE(NEW.nilai_tugas, 0)
            + COALESCE(NEW.nilai_uh, 0) + COALESCE(NEW.nilai_keaktifan, 0);
    NEW.nilai_akhir := jumlah / n;
  ELSE
    NEW.nilai_akhir := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_nilai_akhir ON public.nilai;
CREATE TRIGGER trg_set_nilai_akhir
  BEFORE INSERT OR UPDATE ON public.nilai
  FOR EACH ROW EXECUTE FUNCTION public.set_nilai_akhir();

-- R2. REMEDIAL: tandai konten/ujian + daftar siswa eksplisit
ALTER TABLE public.konten ADD COLUMN IF NOT EXISTS is_remedial boolean NOT NULL DEFAULT false;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS is_remedial boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.remedial_target (
  id uuid default uuid_generate_v4() primary key,
  item_type text not null check (item_type in ('konten','ujian')),
  item_id uuid not null,
  siswa_id uuid references public.users on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (item_type, item_id, siswa_id)
);
ALTER TABLE public.remedial_target ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- BATCH 3 (6 Okt 2026) — Pengumuman + Mode Ujian + Pembahasan
-- ==========================================

-- R3. PENGUMUMAN admin/guru + audiens
CREATE TABLE IF NOT EXISTS public.pengumuman (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.users on delete cascade not null,
  author_role text not null check (author_role in ('admin','guru')),
  judul text not null,
  deskripsi text not null,
  tayang_sampai timestamptz not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
ALTER TABLE public.pengumuman ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pengumuman_target (
  id uuid default uuid_generate_v4() primary key,
  pengumuman_id uuid references public.pengumuman on delete cascade not null,
  role text check (role in ('semua','guru','siswa')),
  kelas_id uuid references public.kelas on delete cascade,
  user_id uuid references public.users on delete cascade
);
ALTER TABLE public.pengumuman_target ENABLE ROW LEVEL SECURITY;

-- R4. PELANGGARAN UJIAN (mode ujian)
CREATE TABLE IF NOT EXISTS public.pelanggaran_ujian (
  id uuid default uuid_generate_v4() primary key,
  ujian_id uuid references public.ujian on delete cascade not null,
  siswa_id uuid references public.users on delete cascade not null,
  jenis text not null check (jenis in ('pindah_tab','keluar_halaman','keluar_fullscreen')),
  durasi_detik integer,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
ALTER TABLE public.pelanggaran_ujian ENABLE ROW LEVEL SECURITY;

-- R5. PEMBAHASAN tugas/ujian
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS pembahasan_file_url text;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS pembahasan_terbit_at timestamptz;
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS pembahasan_is_terbit boolean NOT NULL DEFAULT false;
ALTER TABLE public.konten ADD COLUMN IF NOT EXISTS pembahasan_file_url text;
ALTER TABLE public.konten ADD COLUMN IF NOT EXISTS pembahasan_terbit_at timestamptz;
ALTER TABLE public.konten ADD COLUMN IF NOT EXISTS pembahasan_is_terbit boolean NOT NULL DEFAULT false;

-- R6. Notifikasi otomatis saat pengumuman ditargetkan (SECURITY DEFINER, seperti trg_notif_* lain)
CREATE OR REPLACE FUNCTION public.notif_pengumuman()
RETURNS trigger AS $$
DECLARE
  p text;
BEGIN
  SELECT judul INTO p FROM public.pengumuman WHERE id = NEW.pengumuman_id;
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifikasi (user_id, pesan) VALUES (NEW.user_id, 'Pengumuman: ' || COALESCE(p, ''));
  ELSIF NEW.kelas_id IS NOT NULL THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT sk.siswa_id, 'Pengumuman: ' || COALESCE(p, '') FROM public.siswa_kelas sk WHERE sk.kelas_id = NEW.kelas_id;
  ELSIF NEW.role = 'semua' THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT u.id, 'Pengumuman: ' || COALESCE(p, '') FROM public.users u WHERE u.role IN ('guru', 'siswa');
  ELSIF NEW.role IS NOT NULL THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT u.id, 'Pengumuman: ' || COALESCE(p, '') FROM public.users u WHERE u.role = NEW.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_pengumuman ON public.pengumuman_target;
CREATE TRIGGER trg_notif_pengumuman AFTER INSERT ON public.pengumuman_target FOR EACH ROW EXECUTE FUNCTION public.notif_pengumuman();

-- R7. Pembahasan ujian terbit otomatis 1 menit setelah SEMUA siswa kelas mengumpulkan.
-- CATATAN: trigger jalan di `jawaban_ujian` yang TIDAK punya kolom ujian_id —
-- ujian_id diturunkan dari soal_id (via soal_ujian).
CREATE OR REPLACE FUNCTION public.auto_terbit_pembahasan_ujian()
RETURNS trigger AS $$
DECLARE
  v_ujian_id uuid;
  v_kelas_id uuid;
  total_siswa int;
  sudah int;
BEGIN
  SELECT su.ujian_id INTO v_ujian_id FROM public.soal_ujian su WHERE su.id = NEW.soal_id;
  IF v_ujian_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kelas_id INTO v_kelas_id FROM public.ujian WHERE id = v_ujian_id;
  SELECT count(*) INTO total_siswa FROM public.siswa_kelas sk WHERE sk.kelas_id = v_kelas_id;

  SELECT count(DISTINCT j.siswa_id) INTO sudah
  FROM public.jawaban_ujian j
  JOIN public.soal_ujian s ON s.id = j.soal_id
  WHERE s.ujian_id = v_ujian_id;

  IF total_siswa > 0 AND sudah >= total_siswa THEN
    UPDATE public.ujian
      SET pembahasan_terbit_at = COALESCE(pembahasan_terbit_at, timezone('utc', now()) + interval '1 minute')
      WHERE id = v_ujian_id AND pembahasan_file_url IS NOT NULL AND pembahasan_terbit_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_terbit_pembahasan ON public.jawaban_ujian;
CREATE TRIGGER trg_auto_terbit_pembahasan AFTER INSERT ON public.jawaban_ujian FOR EACH ROW EXECUTE FUNCTION public.auto_terbit_pembahasan_ujian();

-- ==========================================
-- R8. RLS policies tabel baru (Batch 2-3) — mandiri, tanpa dependensi helper.
-- Tanpa ini, tabel ber-RLS tapi tanpa policy → semua INSERT ditolak.
-- ==========================================

-- remedial_target
DROP POLICY IF EXISTS "remedial_target read" ON public.remedial_target;
CREATE POLICY "remedial_target read" ON public.remedial_target FOR SELECT TO authenticated
  USING (siswa_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','guru')));
DROP POLICY IF EXISTS "admin full remedial_target" ON public.remedial_target;
CREATE POLICY "admin full remedial_target" ON public.remedial_target FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru manage remedial_target" ON public.remedial_target;
CREATE POLICY "guru manage remedial_target" ON public.remedial_target FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'guru'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'guru'));

-- pengumuman
DROP POLICY IF EXISTS "pengumuman read" ON public.pengumuman;
CREATE POLICY "pengumuman read" ON public.pengumuman FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full pengumuman" ON public.pengumuman;
CREATE POLICY "admin full pengumuman" ON public.pengumuman FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru insert pengumuman" ON public.pengumuman;
CREATE POLICY "guru insert pengumuman" ON public.pengumuman FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'guru'));

-- pengumuman_target
DROP POLICY IF EXISTS "pengumuman_target read" ON public.pengumuman_target;
CREATE POLICY "pengumuman_target read" ON public.pengumuman_target FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full pengumuman_target" ON public.pengumuman_target;
CREATE POLICY "admin full pengumuman_target" ON public.pengumuman_target FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru manage pengumuman_target" ON public.pengumuman_target;
CREATE POLICY "guru manage pengumuman_target" ON public.pengumuman_target FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pengumuman p WHERE p.id = pengumuman_target.pengumuman_id AND p.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pengumuman p WHERE p.id = pengumuman_target.pengumuman_id AND p.author_id = auth.uid()));

-- pelanggaran_ujian
DROP POLICY IF EXISTS "siswa insert own pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "siswa insert own pelanggaran" ON public.pelanggaran_ujian FOR INSERT TO authenticated WITH CHECK (siswa_id = auth.uid());
DROP POLICY IF EXISTS "siswa read own pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "siswa read own pelanggaran" ON public.pelanggaran_ujian FOR SELECT TO authenticated USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full pelanggaran" ON public.pelanggaran_ujian;
CREATE POLICY "admin full pelanggaran" ON public.pelanggaran_ujian FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru read pelanggaran kelasnya" ON public.pelanggaran_ujian;
CREATE POLICY "guru read pelanggaran kelasnya" ON public.pelanggaran_ujian FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ujian uj JOIN public.guru_kelas gk ON gk.kelas_id = uj.kelas_id
    WHERE uj.id = pelanggaran_ujian.ujian_id AND gk.guru_id = auth.uid()
  ));

-- ==========================================
-- R9. REALTIME: pastikan tabel yang di-subscribe aplikasi masuk publikasi
-- `supabase_realtime` agar notifikasi & data update TANPA reload.
-- Idempotent: hanya menambah bila belum ada.
-- ==========================================
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'notifikasi','konten','bab','soal','jawaban_siswa','jawaban_ujian',
      'ujian','nilai','forum_belajar','users'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- R10. Guru boleh MENGHAPUS pengumuman miliknya sendiri (UI punya tombol "Hapus").
-- Tanpa ini, DELETE di-diamkan oleh RLS (0 baris terhapus, tanpa error) → pengumuman tak hilang.
DROP POLICY IF EXISTS "guru delete own pengumuman" ON public.pengumuman;
CREATE POLICY "guru delete own pengumuman" ON public.pengumuman FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'guru'));

-- ==========================================
-- R11. NILAI PER ITEM (Opsi B): skor tiap tugas/LKPD/UH; komponen bab = rata-rata item.
-- ==========================================
CREATE TABLE IF NOT EXISTS public.nilai_item (
  id uuid default uuid_generate_v4() primary key,
  siswa_id uuid references public.users on delete cascade not null,
  item_type text not null check (item_type in ('konten','ujian')),
  item_id uuid not null,
  skor numeric,
  dinilai_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (siswa_id, item_type, item_id)
);
ALTER TABLE public.nilai_item ENABLE ROW LEVEL SECURITY;

-- Saat nilai_item berubah → recompute nilai komponen pada `nilai` (avg item) → nilai_akhir ikut (trigger lama).
CREATE OR REPLACE FUNCTION public.recompute_nilai_komponen()
RETURNS trigger AS $$
DECLARE
  v_siswa uuid := COALESCE(NEW.siswa_id, OLD.siswa_id);
  v_item uuid := COALESCE(NEW.item_id, OLD.item_id);
  v_type text := COALESCE(NEW.item_type, OLD.item_type);
  v_bab uuid;
  v_komponen text;
  v_avg numeric;
BEGIN
  IF v_type = 'konten' THEN
    SELECT bab_id, CASE WHEN tipe = 'lkpd' THEN 'lkpd' ELSE 'tugas' END
      INTO v_bab, v_komponen FROM public.konten WHERE id = v_item;
  ELSIF v_type = 'ujian' THEN
    SELECT bab_id, 'uh' INTO v_bab, v_komponen FROM public.ujian WHERE id = v_item;
  END IF;
  IF v_bab IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF v_komponen = 'lkpd' THEN
    SELECT avg(ni.skor) INTO v_avg FROM public.nilai_item ni
      JOIN public.konten k ON k.id = ni.item_id
      WHERE ni.siswa_id = v_siswa AND ni.item_type = 'konten' AND k.bab_id = v_bab AND k.tipe = 'lkpd' AND ni.skor IS NOT NULL;
  ELSIF v_komponen = 'tugas' THEN
    SELECT avg(ni.skor) INTO v_avg FROM public.nilai_item ni
      JOIN public.konten k ON k.id = ni.item_id
      WHERE ni.siswa_id = v_siswa AND ni.item_type = 'konten' AND k.bab_id = v_bab AND k.tipe IN ('banksoal','evaluasi') AND ni.skor IS NOT NULL;
  ELSE
    SELECT avg(ni.skor) INTO v_avg FROM public.nilai_item ni
      JOIN public.ujian u ON u.id = ni.item_id
      WHERE ni.siswa_id = v_siswa AND ni.item_type = 'ujian' AND u.bab_id = v_bab AND u.jenis = 'UH' AND ni.skor IS NOT NULL;
  END IF;

  INSERT INTO public.nilai (siswa_id, bab_id) VALUES (v_siswa, v_bab) ON CONFLICT (siswa_id, bab_id) DO NOTHING;
  UPDATE public.nilai SET
    nilai_lkpd  = CASE WHEN v_komponen = 'lkpd'  THEN v_avg ELSE nilai_lkpd  END,
    nilai_tugas = CASE WHEN v_komponen = 'tugas' THEN v_avg ELSE nilai_tugas END,
    nilai_uh    = CASE WHEN v_komponen = 'uh'    THEN v_avg ELSE nilai_uh    END
  WHERE siswa_id = v_siswa AND bab_id = v_bab;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_recompute_nilai_item ON public.nilai_item;
CREATE TRIGGER trg_recompute_nilai_item AFTER INSERT OR UPDATE OR DELETE ON public.nilai_item FOR EACH ROW EXECUTE FUNCTION public.recompute_nilai_komponen();

-- RLS nilai_item
DROP POLICY IF EXISTS "nilai_item read own" ON public.nilai_item;
CREATE POLICY "nilai_item read own" ON public.nilai_item FOR SELECT TO authenticated USING (siswa_id = auth.uid());
DROP POLICY IF EXISTS "admin full nilai_item" ON public.nilai_item;
CREATE POLICY "admin full nilai_item" ON public.nilai_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
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

-- ==========================================
-- KONSISTENSI dengan supabase_schema.sql (7 Okt 2026)
-- Melengkapi objek yang sebelumnya HANYA ada di schema kanonik agar
-- "schema dasar + migration ini" == "supabase_schema.sql".
-- Semua idempotent (IF NOT EXISTS / ON CONFLICT / DROP IF EXISTS).
-- Ditaruh SEBELUM batch rapor karena rapor meng-ALTER pengaturan.kkm.
-- ==========================================

-- K1. USERS: kolom profil dasar yang belum ada di migration.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nisn varchar(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tanggal_lahir date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS jenis_kelamin varchar(10)
  CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nomor_hp varchar(20);

-- K2. KONTEN: deadline (tanggal + jam) untuk tugas / LKPD.
ALTER TABLE public.konten ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- K3. SOAL / SOAL_UJIAN: butuh_upload + lampiran_url.
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS butuh_upload boolean default false;
ALTER TABLE public.soal ADD COLUMN IF NOT EXISTS lampiran_url text;
ALTER TABLE public.soal_ujian ADD COLUMN IF NOT EXISTS lampiran_url text;
-- jawaban_siswa.file_url (lampiran jawaban)
ALTER TABLE public.jawaban_siswa ADD COLUMN IF NOT EXISTS file_url text;

-- K4. NILAI: unique (siswa_id, bab_id) untuk penilaian per bab.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nilai_siswa_bab_unique') THEN
    ALTER TABLE public.nilai ADD CONSTRAINT nilai_siswa_bab_unique UNIQUE (siswa_id, bab_id);
  END IF;
END $$;

-- K5. PENGATURAN: identitas sekolah (single row).
CREATE TABLE IF NOT EXISTS public.pengaturan (
  id uuid default uuid_generate_v4() primary key,
  nama_sekolah text,
  alamat text,
  kop_surat text,
  latitude_pusat numeric,
  longitude_pusat numeric,
  radius_meter integer default 50,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
INSERT INTO public.pengaturan (id, nama_sekolah, alamat, kop_surat, latitude_pusat, longitude_pusat, radius_meter)
VALUES ('00000000-0000-0000-0000-000000000010', 'SMP Matematika', 'Jl. Contoh No. 1', 'SMP Matematika', NULL, NULL, 50)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.pengaturan ENABLE ROW LEVEL SECURITY;

-- K6. SLOT_JAM: master grid jadwal.
CREATE TABLE IF NOT EXISTS public.slot_jam (
  id uuid default uuid_generate_v4() primary key,
  jam_mulai time not null,
  jam_selesai time not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (jam_mulai, jam_selesai)
);
INSERT INTO public.slot_jam (jam_mulai, jam_selesai) VALUES
  ('07:00', '08:30'), ('08:30', '10:00'), ('10:30', '12:00'), ('13:00', '14:30')
ON CONFLICT (jam_mulai, jam_selesai) DO NOTHING;
ALTER TABLE public.slot_jam ENABLE ROW LEVEL SECURITY;

-- K7. HARI: master hari.
CREATE TABLE IF NOT EXISTS public.hari (
  id uuid default uuid_generate_v4() primary key,
  nama text not null unique,
  urutan integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
INSERT INTO public.hari (nama, urutan) VALUES
  ('Senin', 1), ('Selasa', 2), ('Rabu', 3), ('Kamis', 4), ('Jumat', 5)
ON CONFLICT (nama) DO NOTHING;
ALTER TABLE public.hari ENABLE ROW LEVEL SECURITY;

-- K8. TRIGGER notifikasi: definisi fungsinya ada di file ini tetapi trigger-nya hilang.
DROP TRIGGER IF EXISTS trg_notif_konten ON public.konten;
CREATE TRIGGER trg_notif_konten AFTER INSERT ON public.konten FOR EACH ROW EXECUTE FUNCTION public.notif_konten_baru();
DROP TRIGGER IF EXISTS trg_notif_nilai ON public.nilai;
CREATE TRIGGER trg_notif_nilai AFTER INSERT ON public.nilai FOR EACH ROW EXECUTE FUNCTION public.notif_nilai_baru();
DROP TRIGGER IF EXISTS trg_notif_laporan ON public.laporan;
CREATE TRIGGER trg_notif_laporan AFTER UPDATE ON public.laporan FOR EACH ROW EXECUTE FUNCTION public.notif_laporan_selesai();

-- K9. RLS pengaturan / slot_jam / hari (inline, mandiri).
DROP POLICY IF EXISTS "Authenticated can read pengaturan" ON public.pengaturan;
CREATE POLICY "Authenticated can read pengaturan" ON public.pengaturan FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage pengaturan" ON public.pengaturan;
CREATE POLICY "Admin can manage pengaturan" ON public.pengaturan FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "slot_jam read" ON public.slot_jam;
CREATE POLICY "slot_jam read" ON public.slot_jam FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full slot_jam" ON public.slot_jam;
CREATE POLICY "admin full slot_jam" ON public.slot_jam FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "hari read" ON public.hari;
CREATE POLICY "hari read" ON public.hari FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin full hari" ON public.hari;
CREATE POLICY "admin full hari" ON public.hari FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- K10. USERS: policy baca identitas dasar (dipakai fitur daftar siswa/guru, nama guru
-- pengampu di "Kelas Saya", audiens Pengumuman, dsb). Sama dengan schema kanonik.
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;
CREATE POLICY "Authenticated users can read all users" ON public.users FOR SELECT TO authenticated USING (true);

-- ==========================================
-- BATCH RAPOR (7 Okt 2026) — cetak rapor & perangkingan
-- ==========================================

-- R1. bab.semester
ALTER TABLE public.bab ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'ganjil'
  CHECK (semester IN ('ganjil','genap'));

-- R2. pengaturan.kkm
ALTER TABLE public.pengaturan ADD COLUMN IF NOT EXISTS kkm numeric NOT NULL DEFAULT 75;

-- R3. RAPOR (status terbit per kelas + semester)
CREATE TABLE IF NOT EXISTS public.rapor (
  id uuid default uuid_generate_v4() primary key,
  kelas_id uuid references public.kelas on delete cascade not null,
  semester text not null check (semester in ('ganjil','genap')),
  tahun_ajaran text,
  is_terbit boolean not null default false,
  terbit_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (kelas_id, semester)
);
ALTER TABLE public.rapor ENABLE ROW LEVEL SECURITY;

-- R4. RAPOR_SISWA (deskripsi manual per siswa)
CREATE TABLE IF NOT EXISTS public.rapor_siswa (
  id uuid default uuid_generate_v4() primary key,
  rapor_id uuid references public.rapor on delete cascade not null,
  siswa_id uuid references public.users on delete cascade not null,
  kegiatan_pengembangan jsonb,
  akhlak_kepribadian jsonb,
  catatan_wali_kelas text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz,
  unique (rapor_id, siswa_id)
);
ALTER TABLE public.rapor_siswa ENABLE ROW LEVEL SECURITY;

-- R5. RLS rapor + rapor_siswa (inline EXISTS, mandiri)
DROP POLICY IF EXISTS "rapor read" ON public.rapor;
CREATE POLICY "rapor read" ON public.rapor FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = rapor.kelas_id)
    OR (rapor.is_terbit AND EXISTS (
      SELECT 1 FROM public.siswa_kelas sk WHERE sk.kelas_id = rapor.kelas_id AND sk.siswa_id = auth.uid()
    ))
  );
DROP POLICY IF EXISTS "admin full rapor" ON public.rapor;
CREATE POLICY "admin full rapor" ON public.rapor FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru manage rapor" ON public.rapor;
CREATE POLICY "guru manage rapor" ON public.rapor FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = rapor.kelas_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.guru_kelas gk WHERE gk.guru_id = auth.uid() AND gk.kelas_id = rapor.kelas_id));

DROP POLICY IF EXISTS "rapor_siswa read" ON public.rapor_siswa;
CREATE POLICY "rapor_siswa read" ON public.rapor_siswa FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.rapor r JOIN public.guru_kelas gk ON gk.kelas_id = r.kelas_id
               WHERE r.id = rapor_siswa.rapor_id AND gk.guru_id = auth.uid())
    OR (
      rapor_siswa.siswa_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.rapor r WHERE r.id = rapor_siswa.rapor_id AND r.is_terbit)
    )
  );
DROP POLICY IF EXISTS "admin full rapor_siswa" ON public.rapor_siswa;
CREATE POLICY "admin full rapor_siswa" ON public.rapor_siswa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
DROP POLICY IF EXISTS "guru manage rapor_siswa" ON public.rapor_siswa;
CREATE POLICY "guru manage rapor_siswa" ON public.rapor_siswa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rapor r JOIN public.guru_kelas gk ON gk.kelas_id = r.kelas_id
                 WHERE r.id = rapor_siswa.rapor_id AND gk.guru_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rapor r JOIN public.guru_kelas gk ON gk.kelas_id = r.kelas_id
                 WHERE r.id = rapor_siswa.rapor_id AND gk.guru_id = auth.uid()));

-- R6. Notifikasi ke siswa saat rapor kelasnya diterbitkan (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.notif_rapor_terbit()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_terbit AND OLD.is_terbit IS DISTINCT FROM true THEN
    INSERT INTO public.notifikasi (user_id, pesan)
    SELECT sk.siswa_id,
           'Rapor semester ' || CASE WHEN NEW.semester = 'genap' THEN 'Genap' ELSE 'Ganjil' END || ' kelasmu sudah diterbitkan. Kamu bisa mengunduhnya di Nilai Saya.'
    FROM public.siswa_kelas sk WHERE sk.kelas_id = NEW.kelas_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notif_rapor_terbit ON public.rapor;
CREATE TRIGGER trg_notif_rapor_terbit AFTER UPDATE ON public.rapor FOR EACH ROW EXECUTE FUNCTION public.notif_rapor_terbit();
