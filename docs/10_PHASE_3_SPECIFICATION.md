# Document 10: Phase 3 (P3) Product & Architectural Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Phase:** Phase 3 (P3 Advanced Knowledge Ecosystem & Spatial Thinking)
- **Status:** Approved Baseline — Unchangeable Law for Phase 3 Implementation

---

## 1. Executive Summary & Phase 3 Objectives

Phase 3 (P3) elevates Stackmynd from a local-first interconnected note editor and version-controlled knowledge graph into a **dynamic, living knowledge synthesis ecosystem**. 

While Phase 1 established the foundation (atomic file I/O, SQLite ephemeral index, block slicing with `^bk-xxxx` anchors, Tantivy search, and 5-area shell) and Phase 2 introduced visual exploration (interactive force-directed graph and embedded Git engine), Phase 3 addresses high-order knowledge workflows:
1. **Block Transclusion & In-Place Embeds (`![[note#^bk-xxxx]]`)**: Seamless live-rendered composable text blocks that can be embedded across notes with bi-directional update awareness and recursion guardrails.
2. **Daily Notes & Interactive Journaling Engine**: Chronological stream-of-consciousness capture with sidebar calendar navigation, automated date templating, and previous/next day timeline traversal.
3. **Templates & Snippets System**: Structural standardization using Markdown templates stored in `.stackmynd/templates/` with variable interpolation (`{{date}}`, `{{time}}`, `{{title}}`).
4. **Infinite Text-Block Spatial Canvas**: A 2D zoomable visual thinking surface for arranging, grouping, and connecting notes and block cards with directed arrows—strictly non-media, preserving the pure text invariant.

---

## 2. Invariants & Scope Guardrails for Phase 3

All Phase 3 design decisions and implementations must strictly adhere to the 7 foundational project invariants:

1. **Markdown Files on Disk are the Single Source of Truth:**
   - Transclusions render from disk `.md` files; no duplicated cached text bodies are stored in SQLite.
   - Daily notes are stored as standard UTF-8 `.md` files (e.g., `daily/2026-08-29.md`).
   - Canvas boards are saved as plain JSON files (`.canvas.json`) containing spatial coordinates and references to `.md` files and `^bk-xxxx` block IDs.
2. **SQLite is Strictly an Ephemeral Index & Metadata Cache:**
   - Never store note content or transclusion renders in database tables.
   - SQLite indexes transclusion relationships (`link_type = 'transclusion'`) and canvas node references for query performance and link repair.
3. **Pure Note-Taking Engine (Strict Non-Media Scope):**
   - Canvas and transclusions **MUST NOT** support image uploads, media players, PDFs, or audio/video embeds.
   - Canvas nodes are strictly restricted to: **Note Nodes**, **Block Nodes**, and **Text Sticky Cards**.
4. **Atomic File Write Protocol:**
   - Creating daily notes, applying templates, and editing transclusions must execute through the sibling temp-file -> `fsync` -> atomic rename protocol.
5. **Debounced Auto-Save & Watcher Self-Write Suppression:**
   - Any writes triggered by transclusion updates or canvas modifications must register their Blake3 hash in the 1500ms Self-Write Suppression Registry.
6. **Automated Global Link & Block Reference Repair:**
   - Renaming or moving notes must repair all inbound transclusion links (`![[target]]`, `![[target#^bk-xxxx]]`) and canvas card paths across the workspace.
7. **Multi-Workspace Complete Isolation:**
   - Daily note configurations, templates, and canvas states are 100% isolated per workspace under `.stackmynd/`.

---

## 3. Module 1: Block Transclusion & In-Place Embeds

### 3.1 Syntax, Lexing & AST Architecture

Transclusion allows one Markdown document to dynamically embed and display content from another document or specific block without copying text.

1. **Syntax Specification:**
   - **Document Transclusion:** `![[note_path]]` (Embeds entire target note body, omitting YAML frontmatter).
   - **Block Transclusion:** `![[note_path#^bk-xxxx]]` (Embeds only the discrete block identified by `^bk-xxxx`).
   - **Heading Transclusion:** `![[note_path#Heading Title]]` (Embeds heading section up to next heading of equal or higher level).
