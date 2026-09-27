---
description: "EHA skill — generate-api-contract: Structured API contract documentation by tracing existing routing and handler code endpoint by endpoint. Use when documenting live endpoints from source rather than designing new ones."
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

# Generate API Contract

Produces structured documentation for existing API endpoints by reading the repository's routing and implementation files. This skill is language-agnostic and relies on the project's own routing and handler patterns.

## Required Project Inputs

Read the following project documents before starting to understand the repository's architecture and expected output format:
- \`docs/project-docs/foundation/architecture.md\` (to understand the application's layers, routing strategy, and handler patterns)
- \`docs/project-docs/development/api-contract.md\` (to see if an existing API documentation format or schema is already defined)

## Procedure

### Step 1 — Intake & Scope Definition
Ask the user briefly for the following if not provided:
- Primary domain or module to document
- Domains or modules to **exclude** (e.g., boilerplate, master data, shared utilities) so the scan stays focused
- First feature to document (as a starting point)
- Desired output path
- Language for endpoint descriptions (e.g., English, Indonesian)

### Step 1.5 — Confirmation Checklist (TBD fields) — MANDATORY

The skill must collect values for every `[TBD]` field **before** generating any output. These cannot be auto-derived from code. Ask the user the following, once for the whole file (a single answer applies to every endpoint unless the user says otherwise):

1. **`[api-contract-code]`** — the short code prefix for endpoint titles (e.g. `AC1`). One value for the whole file.
2. **Maintainer** — name(s) of the maintainer(s). One value for the whole file.
3. **Next API** — the successor/related API, if any. May stay `[TBD]` if the user has no answer.
4. **Consumer** — the consuming service + its owner/maintainer (one per file, or one per endpoint if they differ).
5. **Endpoint env status** — for each environment (DEV / STAG / PROD), the dev status: `TO DO` / `DOING` / `DONE`. The user may give one answer per env (e.g. "DEV DONE, STAG and PROD TO DO") that applies to every endpoint, or per-endpoint.

**Rules:**
- If the user provides values in the invocation (e.g. `the code is ILK`, `maintainer: X`), use them and do not re-ask that field.
- If the user skips a field, leave it `[TBD]` in the output — do not invent a value.
- Do **not** begin Step 2 (code tracing) until this checklist is resolved or the user explicitly defers it. Generate nothing until the `[TBD]` values are in hand.

### Step 2 — Understand the Codebase Pattern
Use the architecture documentation to identify how HTTP requests flow through the application. Determine:
- Where are routes defined?
- Where are request handlers located?
- Where are request payloads (DTOs/structs/classes) defined and validated?
- Where are response envelopes and shapes defined?

### Step 3 — Enumerate All Routes in Scope
- Open the relevant routing file(s) for the requested domain/module.
- Count every non-commented route line individually (GET, POST, PUT, DELETE, etc.).
- Record the HTTP method, path, and handler function name for each route.
- This count is your target: every single route found here must appear in the final documentation. Keep this route ledger — Step 6 reconciles it against what you actually wrote.

### Step 4 — Analyze Each Endpoint
For each route identified, trace through its handler and full business-logic chain (handler → service/use-case → data/persistence layer) to determine:
- **Headers:** Any required or optional HTTP headers.
- **Input kind:** Trace the code to decide whether the endpoint reads query params, a request body, or both — do not assume from the HTTP method.
- **Payload/Response Structure:** Trace through return values to reconstruct the exact shape (object vs array, and every nested level). Account for any shared response envelope/wrapper the framework applies around handler output.
- **Types:** Use proper type names (`string`, `integer`, `float`, `boolean`, `array`, `file`) — never example values. Then sharpen them:
  - Date/time fields → note the format (e.g., RFC 3339).
  - Float fields → note expected decimal precision, especially for monetary values.
  - Enum-typed fields → list every possible value.
  - Nullable or optional markers in the project's type system (optional/pointer types, nullable annotations) → mark the field Optional or nullable.
  - Serialization tags or mappers defined inline on the handler/use-case take precedence over the base model definition — trace and document the effective serialized shape.
- **Status:** Classify each field and justify it from the code:
  - **Required** — enforced as required by validation or always present in the output.
  - **Optional** — may be absent (nullable type or conditionally populated without a fixed rule).
  - **Conditional** — present only when a specific condition is met; state that condition explicitly beneath the table.

### Step 5 — Output Generation

Produce output using the **Endpoint format** embedded below. One file per feature; each endpoint in the feature is one section inside that file. The title of each file is the feature name.

**Endpoint ordering:** within the file, sort endpoints by HTTP method in this fixed order: `GET` → `POST` → `PUT` → `DELETE` → any other methods. The Table of Contents, endpoint numbering, and sections must all follow this order.

#### Endpoint Format (one section per endpoint)

Each endpoint section follows this exact structure. The skill must not deviate from these blocks.

\```
# [api-contract-code] - [METHOD] - [Feature] - [Endpoint Name]

> [api-contract-code] is [TBD] until the user confirms — see field fill strategy.


| **Version** | v1 |
| --- | --- |
| **Description** | [short description in chosen language] |
| **Service** | [service/domain name] |
| **Status** | LIVE |
| **Next API** | [TBD] |
| **Maintainer** | [TBD] |


## [Response | Payload]   ← exactly ONE of these, by method (see input-kind rule)

[GET        → label "Response": the object this endpoint returns — structured JSON with inline type annotations]
[POST/PUT/DELETE → label "Payload": what the caller sends — JSON body OR multipart form-data]
  [JSON body   → JSON block with inline type annotations]
  [form-data   → field table (Name/Type/Status/Option Value/Description); file fields typed `file`; note Content-Type: multipart/form-data]
  [no body     → omit the whole section; the endpoint is query/header-only]

[If a field is an enum, list its Option Values in a note beneath the JSON/table.]


## Endpoint

| **URL** | **Environment** | **Type** | **Status** | **Scope** |
| --- | --- | --- | --- | --- |
| `[path]` | DEV | [METHOD] | [TO DO/DOING/DONE — ask user, Step 1.5] | [PUBLIC/PRIVATE from middleware] |
| `[path]` | STAG | [METHOD] | [TO DO/DOING/DONE — ask user, Step 1.5] | [PUBLIC/PRIVATE from middleware] |
| `[path]` | PROD | [METHOD] | [TO DO/DOING/DONE — ask user, Step 1.5] | [PUBLIC/PRIVATE from middleware] |


## Query Parameters

[omit this entire block if the endpoint reads no query params]

| **Name** | **Type** | **Status** | **Option Value** | **Description** |
| --- | --- | --- | --- | --- |
| [param name] | [type] | [OPTIONAL/REQUIRED] | [enum values, or — if none] | [describe] |


## Header Variables

[omit this entire block if the endpoint reads no custom headers]

| **Name** | **Type** | **Status** | **Option Value** | **Description** |
| --- | --- | --- | --- | --- |
| [header name, e.g. X-Organization] | [type] | [OPTIONAL/REQUIRED] | — | [describe] |


## Success Responses Example

(status code, e.g. 200)

\```json
{
  [envelope keys detected from code: e.g. param/result/count/data],
  "data": [ {<your model object>} ]
}
\```


## Consumer

| **Service** | **Owner** | **Maintainer** |
| --- | --- | --- |
| [TBD] | [TBD] | [TBD] |

*\*Contact service consumer if this endpoint is going to migrate*
\```

#### Field fill strategy

| Field | Source | How to fill |
| --- | --- | --- |
| Title `[api-contract-code] - [METHOD] - [Feature] - [Name]` | intake + code | `[api-contract-code]` is `[TBD]` — ask user, do not invent. METHOD from the route. Feature = the feature/module the endpoint belongs to (from the file or route group). Name from handler/purpose may be *suggested*, but `code` requires explicit confirmation. |
| Description | code | one line in the chosen language |
| Service | intake | ask, or default to the repo domain name |
| Status (LIVE/OBSOLETE) | code | `LIVE` if the route is wired; `OBSOLETE` only if code marks it deprecated |
| Next API | intake (Step 1.5) | `[TBD]` — ask user; may stay `[TBD]` if unknown |
| Maintainer | intake (Step 1.5) | `[TBD]` — ask user; one or more names |
| Response (GET only) | code | trace the handler → return value/struct; render as JSON block with inline type annotations. **GET endpoints have no Payload block.** |
| Payload - JSON body (POST/PUT/DELETE) | code | trace the `ShouldBindJSON`/`BindJSON` payload struct; render as JSON block. POST/PUT/DELETE have **no Response block** in this section (the success example further down covers the response). |
| Payload - multipart form-data (POST/PUT/DELETE) | code | trace the `ShouldBind`/`FormFile` payload with `form:` tags; render as a field table (Name/Type/Status/Option Value/Description); file fields typed `file`; note `Content-Type: multipart/form-data`. |
| Payload - none | code | if the handler reads only query params / headers (no body bind), **omit the whole Response|Payload section**. |
| Endpoint rows (DEV/STAG/PROD) | intake (Step 1.5) | always 3 rows, path repeated; **Status = user-provided `TO DO`/`DOING`/`DONE` per env** (default `[TBD]`); Scope from the route's middleware group |
| Query Parameters | code | trace `ctx.Query(...)` in the handler; omit block if none |
| Header Variables | code | trace `ctx.Request.Header.Get(...)` (X-Organization, X-Member, Authorization, etc.); omit block if none |
| Success Responses Example | code + envelope detect | see Envelope detection rule below |
| Consumer | intake (Step 1.5) | `[TBD]` — ask user for consumer service + owner + maintainer; may differ per endpoint |

#### Input-kind detection rule (Response vs Payload section)

The section heading and rendering are driven by the HTTP method **and** how the handler binds input — do not assume from the method alone. Trace the handler's bind/reader call:

| Handler call | Input kind | Section label | Rendering |
| --- | --- | --- | --- |
| (none — reads only `ctx.Query(...)` / `ctx.Param(...)`) | query-only | GET → `## Response`; non-GET → **omit the whole section** | — |
| `ctx.ShouldBindJSON(&payload)` / `ctx.BindJSON(...)` | JSON body | POST/PUT/DELETE → `## Payload` | JSON block |
| `ctx.ShouldBind(&payload)` with `form:` struct tags, or `ctx.FormFile(...)` | multipart form-data | POST/PUT/DELETE → `## Payload` | field table; file fields typed `file`; note `Content-Type: multipart/form-data` |
| GET with no body bind | — | `## Response` | JSON block of the returned object |

