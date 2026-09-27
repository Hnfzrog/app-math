import { supabase } from './supabase';

const STORAGE_BUCKET = 'foto';
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

// Kompresi gambar (resize + JPEG) supaya upload lebih cepat & kecil.
async function compressImage(file: File, maxDim = 1280, quality = 0.8): Promise<File> {
  if (file.size < 300 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function postUpload(file: File, folder: string): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error('File melebihi 2MB. Gunakan link Google Drive untuk file besar/video.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Upload gagal');
  return json.key as string;
}

// Upload gambar (dengan kompresi) — untuk foto profil/presensi/jawaban.
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error('File melebihi 2MB. Gunakan link Google Drive untuk file besar/video.');
  }
  const compressed = await compressImage(file);
  return postUpload(compressed, folder);
}

// Upload file umum (pdf, doc, xls, dll) tanpa kompresi — untuk tugas.
export async function uploadFile(file: File, folder: string): Promise<string> {
  return postUpload(file, folder);
}

// Update profil dalam SATU endpoint: kirim field + foto (opsional) sekaligus.
export async function updateProfile(fields: Record<string, string>, file: File | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesi tidak ditemukan. Silakan login ulang.');

  const fd = new FormData();
  fd.append('token', session.access_token);
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v || ''));
  if (file) fd.append('file', file);

  const res = await fetch('/api/profile', { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menyimpan profil');
}

// Mengembalikan URL untuk ditampilkan. Key = path object di Storage; URL http = external (Drive).
export function fileUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
