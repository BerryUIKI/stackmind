import { Component, For, Show, createSignal, createEffect } from "solid-js";
import { tabsStore } from "@/store/tabs";
import {
  getFileBacklinks,
  searchWorkspace,
  BacklinkItem,
  SearchResult,
  readFile,
  writeFileAtomic,
} from "@/lib/tauri/commands";

export const BacklinksPanel: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();
  const [backlinks, setBacklinks] = createSignal<BacklinkItem[]>([]);
  const [unlinkedMentions, setUnlinkedMentions] = createSignal<SearchResult[]>([]);

  createEffect(async () => {
    const tab = currentTab();
    if (!tab) {
      setBacklinks([]);
      setUnlinkedMentions([]);
      return;
    }

    // 1. Fetch linked mentions from SQLite index
    try {
      const links = await getFileBacklinks(tab.path);
      setBacklinks(links);
    } catch (e) {
      console.warn("Failed to load backlinks:", e);
    }

    // 2. Search for unlinked mentions
    try {
      const results = await searchWorkspace(tab.title, 10);
      // Filter out current file and exact wikilinks
      const filtered = results.filter(
        (r) => r.path !== tab.path && !r.snippet.includes(`[[${tab.title}`)
      );
      setUnlinkedMentions(filtered);
    } catch (e) {
      console.warn("Failed to load unlinked mentions:", e);
    }
  });

  const handleOpenSource = (sourcePath: string) => {
    tabsStore.openTab(sourcePath);
  };

  const handleConvertUnlinked = async (item: SearchResult) => {
    const tab = currentTab();
    if (!tab) return;

    try {
      const payload = await readFile(item.path);
      const title = tab.title;
      // Regex replace case-insensitive first mention with [[title]]
      const regex = new RegExp(`\\b${title}\\b`, "i");
      if (regex.test(payload.content)) {
        const updated = payload.content.replace(regex, `[[${title}]]`);
        await writeFileAtomic(item.path, updated);
        // Refresh unlinked list
        setUnlinkedMentions(unlinkedMentions().filter((u) => u.path !== item.path));
        // Refresh backlinks
        const refreshedLinks = await getFileBacklinks(tab.path);
        setBacklinks(refreshedLinks);
      }
    } catch (e) {
      console.error("Failed to convert unlinked mention:", e);
    }
  };

  return (
    <div class="space-y-4 text-xs">
      {/* Linked Mentions */}
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Linked Mentions ({backlinks().length})
        </span>

        <div class="mt-2 space-y-1.5">
          <Show
            when={backlinks().length > 0}
            fallback={
              <div class="p-3 text-center text-[var(--color-text-muted)] italic bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                No notes link to this document yet.
              </div>
            }
          >
            <For each={backlinks()}>
              {(b) => (
                <div
                  onClick={() => handleOpenSource(b.source_file_path)}
                  class="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] cursor-pointer transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-[var(--color-text-primary)] truncate">
                      {b.source_file_name}
                    </span>
                    <span class="text-[10px] text-[var(--color-text-muted)] shrink-0">
                      Line {b.line_number}
                    </span>
                  </div>

                  <Show when={b.target_block_id}>
                    <div class="mt-0.5">
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400">
                        ^{b.target_block_id}
                      </span>
                    </div>
                  </Show>

                  <Show when={b.context_snippet}>
                    <div class="mt-1 text-[11px] text-[var(--color-text-secondary)] italic bg-[var(--color-bg-tertiary)] p-1.5 rounded truncate">
                      "{b.context_snippet}"
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* Unlinked Mentions */}
      <div class="pt-3 border-t border-[var(--color-border)]">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Unlinked Mentions ({unlinkedMentions().length})
        </span>

        <div class="mt-2 space-y-1.5">
          <Show
            when={unlinkedMentions().length > 0}
            fallback={
              <div class="p-3 text-center text-[var(--color-text-muted)] italic bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                No unlinked mentions found.
              </div>
            }
          >
            <For each={unlinkedMentions()}>
              {(u) => (
                <div class="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-[var(--color-text-primary)] truncate">
                      {u.file_name}
                    </span>
                    <button
                      onClick={() => handleConvertUnlinked(u)}
                      class="px-2 py-0.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white text-[10px] font-medium cursor-pointer shrink-0 transition-opacity"
                    >
                      + Link
                    </button>
                  </div>

                  <div class="mt-1 text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] p-1.5 rounded">
                    {u.snippet}
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};
