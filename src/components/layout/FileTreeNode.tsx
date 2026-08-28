import { Component, For, Show } from "solid-js";
import { FileNode } from "@/lib/tauri/commands";
import { workspaceStore } from "@/store/workspace";
import { tabsStore } from "@/store/tabs";

interface Props {
  node: FileNode;
  level: number;
}

export const FileTreeNode: Component<Props> = (props) => {
  const isExpanded = () => workspaceStore.expandedFolders().has(props.node.relative_path);
  const isActive = () => tabsStore.activeTabPath() === props.node.relative_path;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.node.is_dir) {
      workspaceStore.toggleFolder(props.node.relative_path);
    } else {
      tabsStore.openTab(props.node.relative_path);
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Move "${props.node.name}" to workspace trash?`)) {
      workspaceStore.removeToTrash(props.node.relative_path);
    }
  };

  return (
    <div class="select-none text-xs">
      <div
        onClick={handleClick}
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
