import fs from 'node:fs';

/** Muat variabel dari .env.test.local lalu .env.local (yang belum diset saja). */
export function loadEnv() {
  for (const file of ['.env.test.local', '.env.local']) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* file tidak ada */
    }
  }
}
