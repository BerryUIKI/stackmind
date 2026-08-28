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
