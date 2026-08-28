import { Component, For, Show } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";

export const TabStrip: Component = () => {
  const handleNewNote = async () => {
    const name = prompt("Enter note name:", "Untitled");
    if (name && name.trim()) {
      const path = await workspaceStore.newNote(name.trim());
      await tabsStore.openTab(path);
    }
  };

  return (
    <div class="h-9 min-h-9 flex items-center bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-2 overflow-x-auto select-none no-scrollbar">
      <div class="flex items-center space-x-1">
        <For each={tabsStore.tabs()}>
          {(tab) => {
            const isActive = () => tabsStore.activeTabPath() === tab.path;
            return (
              <div
                onClick={() => tabsStore.setActiveTabPath(tab.path)}
                onMouseDown={(e) => {
                  // Middle-click to close
                  if (e.button === 1) {
                    e.preventDefault();
                    tabsStore.closeTab(tab.path);
                  }
                }}
                class={`group flex items-center space-x-2 px-3 py-1 text-xs rounded-t-md cursor-pointer transition-colors border-t-2 ${
                  isActive()
                    ? "bg-[var(--color-bg-secondary)] border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium shadow-xs"
                    : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <span class="truncate max-w-[140px]">{tab.title}</span>

                {/* Dirty bullet or close cross */}
                <div class="flex items-center w-4 h-4 justify-center">
                  <Show
                    when={tab.isDirty}
                    fallback={
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          tabsStore.closeTab(tab.path);
                        }}
                        class="opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-tertiary)] p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-opacity"
                        title="Close Tab"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    }
                  >
                    <span
                      class="w-2 h-2 rounded-full bg-[var(--color-accent)] group-hover:hidden"
                      title="Unsaved changes"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tabsStore.closeTab(tab.path);
                      }}
                      class="hidden group-hover:block hover:bg-[var(--color-bg-tertiary)] p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      title="Close Tab"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>

        {/* Add new tab button */}
        <button
          onClick={handleNewNote}
          class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          title="New Note"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
};
