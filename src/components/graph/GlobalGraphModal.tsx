import { Component, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { uiStore } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import {
  getWorkspaceGraphData,
  WorkspaceGraphData,
  GraphNode,
} from "@/lib/tauri/commands";
import { GraphCanvas } from "./GraphCanvas";

export const GlobalGraphModal: Component = () => {
  const [graphData, setGraphData] = createSignal<WorkspaceGraphData>({
    nodes: [],
    edges: [],
  });
  const [searchQuery, setSearchQuery] = createSignal("");
  const [includeTags, setIncludeTags] = createSignal(false);
  const [includeBlocks, setIncludeBlocks] = createSignal(false);
  const [linkDistance, setLinkDistance] = createSignal(75);
  const [isLoading, setIsLoading] = createSignal(false);

  const fetchGraph = async () => {
    setIsLoading(true);
    try {
      const data = await getWorkspaceGraphData({
        include_tags: includeTags(),
        include_blocks: includeBlocks(),
        search_query: searchQuery().trim() || undefined,
      });
      setGraphData(data);
    } catch (e) {
      console.warn("Failed to fetch graph data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (uiStore.graphModalOpen()) {
      fetchGraph();
    }
  });

  const handleNodeClick = (node: GraphNode) => {
    if (node.node_type === "note" || node.node_type === "block") {
      uiStore.setGraphModalOpen(false);
      tabsStore.openTab(node.path).then(() => {
        if (node.block_id) {
          setTimeout(() => {
            const el = document.getElementById(node.block_id!);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("bg-indigo-500/20", "transition-colors");
              setTimeout(() => el.classList.remove("bg-indigo-500/20"), 2000);
            }
          }, 150);
        }
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && uiStore.graphModalOpen()) {
      e.preventDefault();
      uiStore.setGraphModalOpen(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={uiStore.graphModalOpen()}>
      <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in duration-150">
        {/* Top Navigation / HUD Controls */}
        <div class="h-13 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between z-10 shrink-0">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span class="font-semibold text-sm text-[var(--color-text-primary)]">
                Knowledge Graph
              </span>
            </div>

            {/* Live Search Input */}
            <div class="relative w-48">
              <input
                type="text"
                placeholder="Filter graph..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  fetchGraph();
                }}
                class="w-full pl-7 pr-2.5 py-1 text-xs rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden"
              />
              <svg class="w-3.5 h-3.5 absolute left-2 top-2 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter Checkboxes */}
            <div class="flex items-center space-x-3 text-xs text-[var(--color-text-secondary)]">
              <label class="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTags()}
                  onChange={(e) => {
                    setIncludeTags(e.currentTarget.checked);
                    fetchGraph();
                  }}
                  class="rounded accent-indigo-500"
                />
                <span>Tags</span>
              </label>

              <label class="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBlocks()}
                  onChange={(e) => {
                    setIncludeBlocks(e.currentTarget.checked);
                    fetchGraph();
                  }}
                  class="rounded accent-indigo-500"
                />
                <span>Blocks</span>
              </label>
            </div>

            {/* Distance Slider */}
            <div class="hidden sm:flex items-center space-x-2 text-xs text-[var(--color-text-muted)]">
              <span>Spacing:</span>
              <input
                type="range"
                min="40"
                max="160"
                value={linkDistance()}
                onInput={(e) => setLinkDistance(parseInt(e.currentTarget.value))}
                class="w-20 accent-indigo-500"
              />
            </div>
          </div>

          <div class="flex items-center space-x-3">
            <span class="text-xs text-[var(--color-text-muted)] font-mono">
              {graphData().nodes.length} nodes · {graphData().edges.length} links
            </span>

            <Show when={isLoading()}>
              <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </Show>

            <button
              onClick={() => uiStore.setGraphModalOpen(false)}
              class="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Close Graph View (ESC)"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div class="flex-1 w-full h-full relative">
          <GraphCanvas
            data={graphData()}
            onNodeClick={handleNodeClick}
            linkDistance={linkDistance()}
          />
        </div>
      </div>
    </Show>
  );
};
