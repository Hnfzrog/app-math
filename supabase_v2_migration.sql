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

-- 6. Verifikasi hasil migration
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'laporan', 'jadwal', 'notifikasi', 'ujian',
    'soal_ujian', 'jawaban_ujian', 'forum_belajar'
  )
ORDER BY table_name;
