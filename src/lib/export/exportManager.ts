import { save } from "@tauri-apps/plugin-dialog";
import { readFile, exportFile, resolveTransclusion, parseDocument } from "@/lib/tauri/commands";
import { renderMarkdownToHtml } from "@/lib/markdown/renderer";
import { generateStandaloneHtml } from "./htmlTemplate";

export interface ExportHtmlOptions {
  theme?: "light" | "dark" | "auto";
  includeMetadata?: boolean;
}

export interface ExportMarkdownOptions {
  flattenTransclusions?: boolean;
  stripAnchors?: boolean;
}

/**
 * Resolves transclusions inline in markdown text.
 */
export async function flattenMarkdownTransclusions(markdown: string): Promise<string> {
  const transclusionRegex = /!\[\[([^\]|#]+)(?:#(?:\^)?([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  let matches: RegExpExecArray | null;
  const toResolve: Array<{ raw: string; target: string; fragment?: string }> = [];

  while ((matches = transclusionRegex.exec(markdown)) !== null) {
    toResolve.push({
      raw: matches[0],
      target: matches[1].trim(),
      fragment: matches[2]?.trim(),
    });
  }

  let result = markdown;

  for (const item of toResolve) {
    try {
      const isBlock = item.fragment && (item.fragment.startsWith("bk-") || item.fragment.startsWith("^bk-"));
      const cleanBlockId = isBlock ? item.fragment?.replace(/^\^/, "") : undefined;
      const cleanHeading = !isBlock && item.fragment ? item.fragment : undefined;

      const res = await resolveTransclusion(item.target, cleanBlockId, cleanHeading);
      if (res.exists && res.content) {
        result = result.replace(item.raw, res.content.trim());
      }
    } catch (e) {
      console.warn("Failed to resolve transclusion for export:", item.raw, e);
    }
  }

  return result;
}

/**
 * Strips block anchors (^bk-xxxx) from markdown lines.
 */
export function stripMarkdownBlockAnchors(markdown: string): string {
  return markdown.replace(/\s*\^bk-[a-z0-9]+\s*$/gm, "");
}

/**
 * Exports a note to a standalone HTML file.
 */
export async function exportNoteToHtml(
  relativePath: string,
  options: ExportHtmlOptions = {}
): Promise<{ success: boolean; path?: string }> {
  const fileData = await readFile(relativePath);
  const flattened = await flattenMarkdownTransclusions(fileData.content);
  const renderedContent = await renderMarkdownToHtml(flattened);

  const title = relativePath.split("/").pop()?.replace(/\.md$/, "") || "Document";
  let metadata: Record<string, any> | undefined;
  if (options.includeMetadata) {
    try {
      const parsed = await parseDocument(relativePath);
      metadata = parsed.frontmatter_fields;
    } catch {
      // Ignore parse failure
    }
  }

  const standaloneHtml = generateStandaloneHtml({
    title,
    contentHtml: renderedContent,
    theme: options.theme || "light",
    includeMetadata: options.includeMetadata ?? true,
    metadata,
  });

  const defaultFileName = `${title.toLowerCase().replace(/[^a-z0-9_-]/gi, "-")}.html`;

  const selectedPath = await save({
    defaultPath: defaultFileName,
    filters: [
      {
        name: "HTML Document",
        extensions: ["html", "htm"],
      },
    ],
    title: "Export as Standalone HTML",
  });

  if (!selectedPath || typeof selectedPath !== "string") {
    return { success: false };
  }

  await exportFile(selectedPath, standaloneHtml);
  return { success: true, path: selectedPath };
}

/**
 * Exports a note to a flattened Markdown file.
 */
export async function exportNoteToMarkdown(
  relativePath: string,
  options: ExportMarkdownOptions = {}
): Promise<{ success: boolean; path?: string }> {
  const fileData = await readFile(relativePath);
  let content = fileData.content;

  if (options.flattenTransclusions) {
    content = await flattenMarkdownTransclusions(content);
  }

  if (options.stripAnchors) {
    content = stripMarkdownBlockAnchors(content);
  }

  const title = relativePath.split("/").pop()?.replace(/\.md$/, "") || "Document";
  const defaultFileName = `${title.toLowerCase().replace(/[^a-z0-9_-]/gi, "-")}.md`;

  const selectedPath = await save({
    defaultPath: defaultFileName,
    filters: [
      {
        name: "Markdown Document",
        extensions: ["md", "markdown"],
      },
    ],
    title: "Export as Markdown",
  });

  if (!selectedPath || typeof selectedPath !== "string") {
    return { success: false };
  }

  await exportFile(selectedPath, content);
  return { success: true, path: selectedPath };
}

/**
 * Opens the native print dialog for the note using a hidden print frame.
 */
export async function printNote(
  relativePath: string,
  options: ExportHtmlOptions = {}
): Promise<void> {
  const fileData = await readFile(relativePath);
  const flattened = await flattenMarkdownTransclusions(fileData.content);
  const renderedContent = await renderMarkdownToHtml(flattened);

  const title = relativePath.split("/").pop()?.replace(/\.md$/, "") || "Document";
  let metadata: Record<string, any> | undefined;
  if (options.includeMetadata) {
    try {
      const parsed = await parseDocument(relativePath);
      metadata = parsed.frontmatter_fields;
    } catch {
      // Ignore parse failure
    }
  }

  const standaloneHtml = generateStandaloneHtml({
    title,
    contentHtml: renderedContent,
    theme: "light", // Printing always uses light theme
    includeMetadata: options.includeMetadata ?? true,
    metadata,
  });

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(standaloneHtml);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 350);
}
