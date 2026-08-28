# Document 02: System Full Architecture Design

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Architectural Overview & The 3-Layer Paradigm

Stackmynd is structured as a strict three-tier architecture that guarantees absolute user data sovereignty, zero data loss, and high-performance querying without storing note content in proprietary database structures.

```
+-------------------------------------------------------------------------+
| Layer 1: Source-of-Truth Layer (Disk Filesystem)                        |
| - Plain text .md files stored in workspace directories                  |
| - Standard CommonMark / GFM syntax                                      |
| - Inline Block IDs (^bk-xxxx) and YAML Frontmatter headers              |
+-------------------------------------------------------------------------+
                                    |
                                    | (File Watcher / File I/O Engine)
                                    v
+-------------------------------------------------------------------------+
| Layer 2: Ephemeral Index & Acceleration Layer (In-Memory / SQLite / FTS) |
| - SQLite Embedded Database (.stackmynd/index.db in WAL mode)            |
| - Block Table, Link Graph, Metadata/Tag Index                           |
| - Tantivy Native Full-Text Search Engine (.stackmynd/search_index/)     |
| - Fully disposable: 100% regenerable from Layer 1 at any moment        |
+-------------------------------------------------------------------------+
                                    |
                                    | (Tauri v2 IPC Commands & Events)
                                    v
+-------------------------------------------------------------------------+
| Layer 3: Presentation & Runtime State Layer (SolidJS + Tailwind UI)     |
| - Reactive State Stores (Workspaces, Active Tabs, View Modes)           |
| - Tri-Mode Editor (Source, Preview, Synchronized Split)                 |
| - Right-Side Metadata, Backlink, and Block Outline Panels               |
| - User Session State (.stackmynd/session.json)                          |
+-------------------------------------------------------------------------+
```

### 1.1 Layer 1: Source-of-Truth Layer (Filesystem)
- Every note is an independent file on physical disk using the `.md` extension.
- File encoding is strictly UTF-8 without byte-order marks (BOM).
- Line endings are normalized to Unix format (`\n`) upon save while preserving incoming Windows (`\r\n`) during reading until modified.
- Note contents include raw Markdown syntax, optional standard YAML Frontmatter blocks delineated by triple dashes (`---`), and deterministic block anchor tags (`^bk-xxxx`) placed at the end of block boundaries.
- No application state or external metadata is written to the Markdown files except standard frontmatter and block anchors.

### 1.2 Layer 2: Ephemeral Index & Acceleration Layer (SQLite + Tantivy)
- Resides inside the private `.stackmynd/` hidden directory at the root of each workspace.
- Implements an index-only database model: file bodies and note texts are strictly forbidden from being stored in SQLite tables.
- Stores structural metadata: file path hierarchies, Blake3 content hashes, file modification times, block locations, tag mappings, and bi-directional link graphs.
- Houses the Tantivy full-text search index, enabling instant substring, prefix, and term queries across hundreds of thousands of blocks.
- Guaranteed disposable: if `.stackmynd/index.db` is removed, the engine automatically detects missing indexes and executes a full rebuild in the background without UI interruption.

### 1.3 Layer 3: Presentation & Runtime State Layer (SolidJS UI)
- Runs inside the Tauri v2 webview shell using SolidJS for zero-virtual-DOM, fine-grained reactive updates.
- Maintains runtime view state: open tabs, active document selection, scroll synchronization offsets, and panel visibility toggles.
- Persists session layout configuration (`.stackmynd/session.json`) containing active tab lists, panel widths, and editor modes across application reboots.

---

## 2. Module Hierarchy & Dependencies

The system is separated into the Rust Backend Core and the SolidJS Frontend Client, communicating across an asynchronous Tauri v2 IPC bridge.

