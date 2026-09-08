import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { jawabanSiswa, kunciJawaban, pertanyaan } = await req.json();

    // Pastikan API Key Gemini ada
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API Key missing' }, { status: 500 });
    }

    const prompt = `
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    const data = await response.json();
    
    // Cek jika API return error dari Gemini
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return NextResponse.json({ error: data.error.message || 'Error dari Gemini API' }, { status: 500 });
    }

    if (!data.candidates || !data.candidates[0]) {
      console.error('Unexpected Gemini response:', data);
      return NextResponse.json({ error: 'Respon Gemini tidak sesuai format' }, { status: 500 });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON block returned by Gemini
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ skor: 0, feedback: 'Gagal menganalisa format dari AI' }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
