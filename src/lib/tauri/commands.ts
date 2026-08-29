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

export interface DbLinkRecord {
  id: number;
  source_file_id: number;
  source_relative_path: string;
  source_block_id: number | null;
  target_relative_path: string;
  target_file_id: number | null;
  target_block_id: string | null;
  link_type: string;
  link_text: string;
  line_number: number;
  is_broken: boolean;
  created_at: number;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface BacklinkItem {
  source_file_path: string;
  source_file_name: string;
  line_number: number;
  link_text: string;
  target_block_id: string | null;
  context_snippet: string;
}

export async function getFileBacklinks(relativePath: string): Promise<BacklinkItem[]> {
  return await invoke<BacklinkItem[]>("get_file_backlinks", { relativePath });
}

export async function getFileOutlinks(relativePath: string): Promise<DbLinkRecord[]> {
  return await invoke<DbLinkRecord[]>("get_file_outlinks", { relativePath });
}

export async function listWorkspaceTags(): Promise<TagCount[]> {
  return await invoke<TagCount[]>("list_workspace_tags");
}

export async function rebuildWorkspaceIndex(): Promise<void> {
  await invoke("rebuild_workspace_index");
}

export interface ParsedBlock {
  block_id: string;
  block_type: string;
  heading_level: number | null;
  start_line: number;
  end_line: number;
  start_char: number;
  end_char: number;
  content: string;
  content_hash: string;
  text_preview: string;
}

export interface ParsedLink {
  target_path: string;
  target_block_id: string | null;
  target_heading: string | null;
  alias: string | null;
  link_text: string;
  line_number: number;
  is_wikilink: boolean;
}

export interface ParsedDocument {
  frontmatter_raw: string | null;
  frontmatter_fields: Record<string, any>;
  tags: string[];
  blocks: ParsedBlock[];
  links: ParsedLink[];
}

export interface RepairedFileResult {
  file_path: string;
  rewrites_count: number;
}

export async function parseDocument(relativePath: string): Promise<ParsedDocument> {
  return await invoke<ParsedDocument>("parse_document", { relativePath });
}

export async function insertBlockAnchor(relativePath: string, targetLine: number): Promise<string> {
  return await invoke<string>("insert_block_anchor", { relativePath, targetLine });
}

export async function repairLinksOnRename(oldPath: string, newPath: string): Promise<RepairedFileResult[]> {
  return await invoke<RepairedFileResult[]>("repair_links_on_rename", { oldPath, newPath });
}

export interface SearchResult {
  path: string;
  file_name: string;
  title: string;
  block_id: string | null;
  block_type: string | null;
  snippet: string;
  score: number;
  tags: string[];
  is_block: boolean;
}

export async function searchWorkspace(query: string, limit?: number): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_workspace", { query, limit });
}

export async function rebuildSearchIndex(): Promise<void> {
  await invoke("rebuild_search_index");
}

export interface GraphNode {
  id: string;
  label: string;
  node_type: "note" | "block" | "tag";
  path: string;
  block_id: string | null;
  degree: number;
  group: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  edge_type: "wikilink" | "block_ref" | "tag";
}

export interface WorkspaceGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphFilter {
  include_blocks?: boolean;
  include_tags?: boolean;
  search_query?: string;
}

export async function getWorkspaceGraphData(filter?: GraphFilter): Promise<WorkspaceGraphData> {
  return await invoke<WorkspaceGraphData>("get_workspace_graph_data", { filter });
}

export async function getLocalGraphData(relativePath: string, depth?: number): Promise<WorkspaceGraphData> {
  return await invoke<WorkspaceGraphData>("get_local_graph_data", { relativePath, depth });
}

export interface GitFileStatus {
  path: string;
  status: "modified" | "untracked" | "deleted" | "staged";
}

export interface GitStatusResult {
  is_repo: boolean;
  branch: string;
  files: GitFileStatus[];
  clean: boolean;
}

export interface GitCommit {
  hash: string;
  short_hash: string;
  author: string;
  email: string;
  timestamp: number;
  message: string;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
}

export interface GitBranchesResult {
  branches: GitBranch[];
  current: string;
}

export interface GitCommitResult {
  commit_hash: string;
  message: string;
}

export async function gitStatus(): Promise<GitStatusResult> {
  return await invoke<GitStatusResult>("git_status");
}

export async function gitDiff(filePath?: string): Promise<string> {
  return await invoke<string>("git_diff", { filePath });
}

export async function gitCommit(message: string, stageAll?: boolean): Promise<GitCommitResult> {
  return await invoke<GitCommitResult>("git_commit", { message, stageAll });
}

export async function gitLog(limit?: number): Promise<GitCommit[]> {
  return await invoke<GitCommit[]>("git_log", { limit });
}

export async function gitListBranches(): Promise<GitBranchesResult> {
  return await invoke<GitBranchesResult>("git_list_branches");
}

export async function gitCheckoutBranch(branchName: string): Promise<void> {
  await invoke("git_checkout_branch", { branchName });
}

export async function gitCreateBranch(branchName: string): Promise<void> {
  await invoke("git_create_branch", { branchName });
}

export interface TransclusionPayload {
  resolved_path: string;
  title: string;
  block_id: string | null;
  heading: string | null;
  content: string;
  exists: boolean;
  is_circular: boolean;
}

export async function resolveTransclusion(
  targetPath: string,
  blockId?: string,
  heading?: string
): Promise<TransclusionPayload> {
  return await invoke<TransclusionPayload>("resolve_transclusion", {
    targetPath,
    blockId,
    heading,
  });
}


