# Document 09: Phase 2 (P2) Product & Architectural Specification

- **Project Name:** Stackmynd
- **Document Version:** 1.0.0 (FROZEN)
- **Phase:** Phase 2 (P2 Post-MVP Advanced Knowledge Engineering)
- **Status:** Approved Baseline — Unchangeable Law for Phase 2 Implementation

---

## 1. Executive Summary & Phase 2 Objectives

Phase 2 (P2) elevates Stackmynd from an ultra-fast local Markdown note editor into an **interactive visual knowledge brain and version-controlled knowledge repository**.

Building upon the robust foundation of Phase 1 (ephemeral SQLite index, deterministic block anchors, Tantivy BM25 search, and 5-area spatial shell), Phase 2 introduces two core capabilities:
1. **Interactive Force-Directed Knowledge Graph Visualizer**: 2D canvas-accelerated graph view visualizing cross-document wikilinks, block-level references, and tag clusters with real-time physics simulation, depth filtering, and seamless navigation jumps.
2. **Embedded Git Version Control Integration**: Local-first Git integration providing working tree change tracking, visual diffing, commit history exploration, and branch switching without external tooling dependencies.

---

## 2. Invariants & Scope Guardrails for Phase 2

All Phase 2 implementations must strictly respect the foundational invariants:
1. **Markdown Files on Disk Remain the Single Source of Truth:**
   - Git operations commit `.md` files directly on disk.
   - Graph visualizations compute topologies purely from the ephemeral SQLite index and Markdown link tables; no proprietary graph schemas or serialized graph coordinate databases are written to note content.
2. **Strict Non-Media Scope:**
   - Media uploads, image galleries, PDF readers, audio/video previewers remain strictly out of scope.
3. **Workspace Isolation:**
   - Graph topologies and Git states are 100% scoped to the active workspace. Autocomplete, graph nodes, and commit histories must never cross workspace boundaries.
4. **Non-Blocking Background Execution:**
   - Graph physics simulation and Git log querying must execute asynchronously without freezing the 60 FPS editor typing pipeline.

---

## 3. Module 1: Interactive Force-Directed Knowledge Graph Visualizer

### 3.1 Graph Topologies & Data Model

The knowledge graph visualizes relationships across three distinct entity tiers:
1. **Note Nodes (Primary Tier):**
   - Derived from `files` table where `is_deleted = 0`.
   - Node size proportional to inbound degree (number of backlinks) using logarithmic scaling: `radius = clamp(4 + 2 * log2(degree + 1), 4, 24)`.
   - Color coded by primary folder or dominant tag.
2. **Block Nodes (Secondary Tier, Collapsible):**
   - Represents discrete blocks anchored with `^bk-xxxx` that participate in cross-file or in-file block references.
   - Displayed when "Show Blocks" filter is enabled.
3. **Tag Nodes (Tertiary Tier, Optional):**
   - Derived from `tags` and `file_tags` tables.
   - Serves as thematic clusters connecting notes with shared `#tags`.
4. **Edges (Directed Links):**
   - `wikilink`: Direct note-to-note link (`[[target]]`).
   - `block_ref`: Targeted note-to-block link (`[[target#^bk-xxxx]]`).
   - `tag_edge`: Note-to-tag affiliation.

### 3.2 Backend Graph Data IPC API

#### `get_workspace_graph_data`
- **Command:** `get_workspace_graph_data(filter: Option<GraphFilter>) -> Result<WorkspaceGraphData, String>`
- **Output Struct:**
  ```rust
  pub struct GraphNode {
      pub id: String,              // file relative path or block ID
      pub label: String,           // note title or block preview
      pub node_type: String,       // "note", "block", "tag"
      pub path: String,            // note relative path
      pub block_id: Option<String>,
      pub degree: usize,
      pub group: String,           // folder path or tag category
  }

  pub struct GraphEdge {
      pub source: String,          // source node ID
      pub target: String,          // target node ID
      pub edge_type: String,       // "wikilink", "block_ref", "tag"
  }

  pub struct WorkspaceGraphData {
      pub nodes: Vec<GraphNode>,
      pub edges: Vec<GraphEdge>,
  }
  ```

#### `get_local_graph_data`
- **Command:** `get_local_graph_data(relative_path: String, depth: u32) -> Result<WorkspaceGraphData, String>`
- Generates an ego-network centered on `relative_path` expanding up to `depth` hops (default: 1-hop or 2-hop).

### 3.3 Frontend Physics Engine & Canvas Architecture

1. **Rendering Pipeline:**
   - Implemented using HTML5 2D `<canvas>` with device pixel ratio scaling (`window.devicePixelRatio`) for retina-sharp typography and nodes.
   - Offscreen force computation using velocity-Verlet integration:
     - **Link Attraction Force:** Hooke's law spring force pulling connected nodes toward target distance (default: 60px).
     - **Charge Repulsion Force:** Coulomb repulsion pushing distant nodes apart (charge: -120).
     - **Center Gravity Force:** Mild pull toward canvas center (strength: 0.05) preventing disconnected components from drifting infinitely.
     - **Collision Force:** Hard radius boundaries preventing overlapping node circles.
