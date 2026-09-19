export interface HtmlTemplateOptions {
  title: string;
  contentHtml: string;
  theme?: "light" | "dark" | "auto";
  includeMetadata?: boolean;
  metadata?: Record<string, any>;
}

export function generateStandaloneHtml(options: HtmlTemplateOptions): string {
  const {
    title,
    contentHtml,
    theme = "light",
    includeMetadata = true,
    metadata = {},
  } = options;

  const exportDate = new Date().toLocaleString();

  // Render metadata block if frontmatter exists and requested
  let metaHtml = "";
  if (includeMetadata && Object.keys(metadata).length > 0) {
    const rows = Object.entries(metadata)
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
      .join("");
    metaHtml = `
      <div class="metadata-card">
        <div class="metadata-title">Properties</div>
        <table>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  const isDark = theme === "dark";
  const bgClass = isDark ? "dark" : "";

  return `<!DOCTYPE html>
<html lang="en" class="${bgClass}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"/>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f8fafc;
      --bg-card: #f1f5f9;
      --text-primary: #0f172a;
      --text-secondary: #334155;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --code-bg: #f1f5f9;
      --table-border: #cbd5e1;
    }

    html.dark {
      --bg-primary: #090d16;
      --bg-secondary: #0f172a;
      --bg-card: #1e293b;
      --text-primary: #f8fafc;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --border-color: #334155;
      --accent: #818cf8;
      --accent-hover: #6366f1;
      --code-bg: #1e293b;
      --table-border: #334155;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      padding: 2.5rem 1.5rem;
      transition: background-color 0.2s, color 0.2s;
    }

    .container {
      max-width: 860px;
      margin: 0 auto;
    }

    header.doc-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    header.doc-header h1 {
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.25;
      margin-bottom: 0.5rem;
    }

    header.doc-header .doc-meta {
      font-size: 0.825rem;
      color: var(--text-muted);
    }

    .metadata-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
    }

    .metadata-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .metadata-card table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .metadata-card th {
      text-align: left;
      font-weight: 600;
      color: var(--text-muted);
      padding: 0.25rem 0.5rem 0.25rem 0;
      width: 25%;
    }

    .metadata-card td {
      color: var(--text-primary);
      padding: 0.25rem 0;
    }

    /* Content Typography */
    h1, h2, h3, h4, h5, h6 {
      color: var(--text-primary);
      font-weight: 700;
      line-height: 1.35;
      margin-top: 1.75rem;
      margin-bottom: 0.75rem;
    }

    h1 { font-size: 1.85rem; }
    h2 { font-size: 1.45rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem; }
    h3 { font-size: 1.25rem; }
    h4 { font-size: 1.1rem; }

    p {
      margin-bottom: 1.2rem;
      color: var(--text-secondary);
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    ul, ol {
      margin-bottom: 1.2rem;
      padding-left: 1.75rem;
      color: var(--text-secondary);
    }

    li {
      margin-bottom: 0.35rem;
    }

    blockquote {
      border-left: 4px solid var(--accent);
      padding: 0.5rem 1rem;
      margin: 1.25rem 0;
      background-color: var(--bg-secondary);
      color: var(--text-secondary);
      border-radius: 0 6px 6px 0;
    }

    pre {
      background-color: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875em;
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      color: var(--text-primary);
    }

    pre code {
      background-color: transparent;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    table th, table td {
      border: 1px solid var(--table-border);
      padding: 0.6rem 0.8rem;
      text-align: left;
    }

    table th {
      background-color: var(--bg-secondary);
      font-weight: 600;
    }

    table tr:nth-child(even) {
      background-color: var(--bg-secondary);
    }

    hr {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 2rem 0;
    }

    /* GitHub Alerts & Callouts */
    .alert-callout {
      border-radius: 8px;
      border: 1px solid;
      padding: 0.9rem 1.1rem;
      margin: 1.25rem 0;
    }

    .alert-note {
      background-color: rgba(59, 130, 246, 0.08);
      border-color: #3b82f6;
    }
    .alert-tip {
      background-color: rgba(16, 185, 129, 0.08);
      border-color: #10b981;
    }
    .alert-important {
      background-color: rgba(139, 92, 246, 0.08);
      border-color: #8b5cf6;
    }
    .alert-warning {
      background-color: rgba(245, 158, 11, 0.08);
      border-color: #f59e0b;
    }
    .alert-caution {
      background-color: rgba(239, 68, 68, 0.08);
      border-color: #ef4444;
    }

    /* Transclusions */
    .transclusion-embed {
      border: 1px solid var(--border-color);
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      margin: 1.25rem 0;
      background-color: var(--bg-secondary);
      overflow: hidden;
    }

    .transclusion-header {
      padding: 0.5rem 0.8rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .transclusion-content {
      padding: 0.8rem;
    }

    .transclusion-jump-btn {
      display: none;
    }

    /* Task lists */
    .task-list-checkbox {
      margin-right: 0.5rem;
      accent-color: var(--accent);
    }

    footer.doc-footer {
      border-top: 1px solid var(--border-color);
      padding-top: 1.5rem;
      margin-top: 3rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* Print Styles */
    @media print {
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .container {
        max-width: 100% !important;
      }
      a {
        color: #000000 !important;
        text-decoration: underline !important;
      }
      pre, blockquote, table, .katex-block, .transclusion-embed, .alert-callout {
        page-break-inside: avoid;
      }
      footer.doc-footer {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <h1>${escapeHtml(title)}</h1>
      <div class="doc-meta">Exported from Stackmynd • ${escapeHtml(exportDate)}</div>
    </header>

    ${metaHtml}

    <main class="doc-content">
      ${contentHtml}
    </main>

    <footer class="doc-footer">
      <span>Stackmynd Knowledge Base</span>
      <span>${escapeHtml(exportDate)}</span>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
