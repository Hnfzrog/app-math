// Notifikasi global (OS + in-app toast) untuk SEMUA role & halaman.
// Sumber tunggal: tabel `notifikasi` (diisi oleh trigger DB).

/** Toast in-app di kanan atas (tanpa React state) — selalu terlihat di halaman mana pun. */
export function tampilkanToast(pesan: string, judul = 'Notifikasi') {
  if (typeof document === 'undefined') return;
  let container = document.getElementById('notif-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notif-toast-container';
    container.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;max-width:340px;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.style.cssText =
    'background:#fff;border-left:4px solid var(--primary,#2563eb);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.15);padding:12px 14px;font-size:14px;color:#0f172a;';
  const h = document.createElement('div');
  h.style.cssText = 'font-weight:700;margin-bottom:2px;font-size:13px;';
  h.textContent = judul;
  const p = document.createElement('div');
  p.textContent = pesan;
  el.appendChild(h);
  el.appendChild(p);
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 6000);
}

/** OS notification bila izin diberikan, DAN SELALU tampilkan toast in-app (agar terlihat di halaman mana pun). */
export function tampilkanNotifikasi(pesan: string, judul = 'Notifikasi') {
  if (typeof window === 'undefined') return;
  // Jangan ganggu siswa saat MENGERJAKAN UJIAN (mode ujian aktif) — badge tetap update.
  if ((window as unknown as { __examMode?: boolean }).__examMode) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(judul, { body: pesan, icon: '/favicon.ico', tag: 'app-notif' });
    } catch {
      /* abaikan bila OS menolak */
    }
  }
  tampilkanToast(pesan, judul);
}
