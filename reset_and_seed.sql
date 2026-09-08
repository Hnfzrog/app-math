-- 1. HAPUS SEMUA DATA (RESET)
-- Urutan penghapusan penting untuk menghindari error foreign key.
-- Menghapus auth.users akan otomatis menghapus public.users dan data terkait lainnya jika menggunakan CASCADE (sesuai skema yang ada).
DELETE FROM public.nilai;
DELETE FROM public.presensi;
DELETE FROM public.jawaban_siswa;
DELETE FROM public.soal;
DELETE FROM public.konten;
DELETE FROM public.bab;
DELETE FROM public.guru_kelas;
DELETE FROM public.siswa_kelas;
DELETE FROM public.kelas;
DELETE FROM public.users;
-- Hapus semua user
DELETE FROM auth.identities;
DELETE FROM auth.users;


-- 2. INJECT DATA (SEEDING)

-- Insert Kelas
INSERT INTO public.kelas (id, nama, angkatan, sub_kelas)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '7A', '7', 'A'),
  ('22222222-2222-2222-2222-222222222222', '7B', '7', 'B'),
  ('33333333-3333-3333-3333-333333333333', '8A', '8', 'A'),
  ('44444444-4444-4444-4444-444444444444', '9', '9', null)
ON CONFLICT (id) DO NOTHING;

-- Insert Bab
INSERT INTO public.bab (id, kelas_id, nomor, judul)
VALUES
  ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Sistem Persamaan Linear Dua Variabel (SPLDV)'),
  ('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, 'Teorema Pythagoras')
ON CONFLICT (id) DO NOTHING;

-- Insert Konten
INSERT INTO public.konten (id, bab_id, tipe, judul, file_url)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'emateri', 'Materi 1: Pengenalan SPLDV', 'https://example.com/materi.pdf'),
  ('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'lkpd', 'LKPD 1: SPLDV Metode Substitusi', null),
  ('c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'banksoal', 'Latihan Soal SPLDV', null)
ON CONFLICT (id) DO NOTHING;

-- Insert Soal
INSERT INTO public.soal (id, konten_id, pertanyaan, tipe, kunci_jawaban)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Tentukan nilai x dan y dari persamaan x + y = 5 dan x - y = 1. Tuliskan langkahnya!', 'uraian', 'x = 3, y = 2. Langkah: (1) Jumlahkan kedua persamaan: 2x = 6 -> x = 3. (2) Substitusi x ke pers 1: 3 + y = 5 -> y = 2.')
ON CONFLICT (id) DO NOTHING;

-- Insert Users
DO $$
DECLARE
  admin_uid uuid := 'a0000000-0000-0000-0000-000000000001';
  guru_uid uuid := 'f0000000-0000-0000-0000-000000000001';
  siswa1_uid uuid := 'e0000000-0000-0000-0000-000000000001';
  siswa2_uid uuid := 'e0000000-0000-0000-0000-000000000002';
BEGIN
  -- 1. Insert Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');
    
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_uid, admin_uid::text, format('{"sub":"%s","email":"%s"}', admin_uid::text, 'admin@gmail.com')::jsonb, 'email', now(), now());

    UPDATE public.users SET role = 'admin', nama = 'Bapak Kepala Admin' WHERE id = admin_uid;
  END IF;

  -- 2. Insert Guru
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = guru_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (guru_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guru@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');
    
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid(), guru_uid, guru_uid::text, format('{"sub":"%s","email":"%s"}', guru_uid::text, 'guru@gmail.com')::jsonb, 'email', now(), now());

    UPDATE public.users SET role = 'guru', nama = 'Ibu Guru Matematika' WHERE id = guru_uid;
    
    INSERT INTO public.guru_kelas (guru_id, kelas_id) 
    VALUES (guru_uid, '11111111-1111-1111-1111-111111111111'), (guru_uid, '44444444-4444-4444-4444-444444444444') ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Insert Siswa 1 (Lengkap dengan Biodata)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = siswa1_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (siswa1_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'siswa@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');
    
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid(), siswa1_uid, siswa1_uid::text, format('{"sub":"%s","email":"%s"}', siswa1_uid::text, 'siswa@gmail.com')::jsonb, 'email', now(), now());

    UPDATE public.users 
    SET 
      nama = 'Andi Siswa Rajin',
      nisn = '0012345678',
      tanggal_lahir = '2010-05-14',
      jenis_kelamin = 'Laki-laki',
      nomor_hp = '081234567890'
    WHERE id = siswa1_uid;
    
    INSERT INTO public.siswa_kelas (siswa_id, kelas_id) VALUES (siswa1_uid, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
    INSERT INTO public.presensi (siswa_id, kelas_id, tanggal, status) VALUES (siswa1_uid, '11111111-1111-1111-1111-111111111111', current_date, 'masuk') ON CONFLICT DO NOTHING;
    INSERT INTO public.jawaban_siswa (soal_id, siswa_id, jawaban, skor_ai, feedback_ai, status)
    VALUES ('f1111111-1111-1111-1111-111111111111', siswa1_uid, 'x+y=5. lalu x-y=1. x nya 3, y nya 2', 85, 'Benar, tapi tolong sertakan cara eliminasinya.', 'pending_verifikasi') ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Insert Siswa 2 (Lengkap dengan Biodata)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = siswa2_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (siswa2_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budi@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}');
    
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid(), siswa2_uid, siswa2_uid::text, format('{"sub":"%s","email":"%s"}', siswa2_uid::text, 'budi@gmail.com')::jsonb, 'email', now(), now());

    UPDATE public.users 
    SET 
      nama = 'Budi Santoso',
      nisn = '0098765432',
      tanggal_lahir = '2010-11-20',
      jenis_kelamin = 'Laki-laki',
      nomor_hp = '089876543210'
    WHERE id = siswa2_uid;
    
    INSERT INTO public.siswa_kelas (siswa_id, kelas_id) VALUES (siswa2_uid, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
  END IF;

END $$;
