// Penilaian jawaban uraian/esai matematika dengan AI.
// Provider dapat diganti lewat env `AI_PROVIDER`: 'groq' (default) | 'gemini'.
// Dipakai bersama oleh /api/ai/score (kuis) dan /api/ujian/submit (ujian).
// Satu adapter per provider; pemanggil tidak perlu tahu provider mana yang aktif.

export type AiScoreResult = { skor: number; feedback: string };
export type AiProvider = 'groq' | 'gemini';

export const DEFAULT_PROVIDER: AiProvider = 'groq';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
// Model Groq terkini (per Okt 2026). llama-3.x sudah deprecated → shutdown 16 Agu 2026,
// jadi default memakai pengganti resmi Groq. Dapat diganti lewat env GROQ_MODEL.
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';
const GEMINI_MODEL_DEFAULT = 'gemini-3.6-flash';

/** Instruksi sistem: paksa balasan JSON agar mudah diparse. */
const SYSTEM_INSTRUCTION =
  'Kamu adalah penilai soal matematika SMP. Balas HANYA dengan JSON valid berformat ' +
  '{"skor": <angka 0-100>, "feedback": "<teks singkat Bahasa Indonesia>"} tanpa teks lain.';

/**
 * Error penilaian AI. `fallback` diisi hanya untuk kasus di mana pemanggil
 * tetap butuh payload skor (mis. format balasan AI tidak bisa diparse).
 */
export class AiScoreError extends Error {
  fallback?: AiScoreResult;

  constructor(message: string, fallback?: AiScoreResult) {
    super(message);
    this.name = 'AiScoreError';
    this.fallback = fallback;
  }
}

/** Normalisasi nama provider dari env. Kosong → default; tak dikenal → `null`. */
export function resolveProvider(raw?: string | null): AiProvider | null {
  const p = String(raw ?? '').trim().toLowerCase();
  if (p === '') return DEFAULT_PROVIDER;
  return p === 'groq' || p === 'gemini' ? p : null;
}

export function buildScoringPrompt(pertanyaan: string, kunciJawaban: string, jawabanSiswa: string): string {
  return `
      Kamu adalah penilai soal matematika tingkat SMP yang sangat baik hati dan suportif.
      Pertanyaan: ${pertanyaan}
      Kunci Jawaban: ${kunciJawaban}
      Jawaban Siswa: ${jawabanSiswa}

      Aturan Penilaian (0-100):
      - Berikan skor kemurahan hati (minimal 40) jika siswa sudah mencoba menjawab panjang lebar meskipun salah, untuk menghargai usahanya.
      - Jika jawabannya benar atau mendekati benar secara konsep, berikan skor 80-100.
      - Jangan memberikan skor di bawah 20 kecuali jawabannya benar-benar kosong atau ngawur (misal: "tidak tahu").

      Berikan feedback singkat, membangun, dan ramah dalam Bahasa Indonesia.
      Kembalikan response hanya dalam format JSON murni:
      {
        "skor": 85,
        "feedback": "Penjelasan langkah-langkah sudah cukup baik, tapi ada sedikit kesalahan di hasil akhir. Tetap semangat!"
      }
    `;
}

/**
 * Ekstrak `{skor, feedback}` dari teks balasan model. Toleran terhadap teks
 * pembungkus (mengambil blok JSON pertama). Skor di-clamp ke rentang 0-100.
 */
export function parseScoreResult(text: string): AiScoreResult {
  const gagal = () =>
    new AiScoreError('Gagal menganalisa format dari AI', {
      skor: 0,
      feedback: 'Gagal menganalisa format dari AI',
    });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw gagal();

  let obj: { skor?: unknown; feedback?: unknown };
  try {
    obj = JSON.parse(match[0]);
  } catch {
    throw gagal();
  }

  const skor = Number(obj?.skor);
  if (!Number.isFinite(skor)) throw gagal();

  return {
    skor: Math.max(0, Math.min(100, skor)),
    feedback: String(obj?.feedback ?? ''),
  };
}

/** Adapter Groq (endpoint kompatibel OpenAI). Mengembalikan teks mentah model. */
async function requestGroq(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  const data: any = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    console.error('Groq API Error:', data?.error || res.status);
    throw new AiScoreError(data?.error?.message || `Error dari Groq API (${res.status})`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiScoreError('Respon Groq tidak sesuai format');
  return text;
}

/** Adapter Gemini (dipertahankan sebagai opsi cadangan). */
async function requestGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data: any = await res.json().catch(() => null);
  if (data?.error) {
    console.error('Gemini API Error:', data.error);
    throw new AiScoreError(data.error.message || 'Error dari Gemini API');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiScoreError('Respon Gemini tidak sesuai format');
  return text;
}

/**
 * Menilai satu jawaban uraian memakai provider aktif (`AI_PROVIDER`, default groq).
 * Melempar AiScoreError bila gagal; pemanggil memetakan error ke response/penilaian manual.
 */
export async function scoreEssayWithAi(params: {
  pertanyaan: string;
  kunciJawaban: string;
  jawabanSiswa: string;
  provider?: string | null;
  apiKey?: string;
  model?: string;
}): Promise<AiScoreResult> {
  const rawProvider = params.provider ?? process.env.AI_PROVIDER;
  const provider = resolveProvider(rawProvider);
  if (!provider) {
    throw new AiScoreError(`AI_PROVIDER tidak dikenal: ${rawProvider} (gunakan 'groq' atau 'gemini')`);
  }

  const prompt = buildScoringPrompt(params.pertanyaan, params.kunciJawaban, params.jawabanSiswa);

  if (provider === 'gemini') {
    const apiKey = params.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AiScoreError('Gemini API Key missing (GEMINI_API_KEY)');
    const model = params.model ?? process.env.GEMINI_MODEL ?? GEMINI_MODEL_DEFAULT;
    return parseScoreResult(await requestGemini(prompt, apiKey, model));
  }

  const apiKey = params.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey) throw new AiScoreError('Groq API Key missing (GROQ_API_KEY)');
  const model = params.model ?? process.env.GROQ_MODEL ?? GROQ_MODEL_DEFAULT;
  return parseScoreResult(await requestGroq(prompt, apiKey, model));
}

/**
 * Membandingkan jawaban pilihan ganda siswa dengan kunci.
 * Kunci disimpan sebagai JSON array teks opsi benar (format sama dengan soal.kunci_jawaban),
 * jawaban siswa boleh berupa string tunggal atau array (untuk soal multi-jawaban).
 */
export function isPilihanGandaBenar(jawabanSiswa: unknown, kunciJawaban: string): boolean {
  try {
    const kunciArray: string[] = JSON.parse(kunciJawaban);
    const jawabArray = Array.isArray(jawabanSiswa) ? jawabanSiswa : [jawabanSiswa];

    // Urutan pilihan tidak berpengaruh — sort dulu sebelum dibandingkan.
    const kStr = JSON.stringify([...kunciArray].sort());
    const jStr = JSON.stringify([...jawabArray].sort());
    return kStr === jStr;
  } catch {
    // Kunci bukan JSON valid (data lama) — fallback ke perbandingan langsung.
    return jawabanSiswa === kunciJawaban;
  }
}
