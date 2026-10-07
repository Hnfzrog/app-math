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
4. **Ujian**: Create UH/UTS/UAS with descriptions, durations, and question counts. **Mandatory open/close schedule** (date + time) and a **Publish** toggle — a draft exam is invisible to students. Exams can be edited afterwards (schedule, type, description, duration); the class cannot be changed after creation.
5. **Presensi**: Validate attendance submitted by Siswa, **plus manual entry** — record attendance for one student or a whole class at once, with a photo taken directly from the camera. Export PDF.
6. **Penilaian**: 
   - Tunggal: Verify answers, give text feedback (upload photo PENDING). Auto grade: `(Score * 0.9) + (Attendance * 0.1)`.
   - Menyeluruh: Class average table for all chapters.

## Features: Siswa
1. **Dashboard**: Greeting, Notif badge, Stats (Materi, LKPD, Tugas, Ujian), chart, today's schedule, "What's New".
2. **Profile**: Update phone, guardian name, address. Photo upload is PENDING.
3. **Presensi Mandiri**: Automatic geolocation attendance (radius from `pengaturan.radius_meter`). Direct camera photo is implemented via `CameraCapture`.
4. **Kelas Saya**: View class info, classmates, Forum Belajar per chapter. Image answers upload is PENDING.
5. **Ujian**: Only published exams appear, each showing its open/close schedule and a status badge (Belum Dibuka / Berlangsung / Ditutup). The schedule gates entry only — once started, the duration timer governs. Flow: View rules (with schedule) -> Sign Pakta Integritas -> Exam UI with timer and navigator.
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

### Ujian: Pilgan, Auto-Nilai, Validasi Guru (28 Sep 2026)

Scope approved 28 Sep 2026.

**Guru**
1. **Kelola Soal** — pilih tipe soal per butir: **Pilgan** (2+ opsi, kunci boleh lebih dari satu = multi-jawaban) atau **Esai** (dengan kunci/rubrik sebagai acuan AI). Kunci disimpan di tabel `soal_ujian_kunci` yang tidak terbaca siswa.
2. **Ambil Soal dari Ujian Lain** — salin (snapshot) soal dari ujian mana pun di sekolah, termasuk milik guru lain. Kunci ikut tersalin lewat route server-side sehingga auto-nilai pilgan tetap jalan; hasil salinan bisa diedit bebas.
3. **Hasil Ujian** (`/guru/ujian/[id]/hasil`) — accordion **per siswa, default tertutup**; lihat jawaban tiap soal, skor AI untuk esai, edit `skor_final`, lalu validasi satu siswa atau **validasi massal** beberapa siswa sekaligus.

**Siswa**
4. **Ujian** — soal pilgan dirender sebagai radio (satu jawaban) / checkbox (multi-jawaban). Pilgan langsung tampil benar/salah setelah submit; esai menampilkan "menunggu validasi guru" sampai guru memvalidasi.
5. **Navigasi soal di kiri** dengan penanda warna: abu-abu = belum dikerjakan, hijau = sudah dikerjakan, merah = ditandai untuk dicek ulang. Tiap nomor bisa diklik untuk lompat ke soal.
6. **Modal konfirmasi submit** menolak pengumpulan selama masih ada soal terlewat atau masih bertanda; daftar nomornya bisa diklik untuk lompat ke soal tersebut. (Auto-submit saat waktu habis tetap mengirim apa adanya.)

**Non-goal**: skor ujian tidak otomatis masuk tabel `nilai`/e-Rapor; unduh soal sebagai file; ambil soal dari Bank Soal.

### Feedback, Forum & Kamera (28 Sep 2026)

Scope approved 28 Sep 2026.

