# Document 05: File Lifecycle Full Design

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. File Lifecycle Operations & State Transitions

Stackmynd treats the local filesystem as its absolute authority. Every user action (create, rename, move, delete) directly manipulates physical files and directories while maintaining strict index consistency.

```
                  +-----------------------------------+
                  |           File Creation           |
                  |  (Initial .md written to disk)    |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |           Active Note             | <------+
                  | (Indexed in SQLite & Tantivy)     |        |
                  +-----------------------------------+        |
                       |             |            |            |
         +-------------+             |            +-------+    |
         |                           |                    |    |
         v                           v                    v    |
+-------------------+      +-------------------+      +-------------+
|    File Rename    |      |     File Move     |      | Auto-Save   |
| (Link refactor)   |      | (Path refactor)   |      | (800ms idle)|
+-------------------+      +-------------------+      +-------------+
         |                           |                    |
         +-------------+             |                    |
                       v             v                    |
                  +-----------------------------------+   |
                  |          Soft Deletion            |   |
                  |  (Moved to .stackmynd/trash/)     |   |
                  +-----------------------------------+   |
                       |                         |        |
                       v                         +--------+ (Restore)
                  +-------------------+
                  | Permanent Purge   |
                  | (Unlinked on disk)|
                  +-------------------+
```

---

## 2. File Creation, Renaming, Moving & Deletion Flows

### 2.1 Note & Folder Creation
1. **Creation Context:**
   - User triggers "New Note" (`Cmd+N`) or "New Folder" (`Cmd+Shift+N`).
   - If an item in the sidebar tree is currently selected, the new entry is created within that item's parent directory. If nothing is selected, it is created at the workspace root.
2. **Name Resolution & Sanity Check:**
   - Default note name: `Untitled.md`.
   - Collision detection: If `Untitled.md` exists, auto-increments to `Untitled 1.md`, `Untitled 2.md`, etc.
   - Character validation: Names containing invalid filesystem characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, or null bytes) are rejected with an inline warning.
3. **Execution Pipeline:**
   - Rust backend creates an empty physical file on disk.
   - If user preferences define a default frontmatter template (e.g., `date`, `tags: []`), this is written immediately.
   - The file watcher registers the creation, updates SQLite `files`, and opens the new file in an active tab with cursor positioned at line 1.

### 2.2 Note & Folder Renaming
1. **Trigger Points:**
   - Sidebar right-click menu ("Rename").
   - Shortcut `F2` or `Enter` on tree selection.
   - Editing title in tab bar or breadcrumb.
2. **Pre-Execution Validation:**
   - Ensures new name is not empty.
   - Verifies target name does not collide with an existing file in the identical directory.
3. **Link Repair Engine Execution:**
   - Before modifying the disk, the engine identifies all inbound links pointing to `old_path` in SQLite.
   - Physical disk rename is executed via atomic file system command.
   - For every referencing file discovered:
     - The file is parsed into AST.
     - Wikilinks (`[[old_path]]`, `[[old_path#Heading]]`, `[[old_path#^blockid]]`) are rewritten to the new path while preserving aliases and formatting.
     - The updated file is saved atomically.
   - SQLite records and Tantivy index are updated.
   - Open editor tabs seamlessly update their path references without closing.

### 2.3 Note & Folder Moving
1. **Trigger Points:**
   - Drag-and-drop within the sidebar tree.
   - Modal move selector ("Move Note to Folder...").
2. **Safety Constraints:**
   - Circular Move Prevention: A folder cannot be moved into one of its own subdirectories.
   - Root Boundary Enforcement: Items cannot be moved outside the workspace root.
3. **Execution & Refactoring:**
   - Executes filesystem move (`fs::rename`).
   - Recursively updates all internal relative links in the moved file and all referencing notes in the workspace.

### 2.4 Soft Deletion & Workspace Local Recycle Bin
Stackmynd strictly avoids immediate, irreversible file deletion.

1. **Deletion Pipeline:**
   - User deletes a file or directory via sidebar or keyboard (`Cmd+Backspace` / `Delete`).
   - System confirms deletion intent with a prompt: "Move to Workspace Recycle Bin?".
   - Upon confirmation:
     - File is moved to `.stackmynd/trash/<uuid>.<original_filename>`.
     - Entry is created in SQLite `recycle_bin` table with original relative path, trash filename, deletion timestamp, and file size.
     - SQLite `files` table sets `is_deleted = 1`.
     - If the deleted file is currently open in any editor tab, that tab is cleanly closed.
2. **Recycle Bin Management:**
   - Accessible via the sidebar trash anchor.
   - Displays list of deleted files with original path and date deleted.
   - Actions:
     - **Restore:** Moves file from `.stackmynd/trash/` back to its original path. If the original parent directory was deleted in the interim, the directory structure is automatically recreated or the file is restored to the workspace root. Re-indexes the file into SQLite and Tantivy.
     - **Permanently Delete:** Issues physical unlinking (`fs::remove_file`) from disk. Purges record from `recycle_bin` table.
     - **Empty Trash:** Permanently purges all files currently in `.stackmynd/trash/`.

---

## 3. External File Change Watcher & Conflict Resolution

