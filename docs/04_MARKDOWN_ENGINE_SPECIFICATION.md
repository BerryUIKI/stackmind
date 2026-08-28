# Document 04: Markdown Engine Full Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Complete Syntax Support & Markdown Dialect

Stackmynd implements a deterministic, standards-compliant Markdown compilation and processing pipeline built upon the `remark` (Markdown AST / mdast) and `rehype` (HTML AST / hast) ecosystem.

### 1.1 Base Syntax Standards
The engine adheres strictly to the following formal specifications:
- **CommonMark Specification (v0.31.2):** Full compliance with standard inline and block specifications.
- **GitHub Flavored Markdown (GFM):** Complete support for tables, strikethrough, autolinks, and task list items.

### 1.2 Comprehensive Syntactic Element Inventory

| Syntactic Element | Markdown Delimiter / Pattern | Rendered Representation | Notes |
| :--- | :--- | :--- | :--- |
| **Headings (Levels 1-6)** | `#` to `######` at line start | HTML `<h1>` to `<h6>` tags | Supports auto-generated slug IDs |
| **Paragraphs** | Consecutive lines of text | HTML `<p>` tags | Separated by one or more blank lines |
| **Blockquotes** | `>` at line start | HTML `<blockquote>` tags | Supports arbitrary nesting (`>>`) |
| **Unordered Lists** | `-`, `*`, or `+` bullet markers | HTML `<ul>` and `<li>` tags | Supports loose and tight spacing |
| **Ordered Lists** | `1.`, `2.` numeric markers | HTML `<ol>` and `<li>` tags | Preserves starting number offset |
| **Task Lists** | `- [ ]` (unchecked) or `- [x]` (checked) | Interactive checkboxes | Checkbox click toggles state on disk |
| **Fenced Code Blocks** | ```` ```language ```` to ```` ``` ```` | HTML `<pre><code>` with syntax styling | Syntect / Prism highlighting |
| **Inline Code** | Single backticks (`` `code` ``) | HTML `<code>` tag | Escaped text representation |
| **Tables** | Pipe-delimited rows with header line | HTML `<table>`, `<thead>`, `<tbody>` | Supports `:---`, `:---:`, `---:` alignment |
| **Horizontal Rules** | `---`, `***`, or `___` | HTML `<hr>` tag | Must occupy an entire line |
| **Emphasis & Strong** | `*italic*`, `**bold**`, `***both***` | HTML `<em>`, `<strong>` tags | Underscore equivalents supported |
| **Strikethrough** | `~~deleted text~~` | HTML `<del>` tag | GFM extension |
| **Footnotes** | `[^1]` inline and `[^1]: note text` | Anchor link to footnote section | Placed at document end in preview |
| **Inline Math** | `$formula$` | KaTeX inline span | Requires non-whitespace after opening `$` |
| **Display Math Block** | `$$formula$$` | KaTeX display equation container | Centered block rendering |
| **Diagrams (Mermaid)** | ```` ```mermaid ```` code fences | Dynamic SVG graphic | Flowchart, sequence, state, class, etc. |
| **Wikilinks (Note)** | `[[TargetNote]]` or `[[Target\|Alias]]` | Internal anchor link | Navigates to note in active tab |
| **Wikilinks (Heading)**| `[[TargetNote#Heading Title]]` | Internal anchor link | Navigates and scrolls to heading |
| **Block References** | `[[TargetNote#^bk-xxxx]]` | Transclusion preview / jump link | Pinpoint jump to targeted block |

---

## 2. YAML Frontmatter Read / Write Synchronization Specification

Every document in Stackmynd may contain an optional metadata block at the top of the file.

### 2.1 Structural Rules for Frontmatter
- **Location:** Frontmatter must strictly begin on Line 1, Column 1 with three hyphens (`---`).
- **Termination:** Must terminate with a matching three-hyphen fence (`---`) on a dedicated line.
- **Encoding:** Standard YAML 1.2 specification.
- **Supported Value Types:**
  - Strings (unquoted, single-quoted, double-quoted).
  - Numbers (integers and floating-point).
  - Booleans (`true`, `false`).
  - Arrays / Lists (both inline `[item1, item2]` and block bullet lists).
  - Key-Value Maps / Dictionaries.
  - Dates and timestamps (ISO 8601 strings).

### 2.2 Bidirectional Synchronization Engine
The Markdown engine guarantees non-destructive round-trip synchronization between the disk file's YAML block and the UI Inspector:
1. **File Ingestion (Disk to UI):**
   - On opening a document or detecting an external change, the lexer extracts the frontmatter block.
   - A tolerant YAML parser transforms the block into a structured key-value map.
   - The map populates the Right Inspector Metadata Form.
2. **Metadata Mutation (UI to Disk):**
   - When the user edits, adds, or deletes a metadata property in the Right Inspector:
   - The engine uses an AST-preserving YAML serializer to update the frontmatter block.
   - Existing comments, indentation levels, and unedited key orders are strictly preserved.
   - The updated frontmatter is spliced back into the file buffer while leaving the document body below the closing `---` completely untouched.
   - The save pipeline is triggered with 800ms debounce.

---

## 3. BlockID Generation, Storage & Rendering Specification

Stackmynd treats blocks as the primary atomic units of knowledge.

### 3.1 BlockID Syntax & Format
- **Format:** `^bk-[a-z0-9]{4,8}`
- **Examples:** `^bk-9a2f`, `^bk-c7e108`, `^bk-41ab99d2`
- **Pattern Invariants:**
  - Always prefixed with a caret symbol (`^`).
  - Immediately followed by `bk-` to prevent collisions with user footnotes (`[^1]`).
  - Contains between 4 and 8 lowercase alphanumeric characters generated via cryptographically secure pseudo-random numbers (CSPRNG).

### 3.2 Block Placement Rules on Disk
A BlockID must be placed at the trailing end of a block, preceded by a single space:
1. **Paragraphs:** Placed at the very end of the final line of the paragraph.
2. **Headings:** Placed after the heading text on the same line (e.g., `## Architecture Overview ^bk-7f12`).
3. **List Items:** Placed at the end of the list item text line before any child sub-lists.
4. **Blockquotes:** Placed at the end of the last line inside the blockquote boundary.
5. **Fenced Code Blocks:** Placed immediately following the closing fence on a dedicated line or as a fence attribute.
6. **Tables:** Placed immediately below the final row of the table without an intervening blank line.
7. **Math Blocks:** Placed immediately following the closing `$$` delimiter.

### 3.3 Generation Policy
- **On-Demand Reference Creation:** When a user creates a block reference to a block that lacks an identifier, the system automatically appends a fresh `^bk-xxxx` identifier to that block on disk.
- **User Independence:** Users can manually type custom block identifiers conforming to `^bk-[a-z0-9]{4,8}`, and Stackmynd will index them identically.
- **Uniqueness Constraint:** Block IDs are scoped to the file. If duplicate Block IDs exist in a single file due to external copy-paste, the indexer marks the duplicates with an error flag and re-generates an ID for the subsequent occurrence.

### 3.4 Multi-Mode Rendering Rules
- **Source Mode:** The identifier is rendered in faint, muted monospaced text with low visual contrast, allowing power users to see and edit the anchor if desired.
- **Preview Mode:** The custom rehype plugin completely strips the `^bk-xxxx` string from visible DOM text. It injects an HTML attribute `data-block-id="bk-xxxx"` onto the parent container element (`<p>`, `<li>`, `<h2>`, etc.) to serve as an invisible anchor target for navigation.
- **External Interoperability:** When opened in VSCode, Typora, or GitHub web, `^bk-xxxx` appears as standard trailing plain text, maintaining 100% CommonMark conformance without rendering errors.

---

## 4. Block Reference Resolution, Hover Preview & Navigation

### 4.1 Reference Syntax
- Standard Form: `[[target_file#^block_id]]`
- Aliased Form: `[[target_file#^block_id|Custom Display Label]]`
- Intra-Note Form: `[[#^block_id]]` (links to a block within the identical file)

### 4.2 Resolution Algorithm
1. **Target Note Resolution:**
   - The engine checks `target_file` against SQLite index:
     - Exact relative path match (e.g., `Engineering/Specifications.md`).
     - Basename match if path omitted (e.g., `Specifications`).
2. **Target Block Resolution:**
   - The engine searches the SQLite `blocks` table for the row matching `file_id` and `block_id`.
   - If found: Retrieves `start_line`, `end_line`, and `text_preview`.
   - If not found: Marks link as broken (`is_broken = 1`), rendering the link in warning styling in Preview mode.

### 4.3 Hover Preview Popover Interaction
- **Trigger:** Moving the mouse cursor over a block reference link in Preview Mode or Sync Split Mode.
- **Delay:** 300 milliseconds hover threshold to prevent accidental triggering during cursor traversal.
- **Popover Contents:**
  - Header: Target file name, folder breadcrumb, and anchor ID.
  - Body: Live rendered Markdown view of the targeted block and its immediate context (1 block before and after).
  - Footer: "Click to jump, Cmd+Click to open in new tab".
- **Dismissal:** Automatically dismisses when the mouse leaves the popover container with a 200ms grace window.

### 4.4 Navigation & Scroll Jump Execution
- **Trigger:** Left-clicking a block reference link.
- **Action Sequence:**
  1. If the target note is not open, it is loaded into the active tab.
  2. The editor calculates the pixel offset of the target DOM element matching `data-block-id="bk-xxxx"`.
  3. Executes smooth animated scroll to position the target block in the vertical center of the viewport.
  4. Applies a temporary CSS pulse animation (accent background highlight that fades out over 1.5 seconds) to visually orient the user.

---

## 5. Mathematical Formula Rendering Engine (KaTeX)

### 5.1 Delimiter Rules
- **Inline Equations:** Enclosed by single dollar signs: `$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`. The opening `$` must not be followed by whitespace, and the closing `$` must not be preceded by whitespace.
- **Display Equations:** Enclosed by double dollar signs on dedicated lines:
  ```
  $$
  f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2 \pi i \xi x}\,d\xi
  $$
  ```
- **Dollar Escaping:** Literal dollar currency signs are escaped via backslash: `\$100` renders as `$100` and is never parsed as a mathematical delimiter.

### 5.2 Error Isolation Boundary
- Mathematical expressions are rendered using an in-memory KaTeX engine.
- If LaTeX syntax is malformed (e.g., unmatched braces `\frac{a}`):
  - KaTeX rendering errors are caught within a scoped try/catch block.
  - The preview pane renders an inline error pill with a warning icon and the raw expression.
  - Hovering the pill displays the exact LaTeX compilation error message.
  - The rest of the document continues rendering without disruption.

---

## 6. Algorithmic Diagram Rendering Engine (Mermaid)

### 6.1 Delimiter & Supported Diagram Types
- **Delimiter:** Fenced code blocks with the `mermaid` language identifier:
  ````
  ```mermaid
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Proceed]
    B -->|No| D[Halt]
  ```
  ````
- **Supported Diagram Categories:**
  - Flowcharts (`graph` / `flowchart`).
  - Sequence Diagrams (`sequenceDiagram`).
  - Class Diagrams (`classDiagram`).
  - State Diagrams (`stateDiagram-v2`).
  - Entity Relationship Diagrams (`erDiagram`).
  - Gantt Charts (`gantt`).
  - Git Graphs (`gitGraph`).
  - Mindmaps (`mindmap`).

### 6.2 Rendering Lifecycle & Error Handling
1. **Asynchronous SVG Generation:**
   - Mermaid renders to an offscreen DOM node to calculate layout geometry.
   - The generated SVG is sanitized to prevent cross-site scripting (XSS) and injected into the document view.
2. **Syntax Error Boundary:**
   - If the Mermaid parser encounters invalid graph syntax:
   - The error is captured by an isolated error boundary.
   - An error card replaces the diagram area, displaying: "Mermaid Syntax Error: Line X" along with the error description.
   - A toggle button allows the user to view the raw source diagram text directly in Preview Mode.

---

## 7. Link Parsing & Resolution Hierarchy

Stackmynd supports a comprehensive link hierarchy, resolving targets through a deterministic fallback order:

1. **Standard External URLs:**
   - Pattern: `https://...`, `http://...`, `mailto:...`
   - Action: Opens in the host operating system's default web browser via Tauri shell plugin.
2. **Relative Markdown File Links:**
   - Pattern: `[Relative Link](./SubFolder/Note.md)`
   - Action: Resolved relative to the directory containing the source note.
3. **Wikilinks (Document Level):**
   - Pattern: `[[NoteTitle]]` or `[[Folder/NoteTitle]]`
   - Action:
     - First tries exact path relative to workspace root.
     - If not found, searches SQLite index for any file named `NoteTitle.md`.
     - If multiple notes have identical names, resolves to the shallowest note in the tree hierarchy and flags an ambiguity indicator.
4. **Wikilinks (Heading Level):**
   - Pattern: `[[NoteTitle#Heading Text]]`
   - Action: Navigates to note and scrolls to matching heading slug.
5. **Wikilinks (Block Level):**
   - Pattern: `[[NoteTitle#^bk-xxxx]]`
   - Action: Navigates to note and pinpoints exact block anchor.
