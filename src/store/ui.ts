import { createSignal, createRoot } from "solid-js";

export type EditorMode = "source" | "preview" | "split";
export type InspectorTab = "metadata" | "outlinks" | "backlinks" | "outline" | "graph";
export type Theme = "dark" | "light";

function createUIStore() {
  const [sidebarWidth, setSidebarWidth] = createSignal<number>(260);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal<boolean>(false);

  const [inspectorWidth, setInspectorWidth] = createSignal<number>(300);
  const [inspectorCollapsed, setInspectorCollapsed] = createSignal<boolean>(false);
  const [inspectorTab, setInspectorTab] = createSignal<InspectorTab>("metadata");

  const [editorMode, setEditorMode] = createSignal<EditorMode>("split");
  const [theme, setThemeState] = createSignal<Theme>("dark");

  const [searchOpen, setSearchOpen] = createSignal<boolean>(false);
  const [trashModalOpen, setTrashModalOpen] = createSignal<boolean>(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = createSignal<boolean>(false);
  const [graphModalOpen, setGraphModalOpen] = createSignal<boolean>(false);
  const [gitModalOpen, setGitModalOpen] = createSignal<boolean>(false);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed());
  const toggleInspector = () => setInspectorCollapsed(!inspectorCollapsed());

  const toggleTheme = () => {
    const next = theme() === "dark" ? "light" : "dark";
    setThemeState(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return {
    sidebarWidth,
    setSidebarWidth,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,

    inspectorWidth,
    setInspectorWidth,
    inspectorCollapsed,
    setInspectorCollapsed,
    toggleInspector,
    inspectorTab,
    setInspectorTab,

    editorMode,
    setEditorMode,

    theme,
    setTheme,
    toggleTheme,

    searchOpen,
    setSearchOpen,
    trashModalOpen,
    setTrashModalOpen,
    workspaceModalOpen,
    setWorkspaceModalOpen,
    graphModalOpen,
    setGraphModalOpen,
    gitModalOpen,
    setGitModalOpen,
  };
}

export const uiStore = createRoot(createUIStore);
