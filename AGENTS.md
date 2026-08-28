# AGENTS.md — AI Agent & Automation Guidelines

This document establishes the official architectural constraints, development protocols, project conventions, and operational workflows for AI coding agents and autonomous assistants contributing to the **Stackmynd** codebase.

---

## 1. Project Overview & Architectural Mental Model

Stackmynd is a **local-first, multi-workspace, block-level Markdown knowledge base** built with **Tauri v2 + Rust + SolidJS + Tailwind CSS + SQLite (WAL mode) + Tantivy**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SolidJS Frontend Layer (src/)                             │
│   • Reactive Stores (Workspace, Tabs, Editor Mode, Inspector)               │
│   • 5-Area Spatial Grid (Title Bar, Left Sidebar, Editor, Right Panel, Bar) │
│   • Markdown Pipeline (remark AST, rehype, KaTeX math, Mermaid diagrams)   │
│   • Virtualized Folder & File Tree Component                                │
│   • Typed IPC Wrappers (src/lib/tauri/commands.ts, events.ts)               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Tauri v2 IPC Bridge (JSON Commands & Events)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    Rust Core Backend Layer (src-tauri/)                     │
│   • Workspace Management & Path Sandboxing (src-tauri/src/services/workspace)│
│   • File System Watcher & Self-Write Registry (notify-debouncer-mini)       │
│   • Atomic File I/O Engine (temp file -> fsync -> atomic rename)            │
│   • Markdown Lexer, Block Slicer & Link Repair Engine                       │
│   • SQLite Embedded Database (WAL mode, index-only in .stackmynd/index.db)  │
│   • Native Full-Text Search Engine (Tantivy in .stackmynd/search_index/)    │
│   • Local Workspace Recycle Bin (.stackmynd/trash/)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Absolute Non-Negotiable Invariants

All agents and contributors must strictly adhere to the following invariants. Any change violating these principles will be rejected immediately:

1. **Markdown Files on Disk are the Single Source of Truth:**
   - Every document is stored as a plain-text `.md` file in standard UTF-8 format on disk.
   - Never introduce proprietary binary wrappers, database storage for note bodies, or proprietary container formats.

2. **SQLite is Strictly an Ephemeral Index & Metadata Cache:**
   - **NEVER store article or note body text in SQLite tables.**
   - SQLite stores only structural metadata: file paths, timestamps, Blake3 hashes, block coordinates, tags, and link relationships.
   - The `.stackmynd/` directory can be deleted at any time without note content loss. Deleting `.stackmynd/index.db` must trigger an automatic full background re-index from the Markdown source files.

3. **Pure Note-Taking Engine (Strict Non-Media Scope):**
   - Stackmynd is exclusively designed for text, mathematical formulas (KaTeX), and algorithmic diagrams (Mermaid).
   - **Do NOT implement** image management, asset uploads, media attachment folders, audio/video preview players, or PDF viewers.

4. **Atomic File Write Protocol:**
   - Never overwrite document files directly in place.
   - Always write to a sibling temporary file (`.filename.tmp.<uuid>`), flush buffers to physical disk via `fsync` / `FlushFileBuffers`, and execute an atomic rename (`rename` / `MoveFileExW`) over the target file.

5. **Debounced Auto-Save & Watcher Self-Write Suppression:**
   - Frontend auto-save must be debounced to 800ms of typing inactivity.
   - Force save (`Cmd+S` / `Ctrl+S`) immediately flushes in-memory dirty buffers.
   - All internal saves must register the target file path and Blake3 content hash in the backend Self-Write Suppression Registry (1500ms lifespan) to prevent infinite re-indexing loops from filesystem watcher events.

6. **Automated Global Link & Block Reference Repair:**
   - When any file or folder is renamed or moved, the Link Repair Engine must locate all inbound wikilinks (`[[path]]`, `[[path#^blockid]]`) across the workspace and rewrite them atomically on disk.

7. **Multi-Workspace Complete Isolation:**
   - Each workspace owns an independent `.stackmynd/` state directory.
   - Databases, search indexes, session states, and trash folders are 100% isolated per workspace. Autocomplete, tags, and backlinks must never leak across workspace boundaries.

---

## 3. Reference Architecture: Lexora Reuse vs. Stackmynd Innovations

