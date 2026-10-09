# UI/UX Guidelines

## Description
Design system, breakpoint responsive, dan aturan tata letak untuk antarmuka web App Math (admin, guru, siswa).

## Important
Styling memakai **vanilla CSS** (`src/app/globals.css`) — tanpa Tailwind, tanpa CSS-in-JS. Halaman `login` dan root `page.tsx` memakai CSS Modules lokal. **Jangan memakai inline `style` untuk properti tata letak** (`display`, `grid-template-columns`, `width`/`max-width`, `flex-wrap`) karena inline style mengalahkan media query di `globals.css` dan merusak tampilan di layar kecil — inilah akar mayoritas bug responsive yang pernah terjadi (lihat `foundation/status.md`).

## Table of Contents
- Scope
- Goals
- Non Goals
- Design Tokens
- Breakpoints
- Layout Rules
- Component Patterns
- Responsive Checklist

## Scope
Berlaku untuk semua halaman di `src/app/**` dan komponen di `src/components/**`.

## Goals
- Satu sumber kebenaran untuk token warna/geometri dan breakpoint.
- Menjamin seluruh halaman dapat dipakai di HP (≤480px), tablet (≤992px), dan desktop tanpa gulir horizontal.

## Non Goals
- Visual-regression/otomatis testing layout (belum ada — lihat `development/testing.md`).
- Tema gelap, multi-bahasa, atau dukungan aplikasi mobile native (PRD: web responsive saja).

## Design Tokens
Didefinisikan di `:root` `globals.css`:

| Kelompok | Token |
| --- | --- |
| Warna utama | `--primary` `--primary-hover` `--primary-light` |
| Status | `--success` `--warning` `--danger` `--info` (+ varian `*-light`) |
| Netral | `--dark` `--slate-800…50` `--white` |
| Geometri | `--radius-sm` `--radius-md` `--radius-lg` `--radius-full` |
| Bayangan | `--shadow-sm` `--shadow-md` `--shadow-lg` |
| Lain | `--font-family` `--transition` |

Selalu pakai token (mis. `color: var(--primary)`) — jangan menulis nilai heksadesimal baru di JSX/CSS halaman.

## Breakpoints
Desktop-first (media query `max-width`), sesuai `globals.css` bagian "RESPONSIVE BREAKPOINTS":

| Breakpoint | Arti | Yang berubah |
| --- | --- | --- |
| `≤992px` | Tablet & ke bawah | Sidebar jadi drawer (`translateX(-100%)` + tombol ☰), `.grid-2/.grid-3/.exam-layout` → 1 kolom, `.main-body` padding mengecil, breadcrumb disembunyikan |
| `≤640px` | HP | `.topbar-user-info` disembunyikan, `.stats-grid`/`.stats-grid-2` → 1 kolom, `.d-flex.justify-between` membungkus, `.exam-page-header` membungkus, `.table-controls` menumpuk, `.modal-dialog` penuh lebar, toast & banner notifikasi penuh lebar |
| `≤480px` | HP kecil | Padding `.main-body`/`.card-body` mengecil, tombol di `.toolbar-row`/`.tabs-row` selebar penuh |
| `≥1400px` | Layar sangat lebar | `.main-body` dibatasi `max-width: 1400px` dan di tengah |

Menambah breakpoint baru harus disertai alasan; utamakan memakai empat di atas.

## Layout Rules
1. **Grid:** pakai `.grid-2`, `.grid-3`, `.stats-grid`, atau `.stats-grid-2` (kelas). Semua memakai `minmax(0, 1fr)` supaya isi panjang (email, URL, nama) tidak memaksa kolom melebar.
2. **Baris judul/filter + aksi:** pakai `.toolbar-row` (membungkus otomatis) — bukan `display:flex; justify-content:space-between` inline.
3. **Baris tab:** pakai `.tabs-row`.
4. **Baris `d-flex justify-between` lain:** otomatis membungkus di ≤640px (rule global). Jangan menambah inline `display:flex` pada elemen ber-`.d-flex`.
5. **Tabel:** setiap `<table className="table">` harus dibungkus `<div className="table-responsive">` — termasuk tabel di dalam modal.
6. **Badge/chip user di topbar:** kelas `.topbar-user-info .topbar-user-row` (baris hanya aktif ≥641px, agar bisa disembunyikan di HP).
7. **Modal:** cukup `className="modal-dialog"`; ukuran khusus boleh lewat inline `maxWidth` (aman karena `.modal-dialog` sudah `width: 100%`). `style` boleh dipakai untuk nilai **visual** (warna, jarak kecil) — bukan untuk `display`/grid/width.
8. **Tombol selebar penuh:** kelas `.w-100` (tersedia) atau `.btn-block`.
9. **Lebar konten panjang:** bungkus teks panjang dengan `.text-ellipsis` atau `overflow-wrap: anywhere`; jangan bergantung pada `white-space: nowrap`.

## Component Patterns
Kelas yang tersedia dan wajib dipakai ulang (jangan bikin varian baru tanpa alasan):

`.card`, `.card-header`, `.card-body`, `.stats-grid`, `.stats-grid-2`, `.stat-card`, `.grid-2`, `.grid-3`, `.table`, `.table-responsive`, `.table-controls`, `.toolbar-row`, `.tabs-row`, `.search-box`, `.badge*`, `.btn*`, `.form-group`, `.form-control`, `.alert*`, `.modal-overlay`, `.modal-dialog`, `.accordion`, `.notif-item`, `.toast`, `.notif-permission-banner`, `.exam-layout`, `.exam-page-header`, `.nav-soal-grid`, `.flex-1-min`.

Utility: `.d-flex`, `.flex-column`, `.flex-wrap`, `.align-center`, `.justify-between`, `.justify-center`, `.gap-1..4`, `.mt-*`, `.mb-*`, `.my-*`, `.p-*`, `.w-100`, `.h-max`, `.min-w-0`, `.text-center/.text-right/.text-left/.text-muted/.text-sm/.text-ellipsis`, `.bg-light`, `.rounded`.

## Responsive Checklist
Sebelum menyelesaikan perubahan UI:
1. Tidak ada `grid-template-columns` / `display` / `width` / `max-width` dalam inline `style` untuk keperluan tata letak.
2. Tabel baru sudah dibungkus `.table-responsive`.
3. Baris baru memakai `.toolbar-row`/`.tabs-row`/`.d-flex justify-between` (bukan inline flex tanpa wrap).
4. Diuji pada 375px dan 768px: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` (tidak ada gulir horizontal) dan modal muat.
5. Kelas yang dipakai sudah benar-benar ada di `globals.css` — proyek ini **tidak** memakai Tailwind, jadi nama ala-Tailwind (mis. `p-3`, `w-100`) hanya berlaku bila didefinisikan di sana.
