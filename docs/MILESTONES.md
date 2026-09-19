# Stackmynd — Project Milestones & Implementation Schedule

This document tracks the phased implementation milestones, acceptance criteria, deliverables, and completion status for **Stackmynd** (Local-First Multi-Workspace Block-Level Markdown Knowledge Base).

---

## Milestone Progress Summary

| Milestone | Scope | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **M1** | Project Scaffolding & Foundational Architecture | `v0.1.0` | ✅ Completed |
| **M2** | Workspace Management, Atomic File I/O & Watcher Engine | `v0.2.0` | ✅ Completed |
| **M3** | SQLite Ephemeral Index Layer & Schema Migrations | `v0.3.0` | ✅ Completed |
| **M4** | Markdown Lexer, Block Slicer & Link Repair Engine | `v0.4.0` | ✅ Completed |
| **M5** | Native Tantivy Full-Text Search Engine | `v0.5.0` | ✅ Completed |
| **M6** | 5-Area Spatial Grid & Navigation Shell | `v0.6.0` | ✅ Completed |
| **M7** | Tri-Mode Editor & Synchronized Split View | `v0.7.0` | ✅ Completed |
| **M8** | Right Side Panel Inspector & Block Knowledge Graph | `v0.8.0` | ✅ Completed |
| **M9** | Search Command Palette, E2E Integration & Verification | `v1.0.0` | ✅ Completed |
| **M10** | Force-Directed Knowledge Graph Visualizer | `v1.1.0` | ✅ Completed |
| **M11** | Embedded Git Version Control Engine | `v1.2.0` | ✅ Completed |
| **M12** | P2 Integration, Polish & Quality Verification | `v1.3.0` | ✅ Completed |
| **M13** | Block Transclusion & In-Place Embeds | `v1.4.0` | ✅ Completed |
| **M14** | Daily Notes & Interactive Journaling Engine | `v1.5.0` | ✅ Completed |
| **M15** | Templates & Snippets System | `v1.6.0` | ✅ Completed |
| **M16** | Infinite Text-Block Spatial Canvas | `v1.7.0` | ✅ Completed |
| **M17** | P3 Integration, Quality Verification & Release | `v2.0.0` | ✅ Completed |
| **M18** | Interactive Authoring Polish, Wikilink Autocomplete & Context Menus | `v0.1.0` | ✅ Completed |
| **M19** | Comprehensive UX & Interaction Polish (Ergonomics & Accessibility) | `v0.1.0` | ✅ Completed |
| **M20** | External Document Export Suite (HTML, Native PDF/Print, Clean Markdown) | `v0.1.0` | ✅ Completed |

---

## Detailed Milestone Specifications

