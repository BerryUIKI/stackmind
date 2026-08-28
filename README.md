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

---

## License

This project is licensed under the terms of the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
