import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tauri commands used by tabsStore
vi.mock("@/lib/tauri/commands", () => ({
  readFile: vi.fn(async (path: string) => ({
    content: `# Content of ${path}`,
    mtime_ms: Date.now(),
    path,
  })),
  writeFileAtomic: vi.fn(async (path: string, content: string) => ({
    content,
    mtime_ms: Date.now(),
    path,
  })),
}));

import { tabsStore } from "./tabs";

describe("tabsStore Navigation & Reordering", () => {
  beforeEach(async () => {
    // Reset tabs
    const all = [...tabsStore.tabs()];
    for (const t of all) {
      tabsStore.closeTab(t.path);
    }
    // Open three test tabs
    await tabsStore.openTab("note-a.md");
    await tabsStore.openTab("note-b.md");
    await tabsStore.openTab("note-c.md");
  });

  it("opens tabs and marks the latest opened tab active", () => {
    expect(tabsStore.tabs().length).toBe(3);
    expect(tabsStore.activeTabPath()).toBe("note-c.md");
  });

  it("cycles to the next tab with nextTab()", () => {
    // Current is note-c.md (index 2). Next should wrap to index 0 (note-a.md)
    tabsStore.nextTab();
    expect(tabsStore.activeTabPath()).toBe("note-a.md");

    tabsStore.nextTab();
    expect(tabsStore.activeTabPath()).toBe("note-b.md");
  });

  it("cycles to the previous tab with prevTab()", () => {
    // Current is note-c.md (index 2). Prev should be index 1 (note-b.md)
    tabsStore.prevTab();
    expect(tabsStore.activeTabPath()).toBe("note-b.md");

    tabsStore.prevTab();
    expect(tabsStore.activeTabPath()).toBe("note-a.md");

    // Prev from index 0 should wrap to index 2 (note-c.md)
    tabsStore.prevTab();
    expect(tabsStore.activeTabPath()).toBe("note-c.md");
  });

  it("moves active tab left with moveActiveTabLeft()", () => {
    // Currently on note-c.md at index 2
    tabsStore.moveActiveTabLeft();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-a.md", "note-c.md", "note-b.md"]);

    tabsStore.moveActiveTabLeft();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-c.md", "note-a.md", "note-b.md"]);

    // Moving left at index 0 is a no-op
    tabsStore.moveActiveTabLeft();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-c.md", "note-a.md", "note-b.md"]);
  });

  it("moves active tab right with moveActiveTabRight()", () => {
    // Move to note-a.md first
    tabsStore.setActiveTabPath("note-a.md");
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-a.md", "note-b.md", "note-c.md"]);

    tabsStore.moveActiveTabRight();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-b.md", "note-a.md", "note-c.md"]);

    tabsStore.moveActiveTabRight();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-b.md", "note-c.md", "note-a.md"]);

    // Moving right at the end is a no-op
    tabsStore.moveActiveTabRight();
    expect(tabsStore.tabs().map((t) => t.path)).toEqual(["note-b.md", "note-c.md", "note-a.md"]);
  });
});
