import { Component, createSignal, createEffect, onMount } from "solid-js";
import { renderMarkdownToHtml } from "@/lib/markdown/renderer";
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
    try {
      const rendered = await renderMarkdownToHtml(raw);
      setHtmlContent(rendered);

      // Render mermaid diagrams
      setTimeout(async () => {
        if (!containerRef) return;
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
    const target = (e.target as HTMLElement).closest(".wikilink") as HTMLElement | null;
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
