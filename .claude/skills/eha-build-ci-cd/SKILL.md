---
description: "EHA skill — build-ci-cd: Project-aware expert-role for CI/CD pipeline design and implementation. Reads project docs first, enforces build caching, security gates, test execution, and deployment safety."
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

# DevOps CI/CD

Produces a **project-aware, expert-level CI/CD pipeline implementation** by reading the repository's project docs first, then applying robust deployment engineering practices.

This skill is reusable across CI providers (GitHub Actions, GitLab CI, Jenkins) and deployment targets (AWS, GCP, Vercel, Kubernetes).

It should **not** assume a specific CI provider or deployment strategy until the project docs confirm them.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/operations/ci-cd.md` | Defines the required CI provider, branch protection rules, required jobs, and deployment environments. |
| `docs/project-docs/development/testing.md` | Defines which test suites must run and their coverage thresholds. |
| `docs/project-docs/operations/security.md` | Defines required security scanning tools (SAST, DAST, dependency checks). |

If the repository lacks the CI/CD docs needed for deployment, call that out and create or update the missing docs instead of blindly writing deployment scripts.

## When to Use

Use this skill when building or reviewing one of these boundary types.

| Boundary type | Typical artifacts |
| --- | --- |
| Continuous Integration (CI) | Build scripts, linter checks, test runners, Docker builds. |
| Continuous Deployment (CD) | Terraform/Pulumi execution, environment promotion, artifact publishing. |
| Security & Compliance | Dependabot configuration, secret scanning, static analysis gates. |
| Pipeline Optimization | Caching strategies, matrix builds, job parallelization. |

## Procedure

### Step 1 — Identify the Pipeline Engine and Target
Extract from `ci-cd.md`:
- The CI platform (e.g., GitHub Actions).
- The deployment target (e.g., AWS ECS).
- Authentication mechanisms (e.g., OIDC vs long-lived secrets).

### Step 2 — Define the Build Matrix and Caching
- Ensure language-specific dependencies (node_modules, pip cache, go mod cache) are aggressively cached to reduce build times.
- If building Docker images, implement layer caching.

### Step 3 — Enforce Testing and Security Gates
Consult `testing.md` and `security.md`:
- The pipeline MUST block merges if linters or tests fail.
- The pipeline MUST block merges if critical security vulnerabilities are detected.

### Step 4 — Implement Safe Deployment Strategies
If deploying to production:
- Ensure the pipeline respects environment segregation.
- Implement rollback capabilities or canary/blue-green deployment steps if specified in `ci-cd.md`.
- Never hardcode secrets in the pipeline file; always use the CI provider's secrets manager.

### Step 5 — Verify Pipeline Robustness
Ensure the pipeline:
- Only triggers on appropriate branches or tags.
- Has reasonable timeout limits to prevent hung jobs.
- Cleans up temporary artifacts after execution.

## Quality Check


Use this checklist when reviewing an existing CI/CD configuration:

- Are dependencies and build outputs being cached?
- Are secrets injected securely via environment variables?
- Does a failing test or linter correctly fail the entire job?
- Is the deployment step locked down to specific branches or environments?
- Are timeouts explicitly defined to prevent runaway costs?

## Anti-Pattern

- Hardcoding API keys or passwords directly in the YAML file.
- Writing a pipeline that deploys to production from any branch.
- Skipping tests to make the pipeline run faster.
- Downloading dependencies without verifying lockfiles.

## Output Contract

When using this skill, the output should include:

1. the project docs consulted
2. the proposed pipeline architecture (triggers, jobs, steps)
3. the caching and optimization strategies used
4. the security and testing gates enforced
5. the final pipeline YAML or script

## Neutral Prompt Shape
`@agent use build-ci-cd on [Target Pipeline/Workflow] focusing on [Specific Optimizations/Security Gates].`

## Example Prompt
- "Create a GitHub Actions workflow that implements the CI caching strategy."
- "Review this Jenkinsfile for security issues and hardcoded secrets."
- "Design a deployment pipeline that supports blue-green rollout."