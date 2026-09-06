# 📚 App-Math — Learning Management System (LMS) Matematika

Aplikasi LMS berbasis web untuk pembelajaran matematika SMP dengan fitur multi-role (Admin, Guru, Siswa), AI grading otomatis, penilaian realtime, dan notifikasi browser.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL + Realtime) |
| AI Grading | Google Gemini API |
| Styling | Vanilla CSS |
| Deployment | Vercel |

---

## Prasyarat (Windows)

Pastikan sudah terinstall sebelum mulai:

1. **Node.js v18+** — Download di https://nodejs.org (pilih versi LTS). Verifikasi: buka Command Prompt, ketik node -v
2. **Git** — Download di https://git-scm.com/download/win. Verifikasi: git --version
3. **Akun Supabase** — Daftar gratis di https://supabase.com
4. **Akun Google AI Studio** — Untuk Gemini API Key di https://aistudio.google.com

---

## Langkah Setup (Windows)

### 1. Clone Repository

Buka Command Prompt atau PowerShell, lalu jalankan:

```cmd
git clone https://github.com/Hnfzrog/app-math.git
cd app-math
```

### 2. Install Dependencies

```cmd
npm install
```

### 3. Setup Supabase

**a. Buat Project Baru di Supabase**
1. Login ke https://supabase.com/dashboard
2. Klik New Project
3. Isi nama project, password database, dan pilih region terdekat (Singapore)
4. Tunggu project selesai dibuat (~1-2 menit)

**b. Jalankan Schema Database**
1. Di dashboard Supabase, buka menu SQL Editor
2. Klik New Query
3. Copy seluruh isi file supabase_schema.sql dari repository ini
4. Paste ke SQL Editor, lalu klik Run

**c. Aktifkan Realtime**

Masih di SQL Editor, buat query baru dan jalankan satu per satu:

```sql
alter publication supabase_realtime add table public.konten;
alter publication supabase_realtime add table public.soal;
alter publication supabase_realtime add table public.jawaban_siswa;
```

Catatan: Jika muncul error "already member of publication", abaikan dan lanjutkan.

**d. Isi Data Awal (Seed)**

Buat query baru di SQL Editor, copy-paste isi file seed_data.sql, lalu klik Run.

**e. Nonaktifkan RLS untuk Development**

Buat query baru, copy-paste isi file disable_rls_for_demo.sql, lalu klik Run.

PERHATIAN: File ini hanya untuk demo/development. Jangan gunakan di production!

**f. Catat Kredensial Supabase**

Di dashboard Supabase, buka Settings → API, catat:
- Project URL (contoh: https://xxxxxx.supabase.co)
- anon public key (string panjang dimulai dari eyJ...)

### 4. Setup Environment Variables

Buat file .env.local di folder root project (gunakan Notepad, simpan sebagai .env.local bukan .env.local.txt).

Isi dengan:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

Tips Windows: Jika ekstensi file tidak terlihat, buka File Explorer → View → centang File name extensions

### 5. Jalankan Aplikasi

```cmd
npm run dev
```

Buka browser dan akses: http://localhost:3000

---

## Akun Demo (dari Seed Data)

| Role | Nama | ID (untuk development) |
|---|---|---|
| Admin | Super Admin | a0000000-0000-0000-0000-000000000001 |
| Guru | Budi Guru Matematika | f0000000-0000-0000-0000-000000000001 |
| Siswa | Andi Siswa Rajin | e0000000-0000-0000-0000-000000000001 |

Cara Akses:
- Login Admin: http://localhost:3000/admin
- Login Guru: http://localhost:3000/guru
- Login Siswa: http://localhost:3000/siswa

---

## Notifikasi Browser (Realtime)

Agar fitur notifikasi realtime berfungsi:
1. Buka halaman siswa di browser
2. Klik tombol "Aktifkan" saat muncul banner notifikasi
3. Izinkan notifikasi saat browser meminta konfirmasi
4. Setiap ada tambahan materi/tugas/soal dari guru, notifikasi muncul di Desktop!

---

## Struktur Halaman

```
/                     Halaman utama
/login                Halaman login
/admin/dashboard      Dashboard Admin
/admin/users          Manajemen pengguna
/admin/kelas          Manajemen kelas
/guru/dashboard       Dashboard Guru
/guru/kelas           Manajemen ATP dan soal
/guru/penilaian       Penilaian dan verifikasi nilai siswa
/guru/presensi        Input presensi
/siswa/dashboard      Dashboard Siswa
/siswa/materi         Materi pembelajaran
/siswa/tugas          Kuis dan tugas
/siswa/nilai          Nilai dan status penilaian
```

---

## Deploy ke Vercel

1. Push kode ke GitHub
2. Login ke https://vercel.com dan klik Add New Project
3. Import repository dari GitHub
4. Di bagian Environment Variables, tambahkan ketiga variabel dari .env.local
5. Klik Deploy

---

## Troubleshooting

| Error | Solusi |
|---|---|
| command not found: npm | Install Node.js dari nodejs.org |
| Error: invalid API key | Periksa kembali GEMINI_API_KEY di .env.local |
| Data tidak muncul | Pastikan seed_data.sql sudah dijalankan di Supabase |
| Realtime tidak berjalan | Jalankan SQL aktifkan realtime di langkah 3c |
| Build gagal di Vercel | Pastikan semua environment variables sudah diisi di Vercel dashboard |
