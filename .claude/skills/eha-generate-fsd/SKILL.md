---
description: "EHA skill — generate-fsd: Functional Specification Documents (FSD) from PRDs, BPMN XML, code, user stories, or interview notes, with mandatory truth verification before writing. Use when a feature-level spec is needed from any source artifact."
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

# FSD Generator

Generates structured Functional Specification Documents (FSD) from any reference document — PRD, analysis docs, BPMN XML, user stories, codebases, interview notes, or research artifacts — and produces feature-level specifications with actors, functions, priorities, inputs, operations, and outputs.

This skill is **format-agnostic and self-contained**. It carries the FSD template structure internally — no external template file needed.

This skill enforces a **mandatory user confirmation step with truth verification** before finalizing any FSD. The draft must be reviewed and every factual claim must be confirmed by the user — the skill must not write the final document without explicit sign-off.

---

## Language

This skill file is written in **English**. However, the generated FSD output language is chosen by the user.

**When to ask:**
- During Step 1 (gather input), if the user has not already specified a language, ask:
  *"Which language should the FSD be written in? Bahasa Indonesia or English (both preferred). Other languages are not recommended."*

**Language preference rules:**

| Language | Recommendation | Behavior |
| --- | --- | --- |
| **Bahasa Indonesia** | Preferred | Use the field labels: `Aktor`, `Pengguna`, `Otoritas`, `Deskripsi`, `Priority` (HIGH/MEDIUM/LOW), `Purpose`, `Input`, `Operations`, `Output`. Feature block title: `# 1.1 Feature: Feature Name (ILK)`. See the `contoh` below for the full Indonesian variant. |
| **English** | Preferred | Use the field labels: `Actor`, `User`, `Authority`, `Description`, `Priority` (HIGH/MEDIUM/LOW), `Purpose`, `Input`, `Operations`, `Output`. Feature block title: `# 1.1 Feature: Feature Name (ILK)`. The structure stays the same, only field labels and content change. |
| **Other languages** | Not recommended | Warn the user that the skill's template and examples are calibrated for Bahasa Indonesia and English — inconsistencies may arise. If the user insists, proceed with a note in the output. |

**If the user already stated a language** in the prompt (e.g., "generate an FSD in English from @file"), don't ask again — use that language.

**The skill must not assume a default language.** If no language is specified and the user skips the question, default to the source document's language. If that's also ambiguous, ask again before generating.

---

## FSD Template Structure

Every FSD follows this exact structure. The skill must not deviate from these fields.

The canonical field labels are **English**. For Bahasa Indonesia output, translate field labels as shown in the Language section above. The `contoh` below shows the Indonesian variant.

### Feature Block

```
# 1.1 Feature: Feature Name (ILK)

| **Actor** | Actor name |
| --- | --- |
| **User** | User name |
| **Authority** | Authority name |
| **Description** | Short description |

Give detailed description of this feature.
```

- One feature block per distinct feature
- Numbering: `1.1`, `1.2`, `1.3`, etc.

### Function Block

```
## 1. Function Name

| **Title** | Add The Function Name |
| --- | --- |
| **Priority** | HIGH/MEDIUM/LOW |
| **Purpose** | Add the purpose of this function |
| **Input** | Add the input needed in this function |
| **Operations** | Add the operations or the user's flows needed for this function |
| **Output** | Add the output of this function |
```

- One function block per distinct function within a feature
- Six required fields: `Title`, `Priority`, `Purpose`, `Input`, `Operations`, `Output`
- `Priority` must be one of: HIGH, MEDIUM, LOW
- `Operations` must be numbered steps (1. ..., 2. ..., 3. ...)
- Numbering within a feature: `1.`, `2.`, `3.`, etc.

### Contoh (Example — Bahasa Indonesia)