2. **Lexer & Markdown Pipeline:**
   - The remark plugin parses `![[...]]` into a custom AST node:
     ```ts
     interface TransclusionNode {
       type: "transclusion";
       targetPath: string;
       targetBlockId?: string;
       targetHeading?: string;
       rawText: string;
     }
     ```
   - In **Source Mode**: Displays literal raw syntax `![[path#^bk-xxxx]]`.
   - In **Preview Mode & Split Mode (Preview pane)**: Replaced with an interactive `<TransclusionContainer />` component.

### 3.2 Backend Transclusion Resolution IPC

#### `resolve_transclusion`
- **Command:** `resolve_transclusion(target_path: String, block_id: Option<String>, heading: Option<String>) -> Result<TransclusionPayload, String>`
- **Output Struct:**
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct TransclusionPayload {
      pub resolved_path: String,
      pub title: String,
      pub block_id: Option<String>,
      pub content: String,           // Markdown content of target block or note
      pub exists: bool,
      pub is_circular: bool,
  }
  ```
- **Execution Workflow:**
  1. Resolves relative note path using SQLite index. If note does not exist, returns `exists: false`.
  2. Reads source `.md` file using memory-mapped or buffered atomic I/O.
  3. If `block_id` is supplied, locates the block containing `^bk-xxxx` using the Block Slicer and strips the anchor from rendered display.
  4. If `heading` is supplied, slices content from heading to the next same-or-higher level heading.
  5. Strips YAML frontmatter if embedding full document.

### 3.3 Circular Dependency & Recursion Guardrails

To prevent browser freezing or stack overflow from circular transclusions (e.g., Note A embeds Note B, and Note B embeds Note A):
1. **Resolution Depth Cap:** Maximum transclusion nest depth is strictly capped at **3 levels**.
2. **Path Stack Trace:** During rendering, an active path stack (`Array<string>`) is maintained. If a `targetPath#blockId` is already present in the active ancestry stack, rendering halts immediately and displays a circular reference badge:
   `⚠️ Circular embed detected: [[path]]`

### 3.4 Interactive Transclusion Container UI

The rendered transclusion in the preview pane is styled as a distinct embedded block:
- **Left Accent Rail:** 3px vertical border in `var(--color-accent)`.
- **Top Micro-Header:**
  - File icon + Note Title + Target Anchor link.
  - "Open Source" action icon (jumps editor tab to target file and scrolls to `#^bk-xxxx`).
  - "Copy Reference" action icon.
- **Embedded Content Viewport:** Seamlessly rendered Markdown (including formulas and Mermaid diagrams) styled inside `.transclusion-content`.

---

## 4. Module 2: Daily Notes & Interactive Journaling Engine

### 4.1 Configuration Schema (`.stackmynd/workspace.json`)

Each workspace configures daily notes via its local configuration file:
```json
{
  "daily_notes": {
    "enabled": true,
    "folder": "daily",
    "filename_format": "YYYY-MM-DD",
    "template_path": ".stackmynd/templates/daily.md",
    "auto_create_on_startup": false
  }
}
```

### 4.2 Backend Daily Note Service (`src-tauri/src/services/daily/`)

1. **`get_or_create_daily_note` Command:**
   - **Signature:** `get_or_create_daily_note(date: Option<String>) -> Result<DailyNoteResult, String>`
   - Defaults `date` to current local date (`YYYY-MM-DD`) if `None`.
   - Checks if `<folder>/<date>.md` exists on disk.
   - If missing:
     - Automatically creates parent directory if needed.
     - Loads template from `template_path` (if defined and exists), otherwise uses default daily note boilerplate.
     - Interpolates dynamic template variables.
     - Writes file atomically via temp-file -> `fsync` -> rename protocol.
     - Returns relative file path for opening in editor.
2. **`list_daily_notes` Command:**
   - **Signature:** `list_daily_notes() -> Result<Vec<DailyNoteEntry>, String>`
   - Scans configured `folder` and queries SQLite index for all notes matching the date format.
   - Returns date strings, file paths, and word counts for calendar heatmap rendering.

