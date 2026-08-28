import { Component, For, Show } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";

export const Breadcrumb: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();

  const pathParts = () => {
    const tab = currentTab();
    if (!tab) return [];
    return tab.path.split("/");
  };

  return (
    <Show when={currentTab()}>
      <div class="h-6 min-h-6 px-3 flex items-center space-x-1.5 text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] select-none">
        <span class="font-medium text-[var(--color-text-secondary)]">
          {workspaceStore.activeWorkspace()?.name || "Workspace"}
        </span>

        <For each={pathParts()}>
          {(part, index) => {
            const isLast = () => index() === pathParts().length - 1;
            return (
              <div class="flex items-center space-x-1.5">
                <span>/</span>
                <span
                  class={
                    isLast()
                      ? "text-[var(--color-text-primary)] font-medium"
                      : "text-[var(--color-text-muted)]"
                  }
                >
                  {part}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
};