```
## 1.1 Feature: Masterdata (ILK)

| **Aktor** | Sistem / Aplikasi |
| --- | --- |
| **Pengguna** | Admin |
| **Otoritas** | UII/100 |
| **Deskripsi** | Fitur untuk admin melihat masterdata yang sudah diatur di awal |

### 1. Menampilkan data kelompok komponen

| **Title** | Menampilkan Data Kelompok Komponen |
| --- | --- |
| **Priority** | HIGH |
| **Purpose** | untuk menampilkan data komponen aktif tidak aktif |
| **Input** | User klik sub menu kelompok komponen di menu masterdata setting |
| **Operations** | 1. secara otomatis menampilkan data komponen 2. data ditampilkan di table |
| **Output** | Tabel berisi: nomor, nama komponen, button aksi ON / OFF |
```

Use this `contoh` to calibrate:
- **This is the Bahasa Indonesia variant.** For English output, translate field labels and content but keep the same structure.
- **Tone:** Direct, instructional, concrete
- **Detail level:** One clear sentence per field, numbered steps in Operations

---

## Supported Input Formats

| Format | Detection | Extraction approach |
| --- | --- | --- |
| **BPMN XML** (`.bpmn`, `.xml` with `bpmn:definitions`) | Root element `<bpmn:definitions>` | Parse processes, lanes, tasks, gateways, sequence flows, events. See BPMN mapping table below. |
| **PRD / Spec doc** (`.md`) | Headers like "Requirements", "User Stories", "Persona" | Extract actors, features, functions, flows from structured sections. |
| **Analysis doc** (`.md`) | Free-form with findings, flows, or requirements | Extract features and functions from narrative descriptions. |
| **Code / Domain** (`.go`, folder) | Go source, DDD layers | Extract usecase interfaces, HTTP routes, repository methods. Map functions to FSD blocks. |
| **User stories** (any text) | "As a … I want … so that …" pattern | Each story → one function block. Role → actor. |
| **Interview notes** (`.md`) | Free-form with Q&A or bullet points | Group related points into features, extract flows into operations. |

### BPMN XML Mapping

| BPMN element | Maps to FSD field |
| --- | --- |
| `<bpmn:process>` name | Feature Name (one feature block per process) |
| `<bpmn:lane>` / `<bpmn:pool>` name | Actor / User |
| `<bpmn:task>` / `<bpmn:userTask>` / `<bpmn:serviceTask>` name | Title (one function block per task) |
| `<bpmn:sequenceFlow>` order | Operations (numbered steps) |
| `<bpmn:task>` / `<bpmn:userTask>` name + context | Purpose |
| `<bpmn:startEvent>` trigger (message/timer/signal) | Input |
| `<bpmn:endEvent>` name or final task output | Output |
| `<bpmn:exclusiveGateway>` / `<bpmn:parallelGateway>` | Branching logic inside Operations |
| `<bpmn:documentation>` on any element | Additional detail for Purpose / Operations |
| `<bpmn:dataObject>` / `<bpmn:messageEvent>` | Input / Output detail |

If the BPMN lacks lanes, actors, or documentation, mark those fields as `[TBD]` or `[Inferred]` — don't invent them.

---

## When to Use

| Trigger | Example request |
| --- | --- |
| PRD → FSD | "Generate an FSD from `prd.md`" |
| BPMN → FSD | "Turn this BPMN into an FSD" / "Generate FSD from `workflow.bpmn`" |
| Code → FSD | "Create an FSD from `domain/payment/`" |
| Multi-source → FSD | "Use `prd.md` and `analisis.md` to generate an FSD" |
| User stories → FSD | "Format these user stories into the FSD template" |
| Interview notes → FSD | "Take `wawancara.md` and produce an FSD" |

Do not use this skill for:

- Editing or patching an already-approved FSD — use a direct edit instead
- Writing code, tests, or implementation from the FSD — that falls under the SDD workflow
- Generating non-FSD documentation (PRD, architecture, runbooks) — those have their own owning docs

---

## Procedure

### Step 0 — Detect input format

Classify the user's referenced file(s) by extension and content:

- `.bpmn` / `.xml` with `<bpmn:definitions>` → BPMN mode
- `.md` with PRD-like headers or user stories → Document mode
- `.go` source or a folder path → Code/Domain mode
- Mixed formats → Multi-source mode (process each independently, then merge)