2. **Interactive Controls & Viewport Navigation:**
   - **Pan & Zoom:** Smooth mouse drag for panning; wheel delta for zoom with focal-point preservation (zoom range: 0.1x to 4.0x).
   - **Node Dragging:** Left-click drag on a node locks position during drag and allows organic re-balancing.
   - **Hover Highlight:** Hovering over a node highlights its immediate 1-hop neighbors and connecting edges while dimming unrelated graph elements to 15% opacity.
   - **Hover Card:** Hovering for >250ms displays a floating preview card showing note title, path, tags, and context snippet.
   - **Click Navigation:** Clicking a node opens the document tab in the central viewport; clicking a block node opens the document and smoothly scrolls to `#^bk-xxxx`.
3. **Dual Viewport Presentation Modes:**
   - **Global Graph View (`Cmd+G` / `Ctrl+G`):** Full-screen or dedicated central tab view with HUD controls (Tag filter, Search query, Orphan node toggle, Distance slider, Physics pause/resume).
   - **Local Graph Panel:** Embedded widget in Area 4 (Right Inspector) under a dedicated "Graph" tab showing the active document's local network in real time.

---

## 4. Module 2: Embedded Git Version Control Integration

### 4.1 Architecture & Sandboxed Operations

Stackmynd integrates version control natively for workspace directories that contain a `.git/` repository (or initializes one on demand). All Git operations execute within the active workspace root directory without affecting external repositories.

### 4.2 Backend Git Service API (`src-tauri/src/services/git/`)

1. **Repository Status Check:**
   - **Command:** `git_status() -> Result<GitStatusResult, String>`
   - Detects if workspace is a git repository (`is_repo: bool`).
   - Retrieves current branch name (or `"HEAD detached"`).
   - Reports file states: `modified`, `untracked`, `staged`, `deleted`.
2. **Commit History Log:**
   - **Command:** `git_log(limit: Option<usize>) -> Result<Vec<GitCommit>, String>`
   - Retrieves commit entries: hash (short & full), author name, email, timestamp, commit message, files changed count.
3. **Working Tree Diff Viewer:**
   - **Command:** `git_diff(file_path: Option<String>) -> Result<String, String>`
   - Returns standard unified diff text for a specific file or all unstaged changes.
4. **Create Commit:**
   - **Command:** `git_commit(message: String, stage_all: bool) -> Result<GitCommitResult, String>`
   - Executes atomic commit with specified message.
5. **Branch Management:**
   - **Command:** `git_list_branches() -> Result<GitBranchesResult, String>`
   - **Command:** `git_checkout_branch(branch_name: String) -> Result<(), String>`
   - **Command:** `git_create_branch(branch_name: String) -> Result<(), String>`
   - Automatically triggers workspace directory tree and tab session reloads upon checkout.

### 4.3 Frontend Git UI & Workflows

1. **Status Bar & Title Bar Indicators:**
   - TitleBar / StatusBar displays current branch badge (e.g. ` main`) and dirty file counter (e.g. `• 3 modified`).
2. **Git Management Modal (`Cmd+Shift+G`):**
   - **Working Changes Tab:** Lists modified, untracked, and deleted files with visual status badges; unified side-by-side or inline diff viewer; commit message textarea with "Commit Changes" action.
   - **History Log Tab:** Interactive vertical timeline showing commit history, click commit to view file changes and commit message.
   - **Branches Tab:** List local branches, switch active branch, create new branch.

---

## 5. Phase 2 Implementation Milestones (M10, M11, M12)

| Milestone | Scope | Key Deliverables | Target |
| :--- | :--- | :--- | :--- |
| **M10** | Force-Directed Knowledge Graph Visualizer | Backend graph topology IPC, Canvas2D 60FPS physics engine, Global Graph View, Inspector Local Graph tab, node interactions | `v1.1.0` |
| **M11** | Embedded Git Version Control Engine | Rust Git service, status tracking, unified diff viewer, commit creator, branch management, Git UI Modal | `v1.2.0` |
| **M12** | P2 Integration, Polish & Quality Verification | Global shortcuts (`Cmd+G`, `Cmd+Shift+G`), reactive watcher-git synchronization, full QA test suite passing | `v1.3.0` |

---

## 6. Verification & Quality Acceptance Criteria

Before declaring Phase 2 complete, the following criteria must pass:
1. `cargo test --manifest-path src-tauri/Cargo.toml` with 100% test passes.
2. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` with zero warnings.
3. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` verified.
4. `pnpm tsc --noEmit` with zero type errors.
5. `pnpm test` (Vitest) passing all test suites.
6. `pnpm build` production build verified.
