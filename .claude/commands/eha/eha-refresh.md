---
description: "EHA refresh — Refresh project docs after a change in scope, stack, or behavior"
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

# Project Docs Refresh Reusable Prompt

Refresh, migrate, or create project documentation by combining the **codebase** and any **existing documentation** (active SDD docs, legacy docs, or non-SDD markdown).

## Goal

Update **only the docs that own the changed information** while keeping the documentation set consistent. When creating docs for the first time from existing material, combine codebase evidence with legacy/existing content to produce accurate SDD-compliant documentation.

## Step 0: Doc State Detection

Before refreshing, classify the repository's documentation state:

| State | Condition | Action Path |
| :--- | :--- | :--- |
| **Active SDD** | `docs/project-docs/` exists with SDD-format files (stable headings, 4-layer taxonomy) | Standard refresh: update owning docs, sync dependents |
| **Legacy Only** | `docs-legacy/`, `docs-old/`, `archive/`, or `reference/` exist, but no `docs/project-docs/` | Migration refresh: create SDD docs from legacy content + codebase |
| **Non-SDD Docs** | `docs/` exists with unstructured markdown (no stable headings, no taxonomy) | Conversion refresh: treat as legacy input, create SDD docs from content + codebase |
| **Mixed** | `docs/project-docs/` exists AND legacy/reference folders also exist | Hybrid refresh: update active SDD docs + migrate unmapped legacy content + codebase |

*Note: For Active SDD and Mixed states, also check for the existence of `foundation/phases/` directory and `foundation/changelog.md` to determine if they need active refreshment.*

For **Legacy Only** and **Non-SDD Docs** states, auto-detect the Taxonomy Tier:

- Examine the breadth and depth of the existing documentation + codebase complexity.
- If content covers only core concerns (identity, architecture, status) → Tier 1 (Lite).
- If content includes testing, API, database, or CI/CD concerns → Tier 2 (Standard).
- If content includes governance, security, compliance, observability, i18n, or structured cross-cutting technical conventions (e.g., API rules, error catalogs, logging standards, design-pattern catalogs) → Tier 3 (Enterprise).
- When uncertain, choose the lower tier and note what would trigger upgrade.
- State the auto-detected tier in your output so the user can override it if needed.

**Dynamic Generation from Registry:** Use the master registry embedded below to obtain the universal stable headings schema and the unique domain-specific headings for each document type within the detected or applicable tier. Generate each document dynamically using this structural mapping.


<!-- === EHA MASTER REGISTRY START === -->
<!-- Auto-embedded by EHA engine. Do not edit manually. -->

# Project Docs Registry

Last update: 2026-06-01

Status: Live

---

## 1. Description
This index is the master registry and layout definition for all Spec-Driven Development (SDD) documentation within EHA-adopting repositories. It defines the universal stable headings schema and active document types.

## 2. Important
All documentation generated under `docs/project-docs/` (except `index.md`, `getting-started.md`, and guideline registries) must strictly implement the Universal Stable Headings schema and incorporate the unique domain-specific headings defined below.

