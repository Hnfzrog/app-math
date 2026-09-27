# Product Requirements Document

## Description
This document outlines the product requirements for the Mathematics Learning Application, with the recently approved additional requirements from the client (22 Sep 2026).

## Important
All features related to photo/image upload are marked as PENDING and should not be implemented until client confirmation.

## Table of Contents
- Scope
- Goals
- Non Goals
- Features: Admin
- Features: Guru
- Features: Siswa

## Scope
The application serves three distinct roles: Admin, Guru, and Siswa. The platform acts as a Learning Management System specifically tailored with mathematical features, automated scheduling, geolocation-based attendance, and automated grading with a fixed formula (90% score, 10% attendance).

## Goals
- Provide an integrated platform for teaching, grading, and reporting.
- Implement conflict-free automated scheduling based on admin preferences.
- Automate report card (e-Rapor) and attendance generation to PDF with official headers.
- Provide a helpdesk (Laporan) for users to report bugs to the admin.
- Ensure strict attendance via 50m GPS radius restriction.

## Non Goals
- Mobile App development (only web responsive).
- Any features related to image uploads (PENDING).

## Features: Admin
1. **Dashboard**: Greeting, Notification badge, Stat cards (Siswa, Kelas, Guru), shortcut to Laporan, and Chart for Laporan Status (Selesai vs Menunggu).
2. **Profile**: Update identity details (name, phone, address, password). Photo upload is PENDING.
3. **Kelola Populasi**: Add user form (Admin/Guru/Siswa) with `tahun_ajaran` and auto-generated emails.
4. **Daftar Populasi**: List users with filter by `tahun_ajaran` and `kelas`. Export to PDF with official header.
5. **Master Class**: Manage classes.
6. **Management Jadwal**: Generate conflict-free schedules based on teacher preferences. Alert if conflicts exist. Export PDF.
7. **Laporan / Helpdesk**: View and toggle reports from Siswa/Guru (Selesai/Menunggu).

## Features: Guru
1. **Dashboard**: Greeting, Notif badge, Stats (Siswa, Kelas), achievement chart, and today's schedule reminder.
2. **Profile**: Edit password, address, phone. Photo upload is PENDING.
3. **Kelas Saya**: Manage materials, tasks, LKPD with deadlines.
4. **Ujian**: Create UH/UTS/UAS with descriptions, durations, and question counts.
5. **Presensi**: Validate attendance submitted by Siswa. Export PDF.
6. **Penilaian**: 
   - Tunggal: Verify answers, give text feedback (upload photo PENDING). Auto grade: `(Score * 0.9) + (Attendance * 0.1)`.
   - Menyeluruh: Class average table for all chapters.

## Features: Siswa
1. **Dashboard**: Greeting, Notif badge, Stats (Materi, LKPD, Tugas, Ujian), chart, today's schedule, "What's New".
2. **Profile**: Update phone, guardian name, address. Photo upload is PENDING.
3. **Presensi Mandiri**: Automatic geolocation attendance (within 50m radius). Direct camera photo is PENDING.
4. **Kelas Saya**: View class info, classmates, Forum Belajar per chapter. Image answers upload is PENDING.
5. **Ujian**: View rules -> Sign Pakta Integritas -> Exam UI with timer and navigator. Upload photo answer is PENDING.
6. **Nilai Saya**: View grades and teacher feedback. Auto-generate e-Rapor PDF when all chapters are done.

## Gap Closure — Completeness Pass (27 Sep 2026)

Decisions approved 27 Sep 2026 after a full code audit. Photos are **DEFERRED** (awaiting storage bucket); all other items are approved for implementation.

### Decisions (non-photo)
1. **Phone column** — standardize on `nomor_hp`; rename all `no_telp` references in code; update `database.md`.
2. **`tahun_ajaran`** — `create-user` API must persist it (currently dropped).
3. **RLS** — strictly enforced; no `USING (true)` policies in the authoritative schema; `disable_rls_for_demo.sql` is dev-only.
4. **Single authoritative schema** — `supabase_schema.sql` is canonical; `supabase_v2_migration.sql` is its incremental equivalent; `supabase_complete_setup.sql` + `reset_and_seed.sql` are legacy/alternative.
5. **`status_validasi`** — `CHECK (status_validasi IN ('pending','valid','invalid'))` in every schema file.
6. **`nilai_akhir`** — derived in the DB (generated column/trigger), not only client-side.
7. **Anti-hardcode** — no dummy data; every displayed value comes from the DB, a config table, or a documented business-rule constant.
8. **Config table** — new `pengaturan` table (single row) for school identity: `nama_sekolah`, `alamat`, `kop_surat`, `latitude_pusat`, `longitude_pusat`, `radius_meter` (default 50).
9. **Notifications** — badge reads `notifikasi.is_read`, clears on open (all roles).
10. **PDF** — real PDF generation with letterhead (dynamic titles), replacing every `window.print()`.
11. **Admin dashboard chart** — sourced from the `laporan` table.
12. **Daftar Populasi** — add `alamat` + `nama_wali`, phone from `nomor_hp`, alphabetical, correct filters.
13. **Auto-scheduler** — constraint-satisfaction (teacher AND class non-overlap).
14. **Kelas Saya (guru)** — file upload + deadline (date + time).
15. **Ujian (guru)** — `jumlah_soal` field.
16. **Presensi (guru)** — 50 m server-side check, show student photo, real PDF.
17. **Penilaian Tunggal** — pick bab + verify-answers UI. **Menyeluruh** — per-bab auto table (No / Nama / Bab 1 / Bab 2 / … / Rata-rata).
18. **Siswa sidebar** — add Presensi, Ujian, Helpdesk links.
19. **Ujian (siswa)** — rules/"paham" step → Pakta Integritas (name + setuju) → exam; per-question photo upload.
20. **Nilai Saya** — group per bab, show verification status, e-Rapor gated on all-bab-complete.
21. **Forum Belajar** — visible to guru too.
22. **Helpdesk (siswa)** — floating call-center button bottom-right.
23. **Hygiene** — remove hardcoded log path in `delete-user/route.ts`; rename `Website%20Design.md` → `Website Design.md`.

### Deferred (photo — awaiting storage bucket)
- Upload wiring for `foto_profil_url`, `presensi.foto_url`, `jawaban_ujian.foto_url`, `umpan_balik_foto_url`.
- Profile photo (admin/guru/siswa), direct-camera presensi photo, per-question answer photo, umpan-balik photo.

### Assumption (to confirm)
- School identity + presensi center coordinates live in the `pengaturan` table (editable by admin via UI).