### 4.3 Frontend Calendar & Navigation Workflows

1. **Sidebar Calendar Widget:**
   - Embedded collapsible mini-calendar at top of left sidebar.
   - Days containing existing daily notes display a subtle dot indicator (`•`).
   - Clicking any day opens or creates the corresponding daily note.
   - Current day highlighted with `var(--color-accent)` ring.
2. **Global Shortcut & Header Action:**
   - Global shortcut: **`Cmd+Shift+D`** / **`Ctrl+Shift+D`** instantly opens or creates today's daily note.
   - Header button: Quick calendar icon with tooltip "Open Today's Note".
3. **Temporal Day Navigation Header:**
   - When viewing any daily note, the Breadcrumb / Tab strip renders temporal arrow controls:
     - `◀ Yesterday` (`YYYY-MM-DD`)
     - `Tomorrow ▶` (`YYYY-MM-DD`)
   - Allows rapid sequential diary browsing.

---

## 5. Module 3: Templates & Snippets System

### 5.1 Storage Protocol & Location

- Templates are stored as standard Markdown files in `.stackmynd/templates/` within the workspace root.
- Users can create, modify, and organize templates using the standard editor or filesystem.
- If `.stackmynd/templates/` is empty upon workspace creation, Stackmynd provisions default built-in starter templates:
  - `daily.md` (Daily Journal Template)
  - `meeting.md` (Meeting Notes & Action Items)
  - `concept.md` (Atomic Knowledge Card)
  - `literature.md` (Reading / Paper Summary)

### 5.2 Dynamic Variable Interpolation Engine

When a template is instantiated or inserted, the variable engine replaces handlebar tokens:

| Token | Replacement Value | Example |
| :--- | :--- | :--- |
| `{{date}}` | Current date in `YYYY-MM-DD` | `2026-08-29` |
| `{{time}}` | Current time in `HH:mm` | `14:30` |
| `{{datetime}}` | Full ISO timestamp | `2026-08-29 14:30` |
| `{{title}}` | Document title or note name | `Quantum Computing Notes` |
| `{{weekday}}` | Full name of day | `Saturday` |
| `{{yesterday}}`| Previous day `YYYY-MM-DD` | `2026-08-28` |
| `{{tomorrow}}` | Next day `YYYY-MM-DD` | `2026-08-30` |
| `{{uuid}}` | UUIDv4 string | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |

### 5.3 Backend Template Service API (`src-tauri/src/services/templates/`)

1. **`list_templates`:**
   - **Command:** `list_templates() -> Result<Vec<TemplateMetadata>, String>`
   - Scans `.stackmynd/templates/` and returns template names, paths, and descriptions extracted from YAML frontmatter `description` field.
2. **`apply_template`:**
   - **Command:** `apply_template(template_path: String, note_title: String) -> Result<String, String>`
   - Reads template file, interpolates all dynamic tokens, and returns prepared Markdown text.

### 5.4 Frontend Insertion Workflows

1. **Command Palette (`Cmd+K`):**
   - Type `Insert Template:` or select action from command menu.
   - Fuzzy search list of available templates with live previews.
   - Injects rendered template content at the current cursor position in Source / Split mode.
2. **New Note from Template (`Cmd+Alt+N`):**
   - Modal prompting for note title and template selection.
   - Creates new document pre-populated with evaluated template content.

---

## 6. Module 4: Infinite Text-Block Spatial Canvas

### 6.1 Spatial Thinking & Invariants

Stackmynd Canvas is a spatial 2D infinite whiteboard designed exclusively for text-first conceptual thinking, argument mapping, and note structure organization.
- **Strict Non-Media Invariant:** Canvas cards **ONLY** support text notes, Markdown blocks, and text stickies. No images, videos, audio, or PDFs are permitted.
- **Storage Protocol:** Canvas files are stored in the workspace with `.canvas.json` extension in standard UTF-8 JSON format.

### 6.2 File Format Specification (`<name>.canvas.json`)

