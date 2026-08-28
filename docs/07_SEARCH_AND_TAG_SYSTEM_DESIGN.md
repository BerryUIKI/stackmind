# Document 07: Search & Tag System Design

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Product Type:** Local-first multi-workspace block-level Markdown knowledge base
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Status:** Approved Baseline — Unchangeable Law for Engineering Implementation

---

## 1. Search Engine Architecture & Tantivy Integration

Stackmynd integrates Tantivy, a high-performance native Rust search engine library inspired by Apache Lucene, to power instantaneous, local-first search across hundreds of thousands of notes and blocks without external server dependencies or Electron overhead.

```
+-------------------------------------------------------------------------+
|                           User Search Input                             |
|          "tag:rust AND memory NOT electron title:architecture"          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                          Rust Query Parser                              |
| - Deconstructs Boolean operators (AND, OR, NOT)                         |
| - Extracts field filters (title:, path:, tag:, block:)                  |
| - Generates Tantivy Query AST                                           |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                     Tantivy Execution Engine                            |
| - Fast field scans & Inverted Index traversals                          |
| - Dynamic BM25 scoring with field boosting weights                      |
| - Recency score dampening based on mtime                                |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                  Aggregated Search Results Payload                      |
| - Title matches, block snippets, highlighting offsets, line numbers     |
| - Dispatched to SolidJS Quick Search Modal via Tauri IPC                |
+-------------------------------------------------------------------------+
```

### 1.1 Tantivy Schema Structure Specification
Each workspace maintains an isolated Tantivy index located at `<workspace_root>/.stackmynd/search_index/`. The index schema is structured as follows:

| Field Name | Tantivy Field Type | Index Options | Fast Field | Stored | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `doc_id` | Text (String) | Exact (Raw) | No | Yes | Composite identifier (`file_id` or `file_id:block_id`) |
| `workspace_id` | Text (String) | Exact (Raw) | Yes | Yes | Workspace UUID boundary marker |
| `relative_path`| Text (String) | Exact (Raw) | Yes | Yes | Normalized path of the file |
| `file_title` | Text (Text) | Tokenized with English stemmer + raw | Yes | Yes | Note title (boosted 3.0x in scoring) |
| `is_block` | Integer (u64) | None | Yes | Yes | Flag: 0 = Document summary, 1 = Atomic block |
| `block_id` | Text (String) | Exact (Raw) | No | Yes | Semantic block ID (`bk-xxxx`) |
| `block_type` | Text (String) | Exact (Raw) | Yes | Yes | Heading, paragraph, quote, code, table, math |
| `content` | Text (Text) | Tokenized + positions for phrase match | No | Yes | Full text of document or individual block |
| `tags` | Text (Facet) | Faceted hierarchical index | Yes | Yes | Array of normalized tags |
| `mtime_ms` | Integer (u64) | None | Yes | Yes | Last modified timestamp for recency scoring |

---

## 2. Search Workflow & Query Syntax

### 2.1 Search User Interface (`Cmd+K` / `Ctrl+K`)
- Triggered instantly via keyboard shortcut or title bar search button.
- Renders a floating, centered command palette modal with backdrop blur.
- Features:
  - High-speed search input bar with auto-focus.
  - Filter chip selectors: `All`, `Titles Only`, `Blocks Only`, `Tags`.
  - Live results list featuring virtual scrolling (supporting 1,000+ matches with zero UI lag).
  - Selected item preview pane showing formatted text snippet with search term highlights.
  - Keyboard navigation: Up/Down arrow keys to traverse, `Enter` to navigate to note/block, `Cmd+Enter` to open in new tab, `Escape` to dismiss.

### 2.2 Formal Query Syntax & Operators

Stackmynd supports a powerful, intuitive search language:

1. **Standard Term Search:**
   - Query: `compiler architecture`
   - Behavior: Performs BM25 keyword search matching notes containing either or both terms, scored by frequency and proximity.
2. **Exact Phrase Matching:**
   - Query: `"atomic file save"`
   - Behavior: Matches notes where words appear in the exact order specified, leveraging Tantivy positional indexes.
3. **Prefix & Wildcard Queries:**
   - Query: `struct*`
   - Behavior: Matches `structure`, `structural`, `structured`.
4. **Field-Specific Scopes:**
   - `title:spec` : Restricts match to document titles.
   - `path:Engineering/` : Restricts results to files within the `Engineering` folder tree.
   - `block:true` : Restricts search to atomic block snippets instead of whole documents.
   - `tag:#rust` or `tag:rust` : Restricts results to documents or blocks containing the tag.
