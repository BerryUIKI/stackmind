import { Component, Show } from "solid-js";
import { uiStore } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import { SourceEditor } from "./SourceEditor";
import { MarkdownPreview } from "./MarkdownPreview";

export const SynchronizedEditor: Component = () => {
  let sourceEl: HTMLTextAreaElement | undefined;
  let previewEl: HTMLDivElement | undefined;
  let isSyncingScroll = false;

  const currentTab = () => tabsStore.getActiveTab();

  const handleSourceScroll = () => {
    if (isSyncingScroll || !sourceEl || !previewEl) return;
    isSyncingScroll = true;

    const sourceMax = sourceEl.scrollHeight - sourceEl.clientHeight;
    if (sourceMax > 0) {
      const ratio = sourceEl.scrollTop / sourceMax;
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = ratio * previewMax;
    }

    setTimeout(() => {
      isSyncingScroll = false;
    }, 10);
  };

  const handlePreviewScroll = () => {
    if (isSyncingScroll || !sourceEl || !previewEl) return;
    isSyncingScroll = true;

    const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
    if (previewMax > 0) {
      const ratio = previewEl.scrollTop / previewMax;
      const sourceMax = sourceEl.scrollHeight - sourceEl.clientHeight;
      sourceEl.scrollTop = ratio * sourceMax;
    }

    setTimeout(() => {
      isSyncingScroll = false;
    }, 10);
  };

  return (
    <div class="h-full w-full flex overflow-hidden relative">
      {/* Source Editor Pane */}
      <Show when={uiStore.editorMode() === "source" || uiStore.editorMode() === "split"}>
        <div
          class={`h-full overflow-hidden ${
            uiStore.editorMode() === "split"
              ? "w-1/2 border-r border-[var(--color-border)]"
              : "w-full"
          }`}
        >
          <SourceEditor
            ref={(el) => (sourceEl = el)}
            content={currentTab()?.content || ""}
            onChange={(val) => tabsStore.updateTabContent(val)}
            onScroll={handleSourceScroll}
          />
        </div>
      </Show>

      {/* Markdown Preview Pane */}
      <Show when={uiStore.editorMode() === "preview" || uiStore.editorMode() === "split"}>
        <div
          class={`h-full overflow-hidden bg-[var(--color-bg-primary)] ${
            uiStore.editorMode() === "split" ? "w-1/2" : "w-full"
          }`}
        >
          <MarkdownPreview
            ref={(el) => (previewEl = el)}
            content={currentTab()?.content || ""}
            onScroll={handlePreviewScroll}
          />
        </div>
      </Show>
    </div>
  );
};
