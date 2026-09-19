import { Component, Show, createSignal, onMount, onCleanup, createEffect, For } from "solid-js";
import { uiStore } from "@/store/ui";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";
import { listTemplates, applyTemplate, TemplateMetadata } from "@/lib/tauri/commands";

export const TemplateModal: Component = () => {
  const [templates, setTemplates] = createSignal<TemplateMetadata[]>([]);
  const [selectedTemplate, setSelectedTemplate] = createSignal<TemplateMetadata | null>(null);
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [newNoteTitle, setNewNoteTitle] = createSignal<string>("");

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiStore.templateModalOpen()) {
        uiStore.setTemplateModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const refreshTemplates = async () => {
    try {
      const list = await listTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplate()) {
        setSelectedTemplate(list[0]);
        setNewNoteTitle(list[0].name);
      }
    } catch (e) {
      console.warn("Failed to load templates:", e);
    }
  };

  createEffect(() => {
    if (uiStore.templateModalOpen()) {
      refreshTemplates();
    }
  });

  const filteredTemplates = () => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return templates();
    return templates().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  };

  const handleSelect = (tpl: TemplateMetadata) => {
    setSelectedTemplate(tpl);
    setNewNoteTitle(tpl.name);
  };

  const handleInsert = async () => {
    const tpl = selectedTemplate();
    const activeTab = tabsStore.getActiveTab();
    if (!tpl || !activeTab) return;

    try {
      const noteTitle = activeTab.title || "Untitled";
      const evaluated = await applyTemplate(tpl.name, noteTitle);
      
      const currentContent = activeTab.content || "";
      const updated = currentContent ? `${currentContent}\n\n${evaluated}` : evaluated;
      tabsStore.updateTabContent(updated);
      uiStore.setTemplateModalOpen(false);
    } catch (e) {
      console.error("Failed to insert template:", e);
    }
  };

  const handleCreateNew = async () => {
    const tpl = selectedTemplate();
    if (!tpl) return;

    const title = (newNoteTitle().trim() || tpl.name);
    try {
      const evaluated = await applyTemplate(tpl.name, title);
      const relPath = await workspaceStore.newNote(title);
      await tabsStore.openTab(relPath);
      tabsStore.updateTabContent(evaluated);
      await tabsStore.saveActiveTab();
      uiStore.setTemplateModalOpen(false);
    } catch (e) {
      console.error("Failed to create note from template:", e);
    }
  };

  return (
    <Show when={uiStore.templateModalOpen()}>
      <div
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
        onClick={(e) => {
          if (e.target === e.currentTarget) uiStore.setTemplateModalOpen(false);
        }}
      >
        <div class="w-full max-w-3xl h-[540px] rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden text-sm">
          {/* Header */}
          <div class="h-12 px-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-secondary)] select-none">
            <div class="flex items-center space-x-2">
              <span class="text-indigo-400 font-bold text-base">📑</span>
              <h2 class="font-semibold text-[var(--color-text-primary)]">
                Markdown Templates & Snippets
              </h2>
            </div>
            <button
              onClick={() => uiStore.setTemplateModalOpen(false)}
              class="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body Split View */}
          <div class="flex-1 flex overflow-hidden">
            {/* Left Column: Template List */}
            <div class="w-72 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-secondary)]">
              {/* Search filter */}
              <div class="p-3 border-b border-[var(--color-border)]">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Template list */}
              <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <For
                  each={filteredTemplates()}
                  fallback={
                    <div class="p-4 text-xs text-[var(--color-text-muted)] text-center">
                      No templates found.
                    </div>
                  }
                >
                  {(tpl) => (
                    <div
                      onClick={() => handleSelect(tpl)}
                      class={`p-2.5 rounded-lg cursor-pointer transition-all ${
                        selectedTemplate()?.name === tpl.name
                          ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                          : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                      }`}
                    >
                      <div class="font-medium text-xs flex items-center space-x-1.5 capitalize">
                        <span>📄</span>
                        <span class="truncate">{tpl.name}</span>
                      </div>
                      <Show when={tpl.description}>
                        <p class="text-[11px] text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-snug">
                          {tpl.description}
                        </p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Right Column: Live Preview & Action Controls */}
            <div class="flex-1 flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
              <Show
                when={selectedTemplate()}
                fallback={
                  <div class="flex-1 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                    Select a template to view details
                  </div>
                }
              >
                {(tpl) => (
                  <div class="flex-1 flex flex-col overflow-hidden p-4">
                    {/* Template details */}
                    <div class="flex items-center justify-between mb-2">
                      <div>
                        <h3 class="font-semibold text-sm text-[var(--color-text-primary)] capitalize">
                          {tpl().name} Template
                        </h3>
                        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {tpl().description || "Markdown template with dynamic variable interpolation."}
                        </p>
                      </div>
                      <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">
                        .md
                      </span>
                    </div>

                    {/* Preview Box */}
                    <div class="flex-1 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-y-auto custom-scrollbar font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap select-text leading-relaxed">
                      {tpl().content}
                    </div>

                    {/* Bottom Action Form */}
                    <div class="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                      <div class="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="New note title..."
                          value={newNoteTitle()}
                          onInput={(e) => setNewNoteTitle(e.currentTarget.value)}
                          class="w-48 px-2.5 py-1.5 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-hidden focus:border-[var(--color-accent)]"
                        />
                        <button
                          onClick={handleCreateNew}
                          class="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors cursor-pointer"
                        >
                          New Note from Template
                        </button>
                      </div>

                      <button
                        onClick={handleInsert}
                        disabled={!tabsStore.getActiveTab()}
                        class="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!tabsStore.getActiveTab() ? "Open a note first to insert" : "Insert template at cursor"}
                      >
                        Insert into Active Note
                      </button>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
