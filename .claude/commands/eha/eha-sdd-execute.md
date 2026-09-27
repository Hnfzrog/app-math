---
description: "EHA sdd-execute — Translate a project specification into tested, working code"
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

# Spec-Driven Development (SDD) Execute

## Goal

Translate a newly updated project specification into tested, working code by following a strict Test-Driven Development (TDD) and Spec-Driven Development (SDD) lifecycle.

## Required Behavior

1. **Read the Specs:** First, read `docs/project-docs/foundation/prd.md` and `docs/project-docs/foundation/architecture.md`.
2. **Read Technical Guidelines (conditional):** If `docs/project-docs/technical-guidelines/index.md` exists, read it and all active guideline files listed in its registry. Implementation code and tests must comply with these rules. If the file does not exist, skip this step.
3. **Verify Spec Completeness:** Check if the user's requested feature is documented in the specs.
   - If the feature is NOT documented, **do not write code yet**. Instead, immediately draft the necessary additions for `foundation/prd.md` and `foundation/architecture.md` and present them to the user. Ask the user: "Should I add these specifications to the project docs and then proceed with implementation?"
4. **Generate Tests (TDD):** If the spec is present, author the test cases that validate the acceptance criteria.
5. **Generate Code:** Write the implementation code to pass the generated tests.
6. **Verify Completeness:** Ensure the code passes the tests and fulfills the architectural rules defined in `foundation/architecture.md`.
7. **Identify Guideline Candidates:** If the implementation establishes or reinforces a durable cross-cutting convention (e.g., error response shape, logging pattern, naming scheme, authentication flow), note it as a candidate for `technical-guidelines/` in the Output Contract. Do not create guideline files — only surface the observation so the user can decide via a Refresh or Bootstrap workflow.

## Output Contract

1. **Spec Mapping:** A brief list linking the code changes you are about to make to the specific lines/sections in the project docs.
2. **Tests Authored:** The tests written to fulfill the spec.
3. **Code Authored:** The implementation code.
4. **Validation:** A summary of how the implementation satisfies the initial specification.
5. **Technical Guidelines Notes:** Any durable cross-cutting conventions discovered or reinforced during implementation that may warrant formalization as technical guidelines (or "None identified").

## Final Pass

- Does the implementation violate any constraints in `foundation/architecture.md`?
- Does the implementation comply with all active guidelines in `technical-guidelines/` (when present)?
- Are there any tests missing for the acceptance criteria listed in `foundation/prd.md`?
- Did I write code for a feature that wasn't in the spec? (If yes, revert it).

## Inputs

- The user's prompt requesting the execution of a feature.
- `docs/project-docs/foundation/prd.md`
- `docs/project-docs/foundation/architecture.md`
- `docs/project-docs/development/testing.md`
- `docs/project-docs/technical-guidelines/index.md` (conditional — read when present)
