---
description: "EHA discuss — Brainstorm and finalize a feature spec before implementation"
---

## EHA Project Doc Rules

**4-Layer Taxonomy.** All project docs live under `docs/project-docs/`:
- `foundation/` — prd, architecture, workflow, status, phases, changelog, feature-inventory
- `operations/` — ci-cd, production-runbook, governance, compliance, observability, security
- `development/` — testing, api-contract, database, ui-ux, error-handling, internationalization
- `technical-guidelines/` — domain-specific cross-cutting rules (API, database, logging, etc.)

**Legacy/Reference Docs:** Treat folders named `archive/`, `docs-legacy/`, or `reference/` as secondary migration input only, never as authoritative active truth.

**Mandatory core docs:** `index.md`, `getting-started.md`, `foundation/prd.md`, `foundation/architecture.md`, `foundation/workflow.md`, `foundation/status.md`, `operations/ci-cd.md`, `operations/production-runbook.md`, `development/testing.md`, `development/api-contract.md`, `development/database.md`, `development/ui-ux.md`.

**Authority order:** project docs → codebase → agent judgment. When docs conflict, the owning doc wins. When code and docs conflict and authority is unclear, surface the conflict and ask the user — do not guess.

**Universal stable headings (every file):** Description, Important, Table of Contents, Scope, Goals, Non Goals.

**Key ownership rules:**
- Vision, personas, requirements → `foundation/prd.md`
- Stack and architecture → `foundation/architecture.md`
- Dev loop and PR process → `foundation/workflow.md`
- Verification commands and quality gates → `development/testing.md`
- Execution plan and progress → `foundation/status.md`
- Sprint tracking and backlogs → `foundation/phases/`
- Optional doc inventory → `index.md`
- Domain-specific technical rules → `technical-guidelines/` (Create these only for durable cross-cutting rules; avoid placeholders).

**SDD rule:** Specifications dictate implementation. Follow a strict 4-step workflow: 1. Update project docs first, 2. Generate tests based on the specs, 3. Generate code to pass the tests, 4. Logically map every code change back to a spec requirement. Refuse to write code for features not in the spec.

**Flexible Baselines Principle:** Omit docs the repo doesn't need. Mark unknowns as `TBD` or `Assumption`. Mark inferred facts as `Inferred from codebase` until the user confirms them.

---

# SDD Discuss Phase (Brainstorming)

## Goal

Act as a Senior Engineer / Agile Product Manager to help the user brainstorm and finalize the specifications for a new feature or architectural change *before* it gets committed to the permanent documentation or implemented in code.

## Required Behavior

1. **Do NOT Write Code:** This is purely a planning and discussion phase. Do not output any implementation code.
2. **Interview the User:** Ask clarifying questions to eliminate ambiguity. Consider:
   - Edge cases and error states.
   - API shapes and payload structures.
   - UI/UX constraints or responsive layouts.
   - Data model changes (new tables, columns, relations).
3. **Draft the Spec:** Once the user answers your questions and you reach an agreement, output a drafted, markdown-formatted snippet that is ready to be injected into the specific target documents (e.g., `foundation/prd.md`, `foundation/architecture.md`, `development/api-contract.md`).
4. **Final Approval:** Ask the user: "Should I execute the SDD workflow (`01-sdd-execute.md`) with these specifications?"

## Output Contract

1. **Your Questions:** 1-3 highly targeted technical questions about the gray areas of the feature.
2. **The Drafted Spec:** A clear, concise markdown block representing the final agreed-upon rules.

## Inputs

- The user's rough feature idea or concept.
- Read `docs/project-docs/foundation/prd.md` if it exists (to understand current scope).
- Read `docs/project-docs/foundation/architecture.md` if it exists (to understand current stack constraints).
