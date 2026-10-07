// supabase-js meng-inisialisasi klien Realtime saat createClient → butuh WebSocket global.
// Node 20 tidak punya native WebSocket (baru ada di Node 22), jadi pakai paket `ws`.
import { WebSocket } from 'ws';

const g = globalThis as unknown as { WebSocket?: unknown };
if (!g.WebSocket) g.WebSocket = WebSocket;
