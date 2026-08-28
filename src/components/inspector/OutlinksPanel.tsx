import { Component, For, Show, createSignal, createEffect } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { parseDocument, ParsedLink } from "@/lib/tauri/commands";

export const OutlinksPanel: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();
  const [links, setLinks] = createSignal<ParsedLink[]>([]);

  createEffect(async () => {
    const tab = currentTab();
    if (!tab) {
      setLinks([]);
      return;
    }
    try {
      const parsed = await parseDocument(tab.path);
      setLinks(parsed.links);
    } catch (e) {
      console.warn("Failed to load outlinks:", e);
    }
  });

  const handleOpenLink = (targetPath: string) => {
    const fullPath = targetPath.endsWith(".md") ? targetPath : `${targetPath}.md`;
    tabsStore.openTab(fullPath);
  };

  return (
    <div class="space-y-3 text-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Outbound Links ({links().length})
        </span>
      </div>

      <Show
        when={links().length > 0}
        fallback={
          <div class="p-4 text-center text-[var(--color-text-muted)] italic bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            No outbound links found in document.
          </div>
        }
      >
        <div class="space-y-1.5">
          <For each={links()}>
            {(link) => (
              <div
                onClick={() => handleOpenLink(link.target_path)}
                class="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] cursor-pointer transition-colors"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-[var(--color-text-primary)] truncate">
                    {link.target_path}
                  </span>
                  <span class="text-[10px] text-[var(--color-text-muted)] shrink-0">
                    Line {link.line_number}
                  </span>
                </div>

                <Show when={link.target_block_id}>
                  <div class="mt-1 flex items-center space-x-1">
                    <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400">
                      ^{link.target_block_id}
                    </span>
                  </div>
                </Show>

                <Show when={link.alias}>
                  <div class="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                    Alias: "{link.alias}"
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
