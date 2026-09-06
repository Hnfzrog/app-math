-- 1. EXTENSION PENGAMANAN & CRYPTO
create extension if not exists pgcrypto;

-- 2. HAPUS DATA LAMA (Hati-hati: ini akan mereset data)
delete from public.nilai;
delete from public.presensi;
delete from public.jawaban_siswa;
delete from public.soal;
delete from public.konten;
delete from public.bab;
delete from public.guru_kelas;
delete from public.siswa_kelas;
delete from public.kelas;
-- Kita biarkan auth.users dan public.users agar tidak merusak auth yg sudah ada,
-- tapi kita update saja kalau sudah ada.

-- 3. INSERT DUMMY KELAS
insert into public.kelas (id, nama)
values 
  ('11111111-1111-1111-1111-111111111111', '7'),
  ('22222222-2222-2222-2222-222222222222', '8'),
  ('33333333-3333-3333-3333-333333333333', '9')
on conflict (id) do nothing;

-- 4. INSERT DUMMY BAB UNTUK KELAS 7
insert into public.bab (id, kelas_id, nomor, judul)
values
  ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Sistem Persamaan Linear Dua Variabel (SPLDV)'),
  ('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, 'Teorema Pythagoras')
on conflict (id) do nothing;

-- 5. INSERT KONTEN UNTUK BAB 1
insert into public.konten (id, bab_id, tipe, judul, file_url)
values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'emateri', 'Materi 1: Pengenalan SPLDV', 'https://example.com/materi.pdf'),
  ('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'lkpd', 'LKPD 1: SPLDV Metode Substitusi', null),
  ('c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'banksoal', 'Latihan Soal SPLDV', null)
on conflict (id) do nothing;

-- 6. INSERT SOAL UNTUK LKPD
insert into public.soal (id, konten_id, pertanyaan, tipe, kunci_jawaban)
values
  ('f1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Tentukan nilai x dan y dari persamaan x + y = 5 dan x - y = 1. Tuliskan langkahnya!', 'uraian', 'x = 3, y = 2. Langkah: (1) Jumlahkan kedua persamaan: 2x = 6 -> x = 3. (2) Substitusi x ke pers 1: 3 + y = 5 -> y = 2.')
on conflict (id) do nothing;

-- 7. INSERT DUMMY USER KE AUTH (ADMIN, GURU, SISWA)
-- Password semuanya adalah: password123
DO $$
DECLARE
  admin_uid uuid := 'a0000000-0000-0000-0000-000000000001';
  guru_uid uuid := 'f0000000-0000-0000-0000-000000000001';
  siswa1_uid uuid := 'e0000000-0000-0000-0000-000000000001';
  siswa2_uid uuid := 'e0000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email"}', '{}');
    -- Fix role (trigger automatically sets 'siswa')
    UPDATE public.users SET role = 'admin', nama = 'Bapak Kepala Admin' WHERE id = admin_uid;
  END IF;

  -- Insert Guru
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = guru_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (guru_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guru@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email"}', '{}');
    UPDATE public.users SET role = 'guru', nama = 'Ibu Guru Matematika' WHERE id = guru_uid;
    -- Assign Guru to Kelas 7 & 8
    INSERT INTO public.guru_kelas (guru_id, kelas_id) VALUES (guru_uid, '11111111-1111-1111-1111-111111111111'), (guru_uid, '22222222-2222-2222-2222-222222222222') ON CONFLICT DO NOTHING;
  END IF;

  -- Insert Siswa 1
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = siswa1_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (siswa1_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'siswa@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email"}', '{}');
    UPDATE public.users SET nama = 'Andi Siswa Rajin' WHERE id = siswa1_uid;
    -- Assign Siswa to Kelas 7
    INSERT INTO public.siswa_kelas (siswa_id, kelas_id) VALUES (siswa1_uid, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
    
    -- Insert Dummy Presensi Siswa 1
    INSERT INTO public.presensi (siswa_id, kelas_id, tanggal, status) VALUES (siswa1_uid, '11111111-1111-1111-1111-111111111111', current_date, 'masuk') ON CONFLICT DO NOTHING;
    
    -- Insert Dummy Jawaban LKPD Siswa 1
    INSERT INTO public.jawaban_siswa (soal_id, siswa_id, jawaban, skor_ai, feedback_ai, status)
    VALUES ('f1111111-1111-1111-1111-111111111111', siswa1_uid, 'x+y=5. lalu x-y=1. x nya 3, y nya 2', 85, 'Benar, tapi tolong sertakan cara eliminasinya.', 'pending_verifikasi') ON CONFLICT DO NOTHING;
  END IF;

  -- Insert Siswa 2
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = siswa2_uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (siswa2_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budi@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email"}', '{}');
    UPDATE public.users SET nama = 'Budi Santoso' WHERE id = siswa2_uid;
    -- Assign Siswa 2 to Kelas 7
    INSERT INTO public.siswa_kelas (siswa_id, kelas_id) VALUES (siswa2_uid, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
  END IF;

END $$;
