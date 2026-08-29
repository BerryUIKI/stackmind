import { Component, For, Show } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";
import { getOrCreateDailyNote } from "@/lib/tauri/commands";

export const Breadcrumb: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();

  const pathParts = () => {
    const tab = currentTab();
    if (!tab) return [];
    return tab.path.split("/");
  };

  const dailyDate = () => {
    const tab = currentTab();
    if (!tab) return null;
    const match = tab.path.match(/^daily\/(\d{4}-\d{2}-\d{2})\.md$/);
    return match ? match[1] : null;
  };

  const navigateDay = async (offset: number) => {
    const dateStr = dailyDate();
    if (!dateStr) return;
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + offset);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const targetDate = `${y}-${m}-${day}`;

    try {
      const res = await getOrCreateDailyNote(targetDate);
      tabsStore.openTab(res.relative_path);
    } catch (e) {
      console.error("Failed to navigate daily note:", e);
    }
  };

  return (
    <Show when={currentTab()}>
      <div class="h-6 min-h-6 px-3 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] select-none">
        <div class="flex items-center space-x-1.5 truncate">
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

        {/* Temporal Day Navigation for Daily Notes */}
        <Show when={dailyDate()}>
          <div class="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => navigateDay(-1)}
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-secondary)] text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors"
              title="Previous Day"
            >
              <span>◀</span>
              <span>Yesterday</span>
            </button>
            <button
              onClick={() => navigateDay(1)}
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-secondary)] text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors"
              title="Next Day"
            >
              <span>Tomorrow</span>
              <span>▶</span>
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
};

