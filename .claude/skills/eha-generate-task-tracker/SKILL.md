---
description: "EHA skill — generate-task-tracker: Evidence-driven task tracker tables from git history (pushed/local commits, staged changes) optionally enriched with project docs. Every row traces to a commit, diff, or doc line. Use for standups, sprint reviews, or period work reports."
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

# Generate Task Tracker

Produces a **task tracker table** of work by reading the repository's **git state first** (pushed commits → local commits → staged changes → working tree) and, **optionally**, project tracking docs (changelog, status, phases) if they exist. Works on any git repo — with or without project docs. Output follows the repo's `task-tracker-template.md` table format. This skill is evidence-driven: every row must trace back to a commit, a diff, or a doc line — it never invents tasks.

## Inputs — Git First, Docs Optional

**Priority order (always available, always checked first):**

| Priority | Source | Evidence of |
| --- | --- | --- |
| 1 | Pushed commits (`git log <range>`) | Completed work → `Done` |
| 2 | Local unpushed commits (`git log <upstream>..HEAD`) | Completed work → `Done` (noted as unpushed) |
| 3 | Staged changes (`git diff --cached`) | Work in flight → `In Progress` |
| 4 | Unstaged working-tree changes (`git status`) | Work barely started → `In Progress` (only if user opts in) |

**Optional enrichment — read only if present:**

| Source | Why it matters |
| --- | --- |
| `docs/project-docs/foundation/changelog.md` | Released/unreleased milestones — cross-check + planned items. |
| `docs/project-docs/foundation/status.md` | `Recent Accomplishments` (done) and `Upcoming Focus` (`To Do`). |
| `docs/project-docs/foundation/phases/index.md` (+ phase docs) | Per-phase status matrix + its legend; backlog items. |
| `task-tracker-template.md` (repo root) | The canonical output table format. If absent, use the embedded format in Step 5. |

If none of the optional docs exist, the tracker is generated from git evidence alone — note "no project docs found; git-only" in the output Notes. Never fail because docs are missing.

## When to Use

- Generate a work report from git history for a standup / sprint review / weekly report.
- Include in-progress (staged/uncommitted) work alongside completed work.
- Produce a tracker mixing done / in-progress / planned work (planned rows need docs or user input).
- Reconstruct "what did I do in period X" for a given assignee.

## Non Goals

- Editing or updating changelog / status / phase docs (read-only inputs).
- Project management tool integration (Jira, GitLab issues, Trello).
- Time-tracking / effort estimation.
- Generating tasks that have no evidence (no commit, no diff, no doc line).

## Procedure

### Step 1 — Intake & Scope Definition

Ask the user briefly for the following if not provided. Do **not** begin evidence collection until these are answered or the user explicitly defers.

