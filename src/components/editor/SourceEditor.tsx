import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { tabsStore } from "@/store/tabs";
import { workspaceStore } from "@/store/workspace";

interface Props {
  content: string;
  onChange: (val: string) => void;
  onScroll?: (e: Event) => void;
  ref?: (el: HTMLTextAreaElement) => void;
}

interface AutocompleteItem {
  label: string;
  path: string;
  insertText: string;
  type: "note" | "heading" | "block";
}

export const SourceEditor: Component<Props> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  let gutterRef: HTMLDivElement | undefined;

  const [autocompleteOpen, setAutocompleteOpen] = createSignal(false);
  const [autocompleteQuery, setAutocompleteQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [dropdownPosition, setDropdownPosition] = createSignal<{ top?: number; bottom?: number; left: number }>({ left: 16, bottom: 16 });

  const lines = createMemo(() => {
    const count = props.content.split("\n").length;
    return Array.from({ length: Math.max(1, count) }, (_, i) => i + 1);
  });

  const autocompleteItems = createMemo<AutocompleteItem[]>(() => {
    if (!autocompleteOpen()) return [];
    const query = autocompleteQuery().toLowerCase().trim();
    const allNotes = workspaceStore.getAllNotePaths();

    const items: AutocompleteItem[] = [];

    for (const notePath of allNotes) {
      const cleanPath = notePath.replace(/\.md$/, "");
      const title = cleanPath.split("/").pop() || cleanPath;

      if (!query || cleanPath.toLowerCase().includes(query) || title.toLowerCase().includes(query)) {
        items.push({
          label: title,
          path: cleanPath,
          insertText: cleanPath,
          type: "note",
        });
      }
    }

    return items.slice(0, 8);
  });

  const checkAutocomplete = () => {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart;
    const textBefore = textareaRef.value.substring(0, pos);
    const currentLine = textBefore.split("\n").pop() || "";
    const lastBracket = currentLine.lastIndexOf("[[");

    if (lastBracket !== -1 && !currentLine.substring(lastBracket).includes("]]")) {
      const query = currentLine.substring(lastBracket + 2);
      setAutocompleteQuery(query);
      setAutocompleteOpen(true);
      setSelectedIndex(0);

      // Compute dynamic position based on cursor line
      const linesBefore = textBefore.split("\n");
      const lineIndex = linesBefore.length - 1;
      const lineHeight = 24; // 24px per line (leading-6)
      const topPx = (lineIndex + 1) * lineHeight - textareaRef.scrollTop + 16; // 16px is p-4
      const editorHeight = textareaRef.clientHeight || 400;

      if (topPx > editorHeight - 240) {
        setDropdownPosition({
          bottom: Math.max(16, editorHeight - topPx + 28),
          left: 16,
        });
      } else {
        setDropdownPosition({
          top: Math.max(16, topPx),
          left: 16,
        });
      }
    } else {
      setAutocompleteOpen(false);
    }
  };

  const insertAutocomplete = (item: AutocompleteItem) => {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart;
    const val = textareaRef.value;
    const textBefore = val.substring(0, pos);
    const currentLine = textBefore.split("\n").pop() || "";
    const lastBracketInLine = currentLine.lastIndexOf("[[");
    if (lastBracketInLine === -1) return;

    const lineStartPos = pos - currentLine.length;
    const replaceStart = lineStartPos + lastBracketInLine; // start of "[["

    // Check if there is a closing "]]" right after cursor
    const textAfter = val.substring(pos);
    const hasClosingBracket = textAfter.startsWith("]]");
    const replaceEnd = hasClosingBracket ? pos + 2 : pos;

    const insertion = `[[${item.insertText}]]`;
    const updated = val.substring(0, replaceStart) + insertion + val.substring(replaceEnd);
    props.onChange(updated);

    const newCursorPos = replaceStart + insertion.length;
    setAutocompleteOpen(false);

    setTimeout(() => {
      if (textareaRef) {
        textareaRef.focus();
        textareaRef.selectionStart = textareaRef.selectionEnd = newCursorPos;
      }
    }, 0);
  };

  const handleScroll = (e: Event) => {
    if (textareaRef && gutterRef) {
      gutterRef.scrollTop = textareaRef.scrollTop;
    }
    if (props.onScroll) {
      props.onScroll(e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
      e.preventDefault();
      checkAutocomplete();
      return;
    }

    if (autocompleteOpen() && autocompleteItems().length > 0) {
      const items = autocompleteItems();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((selectedIndex() + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((selectedIndex() - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = items[selectedIndex()];
        if (selected) {
          insertAutocomplete(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAutocompleteOpen(false);
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (!textareaRef) return;
      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const val = textareaRef.value;
      const updated = val.substring(0, start) + "  " + val.substring(end);
      props.onChange(updated);
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.selectionStart = textareaRef.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart;
    const textBefore = textareaRef.value.substring(0, pos);
    const line = textBefore.split("\n").length;
    const col = pos - textBefore.lastIndexOf("\n");
    tabsStore.updateCursorPosition(line, col);

    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      checkAutocomplete();
    }
  };

  const handleInput = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    props.onChange(e.currentTarget.value);
    checkAutocomplete();
  };

  return (
    <div class="h-full w-full flex bg-[var(--color-bg-secondary)] overflow-hidden font-mono text-xs select-none relative">
      {/* Line Numbers Gutter */}
      <div
        ref={gutterRef}
        class="w-12 shrink-0 py-4 pr-3 text-right bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] text-[var(--color-text-muted)] select-none overflow-hidden"
      >
        <For each={lines()}>
          {(lineNum) => <div class="leading-6">{lineNum}</div>}
        </For>
      </div>

      {/* Code Textarea Area */}
      <div class="flex-1 h-full relative overflow-hidden">
        <textarea
          ref={(el) => {
            textareaRef = el;
            if (props.ref) props.ref(el);
          }}
          value={props.content}
          onInput={handleInput}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={() => {
            handleKeyUp({ key: "" } as any);
            checkAutocomplete();
          }}
          spellcheck={false}
          class="w-full h-full p-4 bg-transparent resize-none focus:outline-hidden text-[var(--color-text-primary)] leading-6 font-mono custom-scrollbar overflow-y-auto whitespace-pre tab-size-2"
          placeholder="Type markdown content here... (type [[ to link notes)"
        />

        {/* Floating Wikilink Autocomplete Dropdown */}
        <Show when={autocompleteOpen() && autocompleteItems().length > 0}>
          <div
            style={{
              position: "absolute",
              left: `${dropdownPosition().left}px`,
              top: dropdownPosition().top !== undefined ? `${dropdownPosition().top}px` : undefined,
              bottom: dropdownPosition().bottom !== undefined ? `${dropdownPosition().bottom}px` : undefined,
            }}
            class="max-w-sm w-80 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-100 text-xs"
          >
            <div class="px-3 py-1.5 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-muted)] select-none font-sans">
              <span class="font-semibold text-indigo-400">Link Note: [[{autocompleteQuery()}]]</span>
              <span>↑↓ navigate • ↵ select • esc</span>
            </div>

            <div class="max-h-52 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              <For each={autocompleteItems()}>
                {(item, idx) => {
                  const isSelected = () => idx() === selectedIndex();
                  return (
                    <div
                      onClick={() => insertAutocomplete(item)}
                      class={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer font-sans transition-colors ${
                        isSelected()
                          ? "bg-indigo-500 text-white font-medium"
                          : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                      }`}
                    >
                      <div class="flex items-center space-x-2 truncate pr-2">
                        <span class={isSelected() ? "text-white" : "text-indigo-400"}>📄</span>
                        <span class="truncate">{item.label}</span>
                      </div>
                      <span
                        class={`text-[10px] truncate max-w-[100px] ${
                          isSelected() ? "text-indigo-100" : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {item.path}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
