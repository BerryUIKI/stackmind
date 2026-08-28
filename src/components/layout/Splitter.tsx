import { Component } from "solid-js";
import { uiStore } from "@/store/ui";

interface Props {
  direction: "left" | "right";
}

export const Splitter: Component<Props> = (props) => {
  let isDragging = false;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging) return;

      if (props.direction === "left") {
        const newWidth = Math.max(180, Math.min(450, ev.clientX));
        uiStore.setSidebarWidth(newWidth);
        if (uiStore.sidebarCollapsed()) {
          uiStore.setSidebarCollapsed(false);
        }
      } else {
        const windowWidth = window.innerWidth;
        const newWidth = Math.max(220, Math.min(500, windowWidth - ev.clientX));
        uiStore.setInspectorWidth(newWidth);
        if (uiStore.inspectorCollapsed()) {
          uiStore.setInspectorCollapsed(false);
        }
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (props.direction === "left") {
      uiStore.toggleSidebar();
    } else {
      uiStore.toggleInspector();
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDblClick={handleDoubleClick}
      class="w-1.5 hover:w-1.5 h-full cursor-col-resize flex items-center justify-center group z-30 transition-all select-none relative"
      title="Drag to resize, double-click to collapse/expand"
    >
      <div class="w-[1px] h-full bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] group-hover:w-[2px] transition-colors" />
    </div>
  );
};
