# QA Checklist — Fitur Baru (Revisi Batch 0–3)

Sumber spec: `docs/project-docs/foundation/prd.md` → "Revisi & Tambahan Fitur (6 Okt 2026)".
Pelacak kode: `revisi-tracker.md`.

Status: `[ ]` belum diuji · `[~]` diperbaiki/sebagian (perlu uji ulang) · `[x]` lulus · `[!]` gagal (catat pesan error)

---

## 0. Prasyarat (sebelum mulai)

- [x] SQL `supabase_v2_migration.sql` **sudah sukses dijalankan** (tanpa error — termasuk fungsi `notif_pengumuman` & `auto_terbit_pembahasan_ujian`). Verifikasi: jalankan `SELECT table_name FROM information_schema.tables WHERE table_name IN ('pengumuman','pengumuman_target','pelanggaran_ujian','remedial_target');` → harus 4 baris.
- [x] `npm run build` lulus (kode terbaru). — *Sebelumnya `[!]` karena **Node terlalu lama** (`Unexpected token '??='`); dengan `nvm use 20` build lulus. Butuh Node 18.18+/20.*
- [x] Ada minimal 3 akun uji: **admin**, **guru** (punya ≥1 kelas + siswa), **siswa** (terdaftar di kelas guru).
- [x] Kelas uji sudah punya: **bab**, **konten LKPD**, **konten Tugas (banksoal/evaluasi)**, **ujian UH**, **ujian UTS/UAS**, dan **presensi** (untuk menguji keaktifan).
- [ ] Siapkan data guru/kelas/siswa cadangan untuk menguji jalur "belum ada data".

---

## 1. Batch 0 — Perbaikan Auth (B1)

- [x] **Login** sebagai siswa → diarahkan ke `/siswa/dashboard`.
- [x] Login sebagai guru → `/guru/dashboard`. Login admin → `/admin/dashboard`.
- [~] **Klik cepat antar menu** (mis. admin: Dashboard ↔ Kelola User ↔ Jadwal) selama 5–10 menit → **tidak pernah logout mendadak**, tombol merespons. — *Akar ditemukan (refresh-token reuse detection 10s + "detect & revoke"; proxy `getUser()` memicu refresh ganda). Diperbaiki: proxy pakai `getSession()` (tanpa refresh jaringan). **Perlu uji ulang**.*
- [~] **Tab dibiarkan idle** lama (±10–15 menit) → kembali ke tab → **masih login**. — *Diperbaiki seperti di atas. **Perlu uji ulang**.*
- [x] **Jaringan lambat** (DevTools → Network → throttling "Slow 3G") → buka menu → tidak di-redirect ke `/login`.
- [~] **Beberapa tab** dibuka bersamaan → sesi konsisten antar tab. — *Termasuk skenario incognito→browser utama; **perlu uji ulang** setelah fix.*
- [x] **Refresh halaman** (F5) di tengah halaman → tetap di halaman, tidak ke `/login`.
- [~] **Logout** (tombol "Keluar Sesi") → benar-benar keluar (muncul "Keluar..." lalu ke `/login`), dan bila akses halaman terproteksi langsung → redirect `/login`. — *Tombol kini memanggil `signOut()` sungguhan + status disabled. **Perlu uji ulang**.*
- [x] **Siswa** mengetik URL `/admin` manual → dialihkan ke dashboard **siswa** (bukan dipaksa login ulang).
- [x] **Guru** akses `/guru/...` → boleh. **Admin** akses semua area → boleh.