**Bug fix — Kamera Presensi (`CameraCapture`)**
1. Kamera blank hitam di mobile & desktop. Root cause: `facingMode: 'environment'` eksak (gagal di webcam depan laptop/PC), race condition pemasangan `srcObject` via `setTimeout(0)`, dan tidak ada `.play()` eksplisit.
2. Perbaikan: `facingMode: { ideal: 'environment' }` (fallback ke kamera apa pun yang tersedia); pasang `srcObject` + panggil `.play()` via `useEffect`/callback-ref saat `<video>` ter-mount (bukan `setTimeout(0)`); error handling membedakan `NotAllowedError` (izin ditolak) vs `NotFoundError` (tanpa kamera).

**Enhance — Forum Belajar (Diskusi per bab)**
1. Balasan **satu level** (thread) — kolom `parent_id`.
2. Penulis bisa **edit** (penanda "diedit") & **hapus** pesannya (soft delete). Guru pengampu kelas & admin bisa hapus pesan apa pun di kelasnya (moderasi).
3. Realtime diperluas ke `INSERT` + `UPDATE` + `DELETE`.
4. Notifikasi pesan baru: balasan → penulis pesan induk; post baru → guru pengampu kelas.

**Feature — Feedback Hasil (tugas & ujian, satu arah guru → siswa)**
1. Feedback = **tulisan + lampiran file perbaikan** (PDF/doc/xls/ppt/gambar), **satu arah** (guru kirim, siswa baca — tanpa balasan).
2. **Tugas (per bab)**: `nilai` + kolom `umpan_balik_file_url` (file umum, menggantikan `umpan_balik_foto_url` yang image-only). Guru lampirkan file (bukan cuma foto); siswa lihat teks + link file di Nilai Saya.
3. **Ujian (per siswa per ujian)**: tabel baru `ujian_feedback`. Guru tulis feedback + lampiran file di halaman hasil ujian; siswa lihat di halaman hasil ujian.

**Non-goal**: feedback tidak dua arah; foto jawaban tetap DEFERRED.

### Deferred (photo — awaiting storage bucket)
- Upload wiring for `foto_profil_url`, `presensi.foto_url`, `jawaban_ujian.foto_url`, `umpan_balik_foto_url`.
- Profile photo (admin/guru/siswa), direct-camera presensi photo, per-question answer photo, umpan-balik photo.

### Assumption (to confirm)
- School identity + presensi center coordinates live in the `pengaturan` table (editable by admin via UI).

### Revisi & Tambahan Fitur (6 Okt 2026)

Scope approved 6 Okt 2026 (sumber: `revisi-update.md`). Pelacakan eksekusi di `revisi-tracker.md` (root repo, di luar `docs/`).

**Bug fix — Auth (logout mendadak & tombol tak respons)**
1. Migrasi autentikasi ke `@supabase/ssr`; sesi & proteksi rute memakai cookie sesi yang sama; hapus cookie `user-role` manual.
2. `getSession()` dengan retry untuk error sementara; redirect ke `/login` hanya bila sesi benar-benar tidak ada.
3. Listener `onAuthStateChange` untuk token refresh & sign-out yang konsisten.
4. Loading state / disabled tombol saat proses berjalan.
5. Log redirect ke `/login` (rute + penyebab); jangan redirect permintaan prefetch `<Link>`.

**Pengumuman & Notifikasi**
- Admin & guru membuat pengumuman (judul + deskripsi + batas waktu tayang). Admin: guru / siswa / beberapa pengguna / semua. Guru: semua kelas / beberapa kelas / beberapa siswa. Muncul di dashboard audiens + masuk `notifikasi`; hilang otomatis saat batas waktu.

**Ujian & Tugas**
- Kartu daftar menampilkan jumlah soal + waktu buka/tutup + durasi.
- Submit jawaban dipercepat (penilaian AI uraian diparalelkan).
- Pembahasan (tugas & ujian): guru upload; terbit H+1 menit setelah semua siswa selesai atau sesuai jadwal; ada override manual.
- Mode ujian (khusus ujian): fullscreen + deteksi pelanggaran (pindah tab / keluar halaman / keluar fullscreen) + catat durasi keluar.

