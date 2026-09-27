---
description: "EHA skill — analyze-design: Business process analysis from UI designs — screenshots, Figma, wireframes. Maps actors, flows, inferred business rules, and open questions with truth verification. Use before generating an FSD or writing specs from designs."
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

# Design Analysis

Analyzes UI designs — Figma screenshots, design mockups, wireframes, or any visual design artifact — and produces structured business process analysis documents. Maps out features, actors, business processes, inferred business rules, and open questions directly from what the design shows.

This skill is **self-contained**. It carries the analysis template structure internally — no external template file needed.

This skill enforces a **mandatory user confirmation step with truth verification** before finalizing any analysis document. Every business rule, actor, and process flow inferred from the design must be confirmed by the user. The skill must not write the final document without explicit sign-off.

---

## Language

This skill file is written in **English**. However, the generated analysis output language is chosen by the user.

**When to ask:**
- During Step 1 (gather input), if the user has not already specified a language, ask:
  *"Which language should the analysis be written in? Bahasa Indonesia or English (both preferred). Other languages are not recommended."*

**Language preference rules:**

| Language | Recommendation | Behavior |
| --- | --- | --- |
| **Bahasa Indonesia** | Preferred | Translate section labels to: `Nama Fitur`, `Tujuan Fitur`, `Contoh Data`, `Aktor`, `Kewenangan aktor`, `Business Process`, `Tujuan`, `Alur Utama`, `Hasil`, `Aturan Bisnis yang Tersirat dari UI`, `Open Question`, `Pertanyaan`, `Contoh`, `Bukti`, `User Answer`. Content in Indonesian. Structure unchanged. |
| **English** | Preferred | Use the canonical English section labels shown in the template below. Content in English. |
| **Other languages** | Not recommended | Warn the user that the skill's template and examples are calibrated for Bahasa Indonesia and English — inconsistencies may arise. If the user insists, proceed with a note in the output. |

**If the user already stated a language** in the prompt (e.g., "analyze this design in English"), don't ask again — use that language.

**The skill must not assume a default language.** If no language is specified and the user skips the question, default to the design's visible language. If that's also ambiguous, ask again before generating.

---

## Analysis Template Structure

Every design analysis follows this exact structure. The skill must not deviate from these sections.

The canonical section labels are **English**. For Bahasa Indonesia output, translate labels as shown in the Language section above.

```
# Feature Name

Feature Purpose: purpose of this feature

## Sample Data

- Example 1
- Example 2

## Actors

Actor 1.

Actor authorities:

- View data
- Edit data
- Search data
- Delete data

## Business Process 1 — Business Flow Name

**Purpose:** purpose of this business flow

**Main Flow:**

1. Open the menu.
2. System displays the data list.

**Result:** The user can view all data.

## Business Rules Inferred from UI

Based on the design, several business rules are almost certain to apply.

### BR-01

Business rules:

- 1
- 2

## Open Questions

Several things cannot yet be confirmed from the UI design alone.

### Q1

Question about the design

Example: Example 1

Evidence: Evidence 1

User Answer: TBD
```

### Section Guide

| Section | What goes in it | Rules |
| --- | --- | --- |
| **Feature Name** | Feature name as shown or implied by the design | One per analysis; title is `# Feature Name` |
| **Feature Purpose** | One sentence — what this feature accomplishes | Directly below the title, no heading |
| **Sample Data** | Sample data visible in the design — table rows, dropdown values, labels | Use `-` bullet list |
| **Actors** | Who uses this feature, plus their authorities | One actor per section; `Actor authorities:` as sub-list |
| **Business Process** | Flow-by-flow breakdown of what the user does and what the system responds with | Numbered: `Business Process 1`, `Business Process 2`, ...; each has `Purpose`, `Main Flow` (numbered steps), `Result` |
| **Business Rules (BR-XX)** | Business rules inferred from visual patterns in the design | Numbered: `BR-01`, `BR-02`, ...; each lists rule items with `-` bullets |
| **Open Questions (QX)** | Ambiguities the design doesn't answer — what's unclear, with evidence from the design, and a TBD slot for the user | Numbered: `Q1`, `Q2`, ...; each has `Question`, `Example`, `Evidence`, `User Answer: TBD` |

### Language & Tone

- **Language:** Chosen by the user — Bahasa Indonesia or English (both preferred). The template above shows the canonical English variant. For Bahasa Indonesia, translate all section labels and content while keeping the same structure.
- **Tone:** Direct, analytical, non-technical — explain flows and business processes clearly, not implementation details
- **Detail level:** Enough that someone who hasn't seen the design can understand the feature

---

## Supported Input Formats

