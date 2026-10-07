import { describe, it, expect } from 'vitest';
import {
  resolveProvider,
  parseScoreResult,
  isPilihanGandaBenar,
  scoreEssayWithAi,
  AiScoreError,
  DEFAULT_PROVIDER,
} from '@/lib/aiScore';

describe('resolveProvider — pemilihan provider', () => {
  it('default groq bila env kosong', () => {
    expect(DEFAULT_PROVIDER).toBe('groq');
    expect(resolveProvider(undefined)).toBe('groq');
    expect(resolveProvider(null)).toBe('groq');
    expect(resolveProvider('')).toBe('groq');
  });

  it('menerima groq & gemini (case-insensitive, trim)', () => {
    expect(resolveProvider('groq')).toBe('groq');
    expect(resolveProvider('GEMINI')).toBe('gemini');
    expect(resolveProvider('  Gemini ')).toBe('gemini');
  });

  it('null untuk provider tak dikenal', () => {
    expect(resolveProvider('openai')).toBeNull();
    expect(resolveProvider('claude')).toBeNull();
  });
});

describe('parseScoreResult — ekstraksi {skor, feedback}', () => {
  it('parse JSON murni', () => {
    expect(parseScoreResult('{"skor": 85, "feedback": "Bagus"}')).toEqual({ skor: 85, feedback: 'Bagus' });
  });

  it('toleran terhadap teks pembungkus', () => {
    expect(parseScoreResult('Hasil:\n{"skor": 70, "feedback": "Cukup"}\nSemangat!')).toEqual({
      skor: 70,
      feedback: 'Cukup',
    });
  });

  it('coerce skor bertipe string', () => {
    expect(parseScoreResult('{"skor": "90", "feedback": "ok"}')).toEqual({ skor: 90, feedback: 'ok' });
  });

  it('clamp skor ke rentang 0-100', () => {
    expect(parseScoreResult('{"skor": 150, "feedback": "x"}').skor).toBe(100);
    expect(parseScoreResult('{"skor": -5, "feedback": "x"}').skor).toBe(0);
  });

  it('feedback kosong bila tidak ada', () => {
    expect(parseScoreResult('{"skor": 80}')).toEqual({ skor: 80, feedback: '' });
  });

  it('throw AiScoreError (dengan fallback) bila tidak ada JSON', () => {
    expect(() => parseScoreResult('tidak ada json')).toThrow(AiScoreError);
    try {
      parseScoreResult('tidak ada json');
    } catch (e) {
      expect((e as AiScoreError).fallback).toEqual({ skor: 0, feedback: 'Gagal menganalisa format dari AI' });
    }
  });

  it('throw bila JSON rusak atau skor bukan angka', () => {
    expect(() => parseScoreResult('{skor: abc}')).toThrow(AiScoreError);
    expect(() => parseScoreResult('{"skor": "abc"}')).toThrow(AiScoreError);
  });
});

describe('isPilihanGandaBenar — tetap tanpa AI', () => {
  it('cocok tanpa memperhatikan urutan', () => {
    expect(isPilihanGandaBenar('2', JSON.stringify(['2']))).toBe(true);
    expect(isPilihanGandaBenar(['b', 'a'], JSON.stringify(['a', 'b']))).toBe(true);
  });

  it('salah bila berbeda', () => {
    expect(isPilihanGandaBenar('3', JSON.stringify(['2']))).toBe(false);
  });
});

describe('scoreEssayWithAi — guard gagal-cepat tanpa jaringan', () => {
  const base = { pertanyaan: 'x', kunciJawaban: 'y', jawabanSiswa: 'z' };

  it('groq tanpa kunci → AiScoreError (tidak memanggil API)', async () => {
    await expect(scoreEssayWithAi({ ...base, provider: 'groq', apiKey: '' })).rejects.toThrow(/Groq API Key missing/);
  });

  it('gemini tanpa kunci → AiScoreError', async () => {
    await expect(scoreEssayWithAi({ ...base, provider: 'gemini', apiKey: '' })).rejects.toThrow(/Gemini API Key missing/);
  });

  it('provider tak dikenal → AiScoreError', async () => {
    await expect(scoreEssayWithAi({ ...base, provider: 'openai' })).rejects.toThrow(/tidak dikenal/);
  });
});
