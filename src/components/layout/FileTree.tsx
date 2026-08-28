import { Component, For, Show } from "solid-js";
import { workspaceStore } from "@/store/workspace";
import { FileTreeNode } from "./FileTreeNode";

export const FileTree: Component = () => {
  const filteredTree = () => {
    const q = workspaceStore.filterQuery().toLowerCase().trim();
    if (!q) return workspaceStore.fileTree();

    const filterNodes = (nodes: any[]): any[] => {
      return nodes
        .map((node) => {
          if (node.is_dir) {
            const filteredChildren = node.children ? filterNodes(node.children) : [];
            if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
              return { ...node, children: filteredChildren };
            }
            return null;
          }
          if (node.name.toLowerCase().includes(q)) {
            return node;
          }
          return null;
        })
        .filter(Boolean);
    };

    return filterNodes(workspaceStore.fileTree());
  };

  return (
    <div class="flex-1 overflow-y-auto py-1 px-1 custom-scrollbar">
      <Show
        when={filteredTree().length > 0}
        fallback={
          <div class="p-4 text-center text-xs text-[var(--color-text-muted)] italic">
            No notes found.
          </div>
        }
      >
        <For each={filteredTree()}>
          {(node) => <FileTreeNode node={node} level={0} />}
        </For>
      </Show>
    </div>
  );
};
