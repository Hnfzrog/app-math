---
description: "EHA skill — build-logging: Project-aware application logging for any language: pipe-delimited |TAG|VERB|key=val format, factual step-by-step trace of each function, one-exit failure logging, layered PII masking. Use when adding or reviewing log statements in service code."
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

# Logging

Produces a **project-aware, logging-only** implementation for any service codebase.
The language and log library are determined by the project's docs and existing code — never assumed.
Scoped strictly to application logging — **metrics, tracing, and alerting are
out of scope** (separate skills `eha-build-metrics` / `eha-build-tracing` if/when needed).

> **Renamed** from `eha-build-observability` (2026-08-11). The old name implied the
> full SRE trio (logs + metrics + traces); this skill is logs only.

## Required Project Inputs

| Document | Why |
|---|---|
| `docs/project-docs/operations/observability-error-handling.md` (or equivalent) | Confirms the approved log library + existing log conventions. |
| `docs/project-docs/operations/security-compliance.md` | PII inventory — what MUST be masked/dropped. |

If the repo lacks these, surface the gap. **Do NOT invent a log format.** Ask the
user which language and log library the project uses and what the existing log
style is **before** writing any log statement. Never assume the language —
confirm it from the code and the docs.

## Read the Code First — Logs Must Be Factual (mandatory)

Before writing any log statement, **trace the target function's actual process
flow end-to-end** — every sub-fetch, every branch, every guard, every external
call. A single business function often chains many steps (fetch all records →
pick one → resolve a detail → POST to service A → fetch from service B → …).
Each of those steps is a loggable event; none may be invented.

Rules:

- **Every log line must describe something the code actually does.** TAG from
  the real operation, VERB from the real step, key=val from the real values in
  scope at that point.
- **Map steps to verbs while reading:** entry → `start` (writes) / `access`
  (reads); each sub-fetch → `fetch`; each external or risky call → `try`; each
  quiet drop → `skip`; success exit → `done`; error exit → `fail`.
- **No speculative logs.** If a step has not been verified in the code, do not
  log it. If the flow is unclear (dynamic dispatch, deep call chains), read
  deeper or ask — never guess.
- **Context keys must be real values in scope** (user, uuid, count, status) —
  not imagined fields.
- The depth target (3–6 logs per non-trivial function, see Verb Taxonomy) comes
  from the *actual* richness of the flow: a function with five real steps gets
  more logs than a simple getter — but a simple getter never gets invented steps.

## When to Use

- Adding logging to a domain, endpoint, or business process.
- Reviewing code to ensure PII is masked before logging.
- Standardizing log format across a function or layer.

**NOT for:** metrics, distributed tracing, alerting rules, dashboards, or log-pipeline
infrastructure (those are separate concerns).

## Non Goals

- Structured/JSON logging migration (only if the project already uses it).
- Request correlation IDs / distributed tracing (separate skill).
- Log aggregation pipeline setup (Fluentd/Fluent Bit/Logstash/Loki/ELK).
- Metrics counters, histograms, gauges.

## Log Format (prescribed — not a suggestion)

Pipe-delimited, one logical event per line. Designed for easy `grep`:

```
|<TAG>|<VERB>|<key>=<val>|<key>=<val>|...
```

- **TAG** — `UPPER_SNAKE` operation id, derived from the function/resource (not the file).
  Examples: `STORE_UM`, `GET_HB_INDEX`, `POST_TO_CORE`, `CALLBACK_GB_TO_SB`.
- **VERB** — lifecycle verb (see Taxonomy below).
- **key=val** — context pairs. **Scalar values only** (user, uuid, count, status).
  Never log raw structs, objects, or maps.

Concrete rendering — the *format* is what's prescribed, not the syntax:

```
|GET_UM_INDEX|access|user=jdoe|unit=HQ-12
|STORE_UM|start|user=jdoe|komponen=3
|STORE_UM|done|user=jdoe|komponen=3
```

> **History:** this convention's verbs are English (`start`/`done`/`fail`/`access`).
> If the target codebase already logs with equivalent non-English verbs, follow
> the existing convention — do not rewrite working logs for translation's sake.

## Verb Taxonomy

Two layers: **function-boundary** verbs (every function) and **internal-step**
verbs (at meaningful points inside a function).

### Function-boundary verbs — apply to EVERY business function

| Verb | When | Notes |
|---|---|---|
| `start` | first line of a WRITE function | entry log |
| `access` | first line of a READ/GET function | read-side counterpart of `start` |
| `done` | just before a successful return | success exit |
| `fail` | on ANY error return/throw | use the language's one-exit failure-log idiom (see Mechanism) |

### Internal-step verbs — at important points inside a function

| Verb | When | Example |
|---|---|---|
| `fetch` | "getting this" — a DB/repository sub-fetch | `\|STORE_UM\|fetch\|masterdata_pegawai` |
| `try` | "trying this" — a risky/external call (HTTP, fallback) | `\|POST_TO_CORE\|try\|httppost\|url=...` |
| `skip` | "skipping this" — dedup/guard quietly drops items | `\|STORE_UM\|skip\|penerima_duplikat` |

### Depth rule

Every public business function gets `start`/`done`/`fail` (writes) or
`access` (reads). Non-trivial functions ALSO get `fetch`/`try`/`skip` at each
meaningful internal step. Target: **3–6 logs per non-trivial function.** Trivial
getters: just `access`.

The goal is to log the **important parts of each business process** — not just
entry/exit, but every fetch, every external attempt, every skip. A reader of the
log stream should be able to reconstruct what the function did without reading
the code.

## Mechanism (prescribed principle)

