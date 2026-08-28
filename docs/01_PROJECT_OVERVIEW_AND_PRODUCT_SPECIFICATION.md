# Document 01: Project Overview & Product Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Executive Summary & Vision

Stackmynd is a high-performance, local-first, block-structured knowledge management system engineered for power users, researchers, and engineers. It unites the atomic granularity of outline/block-based knowledge graphs with the absolute data sovereignty and interoperability of standard, human-readable Markdown files stored directly on the local filesystem.

### 1.1 Core Tenets & Philosophy

1. **The Markdown File is the Absolute Single Source of Truth**
   - Every note is persisted directly as a plain text `.md` file on the physical storage device.
   - There are no proprietary container formats, no binary blobs wrapping content, and no hidden database records holding note bodies.
   - Any modification made by external tools (such as VSCode, Typora, Neovim, or terminal shell scripts) is treated as first-class input and faithfully ingested.

2. **SQLite is Strictly an Index and Metadata Cache**
   - The SQLite database acts purely as a secondary, disposable lookup acceleration layer.
   - SQLite never stores note body text. It stores only block indexes, forward/backlinks, frontmatter keys, and file path hierarchies.
   - If the SQLite database is deleted or corrupted at any moment, it can be 100% reconstructed from scratch by re-indexing the Markdown files without any data loss.

3. **Atomic Block Architecture Without Proprietary Syntax**
   - Notes are composed of discrete semantic blocks (paragraphs, list items, headings, blockquotes, code fences, table blocks, math environments).
   - Blocks receive a deterministic, unobtrusive block identifier (`^bk-xxxx`) appended to the line.
   - Block references (`[[filename#^blockid]]`) provide transclusion and precise navigational jumps while maintaining standard CommonMark / GitHub Flavored Markdown compatibility.

4. **Zero Vendor Lock-In & Total File Freedom**
   - A user can inspect, copy, archive, or edit their entire knowledge base using standard operating system utilities.
   - If Stackmynd is uninstalled, the entire directory tree remains fully structured, readable, and functional in any plain-text environment.

5. **Pure Knowledge System (Strict Non-Media Scope)**
   - Stackmynd is strictly a text-and-structure note-taking engine.
   - The application does not manage, upload, store, optimize, compress, or preview binary media assets, image galleries, audio, video, or arbitrary file attachments. Notes focus exclusively on Markdown text, mathematical equations (KaTeX), and algorithmic diagrams (Mermaid).

---

## 2. Competitive Positioning & Differentiation

| Feature Vector | Stackmynd | Obsidian | Logseq | Notion | Lexora (Base Reference) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Data Storage Architecture** | Disk Markdown + Ephemeral Index DB | Disk Markdown + Proprietary Cache | Local Markdown/Org-mode or DB-first | Remote Cloud Database | Single-file ephemeral open |
| **Storage of Note Body** | 100% on filesystem | 100% on filesystem | Hybrid file/database | Remote server only | Ephemeral on filesystem |
| **Block Granularity** | Native deterministic `^bk-xxxx` block ID indexing | Ad-hoc block ID appended on link creation | Native block-tree representation | Native proprietary block units | Document-level only |
| **Multi-Workspace Isolation** | Fully concurrent, isolated workspace roots | Vault-based (one window per vault) | Graph-based switching | Workspace switcher | Single-file / folder view |
| **Technology Stack** | Tauri v2 + Rust + SolidJS (Native speed) | Electron + JavaScript (High memory) | ClojureScript + Electron | Web / Electron | Tauri v2 + Rust + SolidJS |
| **Media / Asset Scope** | Zero media assets (Pure text/math/code/diagrams) | Heavy asset & attachment management | Asset folder management | Heavy media management | Inline local preview |
| **Full-Text Search Engine** | Native Rust Tantivy (Zero Electron overhead) | JavaScript search index | In-memory Datomic / Datascript | Server-side elasticsearch | Basic string scan |
| **External Editor Freedom** | First-class bi-directional sync & link repair | Supported (requires index rebuild) | Prone to block-formatting conflicts | Impossible (closed ecosystem) | Supported (single document) |

### 2.1 Core Competitive Advantages

1. **Extreme Native Performance & Minimal Resource Footprint**
   - Built on Tauri v2 and SolidJS, eliminating the multi-gigabyte memory and CPU penalties associated with Chromium-based Electron applications.
   - Zero Virtual DOM overhead; SolidJS provides direct fine-grained DOM reactivity.
   - Rust manages file system interaction, SQLite transactions, and Tantivy search execution without blocking the UI thread.

2. **Automated Link & Block Integrity Engine**
   - Renaming or moving any file or nested folder triggers an instantaneous global graph refactoring pass.
   - All internal wikilinks, block references, and relative paths across the entire workspace are updated atomically on disk.

3. **Deterministic Frontmatter Synchronization**
   - Bidirectional synchronization between YAML Frontmatter blocks in the Markdown file and the right-side visual metadata panel.
   - Changes made in the GUI update the file frontmatter immediately with exact line-level AST preservation.

---

## 3. Scope Boundaries: MVP (Phase 1) vs Phase 2

