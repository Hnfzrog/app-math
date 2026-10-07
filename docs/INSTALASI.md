# Panduan Instalasi AppMath

Panduan langkah demi langkah memasang aplikasi LMS Matematika di komputer Anda. Ditulis dengan bahasa sederhana — **tidak perlu paham coding** untuk mengikutinya.

> Versi halaman web yang lebih rapi: buka `docs/panduan-instalasi.html` di browser (bisa langsung dikirim ke klien).

**Perkiraan waktu:** ± 30 menit · **Semua alat gratis**

---

## Sebelum Mulai

Siapkan empat hal berikut. Nomor 1 wajib; nomor 2–4 gratis dan hanya butuh daftar dengan email.

- [ ] **Komputer (Windows atau Mac)** yang terhubung internet.
- [ ] **Akun Supabase** (gratis) — tempat data aplikasi disimpan. Daftar di [supabase.com](https://supabase.com).
- [ ] **Akun Google AI Studio** (gratis) — untuk fitur koreksi jawaban otomatis. Daftar di [aistudio.google.com](https://aistudio.google.com).
- [ ] **Akun Vercel** (gratis, opsional) — hanya kalau aplikasi ingin diakses lewat internet.

---

## Langkah 1 — Unduh Kode Aplikasi

Minta file aplikasi kepada pengembang (biasanya tautan GitHub). Unduh sebagai **ZIP**, lalu ekstrak ke folder yang mudah diingat, misalnya `Dokumen/app-math`.

> 💡 Jangan letakkan di folder yang sering dipindah atau dihapus. Folder ini akan jadi "rumah" aplikasi.

---

## Langkah 2 — Pasang Node.js

1. Buka [nodejs.org](https://nodejs.org), unduh versi **LTS** (tombol kiri).
2. Instal seperti aplikasi biasa (Next → Next → Finish).
3. **Cek berhasil:** buka Command Prompt (Windows) atau Terminal (Mac), ketik `node -v` lalu Enter. Kalau muncul angka versi (misalnya `v20.x`), berarti berhasil.

---

## Langkah 3 — Buat Proyek Supabase

1. Masuk ke [supabase.com/dashboard](https://supabase.com/dashboard).
2. Klik **New Project**.
3. Isi nama proyek dan password database (simpan password ini).
4. Pilih region **Singapore** agar cepat diakses dari Indonesia.
5. Tunggu 1–2 menit sampai proyek siap.

---

## Langkah 4 — Siapkan Database

Ini bagian terpenting. Anda akan menerima **satu file SQL** dari pengembang (nama filenya bisa berbeda, misalnya `database.sql`).

Di dashboard Supabase, buka menu **SQL Editor** → **New Query**. Buka file SQL tersebut, salin **seluruh isinya**, tempel ke SQL Editor, lalu klik **Run**.

Kalau file SQL dipecah jadi beberapa bagian, jalankan berurutan dari atas ke bawah.

> ⚠️ Jalankan **seluruh isi file sekaligus** tanpa terpotong — kalau sebagian tidak ikut, ada tabel yang tidak terbentuk.

---

## Langkah 5 — Buat Tempat Penyimpanan Foto

1. Di Supabase, buka menu **Storage** → **New bucket**.
2. Isi nama **persis**: `foto` (huruf kecil semua).
3. Aktifkan pilihan **Public bucket**.
4. Klik Save.

> ⚠️ Nama harus tepat `foto`. Kalau berbeda, foto profil dan lampiran tidak akan tampil.

---

## Langkah 6 — Ambil Kunci AI

1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Klik **Create API key**.
3. Salin kuncinya (deretan huruf dan angka panjang). Simpan sementara di Notepad.

---

## Langkah 7 — Isi File Pengaturan

Ambil tiga kunci dari Supabase: buka **Settings** → **API**, catat **Project URL**, **anon public key**, dan **service_role key**.

Di dalam folder aplikasi, buat file baru bernama `.env.local` (pakai Notepad), lalu isi seperti ini — ganti `...` dengan kunci Anda:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Koreksi esai otomatis (AI). AI_PROVIDER: groq (default) | gemini
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
```

> 🔑 **GROQ_API_KEY** gratis: daftar di https://console.groq.com lalu buat key di https://console.groq.com/keys. *(Alternatif: set `AI_PROVIDER=gemini` dan isi `GEMINI_API_KEY` dari https://aistudio.google.com.)*

> ℹ️ Hanya soal **esai/uraian** yang dinilai AI. Soal **pilihan ganda** dinilai otomatis tanpa AI, dan guru tetap memvalidasi nilai esai.

> ⚠️ Simpan dengan nama `.env.local` — bukan `.env.local.txt`. Di Windows, aktifkan dulu **View → File name extensions** agar ekstensinya terlihat.

> 🔒 File ini berisi kunci rahasia. Jangan dibagikan ke siapa pun dan jangan diunggah ke internet.

---

## Langkah 8 — Pasang dan Jalankan

Buka Command Prompt / Terminal, arahkan ke folder aplikasi, lalu jalankan satu per satu (yang pertama butuh beberapa menit):

```bash
npm install
npm run dev
```

Setelah muncul tulisan `Ready`, buka browser dan akses:

```
http://localhost:3000
```

---

## Langkah 9 — Masuk Pertama Kali

Kalau Anda menjalankan akun contoh di langkah 4c, gunakan salah satu akun berikut (password: `password123`):

| Peran | Email |
|---|---|
| Admin | `admin@gmail.com` |
| Guru | `guru@gmail.com` |
| Siswa | `siswa@gmail.com` |

> ⚠️ Segera ganti password bawaan setelah berhasil masuk — terutama akun admin.

Belum ada akun? Masuk sebagai admin → menu **Kelola User** untuk membuat akun guru dan siswa (email dibuat otomatis oleh aplikasi).

---

## Langkah 10 — Online-kan lewat Vercel (Opsional)

Agar aplikasi bisa dibuka dari mana saja:

1. Unggah folder aplikasi ke GitHub.
2. Di [vercel.com](https://vercel.com), klik **Add New Project** → pilih repositori tadi.
3. Isi keempat kunci dari Langkah 7 di bagian **Environment Variables**.
4. Klik **Deploy**.

Setelah selesai, Anda akan mendapat alamat website (misalnya `appmath.vercel.app`) yang bisa dibagikan ke guru dan siswa.

---

## Kalau Ada Masalah

| Yang terjadi | Penyebab & solusi |
|---|---|
| "relation does not exist" / data tidak muncul | Database belum siap. Jalankan ulang file SQL dari Langkah 4 sampai selesai tanpa error. |
| "new row violates row-level security policy" | Bagian aturan akses (RLS) di file SQL belum ikut jalan. Pastikan **seluruh isi** file SQL dijalankan, bukan sebagian. |
| Upload foto gagal / foto tidak tampil | Bucket belum benar. Cek Langkah 5 — nama harus `foto` dan statusnya **Public**. |
| Koreksi jawaban otomatis error | Kunci AI salah/kosong. Periksa kunci di `.env.local` — `GROQ_API_KEY` (atau `GEMINI_API_KEY` bila `AI_PROVIDER=gemini`), lalu jalankan ulang aplikasi. |
| Peringatan "GPS Belum Diaktifkan" terus muncul | Browser memblokir lokasi. Klik ikon gembok di address bar → izinkan **Location** → klik "Coba Lagi". |
| "npm tidak dikenali" | Node.js belum terpasang. Ulangi Langkah 2, lalu tutup & buka ulang Command Prompt / Terminal. |

---

## Catatan Penting

- 📌 **Jangan hapus file `.env.local`.** File itu memegang kunci akses ke database dan AI.
- 💾 **Cadangkan data secara berkala.** Supabase menyediakan backup otomatis di menu Database → Backups.
- 🌐 **Aplikasi berjalan di internet**, jadi komputer yang menjalankannya harus tetap menyala (kecuali sudah dipasang di Vercel).
