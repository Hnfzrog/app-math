// Jadwal & status ujian — dipakai bersama oleh halaman guru dan siswa.

export type StatusUjian = 'draf' | 'belum' | 'buka' | 'tutup';

type UjianJadwal = {
  is_terbit?: boolean | null;
  mulai_at?: string | null;
  selesai_at?: string | null;
};

/**
 * Status ujian pada saat ini.
 * `draf` = belum diterbitkan guru (siswa tidak melihatnya sama sekali).
 */
export function statusUjian(u: UjianJadwal): StatusUjian {
  if (!u.is_terbit) return 'draf';

  const now = Date.now();
  if (u.mulai_at && now < new Date(u.mulai_at).getTime()) return 'belum';
  if (u.selesai_at && now > new Date(u.selesai_at).getTime()) return 'tutup';
  return 'buka';
}

export function labelStatusUjian(status: StatusUjian): string {
  switch (status) {
    case 'draf': return 'DRAF';
    case 'belum': return 'BELUM DIBUKA';
    case 'buka': return 'BERLANGSUNG';
    case 'tutup': return 'DITUTUP';
  }
}

export function badgeStatusUjian(status: StatusUjian): string {
  switch (status) {
    case 'draf': return 'badge-secondary';
    case 'belum': return 'badge-warning';
    case 'buka': return 'badge-success';
    case 'tutup': return 'badge-danger';
  }
}

export function formatJadwal(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * ISO dari DB → format yang diminta <input type="datetime-local">.
 * Wajib memakai getter LOKAL supaya nilainya tidak bergeser zona waktu.
 */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
