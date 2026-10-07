# Revisi Tracker — Pemantauan Perubahan Kode

> Pelacak implementasi revisi (sumber: `revisi-update.md`). File ini **di luar `docs/`** agar perubahan kode mudah dipantau via `git status`/`git diff`.
> Spec final: `docs/project-docs/foundation/prd.md` → "Revisi & Tambahan Fitur (6 Okt 2026)".

Status: `[ ]` belum · `[~]` berjalan · `[x]` selesai

Verifikasi per item: `npm run build` + `npm run lint` + structural review (`docs/project-docs/development/testing.md`). Skema masuk ke `supabase_schema.sql` + `supabase_v2_migration.sql` + RLS di `supabase_rls_policies.sql`.

---

## Batch 0 — Auth (stabilitas, mandiri)

### B1 — Bug logout mendadak & tombol tak respons
- [x] `package.json` — dependency `@supabase/ssr` (`^0.12.7`)
- [x] `src/lib/supabase.ts` — klien browser berbasis cookie (`createBrowserClient`, bukan `createClient` polos)
- [x] `src/lib/supabase-server.ts` **(baru)** — klien server-side berbasis cookie untuk proxy
- [x] `src/proxy.ts` — proteksi rute berbasis sesi Supabase (cookie `user-role` dihapus); prefetch dilewati; redirect `/login` hanya bila sesi benar-benar kosong; log rute+penyebab; role salah → dashboard sendiri
- [x] `src/app/login/page.tsx` — hapus `document.cookie = 'user-role=…'`
- [x] `src/lib/hooks/useCurrentUser.ts` — retry `getSession()` (3×) + listener `onAuthStateChange`; tidak redirect saat error sementara
- [x] `src/components/LmsLayout.tsx` — tombol "Keluar Sesi" kini `signOut()` sungguhan + disabled saat proses
- [x] Verifikasi: `npm run build` ✅ lulus (Proxy terdeteksi) · eslint file B1 bersih dari error baru
- [ ] **QA manual** — uji skenario: idle lama, jaringan lambat (throttling), multi-tab, klik cepat antar menu, prefetch (butuh environment berjalan)
- [ ] **Hardening lanjutan (opsional)** — set `role` di `app_metadata` (server-only, anti-spoof) saat create-user + backfill user lama; proxy sekarang fallback ke `user_metadata.role`

---

## Batch 1 — Revisi cepat & performa

### A1 — Kartu dashboard klikable
- [x] `src/app/siswa/dashboard/page.tsx` — kartu Materi→`/siswa/materi`, LKPD & Tugas→`/siswa/tugas`, Ujian→`/siswa/ujian`
- [x] `src/app/guru/dashboard/page.tsx` — kartu stat → `/guru/kelas`

### D1 — Jumlah soal di kartu daftar
- [x] `src/app/siswa/ujian/page.tsx` — tambah "Jumlah Soal" (hitung dari `soal_ujian`, fallback `ujian.jumlah_soal`) + buka/tutup + durasi
- [x] `src/app/siswa/tugas/page.tsx` — kolom "Jumlah Soal" pada tabel daftar tugas/LKPD

### D2 — Submit jawaban lambat
- [x] `src/lib/concurrency.ts` **(baru)** — helper `mapWithConcurrency`
- [x] `src/app/api/ujian/submit/route.ts` — `scoreEssayWithAi` dijalankan paralel (batas 4), bukan loop berurutan
- [x] `src/app/siswa/tugas/page.tsx` — skor AI soal uraian pra-hitung paralel sebelum loop simpan
- [x] Verifikasi: `npm run build` ✅ lulus · tidak ada `any` eksplisit baru (8 vs 8 pada route submit)

---

## Batch 2 — Redesain penilaian

### E2 — Penilaian per bab multi-komponen
- [x] Skema: kolom komponen `nilai` (`nilai_lkpd`/`nilai_tugas`/`nilai_uh`/`nilai_keaktifan`) + trigger `set_nilai_akhir` (rata-rata sederhana) + tabel `remedial_target` + `is_remedial` di `konten`/`ujian`
  - [x] `supabase_schema.sql` · [x] `supabase_v2_migration.sql` · [x] `supabase_rls_policies.sql`
- [x] `docs/project-docs/development/database.md` disinkronkan (desain final = **kolom pada `nilai`**, bukan tabel `nilai_komponen`)
- [x] `src/app/guru/penilaian/page.tsx` — tabel per bab (kolom menyesuaikan komponen tersedia) + tombol **Penilaian** per komponen (kiri jawaban / kanan panel guru) & **Feedback** + keaktifan otomatis dari presensi (bisa diedit) + rata-rata (badge Remedial bila < 75)
- [x] `src/app/api/ujian/submit/route.ts` — UH menulis `nilai_uh` (bukan `skor_benar`)
- [x] Verifikasi: `npm run build` ✅ lulus
- [x] **Terapkan SQL ke Supabase** — sudah dijalankan user (`supabase_v2_migration.sql`)
- [x] **UI pembuatan remedial** — tombol "Kelola Remedial" di penilaian per bab (pilih item + siswa < 75 → `is_remedial` + `remedial_target`); siswa hanya melihat item remedial yang terdaftar (`siswa/tugas` & `siswa/ujian` difilter)

