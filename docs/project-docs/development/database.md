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
  - Alur: pg dinilai otomatis 0/100 saat submit; uraian dibantu AI (provider swappable via env `AI_PROVIDER` — default **Groq** `llama-3.3-70b-versatile`, alternatif Gemini; lihat `src/lib/aiScore.ts`); guru mengedit `skor_final` lalu memvalidasi (`status='final'`) lewat `/guru/ujian/[id]/hasil`.
  - Bila panggilan AI gagal (key kosong/limit), `/api/ujian/submit` **tidak** gagal: `skor_ai` dibiarkan `null` dan guru menilai esai secara manual.
  - Trigger `trg_notif_ujian_divalidasi` mengirim notifikasi ke siswa saat status berubah menjadi `final`.

### 8. `nilai` Table Modifications
Update grading logic. Add columns to `public.nilai`:
- `skor_benar` (numeric)
- `skor_presensi` (numeric)
- `nilai_akhir` (numeric) -> derived in DB (generated column/trigger): `(skor_benar * 0.9) + (skor_presensi * 0.1)`; not only client-side
- `umpan_balik` (text)
- `umpan_balik_foto_url` (text, PENDING) — disupersede oleh `umpan_balik_file_url`
- `umpan_balik_file_url` (text) — file perbaikan umum (PDF/doc/xls/ppt/gambar) untuk feedback tugas per bab

### 9. `forum_belajar` Table (New)
Table for discussion per chapter.
- `id` (uuid, pk)
- `bab_id` (uuid, fk to bab)
- `user_id` (uuid, fk to users)
- `pesan` (text)
- `created_at` (timestamp)
- `parent_id` (uuid, nullable, self-FK `ON DELETE CASCADE`) — balasan satu level (thread)
- `edited_at` (timestamptz, nullable) — penanda "diedit"
- `is_deleted` (boolean, NOT NULL, default `false`) — soft delete agar struktur thread utuh

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

### 13. `ujian_feedback` Table (New)
Feedback guru per siswa per ujian (satu arah guru → siswa).
- `id` (uuid, pk)
- `ujian_id` (uuid, fk to ujian, `ON DELETE CASCADE`)
- `siswa_id` (uuid, fk to users, `ON DELETE CASCADE`)
- `umpan_balik` (text) — feedback tulisan guru
- `file_url` (text) — lampiran file perbaikan (PDF/doc/gambar atau link Drive)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `UNIQUE (ujian_id, siswa_id)` — satu feedback per siswa per ujian

Alur: guru menulis feedback + lampiran di halaman hasil ujian → disimpan ke `ujian_feedback`.
Siswa membaca miliknya di halaman hasil ujian. Tidak ada insert policy untuk siswa (satu arah).

### Authoritative schema & RLS (decision 27 Sep 2026)
- `supabase_schema.sql` is the single canonical schema; `supabase_v2_migration.sql` is its incremental equivalent; `supabase_complete_setup.sql` and `reset_and_seed.sql` are legacy/alternative.
- RLS is strictly enforced: no `USING (true)` policies in the canonical schema. `disable_rls_for_demo.sql` is development-only and must never be applied to production.
- `status_validasi` must carry `CHECK (status_validasi IN ('pending','valid','invalid'))` in every schema file.

### 14. `pengumuman` Table (New)
Pengumuman admin/guru.
- `id` (uuid, pk)
- `author_id` (uuid, fk users)
- `author_role` (text, check in ('admin','guru'))
- `judul` (text)
- `deskripsi` (text)
- `tayang_sampai` (timestamptz) — batas waktu tayang; setelah ini pengumuman hilang
- `created_at` (timestamptz)

### 15. `pengumuman_target` Table (New) — audiens
- `id` (uuid, pk)
- `pengumuman_id` (uuid, fk pengumuman, `ON DELETE CASCADE`)
- `role` (text, nullable) — 'guru' | 'siswa'
- `kelas_id` (uuid, nullable, fk kelas)
- `user_id` (uuid, nullable, fk users)

Satu pengumuman bisa punya banyak baris target. Admin: role / user tertentu / semua. Guru: kelas / user tertentu / semua kelas.

### 16. `pelanggaran_ujian` Table (New)
Catatan pelanggaran mode ujian.
- `id` (uuid, pk)
- `ujian_id` (uuid, fk ujian, `ON DELETE CASCADE`)
- `siswa_id` (uuid, fk users)
- `jenis` (text, check in ('pindah_tab','keluar_halaman','keluar_fullscreen'))
- `durasi_detik` (integer) — lama di luar halaman
- `created_at` (timestamptz)

### 17. `nilai` Modifications — komponen penilaian per bab
Tambah kolom komponen ke `public.nilai` (tetap satu baris per siswa+bab, `UNIQUE (siswa_id, bab_id)`):
- `nilai_lkpd` (numeric)
- `nilai_tugas` (numeric)
- `nilai_uh` (numeric)
- `nilai_keaktifan` (numeric)

`nilai_akhir` (sudah ada) = **rata-rata SEDERHANA komponen yang terisi**, dihitung trigger `set_nilai_akhir` (NULL bila tidak ada komponen). Nilai LKPD/Tugas/UH murni pekerjaan siswa; keaktifan otomatis dari presensi + bisa diedit. Kolom lama `skor_benar`/`skor_presensi` tidak lagi dipakai (dibiarkan untuk kompatibilitas). `nilai_uh` diisi otomatis saat siswa submit UH.

