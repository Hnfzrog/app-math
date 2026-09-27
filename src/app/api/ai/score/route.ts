import { NextResponse } from 'next/server';
import { AiScoreError, scoreEssayWithAi } from '@/lib/aiScore';

export async function POST(req: Request) {
  try {
    const { jawabanSiswa, kunciJawaban, pertanyaan } = await req.json();

    const result = await scoreEssayWithAi({ pertanyaan, kunciJawaban, jawabanSiswa });
    return NextResponse.json(result);
  } catch (error: any) {
    // Kasus "format balasan AI tidak terbaca" tetap mengembalikan payload skor 0.
    if (error instanceof AiScoreError && error.fallback) {
      return NextResponse.json(error.fallback, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
