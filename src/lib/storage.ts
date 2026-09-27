import { createClient } from '@supabase/supabase-js';

// Supabase Storage (bucket publik). Server-side upload pakai service role (bypass RLS).
export const STORAGE_BUCKET = 'foto';
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(key, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return key;
}

export async function getFromStorage(key: string): Promise<{ body: Buffer; contentType: string }> {
  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(key);
  if (error) throw new Error(error.message);
  const bytes = Buffer.from(await data.arrayBuffer());
  return { body: bytes, contentType: data.type || 'application/octet-stream' };
}