5. **Boolean Operators:**
   - Query: `rust AND (tauri OR webview) NOT electron`
   - Behavior: Evaluates boolean logical trees strictly. Operators must be capitalized (`AND`, `OR`, `NOT`).

### 2.3 Ranking & Relevance Scoring Model
Search results are sorted by a composite scoring algorithm:
- **Base Score:** Tantivy BM25 score.
- **Field Boost Multipliers:**
  - Matches in `file_title`: 3.0x multiplier.
  - Matches in Heading blocks (`block_type == "heading"`): 2.2x multiplier.
  - Matches in `tags`: 2.0x multiplier.
  - Matches in Body Paragraphs: 1.0x (standard weight).
- **Recency Decay Factor:** Notes modified within the last 7 days receive a small fractional boost (up to +15%) to prioritize actively maintained knowledge on score ties.

---

## 3. Tag System: Parsing, Binding & Filtering

Tags provide cross-cutting categorical taxonomies across documents and blocks.

### 3.1 Tag Syntax & Grammar
- **Prefix:** Must begin with a hash character (`#`).
- **Permitted Characters:** Alphanumeric characters, hyphens, and underscores: `#[a-zA-Z0-9_-]+`.
- **Hierarchical Nesting:** Nested tags use forward slashes: `#project/stackmynd/architecture`. Stackmynd automatically builds a navigable taxonomy tree from nested slashes.
- **Exclusion Rules (What is NOT a Tag):**
  - Pure numbers: `#123` is treated as an issue or line reference, not a tag.
  - Hex colors: `#ffffff`, `#333`, etc., in CSS or Markdown color values are ignored.
  - Delimited code: Any text inside inline backticks (`` `#not-a-tag` ``) or fenced code blocks is strictly ignored.
  - Markdown Headings: `# Heading 1` is not a tag because it is followed by whitespace.

### 3.2 Dual-Source Tag Extraction Engine

The Markdown engine extracts tags from two distinct sources:
1. **Frontmatter Tag List:**
   - Declared in YAML:
     ```yaml
     tags:
       - rust
       - architecture/storage
     ```
   - Associated globally with the entire file (`file_tags` table).
2. **Inline Body Tags:**
   - Declared directly in text: `This is a note concerning #system/database architecture.`
   - Associated with both the containing file and the specific enclosing block (`block_tags` table).

### 3.3 SQLite Tag Normalization & Graphing
- All tag names are normalized to lowercase in SQLite to ensure case-insensitive consistency (e.g., `#Rust` and `#rust` map to the identical tag record).
- Tags are indexed in the `tags`, `file_tags`, and `block_tags` tables.
- Tag deletions: If a tag is removed from all notes on disk, incremental synchronization cleans up orphaned tag rows from the database.

### 3.4 Tag Navigation & Filtering Interactions
- **Clicking a Tag in Preview Mode:** Clicking any `#tag` anchor in the rendered view immediately opens the Search Palette with `tag:<tagname>` pre-filled.
- **Right Inspector Tag Cloud:** The Metadata tab in the right inspector lists all tags attached to the active document with frequency counts and provides an "Add Tag" chip input.
- **Hierarchical Tag Tree View:** In the search modal and auxiliary panel, nested tags render as a collapsible tree:
  - `project` (12 notes)
    - `stackmynd` (8 notes)
      - `architecture` (4 notes)

---

## 4. Search Scope Rules & Performance Budgets

### 4.1 Search Scope Categories

1. **Scope 1: Title & File Path Search**
   - Matches file basenames and directory ancestry.
   - Latency Target: < 5 ms across 50,000 files.
2. **Scope 2: Full Document Body Search**
   - Matches words occurring anywhere within notes.
   - Extracts relevant surrounding 120-character snippet with match boundaries.
   - Latency Target: < 25 ms across 50,000 notes.
3. **Scope 3: Atomic Block Search**
   - Searches individual blocks directly.
   - Clicking a block search result jumps directly to that block anchor (`^bk-xxxx`) in the target note.
   - Latency Target: < 35 ms across 250,000 blocks.

### 4.2 Background Indexing & Concurrency Protection
- Index updates run on an asynchronous worker thread with an MPSC queue.
- Tantivy index writers maintain an in-memory buffer of 64 MB.
- Commits are executed with a 2,000 ms debounce after editing ceases, preventing disk thrashing during rapid typing.
- Tantivy readers utilize copy-on-write segment readers, ensuring searches are never blocked or paused during active indexing writes.
