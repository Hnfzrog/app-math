# Testing Guidelines

## Description
How to verify changes in the Mathematics Learning Application.

## Important
There is currently **no unit/component test runner** (no Vitest/Jest/Playwright dependency). Verification relies on static checks, type-checking, and structural review. Adding a test runner is a tooling decision that must be proposed before implementation.

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
- Automated unit/integration/E2E tests (until a runner is introduced).

## Verification Commands
Run from the repository root:

```bash
npm run lint        # ESLint (eslint-config-next)
npm run build       # next build — includes TypeScript type-checking
```

`npm run build` is the primary gate: it fails on type errors and invalid routes. `npm run lint` catches unused variables, missing deps in hooks, and other static issues.

## Structural Review Checklist
When no executable test covers a change, review against:
1. Does the change match the owning section in `foundation/prd.md`?
2. Does the schema change exist in `supabase_schema.sql` (canonical) **and** its incremental equivalent `supabase_v2_migration.sql`, with RLS added to `supabase_rls_policies.sql`?
3. Are RLS policies strict (no `USING (true)` on writes; role checks use the `is_admin()` / `is_guru_kelas()` helpers)?
4. Do UI changes reuse existing components (`PhotoUpload`, `CameraCapture`, `customAlert`, `generateKopPdf`, `uploadClient`)?
5. Does the change leave unrelated comments/structure intact (codebase & comment integrity)?

**Limitation**: a passing `build`/`lint` does not verify runtime behavior (Supabase RLS, camera permissions, realtime). Those require manual/QA verification on a deployed environment.