### Milestone 1: Project Scaffolding & Foundational Architecture
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] SolidJS + Vite 6 + Tailwind CSS v4 frontend foundation.
  - [x] TypeScript strict mode configuration and path aliases (`@/*`).
  - [x] Tauri v2 configuration (`tauri.conf.json`, `capabilities/default.json`) with frameless custom window.
  - [x] Rust core backend scaffolding (`src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `Cargo.toml`).
  - [x] Basic IPC handshake (`ping` command) and verification tests.

### Milestone 2: Workspace Management, Atomic File I/O & Watcher Engine
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Multi-workspace registration, root path validation, and `.stackmynd/` provisioning (`workspace.json`, `session.json`, `trash/`).
  - [x] Atomic file write engine (`.filename.tmp.<uuid>` -> `fsync` -> atomic rename).
  - [x] File system watcher (`notify-debouncer-mini`) with 1500ms Blake3 Self-Write Suppression Registry.
  - [x] Tauri IPC commands: `open_workspace`, `create_workspace`, `list_workspaces`, `read_directory`, `read_file`, `write_file_atomic`, `delete_to_trash`, `restore_from_trash`.
  - [x] Typed TypeScript IPC wrappers (`src/lib/tauri/commands.ts`, `events.ts`).

### Milestone 3: SQLite Ephemeral Index Layer & Schema Migrations
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Embedded SQLite engine with WAL mode and pragmas (`journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`).
  - [x] Table schema migrations: `workspaces`, `files`, `blocks`, `links`, `tags`, `file_tags`, `block_tags`, `recycle_bin`.
  - [x] Incremental synchronization engine with Blake3 hash checks and diff updates.
  - [x] Full workspace rebuild pipeline with atomic database swap (`index.db.rebuild` -> `index.db`).

### Milestone 4: Markdown Lexer, Block Slicer & Link Repair Engine
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Semantic block parser partitioning notes into discrete blocks (headings, paragraphs, lists, quotes, tables, code, math).
  - [x] Deterministic `^bk-xxxx` block ID generator, validator, and anchor insertion.
  - [x] Roundtrip YAML frontmatter parser preserving comments, order, and indentation.
  - [x] Bi-directional link extractor (`[[note]]`, `[[note#^blockid]]`, standard links, `#tags`).
  - [x] Global Link Repair Engine updating all inbound wikilinks upon file/folder rename or move.

### Milestone 5: Native Tantivy Full-Text Search Engine
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Tantivy schema and index engine located at `.stackmynd/search_index/`.
  - [x] Background indexing queue worker with debounced segment commits.
  - [x] Query parser supporting boolean operators (`AND`, `OR`, `NOT`) and field scopes (`title:`, `path:`, `tag:`, `block:`).
  - [x] BM25 relevance ranking with boosting: title (3.0x), headings (2.2x), tags (2.0x), body (1.0x).

### Milestone 6: 5-Area Spatial Grid & Navigation Shell
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Area 1: Custom Top Title Bar (traffic lights / window controls, workspace dropdown, view mode controls, search trigger, theme toggle).
  - [x] Area 2: Left Resizable/Collapsible Sidebar (workspace switcher, new note/folder actions, virtualized file tree, trash anchor).
  - [x] Area 3: Central Main Tab Strip (multi-tabs, dirty badges, close buttons, middle-click close, breadcrumbs).
  - [x] Area 5: Bottom Status Bar (workspace status, indexing indicator, word count, block count, cursor line/col, save status).
  - [x] Resizable splitter dividers with snapping and keyboard shortcuts (`Cmd+B`, `Cmd+Shift+B`).
  - [x] Session layout persistence in `.stackmynd/session.json`.

### Milestone 7: Tri-Mode Editor & Synchronized Split View
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Mode 1: Source Mode (monospaced editor, line numbers, visible frontmatter & `^bk-xxxx` anchors).
  - [x] Mode 2: Preview Mode (rendered typography, hidden `^bk-xxxx` anchors with `data-block-id`, KaTeX math, Mermaid diagrams with error boundaries).
  - [x] Mode 3: Sync Split Mode (dual-pane view with line-proportional synchronized scrolling).
  - [x] 800ms debounced auto-save engine + manual `Cmd+S` / `Ctrl+S` force save.
  - [x] External modification detection & 3-way conflict resolution banner.

### Milestone 8: Right Side Panel Inspector & Block Knowledge Graph
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Tab 1: Metadata Panel (visual frontmatter form for text, number, boolean, tags, date, lists; bidirectional sync).
  - [x] Tab 2: Outlinks Panel (forward notes, blocks, external URLs, broken link badges).
  - [x] Tab 3: Backlinks Panel (linked mentions with contextual snippets; unlinked mentions with "+ Link" button).
  - [x] Tab 4: Block Outline Panel (hierarchical heading tree, block anchor badges, click-to-jump, copy reference, active block scrollspy).
  - [x] Hover popover preview cards (300ms delay) and smooth animated scroll jumps.

### Milestone 9: Search Command Palette, E2E Integration & Verification
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Global Command Palette (`Cmd+K` / `Ctrl+K`): quick search across titles, contents, blocks, and tags.
  - [x] End-to-end multi-workspace switching and local recycle bin restore/purge.
  - [x] Complete test suite execution (`cargo test`, `cargo clippy`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build`).
  - [x] Final documentation update and acceptance verification.

### Milestone 10: Force-Directed Knowledge Graph Visualizer
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Backend graph topology extraction commands (`get_workspace_graph_data`, `get_local_graph_data`).
  - [x] Canvas2D 60FPS velocity-Verlet physics engine with link attraction, charge repulsion, and center gravity.
  - [x] Global Graph View with pan/zoom, node dragging, degree scaling, and HUD controls.
  - [x] Local Graph Inspector widget showing active note's 1-hop and 2-hop neighborhood.
  - [x] Node interaction: hover highlights, hover card preview, click-to-navigate.

### Milestone 11: Embedded Git Version Control Engine
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Backend Git service (`git_status`, `git_log`, `git_diff`, `git_commit`, `git_list_branches`, `git_checkout_branch`).
  - [x] TitleBar / StatusBar Git indicator showing active branch and uncommitted change count.
  - [x] Git Management Modal (`Cmd+Shift+G`) with Changes list, inline unified diff viewer, and commit form.
  - [x] Commit history timeline viewer and branch switcher.

### Milestone 12: P2 Integration, Polish & Quality Verification
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Global shortcuts (`Cmd+G` for Graph, `Cmd+Shift+G` for Git).
  - [x] File watcher auto-refresh on Git branch checkout and graph topology changes.
  - [x] Complete test suite execution (`cargo test`, `cargo clippy`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build`).
  - [x] Phase 2 documentation freeze and verification report.

### Milestone 13: Block Transclusion & In-Place Embeds
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Remark AST plugin parsing `![[note]]`, `![[note#^bk-xxxx]]`, and `![[note#Heading]]`.
  - [x] Rust backend IPC command `resolve_transclusion`.
  - [x] Circular dependency detection and 3-level recursion depth limit.
  - [x] Frontend `<TransclusionContainer />` rendering with live Preview, source jump link, and copy reference button.
  - [x] Automated link repair updates for transclusion syntax.

### Milestone 14: Daily Notes & Interactive Journaling Engine
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] `.stackmynd/workspace.json` daily notes configuration schema.
  - [x] Rust backend `get_or_create_daily_note` and `list_daily_notes` commands.
  - [x] Sidebar collapsible mini-calendar widget with note existence dots.
  - [x] Global shortcut `Cmd+Shift+D` to open/create today's note.
  - [x] Sequential temporal navigation arrows (`◀ Yesterday`, `Tomorrow ▶`) in document header.

### Milestone 15: Templates & Snippets System
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Template metadata schema & directory provisioning (`.stackmynd/templates/`).
  - [x] Rust backend `list_templates` and `apply_template` commands.
  - [x] Template selector & live preview modal (`TemplateModal.tsx`).
  - [x] Variable interpolation engine (`{{date}}`, `{{title}}`, `{{weekday}}`, `{{yesterday}}`, `{{tomorrow}}`, `{{uuid}}`).
  - [x] Direct cursor insertion and "New Note from Template" workflow with `Cmd+Alt+N`.

### Milestone 16: Infinite Text-Block Spatial Canvas
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] `.canvas.json` schema and atomic read/save engine.
  - [x] Link repair integration for canvas nodes when documents are moved/renamed.
  - [x] Spatial Canvas 2D infinite viewport with 60 FPS pan and zoom.
  - [x] Directed cubic bezier connecting arrows with arrowheads.
  - [x] Card components (File note, Text stickies, Block references) with double-click to open.

### Milestone 17: P3 Integration, Quality Verification & Release
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Full Phase 3 end-to-end integration across transclusion, daily notes, templates, and spatial canvas.
  - [x] Strict invariant verification (source of truth on disk, non-media scope, atomic file write, self-write suppression).
  - [x] Full automated test pass (`cargo test`, `cargo clippy`, `cargo fmt`, `pnpm tsc`, `pnpm test`, `pnpm build`).
  - [x] Version maintained at development baseline `0.1.0` pending official user release notification.

### Milestone 18: Interactive Authoring Polish, Wikilink Autocomplete & Context Menus
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] Interactive task list toggling in Preview Mode: clicking checkboxes updates Markdown source on disk.
  - [x] Inline `[[` Wikilink and Block Autocomplete in Source Editor with keyboard navigation (Arrow Up/Down, Enter/Tab).
  - [x] Sleek Context Menu on File Tree (Rename, Delete to Trash, Reveal in File Manager, Copy Relative Path, New Note/Folder Inside).
  - [x] Tab Context Menu (Close Others, Close to the Right, Copy Path) & HTML5 drag-and-drop tab reordering.