### E3 — Penilaian ujian UTS/UAS
- [x] `src/app/guru/ujian/[id]/hasil/page.tsx` — tabel siswa (benar/salah + rata-rata + status) → tombol **Penilaian** membuka modal panel kiri jawaban / kanan panel guru per soal (toggle ✔ Benar / ✘ Salah + skor final), hitungan benar/salah, **Simpan Penilaian per siswa**; feedback per siswa via modal; UH menulis `nilai_uh`
- [x] Verifikasi: `npm run build` ✅ lulus

---

## Batch 3 — Fitur baru

### C1/C2 — Pengumuman admin & guru
- [x] Skema: `pengumuman` + `pengumuman_target` (+ trigger `trg_notif_pengumuman` → notifikasi penerima)
- [x] `src/components/PengumumanManager.tsx` (baru) — form + daftar pengumuman (admin: guru/siswa/beberapa/semua; guru: semua kelas/beberapa kelas/beberapa siswa)
- [x] `src/app/admin/pengumuman/page.tsx` + `src/app/guru/pengumuman/page.tsx` (baru)
- [x] `src/components/PengumumanFeed.tsx` (baru) — tampil di dashboard guru & siswa, filter `tayang_sampai`
- [x] Link sidebar admin & guru

### D3 — Pembahasan tugas & ujian
- [x] Skema: kolom pembahasan di `ujian` + `konten` (+ trigger `trg_auto_terbit_pembahasan`: set `pembahasan_terbit_at = now()+1 min` saat SEMUA siswa kelas submit)
- [x] `src/app/guru/ujian/[id]/page.tsx` — upload pembahasan + jadwal/override terbit
- [x] `src/app/guru/kelas/[id]/page.tsx` — upload pembahasan tugas + toggle terbit
- [x] Tampilan siswa (`siswa/ujian/[id]` hasil + `siswa/tugas` hasil) — lihat pembahasan setelah terbit

### D4 — Mode ujian fullscreen + deteksi pelanggaran
- [x] Skema: `pelanggaran_ujian` + RLS (siswa insert own, guru read kelasnya)
- [x] `src/app/siswa/ujian/[id]/page.tsx` — fullscreen saat mulai + deteksi `visibilitychange`/`fullscreenchange` + catat `jenis` + `durasi_detik` + badge jumlah pelanggaran
- [x] Verifikasi: `npm run build` ✅ lulus
- [ ] **Terapkan SQL Batch 3 ke Supabase** (dijalankan user) — `supabase_v2_migration.sql`

---

## Perbaikan pasca-QA (temuan pengujian Batch 0–1)

- [x] **Trigger `auto_terbit_pembahasan_ujian`** — pakai `NEW.soal_id` (bukan `NEW.ujian_id` yang tidak ada) → submit ujian tidak lagi error `record "new" has no field "ujian_id"`
- [x] **RLS tabel baru** (`pelanggaran_ujian`, `pengumuman`, `pengumuman_target`, `remedial_target`) ditambahkan ke `supabase_v2_migration.sql` — sebelumnya RLS aktif tanpa policy → INSERT ditolak "violates row-level security"
- [x] **Kunci navigasi saat ujian** — sidebar & topbar disembunyikan selama `step === 'exam'`
- [x] **Upload kondisional** — kotak upload/link hanya tampil bila soal `butuh_upload` / `butuh_foto_jawaban`
- [x] Verifikasi: `npm run build` ✅ lulus (Node 20)
- [ ] **Terapkan ulang `supabase_v2_migration.sql`** ke Supabase (user) — untuk trigger + RLS baru
- [ ] **Enhancement**: tampilkan tugas/kuis di "Kelas Saya" siswa + label "sudah dikerjakan" di Materi
- [ ] **Auth**: sesi hilang setelah beberapa menit (`Auth session missing`) — perlu cek Supabase → Auth → Refresh Token Rotation / JWT expiry
- [ ] **Polish tampilan** (catatan QA: "belum rapi 100%")

---

## Test Otomatis (Vitest)

- [x] Setup: `vitest` + `vitest.config.mts` + script `npm test` / `npm run test:watch`; `testing.md` disinkronkan
- [x] Logika Batch 2–3 diekstrak ke lib yang bisa diuji: `src/lib/nilai.ts` (rata-rata + ambang remedial), `src/lib/pembahasan.ts` (aturan terbit)
- [x] **35 tes / 6 file** — `nilai`, `judulBab`, `concurrency`, `aiScore`, `jadwalUjian`, `pembahasan` → semua lulus
- [x] **E2E Playwright** — 13 tes: smoke siswa (6) + guru (5) + **alur tulis** (2: E2 simpan nilai, C2 buat+hapus pengumuman)
- [x] Alur tulis memakai **kelas+siswa uji khusus** (`KELAS-E2E`) — `globalSetup`/`globalTeardown` buat & hapus otomatis; **0 sisa** terverifikasi (data asli tak tersentuh)
- [ ] E2E sisa: E3 benar/salah, kelola remedial, D3 pembahasan, D4 fullscreen+pelanggaran, auth lintas-sesi
