// Penilaian jawaban uraian/esai dengan Gemini.
// Dipakai bersama oleh /api/ai/score (kuis) dan /api/ujian/submit (ujian).

const GEMINI_MODEL = 'gemini-3.6-flash';

export type AiScoreResult = { skor: number; feedback: string };

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
 * Menilai satu jawaban uraian. Melempar AiScoreError bila gagal; pemanggil
 * yang memetakan error tersebut ke response HTTP.
 */
export async function scoreEssayWithAi(params: {
  pertanyaan: string;
  kunciJawaban: string;
  jawabanSiswa: string;
  apiKey?: string;
}): Promise<AiScoreResult> {
  const GEMINI_API_KEY = params.apiKey ?? process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new AiScoreError('Gemini API Key missing');
  }

  const prompt = buildScoringPrompt(params.pertanyaan, params.kunciJawaban, params.jawabanSiswa);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error('Gemini API Error:', data.error);
    throw new AiScoreError(data.error.message || 'Error dari Gemini API');
  }

  if (!data.candidates || !data.candidates[0]) {
    console.error('Unexpected Gemini response:', data);
    throw new AiScoreError('Respon Gemini tidak sesuai format');
  }

  const textOutput = data.candidates[0].content.parts[0].text;

  const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AiScoreError('Gagal menganalisa format dari AI', {
      skor: 0,
      feedback: 'Gagal menganalisa format dari AI',
    });
  }

  return JSON.parse(jsonMatch[0]) as AiScoreResult;
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