This step is internal — don't ask the user about format unless the file extension is ambiguous (e.g., `.xml` without BPMN namespace).

### Step 1 — Gather input documents

**If the user already referenced files in the prompt** (e.g., `/eha-generate-fsd from @file1 @file2` or `from @folder/`):

- Read those files directly. Do not ask "which documents?" — the user already told you.
- If a referenced path is a folder, recursively explore it and read all relevant files.
- If a referenced path doesn't exist, report it and ask for the correct path.

**If the user invoked the skill with no references** (bare `/eha-generate-fsd` or "generate an FSD"):

- Ask: *"Which document(s) should I use as the source for this FSD? You can point me to PRDs, analysis docs, BPMN files, code folders, user stories, or interview notes."*
- Wait for the user's response before proceeding.
- Do not guess or search for files on your own.

**If the user says "all" or "everything"** — ask them to narrow down to specific files. An FSD needs a clear scope.

**Language:** If the user has not specified a language (Bahasa Indonesia or English) in the prompt, ask now: *"Which language should the FSD be written in? Bahasa Indonesia or English (both preferred). Other languages are not recommended."* See the Language section above for rules.

### Step 2 — Extract and map

Read every referenced file. Based on the detected format, extract:

- Actors, users, and authorities (from PRD personas, BPMN lanes, code middleware, user story roles)
- Feature names and their descriptions (from PRD sections, BPMN process names, domain package names)
- Individual functions, flows, and operations (from user stories, BPMN tasks, usecase methods, analysis narratives)
- Inputs and outputs (from API contracts, BPMN events/data objects, PRD acceptance criteria)
- Priority levels (from PRD MoSCoW tags, task metadata, or context clues like "critical"/"wajib")

**Merging strategy for multi-source input:**

1. One feature block per distinct feature discovered across all sources
2. De-duplicate overlapping functions (same name/purpose across sources → merge into one, enriching from both)
3. If sources disagree on a fact (different actors, different flows), flag as `[TBD: conflict between source A and source B]`
4. Include a source-trace column in the assumptions table for multi-source runs

### Step 3 — Generate the FSD draft

Produce a complete draft following the FSD Template Structure (embedded above):

1. **Feature header block** — fill the actor table fields and add a detailed description paragraph below the table.
2. **Function blocks** — one numbered block per function. Each block must include all six fields:
   - `Title` — short, descriptive function name
   - `Priority` — HIGH, MEDIUM, or LOW
   - `Purpose` — why this function exists, in one clear sentence
   - `Input` — what the user or system provides to trigger this function
   - `Operations` — numbered step-by-step flow
   - `Output` — what the user or system sees after the function completes

Apply these rules during generation:

- Use the language chosen by the user (Bahasa Indonesia or English). Match the tone of the `contoh` — direct, instructional, concrete — in whichever language is selected.
- For English: use the canonical English field labels (`Actor`, `User`, `Authority`, `Description`, `Priority`, `Purpose`, `Input`, `Operations`, `Output`). Feature block title: `# 1.1 Feature: Feature Name (ILK)`.
- For Bahasa Indonesia: translate field labels to `Aktor`, `Pengguna`, `Otoritas`, `Deskripsi`, `Priority`, `Purpose`, `Input`, `Operations`, `Output`. Feature block title: `# 1.1 Feature: Feature Name (ILK)`.
- Prefer concrete, testable descriptions over vague ones
- Flag ambiguities with `[TBD: ...]` markers rather than guessing
- Mark fields inferred from context with `[Inferred: reason]` so the user can spot assumptions
- Keep priorities consistent with any explicit signals in the source
- For BPMN input: auto-detect priority from task metadata or markers; default to MEDIUM if none
- For code input: prioritize CRUD-critical paths as HIGH, read-only lookups as MEDIUM

### Step 4 — Present draft with truth verification (MANDATORY)

**This step must not be skipped under any circumstance.**

Present the complete FSD draft to the user. Then, ask the user to verify the truth of every factual claim. Use this checklist:

