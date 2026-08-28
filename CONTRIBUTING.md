# Contributing to Stackmynd

Thank you for your interest in contributing to **Stackmynd**! 🎉

Stackmynd is a local-first, multi-workspace, block-level Markdown knowledge base engineered for speed, data sovereignty, and precision knowledge management. We welcome contributions from developers, technical writers, and designers.

---

## 1. Code of Conduct

All contributors, maintainers, and community members are expected to uphold a respectful, inclusive, and collaborative environment. Treat all participants with kindness, respect constructive criticism, and focus on delivering high-quality engineering.

---

## 2. Development Setup & Prerequisites

Before contributing, ensure your development environment is properly configured:

### 2.1 Toolchain Requirements
- **Node.js:** v20.x or newer
- **Package Manager:** `pnpm` v9.x or newer
- **Rust:** v1.85.0+ (Rust 2024 edition)
- **Tauri CLI:** v2.x (`cargo install tauri-cli` or via `pnpm tauri`)

### 2.2 Platform-Specific Prerequisites
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** WebKit2GTK, libsoup, and build essentials (e.g., `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev`)
- **Windows:** Microsoft Visual Studio C++ Build Tools with English language pack, WebView2 runtime

---

## 3. Git Workflow & Branch Protection Rules

Stackmynd enforces explicit branch protection and management rules to maintain codebase integrity and stability.

```
       (Feature Complete)
feature/xyz ─────────────────────┐
  (branched from dev)            │ (PR / Self-Merge during rapid iteration)
                                 ▼
dev ─────────────────────────────────────────────────────────────► (Integration)
                                                                 │
                                                                 │ (Release Tag)
main (PROTECTED) ────────────────────────────────────────────────┴► (Stable Release)
```

### 3.1 Branch Architecture & Roles

1. **`main` Branch (Strictly Protected):**
   - Contains only production-ready, stable releases.
   - **Direct commits and direct pushes to `main` are strictly forbidden.**
   - All code entering `main` arrives via formal release merges from `dev`.

2. **`dev` Branch (Active Development Base):**
   - The central integration branch for all ongoing development.
   - **All development work is restricted to the `dev` branch ecosystem.**
   - Do not commit directly to `dev` without a feature branch.

3. **Dedicated Feature Branches:**
   - **All development work MUST take place on dedicated feature branches.**
   - Feature branches must always be created from `dev`:
     ```bash
     git checkout dev
     git pull origin dev
     git checkout -b feature/<descriptive-name>
     ```
   - Standard Branch Naming Conventions:
     - `feature/<name>`: New capabilities or functional enhancements
     - `fix/<name>`: Bug fixes and stability patches
     - `docs/<name>`: Documentation, specifications, and design updates
     - `refactor/<name>`: Code restructuring without functional changes
     - `perf/<name>`: Performance and memory optimizations
     - `test/<name>`: Adding or updating test suites

### 3.2 PR Lifecycle & Branch Cleanup
1. Implement your changes on the dedicated feature branch.
2. Ensure all verification checks (unit tests, type checking, linting) pass locally.
3. Open a Pull Request targeting the `dev` branch.
4. **Rapid Iteration Phase Rule:** During the current rapid iteration phase, contributors and AI coding agents are **permitted to merge their own PRs into `dev`**.
5. Once the PR is merged into `dev`, **the corresponding feature branch must be deleted immediately** to prevent stale branch accumulation:
   ```bash
   git checkout dev
   git pull origin dev
   git branch -d feature/<descriptive-name>
   ```
6. **Post-MVP Branch Protection:** Full branch protection rules for `dev` (requiring independent peer review and blocking CI checks) will be enabled once the MVP phase is formally accepted.

---

## 4. Commit Message Guidelines (Conventional Commits)

Stackmynd strictly adheres to the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```
<type>(<scope>): <short summary>

[optional description explaining context and design rationale]

[optional issue footer, e.g., Closes #108]
```

### 4.1 Allowed Types
- `feat`: A new feature or capability
- `fix`: A bug fix
- `docs`: Documentation changes only
- `style`: Code style changes (formatting, semicolons) that do not affect logic
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: A code change that improves execution speed or reduces memory consumption
- `test`: Adding missing tests or correcting existing tests
- `chore`: Tooling, build pipeline, or dependency maintenance

### 4.2 Commit Examples
- `feat(parser): add remark plugin for ^bk-xxxx block anchors`
- `fix(fs): handle Windows path separators in link repair engine`
- `docs(agents): update branch protection guidelines in AGENTS.md`
- `refactor(db): migrate block index lookup to composite primary key`

---

## 5. Local Verification & Quality Standards

Before submitting or merging any PR into `dev`, verify that the following checks succeed:

```bash
# Rust Unit & Integration Tests
cargo test --manifest-path src-tauri/Cargo.toml

# Rust Linting
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Rust Formatting
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

# TypeScript Type Check
pnpm tsc --noEmit

# Frontend Unit Tests
pnpm test

# Production Build
pnpm build
```

---

## 6. Core Product Invariants Every Contributor Must Respect

When submitting code, ensure that your contribution honors Stackmynd's fundamental architecture:

1. **Markdown Files are the Single Source of Truth:** Never store note bodies in SQLite or proprietary binary files. Notes live exclusively as standard `.md` files on the filesystem.
2. **SQLite is strictly an ephemeral index:** The entire `.stackmynd/` folder must be disposable and 100% reconstructible at any time.
3. **Pure Note-Taking Engine:** Stackmynd does not manage images or media assets. Do not add image hosting, asset viewers, or binary upload handlers. Notes focus strictly on text, KaTeX math, and Mermaid diagrams.
4. **Crash-Resilient Atomic Writes:** Always use the `.tmp.<uuid>` write + fsync + atomic rename pattern.
5. **Debounced Auto-Save:** Typing triggers an 800ms debounce save; `Cmd+S` / `Ctrl+S` triggers immediate save.

---

## 7. Reporting Issues & Proposing Features

- **Bug Reports:** Open an issue on GitHub detailing the operating system, steps to reproduce, expected vs. actual behavior, and sample Markdown content.
- **Feature Requests:** Submit an issue describing the user story, functional requirements, and how the proposal respects Stackmynd's local-first, pure-text philosophy.
