import { Component, createSignal, onMount, onCleanup, For, Show, createEffect } from "solid-js";
import {
  readCanvas,
  saveCanvas,
  CanvasData,
  CanvasNode,
  CanvasEdge,
} from "@/lib/tauri/commands";
import { tabsStore } from "@/store/tabs";

interface SpatialCanvasProps {
  path: string;
}

export const SpatialCanvas: Component<SpatialCanvasProps> = (props) => {
  const [nodes, setNodes] = createSignal<CanvasNode[]>([]);
  const [edges, setEdges] = createSignal<CanvasEdge[]>([]);
  const [pan, setPan] = createSignal<{ x: number; y: number }>({ x: 200, y: 150 });
  const [zoom, setZoom] = createSignal<number>(1);
  const [isPanning, setIsPanning] = createSignal<boolean>(false);
  const [dragStart, setDragStart] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = createSignal<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Edge Connection state
  const [connectingFromId, setConnectingFromId] = createSignal<string | null>(null);

  let containerRef: HTMLDivElement | undefined;
  let saveTimer: any = null;

  const loadData = async () => {
    try {
      const data = await readCanvas(props.path);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (e) {
      console.warn("Failed to load canvas data:", e);
    }
  };

  createEffect(() => {
    if (props.path) {
      loadData();
    }
  });

  const triggerAutoSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const payload: CanvasData = {
          version: 1,
          nodes: nodes(),
          edges: edges(),
        };
        await saveCanvas(props.path, payload);
      } catch (e) {
        console.error("Failed to save canvas:", e);
      }
    }, 600);
  };

  // Viewport Pan / Zoom handlers
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom() * zoomFactor, 0.2), 2.5);

      const rect = containerRef.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentPan = pan();
      const newPanX = mouseX - (mouseX - currentPan.x) * (newZoom / zoom());
      const newPanY = mouseY - (mouseY - currentPan.y) * (newZoom / zoom());

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // Pan
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    // Only pan if clicking empty canvas background or middle button
    if (e.target === containerRef || (e.target as HTMLElement).classList.contains("canvas-bg") || e.button === 1) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan().x, y: e.clientY - pan().y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning()) {
      setPan({
        x: e.clientX - dragStart().x,
        y: e.clientY - dragStart().y,
      });
    } else if (draggingNodeId()) {
      const id = draggingNodeId();
      const offset = nodeDragOffset();
      const currentZoom = zoom();
      const currentPan = pan();

      // Convert mouse client coordinates to canvas world coordinates
      const worldX = (e.clientX - currentPan.x) / currentZoom - offset.x;
      const worldY = (e.clientY - currentPan.y) / currentZoom - offset.y;

      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x: Math.round(worldX), y: Math.round(worldY) } : n))
      );
      triggerAutoSave();
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  onMount(() => {
    window.addEventListener("mouseup", handleMouseUp);
    onCleanup(() => {
      window.removeEventListener("mouseup", handleMouseUp);
      if (saveTimer) clearTimeout(saveTimer);
    });
  });

  // Node Manipulation
  const startDragNode = (e: MouseEvent, node: CanvasNode) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    const currentZoom = zoom();
    const currentPan = pan();
    const worldMouseX = (e.clientX - currentPan.x) / currentZoom;
    const worldMouseY = (e.clientY - currentPan.y) / currentZoom;
    setNodeDragOffset({
      x: worldMouseX - node.x,
      y: worldMouseY - node.y,
    });
  };

  const handleAddTextNode = () => {
    const currentPan = pan();
    const currentZoom = zoom();
    const spawnX = (300 - currentPan.x) / currentZoom;
    const spawnY = (200 - currentPan.y) / currentZoom;

    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type: "text",
      x: Math.round(spawnX),
      y: Math.round(spawnY),
      width: 220,
      height: 140,
      text: "New idea or annotation...",
      color: "indigo",
    };

    setNodes((prev) => [...prev, newNode]);
    triggerAutoSave();
  };

  const handleAddFileNode = () => {
    const filePath = prompt("Enter note relative path (e.g. daily/2026-08-29.md):");
    if (!filePath || !filePath.trim()) return;

    const currentPan = pan();
    const currentZoom = zoom();
    const spawnX = (350 - currentPan.x) / currentZoom;
    const spawnY = (250 - currentPan.y) / currentZoom;

    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type: "file",
      x: Math.round(spawnX),
      y: Math.round(spawnY),
      width: 250,
      height: 150,
      file: filePath.trim(),
      color: "emerald",
    };

    setNodes((prev) => [...prev, newNode]);
    triggerAutoSave();
  };

  const handleDeleteNode = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((edge) => edge.fromNode !== id && edge.toNode !== id));
    triggerAutoSave();
  };

  const handleConnect = (nodeId: string, e: MouseEvent) => {
    e.stopPropagation();
    const fromId = connectingFromId();
    if (!fromId) {
      setConnectingFromId(nodeId);
    } else if (fromId !== nodeId) {
      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}`,
        fromNode: fromId,
        toNode: nodeId,
        fromSide: "right",
        toSide: "left",
      };
      setEdges((prev) => [...prev, newEdge]);
      setConnectingFromId(null);
      triggerAutoSave();
    } else {
      setConnectingFromId(null);
    }
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    triggerAutoSave();
  };

  const handleDoubleClickNode = (node: CanvasNode) => {
    if (node.file) {
      tabsStore.openTab(node.file);
    }
  };

  // Node Colors helper
  const getNodeColorClass = (color?: string) => {
    switch (color) {
      case "emerald":
        return "border-emerald-500/40 bg-emerald-500/5";
      case "rose":
        return "border-rose-500/40 bg-rose-500/5";
      case "amber":
        return "border-amber-500/40 bg-amber-500/5";
      case "indigo":
      default:
        return "border-indigo-500/40 bg-indigo-500/5";
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      class="relative w-full h-full bg-[var(--color-bg-primary)] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        "background-image":
          "radial-gradient(var(--color-border) 1px, transparent 1px)",
        "background-size": `${24 * zoom()}px ${24 * zoom()}px`,
        "background-position": `${pan().x}px ${pan().y}px`,
      }}
    >
      {/* Floating Canvas Top-Left Toolbar */}
      <div class="absolute top-4 left-4 z-40 flex items-center space-x-2 p-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-md select-none">
        <button
          onClick={handleAddTextNode}
          class="px-2.5 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
        >
          <span>＋</span>
          <span>Text Card</span>
        </button>
        <button
          onClick={handleAddFileNode}
          class="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        >
          <span>📄</span>
          <span>Note Card</span>
        </button>
      </div>

      {/* Floating Canvas Top-Right Zoom Controls */}
      <div class="absolute top-4 right-4 z-40 flex items-center space-x-1 p-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-md text-xs select-none">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          class="w-7 h-7 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center font-bold cursor-pointer"
          title="Zoom In"
        >
          ＋
        </button>
        <span class="w-12 text-center text-[10px] font-mono text-[var(--color-text-muted)]">
          {Math.round(zoom() * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.2))}
          class="w-7 h-7 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center font-bold cursor-pointer"
          title="Zoom Out"
        >
          －
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 200, y: 150 });
          }}
          class="px-2 h-7 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[10px] cursor-pointer"
          title="Reset Zoom & Pan"
        >
          Reset
        </button>
      </div>

      {/* World Coordinate Container */}
      <div
        class="absolute origin-top-left w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
        }}
      >
        {/* SVG Directed Edges Layer */}
        <svg class="absolute top-0 left-0 w-[50000px] h-[50000px] overflow-visible pointer-events-none">
          <defs>
            <marker
              id="canvas-arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="var(--color-accent, #6366f1)" />
            </marker>
          </defs>

          <For each={edges()}>
            {(edge) => {
              const fromN = () => nodes().find((n) => n.id === edge.fromNode);
              const toN = () => nodes().find((n) => n.id === edge.toNode);

              return (
                <Show when={fromN() && toN()}>
                  {(() => {
                    const fn = fromN()!;
                    const tn = toN()!;
                    const x1 = fn.x + fn.width;
                    const y1 = fn.y + fn.height / 2;
                    const x2 = tn.x;
                    const y2 = tn.y + tn.height / 2;

                    const dx = Math.abs(x2 - x1) * 0.5;
                    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                    return (
                      <g class="pointer-events-auto cursor-pointer group">
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          stroke-width="12"
                          onClick={() => handleDeleteEdge(edge.id)}
                        />
                        <path
                          d={d}
                          fill="none"
                          stroke="var(--color-accent, #6366f1)"
                          stroke-width="2"
                          stroke-opacity="0.75"
                          marker-end="url(#canvas-arrowhead)"
                          class="group-hover:stroke-rose-400 group-hover:stroke-opacity-100 transition-colors"
                        />
                      </g>
                    );
                  })()}
                </Show>
              );
            }}
          </For>
        </svg>

        {/* Spatial Node Cards */}
        <For each={nodes()}>
          {(node) => (
            <div
              style={{
                transform: `translate(${node.x}px, ${node.y}px)`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              onDblClick={() => handleDoubleClickNode(node)}
              class={`absolute top-0 left-0 rounded-xl border bg-[var(--color-bg-secondary)] shadow-lg flex flex-col pointer-events-auto transition-shadow hover:shadow-xl select-none ${getNodeColorClass(
                node.color
              )} ${
                connectingFromId() === node.id ? "ring-2 ring-indigo-400" : ""
              }`}
            >
              {/* Card Header (Drag Handle) */}
              <div
                onMouseDown={(e) => startDragNode(e, node)}
                class="h-8 px-2.5 flex items-center justify-between border-b border-[var(--color-border)] cursor-grab active:cursor-grabbing rounded-t-xl bg-[var(--color-bg-tertiary)]/50"
              >
                <div class="flex items-center space-x-1.5 truncate text-xs font-semibold text-[var(--color-text-primary)]">
                  <span>{node.type === "file" ? "📄" : node.type === "block" ? "🔗" : "💡"}</span>
                  <span class="truncate">
                    {node.type === "file" ? node.file?.split("/").pop() : node.type === "text" ? "Card" : node.blockId}
                  </span>
                </div>

                <div class="flex items-center space-x-1">
                  <button
                    onClick={(e) => handleConnect(node.id, e)}
                    class={`p-1 text-[10px] rounded hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer ${
                      connectingFromId() === node.id ? "text-indigo-400 font-bold" : "text-[var(--color-text-muted)]"
                    }`}
                    title={connectingFromId() === node.id ? "Cancel connection" : "Connect arrow to another node"}
                  >
                    ➔
                  </button>
                  <button
                    onClick={(e) => handleDeleteNode(node.id, e)}
                    class="p-1 text-[10px] text-[var(--color-text-muted)] hover:text-rose-400 rounded hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                    title="Delete Node"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Card Content Area */}
              <div class="flex-1 p-2.5 overflow-y-auto text-xs text-[var(--color-text-secondary)] custom-scrollbar">
                <Show when={node.type === "text"}>
                  <textarea
                    value={node.text || ""}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setNodes((prev) =>
                        prev.map((n) => (n.id === node.id ? { ...n, text: val } : n))
                      );
                      triggerAutoSave();
                    }}
                    class="w-full h-full bg-transparent resize-none focus:outline-hidden text-xs text-[var(--color-text-primary)] leading-relaxed select-text"
                    placeholder="Enter text..."
                  />
                </Show>

                <Show when={node.type === "file"}>
                  <div class="space-y-1">
                    <p class="font-mono text-[10px] text-[var(--color-text-muted)] truncate">
                      {node.file}
                    </p>
                    <p class="text-xs text-[var(--color-text-secondary)] italic">
                      Double-click to open note in editor.
                    </p>
                  </div>
                </Show>

                <Show when={node.type === "block"}>
                  <div class="space-y-1">
                    <span class="text-[10px] font-mono text-indigo-400">
                      {node.blockId}
                    </span>
                    <p class="text-xs text-[var(--color-text-secondary)]">
                      {node.text || "Block transclusion card."}
                    </p>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
