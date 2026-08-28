import { Component, Show } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";

export const StatusBar: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();

  const stats = () => {
    const tab = currentTab();
    if (!tab) return { words: 0, chars: 0, blocks: 0 };
    const content = tab.content;
    const chars = content.length;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const blocks = content.split(/\n\s*\n/).filter(Boolean).length;
    return { words, chars, blocks };
  };

  return (
    <footer class="h-6 min-h-6 w-full flex items-center justify-between px-3 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)] select-none z-40">
      {/* Left: Workspace & Indexer Status */}
      <div class="flex items-center space-x-3 truncate">
        <span class="flex items-center space-x-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span class="font-medium truncate max-w-[150px]">
            {workspaceStore.activeWorkspace()?.name || "Local"}
          </span>
        </span>
        <span class="text-[10px] text-[var(--color-text-muted)]">Index: Synced</span>
      </div>

      {/* Center: Save state */}
      <div class="flex items-center space-x-1.5">
        <Show when={currentTab()}>
          <Show
            when={tabsStore.saveStatus() === "saving"}
            fallback={
              <Show
                when={tabsStore.saveStatus() === "unsaved"}
                fallback={
                  <span class="text-emerald-500/80 flex items-center space-x-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Saved</span>
                  </span>
                }
              >
                <span class="text-amber-400/90 font-medium">Unsaved changes</span>
              </Show>
            }
          >
            <span class="text-[var(--color-accent)] animate-pulse">Saving...</span>
          </Show>
        </Show>
      </div>

      {/* Right: Metrics & Cursor tracking */}
      <div class="flex items-center space-x-3">
        <Show when={currentTab()}>
          <span>
            Ln {currentTab()?.cursorLine || 1}, Col {currentTab()?.cursorCol || 1}
          </span>
          <span>{stats().words} words</span>
          <span>{stats().blocks} blocks</span>
        </Show>
        <span class="text-[10px]">UTF-8</span>
      </div>
    </footer>
  );
};
