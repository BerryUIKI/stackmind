import { Component, For, Show, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";

export const TrashModal: Component = () => {
  const items = () => workspaceStore.trashItems();

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiStore.trashModalOpen()) {
        uiStore.setTrashModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleRestore = async (trashFilename: string, origPath: string) => {
    await workspaceStore.restoreTrashItem(trashFilename, origPath);
  };

  const handleEmpty = async () => {
    if (confirm("Are you sure you want to permanently delete all items in the Recycle Bin?")) {
      await workspaceStore.clearTrash();
    }
  };

  return (
    <Show when={uiStore.trashModalOpen()}>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) uiStore.setTrashModalOpen(false);
        }}
        class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100"
      >
        <div class="w-full max-w-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden text-xs">
          {/* Header */}
          <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-rose-400 font-semibold text-sm">Recycle Bin</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-400">
                {items().length} items
              </span>
            </div>
            <button
              onClick={() => uiStore.setTrashModalOpen(false)}
              class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* List */}
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <Show
              when={items().length > 0}
              fallback={
                <div class="py-12 text-center text-[var(--color-text-muted)] italic">
                  Recycle bin is empty.
                </div>
              }
            >
              <For each={items()}>
                {(item) => (
                  <div class="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                    <div class="flex flex-col truncate pr-3">
                      <span class="font-medium text-[var(--color-text-primary)] truncate">
                        {item.original_relative_path}
                      </span>
                      <span class="text-[10px] text-[var(--color-text-muted)]">
                        Deleted: {new Date(item.deleted_at).toLocaleString()} • {(item.file_size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <button
                      onClick={() => handleRestore(item.trash_filename, item.original_relative_path)}
                      class="px-2.5 py-1 rounded bg-[var(--color-accent)] hover:opacity-90 text-white font-medium cursor-pointer shrink-0 transition-opacity"
                    >
                      Restore
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)] flex items-center justify-between">
            <button
              onClick={handleEmpty}
              disabled={items().length === 0}
              class="px-3 py-1 rounded text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Empty Recycle Bin
            </button>
            <button
              onClick={() => uiStore.setTrashModalOpen(false)}
              class="px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
