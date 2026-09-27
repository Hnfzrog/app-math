---
description: "EHA skill — test-system: Project-aware expert-role verification strategy and test authoring that reads project docs to choose the right frameworks, commands, layers, and templates. Use when deciding test scope, validating regressions, choosing verification strategy, and writing or reviewing tests across any stack."
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

# Test System

Produces an **expert, project-aware verification strategy and test implementation plan** by reading the repository's documentation contract first, then selecting the correct test types, commands, and conventions for the current stack.

This skill is intentionally **not tied to any single stack or framework**. The stack-specific truth should come from project docs.

This skill is **verification-strategy-first**. Its primary job is to choose the right verification boundary, check type, commands, and assertions; writing the test code is downstream of that decision when implementation is actually needed.

## Required Project Inputs

Read the relevant docs before proposing or writing tests.

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/development/testing.md` | Primary source for verification policy, commands, quality gates, and fallback rules |
| `docs/project-docs/foundation/architecture.md` | Explains runtime boundaries, architecture pattern, integrations, storage, and enforcement rules |
| `docs/project-docs/foundation/status.md` | Reveals current implementation state, risks, and which workstream the change belongs to |
| Relevant feature docs under `docs/project-docs/` or `docs/project-docs/technical-guidelines/` | Provide domain-specific behavior, API contracts, or user-flow expectations |
| Existing test files in the repo | Show naming, folder structure, harness setup, and local conventions |

If one of the required docs is missing and the task depends on it, surface that explicitly and create or update the doc instead of guessing.

## When to Use

| Trigger | Example request |
| --- | --- |
| Change verification | "Choose the right verification for this repository-layer change" |
| API contract update | "What tests should cover this API contract update?" |
| Migration or persistence change | "Write a test plan for this migration change" |
| Documentation-only repo change | "How should I validate a reusable prompt or platform instruction surface update?" |

Use `audit-code` instead when the main question is whether the implementation is correct.
Use `analyze-system` instead when the task is explaining a failure or comparing technical options.

## Procedure

### Step 1 — Identify the verification target

Determine what changed:

- deterministic logic or transformation behavior
- interface, contract, or boundary behavior
- state, storage, migration, or lifecycle behavior
- internal coordination or module interaction behavior
- external dependency or integration behavior
- interactive, operator, or consumer-facing flow
- background, scheduled, evented, or staged processing
- documentation, reusable prompt, or rule behavior

### Step 2 — Read the project-specific verification rules

Use `testing.md` as the first stop.

Extract:

- which checks are required
- which commands are available
- which test layers exist
- which checks are blocking vs advisory
- what to do when the repo has no executable validation yet

### Step 3 — Choose the narrowest useful check

Prefer the smallest check that can disconfirm the current assumption.

Order of preference:

1. targeted unit or component test
2. boundary or contract test
3. integration test
4. build or analysis check
5. documentation or consistency review when no executable check exists

If the user asked to write tests, still make this decision first before drafting any implementation.

### Step 4 — Match the check to the architecture boundary

Use `architecture.md` to decide whether the test should sit at:

- domain or business-logic boundary
- interface or contract boundary
- adapter or integration boundary
- persistence boundary
- presentation or user-flow boundary

Do not test below or above the intended boundary without a reason.

### Step 5 — Follow repository conventions

Use existing project patterns for:

- file naming
- directory structure
- fixtures, samples, or test artifacts
- mocks, stubs, fakes, simulators, or other doubles
- harness or environment setup
- boundary-specific fixtures or sample data
- dependency setup, replacement, or override patterns

If the repo does not define a convention yet, propose one briefly and keep it minimal.

### Step 6 — Execute the documented checks

Run the exact commands from `testing.md` when they exist.

If the repo is documentation-only or otherwise lacks executable checks:

- perform the strongest structural review available
- state the limitation clearly
- recommend the missing verification doc or command only if it materially blocks quality

### Step 7 — Report what was actually covered

Separate:

- what was verified
- what was not verified
- what still depends on manual review or future automation

### Check Selection Matrix

| Scenario | Preferred check type | Read first |
| --- | --- | --- |
| Pure function, mapper, validator, parser | Unit | `testing.md`, `architecture.md` |
| Internal coordination, service, or module behavior | Unit or component | `testing.md`, `architecture.md`, feature docs |
| State transition, migration, or persistence rule | Persistence / migration test | `testing.md`, `architecture.md`, data-model docs |
| Interface, handler, adapter, or contract boundary | Contract or integration test | `testing.md`, API / integration docs |
| Interactive or end-user-visible flow | UI or end-to-end test | `testing.md`, app-flow / UI docs |
| Asynchronous, scheduled, staged, or event-driven processing | Integration or component test | `testing.md`, `architecture.md`, workflow docs |
| Rule, skill, reusable prompt, or documentation change | Consistency review | EHA rules, `testing.md` |

### Test Patterns Reference

#### Pattern A: Narrow Unit Or Component Test
Arrange inputs/collaborators -> Act on boundary -> Assert on value/effect. Best for pure functions, mappers, validators.

#### Pattern B: Persistence Or Contract Test
Set up environment -> Insert/send inputs -> Read/decode output -> Assert on correctness. Best for schema, migrations, API compatibility.

#### Pattern C: Flow Or Interaction Test
Start from entry point -> Drive interaction -> Wait for transition -> Assert on outcome. Best for UI flows, end-to-end boundaries.

## Quality Check

- Choose the narrowest check that can falsify the current assumption
- Do not recommend commands before checking `testing.md`
- Keep the verification boundary aligned with `architecture.md`
- Separate what was verified from what still depends on manual review or future automation

## Anti-Pattern

- Hardcoding one framework's tools into the skill text when that belongs in `testing.md`
- Writing an end-to-end test when a narrow unit or contract test would falsify the same assumption
- Jumping straight to writing test code before choosing the verification boundary and check type
- Recommending commands without first checking `testing.md`
- Guessing naming conventions instead of checking the repo
- Treating documentation-only repositories as if they must already have executable tests
- Confusing architecture examples with mandatory implementation details

## Output Contract

When using this skill, the output should include:
1. the recommended verification boundary
2. the specific check type to use
3. the project docs consulted
4. whether new or changed tests are actually needed
5. the command(s) to run, or the reason no executable command exists
6. the expected assertions or behaviors to verify
7. any residual risks or uncovered paths

## Neutral Prompt Shape
`@agent use test-system on [Target Component/Feature] focusing on [Specific Test Boundaries].`

## Example Prompt
- "Choose the right verification for this repository-layer change"
- "What tests should cover this API contract update?"
- "Write a test plan for this migration change"
