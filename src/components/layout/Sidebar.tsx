import { Component, Show } from "solid-js";
import { uiStore } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";
import { tabsStore } from "@/store/tabs";
import { FileTree } from "./FileTree";
import { CalendarWidget } from "./CalendarWidget";

export const Sidebar: Component = () => {
  const handleNewNote = async () => {
    const name = prompt("Enter note name:", "Untitled");
    if (name && name.trim()) {
      const relPath = await workspaceStore.newNote(name.trim());
      await tabsStore.openTab(relPath);
    }
  };

  const handleNewFolder = async () => {
    const name = prompt("Enter folder name:", "New Folder");
    if (name && name.trim()) {
      await workspaceStore.newFolder(name.trim());
    }
  };

  return (
    <aside
      style={{
        width: uiStore.sidebarCollapsed() ? "0px" : `${uiStore.sidebarWidth()}px`,
      }}
      class={`h-full flex flex-col bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] overflow-hidden select-none transition-[width] duration-150 ease-out z-20 ${
        uiStore.sidebarCollapsed() ? "border-r-0" : ""
      }`}
    >
      {/* Workspace Sidebar Header */}
      <div class="h-10 min-h-10 px-3 flex items-center justify-between border-b border-[var(--color-border)]">
        <span class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] truncate">
          {workspaceStore.activeWorkspace()?.name || "Workspace"}
        </span>

        <div class="flex items-center space-x-1">
          <button
            onClick={handleNewNote}
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
            title="New Note (Cmd+N)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleNewFolder}
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
            title="New Folder"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Navigation Widget */}
      <CalendarWidget />

      {/* Filter Tree Search Input */}
      <div class="px-2 py-1.5 border-b border-[var(--color-border)]">
        <div class="relative">
          <input
            type="text"
            placeholder="Filter notes..."
            value={workspaceStore.filterQuery()}
            onInput={(e) => workspaceStore.setFilterQuery(e.currentTarget.value)}
            class="w-full pl-7 pr-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
          />
          <svg
            class="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2 top-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Directory Tree */}
      <FileTree />

      {/* Local Workspace Trash Anchor */}
      <div class="h-9 min-h-9 px-3 flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)]">
        <button
          onClick={() => uiStore.setTrashModalOpen(true)}
          class="flex items-center space-x-2 text-xs text-[var(--color-text-muted)] hover:text-rose-400 cursor-pointer transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Recycle Bin</span>
          <Show when={workspaceStore.trashItems().length > 0}>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-rose-500/20 text-rose-400">
              {workspaceStore.trashItems().length}
            </span>
          </Show>
        </button>
      </div>
    </aside>
  );
};