```json
{
  "version": "1.0.0",
  "viewport": {
    "x": 0.0,
    "y": 0.0,
    "zoom": 1.0
  },
  "nodes": [
    {
      "id": "node-note-1",
      "type": "note",
      "x": 100,
      "y": 150,
      "width": 320,
      "height": 220,
      "path": "concepts/quantum_entanglement.md",
      "color": "indigo"
    },
    {
      "id": "node-block-1",
      "type": "block",
      "x": 500,
      "y": 150,
      "width": 280,
      "height": 160,
      "path": "physics/epr_paradox.md",
      "block_id": "^bk-89ae",
      "color": "blue"
    },
    {
      "id": "node-text-1",
      "type": "text",
      "x": 300,
      "y": 420,
      "width": 240,
      "height": 120,
      "content": "Key question: Does this violate locality?",
      "color": "amber"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-note-1",
      "target": "node-block-1",
      "label": "critiques",
      "from_side": "right",
      "to_side": "left"
    }
  ]
}
```

### 6.3 Canvas Architecture & 60 FPS Viewport

1. **Rendering Engine:**
   - HTML5 2D Canvas + virtualized SolidJS Card DOM overlay:
     - Background grid and connection arrows rendered on 2D `<canvas>` at 60 FPS.
     - Interactive cards rendered via fine-grained SolidJS DOM elements positioned via `transform: translate3d(x, y, 0) scale(zoom)`.
2. **Infinite Canvas Navigation:**
   - **Pan:** Middle-click drag, Space+Left-click drag, or trackpad 2-finger swipe.
   - **Zoom:** Mouse wheel with zoom-to-cursor center (range: 0.15x to 3.0x).
   - **Selection:** Click to select, Shift+Click for multi-selection, drag rubberband box to select area.
3. **Card Types & Interactions:**
   - **Note Card:** Live read-only preview of note content; double-click opens full document tab in editor.
   - **Block Card:** Live display of targeted `^bk-xxxx` block text; double-click jumps to note and scrolls to block.
   - **Text Sticky:** Inline editable Markdown thought bubble for annotations and section headings.
4. **Directed Connection Edges:**
   - Drag from handle dots on card borders (top, bottom, left, right) to another card to form a directed arrow.
   - Optional inline text label on the edge.
   - Cubic Bezier curve paths avoiding overlapping card bodies where possible.

---

## 7. Phase 3 Implementation Milestones

| Milestone | Scope | Key Deliverables | Target Version |
| :--- | :--- | :--- | :--- |
| **M13** | Block Transclusion & In-Place Embeds | Lexer AST plugin, `resolve_transclusion` IPC, circular guardrails, `<TransclusionContainer />` UI, Link Repair updates | `v1.4.0` |
| **M14** | Daily Notes & Interactive Journaling Engine | `.stackmynd/workspace.json` daily config, `get_or_create_daily_note` backend, Sidebar Calendar widget, `Cmd+Shift+D` shortcut, day navigation | `v1.5.0` |
| **M15** | Templates & Snippets System | `.stackmynd/templates/` storage, starter templates, variable interpolation engine (`{{date}}`, etc.), Command Palette insertion, New Note modal | `v1.6.0` |
| **M16** | Infinite Text-Block Spatial Canvas | `.canvas.json` specification, 2D pan/zoom viewport, Note/Block/Text cards, directed arrows, double-click editor navigation | `v1.7.0` |
| **M17** | P3 Integration, Quality Verification & Release | End-to-end integration, 6-step QA verification suite passing, documentation freeze, release tag `v2.0.0` | `v2.0.0` |

---

## 8. Verification & Quality Acceptance Criteria

Before declaring Phase 3 complete and preparing for release, the following strict checks must pass:
1. `cargo test --manifest-path src-tauri/Cargo.toml` with 100% test passes.
2. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` with zero warnings.
3. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` verified.
4. `pnpm tsc --noEmit` with zero type errors.
5. `pnpm test` (Vitest) passing all test suites.
6. `pnpm build` production build verified without warnings or bundle errors.
7. `pnpm tauri build --bundles app` verified for release package generation.

---

[ALL STACKMYND PHASE 3 SPECS COMPLETED, FROZEN AND READY FOR FULL ENGINEERING IMPLEMENTATION]
