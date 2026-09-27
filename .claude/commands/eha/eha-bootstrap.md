---
description: "EHA bootstrap — Generate the initial project documentation set"
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

# Project Docs Bootstrap Reusable Prompt

Generate the **initial project documentation set** for a repository.
You must dynamically adjust your behavior based on the current state of the repository.

## Step 0: Pre-Flight Check

Before analyzing complexity, scan the repository for existing documentation:

1. Check for `docs/project-docs/` with any content.
2. Check for `docs-legacy/`, `docs-old/`, `archive/`, or `reference/` folders with content.
3. Check for any `docs/` folder containing structured markdown beyond a bare root README.

**If ANY of the above exist:**
STOP. Do not proceed with bootstrap. Inform the user:

"I found existing documentation in this repository:

- [list what was found]

Bootstrap is for repos with no documentation. For repos with existing docs (even legacy or non-SDD format), use the **Refresh** workflow instead — it can migrate, update, and create SDD docs from your existing content combined with codebase analysis.

Should I switch to the Refresh workflow?"

**If NONE exist (only code and/or a bare root README):** Proceed to Step 0.5.

## Step 0.5: Greenfield Detection

After passing the Pre-Flight Check, classify the repository:

**Greenfield (Empty/Near-Empty Repo):**
If the repository has no meaningful source files (only a bare `package.json`, `.gitignore`, or scaffolding from a project generator with no custom code), this is a greenfield project.

STOP. Inform the user:

"This repository appears to be a new/greenfield project with no meaningful codebase yet.

Bootstrap works best when there's code to analyze for complexity detection.
For a brand-new project, I recommend running `/eha-discuss` first to:

- Define your project vision, tech stack, and architecture
- Plan your development phases
- Draft initial specs

After that, come back to Bootstrap with the discuss output to generate your docs.

Alternatively, if you already know your project's scope, tell me about it and I'll bootstrap directly."

**If the user provides project context directly:** Proceed to Step 1 using the user's description instead of codebase analysis for complexity detection.

**Brownfield with code (normal case):** Proceed to Step 1.

## Step 1: Complexity Detection (The Adaptive Taxonomy)

Analyze the workspace to determine its complexity by inspecting the codebase.

Based on the repository's complexity, you MUST recommend one of the following **Taxonomy Tiers**:

1. **Tier 1: Lite Profile**
   - *Target:* Small scripts, micro-libraries, single-component repos.
   - *Files Generated:* `index.md`, `getting-started.md`, `foundation/prd.md`, `foundation/architecture.md`, `foundation/status.md`.
2. **Tier 2: Standard Profile**
   - *Target:* Typical web applications, APIs, standard services.
   - *Files Generated:* Everything in Tier 1 PLUS `development/testing.md`, `development/database.md`, `development/ui-ux.md`, `development/api-contract.md`, `operations/ci-cd.md`.
3. **Tier 3: Enterprise Profile**
   - *Target:* Large-scale platforms, regulated systems, monorepos.
   - *Files Generated:* Everything in Tier 2 PLUS `operations/governance.md`, `operations/security-compliance.md` (merged), `operations/observability-error-handling.md` (merged), `operations/production-runbook.md`, `development/internationalization.md`, `technical-guidelines/index.md` (empty registry — individual guidelines generated on-demand only when durable cross-cutting rules are identified).

*Note: `foundation/phases/` (phases folder) and `foundation/changelog.md` (changelog) are offered independently via Step 2.5, not tied to any tier.*

**STOP AND ASK:** Present your analysis of the repo's complexity and ask the user: *"Which Taxonomy Tier should I generate?"* Do not proceed until the user approves a tier.

## Step 2: Document Generation

Once the user approves a tier, strictly follow the 4-layer file structure (`foundation/`, `operations/`, `development/`, `technical-guidelines/`).

### Required Behavior

1. **Dynamic Generation from Registry:** Use the master registry embedded below to obtain the universal stable headings schema and the unique domain-specific headings for each document type within the approved tier. Generate each document dynamically using this structural mapping.


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
2. Create project-specific truth in `docs/project-docs/`, not in the reusable prompt output itself.
3. Do not invent details. Mark uncertain facts as `TBD` or `Assumption`.
4. If reverse-engineering from code, explicitly state "Inferred from codebase" in the generated document until the user confirms it.
5. **DO NOT generate files outside the approved tier unless explicitly chosen during the Step 2.5 conditional interview.**

## Step 2.5: Active Development, Phases, & Changelog Interview

After generating the tier-selected documents, assess whether the project needs phase-based planning or changelog tracking:

### For Greenfield Projects

