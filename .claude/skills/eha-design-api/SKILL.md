---
description: "EHA skill — design-api: Project-aware expert-role contract design for APIs, interfaces, repositories, services, message schemas, and module boundaries. Reads project docs first, then produces or reviews a contract consistent with the current repository."
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

# API Design

Produces a **project-aware, expert-level contract design or design review** by reading the repository's project docs first, then applying a reusable method to the current boundary type.

This skill is intentionally reusable across:

- HTTP APIs
- internal service interfaces
- repositories and adapters
- event or message contracts
- data-transfer schemas
- client or SDK boundaries

It should **not** assume one language, framework, transport, or architecture style until the project docs confirm them.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/foundation/architecture.md` | Defines stack, architecture boundaries, dependency rules, and integration patterns |
| `docs/project-docs/foundation/prd.md` | Clarifies scope, constraints, stakeholders, and non-goals |
| `docs/project-docs/development/testing.md` | Defines how the contract should be validated |
| Relevant feature docs, API docs, or guidelines | Provide domain-specific rules, request/response shapes, workflows, and edge cases |
| Existing code or contracts in the repo | Show local naming, layering, serialization, validation, and error conventions |

If the repository lacks the contract-defining docs needed for the task, call that out and create or update the missing docs instead of inventing local rules in the skill.

## When To Use

Use this skill when designing or reviewing one of these boundary types.

| Boundary type | Typical artifacts |
| --- | --- |
| External HTTP / RPC API | route, handler, controller, request/response schema, auth, pagination, versioning |
| Internal service interface | method signatures, error contract, idempotency, retries, transaction boundaries |
| Repository or persistence boundary | interface, query contract, mapping rules, transaction semantics |
| Adapter or integration boundary | client interface, DTOs, transport mapping, failure translation |
| Event or message contract | payload schema, producer/consumer expectations, ordering, retry, dead-letter rules |
| Module boundary | public interface, dependency direction, allowed imports, extension points |

## Procedure

### Step 1 — Identify the contract owner

Determine which layer or module owns the boundary.

Questions to answer:

- Is this public or internal?
- Is it synchronous or asynchronous?
- Is it request/response, command, query, event, or stream based?
- Which side owns validation?
- Which side owns retries and failure translation?

Use `architecture.md` to avoid violating the project's dependency or layering rules.

### Step 2 — Identify the project-specific constraints

Extract from project docs:

- naming conventions
- error model
- serialization format
- auth and authorization expectations
- pagination / filtering conventions
- idempotency or transaction expectations
- observability or auditing requirements
- compatibility or versioning rules

Do not assume REST, JSON, SQL, Clean Architecture, CQRS, or any other pattern unless the docs require it.

### Step 3 — Define the contract shape

Design the minimal contract that supports the required behavior.

Depending on the boundary, specify:

- inputs
- outputs
- failure modes
- validation rules
- side effects
- ordering or transaction semantics
- timeouts or retry expectations
- invariants that must always hold

Prefer explicit types or schemas over ambiguous free-form payloads.

### Step 4 — Separate durable domain concepts from transport details

If the project distinguishes domain models from transport or persistence models, keep them separate.

Typical separations include:

- domain entity vs API DTO
- service input object vs controller request body
- repository interface vs database table model
- event contract vs internal aggregate or entity state

Use the separation rules already defined by the project docs. Do not invent new layering rules casually.

### Step 5 — Define the error contract

Specify:

- expected failure categories
- how they surface to callers
- which failures are retriable
- which failures are validation vs business vs infrastructure errors
- what data is safe to expose externally

If the repo already defines a standard result wrapper, exception hierarchy, or error envelope, reuse it.

### Step 6 — Define verification requirements

Use `testing.md` to decide how the contract should be validated.

Examples:

- schema or serialization tests
- handler / controller tests
- repository or persistence tests
- integration tests against a real dependency
- compatibility or migration checks
- documentation consistency review

### Step 7 — Produce the design output

The output should fit the repository style and include enough detail to implement safely without locking the repo into one stack-specific pattern that the docs do not support.

## Output Contract

When using this skill, the output should include:

1. the boundary type
2. the project docs consulted
3. the proposed contract shape
4. validation and error rules
5. ownership and dependency implications
6. verification strategy
7. open questions that still require product or architecture decisions

## Quality Checks

Use this checklist when reviewing an existing contract:

- Is the boundary owned by the correct layer or module?
- Does the contract match project naming and error conventions?
- Are validation rules explicit?
- Are transport details separated from durable domain concepts where required?
- Are failure modes documented and actionable?
- Does the contract create hidden coupling or leak implementation details?
- Is there a clear verification strategy in `testing.md`?

## Anti-Patterns

- Embedding one stack's rules into the skill instead of reading project docs
- Designing an interface before understanding the owning boundary
- Mixing transport payload shape with domain concepts when the project separates them
- Returning ambiguous success or failure semantics
- Ignoring versioning, compatibility, or migration concerns for externally visible contracts
- Over-designing the contract far beyond the current scope in `prd.md`

## Output Contract

When using this skill, the output should include:
1. the boundary type
2. the project docs consulted
3. the proposed contract shape
4. validation and error rules
5. ownership and dependency implications
6. verification strategy
7. open questions that still require product or architecture decisions

## Neutral Prompt Shape
`@agent use design-api on [Target Entity/Feature] focusing on [Specific Constraints/Version].`

## Example Prompt
- "Design the repository contract for this feature"
- "Review this controller and DTO boundary"
- "Design an event payload for this workflow"
- "Define the error contract for this external integration"
