# Testing Guidelines

## Description
How to verify changes in the Mathematics Learning Application.

## Important
Dua runner tersedia: **Vitest** untuk logika murni (`src/lib/*.test.ts`) dan **Playwright E2E** untuk alur UI (`e2e/*.spec.ts`). E2E berjalan terhadap Supabase asli (data uji `KELAS-E2E` dibuat/dihapus otomatis oleh global setup/teardown) memakai kredensial di `.env.test.local` + service key di `.env.local`. Butuh **Node 20+** (vitest 4 & supabase-js) dan **Google Chrome** terpasang (`channel: 'chrome'`). Skrip/flaky yang belum tertutup tetap diverifikasi lewat review struktural.

## Table of Contents
- Scope
- Goals
- Non Goals
- Verification Commands
- Structural Review Checklist

## Scope
Quality gates applicable to every code change in this repository.

## Goals
- Catch type errors, lint violations, and build breakages before they reach the user.
- Provide a reproducible verification path.

## Non Goals
- Load/performance testing dan visual-regression testing — belum ada.

## Verification Commands
Run from the repository root:

```bash
npm run lint        # ESLint (eslint-config-next)
npm test            # Vitest unit tests (src/lib/*.test.ts)
npm run build       # next build — includes TypeScript type-checking
npm run test:e2e    # Playwright E2E (e2e/*.spec.ts) — butuh Node 20+ & Chrome; auto-start `npm run dev`
```

`npm run build` adalah gate utama: gagal pada type-error & route tak valid. `npm test` mencakup logika deterministik (rata-rata per-bab & ambang remedial, nilai huruf/deskripsi rapor, ketidakhadiran per semester, concurrency, pencocokan jawaban, status ujian). `npm run test:e2e` menutup alur UI end-to-end (guru/siswa/penilaian/remedial/ujian/rapor) terhadap Supabase asli — lihat `e2e/` untuk prasyarat `.env.test.local`.

## Structural Review Checklist
When no executable test covers a change, review against:
1. Does the change match the owning section in `foundation/prd.md`?
2. Does the schema change exist in `supabase_schema.sql` (canonical) **and** its incremental equivalent `supabase_v2_migration.sql`, with RLS added to `supabase_rls_policies.sql`?
3. Are RLS policies strict (no `USING (true)` on writes; role checks use the `is_admin()` / `is_guru_kelas()` helpers)?
4. Do UI changes reuse existing components (`PhotoUpload`, `CameraCapture`, `customAlert`, `generateKopPdf`, `uploadClient`)?
5. Does the change leave unrelated comments/structure intact (codebase & comment integrity)?

**Limitation**: a passing `build`/`lint` does not verify runtime behavior (Supabase RLS, camera permissions, realtime). Those require manual/QA verification on a deployed environment.
