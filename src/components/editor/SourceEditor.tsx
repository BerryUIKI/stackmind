import { Component, For, createMemo } from "solid-js";
import { tabsStore } from "@/store/tabs";

interface Props {
  content: string;
  onChange: (val: string) => void;
  onScroll?: (e: Event) => void;
  ref?: (el: HTMLTextAreaElement) => void;
}

export const SourceEditor: Component<Props> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  let gutterRef: HTMLDivElement | undefined;

  const lines = createMemo(() => {
    const count = props.content.split("\n").length;
    return Array.from({ length: Math.max(1, count) }, (_, i) => i + 1);
  });

  const handleScroll = (e: Event) => {
    if (textareaRef && gutterRef) {
      gutterRef.scrollTop = textareaRef.scrollTop;
    }
    if (props.onScroll) {
      props.onScroll(e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
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

  const handleKeyUp = () => {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart;
    const textBefore = textareaRef.value.substring(0, pos);
    const line = textBefore.split("\n").length;
    const col = pos - textBefore.lastIndexOf("\n");
    tabsStore.updateCursorPosition(line, col);
  };

  return (
    <div class="h-full w-full flex bg-[var(--color-bg-secondary)] overflow-hidden font-mono text-xs select-none">
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
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleKeyUp}
          spellcheck={false}
          class="w-full h-full p-4 bg-transparent resize-none focus:outline-hidden text-[var(--color-text-primary)] leading-6 font-mono custom-scrollbar overflow-y-auto whitespace-pre tab-size-2"
          placeholder="Type markdown content here..."
        />
      </div>
    </div>
  );
};
