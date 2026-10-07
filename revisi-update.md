## Revisi

1. **Kartu pada dashboard guru dan siswa**
   - Kartu seperti LKPD dan tugas dapat diklik.
   - Saat diklik, pengguna langsung diarahkan ke daftar LKPD, daftar tugas, atau halaman terkait.

2. **Penilaian per bab**
   - Tampilkan daftar siswa beserta status pengerjaannya (sudah atau belum mengerjakan).
   - Guru dapat membuka penilaian untuk setiap siswa dan menyimpan nilai secara individual, bukan menilai seluruh siswa sekaligus.

## Tambahan Fitur

### Pengumuman dan Notifikasi

1. **Pengumuman oleh admin**
   - Admin dapat membuat pengumuman untuk guru, siswa, beberapa pengguna, atau semua pengguna.
   - Pengumuman ditampilkan di dashboard guru atau siswa yang dituju dan dikirim sebagai notifikasi.
   - Admin dapat mengatur batas waktu tayang. Setelah batas waktu tersebut, pengumuman hilang.
   - Setiap pengumuman memiliki judul dan deskripsi.

   **Contoh**

   - **Judul:** Pemeliharaan Website
   - **Deskripsi:** Pada 10 Oktober 2026 pukul 11.00–16.00 akan dilakukan pemeliharaan website. Mohon maaf, aktivitas Anda di website akan terhenti selama proses tersebut.

2. **Pengumuman oleh guru**
   - Guru dapat membuat pengumuman untuk semua kelas, beberapa kelas, atau siswa tertentu.
   - Pengumuman memiliki pengaturan dan ditampilkan seperti pengumuman yang dibuat admin.

   **Contoh**

   - **Judul:** Minggu Ujian
   - **Deskripsi:** Persiapkan diri sebaik mungkin untuk ujian pekan depan.

### Ujian dan Tugas

1. **Informasi pada daftar ujian dan tugas**
   - Tambahkan jumlah soal pada setiap kartu ujian atau tugas.
   - Tetap tampilkan informasi waktu buka, batas waktu pengerjaan, dan durasi.

2. **Pengiriman jawaban**
   - Perbaiki waktu tunggu yang cukup lama setelah siswa mengirim jawaban ujian atau tugas.

3. **Pembahasan**
   - Guru dapat mengunggah pembahasan untuk ujian atau tugas.
   - Pembahasan diterbitkan setelah semua siswa selesai mengerjakan, dengan jeda satu menit (H+1 menit), atau pada waktu yang ditentukan melalui pengaturan.

4. **Mode ujian**
   - Saat ujian dimulai, tampilkan halaman pengerjaan dalam mode layar penuh.
   - Deteksi dan catat pelanggaran apabila siswa keluar dari halaman pengerjaan ujian.
   - Catat total durasi siswa berada di luar halaman ujian.

### Penilaian

1. **Penilaian menyeluruh**
   - Sediakan tampilan penilaian menyeluruh.

2. **Penilaian per bab**
   - Guru memilih bab, lalu sistem menampilkan daftar siswa dan kolom nilai:
     - Nilai LKPD
     - Nilai tugas
     - Nilai UH
     - Keaktifan (5%)
     - Rata-rata bab
   - Kolom penilaian menyesuaikan dengan komponen yang tersedia pada bab tersebut. Rata-rata dihitung berdasarkan komponen penilaian yang ada.
   - Di samping rata-rata bab, sediakan tombol **Penilaian** dan **Feedback**.
   - Melalui tombol **Penilaian**, guru dapat memilih komponen yang akan dinilai (LKPD, tugas, atau UH), sesuai komponen yang tersedia pada bab tersebut.
   - Untuk UH, tampilkan jawaban siswa di sebelah kiri dan panel penilaian guru di sebelah kanan. Guru memeriksa kembali hasil deteksi AI dan dapat mengoreksinya.
   - Terapkan alur pemeriksaan yang sama untuk LKPD dan tugas. Nilai LKPD, tugas, dan UH hanya berdasarkan hasil pekerjaan siswa; nilai keaktifan tidak ditambahkan ke komponen-komponen tersebut.
   - Setelah semua komponen diverifikasi, guru dapat mengisi nilai keaktifan pada kolom yang tersedia. Sistem kemudian menampilkan rata-rata akhir.
   - Jika rata-rata lebih dari 75, siswa dapat melanjutkan ke bab berikutnya.
   - Jika rata-rata kurang dari 75, siswa harus mengikuti remedial. Guru dapat membuat tugas atau UH remedial yang hanya dibuka untuk siswa dengan nilai di bawah 75.