To ensure rapid delivery, absolute architectural stability, and a zero-defect launch, functional boundaries are strictly frozen.

### 3.1 In-Scope for Phase 1 (MVP Hard Spec)

1. **Multi-Workspace Management:**
   - Ability to add, open, switch between, and remove multiple independent workspaces.
   - Complete process and database isolation: each workspace maintains its own `.stackmynd/` state directory.
2. **Filesystem Integration:**
   - 1:1 reflection of disk directories in the sidebar folder tree.
   - Recursive directory traversal, file/folder creation, renaming, moving, and soft deletion to a local workspace recycle bin.
   - External file watcher using Rust notify with debounce and external collision detection.
3. **Core Markdown & Block Engine:**
   - CommonMark + GitHub Flavored Markdown (GFM) compliance via custom remark/rehype pipeline.
   - Automated deterministic BlockID generation (`^bk-xxxx`), invisible in preview mode.
   - Block reference resolution (`[[filename#^blockid]]`) with hover preview popovers and synchronized scroll navigation.
   - In-memory KaTeX mathematical formula rendering.
   - In-memory Mermaid flowchart and diagram rendering with syntax error boundaries.
4. **Tri-Mode Editing System:**
   - Source Mode: Pure monospaced plain text editor with raw Markdown syntax and Frontmatter visible.
   - Preview Mode: Rich HTML rendered output with interactive links and invisible block anchors.
   - Sync Split Mode: Dual-pane layout featuring synchronized proportional scrolling between raw editor and rendered preview.
5. **Auto-Save & Persistence Engine:**
   - 800ms debounced auto-save on typing idle.
   - Force-save shortcut (`Cmd+S` / `Ctrl+S`) triggering immediate atomic write.
   - UI layout state persistence (sidebar width, panel states, active tab sessions).
6. **Indexing & Search Engine:**
   - SQLite embedded database in WAL mode for metadata, tags, blocks, and link graph.
   - Tantivy native full-text search indexing title, body, and discrete blocks.
7. **Auxiliary Panels:**
   - Right-side collapsible inspector: YAML Frontmatter editor, forward references, backlink references, block outline index.
   - Global status bar indicating active workspace, current word/block count, index status, and save state.

### 3.2 Out-of-Scope (Strictly Deferred to Phase 2)

1. **Version Control Integration:**
   - Embedded Git repository management, commit tracking, branch switching, and remote pushing are strictly excluded from Phase 1.
2. **Cloud Synchronization & Collaboration:**
   - Peer-to-peer syncing (CRDTs), web sockets, cloud relays, multi-user simultaneous editing, and user account systems are excluded.
3. **Media & Binary Asset Management:**
   - Image uploads, local media caches, PDF annotation viewers, audio playback, and video embeds are excluded.
4. **Plugin Ecosystem & Extensibility:**
   - Third-party JavaScript/Wasm plugin runtimes, marketplace APIs, and user scripts are excluded.
5. **Graph Visualizer:**
   - 2D/3D force-directed canvas graph visualization of linked notes is deferred to Phase 2.
6. **Mobile Platform Targets:**
   - iOS and Android shell compilations are excluded; Phase 1 targets macOS, Windows, and Linux desktop environments exclusively.

---

## 4. Global Project Constraints & Guardrails

### 4.1 System & Runtime Constraints

1. **Target Operating Systems:**
   - macOS: Apple Silicon (ARM64) and Intel (x86_64), macOS 12 (Monterey) and newer.
   - Windows: Windows 10/11 (x86_64).
   - Linux: Ubuntu 22.04 LTS+, Fedora 38+, Arch Linux (glibc 2.35+).
2. **Binary Footprint:**
   - Installed application bundle target size: < 35 MB.
   - Idle memory consumption: < 90 MB RAM with an active 5,000-note workspace open.
3. **Execution Latency Budgets:**
   - Cold application startup to interactive UI: < 150 ms.
   - Document tab switch latency: < 16 ms (1 frame at 60Hz).
   - Keypress to input dispatch: < 8 ms.
   - Tantivy search response over 50,000 blocks: < 30 ms.

### 4.2 Data Integrity & Fault Tolerance Guardrails

1. **Atomic File Write Protocol:**
   - Direct overwriting of open file handles is strictly prohibited.
   - All disk saves must write to a temporary file (`<filename>.tmp.<uuid>`) in the same directory, synchronize to physical disk via `fsync`, and execute an atomic rename (`rename`/`MoveFileEx`) over the target file.
2. **Non-Destructive Index Recovery:**
   - The `.stackmynd/` directory can be deleted at any time by the user or an external process without risking note loss.
   - On detecting database corruption (e.g., SQLite `SQLITE_CORRUPT` error), Stackmynd must cleanly quarantine the damaged database, create a fresh SQLite file, and launch a background rebuild worker.
3. **Path Portability & Normalization:**
   - All internal links stored in Markdown files must use forward slashes (`/`) regardless of the host operating system.
   - Links must be relative to the workspace root or relative to the containing document, preventing platform-specific path breakage when migrating workspaces between Windows and UNIX systems.
