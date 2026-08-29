import { Component, For, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import { searchWorkspace, SearchResult, getOrCreateDailyNote } from "@/lib/tauri/commands";

export const SearchModal: Component = () => {
  let inputRef: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);

  let searchTimeout: any = null;

  createEffect(() => {
    if (uiStore.searchOpen()) {
      setTimeout(() => {
        if (inputRef) {
          inputRef.focus();
          inputRef.select();
        }
      }, 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  });

  const doSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await searchWorkspace(trimmed, 20);
      setResults(res);
      setSelectedIndex(0);
    } catch (e) {
      console.warn("Search query failed:", e);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (val: string) => {
    setQuery(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      doSearch(val);
    }, 150);
  };

  const selectResult = (res: SearchResult) => {
    uiStore.setSearchOpen(false);
    tabsStore.openTab(res.path).then(() => {
      if (res.block_id) {
        setTimeout(() => {
          const el = document.getElementById(res.block_id!);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("bg-indigo-500/20", "transition-colors");
            setTimeout(() => el.classList.remove("bg-indigo-500/20"), 2000);
          }
        }, 100);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!uiStore.searchOpen()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      uiStore.setSearchOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (selectedIndex() + 1) % Math.max(1, results().length);
      setSelectedIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (selectedIndex() - 1 + results().length) % Math.max(1, results().length);
      setSelectedIndex(prev);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = results()[selectedIndex()];
      if (current) {
        selectResult(current);
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={uiStore.searchOpen()}>
      <div
        onClick={() => uiStore.setSearchOpen(false)}
        class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-[12vh] z-50 p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="w-full max-w-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Header */}
          <div class="p-3 border-b border-[var(--color-border)] flex items-center space-x-2.5">
            <svg class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search across notes, blocks, #tags, or path:..."
              value={query()}
              onInput={(e) => handleInput(e.currentTarget.value)}
              class="w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden"
            />
            <Show when={isLoading()}>
              <div class="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            </Show>
            <kbd class="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <Show
              when={results().length > 0}
              fallback={
                <div class="p-3 space-y-2">
                  <Show when={!query().trim()}>
                    <div class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-2 pt-1">
                      Quick Commands
                    </div>
                    <div
                      onClick={() => {
                        uiStore.setSearchOpen(false);
                        uiStore.setTemplateModalOpen(true);
                      }}
                      class="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div class="flex items-center space-x-2">
                        <span class="text-indigo-400">📑</span>
                        <span class="font-medium text-[var(--color-text-primary)]">Insert / Create from Template...</span>
                      </div>
                      <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-[10px]">
                        ⌘⌥N
                      </kbd>
                    </div>

                    <div
                      onClick={() => {
                        uiStore.setSearchOpen(false);
                        getOrCreateDailyNote().then((res) => tabsStore.openTab(res.relative_path));
                      }}
                      class="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div class="flex items-center space-x-2">
                        <span class="text-indigo-400">📅</span>
                        <span class="font-medium text-[var(--color-text-primary)]">Open Today's Daily Note</span>
                      </div>
                      <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-[10px]">
                        ⌘⇧D
                      </kbd>
                    </div>
                  </Show>

                  <Show when={query().trim()}>
                    <div class="py-10 text-center text-[var(--color-text-muted)] italic">
                      No matching notes or blocks found.
                    </div>
                  </Show>
                </div>
              }
            >
              <For each={results()}>
                {(res, idx) => {
                  const isSelected = () => selectedIndex() === idx();
                  return (
                    <div
                      onClick={() => selectResult(res)}
                      onMouseEnter={() => setSelectedIndex(idx())}
                      class={`p-2.5 rounded-lg cursor-pointer transition-colors flex flex-col space-y-1 ${
                        isSelected()
                          ? "bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]"
                          : "hover:bg-[var(--color-bg-tertiary)] border border-transparent"
                      }`}
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-1.5 truncate">
                          <span class="font-medium text-[var(--color-text-primary)] truncate">
                            {res.title || res.file_name}
                          </span>
                          <span class="text-[10px] text-[var(--color-text-muted)] truncate">
                            {res.path}
                          </span>
                        </div>

                        <Show when={res.block_id}>
                          <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400 shrink-0">
                            ^{res.block_id}
                          </span>
                        </Show>
                      </div>

                      <div class="text-[11px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                        {res.snippet}
                      </div>

                      <Show when={res.tags && res.tags.length > 0}>
                        <div class="flex flex-wrap gap-1 mt-0.5">
                          <For each={res.tags}>
                            {(t) => (
                              <span class="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/10 text-indigo-400">
                                #{t}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Footer Shortcuts Help */}
          <div class="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)] flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
            <div class="flex items-center space-x-3">
              <span><kbd class="font-mono">↑↓</kbd> Navigate</span>
              <span><kbd class="font-mono">↵</kbd> Open Note / Jump to Block</span>
              <span><kbd class="font-mono">ESC</kbd> Close</span>
            </div>
            <span>Powered by Tantivy BM25</span>
          </div>
        </div>
      </div>
    </Show>
  );
};
