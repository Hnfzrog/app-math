---
description: "EHA skill — audit-code: Project-aware expert-role broad verification that reads project docs first, classifies the verification target, and routes to the best specialist skill for executable or non-executable checks across code, contracts, docs, architecture, quality, security, reliability, and project health."
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

# Code Audit

Provides an **expert, project-aware broad verification entry point** for requests that ask whether something is correct, consistent, healthy, complete, or aligned with the repository's contract and project docs.

This skill is **routing-first**. Its primary job is to identify the dominant verification question and route to the single best specialist skill rather than duplicating every verification procedure itself.

This skill is intentionally **not tied to any single stack or framework**. When executable checks are needed, it should select the correct framework, commands, and conventions from the project's `development/testing.md`, `foundation/architecture.md`, and local repository patterns.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| EHA Rules | Defines routing, ownership, precedence, and the active skill model |
| `docs/project-docs/foundation/architecture.md` | Defines boundaries, dependencies, stack choices, and anti-violation rules |
| `docs/project-docs/development/testing.md` | Defines available validation and evidence strength |
| `docs/project-docs/foundation/prd.md` | Clarifies scope, non-goals, and project stage |
| `docs/project-docs/foundation/status.md` | Defines maturity, roadmap, active workstreams, and readiness context |
| Relevant guideline docs under `docs/project-docs/technical-guidelines/` | Define technical standards such as API, logging, database, error-handling, code style, or design patterns |
| Relevant code, tests, docs, contracts, and repository artifacts | Provide the actual evidence surfaces to verify against |

If required project docs are missing, surface that gap explicitly and limit confidence rather than guessing.

## When to Use

| Trigger | Example request |
| --- | --- |
| Broad verification request | "Verify this feature against the project docs, contract, and actual code" |
| API and implementation alignment | "Check whether this API matches the docs, code, and guideline standards" |
| Repository consistency and health check | "Evaluate this project for health, maturity, architecture drift, and consistency" |
| Stack-aware validation request | "Use the right testing and review approach for this Go service" |
| Requirements or decision consistency review | "Check whether these requirements and design decisions still match the repo" |

Use a specialist skill directly when the dominant question is already obvious:

- `test-system` for executable verification strategy, stack-aware test selection, and test-writing decisions
- `audit-code` for code correctness, bug, risk, security, and boundary review
- `audit-parity` for repository drift across docs, platform instruction surfaces, skills, prompts, and summaries
- `analyze-system` for root-cause reasoning, trade-off evaluation, and requirement or decision analysis
- `design-api` for API, schema, interface, or boundary contract design and review

## Procedure

### Step 1 — Identify the verification target

Determine what the user wants verified:

- executable behavior or regression risk
- code quality, bug risk, or security exposure
- API or interface contract alignment
- docs or contract consistency
- architecture or design consistency
- project health, maturity, readiness, or reliability posture
- requirements, assumptions, trade-offs, or design-decision consistency

### Step 2 — Gather the governing truth

Read the contract and the owning project docs first.

Extract:

- applicable verification rules
- current stack and boundary model
- active guidelines and standards
- project stage and readiness expectations
- available evidence and validation commands

If documentation and implementation disagree, determine whether the repository already defines which side is authoritative for that fact. If it does not, surface the conflict and ask the user before deciding the fix path.

### Step 3 — Choose the dominant verification mode

Prefer the single strongest verification path unless the user explicitly asks for a broader sweep.

| Dominant verification question | Route to |
| --- | --- |
| How should this be verified, tested, or regression-checked in the current stack? | `test-system` |
| Is this code correct, safe, consistent, and free of obvious bugs or boundary violations? | `audit-code` |
| Does this API or interface contract match the docs, code, and boundary rules? | `design-api` |
| Do the docs, platform instruction surfaces, skills, prompts, and repository artifacts still agree? | `audit-parity` |
| Do the requirements, trade-offs, design decisions, or explanations hold up? | `analyze-system` |

Example prompt shapes by verification category:

| Verification category | Example prompts |
| --- | --- |
| Executable verification strategy | "Verify this Python bug fix and tell me which `pytest` checks should run." / "Use the right test approach for this Go handler and tell me what command to run." |
| Code quality, bug, risk, or security review | "Verify whether this module has bug risks, security issues, or boundary violations." / "Check this implementation against the docs and code-quality rules." |
| API or interface contract alignment | "Verify whether this API matches the project docs, guideline standards, and actual code." / "Check whether this repository contract still matches the service and its documented boundary rules." |
| Docs, contract, or repository consistency | "Verify whether the project docs still match the current repository and contract." / "Check for drift across docs, platform instruction surfaces, skills, prompts, and quick-reference files." |
| Architecture, health, maturity, or readiness | "Verify this project's health and maturity against the contract and current repository state." / "Check whether the architecture and current implementation still support production readiness." |
| Requirements, trade-offs, or decision consistency | "Verify whether these requirements and design decisions still hold up against the current repo." / "Check whether this technical trade-off still makes sense given the architecture and status docs." |

### Step 4 — Select the stack-aware checks

When executable validation is required, choose the appropriate framework and commands from project docs and local repo conventions.

**Examples** of the decision pattern:

- Go project -> use the Go testing approach documented in `testing.md`
- Python project -> use the Python testing approach documented in `testing.md`
- documentation-only project -> use structural consistency review rather than inventing executable checks

Do not hardcode frameworks in the skill itself when the owning repo docs should decide them.

### Step 5 — Report the routed verification plan

State:

- what is being verified
- which specialist skill is the best fit
- why that route was chosen over nearby alternatives
- what evidence and checks should be used
- what remains outside the chosen verification path

## Quality Check

- No finding without evidence from the target artifact
- No severity inflation
- No style nitpicks disguised as bugs
- No architecture complaint without reference to actual project boundaries
- No recommendation that ignores project stage or available validation

## Anti-Pattern

- Calling something dead code without checking workspace usage
- Calling something a bug without defining the failure condition
- Criticizing a pattern that the project explicitly chose in `architecture.md`
- Recommending wide rewrites before testing a local fix or a smaller boundary change

## Output Contract

When using this skill, the output should include:

1. the verification target summary
2. the dominant verification mode
3. the specialist skill selected and why
4. the project docs and evidence surfaces consulted
5. the recommended checks or commands to run, or the reason no executable check exists
6. the expected output or findings type from the selected path
7. any residual risks or uncovered verification areas
8. whether user direction is required before deciding between conflicting docs and implementation

## Neutral Prompt Shape
`@agent use audit-code on [Target File/Change] focusing on [Specific Risks/Boundaries].`

## Example Prompt
- "Audit this service for boundary violations"
- "Review this change for correctness risks"
- "Check this module for dead code and duplication"
- "Audit this workflow implementation for operability gaps"