## 3. Table of Contents
- [1. Description](#1-description)
- [2. Important](#2-important)
- [3. Table of Contents](#3-table-of-contents)
- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Universal Stable Headings](#7-universal-stable-headings)
- [8. Active Doc Type Registry](#8-active-doc-type-registry)
- [9. Domain-Specific Headings Catalog](#9-domain-specific-headings-catalog)

## 4. Scope
Covers the structural headings, layers (`foundation/`, `development/`, `operations/`), and domain headings for EHA-governed repositories.

## 5. Goals
Eliminate template boilerplate redundancy, prevent cross-document drift, and lower agent context consumption.

## 6. Non Goals
Does not define technical guidelines rules (refer to `technical-guidelines/index.md`).

## 7. Universal Stable Headings
Every project document must include these numbered headings in this exact order. Domain-specific headings go after § 6 and before the closing set. Feel free to add extra domain-specific headings if needed to capture important project context.

### Opening Set:
1. Description
2. Important
3. Table of Contents
4. Scope
5. Goals
6. Non Goals

### Closing Set (always last, in this order):
- Success Metrics
- Related Documents
- Open Questions

## 8. Active Doc Type Registry

| Doc Type | Layer | Tier | Description |
| :--- | :--- | :--- | :--- |
| `getting-started.md` | Root | 1 | Orientation and local setup instructions. |
| `foundation/prd.md` | foundation | 1 | Vision statement, target personas, user journeys, features. |
| `foundation/architecture.md` | foundation | 1 | System architecture, tech stack, data flow, system flows, ADRs. |
| `foundation/status.md` | foundation | 1 | High-level status, recent wins, roadmap. |
| `foundation/workflow.md` | foundation | 1 | Branching, local development loop, PRs, code reviews. |
| `foundation/phases/` | foundation | Conditional | Phase-based project planning. Generated when the project has active development phases (greenfield or brownfield). Contains `index.md` (phase registry) and individual phase files. |
| `foundation/changelog.md` | foundation | Conditional | Historical releases log. Generated when a project reaches a formal release milestone or requires historical change tracking. |
| `development/testing.md` | development | 2 | QA policy, matrices, environments, gates, naming standards. |
| `development/api-contract.md` | development | 2 | API authentication, endpoints, payloads, webhooks, rate limits. |
| `development/database.md` | development | 2 | Schema, entity models, indexes, migrations, data dictionary. |
| `development/ui-ux.md` | development | 2 | Design rules, wireframes, screen layouts, design tokens, responsive, a11y. |
| `development/internationalization.md` | development | 3 | Languages support, translations flow, currency, dates. |
| `operations/ci-cd.md` | operations | 2 | CI/CD pipelines, test gates, secrets handling, deploys. |
| `operations/production-runbook.md` | operations | 3 | Release procedures, rollback, environment config, smoke checks. |
| `operations/governance.md` | operations | 3 | Versioning policy, release cadence, code ownership rules. |
| `operations/security-compliance.md` | operations | 3 | Threat mitigation, RBAC, encryption, data privacy/retention, audit logging. (Merged security + compliance) |
| `operations/observability-error-handling.md` | operations | 3 | Log levels, error payloads, server fallbacks, alerts, dashboard metrics. (Merged observability + error handling) |
| `[custom-path].md` | [layer] | [tier] | [Add custom document templates here as needed to activate additional files] |

## 9. Domain-Specific Headings Catalog

This catalog defines the baseline required domain-specific headings for each document type. When documenting a repository, both developers and AI agents are **NOT** limited to this baseline catalog; they must actively append additional, custom domain-specific headings to capture the unique features, patterns, and architectural realities discovered in the codebase.

### `getting-started.md`
- Prerequisites
- First Steps
- Local Setup
- Verification
- Troubleshooting

### `foundation/prd.md`
- Vision Statement
- Target Personas
- Core Business Value
- User Journeys & App Flow
- Feature Workflows
- Functional Requirements
- Non-Functional Requirements
- Acceptance Criteria
- External Dependencies & Partners

### `foundation/architecture.md`
- Tech Stack Overview
- Architecture Pattern
- System Flow
- Data Flow
- Tools Integration
- Global Parameters and Constraints
- Architecture Decision Records

### `foundation/status.md`
- Current State
- Recent Accomplishments
- Upcoming Focus
- Key Metrics
- Roadmap
- Epics
- Risks/Blockers

### `foundation/workflow.md`
- Local Dev Loop
- Branching Strategy
- PR & Code Review
- Issue Tracking

### `foundation/phases/index.md`
- Project Type (Greenfield / Brownfield)
- Overall Timeline
- Phase Registry (table of all phases with status, links to individual files)
- How to Add New Phases

### `foundation/phases/phase-{N}[-description].md` (Greenfield naming)
### `foundation/phases/phase-P{N}[-description].md` (Brownfield naming)
- Phase Goal
- Timeline (Start → End)
- Feature Summary & Core Functions
- Sub-Functions / Tasks
- Sprint Tracker
- Acceptance Criteria
- Dependencies & Blockers
- Status (Not Started / In Progress / Complete)
- Deprecated Features

### `foundation/changelog.md`
- [Unreleased] (Added/Changed/Deprecated/Removed/Fixed/Security entries)

### `development/testing.md`
- Verification Policy & Objectives
- Verification Matrix & Coverage
- Test Layers & Environments
- Commands & CI Gates
- Naming & File Conventions
- Manual Checks & Fallbacks

### `development/api-contract.md`
- Base URL & Auth
- Request/Response Format
- Endpoints
- Webhooks
- Rate Limiting

### `development/database.md`
- DB Architecture
- Schema Definitions
- Indexes
- Migration Strategy
- Data Dictionary

### `development/ui-ux.md`
- Design Philosophy
- Design System
- Wireframing
- Screen Layouts
- Component Library
- Responsive
- Accessibility (A11y)
- Design Handoff

### `development/internationalization.md`
- Supported Languages
- Translation Workflow
- Fallback Locales
- Date & Currency

### `operations/ci-cd.md`
- Pipeline Architecture
- Build Steps
- Testing & Quality Gates
- Deployment Environments
- Secrets

### `operations/production-runbook.md`
- Environment Overview
- Prerequisites & Access
- Release Procedure
- Smoke Checks
- Rollback
- Operational Notes

### `operations/governance.md`
- Versioning Policy
- Release Cadence
- Code Ownership
- Contribution Guidelines

### `operations/security-compliance.md`
- Security Objectives & Threats
- Access Control & RBAC
- Data Encryption & Privacy
- Data Retention
- Audit Logging
- Compliance Audits & Legal Disclaimers

### `operations/observability-error-handling.md`
- Logging Strategy
- Standard Error Payloads
- Global Error Codes
- Client-Side Rules & Server Fallbacks
- Metrics & Dashboards
- Alerting Rules
- Distributed Tracing

### `[custom-path].md`
- [Add the custom document's unique domain headings here, e.g., "Caching Strategy" or "Performance Budgets"]

<!-- === EHA MASTER REGISTRY END === -->

Proceed to the applicable action path.

## Required Behavior

1. Read the current project docs before editing anything.
2. Use the EHA Project Doc Rules above to identify which files own the changed information.
3. Read `docs/project-docs/index.md` and `docs/project-docs/technical-guidelines/index.md` when present and treat them as the authoritative inventories for optional docs and guideline docs.
4. When clearly named reference or archive folders such as `docs-legacy/`, `docs-old/`, `archive/`, or `reference/` exist, read them as migration input only and do not treat them as owner-doc paths.
5. Update only the affected docs and any documents that summarize them.
6. Preserve stable headings wherever possible.
7. Avoid rewriting unrelated sections.
8. If the change introduces a new durable concern, create the smallest justified new doc.
9. If the change affects an optional regular doc or its metadata, update `docs/project-docs/index.md` when present.
10. If the change affects domain-specific technical guidance, update the owning guideline and `technical-guidelines/index.md` when present.
11. When legacy or reference docs are being mapped into the active owner-doc set, classify them by the durable concern they govern rather than by the legacy folder or filename; legacy names are hints only.
12. Normalize non-standard legacy labels by meaning when they map cleanly to an active owner. For example, `epic`, `milestone`, or `roadmap` material may map to `docs/project-docs/foundation/phases/`, while `protocol`, `procedure`, `policy`, or `standard` material may map to `docs/project-docs/technical-guidelines/` when the content is domain-specific technical guidance.
13. When legacy or reference docs show that a justified optional doc should become active under `docs/project-docs/`, promote it into the active owner-doc set instead of leaving it stranded in reference-only folders.
14. When legacy or reference docs contain domain-specific technical guidance that is still valid, create or update the relevant files under `docs/project-docs/technical-guidelines/` and create `technical-guidelines/index.md` when any guideline becomes active.
15. When legacy or reference docs contain explicit phased planning, epic tracking, or execution-map detail that should stay active, create or update `docs/project-docs/foundation/phases/` and register the active optional doc directory in `docs/project-docs/index.md`.
16. If a legacy artifact could plausibly map to more than one active owner, or if preserving the legacy label may be intentional, ask the user for direction instead of guessing.
17. Preserve valuable legacy sections (e.g., 'Decision Rationale') that do not exist in the starter templates. Decide whether this information belongs as a new custom section in an existing document or warrants a new separate file entirely. Ask the user if the best approach is ambiguous. Do not discard domain-specific knowledge just because it lacks a standard template heading.
18. When asking for that direction, prefer a concise question that states the inferred owner and the fallback choices. Example: `I found legacy "protocol" docs that look like technical guidance. Should I 1. skip them, 2. migrate them into active guideline docs, or 3. preserve "protocol" as a project-specific doc type?`
19. When docs are being created for the first time against an existing codebase with no prior documentation, inspect code, comments, configs, tests, and repository structure for valuable domain knowledge that goes beyond standard template headings. Surface these findings as new custom sections or new files where justified. Mark codebase-inferred facts as `Inferred from codebase` or `Open Question` until the user confirms them.
20. **Always cross-reference the codebase.** When creating or updating any SDD document, inspect the relevant source code, configs, tests, package manifests, CI/CD pipelines, and runtime artifacts to verify and enrich the documentation. Do not rely solely on existing docs or legacy material — the codebase is evidence.
21. **When codebase evidence contradicts existing documentation or legacy material, do NOT silently choose one side.** Instead, prompt the user with a concise question and option selection. Example: `I found a drift between the codebase and the docs: [describe the conflict]. Which is correct? 1. The codebase (update the docs to match), 2. The docs (flag the code as needing a fix), or 3. Both are intentionally different (document the exception).` Always present at least these three options. Do not proceed until the user resolves the conflict.
22. When creating SDD docs from legacy + codebase, actively mine:
    - `package.json` / dependency manifests → architecture, stack, testing frameworks
    - CI/CD configs (`.github/workflows/`, `Dockerfile`, etc.) → operations/ci-cd
    - Test directories and test runners → development/testing
    - Database schemas, migrations, ORM configs → development/database
    - API route definitions, controllers, middleware → development/api-contract
    - Environment variables, secrets management → operations/production-runbook
    - Error handling patterns, logging setup → operations/observability-error-handling
    - Auth/RBAC implementations → operations/security-compliance
    - i18n config, locale files → development/internationalization
    - README, inline comments, decision rationale → foundation/prd, architecture
    - Recurring cross-cutting implementation conventions (response envelope, query-builder usage, ID-stripping, caching, error catalog, naming/auth patterns) → `docs/project-docs/technical-guidelines/*.md` via the Technical Guidelines Discovery & Interview step; register in `technical-guidelines/index.md`.
23. Mark all codebase-inferred facts as `Inferred from codebase` until the user confirms them.
24. **Active Development & Phases Detection (MANDATORY).** When refreshing a project that does not yet have `foundation/phases/`, you **MUST** check all four active development signals before proceeding to doc refresh. Do NOT skip this step. The signals are:

    1. **Recent commits** — run `git log --oneline -20` or equivalent; if there are commits within the last 14 days, OR 10+ commits within the last 30 days, this signal is positive.
    2. **Sprint/feature branches** — run `git branch -a` and look for naming patterns like `sprint/`, `phase/`, `release/`, `feature/`, `feat/`, `dev/`.
    3. **Planning artifacts** — check for `TODO.md`, `ROADMAP.md`, `.github/ISSUE_TEMPLATE/`, issue tracker references in recent commits (e.g., `#123`, `fixes #`, `closes #`), or project board configs.
    4. **TODO density** — grep the codebase for `TODO`, `FIXME`, `HACK` comments; if count ≥ 5, this signal is positive.

    If **any one** signal is positive, you **MUST** prompt the user:
    "This project shows active development signals ([list which signals were positive and what was found]).
    Would you like to set up `foundation/phases/` to track your development cycles?
    If yes, describe the current and upcoming phases (or I can infer from your codebase)."

    If the user agrees, create `foundation/phases/index.md` and individual phase files using brownfield naming (`phase-P{N}[-description].md`, e.g., `phase-P1-refactor.md`).
    If the user declines, skip phases creation entirely — but still report the detection outcome in the Output Contract.
    If all four signals are negative, skip the phases prompt but note in your output that all four active development signals were negative and no phases were offered.
25. **Phases Update Workflow.** When `foundation/phases/` already exists, treat it as a living operational document:
    - Update sprint tracker in the active phase file when sprint-related changes are detected.
    - Mark completed phases by updating their status.
    - If the user requests a new phase, create the next numbered phase file and update the index.
    - Cross-reference `foundation/status.md` epics/roadmap with phase progress.

### Review Sequence

1. Run Step 0 (Doc State Detection).
2. Read the change summary (if provided) or the user's intent.
3. **Scan the codebase** — inspect source code, configs, tests, CI/CD pipelines, and package manifests for current truth. This step is NOT optional.
4. **Phases Detection Gate** — If `foundation/phases/` does not exist, execute Rule 24 (Active Development & Phases Detection) now. Run all four signal checks using the codebase data from step 3. If any signal is positive, prompt the user about setting up phases before continuing. If `foundation/phases/` already exists, proceed to step 5.
5. Read the owning project docs (if Active SDD or Mixed state).
6. Read `docs/project-docs/index.md` and `docs/project-docs/technical-guidelines/index.md` when present.
7. Read legacy/reference folders when present.
8. Read relevant guideline docs when the change touches technical rules.
9. **Technical Guidelines Discovery & Interview.** Building on the codebase scan, identify **durable cross-cutting implementation conventions** that are (a) NOT already documented under `docs/project-docs/technical-guidelines/`, and (b) referenced across **multiple features or domains** (not owned by a single standard doc). Examples: API response envelope shape, error-handling/error-constant discipline, logging conventions, naming schemes, dynamic query-builder usage, in-memory cache patterns, public/private response transformation, authentication/identity conventions. For each candidate note: the convention, why it is durable + cross-cutting, and a codebase evidence citation (`file:line`). Then present the candidates to the user and ask which (if any) to formalize:

   - **User approves one or more** → generate `technical-guidelines/<convention>.md` for each using the **Guideline Stable Headings** baseline (`## 1. Summary`, `## 2. Scope`, `## 3. Rules`, `## 4. Preferred Patterns`, `## 5. Anti-Patterns`, `## 6. Related Docs`, `## 7. Open Questions`), with **real rules inferred from the codebase — never placeholder stubs**; consult the guidelines registry embedded below for extended domain-specific headings. Register each new file in `technical-guidelines/index.md` and link it from `docs/project-docs/index.md`.


<!-- === EHA GUIDELINES REGISTRY START === -->
<!-- Auto-embedded by EHA engine. Do not edit manually. -->

# Guidelines Registry

Last update: 2026-06-01

Status: Live

---

## 1. Description
This registry is the authoritative catalog and schema definition for all active technical guideline documents inside the repository. While core project documents explain the repository generally, technical guidelines document the durable, cross-cutting coding and design conventions that developers and AI agents must follow during implementation.

## 2. Important
Guidelines are durable, codebase-level rulebooks. They must never be created as simple placeholders. A guideline is officially activated in bootstrap, refresh, and parity loops only when it has an active row registered in the Active Guidelines table below.

## 3. Table of Contents
- [1. Description](#1-description)
- [2. Important](#2-important)
- [3. Table of Contents](#3-table-of-contents)
- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Active Guidelines Registry](#7-active-guidelines-registry)
- [8. Registry Rules & Ownership](#8-registry-rules--ownership)
- [9. Guideline Stable Headings](#9-guideline-stable-headings)
- [10. Success Metrics](#10-success-metrics)
- [11. Related Documents](#11-related-documents)
- [12. Open Questions](#12-open-questions)

## 4. Scope
Covers the active guideline categories, ownership tracking, review triggers, and standard heading rules for technical guidelines.

## 5. Goals
Standardize the coding and architectural rules across the codebase, preventing design-pattern divergence and ensuring high code quality.

## 6. Non Goals
Does not document general project setup, business logic, or operational procedures (refer to the master project docs registry `index.md`).

## 7. Active Guidelines Registry

| Guideline | Domain | Purpose | Owner | Review Trigger |
| :--- | :--- | :--- | :--- | :--- |
| `technical-guidelines/api.md` | API | Request or response contracts, versioning rules, and integration boundaries | TBD | API contract or integration changes |
| `technical-guidelines/database.md` | Database | Schema, migration, naming, and persistence rules | TBD | Schema or storage changes |
| `technical-guidelines/logging.md` | Logging | Event naming, log levels, redaction, and correlation rules | TBD | Logging policy or observability changes |
| `technical-guidelines/error-handling.md` | Error handling | Error taxonomy, propagation, user-safe messages, and fallback rules | TBD | Error model or operational changes |
| `technical-guidelines/json.md` | JSON | Serialization, naming, nullability, and payload-shape rules | TBD | Payload or contract changes |
| `technical-guidelines/code-style.md` | Code style | Repo-specific style rules beyond formatter and linter defaults | TBD | Tooling or style-policy changes |
| `technical-guidelines/design-patterns.md` | Design patterns | Preferred design patterns, boundary patterns, and forbidden coupling | TBD | Architecture or module-boundary changes |
| `technical-guidelines/internationalization.md` | i18n/l10n | Rules for i18n keys, fallbacks, and adding new languages | TBD | i18n tooling or language changes |
| `technical-guidelines/testing.md` | Testing | Rules for writing tests, naming conventions, mocking, and coverage | TBD | Testing framework or coverage changes |
| `technical-guidelines/ui-ux.md` | UI/UX | Rules for UI components, accessibility standards, and design system usage | TBD | Design system or component library changes |
| `technical-guidelines/[custom-guideline].md` | [Domain] | [Durable technical rules and conventions for custom domain] | TBD | [Review trigger, e.g. "API or schema changes"] |

Remove rows for inactive domains and add a new row in the `## 7. Active Guidelines Registry` table above for any other active guideline files.

## 8. Registry Rules & Ownership
- Keep this index aligned with the files that actually exist under `technical-guidelines/`.
- A row in this index activates a known guideline type for bootstrap, refresh, and parity behavior.
- If no starter template file exists for a listed guideline type, use the Stable Headings schema defined below.
- Update the relevant row whenever a guideline changes owner, scope, or review trigger.
- Cross-reference owning project docs such as `architecture.md` or `testing.md` when a guideline depends on them.

## 9. Guideline Stable Headings
New guideline files must include the standard numbered headings below to keep all rulebooks consistent. When documenting a guideline, both developers and AI agents are **NOT** limited to this baseline schema; they must actively append additional, custom domain-specific headings (for example, under Section 3 or as subheadings) to capture the unique technical standards, tooling, and constraints of the codebase.

1. **`## 1. Summary`**: A brief overview of what rules this guideline documents.
2. **`## 2. Scope`**: The explicit boundaries of what these rules cover (and don't cover).
3. **`## 3. Rules`**: The hard rules that must be followed.
4. **`## 4. Preferred Patterns`**: Examples or guidelines of the *best* way to do something.
5. **`## 5. Anti-Patterns`**: Examples of what *not* to do.
6. **`## 6. Related Docs`**: Links to active core project documents or other guidelines.
7. **`## 7. Open Questions`**: Any unresolved rules or edge cases.

## 10. Success Metrics
AI agents and developers can easily reference, follow, and validate cross-cutting code standard compliance during changes.

## 11. Related Documents
- [Master Project Registry](../index.md) - The active document catalog.

## 12. Open Questions
None.

<!-- === EHA GUIDELINES REGISTRY END === -->
   - **User declines** → skip creation; still record the surfaced candidates in the Output Contract.
   - **No candidates found** → skip silently (do not prompt).

   This mirrors `eha-bootstrap`'s "Technical Guidelines Interview" so behavior is consistent across both commands.
10. Identify impacted dependent docs.
11. Cross-reference codebase findings against doc/legacy claims — resolve conflicts by prompting the user (see rule 21).
12. Refresh/create the owning docs first (using combined codebase + docs evidence).
13. Refresh summary or index docs second.
14. Run a consistency pass.

## Ownership Examples

For each mapping below, also inspect the corresponding codebase artifacts (source files, configs, tests) to verify and enrich the documentation.

- stack or dependency changes → `foundation/architecture.md`, `development/testing.md`
- feature scope changes → `foundation/prd.md`, `foundation/status.md`
- detailed requirements or acceptance changes → `foundation/prd.md`, `foundation/status.md`
- workflow or roadmap changes → `foundation/status.md`, `foundation/phases/` index/phase files, workflow docs if present
- validation / CI changes → `development/testing.md`, `getting-started.md`
- production environment, rollout, rollback, or smoke-check changes → `operations/production-runbook.md`, `foundation/architecture.md`, `development/testing.md`
- API or integration changes → relevant API / integration docs plus `foundation/architecture.md`
- security or compliance changes → `operations/security-compliance.md`
- observability, logging, or error-handling changes → `operations/observability-error-handling.md`
- optional or conditional doc inventory changes → `docs/project-docs/index.md` plus the affected optional owner docs
- cross-cutting technical conventions or implementation rules → relevant `technical-guidelines/*.md`, `technical-guidelines/index.md`, and any summarizing core docs that reference them
- codebase-derived cross-cutting conventions (not only legacy-derived ones) surfaced during refresh → `docs/project-docs/technical-guidelines/*.md` via the Technical Guidelines Discovery & Interview step, registered in `technical-guidelines/index.md`
- documentation-system migration from legacy docs → active owner docs under `docs/project-docs/` first, with `docs-legacy/`, `docs-old/`, or other clearly named archive/reference folders used only as source material
- semantic legacy-name normalization → map legacy names by content, for example `epic` or `roadmap` material to `foundation/phases/` and `protocol` or `standard` material to `technical-guidelines/` when their governed concern matches those owners
- legacy technical-guidance promotion → `docs/project-docs/technical-guidelines/*.md`, `technical-guidelines/index.md`, and any summarizing core docs that now depend on those active guidelines
- legacy phased-planning promotion → `docs/project-docs/foundation/phases/`, `foundation/status.md`, and `docs/project-docs/index.md`

## Output Contract

Your result should state:

1. which docs were updated or created
2. why each doc was updated or created
3. which docs were intentionally left unchanged
4. any remaining consistency risks or open questions
5. which codebase-vs-doc conflicts were resolved and how (per user direction)
6. the auto-detected tier (for Legacy Only / Non-SDD states), if applicable
7. whether active development signals were detected, which signals were positive/negative, and whether the user was prompted about `foundation/phases/` setup (include the user's response: accepted, declined, or not yet answered)
8. **Technical Guidelines Discovery outcome:** any durable cross-cutting conventions surfaced (each with evidence), which the user approved for guideline creation, and which guideline files were created/registered (or "none surfaced / user declined").

## Final Pass

Before finishing, check that:

1. the updated docs still match the EHA Project Doc Rules above
2. platform instruction surfaces and skills would now read the correct project-specific truth
3. no stale summary remains in `foundation/status.md`, `docs/project-docs/index.md`, `technical-guidelines/index.md`, or other index docs
4. codebase-inferred facts are clearly marked and do not silently override user-confirmed truths
5. the auto-detected tier (for Legacy Only / Non-SDD states) is stated in the output so the user can override it if needed
6. if `foundation/phases/` did not exist at the start of this refresh and any active development signal was positive, confirm that the user was prompted about setting up phases — if this prompt was skipped, **stop and prompt the user now before finishing**
7. if the Technical Guidelines Discovery & Interview surfaced candidates, confirm the user was prompted and the outcome (created / declined / none) is reported in the Output Contract.

## Inputs

Use the change summary, affected artifacts, current project docs, legacy/reference docs, AND the current codebase (source code, configs, tests, CI/CD, package manifests) provided below.
