import { invoke } from "@tauri-apps/api/core";

export interface PingResponse {
  message: string;
  timestamp: number;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_opened_at: number;
  version: string;
}

export interface TabState {
  relative_path: string;
  mode: string;
  scroll_ratio: number;
  cursor_line: number;
  cursor_col: number;
}

export interface SessionState {
  open_tabs: TabState[];
  active_tab_path: string | null;
  sidebar_width: number;
  sidebar_collapsed: boolean;
  inspector_width: number;
  inspector_collapsed: boolean;
  inspector_tab: string;
  expanded_folders: string[];
}

export interface FileNode {
  name: string;
  relative_path: string;
  is_dir: boolean;
  size_bytes: number;
  mtime_ms: number;
  children?: FileNode[] | null;
}

export interface FilePayload {
  relative_path: string;
  content: string;
  size_bytes: number;
  mtime_ms: number;
  hash_blake3: string;
}

export interface TrashRecord {
  id: string;
  original_relative_path: string;
  trash_filename: string;
  file_size_bytes: number;
  deleted_at: number;
}

export async function pingBackend(): Promise<PingResponse> {
  return await invoke<PingResponse>("ping");
}

export async function initOrOpenWorkspace(path: string, name?: string): Promise<WorkspaceMetadata> {
  return await invoke<WorkspaceMetadata>("init_or_open_workspace", { path, name });
}

export async function getActiveWorkspace(): Promise<WorkspaceMetadata | null> {
  return await invoke<WorkspaceMetadata | null>("get_active_workspace");
}

export async function listWorkspaces(): Promise<WorkspaceMetadata[]> {
  return await invoke<WorkspaceMetadata[]>("list_workspaces");
}

export async function removeWorkspace(id: string): Promise<void> {
  await invoke("remove_workspace", { id });
}

export async function saveWorkspaceSession(session: SessionState): Promise<void> {
  await invoke("save_workspace_session", { session });
}

export async function loadWorkspaceSession(): Promise<SessionState> {
  return await invoke<SessionState>("load_workspace_session");
}

export async function readDirectory(relativePath?: string): Promise<FileNode[]> {
  return await invoke<FileNode[]>("read_directory", { relativePath });
}

export async function readFile(relativePath: string): Promise<FilePayload> {
  return await invoke<FilePayload>("read_file", { relativePath });
}

export async function writeFileAtomic(relativePath: string, content: string): Promise<FilePayload> {
  return await invoke<FilePayload>("write_file_atomic", { relativePath, content });
}

export async function createFile(relativePath: string, initialContent?: string): Promise<FilePayload> {
  return await invoke<FilePayload>("create_file", { relativePath, initialContent });
}

export async function createDirectory(relativePath: string): Promise<void> {
  await invoke("create_directory", { relativePath });
}

export async function renamePath(oldRelativePath: string, newRelativePath: string): Promise<void> {
  await invoke("rename_path", { oldRelativePath, newRelativePath });
}

export async function deleteToTrash(relativePath: string): Promise<TrashRecord> {
  return await invoke<TrashRecord>("delete_to_trash", { relativePath });
}

export async function restoreFromTrash(trashFilename: string, originalRelativePath: string): Promise<void> {
  await invoke("restore_from_trash", { trashFilename, originalRelativePath });
}

export async function listTrash(): Promise<TrashRecord[]> {
  return await invoke<TrashRecord[]>("list_trash");
}

export async function emptyTrash(): Promise<void> {
  await invoke("empty_trash");
}
