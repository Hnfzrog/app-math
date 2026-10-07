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
- [x] Ujian pilgan + auto-nilai + validasi guru (28 Sep 2026) — tipe soal pg/uraian, kunci di `soal_ujian_kunci`, penilaian server-side (`/api/ujian/submit`), ambil soal antar ujian (`/api/ujian/import-soal`), halaman hasil guru dengan accordion per siswa + validasi massal, navigator soal kiri dengan penanda warna + flag, modal konfirmasi submit.
- [x] Ujian: jadwal buka/tutup + Terbitkan (28 Sep 2026) — jadwal wajib diisi, ujian default DRAF dan hanya muncul ke siswa setelah diterbitkan (`is_terbit` + CHECK `ujian_jadwal_check`), guru bisa Edit ujian, halaman siswa menampilkan jadwal + badge status, jadwal sebagai gerbang masuk saja. Sekaligus **perbaikan bug**: `params` sinkron di `/siswa/ujian/[id]` (dihapus di Next 16) yang membuat halaman selalu "Ujian tidak ditemukan" sehingga **pakta integritas tidak pernah tercapai**; tombol "Simpan Soal" yang nonaktif sejak modal dibuka; dan 15+ kelas CSS tak terdefinisi di halaman ujian siswa.
- [x] Sidebar siswa disunat jadi 6 menu sesuai `Website Design.md` (28 Sep 2026) — Dashboard, Profil Saya, Presensi, Kelas Saya, Ujian, Nilai Saya. Materi & Tugas tetap terjangkau lewat Kelas Saya; Helpdesk lewat tombol float.
- [x] Presensi manual guru (28 Sep 2026) — input per siswa & sekelas sekaligus dengan foto wajib dari kamera (`CameraCapture`), `status_validasi` langsung `valid`, duplikat dicegah di aplikasi. Sekaligus **perbaikan bug**: status `'hadir'` → `'masuk'` (nilai `'hadir'` ditolak CHECK constraint DB, sehingga presensi siswa tidak pernah tersimpan) + perbaikan badge status di halaman guru.
- [x] Feedback, Forum & Kamera (28 Sep 2026) — fix kamera presensi (`CameraCapture`: `facingMode` ideal + callback-ref `srcObject`+`.play()` + error handling), enhance Forum Belajar (thread/edit/hapus/realtime `*`/notif `trg_notif_forum`), feedback satu arah guru→siswa (tugas per-bab `nilai.umpan_balik_file_url` + ujian `ujian_feedback` + `trg_notif_ujian_feedback`).
- [ ] Photos — DEFERRED (bucket belum siap)

## Revisi & Tambahan Fitur (6 Okt 2026) — Plan

Sumber: `revisi-update.md`; spec di `prd.md` → "Revisi & Tambahan Fitur (6 Okt 2026)"; tracker kode di `revisi-tracker.md` (root).

### Batch 0 — Auth (mandiri, prioritas tertinggi)
- B1: migrasi `@supabase/ssr` + retry `getSession()` + `onAuthStateChange` + loading/disabled + logging redirect + lewati prefetch.

### Batch 1 — Revisi cepat & performa
- A1: kartu dashboard klikable (siswa & guru).
- D1: jumlah soal di kartu daftar ujian/tugas.
- D2: paralelisasi penilaian AI pada submit.

### Batch 2 — Redesain penilaian
- E2: penilaian per bab multi-komponen (`nilai_komponen`) + remedial.
- E3: penilaian ujian UTS/UAS panel benar/salah per siswa.

### Batch 3 — Fitur baru
- C1/C2: pengumuman admin & guru + notifikasi.
- D3: pembahasan tugas/ujian (terbit H+1 / jadwal / override).
- D4: mode ujian fullscreen + deteksi pelanggaran + durasi keluar.

### Progress
- [ ] Batch 0 — B1 Auth
- [ ] Batch 1 — A1 / D1 / D2
- [ ] Batch 2 — E2 / E3
- [ ] Batch 3 — C1/C2 / D3 / D4

## Rapor (cetak & perangkingan) — 7 Okt 2026 — Plan

Sumber: spec `prd.md` → "Rapor (cetak & perangkingan) — 7 Okt 2026"; schema `database.md` #22–#25.

### Batch
- R1: schema — `bab.semester`, tabel `rapor`, tabel `rapor_siswa`, `pengaturan.kkm` + RLS.
- R2: pure logic `src/lib/rapor.ts` (nilai huruf, deskripsi capaian, rata-rata, ketidakhadiran) + unit test.
- R3: PDF rapor formal `src/lib/raporPdf.ts`.
- R4: halaman guru `/guru/rapor` (pilih kelas+semester, modal deskripsi, terbitkan, unduh per siswa, perangkingan).
- R5: siswa `/siswa/nilai` — tombol Unduh Rapor gated `rapor.is_terbit`.
- R6: navigasi guru (sidebar) + semester di form tambah bab.

### Progress
- [x] R1 — schema (`bab.semester`, `rapor`, `rapor_siswa`, `pengaturan.kkm` + RLS)
- [x] R2 — pure logic `src/lib/rapor.ts` + unit test (20 case)
- [x] R3 — PDF rapor formal `src/lib/raporPdf.ts`
- [x] R4 — halaman guru `/guru/rapor` (kelas+semester, modal deskripsi, terbitkan, unduh per siswa, perangkingan)
- [x] R5 — halaman siswa `/siswa/nilai` (tombol Unduh Rapor gated `rapor.is_terbit`)
- [x] R6 — navigasi guru (sidebar) + semester di form tambah bab
- [x] R7 — E2E Playwright `e2e/rapor.spec.ts` (R1–R5) + **bug fix**: `/guru/rapor` macet "Loading" (gate `loading` init `true` memblokir pemilih kelas). Full suite E2E 23/23 hijau.

## Provider AI — pindah ke Groq (7 Okt 2026)

Gemini kena limit free tier → provider koreksi esai kini **swappable** (`AI_PROVIDER`, default **Groq** `openai/gpt-oss-120b`; Gemini alternatif). `src/lib/aiScore.ts` di-refactor jadi adapter per-provider + `aiScore.test.ts`. Model Llama Groq sudah deprecated (shutdown 16 Agu 2026) sehingga default memakai `openai/gpt-oss-120b`. Docs (README, INSTALASI, panduan HTML, database.md, prd.md) disinkronkan.
