import { createSignal, createRoot } from "solid-js";
import { readFile, writeFileAtomic, FilePayload } from "@/lib/tauri/commands";

export interface Tab {
  path: string;
  title: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  mtime: number;
  mode: string;
  scrollRatio: number;
  cursorLine: number;
  cursorCol: number;
}

function createTabsStore() {
  const [tabs, setTabs] = createSignal<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = createSignal<string | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<"saved" | "saving" | "unsaved">("saved");

  let autoSaveTimeout: any = null;

  const getActiveTab = (): Tab | undefined => {
    const current = activeTabPath();
    return tabs().find((t) => t.path === current);
  };

  const openTab = async (path: string) => {
    const existing = tabs().find((t) => t.path === path);
    if (existing) {
      setActiveTabPath(path);
      return;
    }

    try {
      const payload: FilePayload = await readFile(path);
      const fileName = path.split("/").pop() || path;
      const title = fileName.replace(/\.md$/, "");

      const newTab: Tab = {
        path,
        title,
        content: payload.content,
        originalContent: payload.content,
        isDirty: false,
        mtime: payload.mtime_ms,
        mode: "split",
        scrollRatio: 0,
        cursorLine: 1,
        cursorCol: 1,
      };

      setTabs([...tabs(), newTab]);
      setActiveTabPath(path);
    } catch (e) {
      console.error(`Failed to open note tab for ${path}:`, e);
    }
  };

  const closeTab = (path: string) => {
    const currentTabs = tabs();
    const targetIdx = currentTabs.findIndex((t) => t.path === path);
    if (targetIdx === -1) return;

    const remaining = currentTabs.filter((t) => t.path !== path);
    setTabs(remaining);

    if (activeTabPath() === path) {
      if (remaining.length > 0) {
        const nextIdx = Math.max(0, targetIdx - 1);
        setActiveTabPath(remaining[nextIdx].path);
      } else {
        setActiveTabPath(null);
      }
    }
  };

  const updateTabContent = (content: string) => {
    const currentPath = activeTabPath();
    if (!currentPath) return;

    setTabs(
      tabs().map((t) => {
        if (t.path === currentPath) {
          const isDirty = content !== t.originalContent;
          return { ...t, content, isDirty };
        }
        return t;
      })
    );

    setSaveStatus("unsaved");

    // Debounce auto-save to 800ms per architecture invariant
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(() => {
      saveActiveTab();
    }, 800);
  };

  const saveActiveTab = async () => {
    const current = getActiveTab();
    if (!current || !current.isDirty) return;

    setSaveStatus("saving");
    try {
      const payload = await writeFileAtomic(current.path, current.content);
      setTabs(
        tabs().map((t) => {
          if (t.path === current.path) {
            return {
              ...t,
              originalContent: current.content,
              isDirty: false,
              mtime: payload.mtime_ms,
            };
          }
          return t;
        })
      );
      setSaveStatus("saved");
    } catch (e) {
      console.error("Failed to save note:", e);
      setSaveStatus("unsaved");
    }
  };

  const updateCursorPosition = (line: number, col: number) => {
    const currentPath = activeTabPath();
    if (!currentPath) return;
    setTabs(
      tabs().map((t) => (t.path === currentPath ? { ...t, cursorLine: line, cursorCol: col } : t))
    );
  };

  return {
    tabs,
    activeTabPath,
    setActiveTabPath,
    saveStatus,
    getActiveTab,
    openTab,
    closeTab,
    updateTabContent,
    saveActiveTab,
    updateCursorPosition,
  };
}

export const tabsStore = createRoot(createTabsStore);
