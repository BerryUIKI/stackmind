import { Component, Show, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { workspaceStore } from "@/store/workspace";
import { tabsStore } from "@/store/tabs";
import { onExternalFileChanged } from "@/lib/tauri/events";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Splitter } from "@/components/layout/Splitter";
import { TabStrip } from "@/components/layout/TabStrip";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Inspector } from "@/components/layout/Inspector";
import { StatusBar } from "@/components/layout/StatusBar";
import { TrashModal } from "@/components/modals/TrashModal";
import { WorkspaceModal } from "@/components/modals/WorkspaceModal";
import { SearchModal } from "@/components/modals/SearchModal";
import { SynchronizedEditor } from "@/components/editor/SynchronizedEditor";

export const App: Component = () => {
  let unlistenWatcher: (() => void) | null = null;

  onMount(async () => {
    // 1. Initialize Theme
    uiStore.setTheme("dark");

    // 2. Initialize Workspaces and open default if none active
    await workspaceStore.refreshWorkspaces();
    const list = workspaceStore.workspaces();
    if (list.length > 0) {
      await workspaceStore.openWorkspace(list[0].path, list[0].name);
    } else {
      // Prompt user or open workspace modal
      uiStore.setWorkspaceModalOpen(true);
    }

    // 3. Listen to external file changes from Rust watcher
    try {
      unlistenWatcher = await onExternalFileChanged((ev) => {
        workspaceStore.refreshTree();
        // If current open tab was modified externally, refresh it
        const current = tabsStore.getActiveTab();
        if (current && current.path === ev.relative_path && !current.isDirty) {
          tabsStore.openTab(ev.relative_path);
        }
      });
    } catch (e) {
      console.warn("Watcher event subscription warning:", e);
    }

    // 4. Register global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key === "b") {
        e.preventDefault();
        if (e.shiftKey) {
          uiStore.toggleInspector();
        } else {
          uiStore.toggleSidebar();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        uiStore.setSearchOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        tabsStore.saveActiveTab();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const name = prompt("Enter note name:", "Untitled");
        if (name && name.trim()) {
          workspaceStore.newNote(name.trim()).then((p) => tabsStore.openTab(p));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenWatcher) unlistenWatcher();
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans antialiased">
      {/* Area 1: Top Custom Title Bar */}
      <TitleBar />

      {/* Main Horizontal Spatial Workspace Area */}
      <div class="flex-1 flex overflow-hidden relative">
        {/* Area 2: Left Resizable/Collapsible Sidebar */}
        <Sidebar />

        {/* Left Splitter Divider */}
        <Show when={!uiStore.sidebarCollapsed()}>
          <Splitter direction="left" />
        </Show>

        {/* Area 3: Central Main Viewport */}
        <main class="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-primary)] overflow-hidden">
          <TabStrip />
          <Breadcrumb />

          {/* Central Editor / Preview Area */}
          <div class="flex-1 flex overflow-hidden relative">
            <Show
              when={tabsStore.getActiveTab()}
              fallback={
                <div class="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 text-2xl font-bold">
                    ✦
                  </div>
                  <h2 class="text-base font-semibold text-[var(--color-text-primary)]">
                    No Document Open
                  </h2>
                  <p class="text-xs text-[var(--color-text-muted)] max-w-sm mt-1">
                    Select a note from the sidebar or press{" "}
                    <kbd class="px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-mono">
                      ⌘N
                    </kbd>{" "}
                    to create a new note.
                  </p>
                </div>
              }
            >
              {/* Note Content Viewport: Full Tri-Mode Synchronized Editor */}
              <SynchronizedEditor />
            </Show>
          </div>
        </main>

        {/* Right Splitter Divider */}
        <Show when={!uiStore.inspectorCollapsed()}>
          <Splitter direction="right" />
        </Show>

        {/* Area 4: Right Side Panel Inspector */}
        <Inspector />
      </div>

      {/* Area 5: Bottom Status Bar */}
      <StatusBar />

      {/* Global Modals */}
      <TrashModal />
      <WorkspaceModal />
      <SearchModal />
    </div>
  );
};

export default App;

