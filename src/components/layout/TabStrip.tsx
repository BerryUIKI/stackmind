import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";
import { uiStore } from "@/store/ui";
import { showInFileManager } from "@/lib/tauri/commands";

export const TabStrip: Component = () => {
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; tabPath: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);

  onMount(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && contextMenu()) {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("contextmenu", handleCloseMenu);
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("contextmenu", handleCloseMenu);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleNewNote = async () => {
    const name = prompt("Enter note name:", "Untitled");
    if (name && name.trim()) {
      const path = await workspaceStore.newNote(name.trim());
      await tabsStore.openTab(path);
    }
  };

  const handleTabContextMenu = (e: MouseEvent, tabPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabPath });
  };

  const handleCloseOtherTabs = (e: MouseEvent) => {
    e.stopPropagation();
    if (contextMenu()) {
      tabsStore.closeOtherTabs(contextMenu()!.tabPath);
    }
    setContextMenu(null);
  };

  const handleCloseTabsToRight = (e: MouseEvent) => {
    e.stopPropagation();
    if (contextMenu()) {
      tabsStore.closeTabsToRight(contextMenu()!.tabPath);
    }
    setContextMenu(null);
  };

  const handleCopyTabPath = (e: MouseEvent) => {
    e.stopPropagation();
    if (contextMenu()) {
      navigator.clipboard.writeText(contextMenu()!.tabPath);
    }
    setContextMenu(null);
  };

  return (
    <div class="h-9 min-h-9 flex items-center bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-2 overflow-x-auto select-none no-scrollbar relative">
      <div class="flex items-center space-x-1">
        <For each={tabsStore.tabs()}>
          {(tab, idx) => {
            const isActive = () => tabsStore.activeTabPath() === tab.path;
            return (
              <div
                draggable={true}
                onDragStart={(e) => {
                  setDraggedIndex(idx());
                  e.dataTransfer?.setData("text/plain", String(idx()));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draggedIndex();
                  if (from !== null && from !== idx()) {
                    tabsStore.reorderTabs(from, idx());
                  }
                  setDraggedIndex(null);
                }}
                onClick={() => tabsStore.setActiveTabPath(tab.path)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.path)}
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
                } ${
                  draggedIndex() !== null && draggedIndex() !== idx()
                    ? "outline-dashed outline-1 outline-indigo-400/80 bg-indigo-500/10"
                    : ""
                }`}
                title={tab.path}
                aria-label={`Tab: ${tab.title}`}
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
                        aria-label="Close Tab"
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
                      aria-label="Close Tab"
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
          aria-label="New Note"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Tab Right-Click Context Menu */}
      <Show when={contextMenu()}>
        <div
          style={{
            position: "fixed",
            left: `${Math.min(contextMenu()!.x, window.innerWidth - 180)}px`,
            top: `${Math.min(contextMenu()!.y + 5, window.innerHeight - 180)}px`,
            "z-index": 1000,
          }}
          class="w-48 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-75 text-[var(--color-text-primary)] font-sans"
        >
          <button
            onClick={() => {
              if (contextMenu()) tabsStore.closeTab(contextMenu()!.tabPath);
              setContextMenu(null);
            }}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Close Tab</span>
            <span class="text-[10px] text-[var(--color-text-muted)]">⌘W</span>
          </button>
          <button
            onClick={handleCloseOtherTabs}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Close Other Tabs</span>
          </button>
          <button
            onClick={handleCloseTabsToRight}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Close Tabs to Right</span>
          </button>
          <div class="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleCopyTabPath}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>📋</span>
            <span>Copy Note Path</span>
          </button>
          <button
            onClick={() => {
              if (contextMenu()) {
                showInFileManager(contextMenu()!.tabPath);
              }
              setContextMenu(null);
            }}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>📂</span>
            <span>Reveal in File Manager</span>
          </button>
          <div class="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={() => {
              if (contextMenu()) {
                uiStore.setExportTargetNote(contextMenu()!.tabPath);
                uiStore.setExportModalOpen(true);
              }
              setContextMenu(null);
            }}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div class="flex items-center space-x-2">
              <span>📤</span>
              <span>Export Note...</span>
            </div>
            <span class="text-[10px] text-[var(--color-text-muted)]">⌘E</span>
          </button>
        </div>
      </Show>
    </div>
  );
};
