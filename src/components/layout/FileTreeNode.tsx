import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { FileNode, showInFileManager } from "@/lib/tauri/commands";
import { workspaceStore } from "@/store/workspace";
import { tabsStore } from "@/store/tabs";
import { uiStore } from "@/store/ui";

interface Props {
  node: FileNode;
  level: number;
}

export const FileTreeNode: Component<Props> = (props) => {
  const isExpanded = () => workspaceStore.expandedFolders().has(props.node.relative_path);
  const isActive = () => tabsStore.activeTabPath() === props.node.relative_path;

  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number } | null>(null);

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

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.node.is_dir) {
      workspaceStore.toggleFolder(props.node.relative_path);
    } else {
      tabsStore.openTab(props.node.relative_path);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = async (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    const oldName = props.node.name;
    const isMd = oldName.endsWith(".md");
    const baseName = isMd ? oldName.replace(/\.md$/, "") : oldName;
    const newName = prompt("Enter new name:", baseName);
    if (!newName || newName.trim() === "" || newName.trim() === baseName) return;

    const trimmed = newName.trim();
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      alert("Name cannot contain slashes ('/' or '\\').");
      return;
    }

    const parentDir = props.node.relative_path.includes("/")
      ? props.node.relative_path.substring(0, props.node.relative_path.lastIndexOf("/"))
      : "";
    const finalNewName = isMd ? (trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`) : trimmed;
    const newRelPath = parentDir ? `${parentDir}/${finalNewName}` : finalNewName;

    const allNotes = workspaceStore.getAllNotePaths();
    if (allNotes.includes(newRelPath)) {
      alert(`An item with name "${finalNewName}" already exists.`);
      return;
    }

    try {
      await workspaceStore.renameItem(props.node.relative_path, newRelPath);
      if (tabsStore.activeTabPath() === props.node.relative_path) {
        tabsStore.openTab(newRelPath);
        tabsStore.closeTab(props.node.relative_path);
      }
    } catch (err) {
      alert(`Failed to rename: ${String(err)}`);
    }
  };

  const handleDelete = (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    if (confirm(`Move "${props.node.name}" to workspace trash?`)) {
      workspaceStore.removeToTrash(props.node.relative_path);
      if (tabsStore.activeTabPath() === props.node.relative_path) {
        tabsStore.closeTab(props.node.relative_path);
      }
    }
  };

  const handleCopyPath = (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    navigator.clipboard.writeText(props.node.relative_path);
  };

  const handleNewNoteInside = async (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    const name = prompt("Enter note name:", "Untitled");
    if (!name || !name.trim()) return;
    const rel = `${props.node.relative_path}/${name.trim()}`;
    const finalPath = await workspaceStore.newNote(rel);
    await tabsStore.openTab(finalPath);
  };

  const handleNewFolderInside = async (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    const name = prompt("Enter folder name:", "New Folder");
    if (!name || !name.trim()) return;
    const rel = `${props.node.relative_path}/${name.trim()}`;
    await workspaceStore.newFolder(rel);
  };

  return (
    <div class="select-none text-xs">
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ "padding-left": `${props.level * 14 + 10}px` }}
        class={`group flex items-center justify-between py-1 pr-2 rounded-md cursor-pointer transition-colors ${
          isActive()
            ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        <div class="flex items-center space-x-1.5 truncate">
          <Show
            when={props.node.is_dir}
            fallback={
              <svg class="w-3.5 h-3.5 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            <svg
              class={`w-3.5 h-3.5 shrink-0 text-amber-400 transition-transform ${isExpanded() ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </Show>
          <span class="truncate">{props.node.name.replace(/\.md$/, "")}</span>
        </div>

        {/* Action icons on hover */}
        <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
          <button
            onClick={handleDelete}
            class="p-0.5 rounded hover:bg-rose-500/20 text-[var(--color-text-muted)] hover:text-rose-400 cursor-pointer"
            title="Move to Trash"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Context Menu */}
      <Show when={contextMenu()}>
        <div
          style={{
            position: "fixed",
            left: `${Math.min(contextMenu()!.x, window.innerWidth - 180)}px`,
            top: `${Math.min(contextMenu()!.y, window.innerHeight - 200)}px`,
            "z-index": 1000,
          }}
          class="w-44 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-75 text-[var(--color-text-primary)] font-sans"
        >
          <Show when={props.node.is_dir}>
            <button
              onClick={handleNewNoteInside}
              class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
            >
              <span>📄</span>
              <span>New Note Inside</span>
            </button>
            <button
              onClick={handleNewFolderInside}
              class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
            >
              <span>📁</span>
              <span>New Folder Inside</span>
            </button>
            <div class="my-1 border-t border-[var(--color-border)]" />
          </Show>

          <button
            onClick={handleRename}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>✏️</span>
            <span>Rename...</span>
          </button>
          <button
            onClick={handleCopyPath}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>📋</span>
            <span>Copy Relative Path</span>
          </button>
          <button
            onClick={() => {
              showInFileManager(props.node.relative_path);
              setContextMenu(null);
            }}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>📂</span>
            <span>Reveal in File Manager</span>
          </button>
          <Show when={!props.node.is_dir && props.node.name.endsWith(".md")}>
            <button
              onClick={() => {
                uiStore.setExportTargetNote(props.node.relative_path);
                uiStore.setExportModalOpen(true);
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
          </Show>
          <div class="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleDelete}
            class="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <span>🗑️</span>
            <span>Move to Trash</span>
          </button>
        </div>
      </Show>

      {/* Render children recursively if expanded */}
      <Show when={props.node.is_dir && isExpanded() && props.node.children}>
        <div class="relative">
          <For each={props.node.children}>
            {(child) => <FileTreeNode node={child} level={props.level + 1} />}
          </For>
        </div>
      </Show>
    </div>
  );
};