**Penilaian**
- Menyeluruh: tetap (tabel per bab).
- Per bab: pilih bab → daftar siswa dengan kolom Nilai LKPD / Nilai Tugas / Nilai UH / Keaktifan / Rata-rata (kolom menyesuaikan komponen tersedia). Rata-rata = rata-rata sederhana kolom terisi (keaktifan ikut 1 kolom). Tombol PENILAIAN (pilih komponen; kiri jawaban siswa / kanan panel guru; verifikasi & koreksi AI; murni pekerjaan siswa) & FEEDBACK. Keaktifan otomatis dari presensi + bisa diedit. Rata-rata ≥ 75 → lanjut bab; < 75 → remedial (guru buat tugas/UH remedial dibuka khusus daftar siswa eksplisit).
- Ujian UTS/UAS: pilih jenis → daftar siswa + nilai → PENILAIAN per siswa (kiri jawaban / kanan panel, tandai benar/salah & koreksi AI, tampilkan jumlah benar/salah, submit per siswa).

**Non-goal**: foto jawaban tetap DEFERRED; tidak ada perubahan rumus untuk ujian selain UH (UH masuk per-bab).

### Rapor (cetak & perangkingan) — 7 Okt 2026

Scope approved 7 Okt 2026. Rapor formal "Laporan Hasil Belajar Peserta Didik" mengikuti layout gambar, isinya per-bab Matematika.

**Guru**
1. **Rapor** (`/guru/rapor`) — pilih kelas + semester (ganjil/genap) → daftar siswa dengan rata-rata nilai. Per siswa ada modal **Isi Deskripsi** untuk Kegiatan Pengembangan Diri, Akhlak/Kepribadian, dan Catatan Wali Kelas (disimpan ke `rapor_siswa`).
2. **Terbitkan Rapor** — menerbitkan sekali untuk seluruh kelas (`rapor.is_terbit`). Setelah terbit, guru bisa **unduh rapor tiap siswa** (PDF per siswa).
3. **Perangkingan** (`/guru/rapor`) — tabel No / Nama / Rata-rata (mean `nilai_akhir` semua bab pada semester tsb) / Peringkat. Export PDF berkop surat.

**Siswa**
4. **Nilai Saya / Rapor** — tombol **Unduh Rapor** hanya aktif bila `rapor` kelas + semester siswa ber-`is_terbit = true`. Menggantikan e-Rapor lama (terbit otomatis saat semua bab selesai).

**Aturan bisnis (otomatis)**
- KKM dari `pengaturan.kkm` (default 75), diedit admin di halaman Pengaturan.
- Angka → huruf: 90–100 A, 80–89 B, 70–79 C, <70 D.
- Deskripsi capaian per bab dari band `nilai_akhir` (≥90 "sangat baik", 80–89 "baik", ≥KKM "mencapai KKTP", <KKM "perlu remedial", NULL "belum dinilai").
- Ketidakhadiran (Sakit/Izin/Tanpa Keterangan) dihitung dari `presensi`, di-scope per semester (Ganjil = Juli–Desember, Genap = Januari–Juni).
- Saat rapor diterbitkan, siswa sekelas mendapat notifikasi (`trg_notif_rapor_terbit`).

**Non-goal**: multi mata pelajaran; foto/upload pada rapor.

### Infrastruktur AI (koreksi esai) — 7 Okt 2026

Provider koreksi esai bersifat **swappable via env `AI_PROVIDER`**: **Groq** (default; model `openai/gpt-oss-120b`, gratis) atau **Gemini** (alternatif). Soal **pilihan ganda tidak memakai AI** (dinilai di kode). Bila provider gagal atau kunci kosong, `/api/ujian/submit` tetap menyimpan jawaban (`skor_ai` null) dan guru menilai esai secara manual. Implementasi: `src/lib/aiScore.ts`.
