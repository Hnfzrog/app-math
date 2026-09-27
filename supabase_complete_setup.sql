-- ⚠️ LEGACY / ALTERNATIVE (Marked 27 Sep 2026): self-contained demo setup with "Public Full Access" RLS. Canonical: supabase_schema.sql.
-- ==========================================
-- APPMATH: SUPABASE SQL EDITOR SETUP
-- ==========================================
-- File ini mandiri dan dapat langsung ditempel ke Supabase SQL Editor.
-- Jalankan setelah tabel dasar dari supabase_schema.sql sudah tersedia.
-- Data demo memakai UUID yang sama dengan reset_and_seed.sql.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ==========================================
-- SCHEMA DASAR
-- ==========================================

CREATE TABLE IF NOT EXISTS public.users (
	id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
	email text NOT NULL,
	role text NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
	nama text NOT NULL,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
	nisn varchar(20),
	tanggal_lahir date,
	jenis_kelamin varchar(10) CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
	nomor_hp varchar(20)
);

CREATE TABLE IF NOT EXISTS public.kelas (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	nama text NOT NULL,
	angkatan text NOT NULL DEFAULT '7',
	sub_kelas text,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT kelas_angkatan_sub_unique UNIQUE (angkatan, sub_kelas)
);

CREATE TABLE IF NOT EXISTS public.siswa_kelas (
	siswa_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
	kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
	PRIMARY KEY (siswa_id, kelas_id)
);

CREATE TABLE IF NOT EXISTS public.guru_kelas (
	guru_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
	kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
	PRIMARY KEY (guru_id, kelas_id)
);

