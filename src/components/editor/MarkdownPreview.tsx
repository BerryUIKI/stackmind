import { Component, createSignal, createEffect, onMount } from "solid-js";
import { renderMarkdownToHtml } from "@/lib/markdown/renderer";
import { resolveTransclusion } from "@/lib/tauri/commands";
import { tabsStore } from "@/store/tabs";
import mermaid from "mermaid";

interface Props {
  content: string;
  onScroll?: (e: Event) => void;
  ref?: (el: HTMLDivElement) => void;
}

export const MarkdownPreview: Component<Props> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [htmlContent, setHtmlContent] = createSignal<string>("");

  onMount(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
  });

  createEffect(async () => {
    const raw = props.content;
    const currentTab = tabsStore.getActiveTab();
    const currentPath = currentTab?.path || "";

    try {
      const rendered = await renderMarkdownToHtml(raw);
      setHtmlContent(rendered);

      // Render mermaid diagrams and resolve transclusions
      setTimeout(async () => {
        if (!containerRef) return;

        // 1. Resolve transclusions
        const embeds = containerRef.querySelectorAll<HTMLElement>(
          '.transclusion-embed[data-transclusion-state="pending"]'
        );

        for (const embed of Array.from(embeds)) {
          const target = embed.getAttribute("data-target");
          const blockId = embed.getAttribute("data-block-id") || undefined;
          const heading = embed.getAttribute("data-heading") || undefined;
          const contentEl = embed.querySelector<HTMLElement>(".transclusion-content");

          if (!target || !contentEl) continue;

          // Circular check: if target is the same document and embedding the full note
          const targetNorm = target.endsWith(".md") ? target : `${target}.md`;
          if (currentPath && (currentPath === targetNorm || currentPath.endsWith(`/${targetNorm}`))) {
            if (!blockId && !heading) {
              embed.setAttribute("data-transclusion-state", "circular");
              contentEl.innerHTML = `<span class="text-rose-400 font-mono text-xs">⚠️ Circular embed prevented: cannot transclude parent document</span>`;
              continue;
            }
          }

          try {
            const payload = await resolveTransclusion(target, blockId, heading);
            if (!payload.exists) {
              embed.setAttribute("data-transclusion-state", "missing");
              contentEl.innerHTML = `<span class="text-amber-400 text-xs">⚠️ Embedded target does not exist: <code class="font-mono text-amber-300">[[${target}${blockId ? `#^${blockId}` : ""}${heading ? `#${heading}` : ""}]]</code></span>`;
            } else {
              embed.setAttribute("data-transclusion-state", "loaded");
              // Render the transcluded markdown snippet
              const childHtml = await renderMarkdownToHtml(payload.content);
              contentEl.innerHTML = childHtml;
            }
          } catch (err) {
            embed.setAttribute("data-transclusion-state", "error");
            contentEl.innerHTML = `<span class="text-rose-400 text-xs">Failed to load embed: ${String(err)}</span>`;
          }
        }

        // 2. Render mermaid diagrams
        const diagrams = containerRef.querySelectorAll(".mermaid");
        if (diagrams.length > 0) {
          try {
            await mermaid.run({ nodes: diagrams as any });
          } catch (e) {
            console.warn("Mermaid render warning:", e);
          }
        }
      }, 50);
    } catch (e) {
      console.error("Markdown render error:", e);
    }
  });

  const handleClick = (e: MouseEvent) => {
    // 1. Check Wikilink or Transclusion Jump button clicks
    const wikiTarget = (e.target as HTMLElement).closest(".wikilink") as HTMLElement | null;
    const jumpBtn = (e.target as HTMLElement).closest(".transclusion-jump-btn") as HTMLElement | null;
    const target = wikiTarget || jumpBtn;

    if (!target) return;

    e.preventDefault();
    const docTarget = target.getAttribute("data-target");
    const blockTarget = target.getAttribute("data-block-id");

    if (docTarget) {
      const fullPath = docTarget.endsWith(".md") ? docTarget : `${docTarget}.md`;
      tabsStore.openTab(fullPath).then(() => {
        if (blockTarget) {
          setTimeout(() => {
            const el = document.getElementById(blockTarget);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("bg-indigo-500/20", "transition-colors");
              setTimeout(() => el.classList.remove("bg-indigo-500/20"), 2000);
            }
          }, 100);
        }
      });
    } else if (blockTarget) {
      const el = document.getElementById(blockTarget);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("bg-indigo-500/20", "transition-colors");
        setTimeout(() => el.classList.remove("bg-indigo-500/20"), 2000);
      }
    }
  };

  return (
    <div
      ref={(el) => {
        containerRef = el;
        if (props.ref) props.ref(el);
      }}
      onScroll={props.onScroll}
      onClick={handleClick}
      class="h-full w-full p-8 overflow-y-auto custom-scrollbar select-text text-sm leading-relaxed text-[var(--color-text-primary)]"
    >
      <div
        innerHTML={htmlContent()}
        class="prose dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-[var(--color-text-primary)] prose-a:text-indigo-400 prose-code:font-mono prose-code:bg-[var(--color-bg-secondary)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[var(--color-bg-secondary)] prose-pre:border prose-pre:border-[var(--color-border)]"
      />
    </div>
  );
};
