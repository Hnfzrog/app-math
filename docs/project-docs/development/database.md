# Database Guidelines

## Description
This document outlines the database schema rules, updates, and guidelines for the Mathematics Learning Application based on the newly approved feature additions.

## Important
All table structures must be implemented via Supabase (PostgreSQL). Row Level Security (RLS) should be strictly enforced.

## Table of Contents
- Scope
- Goals
- Non Goals
- Schema Updates

## Scope
The database schema must support:
- Extended user profiles
- Helpdesk/Laporan
- Conflict-free automated scheduling (Jadwal)
- Notifications
- Attendance with Geolocation tracking
- Online Exams (Ujian) with Pakta Integritas logic
- Complex Grading (Penilaian)
- Discussions (Forum Belajar)

## Goals
- Provide complete data backing for the new admin, guru, and siswa features.
- Support 50m radius geolocation validations.

## Non Goals
- Migrating to non-Supabase platforms.

## Schema Updates

### 1. `users` Table Modifications
Add the following columns to `public.users`:
- `tahun_ajaran` (text)
- `foto_profil_url` (text, usage PENDING)
- `nomor_hp` (varchar(20)) — standardized from `no_telp` (decision 27 Sep 2026)
- `nama_wali` (text)
- `alamat` (text)

### 2. `laporan` Table (New)
Table for Helpdesk feature.
- `id` (uuid, pk)
- `user_id` (uuid, fk to users)
- `role` (text)
- `deskripsi` (text)
- `status` (text, check in ('menunggu', 'selesai'))
- `created_at` (timestamp)

### 3. `jadwal` Table (New)
Table for auto-generated schedule.
- `id` (uuid, pk)
- `guru_id` (uuid, fk to users)
- `kelas_id` (uuid, fk to kelas)
- `hari` (text, e.g., 'Senin', 'Selasa')
- `jam_mulai` (time)
- `jam_selesai` (time)

### 4. `notifikasi` Table (New)
Table for push/badge notifications.
- `id` (uuid, pk)
- `user_id` (uuid, fk to users)
- `pesan` (text)
- `is_read` (boolean, default false)
- `created_at` (timestamp)

### 5. `presensi` Table Modifications
Add columns for GPS validation.
- `latitude` (numeric)
- `longitude` (numeric)
- `status_validasi` (text, check in ('pending', 'valid', 'invalid'))
- `feedback_guru` (text)
- `foto_url` (text, usage PENDING)

### 6. `ujian` Table (New)
Table for exams created by Guru.
- `id` (uuid, pk)
- `guru_id` (uuid, fk to users)
- `kelas_id` (uuid, fk to kelas)
- `jenis` (text, check in ('UH', 'UTS', 'UAS'))
- `deskripsi` (text)
- `durasi_menit` (integer)
- `created_at` (timestamp)

### 7. `soal_ujian` and `jawaban_ujian` (New)
- `soal_ujian`: `id`, `ujian_id`, `pertanyaan`, `butuh_foto_jawaban` (boolean)
- `jawaban_ujian`: `id`, `soal_id`, `siswa_id`, `jawaban_teks`, `foto_url` (PENDING)

### 8. `nilai` Table Modifications
Update grading logic. Add columns to `public.nilai`:
- `skor_benar` (numeric)
- `skor_presensi` (numeric)
- `nilai_akhir` (numeric) -> derived in DB (generated column/trigger): `(skor_benar * 0.9) + (skor_presensi * 0.1)`; not only client-side
- `umpan_balik` (text)
- `umpan_balik_foto_url` (text, PENDING)

### 9. `forum_belajar` Table (New)
Table for discussion per chapter.
- `id` (uuid, pk)
- `bab_id` (uuid, fk to bab)
- `user_id` (uuid, fk to users)
- `pesan` (text)
- `created_at` (timestamp)

### 10. `pengaturan` Table (New)
School identity / config (single row, editable by admin).
- `id` (uuid, pk)
- `nama_sekolah` (text)
- `alamat` (text)
- `kop_surat` (text)
- `latitude_pusat` (numeric)
- `longitude_pusat` (numeric)
- `radius_meter` (integer, default 50)

### 11. `slot_jam` Table (New)
Master grid jadwal (slot jam pelajaran, dinamis — dikelola admin).
- `id` (uuid, pk)
- `jam_mulai` (time)
- `jam_selesai` (time)
- `created_at` (timestamp)

### 12. `hari` Table (New)
Master hari (dinamis, dikelola admin) — dipakai sebagai kolom grid jadwal.
- `id` (uuid, pk)
- `nama` (text, unique)
- `urutan` (integer)
- `created_at` (timestamp)

### Authoritative schema & RLS (decision 27 Sep 2026)
- `supabase_schema.sql` is the single canonical schema; `supabase_v2_migration.sql` is its incremental equivalent; `supabase_complete_setup.sql` and `reset_and_seed.sql` are legacy/alternative.
- RLS is strictly enforced: no `USING (true)` policies in the canonical schema. `disable_rls_for_demo.sql` is development-only and must never be applied to production.
- `status_validasi` must carry `CHECK (status_validasi IN ('pending','valid','invalid'))` in every schema file.
