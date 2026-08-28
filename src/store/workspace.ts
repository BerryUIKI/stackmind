import { createSignal, createRoot } from "solid-js";
import {
  FileNode,
  WorkspaceMetadata,
  TrashRecord,
  initOrOpenWorkspace,
  getActiveWorkspace,
  listWorkspaces,
  readDirectory,
  createFile,
  createDirectory,
  deleteToTrash,
  restoreFromTrash,
  listTrash,
  emptyTrash,
} from "@/lib/tauri/commands";

function createWorkspaceStore() {
  const [activeWorkspace, setActiveWorkspace] = createSignal<WorkspaceMetadata | null>(null);
  const [workspaces, setWorkspaces] = createSignal<WorkspaceMetadata[]>([]);
  const [fileTree, setFileTree] = createSignal<FileNode[]>([]);
  const [trashItems, setTrashItems] = createSignal<TrashRecord[]>([]);
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set());
  const [filterQuery, setFilterQuery] = createSignal<string>("");

  const refreshWorkspaces = async () => {
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      console.error("Failed to list workspaces:", e);
    }
  };

  const refreshTree = async () => {
    try {
      const tree = await readDirectory();
      setFileTree(tree);
    } catch (e) {
      console.error("Failed to read directory tree:", e);
    }
  };

  const refreshTrash = async () => {
    try {
      const items = await listTrash();
      setTrashItems(items);
    } catch (e) {
      console.error("Failed to list trash:", e);
    }
  };

  const openWorkspace = async (path: string, name?: string) => {
    try {
      const meta = await initOrOpenWorkspace(path, name);
      setActiveWorkspace(meta);
      await refreshWorkspaces();
      await refreshTree();
      await refreshTrash();
    } catch (e) {
      console.error("Failed to open workspace:", e);
      throw e;
    }
  };

  const toggleFolder = (folderPath: string) => {
    const next = new Set(expandedFolders());
    if (next.has(folderPath)) {
      next.delete(folderPath);
    } else {
      next.add(folderPath);
    }
    setExpandedFolders(next);
  };

  const newNote = async (relPath: string, content?: string) => {
    const finalPath = relPath.endsWith(".md") ? relPath : `${relPath}.md`;
    await createFile(finalPath, content || `# New Note\n\n`);
    await refreshTree();
    return finalPath;
  };

  const newFolder = async (relPath: string) => {
    await createDirectory(relPath);
    await refreshTree();
  };

  const removeToTrash = async (relPath: string) => {
    await deleteToTrash(relPath);
    await refreshTree();
    await refreshTrash();
  };

  const restoreTrashItem = async (trashFilename: string, origRelPath: string) => {
    await restoreFromTrash(trashFilename, origRelPath);
    await refreshTree();
    await refreshTrash();
  };

  const clearTrash = async () => {
    await emptyTrash();
    await refreshTrash();
  };

  return {
    activeWorkspace,
    setActiveWorkspace,
    workspaces,
    fileTree,
    trashItems,
    expandedFolders,
    filterQuery,
    setFilterQuery,
    openWorkspace,
    refreshTree,
    refreshTrash,
    refreshWorkspaces,
    toggleFolder,
    newNote,
    newFolder,
    removeToTrash,
    restoreTrashItem,
    clearTrash,
  };
}

export const workspaceStore = createRoot(createWorkspaceStore);