```
                    +--------------------------------+
                    |      SolidJS Frontend UI       |
                    | (Components, Stores, remark)   |
                    +--------------------------------+
                                   ^
                                   | (Tauri IPC Invoke / Events)
                                   v
+-------------------------------------------------------------------------+
|                           Rust Core Backend                             |
|                                                                         |
|  +---------------------+  +--------------------+  +------------------+  |
|  |  Workspace Manager  |  | File Watcher Engine|  | Markdown Engine  |  |
|  |  - Root Registry    |  | - notify-debouncer |  | - Block Slicer   |  |
|  |  - Path Isolation   |  | - Event Filter     |  | - Link Extractor |  |
|  +---------------------+  +--------------------+  +------------------+  |
|             |                       |                       |           |
|             v                       v                       v           |
|  +---------------------+  +--------------------+  +------------------+  |
|  | SQLite Index Engine |  | Tantivy Search FTS |  | Link Repair Hub  |  |
|  | - WAL Connection    |  | - Schema Builder   |  | - Global Rename  |  |
|  | - Schema Migrations |  | - Background Writer|  | - AST Refactor   |  |
|  +---------------------+  +--------------------+  +------------------+  |
|                                     |                                   |
|                                     v                                   |
|                      +-----------------------------+                    |
|                      |   Atomic File I/O Engine    |                    |
|                      |   - Temp file + fsync       |                    |
|                      |   - Atomic rename swap      |                    |
|                      +-----------------------------+                    |
+-------------------------------------------------------------------------+
```

### 2.1 Backend Subsystems (Rust)

1. **Workspace Manager:**
   - Validates, registers, and tracks active workspace root directories.
   - Enforces workspace isolation: cross-workspace references are sandboxed or explicitly flagged.
   - Instantiates dedicated database connection pools and Tantivy searcher instances per workspace.

2. **File System Engine & Watcher:**
   - Employs `notify` and `notify-debouncer-mini` with platform-native event backends (FSEvents on macOS, ReadDirectoryChangesW on Windows, inotify on Linux).
   - Filters redundant operating system events, temporary file creations, and system dotfiles.
   - Maintains an internal "Self-Write Suppression Registry" to ignore file watcher events generated by Stackmynd's own atomic saves, preventing infinite feedback loops.

3. **Markdown AST & Block Slicer:**
   - Ingests raw UTF-8 file content and produces structured block tokens without altering formatting.
   - Generates deterministic 8-character alphanumeric Block IDs (`^bk-[a-z0-9]{4,8}`).
   - Extracts YAML Frontmatter properties into structured key-value maps.
   - Discovers all forward internal links (`[[target]]` and `[[target#^blockid]]`).

4. **Database & Index Engine:**
   - Manages SQLite connection pools via `r2d2_sqlite` or native `rusqlite`.
   - Applies SQLite Pragmas: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `temp_store = MEMORY`.
   - Executes atomic batched updates for incremental note changes and transactional bulk updates during full rebuilds.

5. **Tantivy Search Service:**
   - Maintains an on-disk Tantivy index per workspace.
   - Manages background indexing workers: documents are queued into an asynchronous multi-producer single-consumer (MPSC) channel to prevent I/O blocking.

6. **Link Repair Engine:**
   - Coordinates multi-file refactoring when a note or directory is moved or renamed.
   - Performs atomic in-place AST link rewrites across all referencing files on disk.

7. **Atomic File I/O Engine:**
   - Writes all data to a sibling temporary file (`.filename.tmp.<uuid>`).
   - Issues an operating-system level `fsync` / `FlushFileBuffers` to ensure physical persistence.
   - Swaps the temporary file onto the target path via atomic file system rename (`rename` on POSIX, `MoveFileExW` on Windows).

### 2.2 Frontend Subsystems (SolidJS)

1. **Root Store & Workspace Context:**
   - Manages the collection of open workspaces, active workspace selection, and workspace metadata.
2. **Tab & Session Coordinator:**
   - Tracks open document tabs, dirty (unsaved) status, cursor position memory, and tab history navigation.
3. **Editor Surface Module:**
   - Renders the Source Code editor, Preview pane, and Synchronized Split layout.
   - Coordinates line-to-line proportional scroll mapping between source text and rendered preview.
4. **Markdown Render Pipeline (remark/rehype):**
   - SolidJS-integrated rendering pipeline supporting GFM tables, strikethrough, task lists.
   - KaTeX integration for math blocks (`$$...$$`) and inline math (`$...$`).
   - Mermaid diagram integration with isolated SVG render sandboxes and syntax error boundaries.