### Milestone 19: Comprehensive UX & Interaction Polish (Ergonomics & Accessibility)
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] **TitleBar & CalendarWidget**: Enlarged hit targets (`p-1.5`), added explicit close button ("✕"), Escape key dismiss, and comprehensive `aria-label` tags.
  - [x] **Workspace Modal**: Added Escape key & backdrop click dismissal, polished native folder picker button with focus ring and accessibility labels.
  - [x] **SourceEditor Autocomplete**: Implemented dynamic dropdown positioning (above/below cursor depending on editor viewport height), `Ctrl+Space` manual trigger, and max-height scrolling.
  - [x] **FileTree UX**: Added Escape key handler for context menu, and robust name validation (prohibiting slashes and preventing duplicate note collision on rename).
  - [x] **TabStrip Ergonomics**: Added visible drag-over outline/feedback for tab reordering, full file path tooltips, Escape dismiss for tab menu, and accessibility attributes.
  - [x] **Task List Checkbox Accessibility**: Added `aria-label="Toggle task"` and interactive pointer styling on rendered Markdown task checkboxes.

### Milestone 20: External Document Export Suite (HTML, Native PDF/Print, Clean Markdown)
- **Status:** ✅ Completed
- **Key Deliverables:**
  - [x] **Rust Core Export Service**: `export_service::export_file_to_disk` and `commands::export::export_file` IPC with unit testing.
  - [x] **Standalone HTML Export**: Single-file HTML generation with embedded modern typography, KaTeX formula stylesheets, callouts, tables, and optional frontmatter metadata card.
  - [x] **Zero-Dependency Native PDF & Print**: Hidden iframe print mechanism with `@media print` rules, margin controls, and page-break optimization invoking system print dialog.
  - [x] **Flattened Clean Markdown**: Resolves and inlines transcluded blocks (`![[...]]`) and optionally strips block anchors (`^bk-xxxx`).
  - [x] **Omni-Channel UI Invocations**: Accessible via `Cmd+E` global shortcut, TitleBar export icon button, Tab context menu, FileTree right-click menu, and `Cmd+K` command palette.
