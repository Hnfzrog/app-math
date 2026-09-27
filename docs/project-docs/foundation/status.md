# Status — Gap Closure Execution

## Description
Execution plan and progress for the completeness pass approved 27 Sep 2026.

## Important
Photos are DEFERRED (awaiting storage bucket). All other items are in scope.

## Table of Contents
- Scope
- Goals
- Non Goals
- Batches
- Progress

## Scope
Close the 23 approved non-photo gaps listed in `foundation/prd.md` → "Gap Closure — Completeness Pass".

## Goals
- Fix all data-integrity bugs and schema drift.
- Replace all dummy/hardcoded data with DB/config-driven values.
- Close the per-role feature gaps (Admin, Guru, Siswa).

## Non Goals
- Photo upload features (deferred).
- Mobile app (web responsive only).

## Batches (execution order)

### Batch 1 — Data integrity (critical)
1. Rename `no_telp` → `nomor_hp` in `admin/profile`, `admin/users`, `guru/kelas/[id]`.
2. Persist `tahun_ajaran` in `api/admin/create-user/route.ts`.
3. Add `pengaturan` table + seed to `supabase_schema.sql`.
4. Enforce `status_validasi` CHECK + strict RLS; mark legacy SQL files.
5. Add `nilai_akhir` generated column/trigger in DB.

### Batch 2 — Cross-cutting UI
6. Wire notification badge to `notifikasi` (all roles).
7. Real PDF (letterhead) helper; apply to populasi, jadwal, presensi, e-Rapor.
8. Config-driven school identity (`pengaturan`) for kop surat + presensi center + radius.

### Batch 3 — Role feature gaps (ordered by impact)
9. Siswa sidebar links (Presensi, Ujian, Helpdesk).
10. Penilaian Menyeluruh per-bab table + Tunggal verify/bab.
11. Ujian siswa: rules step + Pakta Integritas (name + setuju).
12. Kelas Saya guru: file upload + deadline.
13. Admin dashboard chart from `laporan`.
14. Daftar Populasi: alamat + nama_wali + phone fix.
15. Nilai Saya: per-bab grouping + verification status + e-Rapor gating.
16. Forum Belajar visible to guru.
17. Helpdesk siswa floating button.
18. Auto-scheduler constraint-solving.
19. Hygiene: delete-user log path + rename `Website%20Design.md`.

## Progress
- [x] Spec frozen in `prd.md` + `database.md`
- [x] Batch 1 — data integrity (nomor_hp, tahun_ajaran, pengaturan, nilai_akhir trigger, RLS, legacy markers, deadline, unique constraint)
- [x] Batch 2 — notifikasi badge, PDF helper (jsPDF + kop surat), helpdesk floating, Daftar Populasi PDF
- [~] Batch 3 — done: sidebar siswa, chart admin, kolom alamat, ujian siswa (rules+pakta), deadline tugas, penilaian per-bab, nilai per-bab. Remaining: PDF jadwal/presensi/e-rapor, forum guru, presensi 50m server-side, dashboard chart guru/siswa, auto-scheduler.
- [ ] Photos — DEFERRED (bucket belum siap)
