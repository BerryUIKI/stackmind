import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import katex from "katex";

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  // Pre-process math to protect it from markdown escapes
  let processed = markdown;

  // 1. Process block math $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="katex-block my-3 overflow-x-auto">${rendered}</div>`;
    } catch (e) {
      return `<pre class="text-rose-400 text-xs">$$${math}$$</pre>`;
    }
  });

  // 2. Process inline math $...$
  processed = processed.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      return `<code>$${math}$</code>`;
    }
  });

  // 3. Process Transclusions ![[target#^blockid|alias]] or ![[target#Heading]] or ![[target]]
  processed = processed.replace(/!\[\[([^\]|#]+)(?:#(?:\^)?([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, target, fragment, alias) => {
    const isBlock = fragment && (fragment.startsWith("bk-") || fragment.startsWith("^bk-"));
    const cleanFrag = fragment ? fragment.replace(/^\^/, "").trim() : "";
    const label = alias ? alias.trim() : (target.trim() + (cleanFrag ? ` > ${cleanFrag}` : ""));
    const blockAttr = isBlock ? ` data-block-id="${cleanFrag}"` : "";
    const headingAttr = (!isBlock && cleanFrag) ? ` data-heading="${cleanFrag}"` : "";

    return `<div class="transclusion-embed my-3 rounded-lg border border-[var(--color-border)] border-l-4 border-l-indigo-500 bg-[var(--color-bg-secondary)] overflow-hidden" data-target="${target.trim()}"${blockAttr}${headingAttr} data-transclusion-state="pending">
      <div class="transclusion-header flex items-center justify-between px-3 py-1.5 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] select-none">
        <div class="flex items-center space-x-1.5 font-medium text-[var(--color-text-primary)] truncate">
          <span class="text-indigo-400">⎘</span>
          <span class="truncate">${label}</span>
        </div>
        <div class="flex items-center space-x-2 shrink-0">
          <button type="button" class="transclusion-jump-btn text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer flex items-center space-x-1" data-target="${target.trim()}"${blockAttr}>
            <span>Jump</span>
            <span>↗</span>
          </button>
        </div>
      </div>
      <div class="transclusion-content p-3 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <span class="text-xs text-[var(--color-text-muted)] animate-pulse">Loading embed...</span>
      </div>
    </div>`;
  });

  // 4. Process Wikilinks [[target#^blockid|alias]] or [[target|alias]] or [[target]]
  processed = processed.replace(/(?<!\!)\[\[([^\]|#]+)(?:#(?:\^)?([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, target, fragment, alias) => {
    const label = alias ? alias.trim() : (target.trim() + (fragment ? ` > ${fragment.trim()}` : ""));
    const blockAttr = fragment ? ` data-block-id="${fragment.trim()}"` : "";
    return `<a href="#" class="wikilink text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer" data-target="${target.trim()}"${blockAttr}>${label}</a>`;
  });

  // Run remark/rehype markdown conversion
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(processed);

  let html = String(file);

  // 4. Attach block anchors ^bk-xxxx to parent HTML elements and strip them from display
  html = html.replace(/(<p[^>]*>|<li[^>]*>|<h[1-6][^>]*>)([\s\S]*?)\s*\^(bk-[a-z0-9]{4,16})([\s\S]*?)(<\/(?:p|li|h[1-6])>)/g, 
    (_match, openTag, before, blockId, after, closeTag) => {
      const tagWithAttr = openTag.replace(/>$/, ` data-block-id="${blockId}" id="${blockId}">`);
      return `${tagWithAttr}${before}${after}${closeTag}`;
    }
  );

  // 5. GitHub-style callouts / alerts
  const alertStyles: Record<string, { border: string; bg: string; title: string; text: string }> = {
    NOTE: { border: "border-sky-500", bg: "bg-sky-500/10", title: "Note", text: "text-sky-400" },
    TIP: { border: "border-emerald-500", bg: "bg-emerald-500/10", title: "Tip", text: "text-emerald-400" },
    IMPORTANT: { border: "border-indigo-500", bg: "bg-indigo-500/10", title: "Important", text: "text-indigo-400" },
    WARNING: { border: "border-amber-500", bg: "bg-amber-500/10", title: "Warning", text: "text-amber-400" },
    CAUTION: { border: "border-rose-500", bg: "bg-rose-500/10", title: "Caution", text: "text-rose-400" },
  };

  html = html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<br\s*\/?>)?([\s\S]*?)<\/p>\s*<\/blockquote>/gi, 
    (_match, type, content) => {
      const alertType = type.toUpperCase();
      const style = alertStyles[alertType] || alertStyles.NOTE;
      return `<div class="my-3 p-3 rounded-lg border-l-4 ${style.border} ${style.bg}">
        <div class="font-semibold text-xs uppercase tracking-wider ${style.text} mb-1">${style.title}</div>
        <div class="text-xs text-[var(--color-text-secondary)] leading-relaxed">${content.trim()}</div>
      </div>`;
    }
  );

  // 6. Make task list checkboxes interactive
  let taskIndex = 0;
  html = html.replace(/<input\s+([^>]*?)type="checkbox"([^>]*?)>/gi, (match, before, after) => {
    const isChecked = /checked/i.test(match);
    const combined = `${before} ${after}`.replace(/\s+disabled(?:=""|="true")?/gi, "");
    return `<input type="checkbox"${combined} class="task-list-checkbox cursor-pointer accent-indigo-500 mr-1.5 align-middle" aria-label="Toggle task" data-task-index="${taskIndex++}" ${isChecked ? "checked" : ""}>`;
  });

  // 7. Convert mermaid code blocks into <div class="mermaid"> containers
  html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_match, code) => {
    // Unescape HTML entities in mermaid code
    const raw = code
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return `<div class="mermaid my-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex justify-center">${raw.trim()}</div>`;
  });

  return html;
}
