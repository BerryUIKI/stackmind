import { Component, For, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";
import { tabsStore } from "@/store/tabs";
import {
  gitStatus,
  gitDiff,
  gitCommit,
  gitLog,
  gitListBranches,
  gitCheckoutBranch,
  gitCreateBranch,
  GitStatusResult,
  GitCommit,
  GitBranch,
} from "@/lib/tauri/commands";

type GitTab = "changes" | "history" | "branches";

export const GitModal: Component = () => {
  const [activeTab, setActiveTab] = createSignal<GitTab>("changes");
  const [status, setStatus] = createSignal<GitStatusResult>({
    is_repo: false,
    branch: "",
    files: [],
    clean: true,
  });
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [diffText, setDiffText] = createSignal<string>("");
  const [commitMessage, setCommitMessage] = createSignal("");
  const [history, setHistory] = createSignal<GitCommit[]>([]);
  const [branches, setBranches] = createSignal<GitBranch[]>([]);
  const [newBranchName, setNewBranchName] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const refreshGitData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const st = await gitStatus();
      setStatus(st);

      if (st.is_repo) {
        if (st.files.length > 0) {
          const target = selectedFile() || st.files[0].path;
          setSelectedFile(target);
          loadDiff(target);
        } else {
          setSelectedFile(null);
          setDiffText("");
        }

        if (activeTab() === "history") {
          const logs = await gitLog(40);
          setHistory(logs);
        } else if (activeTab() === "branches") {
          const br = await gitListBranches();
          setBranches(br.branches);
        }
      }
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : "Failed to load Git status");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiff = async (filePath?: string) => {
    try {
      const diff = await gitDiff(filePath);
      setDiffText(diff || "No changes detected in working copy.");
    } catch (e: any) {
      setDiffText(`Error loading diff: ${e}`);
    }
  };

  createEffect(() => {
    if (uiStore.gitModalOpen()) {
      refreshGitData();
    }
  });

  createEffect(() => {
    if (uiStore.gitModalOpen() && activeTab() === "history") {
      gitLog(40).then(setHistory).catch(console.warn);
    } else if (uiStore.gitModalOpen() && activeTab() === "branches") {
      gitListBranches().then((res) => setBranches(res.branches)).catch(console.warn);
    }
  });

  const handleCommit = async () => {
    const msg = commitMessage().trim();
    if (!msg) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await gitCommit(msg, true);
      setCommitMessage("");
      await refreshGitData();
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : "Commit failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async (branchName: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await gitCheckoutBranch(branchName);
      await refreshGitData();
      await workspaceStore.refreshTree();
      await tabsStore.reloadOpenTabs();
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : "Checkout failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    const name = newBranchName().trim();
    if (!name) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await gitCreateBranch(name);
      setNewBranchName("");
      await refreshGitData();
      await workspaceStore.refreshTree();
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : "Branch creation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && uiStore.gitModalOpen()) {
      e.preventDefault();
      uiStore.setGitModalOpen(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={uiStore.gitModalOpen()}>
      <div
        onClick={() => uiStore.setGitModalOpen(false)}
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="w-full max-w-4xl h-[78vh] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div class="h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-between shrink-0">
            <div class="flex items-center space-x-3">
              <div class="flex items-center space-x-1.5 text-indigo-400 font-semibold text-sm">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>Version Control</span>
              </div>

              <Show when={status().is_repo}>
                <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                   {status().branch}
                </span>
              </Show>
            </div>

            {/* Tab Buttons */}
            <div class="flex items-center space-x-1 bg-[var(--color-bg-secondary)] p-0.5 rounded-lg border border-[var(--color-border)]">
              <button
                onClick={() => setActiveTab("changes")}
                class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab() === "changes"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                Changes ({status().files.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab() === "history"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab("branches")}
                class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab() === "branches"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                Branches
              </button>
            </div>

            <div class="flex items-center space-x-2">
              <button
                onClick={refreshGitData}
                class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Refresh Status"
              >
                <svg class={`w-4 h-4 ${isLoading() ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => uiStore.setGitModalOpen(false)}
                class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                title="Close (ESC)"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          <Show when={errorMsg()}>
            <div class="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
              <span>{errorMsg()}</span>
              <button onClick={() => setErrorMsg(null)} class="text-rose-400 hover:text-rose-300 font-bold">×</button>
            </div>
          </Show>

          {/* Body Content */}
          <div class="flex-1 overflow-hidden flex flex-col">
            <Show
              when={status().is_repo}
              fallback={
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <svg class="w-12 h-12 text-[var(--color-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div class="font-medium text-sm text-[var(--color-text-primary)] mb-1">
                    Not a Git Repository
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)] max-w-sm mb-4">
                    The active workspace directory is not initialized as a Git repository. Run <code class="font-mono bg-[var(--color-bg-tertiary)] px-1 rounded">git init</code> in terminal or open a Git workspace.
                  </div>
                </div>
              }
            >
              {/* TAB 1: CHANGES */}
              <Show when={activeTab() === "changes"}>
                <div class="flex-1 flex overflow-hidden">
                  {/* File List Pane */}
                  <div class="w-64 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-sidebar)]">
                    <div class="p-2 border-b border-[var(--color-border)] font-semibold text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Working Tree Files ({status().files.length})
                    </div>
                    <div class="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                      <Show
                        when={status().files.length > 0}
                        fallback={
                          <div class="py-12 text-center text-[var(--color-text-muted)] italic">
                            Working directory is clean.
                          </div>
                        }
                      >
                        <For each={status().files}>
                          {(file) => (
                            <div
                              onClick={() => {
                                setSelectedFile(file.path);
                                loadDiff(file.path);
                              }}
                              class={`px-2 py-1.5 rounded flex items-center justify-between cursor-pointer transition-colors ${
                                selectedFile() === file.path
                                  ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium"
                                  : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              <span class="truncate">{file.path}</span>
                              <span
                                class={`px-1 rounded text-[9px] font-mono uppercase font-bold shrink-0 ${
                                  file.status === "untracked"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : file.status === "deleted"
                                    ? "bg-rose-500/20 text-rose-400"
                                    : file.status === "staged"
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {file.status === "untracked" ? "U" : file.status === "deleted" ? "D" : file.status === "staged" ? "S" : "M"}
                              </span>
                            </div>
                          )}
                        </For>
                      </Show>
                    </div>

                    {/* Commit Box */}
                    <div class="p-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-2">
                      <textarea
                        placeholder="Commit message (e.g. docs: update notes)..."
                        value={commitMessage()}
                        onInput={(e) => setCommitMessage(e.currentTarget.value)}
                        rows={2}
                        class="w-full p-2 text-xs rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden resize-none"
                      />
                      <button
                        onClick={handleCommit}
                        disabled={!commitMessage().trim() || status().files.length === 0 || isLoading()}
                        class="w-full py-1.5 rounded font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        Commit All Changes
                      </button>
                    </div>
                  </div>

                  {/* Diff Viewer Pane */}
                  <div class="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg-primary)] font-mono text-xs">
                    <div class="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Diff: <strong class="text-[var(--color-text-primary)]">{selectedFile() || "All changes"}</strong></span>
                    </div>

                    <div class="flex-1 overflow-auto p-3 whitespace-pre custom-scrollbar leading-relaxed">
                      <For each={diffText().split("\n")}>
                        {(line) => {
                          const isAdd = line.startsWith("+") && !line.startsWith("+++");
                          const isDel = line.startsWith("-") && !line.startsWith("---");
                          const isHunk = line.startsWith("@@");

                          return (
                            <div
                              class={`${
                                isAdd
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : isDel
                                  ? "bg-rose-500/10 text-rose-400"
                                  : isHunk
                                  ? "text-sky-400 font-bold"
                                  : "text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {line}
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </Show>

              {/* TAB 2: HISTORY */}
              <Show when={activeTab() === "history"}>
                <div class="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                  <Show
                    when={history().length > 0}
                    fallback={
                      <div class="py-16 text-center text-[var(--color-text-muted)] italic">
                        No commit history found in this repository.
                      </div>
                    }
                  >
                    <For each={history()}>
                      {(commit) => (
                        <div class="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] space-y-1.5">
                          <div class="flex items-center justify-between">
                            <span class="font-semibold text-[var(--color-text-primary)] text-sm">
                              {commit.message}
                            </span>
                            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                              {commit.short_hash}
                            </span>
                          </div>
                          <div class="flex items-center space-x-3 text-[10px] text-[var(--color-text-muted)]">
                            <span>Author: <strong class="text-[var(--color-text-secondary)]">{commit.author}</strong></span>
                            <span>Date: {new Date(commit.timestamp * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>

              {/* TAB 3: BRANCHES */}
              <Show when={activeTab() === "branches"}>
                <div class="flex-1 p-4 flex flex-col space-y-4">
                  {/* Create New Branch Bar */}
                  <div class="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="New branch name (e.g. feature/my-notes)..."
                      value={newBranchName()}
                      onInput={(e) => setNewBranchName(e.currentTarget.value)}
                      class="flex-1 px-3 py-1.5 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-hidden"
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={!newBranchName().trim() || isLoading()}
                      class="px-3 py-1.5 rounded font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      Create & Switch
                    </button>
                  </div>

                  {/* Branches List */}
                  <div class="flex-1 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sidebar)] custom-scrollbar">
                    <For each={branches()}>
                      {(branch) => (
                        <div class="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors">
                          <div class="flex items-center space-x-2">
                            <span class="font-mono text-sm text-[var(--color-text-primary)]">
                              {branch.name}
                            </span>
                            <Show when={branch.is_current}>
                              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 uppercase">
                                Current
                              </span>
                            </Show>
                          </div>

                          <Show when={!branch.is_current}>
                            <button
                              onClick={() => handleCheckout(branch.name)}
                              disabled={isLoading()}
                              class="px-2.5 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                            >
                              Checkout
                            </button>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