The project is obviously in active development. Ask the user:
"This is a new project. Would you like to set up development phases?
If yes, describe the phases you envision from start to launch.
Example: Phase 1: Research, Phase 2: API Development, Phase 3: UI/UX, Phase 4: Launch."

If the user provides phases:

- Create `foundation/phases/index.md` with the phase registry.
- Create individual phase files using greenfield naming: `phase-{N}[-description].md` (e.g., `phase-1-research.md`, `phase-2-api.md`).
- Populate each with the user's described scope and `TBD` for details not yet known.

If the user declines: Skip phases entirely.

Additionally, ask the user:
"Would you like to set up a changelog (`foundation/changelog.md`) to track historical releases?"
If yes, generate a boilerplate `foundation/changelog.md` with an initial unreleased section.

### For Brownfield Projects (with existing code)

You **MUST** check all four active development signals. Do NOT skip this step:

1. **Recent commits** — run `git log --oneline -20` or equivalent; if there are commits within the last 14 days, OR 10+ commits within the last 30 days, this signal is positive.
2. **Sprint/feature branches** — run `git branch -a` and look for naming patterns like `sprint/`, `phase/`, `release/`, `feature/`, `feat/`, `dev/`.
3. **Planning artifacts** — check for `TODO.md`, `ROADMAP.md`, `.github/ISSUE_TEMPLATE/`, issue tracker references in recent commits (e.g., `#123`, `fixes #`, `closes #`), or project board configs.
4. **TODO density** — grep the codebase for `TODO`, `FIXME`, `HACK` comments; if count ≥ 5, this signal is positive.

If **any one** signal is positive, you **MUST** ask the user:
"This project shows active development signals ([list which signals were positive and what was found]).
Would you like to set up `foundation/phases/` to track your development cycles?
If yes, describe the current and upcoming phases (or I can infer from your codebase)."

If the user provides phases:

- Create `foundation/phases/index.md` with the phase registry.
- Create individual phase files using brownfield naming: `phase-P{N}[-description].md` (e.g., `phase-P1-refactor.md`, `phase-P2-auth.md`).

If the user declines: Skip phases entirely.
If all four signals are negative: Skip the phases prompt but note in your output that all four active development signals were negative and no phases were offered.

Additionally, check for release signals (e.g., git tags, version updates in `package.json`, release branches). If found, ask the user:
"Would you like to set up a changelog (`foundation/changelog.md`) to track historical releases?"
If yes, generate `foundation/changelog.md` populated with current version information.

### Technical Guidelines Interview (All Tiers)

After the phases and changelog prompts, scan the codebase for cross-cutting implementation patterns that may warrant formal technical guidelines:

1. Inspect source code, configs, and tests for recurring conventions such as: API response shapes, error handling patterns, logging conventions, naming schemes, database access patterns, authentication/authorization patterns, or other domain-specific coding rules.
2. If recurring patterns are found, ask the user:
   "I've identified the following cross-cutting patterns in your codebase:
   - [list each pattern with a brief description, e.g., "All API responses follow a standard envelope shape { status, data, errors }"]
   Would you like me to generate `technical-guidelines/` documents for any of these?"
   - If the user selects patterns → generate specific guideline files (using the Guideline Stable Headings baseline embedded below) and register them in `technical-guidelines/index.md`. Each guideline must contain actual rules inferred from the codebase — never generate placeholder stubs.


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
   - If the user declines → skip. For Tier 3, the empty `technical-guidelines/index.md` registry is still generated as part of the tier's file set.
3. If no recurring patterns are found → skip the prompt entirely. For Tier 3, the empty `technical-guidelines/index.md` registry is still generated.

## Final Pass

Before finishing, check that:

1. No files are generated in the root of `project-docs/` except `index.md` and `getting-started.md`. Everything else must be in its respective subfolder.
2. `foundation/architecture.md` and `development/testing.md` do not conflict.
3. The generated documents strictly match the approved Taxonomy Tier, conditional choices, and structural definitions cataloged in the master registry.
4. If phases were generated, verify `foundation/phases/index.md` correctly registry-links to all individual phase files (`phase-*.md`), and each phase file has complete stable headings.
5. For brownfield projects: if any active development signal was positive during Step 2.5, confirm that the user was prompted about setting up phases. If this prompt was skipped, **stop and prompt the user now before finishing**.
6. If `technical-guidelines/` files were generated, verify they contain actual cross-cutting rules inferred from the codebase (not placeholder stubs). Verify `technical-guidelines/index.md` accurately registers all generated guideline files.

## Inputs

Use the project brief, codebase, and constraints provided below to begin your analysis.
