import { Component, onMount, onCleanup, createEffect } from "solid-js";
import { GraphNode, GraphEdge, WorkspaceGraphData } from "@/lib/tauri/commands";

interface SimNode {
  id: string;
  label: string;
  node_type: "note" | "block" | "tag";
  path: string;
  block_id: string | null;
  degree: number;
  group: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pinned?: boolean;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  edge_type: "wikilink" | "block_ref" | "tag";
}

interface GraphCanvasProps {
  data: WorkspaceGraphData;
  onNodeClick?: (node: GraphNode) => void;
  highlightNodeId?: string;
  linkDistance?: number;
  chargeStrength?: number;
  centerStrength?: number;
}

export const GraphCanvas: Component<GraphCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  let animFrameId: number = 0;
  let simNodes: SimNode[] = [];
  let simEdges: SimEdge[] = [];
  let nodeMap: Map<string, SimNode> = new Map();

  // Viewport transform
  let transform = {
    x: 0,
    y: 0,
    k: 1.0,
  };

  let hoveredNode: SimNode | null = null;
  let draggedNode: SimNode | null = null;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let initialPanned = false;

  const initSimulationData = () => {
    if (!props.data) return;

    const width = containerRef?.clientWidth || 600;
    const height = containerRef?.clientHeight || 400;

    nodeMap.clear();
    simNodes = props.data.nodes.map((n, i) => {
      // Circle layout initial placement
      const angle = (i / Math.max(1, props.data.nodes.length)) * 2 * Math.PI;
      const dist = 80 + Math.random() * 120;
      const radius = Math.min(22, Math.max(5, 5 + 2 * Math.log2(n.degree + 1)));

      const simNode: SimNode = {
        ...n,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius,
      };
      nodeMap.set(n.id, simNode);
      return simNode;
    });

    simEdges = [];
    for (const e of props.data.edges) {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (src && tgt) {
        simEdges.push({
          source: src,
          target: tgt,
          edge_type: e.edge_type,
        });
      }
    }

    if (!initialPanned && containerRef) {
      transform.x = width / 2;
      transform.y = height / 2;
      transform.k = 1.0;
      initialPanned = true;
    }
  };

  createEffect(() => {
    // Re-init when data changes
    initSimulationData();
  });

  const stepPhysics = () => {
    const width = containerRef?.clientWidth || 600;
    const height = containerRef?.clientHeight || 400;
    const targetDist = props.linkDistance || 70;
    const repulsion = props.chargeStrength || -160;
    const centerK = props.centerStrength || 0.015;

    // 1. Center gravity
    for (const node of simNodes) {
      if (node.pinned) continue;
      const dx = width / 2 - node.x;
      const dy = height / 2 - node.y;
      node.vx += dx * centerK;
      node.vy += dy * centerK;
    }

    // 2. Many-body charge repulsion (all pairs)
    const nLen = simNodes.length;
    for (let i = 0; i < nLen; i++) {
      const n1 = simNodes[i];
      for (let j = i + 1; j < nLen; j++) {
        const n2 = simNodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const d2 = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(d2);

        // Repulsive force
        const force = repulsion / d2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!n1.pinned) {
          n1.vx += fx;
          n1.vy += fy;
        }
        if (!n2.pinned) {
          n2.vx -= fx;
          n2.vy -= fy;
        }

        // Collision separation
        const minDist = n1.radius + n2.radius + 6;
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          const sx = (dx / dist) * overlap;
          const sy = (dy / dist) * overlap;
          if (!n1.pinned) {
            n1.x -= sx;
            n1.y -= sy;
          }
          if (!n2.pinned) {
            n2.x += sx;
            n2.y += sy;
          }
        }
      }
    }

    // 3. Link spring attraction
    for (const edge of simEdges) {
      const n1 = edge.source;
      const n2 = edge.target;
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = dist - targetDist;
      const force = diff * 0.05;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!n1.pinned) {
        n1.vx += fx;
        n1.vy += fy;
      }
      if (!n2.pinned) {
        n2.vx -= fx;
        n2.vy -= fy;
      }
    }

    // 4. Update positions with damping
    for (const node of simNodes) {
      if (node.pinned) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.x += node.vx;
      node.y += node.vy;
    }
  };

  const renderCanvas = () => {
    if (!canvasRef || !containerRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerRef.clientWidth;
    const height = containerRef.clientHeight;

    if (canvasRef.width !== width * dpr || canvasRef.height !== height * dpr) {
      canvasRef.width = width * dpr;
      canvasRef.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply pan & zoom
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    ctx.translate(-width / 2, -height / 2);

    // Set of highlighted node IDs
    const activeId = props.highlightNodeId || (hoveredNode ? hoveredNode.id : null);
    const highlightedNodeIds = new Set<string>();

    if (activeId) {
      highlightedNodeIds.add(activeId);
      for (const edge of simEdges) {
        if (edge.source.id === activeId) highlightedNodeIds.add(edge.target.id);
        if (edge.target.id === activeId) highlightedNodeIds.add(edge.source.id);
      }
    }

    // 1. Draw Edges
    for (const edge of simEdges) {
      const isHighlighted =
        activeId && (edge.source.id === activeId || edge.target.id === activeId);
      const isDimmed = activeId && !isHighlighted;

      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);

      if (isHighlighted) {
        ctx.strokeStyle = "rgba(99, 102, 241, 0.8)";
        ctx.lineWidth = 2.0;
      } else if (isDimmed) {
        ctx.strokeStyle = "rgba(100, 116, 139, 0.08)";
        ctx.lineWidth = 0.75;
      } else {
        ctx.strokeStyle =
          edge.edge_type === "tag"
            ? "rgba(245, 158, 11, 0.25)"
            : edge.edge_type === "block_ref"
            ? "rgba(6, 182, 212, 0.3)"
            : "rgba(148, 163, 184, 0.22)";
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();

      // Draw directional arrow on forward link
      if (isHighlighted || (!isDimmed && transform.k > 1.2)) {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const angle = Math.atan2(dy, dx);
        const arrowDist = edge.target.radius + 3;
        const ax = edge.target.x - Math.cos(angle) * arrowDist;
        const ay = edge.target.y - Math.sin(angle) * arrowDist;

        ctx.fillStyle = isHighlighted ? "rgba(99, 102, 241, 0.9)" : "rgba(148, 163, 184, 0.4)";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - Math.cos(angle - Math.PI / 6) * 5,
          ay - Math.sin(angle - Math.PI / 6) * 5
        );
        ctx.lineTo(
          ax - Math.cos(angle + Math.PI / 6) * 5,
          ay - Math.sin(angle + Math.PI / 6) * 5
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Draw Nodes
    for (const node of simNodes) {
      const isSelected = activeId === node.id;
      const isConnected = highlightedNodeIds.has(node.id);
      const isDimmed = activeId && !isConnected;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

      let fillColor = "#6366f1"; // note default (indigo)
      if (node.node_type === "block") fillColor = "#06b6d4"; // cyan
      if (node.node_type === "tag") fillColor = "#f59e0b"; // amber

      if (isSelected) {
        ctx.fillStyle = "#818cf8";
        ctx.shadowColor = "#6366f1";
        ctx.shadowBlur = 12;
      } else if (isDimmed) {
        ctx.fillStyle = "rgba(100, 116, 139, 0.15)";
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = fillColor;
        ctx.shadowBlur = 0;
      }

      ctx.fill();
      ctx.shadowBlur = 0;

      // Node border
      ctx.lineWidth = isSelected ? 2.5 : 1.2;
      ctx.strokeStyle = isSelected
        ? "#ffffff"
        : isDimmed
        ? "rgba(100, 116, 139, 0.1)"
        : "rgba(255, 255, 255, 0.3)";
      ctx.stroke();

      // Node Label
      const shouldDrawLabel =
        isSelected ||
        isConnected ||
        transform.k > 1.2 ||
        (transform.k > 0.7 && node.degree > 1);

      if (shouldDrawLabel && !isDimmed) {
        ctx.font = `${Math.max(9, Math.min(12, 11 / transform.k))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = isSelected
          ? "#ffffff"
          : isConnected
          ? "#e2e8f0"
          : "rgba(203, 213, 225, 0.75)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label, node.x, node.y + node.radius + 3);
      }
    }

    ctx.restore();
  };

  const loop = () => {
    stepPhysics();
    renderCanvas();
    animFrameId = requestAnimationFrame(loop);
  };

  const getCanvasMousePos = (e: MouseEvent) => {
    if (!containerRef) return { x: 0, y: 0 };
    const rect = containerRef.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Invert viewport transformation
    const x = (clientX - transform.x) / transform.k + width / 2;
    const y = (clientY - transform.y) / transform.k + height / 2;
    return { x, y, clientX, clientY };
  };

  const findNodeUnderMouse = (mx: number, my: number): SimNode | null => {
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const dx = mx - n.x;
      const dy = my - n.y;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  };

  const handleMouseDown = (e: MouseEvent) => {
    const pos = getCanvasMousePos(e);
    const node = findNodeUnderMouse(pos.x, pos.y);

    if (node) {
      draggedNode = node;
      node.pinned = true;
    } else {
      isPanning = true;
      panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const pos = getCanvasMousePos(e);

    if (draggedNode) {
      draggedNode.x = pos.x;
      draggedNode.y = pos.y;
    } else if (isPanning) {
      transform.x = e.clientX - panStart.x;
      transform.y = e.clientY - panStart.y;
    } else {
      hoveredNode = findNodeUnderMouse(pos.x, pos.y);
      if (containerRef) {
        containerRef.style.cursor = hoveredNode ? "pointer" : "grab";
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      draggedNode.pinned = false;
      draggedNode = null;
    }
    isPanning = false;
    if (containerRef) {
      containerRef.style.cursor = hoveredNode ? "pointer" : "grab";
    }
  };

  const handleClick = (e: MouseEvent) => {
    const pos = getCanvasMousePos(e);
    const node = findNodeUnderMouse(pos.x, pos.y);
    if (node && props.onNodeClick) {
      props.onNodeClick({
        id: node.id,
        label: node.label,
        node_type: node.node_type,
        path: node.path,
        block_id: node.block_id,
        degree: node.degree,
        group: node.group,
      });
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef) return;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newK = Math.max(0.2, Math.min(4.0, transform.k * zoomFactor));

    const rect = containerRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    transform.x = mouseX - (mouseX - transform.x) * (newK / transform.k);
    transform.y = mouseY - (mouseY - transform.y) * (newK / transform.k);
    transform.k = newK;
  };

  onMount(() => {
    initSimulationData();
    animFrameId = requestAnimationFrame(loop);

    if (containerRef) {
      containerRef.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      containerRef.addEventListener("click", handleClick);
      containerRef.addEventListener("wheel", handleWheel, { passive: false });
    }

    onCleanup(() => {
      cancelAnimationFrame(animFrameId);
      if (containerRef) {
        containerRef.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        containerRef.removeEventListener("click", handleClick);
        containerRef.removeEventListener("wheel", handleWheel);
      }
    });
  });

  return (
    <div
      ref={containerRef}
      class="relative w-full h-full overflow-hidden bg-[var(--color-bg-primary)] select-none"
    >
      <canvas ref={canvasRef} class="w-full h-full block" />
    </div>
  );
};