Because Stackmynd guarantees full external editor freedom (VSCode, Typora, Git), the system must react intelligently to external filesystem changes.

### 3.1 Watcher Architecture & Self-Write Suppression
- **Backend Service:** Implemented via Rust `notify` with debouncing (`notify-debouncer-mini`).
- **Filtered Paths:**
  - `.stackmynd/` (internal database and cache).
  - `.git/` and version control metadata.
  - OS metadata files (`.DS_Store`, `Thumbs.db`, `desktop.ini`).
  - Temporary files (`*.tmp.*`, `*~`, `.#*`).
- **Self-Write Suppression Registry:**
  - When Stackmynd initiates an internal save, it registers the canonical path and expected Blake3 content hash in an in-memory TTL map (1,500ms lifespan).
  - When the watcher receives a write event, it queries this registry. If the path and hash match an internal save, the event is silently dropped, eliminating infinite re-indexing loops.

### 3.2 Conflict Resolution State Machine

When a confirmed external write event is processed, the system categorizes the active application state:

| Editor Tab State | Unsaved Changes (`is_dirty`) | Automatic Action | User Notification |
| :--- | :--- | :--- | :--- |
| **File is NOT Open** | N/A | Incremental SQLite & Tantivy re-index | None (Silent background update) |
| **File IS Open** | `false` (Clean) | Reloads editor buffer from disk & updates AST | Subtle toast: "File reloaded from disk" |
| **File IS Open** | `true` (Dirty) | Halts auto-save; locks editor save pipeline | Persistent Non-Blocking Conflict Banner |

### 3.3 Conflict Resolution Choices
When a conflict occurs on an open, unsaved tab, the editor displays an inline alert banner with three explicit options:

1. **Option A: Overwrite Disk (Local Wins)**
   - The user's in-memory editor content replaces the external file on disk.
   - Executes atomic temporary write and rename.
   - Clears conflict banner and resumes normal debounced auto-save.
2. **Option B: Discard Local Changes (Disk Wins)**
   - Discards all in-memory edits.
   - Reloads the external file content from disk into the editor buffer.
   - Resets `is_dirty = false` and refreshes preview rendering.
3. **Option C: Save as Side-by-Side Conflict Copy**
   - The local editor content is saved as a new sibling file: `FileName.conflict.YYYY-MM-DD-HHMMSS.md`.
   - The original file buffer is reloaded from disk.
   - Opens the conflict copy in an adjacent editor tab, allowing the user to manually reconcile differences.

---

## 4. Auto-Save Debounce Engine & Force Save Trigger

To balance instant persistence with low disk wear and zero UI stutter, Stackmynd uses an asynchronous debounced auto-save engine.

### 4.1 Debounce Mechanics
- **Idle Threshold:** Fixed at 800 milliseconds.
- **Timer Operation:**
  - Every keystroke, text paste, or frontmatter edit sets `is_dirty = true`.
  - The 800ms debounce timer is restarted on every input event.
  - While the user types continuously, no disk writes occur.
  - When the user pauses typing for 800ms, the timer expires and dispatches an asynchronous atomic save request to the Rust backend.
- **Visual Feedback:**
  - Status Bar displays "Saving..." during the write operation.
  - Reverts to "Saved" upon disk confirmation.

### 4.2 Immediate Force Save (`Cmd+S` / `Ctrl+S`)
- Pressing `Cmd+S` (macOS) or `Ctrl+S` (Windows/Linux) immediately bypasses and cancels any pending 800ms debounce timer.
- Dispatches immediate atomic save to the Rust backend.
- Provides immediate visual confirmation: the unsaved tab dot disappears and status bar indicates "Saved".

### 4.3 Window Blur & Application Termination Handlers
- **Window Blur / Focus Lost:** When the user switches focus to another application, all currently dirty tabs are flushed to disk immediately.
- **Application Quit Interception:**
  - Tauri's `on_window_close_requested` event intercepts application exit.
  - If any tabs have `is_dirty == true`, the system executes synchronous disk writes for all dirty buffers before allowing the window process to terminate.
  - Zero possibility of lost edits on quit.

---

## 5. File System Error Handling & Resilience Matrix

| Error Scenario | Root Cause | System Behavior & Recovery Protocol |
| :--- | :--- | :--- |
| **Disk Full / Quota Exceeded** | Insufficient storage space | Atomic temp write fails before replacing original file. Original file remains intact. System displays modal alert: "Disk full. Cannot save edits." In-memory buffer is preserved. |
| **Permission Denied (`EACCES`)** | File marked read-only or locked | Save fails; displays alert: "Permission denied. File is read-only." Allows user to "Save As" to a writable location. |
| **External Deletion While Open** | File deleted in external terminal | Tab remains open with memory buffer intact. Unsaved dot appears. Banner alerts: "File was deleted externally. Click to recreate on disk or close tab." |
| **File Path Exceeds OS Limit** | Deeply nested folder structure | Path length validated before creation/move. If path exceeds limits (e.g., 260 chars on Windows without long paths), operation blocked with clear error. |
| **Atomic Rename Lock Violation** | Antivirus or backup tool holds handle | Retry loop: Retries atomic rename up to 5 times with exponential backoff (20ms, 40ms, 80ms, 160ms, 320ms) before reporting failure. |
