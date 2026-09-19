import { Component, Show, createSignal, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { uiStore, EditorMode } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";
import { CalendarWidget } from "./CalendarWidget";

export const TitleBar: Component = () => {
  const currentWorkspace = () => workspaceStore.activeWorkspace();
  const [isMacPlatform, setIsMacPlatform] = createSignal(true);
  const [isMaximized, setIsMaximized] = createSignal(false);

  const getAppWindow = () => {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  };

  onMount(async () => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      const plat =
        (navigator as any).userAgentData?.platform?.toLowerCase() ||
        navigator.platform?.toLowerCase() ||
        "";
      setIsMacPlatform(ua.includes("mac") || plat.includes("mac"));
    }

    const win = getAppWindow();
    if (win) {
      try {
        const max = await win.isMaximized();
        setIsMaximized(max);
        win.onResized(async () => {
          try {
            setIsMaximized(await win.isMaximized());
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore in test
      }
    }
  });

  const handleClose = async (e: MouseEvent) => {
    e.stopPropagation();
    const win = getAppWindow();
    if (win) {
      await win.close();
    }
  };

  const handleMinimize = async (e: MouseEvent) => {
    e.stopPropagation();
    const win = getAppWindow();
    if (win) {
      await win.minimize();
    }
  };

  const handleToggleMaximize = async (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    const win = getAppWindow();
    if (win) {
      await win.toggleMaximize();
      try {
        setIsMaximized(await win.isMaximized());
      } catch {
        // ignore
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      onDblClick={(e) => {
        if ((e.target as HTMLElement).getAttribute("data-tauri-drag-region") !== null) {
          handleToggleMaximize();
        }
      }}
      class="h-[38px] min-h-[38px] w-full flex items-center justify-between pl-3 pr-0 select-none border-b border-[var(--color-border)] bg-[var(--color-bg-sidebar)] z-50 text-xs text-[var(--color-text-muted)]"
    >
      {/* Left section: Window Controls (macOS) + Brand & Workspace Selector */}
      <div class="flex items-center space-x-2.5" data-tauri-drag-region>
        {/* macOS Traffic Lights (Close, Minimize, Zoom) */}
        <Show when={isMacPlatform()}>
          <div class="flex items-center space-x-2 mr-1 group shrink-0" data-tauri-drag-region={false}>
            {/* Close Button: Red */}
            <button
              onClick={handleClose}
              class="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] flex items-center justify-center cursor-pointer transition-transform active:scale-90 text-[#4c0002] focus:outline-hidden"
              title="Close (⌘Q / ⌘W)"
            >
              <svg
                class="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Minimize Button: Yellow */}
            <button
              onClick={handleMinimize}
              class="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] flex items-center justify-center cursor-pointer transition-transform active:scale-90 text-[#5b3c00] focus:outline-hidden"
              title="Minimize (⌘M)"
            >
              <svg
                class="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                stroke-linecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>

            {/* Maximize / Zoom Button: Green */}
            <button
              onClick={handleToggleMaximize}
              class="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] flex items-center justify-center cursor-pointer transition-transform active:scale-90 text-[#004d11] focus:outline-hidden"
              title="Zoom / Toggle Maximize"
            >
              <svg
                class="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        </Show>

        {/* Brand Name */}
        <div class="flex items-center font-semibold text-xs tracking-wider text-[var(--color-text-primary)]">
          <span class="text-indigo-500 font-bold mr-1">✦</span> Stackmynd
        </div>

        {/* Workspace Switcher Trigger */}
        <button
          onClick={() => uiStore.setWorkspaceModalOpen(true)}
          class="flex items-center space-x-1 px-2.5 py-1 rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] cursor-pointer transition-colors"
          title="Switch or Open Workspace"
          aria-label="Switch or Open Workspace"
        >
          <span class="truncate max-w-[130px] font-medium">
            {currentWorkspace()?.name || "No Workspace"}
          </span>
          <svg class="w-3 h-3 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Sidebar Toggle Button */}
        <button
          onClick={uiStore.toggleSidebar}
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          title="Toggle Sidebar (Cmd+B)"
          aria-label="Toggle Sidebar"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>
      </div>

      {/* Center section: Global Search Palette Trigger */}
      <div class="flex-1 max-w-[360px] mx-4" data-tauri-drag-region>
        <button
          onClick={() => uiStore.setSearchOpen(true)}
          class="w-full flex items-center justify-between px-2.5 py-1 rounded-md bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-pointer transition-colors"
        >
          <span class="flex items-center space-x-1.5 truncate">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="text-xs">Search notes and blocks...</span>
          </span>
          <kbd class="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right section: View Mode Toggles, Theme, Inspector & Windows Controls */}
      <div class="flex items-center space-x-1.5 pr-2">
        {/* Editor Mode Segmented Controls */}
        <div class="flex items-center p-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <button
            onClick={() => uiStore.setEditorMode("source")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all ${
              uiStore.editorMode() === "source"
                ? "bg-[var(--color-accent)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
            title="Source Markdown Mode"
          >
            Source
          </button>
          <button
            onClick={() => uiStore.setEditorMode("split")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all ${
              uiStore.editorMode() === "split"
                ? "bg-[var(--color-accent)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
            title="Synchronized Split Mode"
          >
            Split
          </button>
          <button
            onClick={() => uiStore.setEditorMode("preview")}
            class={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all ${
              uiStore.editorMode() === "preview"
                ? "bg-[var(--color-accent)] text-white shadow-xs"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
            title="Rendered Preview Mode"
          >
            Preview
          </button>
        </div>

        {/* Knowledge Graph Button */}
        <button
          onClick={() => uiStore.setGraphModalOpen(true)}
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-indigo-400 cursor-pointer transition-colors"
          title="Open Knowledge Graph (Cmd+G)"
          aria-label="Open Knowledge Graph"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Daily Notes & Calendar Popover Icon */}
        <CalendarWidget />

        {/* Theme Toggle */}
        <button
          onClick={uiStore.toggleTheme}
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          title="Toggle Light/Dark Theme"
          aria-label="Toggle Light/Dark Theme"
        >
          <Show
            when={uiStore.theme() === "dark"}
            fallback={
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            }
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </Show>
        </button>

        {/* Inspector Toggle Button */}
        <button
          onClick={uiStore.toggleInspector}
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
          title="Toggle Inspector (Cmd+Shift+B)"
          aria-label="Toggle Inspector"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>

        {/* Windows / Linux Window Controls (Minimize, Maximize/Restore, Close) */}
        <Show when={!isMacPlatform()}>
          <div class="h-[38px] flex items-center ml-1 border-l border-[var(--color-border)] pl-1 -mr-2">
            {/* Minimize */}
            <button
              onClick={handleMinimize}
              class="h-full w-10 flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-hidden"
              title="Minimize"
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12h16" />
              </svg>
            </button>

            {/* Maximize / Restore */}
            <button
              onClick={handleToggleMaximize}
              class="h-full w-10 flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-hidden"
              title={isMaximized() ? "Restore" : "Maximize"}
            >
              <Show
                when={isMaximized()}
                fallback={
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="4" width="16" height="16" rx="1" />
                  </svg>
                }
              >
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 4h12v12M4 8h12v12H4z" />
                </svg>
              </Show>
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              class="h-full w-10 flex items-center justify-center hover:bg-[#e81123] hover:text-white text-[var(--color-text-muted)] transition-colors focus:outline-hidden"
              title="Close"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </Show>
      </div>
    </header>
  );
};
