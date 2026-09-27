---
description: "EHA execute-phase — Execute a specific project phase from docs/project-docs/foundation/phases/"
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

# Phase Execute

Execute a specific project phase from `docs/project-docs/foundation/phases/` by checking its readiness, interactive specs enrichment, presenting a task menu, driving execution using Spec-Driven Development, and updating the sprint tracker.

## Goal

Read a specific project phase document, verify that it contains enough implementation specs (or enrich it through collaboration), let the user select tasks to run, implement the selected tasks with test-driven development, and keep the phases tracking documents up-to-date.

## Required Behavior

### 1. Phase File Resolution

1. **Locate the Phase Registry:** Read `docs/project-docs/foundation/phases/index.md` first. If `docs/project-docs/foundation/phases/` or the registry file does not exist, notify the user that they must run `/eha-bootstrap` or `/eha-refresh` first, then stop.
2. **Parse Phase Identifier:** Extract the target phase identifier from the user's prompt. Standardize inputs by stripping command prefixes (like `/eha-execute-phase`, `/execute-phase`, `/eha-execute-phase-`, or `/execute-phase-`), whitespace, hyphens, and the word "phase". For example:
   - `/eha-execute-phase 1` or `/eha-execute-phase-1` or `1` → `1` (Greenfield)
   - `/eha-execute-phase P1` or `/eha-execute-phase-P1` or `P1` → `P1` (Brownfield)
3. **Resolve Phase Filename:** Fuzzy match the extracted identifier to the phase files in the registry and the directory:
   - Greenfield naming rule: `phase-{N}[-description].md` (e.g., `phase-1.md` or `phase-1-greenfield.md` for `1`).
   - Brownfield naming rule: `phase-P{N}[-description].md` (e.g., `phase-P1.md` or `phase-P1-refactor.md` for `P1`).
4. **Load the Phase:** Read the resolved phase file. If no matching file is found, report the error and ask the user to clarify the identifier.

### 2. Readiness Check & Enrichment Gate (Hybrid Option C)

1. **Check Execution Readiness:** Evaluate whether the loaded phase file is rich enough to be implemented without hallucinating specifications. A phase is **Execution-Ready** if and only if:
   - **Feature Summary & Core Functions** contains at least 2 concrete features/functions (not marked as TBD, Placeholder, or empty).
   - **Sub-Functions / Tasks** contains at least 3 concrete tasks (not marked as TBD or placeholder).
   - **Acceptance Criteria** contains at least 2 testable criteria (not TBD or placeholder).
2. **If NOT Ready (Enrichment Mode):**
   - Do not write implementation code yet.
   - Initiate a focused specification enrichment session (discuss-style interview) in chat. Help the user flesh out the missing features, tasks, and testable criteria.
   - Compile the firmed-up specifications into a clean markdown structure matching the standard phase template.
   - **Present-then-write:** Present the proposed enriched content to the user for approval. Do not modify the file until the user explicitly approves.
   - Upon user approval, write the enriched content back to the phase file (filling in the Feature Summary, Tasks, Acceptance Criteria, and initializing the `Sprint Tracker` table with all tasks marked as `Not Started`), then proceed.
3. **If Ready (Execution Mode):**
   - Proceed directly to Task Selection.

### 3. Task Selection Menu

1. **Present Menu:** Read the `Sub-Functions / Tasks` list from the phase file. Present these tasks to the user as a numbered menu in the chat window.
2. **Solicit Input:** Ask the user to select which task(s) they want to implement in this session (e.g., "1", "1 and 2", or "all").

### 4. Spec-Driven Task Execution

For each selected task:
1. **Mark In Progress:** Update the task's status in the `Sprint Tracker` table of the phase file to `In Progress`. Present the file edit to the user for approval first, then write it back to the file.
2. **Read Authority Docs:** Read `docs/project-docs/foundation/prd.md` and `docs/project-docs/foundation/architecture.md`.
3. **Read Technical Guidelines:** If `docs/project-docs/technical-guidelines/index.md` exists, read it and all active guideline files listed in its registry to ensure implementation compliance.
4. **Generate Tests (TDD):** Author complete test cases validating the acceptance criteria for this task.
5. **Generate Code:** Write the implementation code required to pass the tests. Do not use placeholders.
6. **Verify and Validate:** Ensure the code passes all tests and complies with the architecture and active technical guidelines.
7. **Mark Complete:** Update the task's status in the `Sprint Tracker` table of the phase file to `Complete`. Present the file edit to the user for approval first, then write it back to the file.

### 5. Overall Phase & Status Synchronization

If all tasks in the phase are completed:
1. **Update Phase Status:** Update the overall phase `Status` section in the phase file to `Complete` (and to `In Progress` if it was `Not Started` and tasks are still remaining).
2. **Update Phase Registry:** Update the phase's status to `Complete` (or `In Progress`) in the registry table in `docs/project-docs/foundation/phases/index.md`.
3. **Update Status Doc:** Update `docs/project-docs/foundation/status.md` to reflect the completed phase, update the epics/roadmap tracking, and list the phase completion as a recent accomplishment.
4. **Update Changelog:** Add a changelog entry in `docs/project-docs/foundation/changelog.md` summarizing the completed tasks of this phase.
5. **Approval Rule:** All file edits (to phase files, index, status, and changelog) must be presented to the user for approval before writing them (present-then-write).

## Output Contract

### Phase Summary & Gate Report
- Matched Phase File: [filename](file:///absolute/path/to/phase/file)
- Readiness Status: (Ready / Needs Enrichment)
- Gate Details: (Checklist of counts for features, tasks, and criteria)

### Task Menu
- (If in Execution Mode) Numbered menu of tasks to select.
- (If in Enrichment Mode) Draft of enriched spec sections for approval.

### Execution Output (per task)
- Task ID & Name
- Spec Mapping (lines/sections in project docs)
- Tests Authored
- Code Authored
- Validation Summary

### Progress Sync Write-Backs
- Diffs or file edits to be made to the phase file, phases index, status, and changelog.

## Inputs

- User's phase identifier (e.g., `/eha-execute-phase 1`, `/eha-execute-phase-P1`, etc.)
- `docs/project-docs/foundation/phases/index.md`
- `docs/project-docs/foundation/phases/phase-*.md`
- `docs/project-docs/foundation/prd.md`
- `docs/project-docs/foundation/architecture.md`
- `docs/project-docs/development/testing.md`
- `docs/project-docs/technical-guidelines/index.md` (conditional)