5. **Auxiliary Panels:**
   - Left Sidebar: Workspace switcher, tree view, virtual list scroller for directories with thousands of files.
   - Right Inspector: Editable YAML Frontmatter table, forward link list, backlink references list, document block outline.

---

## 3. End-to-End Operational Flows & IPC Protocol

All IPC communication between frontend and backend uses strongly typed JSON payloads over Tauri v2 `invoke` commands and asynchronous window events.

### 3.1 Document Open Flow
1. User clicks a note in the folder tree or triggers navigation from a search result.
2. Frontend checks if a tab is already open for the given path. If open, focus switches to that tab immediately.
3. If not open, frontend issues IPC command: `open_document(workspace_id, relative_path)`.
4. Rust backend validates that `relative_path` resides strictly within the workspace root boundary (preventing directory traversal attacks).
5. Rust backend reads raw file content using streaming UTF-8 validation.
6. Rust backend queries SQLite for file metadata, block list, forward links, and backlinks.
7. Backend returns unified payload: `{ relative_path, raw_content, mtime, frontmatter, blocks, backlinks }`.
8. Frontend instantiates tab state, displays raw Markdown in editor, begins parsing AST for preview, and populates the right-side inspector panel.

### 3.2 Debounced Auto-Save & Atomic Flush Flow
1. User types in the active editor pane.
2. Frontend immediately marks tab as `is_dirty = true` and updates the unsaved indicator bullet in the tab title bar.
3. Frontend restarts an 800ms debounce timer.
4. When the 800ms idle threshold expires (or user presses `Cmd+S` / `Ctrl+S`), the save pipeline engages:
   - Frontend collects the complete raw string buffer from the editor.
   - Frontend registers a pending save nonce.
   - Frontend invokes IPC command: `save_document(workspace_id, relative_path, raw_content, expected_mtime)`.
5. Rust Backend:
   - Registers target path in the "Self-Write Suppression Registry" with a 1500ms expiration window.
   - Checks current file modification time against `expected_mtime`. If different, a conflict resolution branch is triggered.
   - Executes atomic temporary write and rename.
   - Extracts new AST blocks, tags, and internal links in memory.
   - Begins SQLite transaction: updates file record, replaces block rows, updates forward/backlinks.
   - Pushes document updates to Tantivy indexing queue.
   - Returns success payload with new `mtime`.
6. Frontend clears `is_dirty` flag and removes the unsaved indicator bullet.

### 3.3 External File Modification Flow
1. An external tool (e.g., VSCode or Git checkout) modifies an active or inactive `.md` file inside the workspace.
2. The operating system notifies the Rust `notify` file watcher thread.
3. Rust checks the path against the "Self-Write Suppression Registry":
   - If present and matches recent save hash: event is discarded.
   - If not present: event is confirmed as external.
4. Rust checks if the file is currently open in any frontend tab:
   - **Case A: File is not open in any active tab:**
     - Rust background task reads the modified file, re-parses blocks and links, updates SQLite index and Tantivy immediately.
   - **Case B: File is open and has NO unsaved changes (`is_dirty == false`):**
     - Rust updates index.
     - Backend emits window event: `file_modified_externally { workspace_id, relative_path }`.
     - Frontend automatically reloads file buffer and re-renders editor without disrupting cursor position if possible.
   - **Case C: File is open and HAS unsaved changes (`is_dirty == true`):**
     - Rust backend does NOT overwrite the editor buffer.
     - Backend emits window event: `file_conflict_detected { workspace_id, relative_path, disk_mtime }`.
     - Frontend displays a non-blocking modal banner:
       - Option 1: "Overwrite Disk" (force write current editor buffer to disk).
       - Option 2: "Reload from Disk" (discard unsaved editor changes).
       - Option 3: "Save As Copy" (save current editor content as `filename.conflict.<timestamp>.md`).

