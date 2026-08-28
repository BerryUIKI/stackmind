import { Component, For, Show, createSignal, createEffect } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { parseDocument, ParsedDocument } from "@/lib/tauri/commands";

export const MetadataPanel: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();
  const [docMeta, setDocMeta] = createSignal<ParsedDocument | null>(null);
  const [newKey, setNewKey] = createSignal("");
  const [newVal, setNewVal] = createSignal("");

  createEffect(async () => {
    const tab = currentTab();
    if (!tab) {
      setDocMeta(null);
      return;
    }
    try {
      const parsed = await parseDocument(tab.path);
      setDocMeta(parsed);
    } catch (e) {
      console.warn("Failed to parse frontmatter for inspector:", e);
    }
  });

  const handleAddField = (e: Event) => {
    e.preventDefault();
    const k = newKey().trim();
    const v = newVal().trim();
    const tab = currentTab();
    if (!k || !tab) return;

    let content = tab.content;
    if (content.startsWith("---\n")) {
      const secondDashes = content.indexOf("\n---\n", 4);
      if (secondDashes !== -1) {
        const fm = content.substring(4, secondDashes);
        const rest = content.substring(secondDashes + 5);
        const updatedFm = `${fm.trim()}\n${k}: ${v}\n`;
        const updatedDoc = `---\n${updatedFm}---\n${rest}`;
        tabsStore.updateTabContent(updatedDoc);
      }
    } else {
      const updatedDoc = `---\n${k}: ${v}\n---\n\n${content}`;
      tabsStore.updateTabContent(updatedDoc);
    }

    setNewKey("");
    setNewVal("");
  };

  const handleDeleteField = (key: string) => {
    const tab = currentTab();
    if (!tab || !tab.content.startsWith("---\n")) return;

    const secondDashes = tab.content.indexOf("\n---\n", 4);
    if (secondDashes === -1) return;

    const fm = tab.content.substring(4, secondDashes);
    const rest = tab.content.substring(secondDashes + 5);

    const lines = fm.split("\n").filter((l) => !l.startsWith(`${key}:`));
    const updatedFm = lines.join("\n").trim();

    const updatedDoc = updatedFm.length > 0
      ? `---\n${updatedFm}\n---\n${rest}`
      : rest;

    tabsStore.updateTabContent(updatedDoc);
  };

  return (
    <div class="space-y-4 text-xs">
      {/* Frontmatter Properties List */}
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Document Frontmatter
        </span>

        <div class="mt-2 space-y-1.5">
          <Show
            when={docMeta() && Object.keys(docMeta()!.frontmatter_fields).length > 0}
            fallback={
              <div class="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center text-[var(--color-text-muted)] italic">
                No YAML frontmatter defined.
              </div>
            }
          >
            <For each={Object.entries(docMeta()!.frontmatter_fields)}>
              {([key, val]) => (
                <div class="flex items-center justify-between p-2 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div class="flex flex-col truncate pr-2">
                    <span class="font-medium text-[var(--color-text-primary)]">{key}</span>
                    <span class="text-[10px] text-[var(--color-text-muted)] truncate">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteField(key)}
                    class="p-1 rounded hover:bg-rose-500/20 text-[var(--color-text-muted)] hover:text-rose-400 cursor-pointer"
                    title="Remove Property"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* Document Tags */}
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Tags
        </span>
        <div class="mt-1.5 flex flex-wrap gap-1">
          <Show
            when={docMeta() && docMeta()!.tags.length > 0}
            fallback={
              <span class="text-[11px] text-[var(--color-text-muted)] italic">No tags</span>
            }
          >
            <For each={docMeta()!.tags}>
              {(tag) => (
                <span class="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 font-medium text-[11px]">
                  #{tag}
                </span>
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* Add Property Form */}
      <form onSubmit={handleAddField} class="pt-3 border-t border-[var(--color-border)] space-y-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Add Property
        </span>
        <input
          type="text"
          placeholder="Key (e.g. status, author)"
          value={newKey()}
          onInput={(e) => setNewKey(e.currentTarget.value)}
          class="w-full px-2 py-1 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-xs focus:outline-hidden focus:border-[var(--color-accent)]"
        />
        <input
          type="text"
          placeholder="Value"
          value={newVal()}
          onInput={(e) => setNewVal(e.currentTarget.value)}
          class="w-full px-2 py-1 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-xs focus:outline-hidden focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          class="w-full py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] hover:text-white text-[var(--color-text-primary)] font-medium cursor-pointer transition-colors"
        >
          Add Property
        </button>
      </form>
    </div>
  );
};
