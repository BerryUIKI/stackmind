# Document 06: Multi-Workspace System Design

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Multi-Workspace Philosophy & Isolation Model

Stackmynd implements an uncompromising multi-workspace architecture designed around total isolation, portability, and zero inter-workspace data contamination.

```
+-------------------------------------------------------------------------+
|                    Global App Registry (OS AppData)                     |
|  - List of registered workspaces (UUID, Path, Name, Last Opened)       |
|  - Global UI theme and keybindings preferences                          |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-----------------------------------+   +-----------------------------------+
|     Workspace A (Local Disk)      |   |     Workspace B (Local Disk)      |
|  Root: /Volumes/Notes/Engineering |   |  Root: /Users/John/Documents/Wiki |
|                                   |   |                                   |
|  - Note Files (.md)               |   |  - Note Files (.md)               |
|  - Nested Folders                 |   |  - Nested Folders                 |
|  - Private .stackmynd/ container  |   |  - Private .stackmynd/ container  |
|    * index.db (Isolated SQLite)   |   |    * index.db (Isolated SQLite)   |
|    * search_index/ (Tantivy)      |   |    * search_index/ (Tantivy)      |
|    * trash/ (Local Recycle Bin)   |   |    * trash/ (Local Recycle Bin)   |
|    * session.json (Tabs & Layout) |   |    * session.json (Tabs & Layout) |
+-----------------------------------+   +-----------------------------------+
```

### 1.1 Complete Data Isolation Principles
1. **Self-Contained Root Directories:**
   - Every workspace is an arbitrary directory chosen by the user on any accessible local volume.
   - All workspace index data, search structures, trash storage, and runtime state reside strictly inside that root directory.
2. **Zero Cross-Contamination:**
   - SQLite databases are 100% decoupled. Tags, block IDs, note titles, and backlinks in Workspace A have zero visibility or presence in Workspace B.
   - Autocomplete lists for wikilinks and tags populate solely from the active workspace index.
3. **True Portability:**
   - A user can copy, move, zip, or transfer a workspace folder to another computer or external drive.
   - Upon opening the folder in Stackmynd on another machine, the workspace functions immediately with its structure, session, and index intact.

---

## 2. Workspace Lifecycle Operations

### 2.1 Workspace Creation Flow
1. **Initiation:** User clicks "Create New Workspace" in the title bar or sidebar menu.
2. **Path Selection:** Native OS folder picker dialog allows the user to select an empty directory or choose a location and provide a new folder name.
3. **Directory Provisioning:**
   - Rust backend creates the root directory if it does not already exist.
   - Verifies read and write permissions.
   - Creates the hidden directory `.stackmynd/` and subdirectories:
     - `.stackmynd/search_index/`
     - `.stackmynd/trash/`
4. **Metadata & Index Initialization:**
   - Generates `.stackmynd/workspace.json` containing UUIDv4, workspace display name, and creation timestamp.
   - Generates `.stackmynd/.gitignore` to exclude transient database lock files and search segment caches if the user uses Git.
   - Initializes `.stackmynd/index.db` with SQLite WAL mode and table schemas.
   - Initializes Tantivy index engine.
   - Initializes `.stackmynd/session.json` with default layout configuration.
5. **Registration:** Appends the workspace record to the global application registry. Sets as active workspace in the UI.

### 2.2 Workspace Loading Flow (Opening an Existing Workspace)
1. **Initiation:** User selects "Open Workspace..." and picks an existing directory.
2. **Validation & Discovery:**
   - Checks if `.stackmynd/workspace.json` exists:
     - **If present:** Reads workspace identity and validates `.stackmynd/index.db`.
     - **If missing:** Recognizes the directory as an uninitialized folder containing Markdown notes. Automatically executes initialization flow and triggers a full background workspace index.
3. **Schema & Integrity Verification:**
   - Connects to SQLite `index.db`.
   - Reads `schema_version`. If older, runs transactional schema migrations.
   - If `index.db` is corrupt or missing, creates a fresh database and launches the background rebuild pipeline.
4. **Watcher & Engine Activation:**
   - Launches Rust `notify` watcher on the workspace root.
   - Opens dedicated SQLite connection pool.
   - Opens Tantivy searcher.
5. **UI State Restoration:**
   - Reads `.stackmynd/session.json`.
   - Restores open tabs, active document, sidebar widths, and scroll positions.

### 2.3 Workspace Removal Flow
1. **Initiation:** User selects "Remove Workspace" from the workspace dropdown.
2. **Safety Prompt:** System presents a clear confirmation modal: "Remove workspace from Stackmynd? (Your notes and files on disk will NOT be deleted)."
3. **Teardown Sequence:**
   - Flushes any pending auto-saves to disk.
   - Terminates the Rust file watcher for that directory.
   - Closes all open SQLite database connections and Tantivy readers.
   - Removes the entry from the global application registry.
   - Switches the UI to the next available workspace or the empty welcome state.

