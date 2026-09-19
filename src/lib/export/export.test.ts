import { describe, it, expect } from "vitest";
import { generateStandaloneHtml } from "./htmlTemplate";
import { stripMarkdownBlockAnchors } from "./exportManager";

describe("Export Suite", () => {
  it("generates a standalone HTML document with embedded styles and metadata", () => {
    const html = generateStandaloneHtml({
      title: "Quantum Theory Notes",
      contentHtml: "<h2>Introduction</h2><p>Quantum mechanics is fascinating.</p>",
      theme: "light",
      includeMetadata: true,
      metadata: {
        author: "Alice",
        tags: ["physics", "quantum"],
      },
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Quantum Theory Notes</title>");
    expect(html).toContain("katex.min.css");
    expect(html).toContain("Quantum mechanics is fascinating.");
    expect(html).toContain('class="metadata-card"');
    expect(html).toContain("Alice");
    expect(html).toContain("@media print");
  });

  it("generates dark theme standalone HTML when specified", () => {
    const html = generateStandaloneHtml({
      title: "Dark Mode Spec",
      contentHtml: "<p>Content</p>",
      theme: "dark",
      includeMetadata: false,
    });

    expect(html).toContain('<html lang="en" class="dark">');
    expect(html).not.toContain('class="metadata-card"');
  });

  it("strips block anchors correctly from markdown text", () => {
    const raw = `# Title\n\nFirst block. ^bk-abc1\nSecond block.\nThird block with code. ^bk-9876`;
    const cleaned = stripMarkdownBlockAnchors(raw);

    expect(cleaned).not.toContain("^bk-abc1");
    expect(cleaned).not.toContain("^bk-9876");
    expect(cleaned).toContain("First block.");
    expect(cleaned).toContain("Third block with code.");
  });
});
