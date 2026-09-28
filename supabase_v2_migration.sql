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