### 2.4 Workspace Switching Flow
1. **Trigger:** User selects a different registered workspace from the title bar selector.
2. **Save & Suspend:**
   - Pending debounced saves in the current workspace are flushed immediately.
   - Current tab positions and layout dimensions are serialized to `.stackmynd/session.json`.
3. **Context Transition:**
   - Active workspace pointer changes in frontend root store.
   - Sidebar file tree instantly re-binds to the new workspace's file hierarchy.
   - Tab strip restores the open tab set of the target workspace.
   - Status bar updates with target workspace name, word count, and block count.
   - Transition executes in under 100 milliseconds without reloading the webview window.

---

## 3. Internal Structure of `.stackmynd/`

The `.stackmynd/` directory is hidden by default on Unix (prefixed with `.`) and marked with the hidden attribute on Windows.

```
<workspace_root>/
|-- .stackmynd/
|   |-- .gitignore                  # Excludes transient files from external VCS
|   |-- workspace.json              # Workspace identity and metadata
|   |-- session.json                # Persisted UI state, open tabs, panel widths
|   |-- index.db                    # Primary SQLite index database
|   |-- index.db-wal                # SQLite Write-Ahead Log
|   |-- index.db-shm                # SQLite Shared Memory index lock
|   |-- search_index/               # Tantivy search engine data directory
|   |   |-- meta.json               # Tantivy index metadata and schema
|   |   |-- *.fast / *.term / etc.  # Inverted index segments
|   |-- trash/                      # Workspace Local Recycle Bin
|       |-- a1b2c3d4-note1.md       # Soft-deleted note files
|       |-- e5f6g7h8-note2.md       # Soft-deleted note files
|-- Notes/                          # User content directories
|   |-- Architecture.md
|-- Daily/
    |-- 2026-08-28.md
```

### 3.1 File Specifications

#### `workspace.json`
- **Purpose:** Identifies workspace instance.
- **Fields:**
  - `workspace_id`: Canonical UUIDv4 string.
  - `name`: Display name of workspace.
  - `created_at`: Epoch timestamp in milliseconds.
  - `version`: Stackmynd specification version.

#### `session.json`
- **Purpose:** Preserves exact workspace view state.
- **Fields:**
  - `open_tabs`: Array of open document paths, view modes, and cursor positions.
  - `active_tab_path`: Relative path of the active note.
  - `sidebar_width`: Integer pixel width of left sidebar.
  - `sidebar_collapsed`: Boolean flag.
  - `inspector_width`: Integer pixel width of right panel.
  - `inspector_collapsed`: Boolean flag.
  - `inspector_tab`: Active inspector tab name ("metadata", "outlinks", "backlinks", "outline").
  - `expanded_folders`: Array of expanded folder paths.

#### `index.db`
- **Purpose:** Accelerated lookup for files, blocks, tags, and links.
- **Rules:** Never contains article body text; 100% regenerable from `.md` files.

#### `search_index/`
- **Purpose:** Tantivy native search segments.
- **Rules:** Purely an index cache; regenerable alongside `index.db`.

#### `trash/`
- **Purpose:** Storage for notes soft-deleted within the workspace.
- **Rules:** Retains files until explicitly purged by user.

---

## 4. Per-Workspace Independent Indexing & Concurrency

1. **Independent Process Threads:**
   - Every registered workspace runs its own dedicated background worker thread in Rust.
   - Indexing operations in Workspace A (e.g., bulk re-indexing 20,000 files) execute on background threads without impacting navigation, typing, or search speed in Workspace B.
2. **Dedicated Database Connections:**
   - Each workspace holds an independent `r2d2` connection pool pointing directly to its own `.stackmynd/index.db`.
   - SQLite WAL concurrency guarantees that background indexing writes never block foreground UI reads.
3. **Memory Footprint Optimization:**
   - When a workspace is open in the background (not actively focused in the UI):
   - Its file watcher remains active to detect external changes.
   - Its Tantivy searcher releases warm segment caches from RAM after 5 minutes of inactivity.
   - Total idle memory overhead per background workspace: < 12 MB RAM.

---

## 5. Edge Cases & Resilience Protocols

### 5.1 Disconnected or Unmounted Storage
- **Scenario:** User opens a workspace located on an external SSD or network drive that is subsequently disconnected.
- **Detection:** Rust file operations return `ENOENT` or device unavailable errors.
- **System Action:**
  - System intercepts failure before attempting destructive operations.
  - Active editor tabs are locked in memory (preventing write-back to missing paths).
  - UI displays an amber warning banner: "Workspace drive disconnected. Reconnect device to continue."
  - Provides a safe "Export In-Memory Notes" button to save any unsaved work to another drive.

### 5.2 Simultaneous External Workspace Operations
- **Scenario:** Two different instances of Stackmynd (or external scripts) access the same workspace folder simultaneously.
- **Handling:**
  - SQLite WAL mode natively handles multi-process reader/writer locks.
  - If SQLite detects an active write lock, `PRAGMA busy_timeout = 5000` pauses the operation up to 5 seconds before returning a busy error.
  - File watcher ingests external writes with self-write suppression checks.