**Mutual exclusion:** a GET endpoint never has a `## Payload` block; a POST/PUT/DELETE endpoint never has a `## Response` block in this section (its response shape is shown in the Success Responses Example block below). This keeps the two concepts from being conflated in one muddy block.

#### Envelope detection rule (Success Responses Example)

The template's canonical success envelope is `{ result: true, count, data }`. But this may not match the actual service. **Detect, don't assume:**

1. Read the project's success-response helper (e.g. `utils/message/message.go`, function `ReturnOk` / `ReturnSuccessInsert`) to find the real envelope keys.
2. Generate the Success Responses Example using the **actual keys** the code emits.
3. If the actual keys differ from `{ result, count, data }`, emit a warning note directly beneath the JSON block:
   > ⚠️ **Envelope note:** this service returns `{ param, count, data }`, which differs from the template default `{ result, count, data }`. Document the real shape.

Never silently use the template default keys when the code emits different ones.

### Step 6 — Verify Coverage
Before finishing, reconcile what you wrote against the Step 3 route ledger:
- The count of documented endpoints must equal the count of routes found. Any difference is a gap to close.
- Confirm every HTTP method + path from the routing file is represented, including private/internal routes.
- Re-trace any endpoint whose payload/response shape was inferred rather than read from code, and verify it against the handler.
- If a route cannot be documented (e.g., deprecated, unimplemented), list it explicitly under a "Not Documented" note with the reason rather than silently dropping it.

## Quality Check
- Do not guess shapes; trace the actual handler and payload models.
- Headers and Query/Payload tables must always be separate — never combine them.
- Do not flatten nested JSON structures into single-level tables; show the full nested shape.
- Use proper type names, not example values. No `Last Updated` field; no free-text `Description` column inside Headers / Query Params / Payload tables.
- When an endpoint is reachable on more than one scope, record it once with a combined Scope (e.g., `Public & Private`).
- Add a Table of Contents at the top of each generated file listing every endpoint title.
- Document 100% of the routes found in Step 3 — verified by the Step 6 reconciliation.

## Output Contract
Write the generated documentation directly to the requested output path using the **Endpoint format** (Step 5). Output is organized **one file per feature**, each file containing one endpoint section per route in that feature. Begin with the starting feature requested in Step 1, then continue through the remaining features in scope. Add an `index`/`README` file linking the per-feature files. Org-only fields (Next API, Maintainer, Consumer, dev-status) are filled with `[TBD]`. If the detected response envelope differs from the template default `{ result, count, data }`, the Success Responses Example carries an explicit warning note.
