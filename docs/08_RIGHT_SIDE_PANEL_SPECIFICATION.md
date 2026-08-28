# Document 08: Right Side Panel Functional Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Architectural Role & Physical Dimensions

The Right Auxiliary Panel (Area 4 in the 5-Area Spatial Grid) functions as the contextual inspector and relational intelligence center for the currently active document. It operates alongside the editor to expose metadata, bi-directional knowledge graphs, and atomic block structures.

```
+-------------------------------------------------------------+
| Right Inspector Panel (Area 4)                              |
| Width: 220px - 500px (Default: 300px)                       |
+-------------------------------------------------------------+
| Tab Strip: [ Metadata ] [ Outlinks ] [ Backlinks ] [Outline]|
+-------------------------------------------------------------+
|                                                             |
|  Dynamic Tab Viewport                                       |
|  - Tab 1: Visual Frontmatter Form Editor                    |
|  - Tab 2: Forward Reference Inspector                       |
|  - Tab 3: Backlink Graph & Unlinked Mentions                |
|  - Tab 4: Headings & Atomic Block Navigator                 |
|                                                             |
+-------------------------------------------------------------+
| Collapsed State: 0px width | Shortcut: Cmd+Shift+B          |
+-------------------------------------------------------------+
```

### 1.1 Structural Constraints & State
- **Width Range:** Minimum 220 pixels, maximum 500 pixels, default 300 pixels.
- **Collapse Toggle:** Toggled via top title bar icon or shortcut `Cmd+Shift+B` (macOS) / `Ctrl+Shift+B` (Windows/Linux).
- **Tab Header:** 32-pixel height segmented control with 4 tabs:
  1. *Metadata:* YAML frontmatter properties.
  2. *Outlinks:* Forward references exiting the document.
  3. *Backlinks:* Inbound references entering the document.
  4. *Outline:* Hierarchical heading and block outline.
- **State Persistence:** The active inspector tab and panel width are preserved in `<workspace_root>/.stackmynd/session.json`.

---

## 2. Tab 1: Metadata Panel Specification & Editable Field Rules

The Metadata Tab transforms raw YAML Frontmatter into an interactive visual property editor while guaranteeing 100% fidelity with the physical file on disk.

### 2.1 Property Field Types & UI Controls

| Property Type | Visual UI Control | Input Constraints | Frontmatter YAML Output |
| :--- | :--- | :--- | :--- |
| **Text** | Single-line text input | Arbitrary UTF-8 string | `key: "Text string"` |
| **Number** | Numeric input with steppers | Valid integer or float | `key: 42` or `key: 3.14` |
| **Boolean** | Switch / Toggle button | Checked (true) / Unchecked (false) | `key: true` or `key: false` |
| **Tags** | Interactive chip container | Autocomplete dropdown; dismiss via `x` | `tags: [tag1, tag2]` |
| **Date** | Date & Time picker dialog | Standard ISO 8601 formatting | `date: 2026-08-28T14:30:00` |
| **List / Array** | Multi-item stack with reorder handles | Arbitrary strings; "Add Item" button | `key:`<br>`  - item1`<br>`  - item2` |
| **Raw Text** | Multiline text area | Freeform multiline block | `key: \|`<br>`  Line 1`<br>`  Line 2` |

### 2.2 Property Management Operations
- **Add Property:**
  - Clicking "+ Add Property" button reveals a dropdown with field type choices and a property name input.
  - Generates the new key in the frontmatter AST with a default value.
- **Delete Property:**
  - Hovering a property row displays a trash icon on the right margin.
  - Clicking prompts: "Remove property `<key>`?". On confirmation, strips the key from frontmatter.
- **Rename Property Key:**
  - Clicking on the property name label converts it to an editable text input, allowing key renames without modifying the value.
- **Raw YAML Toggle:**
  - An icon button at the top of the panel toggles between the visual form editor and a raw YAML text editor.

### 2.3 Synchronization & AST Preservation Invariants
1. **Zero Content Disruption:** Modifying frontmatter properties alters only the header lines between the opening `---` and closing `---` fences. The document body text below line `---` is untouched.
2. **Comment & Formatting Preservation:** Stackmynd uses an AST-preserving YAML parser that retains user-written comments (`# comment`), blank lines, and original key indentation.
3. **Debounced Disk Write:** Changes in the metadata panel trigger the 800ms auto-save debounce pipeline.

---

## 3. Tab 2: Forward References (Outlinks) Specification

The Outlinks Tab displays all external connections originating from the active note.

### 3.1 Reference Categorization
1. **Internal Note Links:**
   - Standard wikilinks (`[[NoteTitle]]`) or relative links (`[Title](./NoteTitle.md)`).
   - Shows target document title, parent directory, and alias (if defined).
2. **Internal Block Links:**
   - Atomic block links (`[[NoteTitle#^bk-xxxx]]`).
   - Displays target note title alongside a block preview badge with the target block anchor ID.