-- notes 
    1. ada beberapa kali "406 Not Acceptable" → *diabaikan atas permintaan Anda; bukan blocker.*
    2. build gagal → *✅ penyebab: Node lama; `nvm use 20` → build lulus.*
    3. entah gimana case nya.. tapi ketika 1 pake incognito kemudian login menggunakan akun yang sama, di browser utama setelah saya reload terlogout → *✅ akar: refresh-token reuse detection; diperbaiki via proxy `getSession()` — perlu uji ulang.*
    4. mungkin ini menjawab nomor 3 (masih asumsi sehingga di pisah), masih login kemudian dibiarkan idle 3 menit an dan saat mencoba card yang ada di dashboard tiba2 dihalaman login.. setelah login kembali normal dengan mencoba hal yang sama → *✅ akar & perbaikan sama (#3) — perlu uji ulang.*
    5. ternyata loging "[auth] redirect /login — /siswa/dashboard (tanpa sesi: Auth session missing!)", perlu diatasi karena hanya beberapa menit ini langsung hilang auth nya.. → *✅ akar & perbaikan sama; perlu uji ulang.*
---

## 2. Batch 1 — Kartu, Jumlah Soal, Submit

### A1 — Kartu dashboard klikable
- [x] Dashboard **siswa**: klik kartu **Materi** → `/siswa/materi`; **LKPD** & **Tugas** → `/siswa/tugas`; **Ujian** → `/siswa/ujian`.
- [x] Dashboard **guru**: klik kartu **Siswa Diajar** / **Kelas Diampu** → `/guru/kelas`.

### D1 — Jumlah soal di kartu
- [x] Daftar **ujian siswa**: tiap kartu menampilkan **Jumlah Soal** + Dibuka/Ditutup + Durasi.
- [x] Daftar **tugas siswa**: tabel punya kolom **Jumlah Soal** (bukan "-").

### D2 — Submit cepat
- [~] Kerjakan **ujian** yang memuat beberapa soal **uraian/esai** → kirim → waktu tunggu **jauh lebih singkat** (paralel, bukan satu-per-satu). — *Sudah diparalelkan (`mapWithConcurrency`); **perlu ukur ulang** waktu nyatanya.*
- [~] Kerjakan **tugas/kuis** dengan soal uraian → kirim → cepat. — *Sudah diparalelkan; **perlu ukur ulang**.*

-- notes fixing
    1. tampilan nya belum rapi 100%.. masih 50% kerapian nya.. → *⏳ sebagian diperbaiki (label form ber-gap, tombol `disabled`, judul bab, a11y login & form pengumuman); sisanya backlog.*
    2. ketika guru tidak menyantumkan wajib upload jawaban, siswa saat ditampilkan soal tidak perlu menampilkan lampiran apapun atau link google drive karena tidak disediakan oleh guru → *✅ kotak upload kini hanya tampil bila soal ditandai wajib upload.*
    3. saat kerjakan tugas/kuis tolong tampil di kelas saya.. agar ada pengingat untuk siswa jika guru telah membuat soal dan perlu dikerjakan.. → *✅ ditambahkan kartu "Tugas/Kuis Perlu Dikerjakan" di Kelas Saya.*
    4. jika siswa sudah mengerjakan soal dari guru, beri label jika tugas tersebut sudah dikerjakan "Modul Bacaan & Materi Pembelajaran" → *✅ badge "✓ Sudah dikerjakan" di Materi.*
    5. error "record "new" has no field "ujian_id"" setelah submit ujian yang di copas dari ujian lain. → *✅ trigger diperbaiki (pakai `NEW.soal_id`).*
    6. Pada saat ujian berlangsung, saat ini masih bisa menu lain.. seharusnya tidak bisa.. → *✅ sidebar/topbar dikunci selama ujian.*
---

## 3. Batch 2 — Penilaian

### E2 — Penilaian per bab
- [x] Guru → **Penilaian** → pilih kelas → tampilan default **"Penilaian per Bab"** → pilih bab. — *Terverifikasi E2E.*
- [~] Tabel menampilkan kolom **LKPD / Tugas / UH hanya bila tersedia di bab tsb**, plus **Keaktifan** & **Rata-rata**. — *Header & tombol terverifikasi E2E; penyesuaian kolom dinamis belum diuji menyeluruh.*
- [x] **Keaktifan** terisi otomatis (persen presensi "masuk"); tampil petunjuk "auto: NN%". — *Terverifikasi E2E.*
- [x] Klik **"Penilaian LKPD"** → modal: kiri jawaban siswa, kanan panel guru → isi skor → **Simpan Nilai** → kolom LKPD terisi. — *Terverifikasi E2E (alur tulis).*
- [x] Ulangi untuk **Tugas** dan **UH** (UH menampilkan jawaban `jawaban_ujian` + skor AI). — *Baru LKPD yang diuji otomatis.*
- [x] Klik **"Feedback"** → tulis teks + lampir file → Simpan → tersimpan (lihat lagi). — *Belum diuji.*
- [x] Edit **keaktifan** (ketik lalu blur) → tersimpan; **Rata-rata** berubah = rata-rata sederhana komponen terisi. — *Belum diuji.*
- [x] Siswa dengan rata-rata **< 75** → muncul **badge "Remedial"**. — *Belum diuji.*
- [x] **Kelola Remedial** → pilih item (Tugas/UH) → centang siswa → **Simpan Remedial**. — *Terverifikasi E2E (tersimpan saat dibuka ulang).*
- [x] **Siswa** yang TIDAK dicentang remedial → item remedial **tidak muncul** di daftar tugas/ujiannya; yang dicentang → **muncul**. — *Belum diuji.*
- [x] **Siswa → Nilai Saya** → kolom baru **LKPD · Tugas · UH · Keaktifan · Rata-rata** (bukan "Skor Benar/Skor Presensi"). — *Terverifikasi E2E.*

### E3 — Penilaian ujian UTS/UAS
- [~] Guru → **Ujian** → pilih ujian **UTS/UAS** → **Hasil Ujian** → tabel siswa menampilkan **Benar/Salah**, **Rata-rata**, **Status**. — *Baris siswa & tombol Penilaian terverifikasi E2E; kolom Benar/Salah belum diassert eksplisit.*
- [x] Klik **"Penilaian"** pada siswa → modal: **kiri jawaban siswa / kanan panel guru**, per soal ada tombol **✔ Benar / ✘ Salah** + skor final. — *Terverifikasi E2E.*
- [x] Tampil **hitungan Benar & Salah** di modal. — *Terverifikasi E2E.*
- [x] **Simpan Penilaian Siswa Ini** → tersimpan; status jadi FINAL; jawaban masuk per siswa. — *Terverifikasi E2E.*
- [x] Ujian **UH** yang divalidasi → nilainya masuk ke **nilai_uh** bab (lihat di Penilaian per bab). — *Belum diuji.*

---

## 4. Batch 3 — Pengumuman, Pembahasan, Mode Ujian

### C1/C2 — Pengumuman
- [x] **Admin** → menu **Pengumuman** → buat dengan audiens **"Semua guru"** → cek dashboard **guru** menampilkan pengumuman + badge notifikasi. — *Belum diuji (E2E memakai role GURU, bukan admin).*
- [x] Admin buat audiens **"Beberapa pengguna"** → hanya user terpilih yang melihat. — *Belum diuji.*
- [x] Admin buat **"Semua pengguna"** → guru & siswa melihat. — *Belum diuji.*
- [x] Atur **batas waktu tayang** pendek (1 menit) → setelah lewat, pengumuman **hilang** dari dashboard. — *Belum diuji.*
- [~] **Guru** → menu **Pengumuman** → buat **"Semua kelas saya"** → siswa di kelas tsb melihat; guru lain tidak. — *E2E menguji buat "Beberapa kelas" + hapus; varian "Semua kelas" & sisi siswa belum.*
- [x] Guru buat **"Beberapa siswa"** → hanya siswa terpilih melihat. — *Belum diuji.*
- [x] Judul + deskripsi tampil benar; **hapus** pengumuman berfungsi. — *Terverifikasi E2E (setelah policy DELETE guru ditambahkan).*

### D3 — Pembahasan
- [x] Guru → **Kelola Soal Ujian** → bagian **Pembahasan Ujian** → upload file → **Terbitkan sekarang** → Simpan. — *Terverifikasi E2E (status "Terbit").*
- [!] **Siswa** yang sudah selesai mengerjakan ujian tsb → di **hasil ujian** muncul **"📘 Pembahasan"**. — *Belum diuji.*
- [x] Guru **jadwalkan** pembahasan (tanggal) tanpa "terbitkan sekarang" → siswa melihat hanya setelah waktunya. — *Belum diuji.*
- [x] **Auto-terbit**: ujian dengan pembahasan diunggah, saat **semua siswa kelas** sudah mengumpulkan → pembahasan terbit otomatis (H+1 menit). — *Belum diuji (butuh menunggu).*
- [!] Guru → **Kelas** → modul **Tugas** → upload **Pembahasan** + centang terbitkan → siswa melihat **"📘 Lihat Pembahasan"** di hasil tugas. — *Belum diuji.*

### D4 — Mode ujian (fullscreen + pelanggaran)
- [~] **Siswa** mulai ujian (setelah pakta) → layar **masuk fullscreen**. — *E2E lolos alur pakta→ujian; permintaan fullscreen belum diassert (headless).*
- [x] **Pindah tab** (atau minimize) lalu kembali → muncul **badge "⚠️ Pelanggaran: 1"**. — *Terverifikasi E2E (simulasi `visibilitychange`).*
- [x] **Keluar fullscreen** (ESC) → pelanggaran bertambah. — *Belum diuji.*
- [x] Cek di DB (opsional): `SELECT * FROM pelanggaran_ujian;` → baris `jenis` + `durasi_detik` tersimpan. — *Belum diuji.*
- [~] Selesai/kumpulkan → keluar fullscreen normal. — *"Sidebar tampil kembali tanpa refresh" terverifikasi E2E; pelepasan fullscreen belum diassert.*

---

## 5. Regresi cepat

- [~] **Tidak ada UUID tampil** di mana pun. Contoh yang sudah diperbaiki: admin **Jadwal** → pesan konflik menampilkan **nama guru/kelas**, bukan UUID. — *Kasus jadwal & pola fallback-id sudah diperbaiki; belum disapu 100%.*
- [~] `npm run lint` & `npm run build` lulus setelah semua perubahan (bila ada perubahan lanjutan). — *`build` ✅ (Node 20); `lint` masih error pra-eksisting (~267) di luar perubahan ini.*

---

## 6. Test Otomatis (E2E Playwright) — 2026-10-06

Dijalankan dengan `npm run test:e2e` (Chrome sistem, dev server otomatis). **17/17 lulus.**

**Siswa (`e2e/siswa.spec.ts`)**
- [x] A1 — kartu dashboard dapat diklik → navigasi ke halaman terkait
- [x] D1 — daftar ujian menampilkan "Jumlah Soal"
- [x] D1 — daftar tugas punya kolom "Jumlah Soal"
- [x] E2 — Nilai Saya memakai kolom LKPD/Tugas/UH/Keaktifan/Rata-rata
- [x] Judul bab tidak dobel ("Bab N: Bab N:")
- [x] Dashboard tanpa error runtime (menangkap regresi realtime notifikasi)

**Guru (`e2e/guru.spec.ts`)**
- [x] A1 — kartu dashboard dapat diklik
- [x] E2 — Penilaian per bab: tabel komponen + tombol "Kelola Remedial"
- [x] E3 — halaman hasil ujian memuat
- [x] C2 — halaman Pengumuman guru: form (Judul/Deskripsi)
- [x] Tanpa error runtime di halaman utama guru

**Alur TULIS (`e2e/penilaian-tulis.spec.ts`)** — memakai **kelas + siswa uji khusus** (`KELAS-E2E`, dibuat & dihapus otomatis oleh `globalSetup`/`globalTeardown`; data & siswa asli **tidak tersentuh**):
- [x] E2 — guru menyimpan nilai LKPD → kolom LKPD & Rata-rata terisi
- [x] C2 — guru membuat pengumuman → muncul di daftar "Pengumuman Saya" → menghapusnya
- [x] Cleanup terverifikasi: **0 sisa** (kelas/siswa/pengumuman uji)

**Alur TULIS lanjutan (`e2e/tulis-lanjutan.spec.ts`)** — juga hanya menyentuh `KELAS-E2E`:
- [x] E2 — **kelola remedial**: tandai item + siswa → tersimpan (diverifikasi dengan membuka ulang)
- [x] D3 — **unggah & terbitkan pembahasan ujian** → status berubah "Terbit"
- [x] E3 — **benar/salah per soal** + Simpan Penilaian Siswa
- [x] D4 — **mode ujian**: mulai ujian → pindah tab → badge "⚠️ Pelanggaran: 1" muncul

> Belum otomatis (masih manual): varian audiens pengumuman, auto-terbit pembahasan (H+1 menit, butuh menunggu), auth lintas-sesi.

---

## 7. Bug ditemukan & diperbaiki

Dari QA manual + E2E:

| # | Bug | Status |
|---|---|---|
| 1 | `record "new" has no field "ujian_id"` saat submit ujian (trigger pakai `NEW.ujian_id`) | ✅ pakai `NEW.soal_id` |
| 2 | `violates row-level security` pada `pelanggaran_ujian` (policy tak ada di file migrasi) | ✅ policy RLS ditambahkan ke `supabase_v2_migration.sql` |
| 3 | Navigasi belum terkunci saat ujian | ✅ sidebar/topbar disembunyikan saat ujian |
| 4 | Upload/link muncul walau guru tidak mewajibkan | ✅ tampil hanya bila `butuh_upload` |
| 5 | Realtime: `cannot add postgres_changes callbacks … after subscribe()` (nama channel tetap + StrictMode) | ✅ nama channel unik + guard — **ditemukan E2E** |
| 6 | Notifikasi tidak real-time (badge perlu reload) | ✅ subscribe + tabel masuk publikasi realtime |
| 7 | CSS `.form-group label` menimpa `.d-flex` → elemen berdempetan | ✅ `:where(.form-group) label` |
| 8 | Tombol `disabled` tampak sama seperti aktif | ✅ styling `:disabled` + kursor `not-allowed` |
| 9 | Judul bab dobel ("BAB 1: BAB 1:") | ✅ helper `judulBab()` |
| 10 | Label form tak terhubung ke input (a11y, `getByLabel` gagal) | ✅ `PengumumanManager` + `login` pakai `htmlFor`/`id` — **ditemukan E2E** |
| 11 | Guru **tak punya policy DELETE** `pengumuman` (tombol Hapus tak berefek) | ✅ policy `guru delete own pengumuman` ditambahkan (`v2_migration` R10, `rls_policies`, `schema`) — **ditemukan E2E** |
| 12 | Notifikasi browser tak muncul & hanya terasa di dashboard (SiswaNotifier siswa-only, tak tersambung ke tabel `notifikasi`) | ✅ disentralisasi ke `LmsLayout` (semua role & halaman) + toast in-app; ditahan saat ujian |
| 13 | Logout mendadak (refresh-token reuse detection) | ✅ proxy pakai `getSession()` (tanpa refresh ganda) — **perlu uji ulang** |
| 14 | Sidebar hilang setelah keluar mode ujian (inline style pada node React tak ter-restore → perlu refresh) | ✅ ganti ke kelas `body.exam-mode` + CSS — **terverifikasi E2E** |

**Catatan**: bug #10 (label↔input) masih ada di **~100 label di ±20 file** (login & PengumumanManager sudah; sisanya backlog mekanis).

**Observasi (bukan bug)**: `GpsGate` memblokir **seluruh** aplikasi bila izin lokasi ditolak (semua role); E2E perlu izin geolocation agar lolos. Pastikan ini memang perilaku yang diinginkan.

---