1. **Assignee name(s)** — the name(s) to write in the Assignee column.
   - Options: one name for all rows; per-source (git authors kept as-is, doc-derived rows use the user's name); or filter to a single git author.
   - See the **assignee disambiguation rule** in Step 1.5 — the agent may come back to this field with a suggestion.
2. **Language** for task titles — e.g. English or Indonesian.
   - Default rule: titles derived from **commit subjects stay verbatim**. The language choice applies to (a) titles synthesized from staged changes/doc bullets and (b) normalization **only if the user explicitly asks to rewrite commit titles**.
3. **Scope of work to include** — one or combine:
   - Date range (e.g. "this week", "since 15 August", "last 30 days")
   - Commit range / branch / tag range (e.g. `v1.2.0..HEAD`)
   - Per-assignee filter
4. **Uncommitted work** — include staged changes as `In Progress` rows? (default: **yes, offer it**). Include unstaged working-tree changes too? (default: no — noisy; opt-in).
5. **Project docs** — use them if present? (default: yes, as optional enrichment). Explicit "git only" skips them.
6. **Include planned work?** — `To Do` rows from docs (`Upcoming Focus`, phase backlog) or user dictation. Without docs, planned rows only exist if the user dictates them.
7. **Output path** — default: `docs/project-docs/foundation/phases/task-tracker-<DD-MM-YY>.md` **if that directory exists**, else repo root `task-tracker-<DD-MM-YY>.md`.
8. **Date & Time format** — default `DD-MM-YY HH:MM` (e.g. `15-08-26 14:30`), commit author date, local timezone. The `### Date:` header uses `DD-MM-YY`.

### Step 1.5 — Confirmation Checklist (unresolvable-from-evidence fields) — MANDATORY

Collect these before generating. They cannot be derived from git or docs:

1. **Assignee display** (Step 1 #1 — one value or rule for the whole file).
2. **Language** (Step 1 #2).
3. **Phase legend meaning** — only if a phase doc uses status symbols/letters **and does not define them in its own legend section**. Read the doc's legend first (e.g. `✅ / 🔶 / ❌` defined in `phases/index.md` → map directly, no question). If undefined, ask the user before mapping. Do not guess.

Rules:
- Values provided in the invocation (`assignee: John Doe`, `language: english`, `from 15 august`) are used — do not re-ask.
- Skipped fields stay `[TBD]` in the output; never invent.
- Generate nothing until resolved or explicitly deferred.

#### Assignee disambiguation rule (run after evidence collection starts, before generating)

After building the commit ledger, compare authors in range against the requested assignee:

- **Empty or near-empty match + other authors dominate** → STOP and confirm with the user:
  > "No commits by `[requested]` since `[start date]` — the range only contains work by `[other authors]`. Use: **a)** `[requested]` anyway (tracker will show doc/staged rows only), **b)** `[other author]`, **c)** both, or **d)** another name?"
- **Mixed authors** → state the split ("14 commits: 9 by X, 5 by Y") and ask whether to filter to the requested assignee or include all.
- Never silently swap, include, or drop an author — the mismatch is surfaced, the user decides.

### Step 2 — Collect Git Evidence

Run (adjust range/author to the intake answers):

```bash
# pushed + local commits (dedupe naturally: log shows both)
git log --no-merges <range> --pretty=format:'%h|%an|%ad|%s' --date=format:'%d-%m-%y %H:%M'

# which local commits are unpushed (vs upstream)
git log @{u}..HEAD --pretty=format:'%h|%an|%ad|%s' --date=format:'%d-%m-%y %H:%M' 2>/dev/null

# staged (in index, uncommitted)
git diff --cached --stat
git status --short   # staged = column 1 non-space

# unstaged working tree (opt-in only)
git diff --stat
```

- `--no-merges` skips merge commits — the real work is already listed as the merged commits. If the user wants merges included, drop the flag and render them as `Merge: <source> → <target>` rows.
- Record four ledgers: **commit ledger** (hash, author, date, subject, pushed?), **staged ledger** (file set, diff stat), **unstaged ledger** (opt-in), and mark which commits are unpushed.
- This is the evidence base Step 6 reconciles against.

### Step 3 — Collect Doc Evidence (optional — skip if absent or user said git-only)

Read (sections in priority order):

1. `foundation/changelog.md` — unreleased and latest tagged-release sections.
2. `foundation/status.md` — `Recent Accomplishments` and `Upcoming Focus`.
3. `foundation/phases/index.md` — status matrix + legend; per-item status.

For every bullet/entry: record source file, section, text, and status symbol. This is the **doc ledger**.

### Step 4 — Derive Tasks

#### Title derivation (commits)

| Commit subject shape | Tracker title |
| --- | --- |
| `fix(recompense): add exclude_uuid parameter handling` | `Add exclude_uuid parameter handling (recompense)` |
| `feat(masterdata): update FlagWNI field` | `Update FlagWNI field (masterdata)` |
| plain subject without conventional prefix | capitalize first letter, keep as-is |
| `Merge branch 'X' into 'Y'` | skipped (`--no-merges`) |
| duplicate subject (cherry-pick / re-merge) | keep one row; dedupe by normalized subject |

Rule: strip the `type:` prefix, capitalize the remainder, append ` (scope)` when the commit had one. Rewriting beyond this normalization only on explicit user request.

#### Title derivation (staged / unstaged changes — synthesized)

There is no commit message, so titles are **synthesized from the diff**: group the staged file set into logical units of work (e.g. "6 usecase files + 1 util" → one row `Add failure logging to recompense usecases`). These titles are **inferences, not verbatim evidence** — every synthesized title must be listed in the Notes section as `inferred from staged diff`, and the user may rename any of them at review.

#### Title derivation (docs)

Bullets become titles with minimal edits (strip markdown links/bold, keep original language unless the user asked for translation; translated rows get a `*` footnote "translated").

#### Status mapping

| Evidence | Tracker Status |
| --- | --- |
| Pushed commit in range | `Done` |
| Local unpushed commit in range | `Done` (Note: "unpushed") |
| Staged change (in index) | `In Progress` |
| Unstaged working-tree change (opt-in) | `In Progress` |
| changelog entry | `Done` |
| status.md `Recent Accomplishments` bullet | `Done` |
| status.md `Upcoming Focus` bullet | `To Do` |
| phase item per its own legend (e.g. `✅`/`🔶`/`❌`) | legend-defined → `Done`/`In Progress`/`To Do` |
| anything ambiguous | ask the user; never guess |

#### Dedup across sources

The same work often appears in git **and** docs, and staged work may overlap recent commits (partially committed). Keep **one** row per unit of work; prefer the higher-priority evidence (commit > staged > doc). If a staged file set partially matches a commit (work committed but more staged on top), keep both rows and note the relationship. Note all merge decisions in the output Notes.

### Step 5 — Output Generation

Produce output in the **template format** (source: `task-tracker-template.md`; embedded here as fallback):

```markdown
# Task Tracker

### Date: DD-MM-YY   ← generation date (today)

| Assignee | Title | Date & Time | Status |
| ---------- | ------- | ------------- | -------- |
| <assignee> | <title> | DD-MM-YY HH:MM | Done |
```

- One file per generation, named per the chosen output path.
- **Sorting:** `Done` rows first (newest → oldest by date), then `In Progress`, then `To Do`.
- Column order, header text, and the `### Date:` heading are fixed by the template — do not add, rename, or reorder columns. Extra context (source hash, notes) goes **beneath the table**, never inside it.
- Date & Time format: `DD-MM-YY HH:MM` unless the user chose another at intake. Staged/working rows (no commit date) use today's date. Doc-only rows with no date → `—`.
- Beneath the table, append two small sections:
  - `#### Sources` — one line per source used (`git log <range>`, `git diff --cached (staged)`, `status.md → Upcoming Focus`, `no project docs found; git-only`, ...).
  - `#### Notes` — dedup decisions, inferred (synthesized) titles, translations, legend interpretation, assignee disambiguation outcome, unpushed commits, `[TBD]` leftovers.

### Step 6 — Verify Coverage

Reconcile before finishing:

- Every commit in the ledger is either a row, a deduped duplicate (noted), or explicitly excluded (e.g. merge commit) — counts must add up.
- Every staged file is covered by an `In Progress` row (grouped is fine; silently missing is not).
- Every doc bullet read is either a row, matched-to-a-commit (noted), or out of scope (noted).
- No row exists without evidence; no evidence was silently dropped.
- Statuses are consistent (a commit present ⇒ not `To Do`; staged-only work ⇒ `In Progress`, not `Done`).

## Field Fill Strategy

| Field | Source | How to fill |
| --- | --- | --- |
| Assignee | intake (Step 1.5) + disambiguation rule | user-confirmed name/rule; default suggestion: git author name(s) in range |
| Title | commit subject (verbatim) / synthesized from staged diff / doc bullet | Step 4 rules; synthesized titles flagged in Notes |
| Date & Time | git `%ad` (author date); today for staged rows | `DD-MM-YY HH:MM` default; doc-only rows → `—` |
| Status | evidence type | Step 4 mapping table; ambiguous → ask |
| `### Date:` header | generation | today, `DD-MM-YY` |

## Quality Check

- Every row traces to a commit hash, a diff, or a doc file+section — keep the ledgers until finished.
- Commit-derived titles are verbatim (modulo the normalization rule); synthesized titles are flagged as inferred.
- Dedup across commits/staged/docs is explicit and noted, not silent.
- Table shape matches `task-tracker-template.md` exactly (4 columns, same headers, `### Date:` heading).
- `[TBD]` is left in place rather than guessed.
- Assignee mismatches are surfaced via the disambiguation rule, not hidden.
- Works with zero project docs (git-only mode) — absence of docs is a Note, never a failure.

## Output Contract

When using this skill, the output includes:

1. **intake answers** used (assignee, language, range, uncommitted inclusion, docs usage, output path).
2. **the tracker file** written to the chosen path, in template format.
3. **the evidence ledgers** — commit + staged + doc ledgers (summarized in the Notes section).
4. **reconciliation result** — commit count vs row count, staged coverage, dedup decisions, exclusions.

## Neutral Prompt Shape

`@agent use generate-task-tracker for [assignee] covering [date range / branch range] from [git only | git + docs], include staged as in-progress?`

## Example Prompt

- "Generate a task tracker for John Doe covering this week on develop, English titles, include my staged work as in progress."
- "Track my work since 15 August — git only, skip docs."
- "Make a tracker of everything since tag v1.2.0, all authors, include upcoming focus as To Do."
