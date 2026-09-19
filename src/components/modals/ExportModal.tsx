import { Component, createSignal, Show, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import { readFile, parseDocument } from "@/lib/tauri/commands";
import {
  exportNoteToHtml,
  exportNoteToMarkdown,
  printNote,
  flattenMarkdownTransclusions,
  stripMarkdownBlockAnchors,
} from "@/lib/export/exportManager";

export type ExportFormat = "html" | "pdf" | "markdown";

export const ExportModal: Component = () => {
  const [format, setFormat] = createSignal<ExportFormat>("html");
  const [theme, setTheme] = createSignal<"light" | "dark" | "auto">("light");
  const [includeMetadata, setIncludeMetadata] = createSignal(true);
  const [flattenTransclusions, setFlattenTransclusions] = createSignal(true);
  const [stripAnchors, setStripAnchors] = createSignal(true);
  const [isExporting, setIsExporting] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

  const getTargetNotePath = () => {
    return uiStore.exportTargetNote() || tabsStore.activeTabPath() || "";
  };

  const closeModal = () => {
    uiStore.setExportModalOpen(false);
    uiStore.setExportTargetNote(null);
    setStatusMessage(null);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiStore.exportModalOpen()) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  const handleExportHtml = async () => {
    const path = getTargetNotePath();
    if (!path) return;
    setIsExporting(true);
    try {
      const res = await exportNoteToHtml(path, {
        theme: theme(),
        includeMetadata: includeMetadata(),
      });
      if (res.success) {
        showStatus(`Exported HTML successfully!`);
        setTimeout(() => closeModal(), 1000);
      }
    } catch (e) {
      alert(`Export failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyHtml = async () => {
    const path = getTargetNotePath();
    if (!path) return;
    setIsExporting(true);
    try {
      const fileData = await readFile(path);
      const flattened = await flattenMarkdownTransclusions(fileData.content);
      const { renderMarkdownToHtml } = await import("@/lib/markdown/renderer");
      const rendered = await renderMarkdownToHtml(flattened);
      const { generateStandaloneHtml } = await import("@/lib/export/htmlTemplate");
      const title = path.split("/").pop()?.replace(/\.md$/, "") || "Document";
      let metadata: Record<string, any> | undefined;
      if (includeMetadata()) {
        try {
          const parsed = await parseDocument(path);
          metadata = parsed.frontmatter_fields;
        } catch {
          // Ignore
        }
      }
      const fullHtml = generateStandaloneHtml({
        title,
        contentHtml: rendered,
        theme: theme(),
        includeMetadata: includeMetadata(),
        metadata,
      });
      await navigator.clipboard.writeText(fullHtml);
      showStatus("HTML copied to clipboard!");
    } catch (e) {
      alert(`Copy failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    const path = getTargetNotePath();
    if (!path) return;
    setIsExporting(true);
    try {
      await printNote(path, { includeMetadata: includeMetadata() });
      closeModal();
    } catch (e) {
      alert(`Print preparation failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    const path = getTargetNotePath();
    if (!path) return;
    setIsExporting(true);
    try {
      const res = await exportNoteToMarkdown(path, {
        flattenTransclusions: flattenTransclusions(),
        stripAnchors: stripAnchors(),
      });
      if (res.success) {
        showStatus("Exported Markdown successfully!");
        setTimeout(() => closeModal(), 1000);
      }
    } catch (e) {
      alert(`Export failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const path = getTargetNotePath();
    if (!path) return;
    setIsExporting(true);
    try {
      const fileData = await readFile(path);
      let text = fileData.content;
      if (flattenTransclusions()) {
        text = await flattenMarkdownTransclusions(text);
      }
      if (stripAnchors()) {
        text = stripMarkdownBlockAnchors(text);
      }
      await navigator.clipboard.writeText(text);
      showStatus("Markdown copied to clipboard!");
    } catch (e) {
      alert(`Copy failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Show when={uiStore.exportModalOpen()}>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
        class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      >
        <div class="w-full max-w-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs">
          {/* Header */}
          <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-indigo-400 font-bold text-sm">📤</span>
              <span class="font-semibold text-sm text-[var(--color-text-primary)]">
                Export Document
              </span>
            </div>
            <button
              onClick={closeModal}
              class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title="Close (Esc)"
              aria-label="Close Export Modal"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="p-4 space-y-4">
            {/* Target Note Display */}
            <div class="p-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-between">
              <div class="flex flex-col truncate pr-2">
                <span class="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                  Source Note
                </span>
                <span class="font-medium text-[var(--color-text-primary)] truncate">
                  {getTargetNotePath() || "No note selected"}
                </span>
              </div>
            </div>

            {/* Format Selection Segmented Control */}
            <div>
              <label class="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5">
                Export Format
              </label>
              <div class="grid grid-cols-3 gap-1 p-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormat("html")}
                  class={`py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                    format() === "html"
                      ? "bg-[var(--color-accent)] text-white shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  HTML Document
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("pdf")}
                  class={`py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                    format() === "pdf"
                      ? "bg-[var(--color-accent)] text-white shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("markdown")}
                  class={`py-1.5 rounded-md font-medium text-center transition-all cursor-pointer ${
                    format() === "markdown"
                      ? "bg-[var(--color-accent)] text-white shadow-xs"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  Clean Markdown
                </button>
              </div>
            </div>

            {/* Options per format */}
            <Show when={format() === "html"}>
              <div class="space-y-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">
                    HTML Theme:
                  </label>
                  <select
                    value={theme()}
                    onChange={(e) => setTheme(e.currentTarget.value as any)}
                    class="w-full px-2.5 py-1.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                  >
                    <option value="light">Light Theme</option>
                    <option value="dark">Dark Theme</option>
                  </select>
                </div>

                <label class="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeMetadata()}
                    onChange={(e) => setIncludeMetadata(e.currentTarget.checked)}
                    class="accent-indigo-500 rounded"
                  />
                  <span class="text-[var(--color-text-secondary)]">Include Frontmatter Properties</span>
                </label>
              </div>
            </Show>

            <Show when={format() === "pdf"}>
              <div class="space-y-2 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                <p class="text-[var(--color-text-secondary)] leading-relaxed">
                  Stackmynd prepares a clean, paginated print layout. You can select <strong>"Save as PDF"</strong> in the destination menu of your system print dialog.
                </p>
                <label class="flex items-center space-x-2 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={includeMetadata()}
                    onChange={(e) => setIncludeMetadata(e.currentTarget.checked)}
                    class="accent-indigo-500 rounded"
                  />
                  <span class="text-[var(--color-text-secondary)]">Include Frontmatter Header</span>
                </label>
              </div>
            </Show>

            <Show when={format() === "markdown"}>
              <div class="space-y-2.5 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                <label class="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={flattenTransclusions()}
                    onChange={(e) => setFlattenTransclusions(e.currentTarget.checked)}
                    class="accent-indigo-500 rounded"
                  />
                  <span class="text-[var(--color-text-secondary)]">
                    Inline transclusion embeds (resolve <code class="text-[10px]">![[...]]</code>)
                  </span>
                </label>

                <label class="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={stripAnchors()}
                    onChange={(e) => setStripAnchors(e.currentTarget.checked)}
                    class="accent-indigo-500 rounded"
                  />
                  <span class="text-[var(--color-text-secondary)]">
                    Strip internal block anchors (<code class="text-[10px]">^bk-xxxx</code>)
                  </span>
                </label>
              </div>
            </Show>

            {/* Status Message Notification */}
            <Show when={statusMessage()}>
              <div class="p-2 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-center font-medium animate-in fade-in duration-150">
                {statusMessage()}
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex items-center space-x-2 pt-2">
              <Show when={format() === "html"}>
                <button
                  type="button"
                  onClick={handleExportHtml}
                  disabled={isExporting() || !getTargetNotePath()}
                  class="flex-1 py-2 rounded-lg bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white font-medium cursor-pointer transition-opacity text-center shadow-xs"
                >
                  {isExporting() ? "Exporting..." : "Save HTML File..."}
                </button>
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  disabled={isExporting() || !getTargetNotePath()}
                  class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium cursor-pointer transition-colors"
                  title="Copy full HTML markup to clipboard"
                >
                  Copy HTML
                </button>
              </Show>

              <Show when={format() === "pdf"}>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  disabled={isExporting() || !getTargetNotePath()}
                  class="w-full py-2 rounded-lg bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white font-medium cursor-pointer transition-opacity text-center shadow-xs"
                >
                  {isExporting() ? "Preparing Print View..." : "Open Print Dialog (PDF)..."}
                </button>
              </Show>

              <Show when={format() === "markdown"}>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  disabled={isExporting() || !getTargetNotePath()}
                  class="flex-1 py-2 rounded-lg bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-white font-medium cursor-pointer transition-opacity text-center shadow-xs"
                >
                  {isExporting() ? "Exporting..." : "Save Markdown File..."}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  disabled={isExporting() || !getTargetNotePath()}
                  class="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium cursor-pointer transition-colors"
                  title="Copy cleaned markdown to clipboard"
                >
                  Copy Markdown
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
