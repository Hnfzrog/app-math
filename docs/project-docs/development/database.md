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
- `foto_url` (text — diisi dari kamera langsung via `CameraCapture` + `uploadImage(file, 'presensi')`)

`status` (text, **NOT NULL**): nilai yang sah menurut CHECK constraint adalah
**`masuk` | `izin` | `sakit` | `alpha`**. Gunakan `masuk` untuk kehadiran — bukan `hadir`
(nilai `hadir` tidak ada di constraint mana pun dan insert-nya akan ditolak).

Dua sumber baris presensi:
1. **Siswa** — presensi mandiri dengan GPS (radius dari `pengaturan.radius_meter`); `status_validasi` default `pending`.
2. **Guru** — input manual per siswa atau sekelas sekaligus (`/guru/presensi` → "Input Presensi Manual"), foto wajib dari kamera, `status_validasi` langsung `valid`, `latitude`/`longitude` null.

Tidak ada UNIQUE `(siswa_id, tanggal)` — pencegahan presensi ganda dilakukan di aplikasi
(form guru menandai dan mengunci siswa yang sudah tercatat hari ini).

### 6. `ujian` Table (New)
Table for exams created by Guru.
- `id` (uuid, pk)
- `guru_id` (uuid, fk to users)
- `kelas_id` (uuid, fk to kelas)
- `jenis` (text, check in ('UH', 'UTS', 'UAS'))
- `deskripsi` (text)
- `durasi_menit` (integer)
- `mulai_at` (timestamptz, nullable) — jadwal buka
- `selesai_at` (timestamptz, nullable) — jadwal tutup
- `is_terbit` (boolean, NOT NULL, default `false`) — status terbit
- `created_at` (timestamp)

**Jadwal & terbit.** Guru wajib mengisi `mulai_at`/`selesai_at` di form; kolomnya nullable di DB
supaya ujian lama (yang belum punya jadwal) tidak menggagalkan migrasi. Integritas dijaga
constraint `ujian_jadwal_check`: ujian hanya boleh `is_terbit = true` bila kedua jadwal terisi
dan `selesai_at > mulai_at`.

Alurnya: ujian baru default **DRAF** → siswa tidak melihatnya sama sekali (`/siswa/ujian`
memfilter `is_terbit = true`, dan policy `ujian read` juga membatasi) → guru menerbitkan →
siswa melihat jadwalnya dan tombolnya aktif sesuai status:

| Status | Syarat | Tombol siswa |
|---|---|---|
| DRAF | `is_terbit = false` | (tidak tampil) |
| BELUM DIBUKA | `now < mulai_at` | nonaktif |
| BERLANGSUNG | di dalam jendela | Mulai Ujian |
| DITUTUP | `now > selesai_at` | nonaktif |

Jadwal bersifat **gerbang masuk saja**: begitu siswa mulai, yang mengatur hanya `durasi_menit`.
`/api/ujian/submit` menolak ujian yang belum terbit, tapi tidak mengecek waktu — supaya siswa
yang sudah terlanjur mulai tetap bisa mengumpulkan.

Trigger `trg_notif_ujian_terbit_ins` / `trg_notif_ujian_terbit_upd` mengirim notifikasi ke siswa
sekelas saat ujian menjadi terbit (menggantikan `trg_notif_ujian_baru` yang menembak saat INSERT).

### 7. `soal_ujian`, `soal_ujian_kunci`, and `jawaban_ujian` (New)
- `soal_ujian`: `id`, `ujian_id`, `pertanyaan`, `tipe` (text, check in ('pg','uraian')), `opsi` (jsonb — daftar opsi pilihan ganda), `multi_jawaban` (boolean — pg dengan lebih dari satu jawaban benar), `butuh_foto_jawaban` (boolean), `lampiran_url`
- `soal_ujian_kunci`: `soal_id` (pk, fk ke `soal_ujian`), `kunci_jawaban` (text — pg: JSON array teks opsi benar, mengikuti format `soal.kunci_jawaban`; uraian: kunci/rubrik acuan AI), `pembahasan`, `created_at`
  - **Tabel terpisah dengan sengaja**: policy baca `soal_ujian` terbuka untuk guru (dipakai fitur "Ambil Soal dari Ujian Lain"), jadi kunci tidak boleh ikut terbaca. Siswa tidak punya policy sama sekali; guru hanya untuk ujian kelasnya.
  - Penilaian karena itu dijalankan server-side lewat `POST /api/ujian/submit` (kunci tidak pernah sampai ke browser).
- `jawaban_ujian`: `id`, `soal_id`, `siswa_id`, `jawaban_teks` (pg: teks opsi, multi-jawaban: JSON array), `foto_url`, `skor_ai`, `feedback_ai`, `skor_final`, `dinilai_at`, `status` (text, check in ('pending_verifikasi','final')), `created_at`
  - Alur: pg dinilai otomatis 0/100 saat submit; uraian dibantu Gemini; guru mengedit `skor_final` lalu memvalidasi (`status='final'`) lewat `/guru/ujian/[id]/hasil`.
  - Trigger `trg_notif_ujian_divalidasi` mengirim notifikasi ke siswa saat status berubah menjadi `final`.

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