**Principle — one exit-point failure log.** Do **not** scatter `fail` logs before
every `return`/`throw`. Emit exactly one failure log per function, at a single
exit point that catches every error path (validation, DB fail, guard rejection,
etc.) with zero logic changes to the function's contract.

- Use whatever mechanism the target language provides to reach a single exit
  point (deferred block, single `try/catch` + rethrow, error-propagation
  operator with side effect, middleware/wrapper, aspect, etc.).
- The `fail` log fires only on the error path; normal returns stay untouched.
- The function's external contract (return values, thrown/propagated errors)
  must not change because logging was added.

**Entry / success / internal steps** are direct logger calls at the exact code
points identified while tracing the flow (see *Read the Code First*) — no
wrappers needed: the log line sits where the step happens.

## PII Masking (mandatory, layered)

Defense in depth — apply as many layers as feasible. (Source: LogicMonitor
"Handling Sensitive Data in Logs" + project `security-compliance.md`.)

### Layer 1 — Don't log it (preferred)

Prefer non-identifying handles (UUID, transaction ID, row count) over raw PII.
Before logging a field, ask: *"do I need the value, or just a reference to it?"*
This is the cheapest and safest defense.

### Layer 2 — App-level mask (at the log call)

For PII you must reference, mask at the source. **Two operations:**

- **Drop** — never appear at all: credentials and raw secrets.
  `password`, `token`, `secret`, `apikey`, `Authorization` header, credit card
  numbers, CVV, raw request/response bodies.
- **Mask** — keep the line, obscure the value: identity & financial fields.
  Use the project's masking helper (e.g. `random.MaskPII()`).

**Field rules** (authoritative source: `security-compliance.md`):

| Field | Action | Why |
|---|---|---|
| password / token / secret / apikey | **drop** | credentials |
| Authorization header | **drop** | credentials |
| credit card / CVV | **drop** | financial PII |
| nik_ktp (NIK) | **mask** | government ID |
| no_paspor (passport) | **mask** | government ID |
| no_rekening (bank acct) | **mask** | financial PII |
| email | **mask** | direct identifier |
| nip (employee ID) | **keep** | internal operational id, not government ID |
| **UUID (record, per-transaction)** | **keep** | random, non-identifying — the *recommended* handle |

**About UUIDs:** a random per-record UUID (e.g. `hb_transaksi.uuid`) is **not** PII.
It's the recommended non-identifying substitute for PII — log it in cleartext.
Only mask/drop IDs that are themselves credentials (tokens, API keys) or that
identify a specific person (NIK, passport, account number). *Caveat:* a UUID
becomes an indirect identifier only if it's permanent and 1:1 with one person
(e.g. an unchanging `user_uuid`) — your per-transaction UUIDs are not.

**Masking style:** prefer full replacement (`[REDACTED]` / `[REDACTED_NIK]`) for
maximum safety. Partial masking (e.g. `1234****`) is acceptable when some prefix
is needed for debugging and the remaining chars carry no identity signal.

### Layer 3 — Centralized denylist (config-level, if available)

If the log pipeline supports a key-denylist or regex redaction (Fluentd,
Fluent Bit, Logstash, or platform-side like LogicMonitor's LogSource masking),
configure it as a **backstop** — it catches PII that slips past Layer 2.
Common denylisted keys: `password`, `token`, `secret`, `apikey`, `authorization`,
`creditCard`, `cvv`, `ssn`, `email`, `iban`. This does **not** replace Layer 2;
app-level masking is primary. This layer is infrastructure (out of this skill's
executable scope) — note it, recommend it, but don't implement it here.

### Never

- Never log raw request/response bodies.
- Never log full credentials even when debugging.
- Never rely solely on Layer 3 — app code is the source of truth.
- Never mask `nip` or per-record UUIDs (they are not PII).

## Quality Check

Use this checklist when reviewing logging code:

- Every business function has `start`/`done`/`fail` (writes) or `access` (reads).
- Non-trivial functions have `fetch`/`try`/`skip` at internal steps (3–6 logs total).
- All logs use the pipe format with an `UPPER_SNAKE` TAG.
- Context is scalar key=val pairs — no struct/map dumps.
- Errors logged via the language's one-exit failure-log idiom, not scattered across return/throw sites.
- PII fields (NIK, paspor, rekening, email) are masked; credentials dropped.
- `nip` and per-record UUIDs are **not** masked (they are not PII).
- The chosen log library matches what the project docs / existing code use.

## Anti-Patterns

- Plain no-context log lines ("here", "reached this point") with no TAG or key=val context.
- Logging full structs, objects, or maps — any raw dump of a whole payload.
- Scattering `fail` logs before each `return`/`throw` instead of the language's one-exit idiom.
- Masking `nip` or a per-record UUID (they are not PII).
- Failing to mask NIK / paspor / no_rekening / email.
- Logging raw HTTP request/response bodies or `Authorization` headers.
- Inventing a log format without reading the project docs first.
- Emitting high-cardinality values as anything other than a logged scalar field.

## Output Contract

When using this skill, the output should include:

1. **project docs consulted** — and which log library the project uses.
2. **the log statements added** — with TAG, verb, and context (key=val).
3. **the PII fields verified** — which were masked, which dropped, which kept (and why for UUID/nip).
4. **how it was validated** — the project's own build/lint/test commands (per `docs/project-docs/development/testing.md`) + a stdout/log sample of the new lines.

## Neutral Prompt Shape

`@agent use build-logging on [Target Service/Component] focusing on [Specific functions/flows].`

## Example Prompt

- "Add logging to the recompense kasir flow — entry, exit, and the PostToCore HTTP attempt."
- "Instrument the UM store function: log every masterdata fetch and any duplicate-penerima skip."
- "Review this usecase to ensure NIK is masked before logging."
