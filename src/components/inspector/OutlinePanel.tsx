import { Component, For, Show, createSignal, createEffect } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { parseDocument, insertBlockAnchor, ParsedBlock } from "@/lib/tauri/commands";

export const OutlinePanel: Component = () => {
  const currentTab = () => tabsStore.getActiveTab();
  const [blocks, setBlocks] = createSignal<ParsedBlock[]>([]);
  const [copyFeedback, setCopyFeedback] = createSignal<string | null>(null);

  const refreshBlocks = async () => {
    const tab = currentTab();
    if (!tab) {
      setBlocks([]);
      return;
    }
    try {
      const parsed = await parseDocument(tab.path);
      setBlocks(parsed.blocks);
    } catch (e) {
      console.warn("Failed to load outline blocks:", e);
    }
  };

  createEffect(() => {
    refreshBlocks();
  });

  const handleAddAnchor = async (e: MouseEvent, block: ParsedBlock) => {
    e.stopPropagation();
    const tab = currentTab();
    if (!tab) return;
    try {
      await insertBlockAnchor(tab.path, block.start_line);
      // Reload tab content to reflect newly inserted anchor
      await tabsStore.openTab(tab.path);
      await refreshBlocks();
    } catch (err) {
      console.error("Failed to insert anchor:", err);
    }
  };

  const handleCopyRef = (e: MouseEvent, block: ParsedBlock) => {
    e.stopPropagation();
    const tab = currentTab();
    if (!tab) return;
    const ref = `[[${tab.title}#^${block.block_id}]]`;
    navigator.clipboard.writeText(ref);
    setCopyFeedback(block.block_id);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleJumpToBlock = (block: ParsedBlock) => {
    const el = document.getElementById(block.block_id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-indigo-500/20", "transition-colors");
      setTimeout(() => el.classList.remove("bg-indigo-500/20"), 2000);
    }
  };

  return (
    <div class="space-y-3 text-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Block Outline ({blocks().length})
        </span>
      </div>

      <Show
        when={blocks().length > 0}
        fallback={
          <div class="p-4 text-center text-[var(--color-text-muted)] italic bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
            No semantic blocks detected.
          </div>
        }
      >
        <div class="space-y-1.5">
          <For each={blocks()}>
            {(block) => {
              const isHeading = () => block.block_type === "heading";
              const level = () => block.heading_level || 0;
              const hasAnchor = () => !block.block_id.startsWith("bk-0000") && block.block_id.length > 0;

              return (
                <div
                  onClick={() => handleJumpToBlock(block)}
                  style={{ "padding-left": `${Math.max(0, (level() - 1) * 8) + 8}px` }}
                  class={`p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] cursor-pointer transition-colors ${
                    isHeading() ? "font-semibold" : ""
                  }`}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-1.5 truncate">
                      <span class="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">
                        {isHeading() ? `H${level()}` : block.block_type.substring(0, 3)}
                      </span>
                      <span class="truncate text-[var(--color-text-primary)]">
                        {block.text_preview || "Empty block"}
                      </span>
                    </div>

                    <span class="text-[10px] text-[var(--color-text-muted)] shrink-0 ml-1">
                      L{block.start_line}
                    </span>
                  </div>

                  {/* Block ID / Actions */}
                  <div class="mt-1.5 flex items-center justify-between">
                    <Show
                      when={hasAnchor()}
                      fallback={
                        <button
                          onClick={(e) => handleAddAnchor(e, block)}
                          class="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                        >
                          + Anchor
                        </button>
                      }
                    >
                      <div class="flex items-center space-x-1">
                        <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400">
                          ^{block.block_id}
                        </span>
                        <button
                          onClick={(e) => handleCopyRef(e, block)}
                          class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer px-1 py-0.2 rounded hover:bg-[var(--color-bg-tertiary)]"
                          title="Copy reference [[note#^block]]"
                        >
                          {copyFeedback() === block.block_id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};
