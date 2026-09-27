---
description: "EHA skill — design-ui-ux: Project-aware expert-role for frontend UI/UX design and implementation. Reads project docs first, enforces design systems, responsive bounds, accessibility, and visual testing constraints."
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

# Design UI/UX

Produces a **project-aware, expert-level frontend implementation** by reading the repository's project docs first, then applying a rigorous component-driven methodology.

This skill is reusable across any frontend framework (React, Vue, Svelte, plain HTML/CSS) or styling solution (Tailwind, CSS Modules, Styled Components).

It should **not** assume a specific component library (like Material UI) or styling engine until the project docs confirm them.

## Required Project Inputs

| Document | Why it matters |
| --- | --- |
| `docs/project-docs/development/ui-ux.md` | Defines the design system, color palette, typography, accessibility (a11y) targets, and responsive breakpoints. |
| `docs/project-docs/foundation/prd.md` | Clarifies the target audience and expected user flows. |
| `docs/project-docs/foundation/architecture.md` | Defines where state management lives versus pure presentation components. |
| `docs/project-docs/development/testing.md` | Defines how the UI should be validated (e.g., unit tests, visual regression, e2e). |

If the repository lacks the UI docs needed for styling or layout, call that out and create or update the missing docs instead of inventing arbitrary colors or padding values.

## When to Use

Use this skill when building or reviewing one of these boundary types:

| Boundary type | Typical artifacts |
| --- | --- |
| Presentation Component | Buttons, inputs, cards, typography components. |
| Layout / Page | Grid structures, responsive containers, navigation shells. |
| Interaction / Animation | Modals, dropdowns, transitions, hover states. |
| State-Connected Component | Forms, data tables, fetching wrappers. |

## Procedure

### Step 1 — Extract Design Constraints
Extract from `ui-ux.md`:
- CSS variables, Tailwind config, or design token values.
- Responsive breakpoints (e.g., mobile-first vs desktop-first).
- Required a11y standards (e.g., WCAG AA).

### Step 2 — Separate State from Presentation
Extract from `architecture.md`:
- Identify if this component is "dumb" (presentation only) or "smart" (data fetching/stateful).
- Do not mix complex global state logic into a simple presentational button.

### Step 3 — Design for Edge Cases
Before writing HTML/CSS, define:
- Empty states (what if the data array is empty?)
- Loading states (skeletons vs spinners).
- Error states (inline validation vs toast notifications).
- Overflow states (what if the text is 100 characters long?).

### Step 4 — Implement with Accessibility (A11y)
Ensure the implementation includes:
- Proper semantic HTML (`<button>` instead of `<div onClick>`).
- ARIA labels where semantics fall short.
- Keyboard navigation support (focus states).
- Sufficient color contrast.

### Step 5 — Verify Responsive Behavior
Write the code to adapt gracefully across the breakpoints defined in `ui-ux.md`. Ensure touch targets are large enough on mobile.

### Step 6 — Define Verification Requirements
Use `testing.md` to decide how this will be validated.
Examples:
- Component tests (e.g., React Testing Library) asserting ARIA roles.
- Storybook stories for visual isolation.

## Quality Check

- Does it use hardcoded hex colors or arbitrary pixel values instead of the design system tokens?
- Is it accessible via keyboard only?
- Does it break layout on mobile screens?
- Are loading and error states handled gracefully?
- Is state managed at the correct architectural layer?

## Anti-Pattern

- Inventing new colors, fonts, padding, and any other relevant values that aren't in `ui-ux.md`.
- Writing `<div onClick={...}>` instead of semantic interactive elements.
- Ignoring loading/error states in asynchronous components.
- Coupling global state management (like Redux or Zustand) directly into low-level UI components.

## Output Contract

When using this skill, the output should include:
1. the project docs consulted (specifically the design system tokens)
2. the component API (props/inputs)
3. the implementation code (separated by state vs presentation if applicable)
4. the edge cases handled (loading, empty, error, overflow)
5. accessibility and responsive verification steps

## Neutral Prompt Shape
`@agent use design-ui-ux on [Target Theme/Tokens] focusing on [Specific Branding/Accessibility Goal].`

## Example Prompt
- "Implement this presentational card component using the project design tokens."
- "Review this stateful component for accessibility and responsive layout issues."