1. **Summary:** what was generated (N features, M functions, sources used)
2. **Full draft** — all feature and function blocks, clearly separated
3. **Assumptions table** — every `[Inferred]` and `[TBD]` marker listed explicitly

Then ask the user these truth-verification questions point-by-point:

- *"Are the actors (`Actor`) correct? Who actually performs these actions?"*
- *"Are the authorities (`Authority`) correct? What permissions/roles are needed?"*
- *"Is each function's purpose (`Purpose`) accurate to what really happens?"*
- *"Are the operations/steps (`Operations`) in the correct order and complete?"*
- *"Are the inputs (`Input`) and outputs (`Output`) accurate?"*
- *"Are any functions missing from the source that I should add?"*
- *"Are any functions invented that don't actually exist in the source?"*
- *"For the `[Inferred]` items — are these inferences correct, or should they be changed?"*
- *"For the `[TBD]` items — can you provide the missing information?"*

Wait for the user to answer each question. If the user confirms all items, proceed to Step 5. If the user corrects any item:

- Apply the corrections and re-present only the changed sections
- Re-ask the affected truth-verification questions
- Do not proceed to Step 5 until the user confirms everything

### Step 5 — Re-verify and finalize

Once the user confirms all truth-verification questions:

1. **Cross-check** every field in the draft against its source. Confirm nothing was dropped or altered.
2. **Verify numbering** — features and functions must be sequentially numbered without gaps.
3. **Check completeness** — every function mentioned in the source must have a corresponding block; every required field must be filled (or marked `[TBD]`).
4. **Resolve user corrections** — ensure all user-provided corrections from Step 4 are applied.
5. **Write the final FSD file** to the location the user specifies. If no location is given, default to `docs/project-docs/foundation/fsd-<feature-slug>.md`.
6. Report: file path written, feature count, function count, unresolved `[TBD]` items, and source files consulted.

---

## Quality Check

- No function block without all six fields (`Title`, `Priority`, `Purpose`, `Input`, `Operations`, `Output`)
- No feature without an actor table and description paragraph
- No content invented beyond what the source documents support — mark inferences explicitly
- No skipped truth verification — refuse to finalize without user confirming each factual claim
- No silent field omissions — if the source does not provide a value, use `[TBD]`, not a blank
- No priority assigned without a traceable justification from the source

## Anti-Pattern

- Writing the final FSD file before the user confirms the truth of every claim
- Asking "does this look okay?" instead of the point-by-point truth verification checklist
- Inventing actors, functions, or flows not present in the source
- Collapsing multiple distinct functions into one block to save effort
- Generating in a language the user didn't choose — always ask if not specified; never assume
- Changing the template structure (adding/removing fields) without asking the user
- Skipping the re-verification cross-check in Step 5
- Treating the truth verification as optional or skippable for "simple" FSDs
- Prompting "which documents?" when the user already provided them in the invocation

## Output Contract

When using this skill, the output should include:

1. the source file(s) consulted (with format detected for each)
2. a summary of extracted features and functions
3. the complete FSD draft (presented for truth verification, not yet written to disk)
4. an explicit list of assumptions, inferences, and `[TBD]` markers
5. the user's truth-verification responses (confirmed / corrected per item)
6. after approval: the final file path, feature count, function count, and unresolved `[TBD]` items
7. any source content that was deliberately excluded with a brief reason

## Neutral Prompt Shape

`/eha-generate-fsd from @source-file` — with reference, executes immediately (still confirms before writing).  
`/eha-generate-fsd` — bare, asks which documents to use.

## Example Prompt

- `/eha-generate-fsd from @prd.md` — reads PRD, generates FSD, truth-verifies, confirms
- `/eha-generate-fsd from @workflow.bpmn` — parses BPMN, maps to FSD, truth-verifies, confirms
- `/eha-generate-fsd from @domain/payment/` — reads code, extracts usecase, truth-verifies, confirms
- `/eha-generate-fsd from @prd.md @analisis-teknis.md` — merges two sources, truth-verifies, confirms
- `/eha-generate-fsd` — asks "which documents?", then proceeds
