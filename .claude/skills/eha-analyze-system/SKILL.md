---
description: "EHA skill — analyze-system: Project-aware expert-role analysis for architecture, debugging, trade-offs, risk, performance, requirements, and design questions. Reads project docs first, then applies expert structured reasoning to the current repository context."
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

# System Analysis

Produces a **rigorous, expert-level analysis** of a problem, decision, artifact, or system after first reading the project documentation that defines the repository's actual context.

This skill is reusable across product, backend, frontend, infrastructure, monorepo, and documentation-heavy projects. It should not assume a particular stack until the project docs confirm it.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/foundation/prd.md` | Clarifies goals, scope, stakeholders, and success metrics |
| `docs/project-docs/foundation/architecture.md` | Defines stack, boundaries, integration model, constraints, and runtime assumptions |
| `docs/project-docs/foundation/status.md` | Reveals maturity, roadmap, active workstreams, and known blockers |
| `docs/project-docs/development/testing.md` | Shows what validation exists and how strong the available evidence can be |
| Relevant feature, workflow, API, or guideline docs | Supply domain-specific truth for the topic being analyzed |
| Relevant code, logs, tests, or runtime evidence | Support findings with direct evidence rather than guesswork |

If the required project docs are missing, note the gap explicitly and limit confidence accordingly.

## When to Use

| Trigger | Example request |
| --- | --- |
| Architecture review | "Analyze this module boundary for coupling risk" |
| Debugging | "Analyze why this workflow fails intermittently" |
| Trade-off decision | "Analyze option A vs option B for this integration" |
| Requirements review | "Analyze these specs for gaps and contradictions" |
| Risk assessment | "Analyze the release risk of this change" |
| Performance diagnosis | "Analyze where this request path will bottleneck" |
| Product or roadmap question | "Analyze whether this feature belongs in MVP" |

## Procedure

### Step 1 — Understand the question

- Restate the problem in precise terms.
- Identify the decision being made or the behavior being explained.
- Identify what counts as success or failure.
- Identify any missing context that materially changes the analysis.

### Step 2 — Ground the analysis in project reality

Read the relevant project docs first.

Extract:

- actual stack and runtime model
- architecture rules and boundaries
- scope and non-goals
- available verification signals
- known constraints such as team size, maturity, environment, or performance budget

### Step 3 — Decompose the subject

Break the problem into:

- components
- boundaries
- dependencies
- failure points
- assumptions
- decision criteria

Identify the most load-bearing parts first.

### Step 4 — Gather evidence

Prefer direct evidence from:

- code
- tests
- runtime logs
- project docs
- API or contract docs
- existing workflows

Separate:

- facts
- inferences
- assumptions

### Step 5 — Apply the right reasoning mode

Use one or more of:

- first-principles reasoning
- causal reasoning
- adversarial reasoning
- deductive reasoning
- inductive reasoning
- comparative or trade-off analysis
- probabilistic reasoning

### Step 6 — Evaluate and rank

When comparing options or hypotheses:

- use explicit criteria
- surface hidden costs
- distinguish reversible vs irreversible decisions
- distinguish local optimization vs system impact

### Step 7 — Form a judgment

- state the conclusion directly
- say what is known vs inferred
- say what could change the conclusion
- tie the recommendation back to the project's actual constraints

## Quality Check

- No claim without evidence or clearly marked assumption
- No false precision when evidence is weak
- No generic advice detached from project constraints
- No vague recommendation without an actionable next step
- No hidden stack assumptions that were not confirmed from project docs

## Anti-Pattern

- Listing facts without evaluating them
- Jumping to the first plausible conclusion
- Treating all options as equally valid when evidence favors one
- Recommending a rewrite when an incremental fix would solve the problem
- Ignoring the project stage, roadmap, or non-goals in `prd.md` and `status.md`

## Output Contract

When using this skill, the output should include:

1. summary
2. analysis by area or component
3. key findings ordered by importance
4. recommendation or decision guidance
5. risks and open questions
6. confidence and evidence limitations when relevant

## Neutral Prompt Shape
`@agent use analyze-system on [Target Directory/Component] focusing on [Specific Goal/Flow].`

## Example Prompt
- "Analyze this decision and tell me whether it still makes sense."
- "Analyze this module boundary for coupling risk"
- "Analyze why this workflow fails intermittently"
- "Analyze option A vs option B for this integration"