| Format | Detection | Extraction approach |
| --- | --- | --- |
| **UI Screenshots** (PNG, JPG, WEBP) | File extension `.png`, `.jpg`, `.jpeg`, `.webp` | Visually inspect the image: read labels, buttons, table headers, form fields, navigation elements. Trace user flows across multiple screenshots. |
| **Figma links** (public) | URL containing `figma.com` | Use WebFetch to access the Figma file if public. Extract frames, components, and annotations. |
| **Design markdown notes** (`.md`) | Headers or bullet lists describing UI elements | Parse structured descriptions of screens, flows, and components. |
| **Multi-screenshot** | Multiple image files referenced together | Order screenshots by filename or user hint. Trace the flow sequentially across screens. |

If the input is a single screenshot, the analysis covers what's visible. If multiple screenshots are provided, the analysis traces the end-to-end flow across all screens.

---

## When to Use

| Trigger | Example request |
| --- | --- |
| Screenshot → analysis | "Analyze this UI screenshot and extract the business process" |
| Figma → analysis | "Take this Figma design and produce a design analysis" |
| Multi-screen flow → analysis | "These 5 screenshots show the approval flow — analyze them" |
| Design review prep | "I have wireframes — break down the features and business rules before we code" |
| Pre-FSD analysis | "Analyze these designs first, then we'll generate the FSD" |

Do not use this skill for:

- Generating an FSD from the analysis — use `eha-generate-fsd` for that
- Writing code from designs — that falls under the SDD workflow
- UI/UX critique or design-system review — this skill extracts business logic, not design quality

---

## Procedure

### Step 0 — Detect input format

Classify the user's referenced file(s) by extension and source:

- `.png`, `.jpg`, `.jpeg`, `.webp` → Screenshot mode (visual inspection)
- URL containing `figma.com` → Figma mode (WebFetch)
- `.md` with design descriptions → Document mode
- Mixed (images + text) → Multi-source mode

This step is internal — don't ask the user about format unless it's truly ambiguous.

### Step 1 — Gather input

**If the user already referenced files in the prompt** (e.g., `/eha-analyze-design from @screenshot1.png @screenshot2.png`):

- Read those files directly. Do not ask "which designs?" — the user already told you.
- For images: inspect each one visually. Note what screen it represents, what elements are visible, and how it connects to other screenshots.
- If a referenced path doesn't exist, report it and ask for the correct path.

**If the user invoked the skill with no references** (bare `/eha-analyze-design`):

- Ask: *"Which design(s) should I analyze? You can share screenshots, Figma links, or design notes."*
- Wait for the user's response before proceeding.
- Do not guess or search for files on your own.

**Language:** If the user has not specified a language (Bahasa Indonesia or English) in the prompt, ask now: *"Which language should the analysis be written in? Bahasa Indonesia or English (both preferred). Other languages are not recommended."* See the Language section above for rules.

### Step 2 — Analyze the design

For each design artifact, extract:

**Feature identity:**
- What feature is this? (from page titles, headers, navigation context)
- What is its purpose? (from the overall layout and what the user can accomplish)

**Actors & authorities:**
- Who uses this screen? (from role indicators, restricted UI elements, contextual clues)
- What can they do? (from available buttons, editable fields, visible actions)

**Business processes:**
- What flows are visible? (from button sequences, form submissions, navigation paths)
- What is the step-by-step user+system interaction? (trace each clickable action to its result)
- What is the outcome of each flow? (from success states, resulting screens, confirmation messages)

**Example data:**
- What sample data is shown? (from table rows, dropdown options, placeholder values, labels)

**Business rules:**
- What constraints are implied by the UI? (from disabled buttons, validation messages, conditional visibility, field limits)
- What rules are "almost certainly true" based on the design patterns?
- Flag each rule with its visual evidence.

**Open questions:**
- What can't be determined from the design alone?
- Generate one Q-item per ambiguity, with:
  - `Question` — the question
  - `Example` — a concrete example of the ambiguity
  - `Evidence` — what in the design makes this unclear (e.g., "dropdown has no options visible", "button state is unclear in the screenshot")
  - `User Answer: TBD` — ready for the user to fill

### Step 3 — Generate the analysis draft

Produce a complete draft following the Analysis Template Structure (embedded above):

1. **Feature Name + Feature Purpose** — name the feature, state its purpose in one sentence
2. **Sample Data** — list sample data visible in the design
3. **Actors** — one section per actor, with `Actor authorities:` bullet list
4. **Business Process** — one block per flow: `Purpose`, `Main Flow` (numbered), `Result`
5. **Business Rules** — `BR-01`, `BR-02`, ... with evidence from the design
6. **Open Questions** — `Q1`, `Q2`, ... with `Question`, `Example`, `Evidence`, `User Answer: TBD`

Apply these rules:

