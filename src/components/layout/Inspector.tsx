import { Component, Show } from "solid-js";
import { uiStore, InspectorTab } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import { MetadataPanel } from "@/components/inspector/MetadataPanel";
import { OutlinksPanel } from "@/components/inspector/OutlinksPanel";
import { BacklinksPanel } from "@/components/inspector/BacklinksPanel";
import { OutlinePanel } from "@/components/inspector/OutlinePanel";

export const Inspector: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: "metadata", label: "Metadata" },
    { id: "outlinks", label: "Outlinks" },
    { id: "backlinks", label: "Backlinks" },
    { id: "outline", label: "Outline" },
  ];

  return (
    <aside
      style={{
        width: uiStore.inspectorCollapsed() ? "0px" : `${uiStore.inspectorWidth()}px`,
      }}
      class={`h-full flex flex-col bg-[var(--color-bg-sidebar)] border-l border-[var(--color-border)] overflow-hidden select-none transition-[width] duration-150 ease-out z-20 ${
        uiStore.inspectorCollapsed() ? "border-l-0" : ""
      }`}
    >
      {/* Inspector Tab Bar */}
      <div class="h-10 min-h-10 px-2 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div class="flex items-center space-x-1">
          {tabs.map((t) => (
            <button
              onClick={() => uiStore.setInspectorTab(t.id)}
              class={`px-2 py-1 text-xs rounded font-medium cursor-pointer transition-colors ${
                uiStore.inspectorTab() === t.id
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-semibold"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={uiStore.toggleInspector}
          class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
          title="Close Inspector"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Inspector Body Slot */}
      <div class="flex-1 overflow-y-auto p-3 text-xs custom-scrollbar">
        <Show
          when={currentTab()}
          fallback={
            <div class="py-16 text-center text-[var(--color-text-muted)] italic">
              Select a note to inspect metadata, links, and outline.
            </div>
          }
        >
          <div class="space-y-4">
            <div class="p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Active Document
              </span>
              <div class="mt-1 font-medium text-[var(--color-text-primary)] truncate">
                {currentTab()?.title}
              </div>
              <div class="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                {currentTab()?.path}
              </div>
            </div>

            <Show when={uiStore.inspectorTab() === "metadata"}>
              <MetadataPanel />
            </Show>

            <Show when={uiStore.inspectorTab() === "outlinks"}>
              <OutlinksPanel />
            </Show>

            <Show when={uiStore.inspectorTab() === "backlinks"}>
              <BacklinksPanel />
            </Show>

            <Show when={uiStore.inspectorTab() === "outline"}>
              <OutlinePanel />
            </Show>
          </div>
        </Show>
      </div>
    </aside>
  );
};