Stackmynd references [Lexora](https://github.com/BerryUIKI/Lexora.git) as a foundational baseline. Agents must understand what patterns to reuse and where Stackmynd fundamentally departs from Lexora.

### 3.1 Proven Lexora Patterns to Reuse
- **Window Shell & Controls:** Tauri v2 custom title bar, window dragging (`data-tauri-drag-region`), and native-style cross-platform window controls.
- **Frontend Architecture:** SolidJS fine-grained signals (`createSignal`, `createMemo`, `<Show>`, `<For>`) and Tailwind CSS styling.
- **Markdown & Diagram Engine:** Base remark/rehype parsing pipeline; KaTeX and Mermaid in-memory rendering with isolated error boundaries.
- **Virtual Scrolling:** Virtualized list rendering pattern for high-density directory trees and search results.
- **System Integrations:** Global keyboard shortcut dispatcher, theme management (dark/light mode without flicker), and basic Rust file I/O primitives.

### 3.2 Stackmynd Architectural Innovations (DO NOT Copy Lexora's Single-File Model)
- **Multi-Workspace Isolation:** Replaces Lexora's single-file ephemeral model with multi-workspace root directories and independent `.stackmynd/` stores.
- **Relational SQLite Index:** Introduces dedicated index tables (`workspaces`, `files`, `blocks`, `links`, `tags`, `file_tags`, `block_tags`, `recycle_bin`).
- **Native Tantivy FTS:** Replaces basic string scanning with Tantivy's native BM25 search engine over files and individual blocks.
- **Block-Level Knowledge Graph:** Implements deterministic `^bk-xxxx` block ID generation, disk anchoring, preview stripping, hover popovers, and pinpoint scroll jumps.
- **Tri-Mode Editor Viewport:** Supports Source Mode, Preview Mode, and Synchronized Split Mode with line-proportional scrolling.
- **Right Inspector Panel:** Provides bidirectional YAML frontmatter editing, forward links, backlinks (with "+ Link" for unlinked mentions), and block outline navigation.
- **Local Workspace Recycle Bin:** Soft-deletes files into `.stackmynd/trash/` with metadata tracking and one-click restore.

---

## 4. Git Workflow & Branch Protection Rules

Stackmynd enforces a strict branching strategy to maintain stability while enabling rapid engineering velocity.

```
       (Feature Complete)
feature/xyz ─────────────────────┐
  (branched from dev)            │ (PR / Self-Merge during rapid phase)
                                 ▼
dev ─────────────────────────────────────────────────────────────► (Integration)
                                                                 │
                                                                 │ (Release Tag)
main (PROTECTED) ────────────────────────────────────────────────┴► (Stable Release)
```

### 4.1 Branch Roles & Protection Invariants

1. **`main` Branch (Strictly Protected):**
   - Reserved strictly for production-ready, stable releases.
   - **Direct commits and direct pushes to `main` are strictly forbidden.**
   - All code entering `main` must come through validated release merges from `dev`.

2. **`dev` Branch (Active Integration Base):**
   - The primary integration branch for all ongoing development.
   - **All feature work must branch off `dev`.**
   - Direct work on `dev` without a feature branch is prohibited.

3. **Dedicated Feature Branches (`feature/*`, `fix/*`, `docs/*`, `refactor/*`):**
   - Every task, feature, or bug fix must take place on its own dedicated feature branch.
   - Naming convention:
     - `feature/<name>` — New functional capabilities.
     - `fix/<name>` — Bug fixes and stability patches.
     - `docs/<name>` — Documentation and specification updates.
     - `refactor/<name>` — Internal code restructuring without behavioral changes.
     - `perf/<name>` — Performance optimizations.
     - `test/<name>` — Test suite enhancements.

4. **Merging & Branch Cleanup Protocol:**
   - Once a feature is complete, verified, and passes all automated checks:
     1. Open a Pull Request into `dev`.
     2. **Rapid Iteration Phase Rule:** Agents and developers are **explicitly permitted to self-merge their own PRs into `dev`**.
     3. Merge the feature branch into `dev`.
     4. **Immediately delete the corresponding feature branch** upon merge completion to keep the repository clean.
   - **Post-MVP Transition:** Strict branch protection for `dev` (requiring external review and mandatory CI passes) will be enabled after the MVP has been formally accepted.

### 4.2 Conventional Commits Format
All commit messages must strictly follow the Conventional Commits 1.0.0 format:

```
<type>(<scope>): <short summary>

[optional detailed description explaining rationale and design decisions]

[optional issue reference, e.g., Closes #42]
```

- **Allowed Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- **Examples:**
  - `feat(block): implement deterministic ^bk-xxxx anchor generation`
  - `fix(watcher): suppress self-write events for atomic file saves`
  - `docs(specs): finalize UI layout specification for 5-area grid`
  - `refactor(db): optimize backlink queries using composite indexes`

---

## 5. Standard Step-by-Step Implementation Protocols

### 5.1 Adding a New Tauri Backend Command
1. **Service Layer:** Implement pure Rust business logic in `src-tauri/src/services/<service_name>.rs` with comprehensive unit tests.
2. **Data Models:** Define serialized and deserialized structs in `src-tauri/src/models/` using `#[derive(Serialize, Deserialize)]`.
3. **Command Handler:** Create the command handler function in `src-tauri/src/commands/<command_name>.rs` annotated with `#[tauri::command]`.
4. **Command Registration:** Register the command in `tauri::generate_handler![...]` inside `src-tauri/src/lib.rs`.
5. **Typed Frontend Wrapper:** Add a strongly-typed TypeScript function in `src/lib/tauri/commands.ts` using `invoke<T>()`.
6. **Capabilities Scoping:** Ensure the command or plugin is permitted in `src-tauri/capabilities/default.json`.

### 5.2 Modifying SQLite Database Schemas
1. **Never alter existing tables destructively:** Always write an additive schema migration.
2. Add migration step to `src-tauri/src/services/db/migrations.rs` and increment `schema_version`.
3. Verify that index rebuild logic (`src-tauri/src/services/db/rebuild.rs`) includes the new table or columns in clean full-rebuild runs.
4. Ensure no note body text is persisted in any new database columns.

### 5.3 Developing Frontend SolidJS Components
1. Place reusable UI elements in `src/components/common/`.
2. Keep state reactive and fine-grained; avoid large monolithic stores when local signals suffice.
3. For heavy lists (file tree, search results, block lists), use virtualized scrolling to maintain 60 FPS performance.
4. Integrate Tailwind CSS classes consistently with the dark/light design token palette.

---

## 6. Verification & Quality Assurance Suite

Before committing code or submitting a PR to `dev`, agents must run and pass the following quality verification commands:

```bash
# 1. Rust Unit & Integration Tests
cargo test --manifest-path src-tauri/Cargo.toml

# 2. Rust Code Quality & Linting
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 3. Rust Code Formatting Check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# 4. Strict TypeScript Type Checking
pnpm tsc --noEmit

# 5. Frontend Unit Tests
pnpm test

# 6. Production Frontend Build Verification
pnpm build

# 7. Production Tauri Package Build (when validating milestones)
pnpm tauri build
```