CREATE TABLE IF NOT EXISTS public.bab (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
	nomor integer NOT NULL,
	judul text NOT NULL,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.konten (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	bab_id uuid REFERENCES public.bab ON DELETE CASCADE NOT NULL,
	tipe text NOT NULL CHECK (tipe IN ('emateri', 'lkpd', 'banksoal', 'evaluasi')),
	judul text NOT NULL,
	file_url text,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.soal (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	konten_id uuid REFERENCES public.konten ON DELETE CASCADE NOT NULL,
	pertanyaan text NOT NULL,
	tipe text NOT NULL CHECK (tipe IN ('pg', 'uraian')),
	kunci_jawaban text NOT NULL,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.jawaban_siswa (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	soal_id uuid REFERENCES public.soal ON DELETE CASCADE NOT NULL,
	siswa_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
	jawaban text NOT NULL,
	skor_ai numeric,
	feedback_ai text,
	skor_final numeric,
	status text NOT NULL DEFAULT 'pending_verifikasi' CHECK (status IN ('pending_verifikasi', 'final')),
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.presensi (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	siswa_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
	kelas_id uuid REFERENCES public.kelas ON DELETE CASCADE NOT NULL,
	tanggal date NOT NULL,
	status text NOT NULL CHECK (status IN ('masuk', 'izin', 'sakit', 'alpha')),
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.nilai (
	id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	siswa_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
	bab_id uuid REFERENCES public.bab ON DELETE CASCADE NOT NULL,
	pengetahuan numeric DEFAULT 0,
	kreativitas numeric DEFAULT 0,
	created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profil dibuat oleh seed dan route admin setelah Auth user berhasil dibuat.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	INSERT INTO public.users (id, email, role, nama)
	VALUES (
		NEW.id,
		NEW.email,
		COALESCE(NEW.raw_user_meta_data ->> 'role', 'siswa'),
		COALESCE(NEW.raw_user_meta_data ->> 'nama', split_part(NEW.email, '@', 1))
	)
	ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
	RETURN NEW;
END;
$$;

-- ==========================================
-- UPDATE SCHEMA V2
-- ==========================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tahun_ajaran varchar(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS foto_profil_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_wali text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alamat text;

ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS status_validasi text DEFAULT 'pending' check (status_validasi in ('pending', 'valid', 'invalid'));
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS feedback_guru text;
ALTER TABLE public.presensi ADD COLUMN IF NOT EXISTS foto_url text;

ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS skor_benar numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS skor_presensi numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS nilai_akhir numeric;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS umpan_balik text;
ALTER TABLE public.nilai ADD COLUMN IF NOT EXISTS umpan_balik_foto_url text;

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

ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_belajar ENABLE ROW LEVEL SECURITY;

-- Policy demo agar data dapat dipakai langsung oleh aplikasi prototype.
DO $$
DECLARE
	table_name text;
BEGIN
	FOREACH table_name IN ARRAY ARRAY['laporan', 'jadwal', 'notifikasi', 'ujian', 'soal_ujian', 'jawaban_ujian', 'forum_belajar'] LOOP
		EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I', table_name);
		EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', table_name);
	END LOOP;
END $$;

-- ==========================================
-- DATA BACKUP TABEL LAMA
-- ==========================================
-- Data berikut berasal dari export SQL backup yang diberikan.
-- ON CONFLICT menjaga UUID yang sudah ada tetap aman.

INSERT INTO public.kelas (id, nama, created_at, angkatan, sub_kelas) VALUES
('11111111-1111-1111-1111-111111111111', '7A', '2026-09-08 11:45:25.568772+00', '7', 'A'),
('22222222-2222-2222-2222-222222222222', '7B', '2026-09-08 11:45:25.568772+00', '7', 'B'),
('260dd853-b69b-4056-a9c4-62fe9f8eb202', '9B', '2026-09-12 06:46:49.21375+00', '9', 'B'),
('33333333-3333-3333-3333-333333333333', '8A', '2026-09-08 11:45:25.568772+00', '8', 'A'),
('412823fb-2492-4c51-9d0b-ec81d826f8e6', '8B', '2026-09-12 06:45:52.866478+00', '8', 'B'),
('7fcd4402-df34-45ad-92dc-b27da23fea66', '9A', '2026-09-12 06:08:56.260712+00', '9', 'A'),
('a8ba7db8-25dd-4d67-bc79-130fb3326047', '7E', '2026-09-14 00:58:47.801287+00', '7', 'E')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bab (id, kelas_id, nomor, judul, created_at) VALUES
('0afe20bb-c776-4447-8874-b5800f7ced6a', '33333333-3333-3333-3333-333333333333', 2, 'Bab 2 Aljabar', '2026-09-14 01:01:21.33608+00'),
('4cac5ded-4164-41d2-a258-18af0adee0a8', '33333333-3333-3333-3333-333333333333', 1, 'Sistem Persamaan Linear Dua Variabel', '2026-09-12 07:18:01.531112+00'),
('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Sistem Persamaan Linear Dua Variabel (SPLDV)', '2026-09-08 11:45:25.568772+00'),
('de4d5474-ae22-4764-87bf-8e449d2cdadb', '412823fb-2492-4c51-9d0b-ec81d826f8e6', 1, 'Sistem Persamaan Linear Dua Variabel', '2026-09-12 07:18:53.608933+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.konten (id, bab_id, tipe, judul, file_url, created_at) VALUES
('16145d27-e029-4744-8e67-60761272656b', 'de4d5474-ae22-4764-87bf-8e449d2cdadb', 'lkpd', 'LKPD', null, '2026-09-14 01:33:52.706143+00'),
('46cfef6b-faf9-4bde-9a3f-00fd51e42696', '4cac5ded-4164-41d2-a258-18af0adee0a8', 'lkpd', 'LKPD', null, '2026-09-14 01:26:04.193201+00'),
('81494de5-8bfa-40d1-80b1-88b4de6fe47b', 'de4d5474-ae22-4764-87bf-8e449d2cdadb', 'banksoal', 'Kuis Harian', null, '2026-09-14 01:38:48.078107+00'),
('be0b26bb-5c05-417d-ad4b-3f8a359070f9', '4cac5ded-4164-41d2-a258-18af0adee0a8', 'banksoal', 'Kuis Harian SPLDV', null, '2026-09-13 22:46:08.727976+00'),
('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'emateri', 'Materi 1: Pengenalan SPLDV', 'https://example.com/materi.pdf', '2026-09-08 11:45:25.568772+00'),
('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'lkpd', 'LKPD 1: SPLDV Metode Substitusi', null, '2026-09-08 11:45:25.568772+00'),
('c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'banksoal', 'Latihan Soal SPLDV', null, '2026-09-08 11:45:25.568772+00'),
('ee160486-5a50-47a7-ad81-93916cc968ca', '4cac5ded-4164-41d2-a258-18af0adee0a8', 'emateri', 'Materi SPLDV', 'https://youtu.be/GbPkZ92QDLI?si=fI4O4mfgkdqEN94O', '2026-09-13 22:40:42.867924+00')
ON CONFLICT (id) DO NOTHING;

/*
-- Akun Auth wajib dibuat lewat Supabase Dashboard atau Auth Admin API.
-- Jangan insert langsung ke auth.users/auth.identities karena keduanya managed Supabase.
DO $$
DECLARE
	account record;
BEGIN
	FOR account IN
		SELECT * FROM (VALUES
			('17b0e933-1273-4120-8e04-7ae24bb48547'::uuid, 'nizazahra@gmail.com'),
			('1d427895-380d-472e-bd18-1efcd645bebb'::uuid, 'fitriatulinnayah456@gmail.com'),
			('3fb25d60-7324-48af-a1f9-c0811b2712cf'::uuid, 'berlianadzra456@gmail.com'),
			('4bc60c2b-3373-4364-9f9c-77d1b115e4ee'::uuid, 'anaseptiana456@gmail.com'),
			('61de38c7-3a16-4fed-a162-4c4d083fa158'::uuid, 'adityanur456@gmail.com'),
			('635d71b6-2218-4b00-baab-190341f423a3'::uuid, 'ilham123@gmail.com'),
			('63c6d4a7-337d-425c-962b-a82d988f0eab'::uuid, 'admin@gmail.com'),
			('64d9dc11-8559-4b44-acea-08f3f15fd6b4'::uuid, 'maulidarahmawati@gmail.com'),
			('7141932a-5b2c-4c06-ac2a-0fb854898fe8'::uuid, 'muhammadrizky@gmail.com'),
			('725aa615-9057-4959-bc30-1e5d1cb5f9c3'::uuid, 'bennedickrafael678@gmail.com'),
			('7ae01edd-94e7-46c7-b765-81079ac0963b'::uuid, 'adelladesty456@gmail.com'),
			('881f4e5b-cf94-4d07-8aa7-ef81ceb25e35'::uuid, 'mohammadzaidan@gmail.com'),
			('8fc5c674-9037-4c44-8ebe-7b365597fb3d'::uuid, 'erinnaputri@gmail.com'),
			('90dd2f6a-e7b9-4e6d-8986-626f251cd77a'::uuid, 'rafidawindhi@gmail.com'),
			('9418e443-e91f-4454-85e4-83b0cf93f528'::uuid, 'abduhariq456@gmail.com'),
			('9ef3f86d-a329-42b2-b8f7-e1653c13f1c9'::uuid, 'siswa@gmail.com'),
			('a7a55798-dfeb-4293-959e-dc462aeca66e'::uuid, 'ghazwafikratun456@gmail.com'),
			('b5a3ddd6-258a-4ac1-abd6-77246fd2b563'::uuid, 'muhammadyamin456@gmail.com'),
			('b72fa256-20fe-4b7f-9f43-7c3ec8550882'::uuid, 'wibiandinnuari@gmail.com'),
			('dcd71894-8b54-447c-a1d0-94e4c5e78a43'::uuid, 'adzkiyaratu456@gmail.com'),
			('e755695d-cc6a-4cd1-8ad6-d53140953031'::uuid, 'ignezbrithcyta456@gmail.com')
		) AS seed(id, email)
	LOOP
		IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = account.id) THEN
			INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
			VALUES (account.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', account.email, crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

			INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
			VALUES (gen_random_uuid(), account.id, account.id::text, jsonb_build_object('sub', account.id::text, 'email', account.email), 'email', now(), now());
		END IF;
	END LOOP;
END $$;

*/

INSERT INTO public.users (id, email, role, nama, created_at, nisn, tanggal_lahir, jenis_kelamin, nomor_hp) VALUES
('17b0e933-1273-4120-8e04-7ae24bb48547', 'nizazahra@gmail.com', 'siswa', 'Niza Zahra Shahibah', '2026-09-12 07:03:22.201199+00', '', null, null, null),
('1d427895-380d-472e-bd18-1efcd645bebb', 'fitriatulinnayah456@gmail.com', 'siswa', 'Fitriatul Innayah', '2026-09-12 06:57:52.007941+00', '123456', null, null, null),
('3fb25d60-7324-48af-a1f9-c0811b2712cf', 'berlianadzra456@gmail.com', 'siswa', 'Berlian Adzra Diyah Amanja', '2026-09-12 06:56:54.237933+00', '123456', null, null, null),
('4bc60c2b-3373-4364-9f9c-77d1b115e4ee', 'anaseptiana456@gmail.com', 'siswa', 'Ana Septiana', '2026-09-12 06:56:09.841653+00', '123456', null, null, null),
('61de38c7-3a16-4fed-a162-4c4d083fa158', 'adityanur456@gmail.com', 'siswa', 'Aditya Nur Santosa', '2026-09-12 06:53:15.801162+00', '123456', null, null, null),
('635d71b6-2218-4b00-baab-190341f423a3', 'ilham123@gmail.com', 'siswa', 'Ilham Dwitiar Febrian', '2026-09-08 13:51:53.146611+00', '21345678', '2003-02-01', 'Laki-laki', '081291621262'),
('63c6d4a7-337d-425c-962b-a82d988f0eab', 'admin@gmail.com', 'admin', 'Bapak Kepala Admin', '2026-09-08 11:45:41.532449+00', null, null, null, null),
('64d9dc11-8559-4b44-acea-08f3f15fd6b4', 'maulidarahmawati@gmail.com', 'guru', 'Maulida Rahmawati', '2026-09-12 06:51:31.018396+00', null, null, null, null),
('7141932a-5b2c-4c06-ac2a-0fb854898fe8', 'muhammadrizky@gmail.com', 'guru', 'Muhammad Rizky Akbar Syafa''ad', '2026-09-12 07:12:57.371194+00', null, null, null, null),
('725aa615-9057-4959-bc30-1e5d1cb5f9c3', 'bennedickrafael678@gmail.com', 'siswa', 'Bennedick Rafael Pardede', '2026-09-08 14:49:00.358325+00', '35678', null, null, null),
('7ae01edd-94e7-46c7-b765-81079ac0963b', 'adelladesty456@gmail.com', 'siswa', 'Adella Desty Widy Kurnia', '2026-09-12 06:52:14.985634+00', '123456', null, null, null),
('881f4e5b-cf94-4d07-8aa7-ef81ceb25e35', 'mohammadzaidan@gmail.com', 'siswa', 'Mohammad Zaidan Ginan Ilman', '2026-09-12 07:02:32.69425+00', '', null, null, null),
('8fc5c674-9037-4c44-8ebe-7b365597fb3d', 'erinnaputri@gmail.com', 'guru', 'Erinna Putri Salsabila', '2026-09-12 07:15:00.570823+00', null, null, null, null),
('90dd2f6a-e7b9-4e6d-8986-626f251cd77a', 'rafidawindhi@gmail.com', 'siswa', 'Rafida Windhi Saputri', '2026-09-12 07:04:17.758636+00', '', null, null, null),
('9418e443-e91f-4454-85e4-83b0cf93f528', 'abduhariq456@gmail.com', 'siswa', 'Abduh Ariq Afifuddin', '2026-09-12 06:50:56.292306+00', '123456', null, null, null),
('9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', 'siswa@gmail.com', 'siswa', 'Andi Siswa Rajin', '2026-09-08 11:45:42.330364+00', '189141173', null, null, null),
('a7a55798-dfeb-4293-959e-dc462aeca66e', 'ghazwafikratun456@gmail.com', 'siswa', 'Ghazwa Fikratun Nisa', '2026-09-12 07:00:39.973101+00', '123456', null, null, null),
('b5a3ddd6-258a-4ac1-abd6-77246fd2b563', 'muhammadyamin456@gmail.com', 'siswa', 'Muhammad Yamin', '2026-09-14 00:58:04.167363+00', '123456', null, null, null),
('b72fa256-20fe-4b7f-9f43-7c3ec8550882', 'wibiandinnuari@gmail.com', 'siswa', 'Wibi Andinnuari Hermawan', '2026-09-12 07:08:56.441702+00', '', null, null, null),
('dcd71894-8b54-447c-a1d0-94e4c5e78a43', 'adzkiyaratu456@gmail.com', 'siswa', 'Adzkiya Ratu Amatullah', '2026-09-12 06:55:26.200761+00', '123456', null, null, null),
('e755695d-cc6a-4cd1-8ad6-d53140953031', 'ignezbrithcyta456@gmail.com', 'siswa', 'Ignez Brithcyta Adinda Raga', '2026-09-12 07:01:33.180716+00', '123456', null, null, null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.guru_kelas (guru_id, kelas_id) VALUES
('64d9dc11-8559-4b44-acea-08f3f15fd6b4', '11111111-1111-1111-1111-111111111111'),
('64d9dc11-8559-4b44-acea-08f3f15fd6b4', '22222222-2222-2222-2222-222222222222'),
('7141932a-5b2c-4c06-ac2a-0fb854898fe8', '260dd853-b69b-4056-a9c4-62fe9f8eb202'),
('7141932a-5b2c-4c06-ac2a-0fb854898fe8', '7fcd4402-df34-45ad-92dc-b27da23fea66'),
('8fc5c674-9037-4c44-8ebe-7b365597fb3d', '33333333-3333-3333-3333-333333333333'),
('8fc5c674-9037-4c44-8ebe-7b365597fb3d', '412823fb-2492-4c51-9d0b-ec81d826f8e6')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa_kelas (siswa_id, kelas_id) VALUES
('17b0e933-1273-4120-8e04-7ae24bb48547', '412823fb-2492-4c51-9d0b-ec81d826f8e6'),
('1d427895-380d-472e-bd18-1efcd645bebb', '33333333-3333-3333-3333-333333333333'),
('3fb25d60-7324-48af-a1f9-c0811b2712cf', '33333333-3333-3333-3333-333333333333'),
('4bc60c2b-3373-4364-9f9c-77d1b115e4ee', '33333333-3333-3333-3333-333333333333'),
('61de38c7-3a16-4fed-a162-4c4d083fa158', '33333333-3333-3333-3333-333333333333'),
('635d71b6-2218-4b00-baab-190341f423a3', '11111111-1111-1111-1111-111111111111'),
('725aa615-9057-4959-bc30-1e5d1cb5f9c3', '11111111-1111-1111-1111-111111111111'),
('7ae01edd-94e7-46c7-b765-81079ac0963b', '33333333-3333-3333-3333-333333333333'),
('881f4e5b-cf94-4d07-8aa7-ef81ceb25e35', '412823fb-2492-4c51-9d0b-ec81d826f8e6'),
('90dd2f6a-e7b9-4e6d-8986-626f251cd77a', '412823fb-2492-4c51-9d0b-ec81d826f8e6'),
('9418e443-e91f-4454-85e4-83b0cf93f528', '33333333-3333-3333-3333-333333333333'),
('9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '11111111-1111-1111-1111-111111111111'),
('a7a55798-dfeb-4293-959e-dc462aeca66e', '412823fb-2492-4c51-9d0b-ec81d826f8e6'),
('b5a3ddd6-258a-4ac1-abd6-77246fd2b563', '11111111-1111-1111-1111-111111111111'),
('b72fa256-20fe-4b7f-9f43-7c3ec8550882', '412823fb-2492-4c51-9d0b-ec81d826f8e6'),
('dcd71894-8b54-447c-a1d0-94e4c5e78a43', '33333333-3333-3333-3333-333333333333'),
('e755695d-cc6a-4cd1-8ad6-d53140953031', '412823fb-2492-4c51-9d0b-ec81d826f8e6')
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai (id, siswa_id, bab_id, pengetahuan, kreativitas, created_at) VALUES
('3173d6d2-66fe-4e7e-a159-406979324937', '635d71b6-2218-4b00-baab-190341f423a3', 'b1111111-1111-1111-1111-111111111111', 100, 20, '2026-09-12 06:14:57.848684+00'),
('332fae1c-0059-4aa1-a076-9d354a2c94ca', '1d427895-380d-472e-bd18-1efcd645bebb', '4cac5ded-4164-41d2-a258-18af0adee0a8', 80, 90, '2026-09-14 01:08:07.848326+00'),
('3f7e34c0-a7be-442a-ab24-b55357efd576', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', 'b1111111-1111-1111-1111-111111111111', 79, 70, '2026-09-11 03:00:44.214271+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.presensi (id, siswa_id, kelas_id, tanggal, status, created_at) VALUES
('048afbac-fb91-43f7-be59-f2218ef90547', '9418e443-e91f-4454-85e4-83b0cf93f528', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('095c274c-2bdc-4995-bc2e-f89b7d70ae9b', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '11111111-1111-1111-1111-111111111111', '2026-09-12', 'izin', '2026-09-12 06:14:33.046686+00'),
('1b9db5d4-5a7c-419e-b41b-470afbcc087c', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '11111111-1111-1111-1111-111111111111', '2026-09-08', 'masuk', '2026-09-08 13:22:54.763996+00'),
('35363764-fa49-4be6-9c02-6f5a5bf962aa', '635d71b6-2218-4b00-baab-190341f423a3', '11111111-1111-1111-1111-111111111111', '2026-09-11', 'masuk', '2026-09-11 03:01:18.394989+00'),
('37f540a0-41ab-4433-afea-4dca3b69d7fe', '635d71b6-2218-4b00-baab-190341f423a3', '11111111-1111-1111-1111-111111111111', '2026-09-12', 'alpha', '2026-09-12 06:14:33.046686+00'),
('44c38843-fbc4-484c-8ddf-eddb14521cc7', '61de38c7-3a16-4fed-a162-4c4d083fa158', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('479b8931-c673-41e0-8db9-4750bfac3f94', '7ae01edd-94e7-46c7-b765-81079ac0963b', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('5819be4d-e06d-4ac9-82bb-b73b1f224492', '3fb25d60-7324-48af-a1f9-c0811b2712cf', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('94977377-bd4c-46cf-b44b-b80f3236d074', '1d427895-380d-472e-bd18-1efcd645bebb', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('b534c9f0-7668-483e-986e-785c37a314be', 'dcd71894-8b54-447c-a1d0-94e4c5e78a43', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('bb6340c8-3d02-4b8b-9941-39931d0da000', '725aa615-9057-4959-bc30-1e5d1cb5f9c3', '11111111-1111-1111-1111-111111111111', '2026-09-11', 'masuk', '2026-09-11 03:01:18.394989+00'),
('d5684a48-9325-4444-a926-ca748b132aeb', '4bc60c2b-3373-4364-9f9c-77d1b115e4ee', '33333333-3333-3333-3333-333333333333', '2026-09-14', 'masuk', '2026-09-14 01:02:53.445014+00'),
('d749c49c-abfa-441c-bc62-6813288e9ce1', '725aa615-9057-4959-bc30-1e5d1cb5f9c3', '11111111-1111-1111-1111-111111111111', '2026-09-12', 'sakit', '2026-09-12 06:14:33.046686+00'),
('f8109757-cb0a-4eb3-aef6-d4f1123b7b58', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '11111111-1111-1111-1111-111111111111', '2026-09-11', 'masuk', '2026-09-11 03:01:18.394989+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.soal (id, konten_id, pertanyaan, tipe, kunci_jawaban, created_at) VALUES
('0091264b-8011-4126-8165-57c8e8872afa', 'be0b26bb-5c05-417d-ad4b-3f8a359070f9', 'Harga 2 tiket anak dan 1 tiket dewasa Rp50.000, sedangkan 1 tiket anak dan 2 tiket dewasa Rp70.000. Berapa harga 1 tiket dewasa?|||["Rp20.000","Rp25.000","Rp30.000","Rp35.000"]|||false', 'pg', '["Rp30.000"]', '2026-09-13 22:46:09.271582+00'),
('011ddbeb-0d1b-4c99-b053-811a777d9fa3', '16145d27-e029-4744-8e67-60761272656b', 'Di kantin: 2 porsi mie dan 1 minuman seharga 29 koin. 1 porsi mie dan 2 minuman seharga 22 koin. Buatlah model SPLDV!', 'uraian', '2x + y = 29; x + 2y = 22', '2026-09-14 01:33:52.963869+00'),
('07eb71fd-5a39-4535-bbca-59a799395690', '16145d27-e029-4744-8e67-60761272656b', 'Shireen membeli 3 pensil dan 2 buku seharga 16 koin. Arvan membeli 2 pensil dan 3 buku seharga 19 koin. Tuliskan kedua persamaannya.', 'uraian', '3x + 2y = 16; 2x + 3y = 19', '2026-09-14 01:33:52.963869+00'),
('1609145e-426c-4b7f-83ca-1bcf3ad85cf2', '81494de5-8bfa-40d1-80b1-88b4de6fe47b', '3 bunga mawar dan 2 bunga matahari seharga Rp31.000, sedangkan 2 bunga mawar dan 1 bunga matahari Rp19.000. Berapa harga 1 bunga matahari?|||["Rp4.000","Rp5.000","Rp6.000","Rp7.000"]|||false', 'pg', '["Rp5.000"]', '2026-09-14 01:38:48.243364+00'),
('2767be03-505c-47da-a8d9-5deb6ed25e2a', 'be0b26bb-5c05-417d-ad4b-3f8a359070f9', '2 botol jus dan 3 botol air Rp21.000, sedangkan 3 botol jus dan 2 botol air Rp24.000. Berapa harga 1 botol jus?|||["Rp3.000","Rp4.000","Rp5.000","Rp6.000"]|||false', 'pg', '["Rp6.000"]', '2026-09-13 22:46:09.271582+00'),
('2e997e5f-de88-4799-b60a-42cda3181a81', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Tempat parkir berisi 10 mobil dan sepeda motor dengan 28 roda. Tentukan jumlah mobil dan sepeda motor.', 'uraian', 'x = 4, y = 6', '2026-09-14 01:28:22.648795+00'),
('3dd686de-ca96-4b99-bd17-8c1066c6dd9e', 'c2222222-2222-2222-2222-222222222222', '1 + 1 =|||["1","2"]|||false', 'pg', '["2"]', '2026-09-08 12:04:02.312448+00'),
('547fb844-d046-4cdc-9833-a9a22e04afff', '81494de5-8bfa-40d1-80b1-88b4de6fe47b', '2 burger dan 1 kentang Rp31.000, sedangkan 1 burger dan 2 kentang Rp26.000. Berapa harga 1 burger?|||["Rp10.000","Rp11.000","Rp12.000","Rp13.000"]|||false', 'pg', '["Rp12.000"]', '2026-09-14 01:38:48.243364+00'),
('68b6c65c-bb78-4d54-9e2c-59742c5f80b6', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Tuliskan persamaan kedua dari soal tiket dan lencana di Math Station.', 'uraian', 'x + 2y = 16', '2026-09-14 01:26:04.526991+00'),
('68fbc330-d3c3-46c2-9d3b-7e64c2409525', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Tentukan nilai x dan y dari soal tiket dan lencana di Math Station.', 'uraian', 'x = 6, y = 5', '2026-09-14 01:26:04.526991+00'),
('6bf3c07e-679c-4799-940e-b223e228487d', '81494de5-8bfa-40d1-80b1-88b4de6fe47b', 'Kolam berisi 18 ikan dan kepiting dengan total 24 kaki. Berapa jumlah kepiting?|||["4 ekor","5 ekor","6 ekor","8 ekor"]|||false', 'pg', '["6 ekor"]', '2026-09-14 01:38:48.243364+00'),
('7577bee1-9db6-4d69-a8e4-8fbab0b39a83', 'c3333333-3333-3333-3333-333333333333', 'keren|||["1","2","3","4"]', 'pg', '1', '2026-09-08 11:53:26.963569+00'),
('75def46c-a79a-4f8a-ab2d-0024ea4495dd', 'c3333333-3333-3333-3333-333333333333', 'apa nama buah yg berwarna merah', 'uraian', 'apel, semangka, ..', '2026-09-12 06:13:13.070032+00'),
('8312b335-ff20-481c-b0cf-ed3330ab8348', 'c3333333-3333-3333-3333-333333333333', 'siapa nama nabi terakhir|||["nabi muhammad","ada deh","..",".."]|||false', 'pg', '["nabi muhammad"]', '2026-09-12 06:13:13.070032+00'),
('88a034b0-cdfd-4a56-a30c-2a359c0249ec', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Buatlah persamaan berdasarkan jumlah roda kendaraan.', 'uraian', '4x + 2y = 28', '2026-09-14 01:28:22.648795+00'),
('97744a43-494f-4550-bb97-d322ec1437ad', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Buatlah persamaan berdasarkan jumlah kendaraan.', 'uraian', 'x + y = 10', '2026-09-14 01:28:22.648795+00'),
('b45f86a1-965a-4515-b9e7-94d82182eb74', 'c3333333-3333-3333-3333-333333333333', 'buah yg berwarna kuning', 'uraian', 'pisang', '2026-09-12 06:13:13.070032+00'),
('bb6b6121-8522-4a06-a7af-be852298a003', '81494de5-8bfa-40d1-80b1-88b4de6fe47b', 'Harga 3 Paket A dan 2 Paket B Rp46.000, harga 2 Paket A dan 3 Paket B Rp44.000. Berapa harga 1 Paket A?|||["Rp8.000","Rp9.000","Rp10.000","Rp11.000"]|||false', 'pg', '["Rp10.000"]', '2026-09-14 01:38:48.243364+00'),
('c2a6d6ba-edf0-4cd1-9d7b-6fc64df6647c', '16145d27-e029-4744-8e67-60761272656b', 'Berapa harga 1 pensil dan 1 buku?', 'uraian', 'Harga 1 pensil = 2 koin, Harga 1 buku = 5 koin', '2026-09-14 01:33:52.963869+00'),
('ca5c2cf0-c73e-405f-b12f-e9b68af0aa32', '16145d27-e029-4744-8e67-60761272656b', 'Tentukan nilai x dan y.', 'uraian', 'x = 2 y = 5', '2026-09-14 01:33:52.963869+00'),
('d09eb466-9aee-4908-b380-2e00788fefbf', 'be0b26bb-5c05-417d-ad4b-3f8a359070f9', '4 roti coklat dan 2 roti keju Rp28.000, sedangkan 2 roti coklat dan 3 roti keju Rp26.000. Berapa harga 1 roti keju?|||["Rp4.000","Rp5.000","Rp6.000","Rp7.000"]|||false', 'pg', '["Rp5.000"]', '2026-09-13 22:46:09.271582+00'),
('d571910d-f990-4bc4-8508-bab5cdd03270', 'c2222222-2222-2222-2222-222222222222', 'coba|||["1","2","3","4"]|||false', 'pg', '1', '2026-09-08 11:55:12.120969+00'),
('d641ea0f-356d-4445-b494-0df43531bcf1', 'be0b26bb-5c05-417d-ad4b-3f8a359070f9', '12 hewan terdiri dari ayam dan kambing dengan total 32 kaki. Berapa jumlah kambing?|||["3 ekor","4 ekor","5 ekor","6 ekor"]|||false', 'pg', '["4 ekor"]', '2026-09-13 22:46:09.271582+00'),
('ddd8f1fd-f8fc-4ea6-8153-93a1a88b92f4', '81494de5-8bfa-40d1-80b1-88b4de6fe47b', '15 siswa mendapat total 37 poin. Siswa laki-laki mendapat 3 poin dan perempuan 2 poin. Berapa jumlah siswa laki-laki?|||["5 siswa","6 siswa","7 siswa","8 siswa"]|||false', 'pg', '["7 siswa"]', '2026-09-14 01:38:48.243364+00'),
('e981ff0d-8dc3-43d0-9445-407d4748c0e8', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Tuliskan persamaan pertama soal tiket dan lencana.', 'uraian', '2x + y = 17', '2026-09-14 01:26:04.526991+00'),
('ee7065eb-6a0a-4c80-a79c-40148018f4d2', '16145d27-e029-4744-8e67-60761272656b', 'Tentukan variabel yang digunakan untuk harga mie dan minuman.', 'uraian', 'Harga mi = x, Harga minuman = y', '2026-09-14 01:33:52.963869+00'),
('ee71b39b-0b67-45b9-ba9e-c865a40f1715', '16145d27-e029-4744-8e67-60761272656b', 'Buatlah dua persamaan dan tentukan nilai x dan y.', 'uraian', '3x + y = 22; x + 2y = 14; x = 6; y = 4', '2026-09-14 01:33:52.963869+00'),
('f1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Tentukan nilai x dan y dari persamaan x + y = 5 dan x - y = 1. Tuliskan langkahnya!', 'uraian', 'x = 3, y = 2', '2026-09-08 11:45:25.568772+00'),
('f6b50b5c-723b-4577-b1fb-128856283f54', '16145d27-e029-4744-8e67-60761272656b', 'Tentukan satu porsi mie dan satu minuman.', 'uraian', 'x = 12; y = 5', '2026-09-14 01:33:52.963869+00'),
('f98ded3c-f2fc-4b10-9edb-ada2ebda7bee', '46cfef6b-faf9-4bde-9a3f-00fd51e42696', 'Berapa harga 1 tiket dan 1 lencana?', 'uraian', 'Harga tiket = 6 koin; harga lencana = 5 koin', '2026-09-14 01:26:04.526991+00'),
('f9cc9f8e-7882-4745-9daa-194d9f45ec92', 'be0b26bb-5c05-417d-ad4b-3f8a359070f9', 'Rombongan membawa 30 orang dengan mobil dan minibus. Kapasitas mobil 4 orang, minibus 6 orang, total kendaraan 6. Berapa jumlah minibus?|||["2 minibus","3 minibus","4 minibus","5 minibus"]|||false', 'pg', '["3 minibus"]', '2026-09-13 22:46:09.271582+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.jawaban_siswa (id, soal_id, siswa_id, jawaban, skor_ai, feedback_ai, skor_final, status, created_at) VALUES
('2a56da67-f60f-4afc-ba79-6a5a5635d78e', 'd571910d-f990-4bc4-8508-bab5cdd03270', '635d71b6-2218-4b00-baab-190341f423a3', '1', 100, 'Auto-Graded: Benar', null, 'pending_verifikasi', '2026-09-12 06:20:15.61111+00'),
('3ddffd53-74ee-4819-85a3-391409a9e68f', '7577bee1-9db6-4d69-a8e4-8fbab0b39a83', '635d71b6-2218-4b00-baab-190341f423a3', '1', 100, 'Auto-Graded: Benar', 84, 'final', '2026-09-08 14:52:26.688938+00'),
('3de04675-7026-4973-87c3-12b0c13e3b4f', 'd571910d-f990-4bc4-8508-bab5cdd03270', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '2', 84, 'Auto-Graded: Salah', 77, 'final', '2026-09-08 12:06:54.689298+00'),
('4fe19a12-3e29-4091-afd2-8486374b4a15', '0091264b-8011-4126-8165-57c8e8872afa', '1d427895-380d-472e-bd18-1efcd645bebb', 'Rp25.000', 0, 'Auto-Graded: Salah', 82, 'final', '2026-09-14 01:06:23.678971+00'),
('6f3edfee-c0ea-4687-8700-ab0bfc3a6754', '7577bee1-9db6-4d69-a8e4-8fbab0b39a83', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '2', 100, 'Auto-Graded: Salah', 77, 'final', '2026-09-08 12:05:00.724206+00'),
('70797476-4ec6-475e-81ea-3e11319061d4', 'f1111111-1111-1111-1111-111111111111', '635d71b6-2218-4b00-baab-190341f423a3', 'y =2, x=3', 85, 'Jawaban benar, sertakan langkah penyelesaian.', null, 'pending_verifikasi', '2026-09-12 06:20:15.61111+00'),
('921cc1f5-e74b-4232-8578-90e860109cc4', '2767be03-505c-47da-a8d9-5deb6ed25e2a', '1d427895-380d-472e-bd18-1efcd645bebb', 'Rp6.000', 100, 'Auto-Graded: Benar', 82, 'final', '2026-09-14 01:06:23.678971+00'),
('c0f1f6f1-c2d7-423a-8d94-f083350dabc8', 'f9cc9f8e-7882-4745-9daa-194d9f45ec92', '1d427895-380d-472e-bd18-1efcd645bebb', '3 minibus', 100, 'Auto-Graded: Benar', 82, 'final', '2026-09-14 01:06:23.678971+00'),
('ca2fd310-944a-4759-8b94-d77d946fc9c2', 'd641ea0f-356d-4445-b494-0df43531bcf1', '1d427895-380d-472e-bd18-1efcd645bebb', '4 ekor', 100, 'Auto-Graded: Benar', 82, 'final', '2026-09-14 01:06:23.678971+00'),
('e5d69f32-b880-4b0d-b4a5-842e58bd81cc', '3dd686de-ca96-4b99-bd17-8c1066c6dd9e', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', '2', 33, 'Auto-Graded: Benar', 77, 'final', '2026-09-08 12:06:54.689298+00'),
('f3e99900-3aea-45c7-a075-a2ed1d91d853', 'd09eb466-9aee-4908-b380-2e00788fefbf', '1d427895-380d-472e-bd18-1efcd645bebb', 'Rp5.000', 100, 'Auto-Graded: Benar', 82, 'final', '2026-09-14 01:06:23.678971+00'),
('f7d5e59e-b009-46d9-b3e4-5b2af2ee52a3', '3dd686de-ca96-4b99-bd17-8c1066c6dd9e', '635d71b6-2218-4b00-baab-190341f423a3', '', 0, 'Auto-Graded: Salah', null, 'pending_verifikasi', '2026-09-12 06:20:15.61111+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.jawaban_siswa (id, soal_id, siswa_id, jawaban, skor_ai, feedback_ai, skor_final, status, created_at)
VALUES ('6f576177-d5c5-4f52-a4d0-267272d85ee6', 'f1111111-1111-1111-1111-111111111111', '9ef3f86d-a329-42b2-b8f7-e1653c13f1c9', 'Diketahui x + y = 5 dan x - y = 1. Jumlahkan kedua persamaan: 2x = 6, sehingga x = 3. Substitusi ke persamaan pertama: 3 + y = 5, sehingga y = 2.', 100, 'Jawaban sangat tepat, lengkap, dan langkah penyelesaiannya runtut.', 77, 'final', '2026-09-08 12:06:54.689298+00')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- SEED DATA V2
-- ==========================================

DO $$
DECLARE
	guru_uid uuid := COALESCE((SELECT id FROM public.users WHERE id = 'f0000000-0000-0000-0000-000000000001' OR role = 'guru' ORDER BY (id = 'f0000000-0000-0000-0000-000000000001') DESC, created_at LIMIT 1), 'f0000000-0000-0000-0000-000000000001');
	siswa_uid uuid := COALESCE((SELECT id FROM public.users WHERE id = 'e0000000-0000-0000-0000-000000000001' OR role = 'siswa' ORDER BY (id = 'e0000000-0000-0000-0000-000000000001') DESC, created_at LIMIT 1), 'e0000000-0000-0000-0000-000000000001');
	kelas_id uuid := '11111111-1111-1111-1111-111111111111';
	bab_id uuid := 'b1111111-1111-1111-1111-111111111111';
	ujian_id uuid := 'd5555555-5555-5555-5555-555555555555';
	soal_id uuid := 'd6666666-6666-6666-6666-666666666666';
BEGIN
	IF EXISTS (SELECT 1 FROM public.users WHERE id = guru_uid)
		 AND EXISTS (SELECT 1 FROM public.users WHERE id = siswa_uid)
		 AND EXISTS (SELECT 1 FROM public.kelas WHERE id = kelas_id)
		 AND EXISTS (SELECT 1 FROM public.bab WHERE id = bab_id) THEN
		INSERT INTO public.jadwal (id, guru_id, kelas_id, hari, jam_mulai, jam_selesai)
		VALUES ('d1111111-1111-1111-1111-111111111111', guru_uid, kelas_id, 'Senin', '07:00', '08:30')
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.laporan (id, user_id, role, deskripsi, status)
		VALUES ('d2222222-2222-2222-2222-222222222222', siswa_uid, 'siswa', 'Video materi bab 1 tidak bisa diputar.', 'menunggu')
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.notifikasi (id, user_id, pesan, is_read)
		VALUES ('d4444444-4444-4444-4444-444444444444', siswa_uid, 'Nilai Bab 1 sudah diinput oleh guru.', false)
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.ujian (id, guru_id, kelas_id, jenis, deskripsi, durasi_menit)
		VALUES (ujian_id, guru_uid, kelas_id, 'UH', 'Ulangan Harian Bab 1 - SPLDV', 60)
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.soal_ujian (id, ujian_id, pertanyaan, butuh_foto_jawaban)
		VALUES (soal_id, ujian_id, 'Selesaikan SPLDV: 2x + y = 8 dan x - y = 1.', true)
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.jawaban_ujian (id, soal_id, siswa_id, jawaban_teks)
		VALUES ('d7777777-7777-7777-7777-777777777777', soal_id, siswa_uid, 'x = 3, y = 2')
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO public.forum_belajar (id, bab_id, user_id, pesan)
		VALUES ('d8888888-8888-8888-8888-888888888888', bab_id, siswa_uid, 'Bu, untuk soal nomor 2 boleh pakai metode substitusi juga?')
		ON CONFLICT (id) DO NOTHING;
	END IF;
END $$;
