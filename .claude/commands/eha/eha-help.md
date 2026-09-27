---
description: "EHA help — Get help and tutorial on EHA workflows and philosophy"
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

---
description: "EHA workflow - help"
---

# EHA Help & Tutorial

This is your interactive guide to using Eye Hate Agent (EHA).

## 1. Overview
Eye Hate Agent (EHA) standardizes human-agent collaboration through a unified Spec-Driven Development (SDD) contract, structured workflows, and specialist skills.

## 2. The 4-Layer Taxonomy
All project documentation is structured under a predictable 4-layer taxonomy:
- `docs/project-docs/foundation/` — PRD, Phases, Status, Changelog
- `docs/project-docs/operations/` — CI/CD, Deployment, Runbooks
- `docs/project-docs/development/` — Testing, Database, Architecture, API-Contract, UI-UX
- `docs/project-docs/technical-guidelines/` — Stable project/language/linting guidelines

## 3. Interactive Workflow Commands
Trigger these commands inside your chat window to coordinate development:

| Trigger Command | Purpose | When to Use |
| :--- | :--- | :--- |
| `/eha-bootstrap` | Initializes a brand-new documentation set | Run in repos with **no existing docs**. For truly empty repos, it will guide you to `/eha-discuss` first. |
| `/eha-refresh` | Synchronizes and migrates project documentation | Run in **active projects** to sync code with docs. |
| `/sdd-discuss` | Brainstorm specifications and API contracts | Run **before coding** to align specs. |
| `/sdd-execute` | Spec-driven code generation via TDD | Run **during implementation** to write tests/code. |
| `/eha-execute-phase` | Execute a project phase (greenfield/brownfield) using SDD | Run with a phase identifier (e.g. 1 or P1) to drive phase implementation. |

## 4. Specialist Skills
Invoke skills directly in your prompts (e.g. `use eha-design-api`):
- `eha-analyze-system` — Inspect architecture and codebase logic
- `eha-design-api` — Plan or refactor REST/GraphQL/gRPC APIs
- `eha-design-db-schema` — Design schemas and migrations
- `eha-design-ui-ux` / `eha-design-wireframe` — UI/UX wireframes and styling systems
- `eha-audit-code` — Multi-layered verification and codebase scanning
- `eha-audit-parity` — Automated drift analysis
- `eha-audit-security` — Dependency scanning and threat modeling
- `eha-test-system` — Rigorous testing plans and case design
- `eha-build-ci-cd` — Build pipeline configurations
- `eha-build-logging` — Application logging (pipe-delimited format, PII masking) — logs only, not metrics/tracing
- `eha-generate-api-contract` — Document existing API endpoints from code
- `eha-generate-fsd` — Generate Functional Specification Documents from PRDs, BPMN, code, or user stories
- `eha-generate-task-tracker` — Evidence-driven task tracker tables from git history and project docs
- `eha-analyze-design` — Business process analysis from UI designs/screenshots
- `eha-refactor` — Technical debt cleanup and optimization

## 5. Subagents (Isolated Delegation)
Delegate focused work to isolated specialists with scoped tool access (Claude/Copilot). Each wraps a skill and inherits its full procedure at build time — one source of truth, no duplicated instructions:
- `eha-security` — Read-only security analysis (wraps `audit-security`)
- `eha-tester` — Generate & run tests in isolation (wraps `test-system`)
- `eha-parity` — Detect drift / parity issues, read-only (wraps `audit-parity`)
- `eha-analyst` — Explore & summarize, read-only (wraps `analyze-system`)

> Invoke manually with `@eha-<name>`. Want the orchestrator to **auto-delegate** matching requests? Re-run install with `--subagent-routing` (opt-in; off by default).

## 6. Quick Start Instructions
If starting a new feature:
1. Run `/sdd-discuss` to brainstorm specs.
2. Update project docs to reflect the spec.
3. Run `/sdd-execute` to execute code via TDD.
4. Maintain `changelog.md` and `status.md`.

---

## 7. Strict Output Contract (Token Economy)
When the user triggers this command, you **MUST** adhere to the following rules to conserve maximum tokens:
1. **Ultra-Concision:** Respond immediately with extremely short, direct answers. Do not write introductory filler (no "Sure, let's look at...", "Here is...", or greetings).
2. **Minimal Text:** Keep all explanations under 5 words per item. Rely strictly on the tables and bullet lists above.
3. **Redirection:** Conclude the output in exactly one short question: "Which workflow would you like to run next?"