### 3.4 File / Folder Rename & Global Link Repair Flow
1. User renames `FolderA/Note1.md` to `FolderB/Note2.md` via sidebar context menu.
2. Frontend invokes IPC: `rename_entry(workspace_id, old_relative_path, new_relative_path)`.
3. Rust backend validates that `new_relative_path` does not already exist.
4. Rust backend starts an exclusive transaction:
   - Queries SQLite `links` table for all files containing references to `old_relative_path` or any child path if a folder was renamed.
   - Compiles list of affected referencing files.
5. Rust performs the physical disk rename of the target file or directory.
6. For each affected referencing file:
   - Reads file from disk into memory.
   - Runs remark AST engine to match and rewrite all target paths from `old_relative_path` to `new_relative_path` (preserving block anchor suffixes `#^bk-xxxx` and display labels).
   - Writes rewritten content atomically back to disk.
7. SQLite updates:
   - Updates `files` path records.
   - Updates `links` source and target path records.
8. Tantivy updates documents for all rewritten notes.
9. Backend emits event: `workspace_structure_changed { affected_files: [...] }`.
10. Frontend updates folder tree and refreshes any open tabs matching affected files.

---

## 4. SQLite Full Table Schema Specification

The database file is located at `<workspace_root>/.stackmynd/index.db`.
Engine configuration requires SQLite version 3.38+ with WAL mode enabled.

### 4.1 Pragmas and Runtime Engine Settings

- `PRAGMA journal_mode = WAL;` (Write-Ahead Logging for concurrent reader/writer support)
- `PRAGMA synchronous = NORMAL;` (Safe against application crashes, optimal write latency)
- `PRAGMA foreign_keys = ON;` (Strict referential integrity enforcement)
- `PRAGMA busy_timeout = 5000;` (Wait up to 5 seconds on locked transactions before failing)
- `PRAGMA temp_store = MEMORY;` (Keep temporary tables and sorting structures in RAM)
- `PRAGMA cache_size = -64000;` (Allocate 64 MB of page cache memory per workspace)

### 4.2 Table Definitions

#### Table: `workspaces`
Stores metadata regarding the active workspace container.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY, NOT NULL | UUIDv4 string uniquely identifying the workspace |
| `path` | TEXT | NOT NULL, UNIQUE | Absolute canonical path to workspace root folder on host OS |
| `name` | TEXT | NOT NULL | Display name of the workspace |
| `schema_version` | INTEGER | NOT NULL | Current schema version number (initial: 1) |
| `created_at` | INTEGER | NOT NULL | Unix epoch timestamp in milliseconds |
| `last_opened_at` | INTEGER | NOT NULL | Unix epoch timestamp in milliseconds |

#### Table: `files`
Tracks every Markdown document indexed within the workspace directory.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique numeric file record identifier |
| `workspace_id` | TEXT | NOT NULL, REFERENCES workspaces(id) ON DELETE CASCADE | Parent workspace identifier |
| `relative_path` | TEXT | NOT NULL, UNIQUE | Normalized POSIX-style relative path from workspace root |
| `file_name` | TEXT | NOT NULL | Base file name including extension (e.g., "Note.md") |
| `size_bytes` | INTEGER | NOT NULL | File size on disk in bytes |
| `mtime_ms` | INTEGER | NOT NULL | Last modified timestamp on filesystem in milliseconds |
| `hash_blake3` | TEXT | NOT NULL | 256-bit hexadecimal Blake3 hash of file contents |
| `frontmatter_raw`| TEXT | NULL | Raw YAML frontmatter text string excluding triple-dash fences |
| `has_frontmatter`| INTEGER | NOT NULL DEFAULT 0 | Boolean flag (1 = has frontmatter, 0 = none) |
| `is_deleted` | INTEGER | NOT NULL DEFAULT 0 | Soft-deletion flag (1 = in recycle bin, 0 = active) |
| `created_at` | INTEGER | NOT NULL | Record creation epoch timestamp in milliseconds |
| `updated_at` | INTEGER | NOT NULL | Last index synchronization epoch timestamp in milliseconds |

