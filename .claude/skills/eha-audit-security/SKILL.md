---
description: "EHA skill — audit-security: Project-aware expert-role for security and vulnerability auditing. Reads project docs first, enforces strict boundary controls, OWASP Top 10 mitigation, authentication, and data privacy rules across the codebase."
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

# Security Audit

Produces a project-aware, **expert-level security audit** by reading the repository's project docs first, then applying rigorous threat modeling and vulnerability analysis to the current architecture.

This skill is reusable across application logic, API boundaries, infrastructure configurations, and data persistence layers. It should not assume specific compliance frameworks (like SOC2 or HIPAA) until the project docs explicitly confirm them.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/operations/security-compliance.md` | Defines the actual threat model, acceptable risk, security gates, PII masking, data retention, and regulatory requirements. |
| `docs/project-docs/foundation/architecture.md` | Defines trust boundaries, network zones, and where authentication/authorization is enforced. |
| `docs/project-docs/development/api-contract.md` | Clarifies the expected payload shapes and validation rules to prevent injection attacks. |

If the repository lacks the security docs needed for a proper audit, call that out and establish baseline security assumptions before reviewing code.

## When to Use

Use this skill when tasked with identifying vulnerabilities or ensuring code meets security standards.

| Boundary type | Typical artifacts |
| --- | --- |
| Authentication / Authorization | JWT validation, role-based access control (RBAC), session management. |
| API / Input Validation | Preventing SQL injection, XSS, CSRF, and mass assignment vulnerabilities. |
| Data Privacy / Cryptography | Encryption at rest/transit, hashing algorithms, secret management. |
| Infrastructure Security | Dockerfile security, IAM permissions, network exposure. |

## Procedure

### Step 1 — Understand intent

- What is this code supposed to do?
- What inputs, outputs, and side effects should it have?
- Which boundary does it sit behind?
- What project rules apply here?

### Step 2 — Check correctness risks

Look for:

- runtime crashes
- missing validation
- broken assumptions around nullability or absence
- incorrect state transitions
- failure to handle empty, partial, duplicate, or delayed inputs
- unsafe retry or transaction behavior
- concurrency or sequencing defects
- schema or serialization mismatches

### Step 3 — Check boundary violations

Use `architecture.md` to inspect:

- layer or module import violations
- leaked internal types across boundaries
- controllers or UI doing business logic that belongs elsewhere
- repositories or services depending on the wrong layer
- transport or persistence details leaking into durable domain concepts when the project forbids that
- identify where untrusted input enters the system (e.g., public APIs, webhooks, file uploads). 
- identify where trust is explicitly verified (e.g., API gateways, auth middlewares).

### Step 4 — Audit Authentication and Session State
Evaluate auth mechanisms against `security-compliance.md`:
- Are tokens securely stored (e.g., HttpOnly cookies instead of LocalStorage)?
- Are session timeouts and revocation mechanisms implemented?
- Is authorization checked on every privileged action, not just at the UI level?

Also look for:

- duplicated logic
- unused or unreachable branches
- stale abstractions
- helper functions with no callers
- repeated literal values that should be owned centrally
- duplicated normalization or mapping logic that should be shared

### Step 5 — Check Secret Management and Cryptography
Ensure: No hardcoded secrets, passwords, or API keys exist in the codebase. Sensitive data is hashed using strong algorithms (e.g., Argon2, bcrypt) with salts. Data in transit is strictly TLS-enforced.

### Step 6 — Verify Compliance and PII Handling
Consult `security-compliance.md`: Ensure PII is not leaked into application logs, error messages, or third-party analytics tools. Verify data retention constraints are implemented.

### Step 7 — Prioritize findings

Classify findings by severity:

- critical
- high
- medium
- low

Each finding should include:

- location
- issue
- why it matters
- concrete corrective direction

## Quality Check

- Are all inputs crossing a trust boundary rigorously validated?
- Are secrets injected via environment variables rather than hardcoded?
- Are dependencies checked for known CVEs?
- Does the code adhere to the Principle of Least Privilege?
- Are error messages stripped of internal stack traces before returning to the client?
- No finding without evidence from the target artifact
- No severity inflation
- No style nitpicks disguised as bugs
- No architecture complaint without reference to actual project boundaries
- No recommendation that ignores project stage or available validation

## Anti-Pattern

- Relying exclusively on client-side validation for security.
- Concatenating SQL queries with user input.
- Logging raw request bodies that might contain passwords or PII.
- Implementing custom cryptography instead of using proven industry standards.
- Assuming an internal network is completely trustworthy without zero-trust checks.
- Calling something dead code without checking workspace usage
- Calling something a bug without defining the failure condition
- Criticizing a pattern that the project explicitly chose in `architecture.md`
- Recommending wide rewrites before testing a local fix or a smaller boundary change

## Output Contract

When using this skill, the output should include:
1. the project docs consulted and assumed threat model
2. identified vulnerabilities categorized by OWASP standard
3. severity rating (Critical, High, Medium, Low) for each finding
4. exploitability and impact analysis
5. specific, actionable remediation steps for each finding

## Neutral Prompt Shape
`@agent use audit-security on [Target Component/API] focusing on [Specific Threat/Vulnerability].`

## Example Prompt
- "Audit this new authentication controller for session management flaws."
- "Review this file upload endpoint for security risks."
- "Perform a security audit on this database migration script."
- "Review this code for bugs, risks, and boundary issues."
- "Audit this module like a strict senior reviewer."
- "Check whether this implementation has correctness or security problems."
- "Find dead code, logic flaws, and maintainability risks in this change."