3. **External Web Hyperlinks:**
   - Standard web URLs (`https://...`).
   - Displays URL domain icon, link label, and full destination address.

### 3.2 Health & Status Tracking
- **Resolved Links:** Rendered in standard accent color with document icon.
- **Broken Links:** Rendered with an amber warning badge: "Target Not Found".
  - Hovering a broken link shows: "Target note does not exist on disk."
  - Action button: "+ Create Note" creates a blank note at the targeted relative path immediately and re-indexes.

### 3.3 Interactive Behaviors
- **Left-Click:** Opens the target note in the active editor tab.
- **Cmd+Click / Ctrl+Click:** Opens the target note in a new tab.
- **Hover:** Displays the 300ms hover preview popover card.

---

## 4. Tab 3: Backward References (Backlinks) Specification

The Backlinks Tab computes and exposes the relational network pointing into the active document from all other notes across the workspace.

### 4.1 Linked Mentions Section
- Displays all notes containing explicit wikilinks or block links targeting the current note.
- **Card Hierarchy per Referencing Note:**
  - Note Header: File icon, note title, folder breadcrumb.
  - Reference Counter: Badge indicating number of citations (e.g., "3 links").
  - Contextual Snippet Container:
    - Displays the surrounding sentence or enclosing block where the link appears.
    - Highlights the reference string in bold accent styling.
    - Shows line number where the link is positioned.
- **Interaction:**
  - Clicking any snippet navigates to the referencing note and scrolls directly to that line.

### 4.2 Unlinked Mentions Section
- Discovers occurrences where the active note's title (or declared aliases) appears as plain text in other notes without wikilink brackets.
- Powered by high-speed substring matching via SQLite index and Tantivy searcher.
- **"Link" Action Button:**
  - Next to each unlinked mention snippet, a "+ Link" button is displayed.
  - Clicking "+ Link" triggers the Link Repair Engine:
    - Atomically updates the referencing note on disk by wrapping the exact text in `[[...]]`.
    - Automatically updates the SQLite `links` table.
    - Moves the item from "Unlinked Mentions" to "Linked Mentions" without requiring the user to open the other file.

---

## 5. Tab 4: Block Outline & Navigation Behavior

The Outline Tab provides a comprehensive structural map of the active note, unifying heading hierarchies with atomic block anchors.

```
+-------------------------------------------------------------+
| Outline Navigation Tree                                     |
+-------------------------------------------------------------+
| v H1: System Architecture Overview                          |
|   |-- ^bk-10af  (Paragraph: "Stackmynd is structured...")   |
|   |-- ^bk-28b1  (Quote: "> The file is the single...")      |
|   v H2: Storage Layer Details                               |
|     |-- ^bk-34cd  (Table: "Table 1: Schema Definitions")    |
|     |-- ^bk-91ee  (Math: "$$\int f(x)dx$$")                 |
|   > H2: Concurrency & Lock Strategy                         |
+-------------------------------------------------------------+
```

### 5.1 Outline Hierarchy & Element Display
- **Headings (H1 through H6):**
  - Indented hierarchically according to depth level (H1 = 0px indent, H2 = 12px, H3 = 24px, etc.).
  - Collapsible chevrons allow collapsing entire sections in the outline view.
- **Semantic Blocks Under Headings:**
  - Below each heading, atomic blocks are listed with specialized iconography:
    - Paragraph icon for text blocks.
    - Quote icon for blockquotes.
    - Code icon for fenced code blocks.
    - Table icon for Markdown tables.
    - Sigma icon (`∑`) for KaTeX math blocks.
  - Each block entry displays:
    - The first 40 characters of plain-text preview.
    - The anchor badge (`^bk-xxxx`).

### 5.2 Interactive Navigation & Actions
1. **Precise Scroll Jump:**
   - Clicking any heading or block in the outline instantly scrolls the main editor pane to that exact line.
   - The targeted element flashes with a temporary 1.5-second accent highlight.
2. **Copy Block Reference:**
   - Hovering any block row reveals a "Copy Reference" button.
   - Clicking copies `[[CurrentNote#^bk-xxxx]]` directly to the system clipboard.
3. **Live Active Block Tracking (Scrollspy):**
   - As the user scrolls the editor viewport, the outline tree monitors visible elements and highlights the active heading and block currently in focus.

---

## 6. Empty States & Error Handling

- **No Open Document:**
  - When all editor tabs are closed, Area 4 displays a clean empty state graphic with message: "No document selected. Open a note to view metadata and connections."
- **Empty Sections:**
  - If a note has no frontmatter: Displays "No properties defined" with a "+ Add Frontmatter" button.
  - If a note has no outlinks: Displays "No outgoing links from this note."
  - If a note has no backlinks: Displays "No incoming links found."
  - If a note has no headings or blocks: Displays "Empty document outline."