#### Table: `blocks`
Indexes every semantic block parsed from Markdown documents for atomic referencing.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique internal block record ID |
| `file_id` | INTEGER | NOT NULL, REFERENCES files(id) ON DELETE CASCADE | ID of the file containing this block |
| `block_id` | TEXT | NOT NULL | Semantic anchor string (e.g., "bk-a7f9c2") |
| `block_type` | TEXT | NOT NULL | Block category: "paragraph", "heading", "list_item", "code", "quote", "table", "math" |
| `heading_level` | INTEGER | NULL | Heading depth (1-6) if block_type is "heading", else NULL |
| `start_line` | INTEGER | NOT NULL | 1-indexed starting line number within source file |
| `end_line` | INTEGER | NOT NULL | 1-indexed ending line number within source file |
| `start_char` | INTEGER | NOT NULL | Character offset from start of file |
| `end_char` | INTEGER | NOT NULL | Character offset to end of block |
| `content_hash` | TEXT | NOT NULL | Blake3 hash of raw block content string |
| `text_preview` | TEXT | NOT NULL | First 160 characters of plain text content for quick display |
| `created_at` | INTEGER | NOT NULL | Creation epoch timestamp in milliseconds |
| `updated_at` | INTEGER | NOT NULL | Update epoch timestamp in milliseconds |

#### Table: `links`
Maintains the complete bi-directional link graph of the workspace.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique link record ID |
| `source_file_id`| INTEGER | NOT NULL, REFERENCES files(id) ON DELETE CASCADE | File containing the link expression |
| `source_block_id`| INTEGER| NULL, REFERENCES blocks(id) ON DELETE SET NULL | Block containing the link expression |
| `target_relative_path`| TEXT | NOT NULL | Relative path of target note (e.g., "Docs/Architecture.md") |
| `target_file_id`| INTEGER | NULL, REFERENCES files(id) ON DELETE SET NULL | Resolved target file ID (NULL if broken link) |
| `target_block_id`| TEXT | NULL | Target block identifier if block reference (e.g., "bk-99d81") |
| `link_type` | TEXT | NOT NULL | "file_wikilink", "block_wikilink", "standard_markdown", "tag_link" |
| `link_text` | TEXT | NOT NULL | Display text or alias of the link |
| `line_number` | INTEGER | NOT NULL | Source line number where link occurs |
| `is_broken` | INTEGER | NOT NULL DEFAULT 0 | 1 if target file or block cannot be resolved, 0 if valid |
| `created_at` | INTEGER | NOT NULL | Creation timestamp in milliseconds |

#### Table: `tags`
Global registry of unique tags discovered across documents.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique tag ID |
| `name` | TEXT | NOT NULL, UNIQUE | Canonical tag name (normalized lowercase, no leading `#`) |
| `created_at` | INTEGER | NOT NULL | Creation timestamp in milliseconds |

#### Table: `file_tags`
Many-to-many junction table associating files with frontmatter or inline tags.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `file_id` | INTEGER | NOT NULL, REFERENCES files(id) ON DELETE CASCADE | Associated file record ID |
| `tag_id` | INTEGER | NOT NULL, REFERENCES tags(id) ON DELETE CASCADE | Associated tag record ID |

*Composite Primary Key: (`file_id`, `tag_id`)*

#### Table: `block_tags`
Associates tags with specific discrete blocks for granular tag search.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `block_id` | INTEGER | NOT NULL, REFERENCES blocks(id) ON DELETE CASCADE | Associated block record ID |
| `tag_id` | INTEGER | NOT NULL, REFERENCES tags(id) ON DELETE CASCADE | Associated tag record ID |

*Composite Primary Key: (`block_id`, `tag_id`)*

#### Table: `recycle_bin`
Maintains tombstone tracking for soft-deleted workspace files.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique recycle record ID |
| `original_relative_path` | TEXT | NOT NULL | Original path before movement to recycle bin |
| `trash_filename` | TEXT | NOT NULL, UNIQUE | Physical file name in `.stackmynd/trash/` |
| `file_size_bytes` | INTEGER | NOT NULL | Size of deleted file |
| `deleted_at` | INTEGER | NOT NULL | Epoch timestamp of deletion in milliseconds |

### 4.3 Database Index Definitions

To ensure instant lookup performance across large vaults (>50,000 notes):

