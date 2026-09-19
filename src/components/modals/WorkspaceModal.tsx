import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { uiStore } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";

export const WorkspaceModal: Component = () => {
  const [inputPath, setInputPath] = createSignal("");
  const [inputName, setInputName] = createSignal("");

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiStore.workspaceModalOpen()) {
        uiStore.setWorkspaceModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleBrowseFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
      });
      if (selected && typeof selected === "string") {
        setInputPath(selected);
        if (!inputName()) {
          const parts = selected.replace(/\/+$/, "").split("/");
          const baseName = parts.pop() || "Workspace";
          setInputName(baseName);
        }
      }
    } catch (err) {
      console.warn("Folder picker error or running in non-Tauri:", err);
      const fallback = prompt("Enter directory path:", inputPath() || "");
      if (fallback && fallback.trim()) {
        setInputPath(fallback.trim());
      }
    }
  };

  const handleOpenExisting = async (path: string, name?: string) => {
    await workspaceStore.openWorkspace(path, name);
    uiStore.setWorkspaceModalOpen(false);
  };

  const handleCreateOrOpen = async (e: Event) => {
    e.preventDefault();
    const path = inputPath().trim();
    if (!path) return;
    const name = inputName().trim() || undefined;
    await workspaceStore.openWorkspace(path, name);
    setInputPath("");
    setInputName("");
    uiStore.setWorkspaceModalOpen(false);
  };

  return (
    <Show when={uiStore.workspaceModalOpen()}>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) uiStore.setWorkspaceModalOpen(false);
        }}
        class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      >
        <div class="w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-xs">
          {/* Header */}
          <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <span class="font-semibold text-sm text-[var(--color-text-primary)]">
              Workspace Manager
            </span>
            <button
              onClick={() => uiStore.setWorkspaceModalOpen(false)}
              class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title="Close (Esc)"
              aria-label="Close Workspace Manager"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Known Workspaces */}
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Registered Workspaces
              </span>
              <div class="mt-2 space-y-1.5">
                <Show
                  when={workspaceStore.workspaces().length > 0}
                  fallback={
                    <div class="py-4 text-center text-[var(--color-text-muted)] italic">
                      No saved workspaces.
                    </div>
                  }
                >
                  <For each={workspaceStore.workspaces()}>
                    {(ws) => {
                      const isCurrent = () => workspaceStore.activeWorkspace()?.id === ws.id;
                      return (
                        <div
                          onClick={() => handleOpenExisting(ws.path, ws.name)}
                          class={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isCurrent()
                              ? "bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-text-primary)]"
                              : "bg-[var(--color-bg-tertiary)] border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <div class="flex flex-col truncate pr-2">
                            <span class="font-medium truncate">{ws.name}</span>
                            <span class="text-[10px] text-[var(--color-text-muted)] truncate">
                              {ws.path}
                            </span>
                          </div>
                          <Show when={isCurrent()}>
                            <span class="text-[10px] font-semibold text-[var(--color-accent)] shrink-0">
                              Active
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            </div>

            {/* Open / Create Workspace by Path */}
            <form onSubmit={handleCreateOrOpen} class="pt-3 border-t border-[var(--color-border)] space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Open Directory as Workspace
                </span>
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  class="flex items-center space-x-1 px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-indigo-400 font-medium text-[11px] cursor-pointer transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Browse Folder...</span>
                </button>
              </div>

              <div>
                <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">
                  Directory Path:
                </label>
                <div class="flex items-center space-x-1.5">
                  <input
                    type="text"
                    placeholder="/Users/username/MyNotes"
                    value={inputPath()}
                    onInput={(e) => setInputPath(e.currentTarget.value)}
                    class="flex-1 px-2.5 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden focus:border-[var(--color-accent)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    class="px-2.5 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500"
                    title="Select folder from file manager"
                    aria-label="Select folder from file manager"
                  >
                    📂
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">
                  Workspace Name (Optional):
                </label>
                <input
                  type="text"
                  placeholder="Knowledge Base"
                  value={inputName()}
                  onInput={(e) => setInputName(e.currentTarget.value)}
                  class="w-full px-2.5 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden focus:border-[var(--color-accent)]"
                />
              </div>

              <button
                type="submit"
                class="w-full py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white font-medium cursor-pointer transition-opacity"
              >
                Open / Initialize Workspace
              </button>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
};
