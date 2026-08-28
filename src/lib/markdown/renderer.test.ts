import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "./renderer";

describe("Markdown Renderer", () => {
  it("renders basic markdown headings and paragraphs", async () => {
    const md = "# Heading 1\n\nThis is a paragraph.";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain("<h1>Heading 1</h1>");
    expect(html).toContain("<p>This is a paragraph.</p>");
  });

  it("renders KaTeX inline and block math formulas", async () => {
    const md = "Equation: $E = mc^2$\n\n$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain("katex");
    expect(html).toContain("katex-block");
  });

  it("extracts and strips block anchors into data-block-id attributes", async () => {
    const md = "This line has an anchor. ^bk-1234";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain('data-block-id="bk-1234"');
    expect(html).not.toContain("^bk-1234");
  });

  it("renders wikilinks with targets, aliases, and block references", async () => {
    const md = "Refer to [[architecture#^bk-9999|System Overview]].";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain('class="wikilink');
    expect(html).toContain('data-target="architecture"');
    expect(html).toContain('data-block-id="bk-9999"');
    expect(html).toContain("System Overview");
  });

  it("renders GitHub-style callouts / alerts", async () => {
    const md = "> [!NOTE]\n> This is an important system note.";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain("Note");
    expect(html).toContain("This is an important system note.");
  });

  it("converts mermaid code blocks into mermaid containers", async () => {
    const md = "```mermaid\ngraph TD;\nA-->B;\n```";
    const html = await renderMarkdownToHtml(md);
    expect(html).toContain('<div class="mermaid');
    expect(html).toContain("graph TD;");
  });
});
