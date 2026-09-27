---
description: "EHA skill — audit-parity: Expert-role parity check across project docs, platform instruction surfaces, skills, reusable prompts, workflows, quick-reference material, and implementation evidence when authority depends on the current codebase. Use when checking whether the template system still agrees with itself or when preparing cleanup after major changes."
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

# Parity Audit

Performs an expert repository-wide drift audit to find contradictions, stale summaries, duplicated ownership, code-vs-doc authority conflicts, and historical artifacts that should be classified rather than confused with active truth.

This skill is the dedicated parity audit capability for the EHA system. Use it when the task is analytical rather than generative.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| EHA Rules | Ownership map and canonical doc taxonomy |
| `docs/project-docs/foundation/prd.md` | Active project identity and scope |
| `docs/project-docs/foundation/architecture.md` | Active stack and architecture truth |
| `docs/project-docs/development/testing.md` | Active verification truth |
| `docs/project-docs/foundation/status.md` | Active roadmap and current-state truth |
| Platform instruction surfaces | Automatic behavior layer |
| Skills and reusable prompts | Reusable procedure and generation layers |
| Workflow, handoff, and historical docs | Potentially valid references or stale artifacts |
| Relevant code, tests, configs, and runtime-facing artifacts | Evidence for whether active docs still match the current repository |

## When to Use

| Trigger | Example request |
| --- | --- |
| Full-repo review | "Audit the whole repository for drift after a cleanup pass" |
| Documentation review | "Check whether project docs, reusable prompts, and the current repository still agree" |
| Template maintenance | "Audit platform instruction surfaces and skills after changing the contract" |
| Handoff preparation | "Find contradictions before handing this repo to another maintainer" |

## Scope

Check at least these areas when present:

- `docs/project-docs/`
- `docs/project-docs/index.md`
- `docs/project-docs/technical-guidelines/`
- relevant code, tests, configs, or runtime-facing artifacts when a finding depends on current implementation behavior or source-of-truth ownership
- clearly named reference or archive folders such as `docs-legacy/`, `docs-old/`, `archive/`, or `reference/`
- platform instruction surfaces (mirrored rule files)
- skills and reusable prompts
- workflow docs and handoff docs

### High-Value Drift Categories

- stack and dependency choices
- test commands and quality gates
- architecture and dependency rules
- optional and conditional regular-doc inventory mismatches
- API / integration ownership
- technical guideline ownership, overlap, and missing guideline index coverage
- semantic legacy-to-owner mapping mismatches where content is relevant but naming differs
- code-vs-doc authority mismatches where current implementation and active docs disagree
- workflow expectations
- roadmap / phase naming
- project identity and naming
- undocumented domain knowledge embedded in the codebase (e.g., decision rationale in comments, architectural constraints in configs, domain rules in validation logic) that should be surfaced into project docs

## Procedure

### Step 1 — Establish the source of truth

Use the active EHA rules as the default source of truth for documentation ownership unless the repository explicitly states otherwise.

Treat `docs/project-docs/index.md` and `docs/project-docs/technical-guidelines/index.md` as the authoritative inventories for optional regular docs and guideline docs when present.

Treat clearly named reference or archive folders such as `docs-legacy/`, `docs-old/`, `archive/`, or `reference/` as migration input only, not as owner-doc paths.

### Step 2 — Compare dependent layers

Compare the source-of-truth docs against:

- platform instruction surfaces
- skills
- reusable prompts
- workflow docs
- quick references and summaries
- relevant code, tests, configs, and runtime-facing artifacts when a finding depends on current implementation behavior or authority order

If code and docs conflict and the repository does not explicitly define which side is authoritative for that fact, surface the conflict and ask the user before choosing the fix path.

When a repo is migrating from another documentation format, use those reference folders to map legacy topics into the correct owner docs under `docs/project-docs/`.

### Step 3 — Classify each mismatch

Every mismatch should be classified as one of:

- contradiction
- stale summary
- duplicated ownership
- historical artifact
- optional module not active in the current repo

When evaluating legacy material, classify it by the durable concern it governs rather than by its legacy name or path. Treat names such as `epic`, `milestone`, `roadmap`, `protocol`, `procedure`, `policy`, or `standard` as hints only.

Report likely mappings when content points to an active owner even if naming differs, such as phased-planning content that should map to `foundation/phases/` or technical-rule content that should map to `technical-guidelines/`.

### Step 4 — Apply structural drift rules

Check for these specific structural drift conditions:

- A missing `docs/project-docs/index.md` when optional or conditional regular docs exist beyond the always-required core set.
- A missing `technical-guidelines/index.md` when guideline files exist.
- Registry entries without matching files and files without matching registry entries, unless the registry explicitly marks them deprecated or archived.
- A missing recommended guideline only when the repo already claims that domain is covered or the repo claims to be fully documented for that domain.

### Step 5 — Assess impact

Determine whether the mismatch affects:

- implementation safety
- automation behavior
- reusable prompt outputs
- onboarding clarity
- release or verification confidence
- authority certainty between docs and implementation

### Step 6 — Recommend ownership-level fixes

Recommend which owning file or layer should be updated. Do not spread the same fact across more files than necessary.

If a legacy artifact could plausibly map to more than one active owner, or if preserving the legacy label may be intentional, ask the user for direction instead of silently classifying it.

When asking for that direction, prefer a concise question that names the fact in conflict and the likely choices. Example: `I found a conflict between the code and the docs for the active API behavior. Should I treat 1. the code as correct and update the docs, 2. the docs as correct and treat the code as drift, or 3. mark this as an intentional temporary mismatch?`

If strong repository evidence already establishes the authority order for that fact, state that evidence explicitly instead of asking.

## Quality Check

- Do not confuse reference material with active truth
- Do not propose fixing both sides of a contradiction when one side clearly owns the fact
- Distinguish blocking contradictions from harmless historical leftovers
- Keep the audit actionable, not just descriptive
- Do not assume docs or code win when authority for the disputed fact is not explicit
- Treat missing code evidence the same as missing doc evidence: reduce confidence, state the limitation, and avoid guessing
- Do not fix anything unless explicitly asked

## Anti-Pattern

- Treating summary files as the owner when the contract defines a different source of truth
- Reporting drift without naming the owning file or layer that should change
- Escalating every historical artifact as a blocker instead of classifying it correctly
- Duplicating the same fact across multiple layers as a fix for drift
- Assuming implementation drift or documentation drift without checking whether the repository defines authority for that fact

## Output Contract

For each finding, include:

1. severity
2. fact in conflict
3. source-of-truth location
4. conflicting location
5. classification
6. whether the conflict is doc-vs-doc, code-vs-doc, or registry-vs-file
7. why it matters
8. recommended owner to update
9. whether user direction is required before deciding the fix path

End with:
1. highest-priority drift items
2. acceptable historical artifacts that should not be treated as blockers

## Neutral Prompt Shape
`@agent use audit-parity on [Target Scope/Repo] focusing on [Specific Conflicts/Docs].`

## Example Prompt
- "Audit the repository for contradictions after the latest template changes"
- "Check whether reusable prompts and skills still match the contract"
- "Find stale summaries in the project docs"
- "Classify which mismatches are blockers versus historical artifacts"