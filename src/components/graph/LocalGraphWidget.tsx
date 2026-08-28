import { Component, Show, createSignal, createEffect } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { uiStore } from "@/store/ui";
import { getLocalGraphData, WorkspaceGraphData, GraphNode } from "@/lib/tauri/commands";
import { GraphCanvas } from "./GraphCanvas";

export const LocalGraphWidget: Component = () => {
  const [graphData, setGraphData] = createSignal<WorkspaceGraphData>({
    nodes: [],
    edges: [],
  });
  const [isLoading, setIsLoading] = createSignal(false);

  const activeTab = () => tabsStore.getActiveTab();

  createEffect(() => {
    const tab = activeTab();
    if (!tab) {
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    setIsLoading(true);
    getLocalGraphData(tab.path, 1)
      .then((res) => {
        setGraphData(res);
      })
      .catch((e) => {
        console.warn("Failed to load local graph data:", e);
        setGraphData({ nodes: [], edges: [] });
      })
      .finally(() => setIsLoading(false));
  });

  const handleNodeClick = (node: GraphNode) => {
    if (node.path && node.path !== activeTab()?.path) {
      tabsStore.openTab(node.path);
    }
  };

  return (
    <div class="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header Info */}
      <div class="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between text-xs">
        <div class="flex items-center space-x-1.5 truncate">
          <span class="font-medium text-[var(--color-text-secondary)]">Local Neighborhood</span>
          <span class="text-[10px] text-[var(--color-text-muted)]">
            ({graphData().nodes.length} nodes)
          </span>
        </div>

        <button
          onClick={() => uiStore.setGraphModalOpen(true)}
          class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Open Global Graph ↗
        </button>
      </div>

      {/* Canvas Area */}
      <div class="flex-1 relative overflow-hidden">
        <Show
          when={activeTab()}
          fallback={
            <div class="h-full flex items-center justify-center p-4 text-xs text-[var(--color-text-muted)] italic">
              No active note selected
            </div>
          }
        >
          <Show
            when={!isLoading()}
            fallback={
              <div class="h-full flex items-center justify-center">
                <div class="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <GraphCanvas
              data={graphData()}
              highlightNodeId={activeTab()?.path}
              onNodeClick={handleNodeClick}
              linkDistance={55}
              chargeStrength={-120}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};