- Use the language chosen by the user (Bahasa Indonesia or English). Match the tone — direct, analytical, non-technical — in whichever language is selected.
- For English: use the canonical English section labels as shown in the template.
- For Bahasa Indonesia: translate section labels to `Nama Fitur`, `Tujuan Fitur`, `Contoh Data`, `Aktor`, `Kewenangan aktor`, `Business Process`, `Tujuan`, `Alur Utama`, `Hasil`, `Aturan Bisnis yang Tersirat dari UI`, `Open Question`, `Pertanyaan`, `Contoh`, `Bukti`, `User Answer: TBD`.
- Every business rule must have a visible justification in the design — no inventing rules the UI doesn't show
- Every open question must cite specific evidence from the design
- Flag inferences with `[Inferred: reason]`
- For multi-screenshot flows: trace the sequence; note which screenshot each flow step comes from

### Step 4 — Present draft with truth verification (MANDATORY)

**This step must not be skipped under any circumstance.**

Present the complete analysis draft to the user. Then, ask the user to verify the truth of every factual claim:

1. **Summary:** what was analyzed (N screenshots/files, M features found, X business processes, Y business rules, Z open questions)
2. **Full draft** — all sections, clearly separated
3. **Evidence trace** — which finding came from which screenshot/element

Then ask these truth-verification questions point-by-point:

- *"Is the feature name and purpose (`Feature Name`, `Feature Purpose`) accurate?"*
- *"Are the actors (`Actors`) correct? Are there any missing actors or wrong authorities?"*
- *"Is each business process flow (`Main Flow`) in the correct order and complete? Are any steps missing?"*
- *"Are the business rules (`BR-XX`) accurate? Are any rules wrong or missing?"*
- *"Is the sample data (`Sample Data`) representative of real data?"*
- *"Are there any features or flows visible in the design that I missed entirely?"*
- *"Are there any flows or rules I invented that don't actually exist in the design?"*
- *"For the Open Questions (`QX`) — can you answer any of them now? Which `TBD` slots can you fill?"*

Wait for the user to answer each question. If the user confirms all items, proceed to Step 5. If the user corrects any item:

- Apply the corrections and re-present only the changed sections
- Re-ask the affected truth-verification questions
- Do not proceed to Step 5 until the user confirms everything

### Step 5 — Re-verify and finalize

Once the user confirms all truth-verification questions:

1. **Cross-check** every finding against its source screenshot/element. Confirm nothing was misread.
2. **Verify numbering** — business processes (1, 2, ...), business rules (BR-01, BR-02, ...), and open questions (Q1, Q2, ...) must be sequential without gaps.
3. **Resolve user answers** — fill any `User Answer: TBD` slots the user provided during Step 4.
4. **Check completeness** — every visible flow must have a business process block; every visible constraint must have a business rule.
5. **Write the final analysis file** to the location the user specifies. If no location is given, default to `docs/project-docs/foundation/analysis-<feature-slug>.md`.
6. Report: file path written, feature count, business process count, business rule count, open question count (resolved vs. remaining TBD), and source files consulted.

---

## Quality Check

- No business process without `Purpose`, `Main Flow` (numbered), and `Result`
- No business rule without visual evidence from the design
- No open question without `Question`, `Example`, `Evidence`, and `User Answer: TBD`
- No content invented beyond what the design actually shows
- No skipped truth verification — refuse to finalize without user confirming each claim
- No actor or authority claimed without a visible indicator in the design

## Anti-Pattern

- Writing the final analysis file before the user confirms the truth of every claim
- Asking "does this look okay?" instead of the point-by-point truth verification checklist
- Inventing business rules that the design doesn't show — if a rule isn't visible, it's an Open Question
- Skipping Open Questions for ambiguous UI elements — every unclear element should generate a Q-item
- Leaving `User Answer: TBD` unfilled without explicitly asking the user to fill them
- Describing implementation details (API, database, code) — this is a business analysis, not a technical spec
- Generating in a language the user didn't choose — always ask if not specified; never assume
- Changing the template structure (adding/removing sections) without asking the user
- Treating the truth verification as optional for "simple" screens

## Output Contract

When using this skill, the output should include:

1. the source design file(s) analyzed (with format detected for each)
2. a summary of extracted features, business processes, business rules, and open questions
3. the complete analysis draft (presented for truth verification, not yet written to disk)
4. an evidence trace — which finding came from which design element
5. the user's truth-verification responses (confirmed / corrected per item)
6. after approval: the final file path, counts, and remaining `User Answer: TBD` items
7. any design elements that were deliberately excluded with a brief reason

## Neutral Prompt Shape

`/eha-analyze-design from @screenshot.png` — with reference, executes immediately (still confirms before writing).  
`/eha-analyze-design` — bare, asks which designs to analyze.

## Example Prompt

- `/eha-analyze-design from @login-screen.png @dashboard.png` — analyzes two screenshots as a flow
- `/eha-analyze-design from @figma-link` — fetches Figma, analyzes, confirms
- `/eha-analyze-design from @wireframes/` — analyzes all screenshots in a folder
- `/eha-analyze-design` — asks "which designs?", then proceeds