### 18. `nilai_komponen`
Tidak dipakai — desain final memakai kolom komponen pada `nilai` (lihat #17), agar minimal dan kompatibel dengan pembaca `nilai_akhir` yang sudah ada (dashboard guru/siswa, e-Rapor).

### 19. `ujian` & `konten` — Pembahasan + Remedial
- `ujian`: +`pembahasan_file_url` (text), +`pembahasan_terbit_at` (timestamptz, nullable), +`pembahasan_is_terbit` (boolean default false), +`is_remedial` (boolean default false)
- `konten`: +`pembahasan_file_url`, +`pembahasan_terbit_at`, +`pembahasan_is_terbit`, +`is_remedial`

Pembahasan terbit otomatis saat semua siswa (yang ambil) selesai + 1 menit, atau pada `pembahasan_terbit_at`, atau override manual (guru).

**Mekanisme terbit:** trigger `trg_auto_terbit_pembahasan` (AFTER INSERT `jawaban_ujian`) mengisi `ujian.pembahasan_terbit_at = now() + 1 menit` begitu **semua siswa kelas** sudah mengumpulkan ujian tsb dan `pembahasan_file_url` terisi. Guru dapat menetapkan `pembahasan_terbit_at` (jadwal) atau `pembahasan_is_terbit = true` (terbit sekarang). Siswa melihat pembahasan bila `pembahasan_is_terbit` **atau** (`pembahasan_terbit_at` ≤ sekarang) dan file ada. Untuk tugas (konten) tidak ada auto-terbit — guru menyalakan `pembahasan_is_terbit`/jadwal.

### 20. `remedial_target` Table (New) — daftar siswa eksplisit
- `id` (uuid, pk)
- `item_type` (text, check in ('konten','ujian'))
- `item_id` (uuid)
- `siswa_id` (uuid, fk users, `ON DELETE CASCADE`)
- `created_at` (timestamptz)

Tugas/UH remedial (`is_remedial = true`) hanya terlihat/dikerjakan oleh siswa yang tercantum di `remedial_target`.

### 21. `nilai_item` Table (New) — penilaian PER ITEM (Opsi B, 7 Okt 2026)
- `id` (uuid, pk)
- `siswa_id` (uuid, fk users, `ON DELETE CASCADE`)
- `item_type` (text, check in ('konten','ujian'))
- `item_id` (uuid) — referensi `konten.id` (LKPD/tugas) atau `ujian.id` (UH)
- `skor` (numeric, 0–100) — skor item; NULL = belum dinilai
- `dinilai_at` (timestamptz)
- `UNIQUE (siswa_id, item_type, item_id)` — satu skor per siswa per item

**Model penilaian final:** tiap tugas/LKPD/UH dinilai **per item**. Kolom komponen pada `nilai` (`nilai_lkpd`/`nilai_tugas`/`nilai_uh`) = **rata-rata `skor` item** di bab tsb, dihitung trigger `recompute_nilai_komponen` (AFTER INSERT/UPDATE/DELETE pada `nilai_item`) → lalu `nilai_akhir` (rata-rata komponen terisi) ikut terhitung. `/api/ujian/submit` (UH) menulis `nilai_item` (item_type='ujian'), bukan `nilai` langsung. **UTS/UAS tidak per-bab** — dinilai terpisah di halaman hasil ujian (E3).

### 22. `bab` — kolom semester
- +`semester` (text, check in ('ganjil','genap'), default 'ganjil') — menandai semester tiap bab; nilai mewarisi semester lewat bab.

### 23. `rapor` Table (New) — status terbit per kelas + semester
- `id` (uuid, pk)
- `kelas_id` (uuid, fk kelas, `ON DELETE CASCADE`)
- `semester` (text, check in ('ganjil','genap'))
- `tahun_ajaran` (text)
- `is_terbit` (boolean, NOT NULL, default false)
- `terbit_at` (timestamptz)
- `created_at` (timestamptz)
- `UNIQUE (kelas_id, semester)` — satu rapor per kelas per semester

### 24. `rapor_siswa` Table (New) — deskripsi manual per siswa
- `id` (uuid, pk)
- `rapor_id` (uuid, fk rapor, `ON DELETE CASCADE`)
- `siswa_id` (uuid, fk users, `ON DELETE CASCADE`)
- `kegiatan_pengembangan` (jsonb) — `[{kegiatan, deskripsi}]`
- `akhlak_kepribadian` (jsonb) — `[{deskripsi}]`
- `catatan_wali_kelas` (text)
- `created_at`, `updated_at` (timestamptz)
- `UNIQUE (rapor_id, siswa_id)`

### 25. `pengaturan` — kolom kkm
- +`kkm` (numeric, default 75) — ambang ketuntasan untuk kolom KKM rapor.

RLS `rapor` + `rapor_siswa`: guru wali kelas (via `guru_kelas`) read/write; siswa read hanya baris miliknya saat `rapor.is_terbit = true`.

**Trigger `trg_notif_rapor_terbit`** — saat `rapor.is_terbit` berubah menjadi `true`, kirim notifikasi "Rapor semester … sudah diterbitkan" ke semua siswa sekelas (SECURITY DEFINER, menulis ke `notifikasi`).
