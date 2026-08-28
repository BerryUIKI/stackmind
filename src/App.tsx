import { createSignal, onMount, Component } from "solid-js";
import { pingBackend, PingResponse } from "./lib/tauri/commands";

const App: Component = () => {
  const [pingData, setPingData] = createSignal<PingResponse | null>(null);
  const [statusText, setStatusText] = createSignal<string>("Initializing Stackmynd Core...");

  onMount(async () => {
    try {
      const res = await pingBackend();
      setPingData(res);
      setStatusText("Connected to Stackmynd Rust Backend");
    } catch (e) {
      console.warn("Backend IPC ping fallback (Webview standalone):", e);
      setStatusText("Webview Standalone Preview");
    }
  });

  return (
    <div class="flex flex-col h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] select-none">
      {/* Area 1: Custom Top Title Bar */}
      <header
        data-tauri-drag-region
        class="h-[38px] min-h-[38px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between px-3 text-xs"
      >
        <div class="flex items-center gap-2" data-tauri-drag-region="false">
          <span class="font-semibold text-[var(--accent)]">Stackmynd</span>
          <span class="text-[var(--text-muted)]">|</span>
          <span class="text-[var(--text-secondary)]">Local-First Knowledge Base</span>
        </div>
        <div class="flex items-center gap-2" data-tauri-drag-region="false">
          <span class="px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[10px]">
            v0.1.0-alpha
          </span>
        </div>
      </header>

      {/* Main Viewport */}
      <main class="flex-1 flex items-center justify-center p-6">
        <div class="max-w-md w-full p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-xl text-center">
          <h1 class="text-xl font-bold text-[var(--accent)] mb-2">Stackmynd Scaffolding Ready</h1>
          <p class="text-sm text-[var(--text-secondary)] mb-4">{statusText()}</p>
          {pingData() && (
            <div class="text-xs p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-left font-mono">
              <div>Status: {pingData()?.message}</div>
              <div>Timestamp: {pingData()?.timestamp}</div>
            </div>
          )}
        </div>
      </main>

      {/* Area 5: Bottom Status Bar */}
      <footer class="h-[24px] min-h-[24px] bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex items-center justify-between px-3 text-[11px] text-[var(--text-muted)]">
        <div>Ready</div>
        <div>UTF-8 | LF</div>
      </footer>
    </div>
  );
};

export default App;