3. **Penilaian ujian (UTS/UAS)**
   - Sediakan pilihan jenis ujian: UTS atau UAS.
   - Tampilkan daftar siswa beserta nilainya.
   - Guru dapat membuka penilaian untuk setiap siswa dan memeriksa jawaban yang telah dikoreksi AI.
   - Tampilkan jawaban siswa di sebelah kiri dan panel penilaian guru di sebelah kanan. Guru dapat memeriksa setiap soal, menentukan apakah jawaban benar atau salah, serta mengoreksi hasil AI.
   - Tampilkan jumlah jawaban benar dan salah, lalu sediakan opsi untuk mengirim penilaian setiap siswa.

## Laporan Bug dari Pengguna

### Bug: Tiba-tiba logout dan tombol fitur kadang tidak merespons

- **Keluhan:** Saat mengklik beberapa fitur, tombol kadang tidak merespons dan pengguna tiba-tiba keluar (logout).
- **Dampak:** Paling sering terjadi pada tampilan admin.
- **Status:** Perlu investigasi dan perbaikan.

**Dugaan penyebab (hasil telaah kode awal, belum direproduksi)**

1. Proteksi rute di [proxy.ts](src/proxy.ts) hanya membaca cookie `user-role`. Cookie ini dibuat di halaman login tanpa `max-age` dan tidak tersinkron dengan sesi Supabase. Jika cookie hilang atau tidak terkirim, pengguna dialihkan ke `/login` meski sesi Supabase masih aktif.
2. Hook `useCurrentUser` mengarahkan ke `/login` setiap kali `getSession()` gagal atau mengembalikan sesi kosong, termasuk saat terjadi gangguan jaringan sementara atau refresh token sedang berjalan.
3. Proxy mengalihkan ke `/login` untuk semua rute `/admin`, termasuk permintaan prefetch dari `<Link>`. Hal ini bisa memicu pengalihan yang tidak disengaja.
4. Klik yang "tidak terdaftar" kemungkinan karena halaman masih memuat data (tanpa indikator loading) atau terjadi re-render saat sesi dimuat ulang.

**Rencana perbaikan**

- Migrasi autentikasi ke `@supabase/ssr` agar sesi dan proteksi rute memakai cookie sesi yang sama, lalu hapus cookie `user-role` manual.
- Tangani error sementara pada `getSession()` dengan retry, dan hanya arahkan ke `/login` bila sesi benar-benar tidak ada.
- Tambahkan listener `onAuthStateChange` untuk menangani token refresh dan sign-out secara konsisten.
- Tambahkan status loading atau nonaktifkan tombol saat proses berjalan agar klik tidak terlewat.
- Tambahkan log pada pengalihan ke `/login` (rute, penyebab) agar kejadian berikutnya mudah dilacak.

**Cara memastikan bug tuntas**

1. Reproduksi di halaman admin: klik cepat berulang antar menu selama 5–10 menit, lalu catat kapan logout terjadi.
2. Uji skenario: tab dibiarkan idle lama, jaringan lambat (throttling), beberapa tab terbuka, dan refresh halaman.
3. Setelah perbaikan, ulangi skenario yang sama pada akun admin, guru, dan siswa.
4. Minta pengguna pelapor mencoba kembali dan konfirmasi.