- `idx_files_relative_path` on `files(relative_path)`
- `idx_files_mtime` on `files(mtime_ms)`
- `idx_files_hash` on `files(hash_blake3)`
- `idx_blocks_file_id` on `blocks(file_id)`
- `idx_blocks_block_id` on `blocks(block_id)`
- `idx_blocks_lookup` on `blocks(file_id, block_id)`
- `idx_links_source_file` on `links(source_file_id)`
- `idx_links_target_path` on `links(target_relative_path)`
- `idx_links_target_block` on `links(target_block_id)`
- `idx_links_target_resolved` on `links(target_file_id)`
- `idx_tags_name` on `tags(name)`
- `idx_file_tags_tag` on `file_tags(tag_id)`
- `idx_block_tags_tag` on `block_tags(tag_id)`

---

## 5. Incremental Synchronization & Full Rebuild Logic

### 5.1 Incremental Synchronization Engine

Incremental sync ensures minimal disk and CPU overhead during normal editing.

1. **Change Ingestion:**
   - Triggered either by internal save event or external file watcher trigger.
2. **Metadata Evaluation:**
   - Backend queries filesystem `mtime` and `size_bytes`.
   - Compares with stored SQLite record in `files` table.
   - If `mtime` and size match, synchronization terminates immediately (0 ms overhead).
3. **Hash Validation:**
   - If `mtime` differs, engine reads file and calculates Blake3 hash.
   - If Blake3 hash matches stored `hash_blake3`, only `mtime_ms` is updated in SQLite; parsing is bypassed.
4. **AST Reparsing & Delta Computation:**
   - If hash differs, file is parsed through the Markdown AST parser.
   - Existing blocks for this `file_id` are loaded from SQLite.
   - A diff algorithm categorizes blocks into:
     - Unchanged blocks (identical `block_id` and `content_hash`).
     - Modified blocks (matching `block_id`, new content and line numbers).
     - Deleted blocks (removed from file).
     - New blocks (newly introduced, auto-assigned a block ID if missing).
5. **Transactional Database Write:**
   - Single SQLite transaction executes deletions, updates, and insertions.
   - Links table is purged and repopulated for the modified file.
   - Tantivy document is re-indexed.

### 5.2 Full Workspace Rebuild Engine

A full rebuild completely reconstructs the index database and Tantivy search engine from the disk source of truth.

#### Rebuild Triggers
- Explicit user invocation via Command Palette ("Rebuild Workspace Index").
- SQLite database corruption error (`SQLITE_CORRUPT`).
- Missing or deleted `.stackmynd/index.db` file.
- Database schema migration failure on application upgrade.

#### Rebuild Execution Pipeline
1. **Shadow Database Creation:**
   - Stackmynd initializes a temporary database file: `.stackmynd/index.db.rebuild`.
   - Applies full SQLite DDL schema and pragmatic settings.
2. **Parallel Filesystem Traversal:**
   - Traverses workspace root recursively using a parallel directory walker.
   - Ignores `.stackmynd/`, `.git/`, and any OS dotfiles.
   - Collects all valid `.md` files into a processing queue.
3. **Multi-Threaded Parsing Pipeline (Rayon Pool):**
   - Distributes note parsing across available CPU worker threads.
   - Each thread parses AST, generates missing block IDs, parses YAML frontmatter, and extracts all link references.
4. **Batched Bulk Database Ingestion:**
   - Batches parsed records into SQLite chunks of 1,000 files per transaction.
   - Resolves target links against the complete file inventory once all files are ingested.
5. **Tantivy Search Index Reconstruction:**
   - Deletes existing `.stackmynd/search_index/` contents.
   - Re-indexes all notes and blocks into a fresh Tantivy index writer with a 128 MB indexing buffer.
   - Commits index segments to disk.
6. **Atomic Database Swap:**
   - Closes current SQLite connection pool to `.stackmynd/index.db`.
   - Renames `.stackmynd/index.db.rebuild` to `.stackmynd/index.db` atomically.
   - Re-opens connection pool and resumes live operation.
   - Total estimated duration for 10,000 notes: < 3.5 seconds.
