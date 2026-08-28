# Document 03: Complete UI/UX Layout Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Global 5-Area Spatial Grid & Layout Architecture

The user interface of Stackmynd is organized into a deterministic 5-area structural grid that fills 100% of the application window viewport. The layout does not use arbitrary floating windows; all primary controls and information panels reside within fixed or resizable panels.

```
+-----------------------------------------------------------------------------------------------+
| [1] Custom Top Title Bar (Height: 38px, Draggable, Window Controls, Mode & Panel Toggles)      |
+---------------------+---------------------------------------------------+---------------------+
| [2] Left Sidebar    | [3] Central Main Tab & Editor Area                | [4] Right Inspector |
| (Width: 180-450px)  | (Multi-Tab Bar: 36px, Breadcrumb: 24px, Viewport) | (Width: 220-500px)  |
| - Workspace Switch  | - Tab Strip with Unsaved Badges                   | - Frontmatter Form  |
| - Action Bar        | - Source Mode / Preview Mode / Sync Split Mode    | - Forward Links     |
| - Virtual Tree View | - Proportional Synchronized Scroll Split          | - Backlink Graph    |
|                     |                                                   | - Block Outline     |
+---------------------+---------------------------------------------------+---------------------+
| [5] Bottom Status Bar (Height: 24px, Workspace, Indexer, Stats, Position, Save State)         |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Exhaustive Specification for the 5 Layout Areas

### 2.1 Area 1: Custom Top Title Bar

The title bar is completely custom-rendered via SolidJS and Tauri v2 window APIs, suppressing native operating system window decoration while preserving native platform behaviors.

- **Dimensions:** Fixed height of 38 pixels; width extends 100% across the viewport.
- **Draggable Region:** Marked with `data-tauri-drag-region`, enabling natural window movement across all desktop platforms. Interactive child buttons and dropdowns explicitly declare `data-tauri-drag-region="false"` to prevent drag interference.
- **Platform Window Controls:**
  - **macOS:** Native-style traffic light buttons (Close, Minimize, Maximize/Fullscreen) anchored at the far left (margin-left: 12px, spacing: 8px).
  - **Windows & Linux:** Native-style window controls (Minimize, Maximize/Restore, Close) anchored at the far right.
- **Active Workspace Selector:**
  - Placed adjacent to the window controls.
  - Displays current active workspace name with a folder icon and a chevron dropdown indicator.
  - Clicking opens the Workspace Quick Switcher popover list.
- **Global Search Trigger Button:**
  - Centered or left-of-center pill button.
  - Label: "Search notes or blocks... (Cmd+K / Ctrl+K)".
  - Clicking invokes the global modal search palette.
- **Editor View Mode Segmented Control:**
  - Located on the right side of the title bar.
  - Three mutually exclusive toggle buttons:
    1. *Source Mode:* Raw Markdown icon.
    2. *Preview Mode:* Rendered document icon.
    3. *Sync Split Mode:* Dual-pane split icon.
- **Panel Visibility Toggles:**
  - Left Sidebar Toggle button (`Cmd+B` / `Ctrl+B` tooltip).
  - Right Inspector Toggle button (`Cmd+Shift+B` / `Ctrl+Shift+B` tooltip).
- **Theme Switcher:**
  - Icon toggle switching between Dark Mode and Light Mode with zero interface flicker.

### 2.2 Area 2: Left Resizable & Collapsible Sidebar

The left sidebar provides access to workspace selection and the nested file system hierarchy.

- **Dimensional Constraints:**
  - Default width: 260 pixels.
  - Minimum allowed width: 180 pixels.
  - Maximum allowed width: 450 pixels.
  - Collapsed width: 0 pixels (fully hidden with overflow hidden).
- **Resize Handle:**
  - Located on the right border of Area 2.
  - 4-pixel interactive hit-zone displaying a `col-resize` cursor.
  - Visual indicator: 1-pixel border highlighted to primary theme accent color on hover or active drag.
  - Snapping behavior: If dragged to a width below 160 pixels, the sidebar smoothly snaps shut to 0 pixels (collapsed state). Dragging rightward from 0 pixels pops it open to the minimum 180 pixels.
  - Double-click action: Double-clicking the resize handle restores the default width (260 pixels).
- **Sub-Component Hierarchy:**
  1. *Workspace Selector Header:*
     - Shows current workspace avatar/icon and directory name.
     - Dropdown menu options: "Open Workspace...", "Create New Workspace...", "Reload Workspace Index", "Remove Workspace".
  2. *Action Toolbar (Fixed Height: 32px):*
     - "New Note" icon button (creates `Untitled.md` in selected folder).
     - "New Folder" icon button (creates `New Folder` in selected directory).
     - "Collapse All Folders" icon button.
     - "Refresh Tree from Disk" icon button.
  3. *Virtualized Directory & File Tree:*
     - Implements a high-performance virtualized list to support trees containing over 50,000 files without DOM degradation.
     - Displays 1:1 disk hierarchy.
     - Folders render with expansion chevrons, folder icons, and file count badges.
     - Markdown files render with document icons and active selection highlights.
     - Files currently open in tabs display subtle text emphasis.
     - Right-click context menu: "Rename", "Delete (Move to Recycle Bin)", "Cut", "Copy", "New File Inside", "New Folder Inside", "Reveal in OS File Manager".
  4. *Recycle Bin Access Anchor:*
     - Pinned to the bottom of the sidebar.
     - Displays trash icon and count of soft-deleted notes. Clicking opens the Trash Management Modal.

### 2.3 Area 3: Central Main Tab & Editor Area

The central pane is the primary workspace where notes are read, composed, and transformed.

- **Multi-Document Tab Bar (Fixed Height: 36px):**
  - Renders horizontally above the editor viewport with smooth horizontal scrolling for overflow tabs.
  - Tab Structure:
    - Document title (derived from frontmatter `title` if set, otherwise the filename).
    - Unsaved modification indicator: A prominent dot badge displayed when `is_dirty == true`.
    - Tab close button (`x`) appearing on hover or when tab is active.
  - Tab Interactions:
    - Left-click: Switches focus to that document.
    - Middle-click: Closes the tab immediately (prompts if unsaved changes exist).
    - Drag-and-drop: Allows reordering tabs horizontally across the tab bar.
    - Right-click context menu: "Close Tab", "Close Other Tabs", "Close Tabs to the Right", "Close All", "Copy Relative Path", "Reveal in Sidebar".
- **Breadcrumb Navigation Bar (Fixed Height: 24px):**
  - Located directly beneath the tab strip.
  - Displays the active note's full folder ancestry: `Workspace > FolderA > FolderB > NoteTitle.md`.
  - Clicking any parent segment in the breadcrumb highlights that directory in the left sidebar tree.
- **Editor Viewport & Tri-Mode Operation:**
  - Fills all remaining vertical and horizontal space in Area 3.
  - **Mode 1: Source Mode:**
    - Single-pane monospaced plain-text editor.
    - Features: Gutter with line numbers, active line highlighting, indentation guides, folding markers for headings and frontmatter blocks.
    - Frontmatter is displayed as raw YAML text enclosed by `---`.
    - Block identifiers (`^bk-xxxx`) are rendered in muted monospaced text at the end of paragraphs.
  - **Mode 2: Preview Mode:**
    - Single-pane rich typography reader view.
    - Features: Styled headings, formatted tables, interactive task checkboxes, rendered KaTeX math blocks, and rendered Mermaid diagrams.
    - Block identifiers (`^bk-xxxx`) are 100% invisible to the reader.
    - Wikilinks (`[[target]]`) are rendered as clickable anchors with hover popover previews.
  - **Mode 3: Sync Split Mode:**
    - Dual-pane layout divided vertically into two equal halves (50% Source on left, 50% Preview on right).
    - Central vertical split divider is draggable between 20% and 80% split width.
    - Synchronized Scrolling: As the user scrolls the left source pane, the right preview pane automatically scrolls proportionally based on AST block line mapping.
    - Zero Typing Lag: Typing in the source pane updates the preview pane via an asynchronous 50ms render pipeline without causing keypress stutter.

### 2.4 Area 4: Right Resizable & Collapsible Auxiliary Inspector

The right inspector provides deep structural insights into the active document.

- **Dimensional Constraints:**
  - Default width: 300 pixels.
  - Minimum allowed width: 220 pixels.
  - Maximum allowed width: 500 pixels.
  - Collapsed width: 0 pixels (fully hidden).
- **Resize Handle:**
  - Located on the left border of Area 4.
  - 4-pixel hit-zone with `col-resize` cursor.
  - Snaps shut if dragged below 180 pixels; snaps open when dragged leftward from 0 pixels.
- **Inspector Tab Strip (Fixed Height: 32px):**
  - Segmented control to select between 4 functional inspector tabs:
    1. *Metadata:* Interactive YAML frontmatter property editor.
    2. *Outlinks:* Forward references found inside this document.
    3. *Backlinks:* External documents and blocks that link into this document.
    4. *Outline:* Structural heading and block anchor navigator.
- **Panel Content Behaviors:**
  - Content scrolls vertically with custom slim scrollbars.
  - If no note is open in Area 3, Area 4 displays a clean empty state: "No document selected".

### 2.5 Area 5: Bottom Status Bar

The status bar provides system-wide state reporting and live document metrics.

- **Dimensions:** Fixed height of 24 pixels; spans the full window width.
- **Information Segments (Left to Right):**
  1. *Active Workspace Label:* Displays current workspace folder name with an indicator dot (Green = Idle, Blue = Indexing).
  2. *Indexing Activity Indicator:* Displays subtle animated spinner when background Tantivy or SQLite re-indexing is actively processing files.
  3. *Document Metrics:* Displays active note metrics: "1,420 words | 84 blocks".
  4. *Cursor Position:* Displays caret coordinates: "Ln 42, Col 18".
  5. *Encoding & Line Endings:* Displays "UTF-8 | LF".
  6. *Save State Pill:*
     - "Saved" (Neutral gray).
     - "Saving..." (Blue indicator).
     - "Unsaved changes" (Amber indicator when dirty).

---

## 3. Multi-Workspace UI Display & Isolation Rules

1. **Workspace Boundary Isolation:**
   - Stackmynd supports registering multiple workspaces simultaneously.
   - The user selects which workspace is active via the title bar dropdown or sidebar header.
   - When Workspace A is active, the left sidebar displays exclusively the filesystem tree of Workspace A.
   - The document tab bar displays only tabs belonging to Workspace A.
2. **Workspace Switching Behavior:**
   - Switching from Workspace A to Workspace B does not terminate open tabs in Workspace A.
   - The system commits any pending debounced auto-saves in Workspace A before executing the switch.
   - The UI restores the exact open tab set, active tab, scroll offsets, and inspector tab state of Workspace B from `.stackmynd/session.json`.
   - Transition latency must be under 100 ms with zero visual flash.
3. **Cross-Workspace Dragging Restrictions:**
   - Dragging a file from the tree of Workspace A into an external window or another workspace folder is treated as a copy operation, requiring explicit confirmation.

---

## 4. Comprehensive Global Keyboard Shortcut Table

All shortcuts adapt automatically to the host operating system (`Cmd` on macOS, `Ctrl` on Windows and Linux).

| Command Description | macOS Shortcut | Windows / Linux Shortcut | Context / Scope |
| :--- | :--- | :--- | :--- |
| **New Note** | `Cmd + N` | `Ctrl + N` | Global / Active Directory |
| **New Folder** | `Cmd + Shift + N` | `Ctrl + Shift + N` | Global / Active Directory |
| **Open Workspace** | `Cmd + O` | `Ctrl + O` | Global |
| **Force Save Document** | `Cmd + S` | `Ctrl + S` | Active Editor Tab |
| **Close Active Tab** | `Cmd + W` | `Ctrl + W` | Active Editor Tab |
| **Reopen Closed Tab** | `Cmd + Shift + T` | `Ctrl + Shift + T` | Tab History |
| **Next Tab** | `Cmd + Option + Right` | `Ctrl + PageDown` | Tab Strip |
| **Previous Tab** | `Cmd + Option + Left` | `Ctrl + PageUp` | Tab Strip |
| **Toggle Left Sidebar** | `Cmd + B` | `Ctrl + B` | Global Window |
| **Toggle Right Inspector**| `Cmd + Shift + B` | `Ctrl + Shift + B` | Global Window |
| **Switch to Source Mode** | `Cmd + 1` | `Ctrl + 1` | Active Document |
| **Switch to Preview Mode**| `Cmd + 2` | `Ctrl + 2` | Active Document |
| **Switch to Sync Split** | `Cmd + 3` | `Ctrl + 3` | Active Document |
| **Global Search Palette** | `Cmd + K` or `Cmd + P` | `Ctrl + K` or `Ctrl + P`| Global Window |
| **Search in Current File**| `Cmd + F` | `Ctrl + F` | Active Editor View |
| **Replace in Current File**| `Cmd + Option + F`| `Ctrl + H` | Active Editor View |
| **Insert Block Reference**| `[[` | `[[` | Editor Caret Position |
| **Insert Inline Math** | `Cmd + M` | `Ctrl + M` | Editor Selection |
| **Insert Math Block** | `Cmd + Shift + M` | `Ctrl + Shift + M` | Editor Caret Position |
| **Zoom In** | `Cmd + =` | `Ctrl + =` | UI Scaling |
| **Zoom Out** | `Cmd + -` | `Ctrl + -` | UI Scaling |
| **Reset Zoom** | `Cmd + 0` | `Ctrl + 0` | UI Scaling |

---

## 5. UI Layout State Persistence Rules

Layout state is persisted automatically to ensure a frictionless user experience upon application relaunch.

### 5.1 Storage Locations
- **Per-Workspace Layout State:** Stored at `<workspace_root>/.stackmynd/session.json`.
- **Global Application Settings:** Stored in OS AppData at `stackmynd_preferences.json` (window position, dark/light theme, known workspace registry).

### 5.2 Persisted Session Properties
1. `window_dimensions`: `{ width: number, height: number, x: number, y: number, is_maximized: boolean }`.
2. `sidebar_state`: `{ width: number, is_collapsed: boolean }`.
3. `inspector_state`: `{ width: number, is_collapsed: boolean, active_tab: "metadata" | "outlinks" | "backlinks" | "outline" }`.
4. `open_tabs`: Array of objects containing `{ relative_path: string, mode: "source" | "preview" | "split", scroll_position: number, cursor_line: number, cursor_col: number }`.
5. `active_tab_index`: Integer pointer to the tab currently focused.
6. `expanded_folder_paths`: Array of relative directory paths currently expanded in the sidebar tree.

### 5.3 Restoration Sequence on Launch
1. Read global preferences to position and display the main application window.
2. Load the most recently active workspace root path.
3. Validate that the workspace directory still exists on the filesystem. If missing (e.g., disconnected external drive), prompt the user and fall back to the workspace picker.
4. Read `.stackmynd/session.json` and restore sidebar and inspector widths.
5. Reopen all document tabs recorded in `open_tabs`, verifying that each target file still exists on disk.
6. Restore the active tab, editor mode, and scroll position seamlessly.
