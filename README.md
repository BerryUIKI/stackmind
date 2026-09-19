# Stackmynd

> **Local-First, Multi-Workspace, Block-Level Markdown Knowledge Base**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Stackmynd is a high-performance, local-first knowledge management system built for engineers, researchers, and power users. It combines the atomic granularity of outline and block-based knowledge graphs with the complete data sovereignty and interoperability of plain-text Markdown files stored directly on disk.

---

## Core Philosophy

- **Markdown File = Single Source of Truth:** Every note is an ordinary `.md` file on the physical filesystem. Zero proprietary database containers for note bodies.
- **SQLite = Index & Metadata Cache Only:** The SQLite database is purely disposable and acts as a fast metadata and relational lookup layer.
- **Block-Structured Architecture:** Deterministic `^bk-xxxx` block identifiers and `[[filename#^blockid]]` transclusion references.
- **Full File Freedom:** 100% compatible with external editors (VSCode, Typora, Neovim, terminal scripts).
- **Pure Note-Taking Engine:** Zero media asset or image management complexity; strictly optimized for text, KaTeX math, and Mermaid diagrams.

---

## Technology Stack

- **Application Shell:** Tauri v2
- **Backend Core:** Rust
- **Frontend Framework:** SolidJS
- **Styling:** Tailwind CSS
- **Database:** SQLite (WAL mode, index-only)
- **Search Engine:** Tantivy (Native Rust full-text search)
- **Markdown Pipeline:** custom remark + rehype plugin ecosystem

---

## Key Capabilities & Architectural Features

- **Tri-Mode Editor Viewport:** Seamlessly switch between Source Markdown, Live Rendered Preview (KaTeX math, Mermaid diagrams, GitHub-style alerts), and Synchronized Split View with line-proportional scrolling.
- **Block-Level Knowledge Graph:** Deterministic `^bk-xxxx` block anchoring, bidirectional links (`[[note]]`, `[[note#^blockid]]`), and interactive 60 FPS Canvas2D force-directed physics visualizer.
- **Embedded Git Engine:** Local-first version control providing working tree diffs, staging, commit timelines, and branch management inside the desktop shell.
- **Block & Document Transclusion:** Dynamically embed live notes or discrete blocks with recursion guards and instant preview updates (`![[note#^bk-xxxx]]`).
- **Infinite Text-Block Spatial Canvas:** 2D zoomable visual whiteboard surface for organizing and connecting note and block cards with directed cubic bezier arrows (`.canvas.json`).
- **Daily Notes & Journaling:** Temporal stream-of-consciousness capture with top-right calendar navigation popover and shortcut (`Cmd+Shift+D`).
- **Template System:** Standardized Markdown templates with dynamic date, time, and title interpolation (`Cmd+Alt+N`).
- **External Document Export Suite:** Export any note to standalone self-contained HTML (with embedded KaTeX and typography), zero-dependency native print/PDF (`window.print()`), and clean flattened Markdown (`Cmd+E`).
- **Native Full-Text Search:** Embedded Tantivy engine executing BM25 queries across files and discrete blocks with sub-millisecond latency (`Cmd+K`).

---

## Frozen Specification Documents

All architecture, product specifications, UI behaviors, and data flows are fully documented and frozen prior to engineering implementation:

1. [01. Project Overview & Product Specification](docs/01_PROJECT_OVERVIEW_AND_PRODUCT_SPECIFICATION.md)
2. [02. System Full Architecture Design](docs/02_SYSTEM_ARCHITECTURE_DESIGN.md)
3. [03. Complete UI/UX Layout Specification](docs/03_UI_UX_LAYOUT_SPECIFICATION.md)
4. [04. Markdown Engine Full Specification](docs/04_MARKDOWN_ENGINE_SPECIFICATION.md)
5. [05. File Lifecycle Full Design](docs/05_FILE_LIFECYCLE_DESIGN.md)
6. [06. Multi-Workspace System Design](docs/06_MULTI_WORKSPACE_SYSTEM_DESIGN.md)
7. [07. Search & Tag System Design](docs/07_SEARCH_AND_TAG_SYSTEM_DESIGN.md)
8. [08. Right Side Panel Functional Specification](docs/08_RIGHT_SIDE_PANEL_SPECIFICATION.md)
9. [09. Phase 2 (P2) Product & Architectural Specification](docs/09_PHASE_2_SPECIFICATION.md)
10. [10. Phase 3 (P3) Product & Architectural Specification](docs/10_PHASE_3_SPECIFICATION.md)
11. [Project Milestones & Implementation Schedule (M1 – M20)](docs/MILESTONES.md)

---

## Development & Build Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+) & [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (v1.85+ stable with 2024 edition support)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`

### Installation & Local Run
```bash
# 1. Install frontend dependencies
pnpm install

# 2. Run in development mode (hot reload + Tauri window)
pnpm tauri dev
```

### Quality Assurance & Automated Tests
```bash
# Run Rust unit and integration tests
cargo test --manifest-path src-tauri/Cargo.toml

# Run Rust linter and format checks
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# Strict TypeScript type check
pnpm tsc --noEmit

# Frontend unit tests
pnpm test

# Production build verification
pnpm build
```

---

## Contributing & Agent Guidelines

- [AGENTS.md](AGENTS.md) — Comprehensive guidelines, architectural mental model, constraints, and implementation protocols for AI coding agents and autonomous assistants.
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contributor onboarding, toolchain setup, development workflow, and PR conventions.

---

## Git Branching & Protection Strategy

- **`main`**: Protected branch reserved strictly for verified, stable releases. Direct pushes or commits to `main` are prohibited.
- **`dev`**: Active integration branch. All development is restricted to the `dev` branch ecosystem.
- **Feature Branches (`feature/*`, `fix/*`, `docs/*`)**: All development work must take place on dedicated feature branches branched from `dev`. Once a feature is complete and verified, merge into `dev` and delete the feature branch.
- **Rapid Iteration Phase**: Contributors and agents are permitted to self-merge their PRs into `dev`. Branch protection for `dev` will be enabled after MVP acceptance.

---

## License

This project is licensed under the terms of the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
