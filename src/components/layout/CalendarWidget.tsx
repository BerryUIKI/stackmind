import { Component, createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { getOrCreateDailyNote, listDailyNotes, DailyNoteEntry } from "@/lib/tauri/commands";
import { tabsStore } from "@/store/tabs";

export const CalendarWidget: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [viewDate, setViewDate] = createSignal(new Date());
  const [dailyNotes, setDailyNotes] = createSignal<DailyNoteEntry[]>([]);

  let popoverRef: HTMLDivElement | undefined;

  const refreshNotes = async () => {
    try {
      const notes = await listDailyNotes();
      setDailyNotes(notes);
    } catch (e) {
      console.warn("Failed to load daily notes for calendar:", e);
    }
  };

  onMount(() => {
    refreshNotes();

    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef && !popoverRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen()) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = () => viewDate().getFullYear();
  const month = () => viewDate().getMonth();

  const prevMonth = (e: MouseEvent) => {
    e.stopPropagation();
    const d = new Date(viewDate());
    d.setMonth(d.getMonth() - 1);
    setViewDate(d);
  };

  const nextMonth = (e: MouseEvent) => {
    e.stopPropagation();
    const d = new Date(viewDate());
    d.setMonth(d.getMonth() + 1);
    setViewDate(d);
  };

  const jumpToToday = (e: MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date());
    openDailyForDate(formatDate(new Date()));
  };

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = () => formatDate(new Date());

  const hasTodayNote = () => {
    return dailyNotes().some((n) => n.date === todayStr());
  };

  const daysInMonth = () => {
    const y = year();
    const m = month();
    const firstDayIndex = new Date(y, m, 1).getDay(); // 0 = Sunday, 1 = Monday ...
    const startOffset = (firstDayIndex + 6) % 7; // 0 = Monday
    const totalDays = new Date(y, m + 1, 0).getDate();

    const days: Array<{ dayNum: number | null; dateStr: string }> = [];

    for (let i = 0; i < startOffset; i++) {
      days.push({ dayNum: null, dateStr: "" });
    }

    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({ dayNum: i, dateStr: dStr });
    }

    return days;
  };

  const hasNote = (dateStr: string) => {
    return dailyNotes().some((n) => n.date === dateStr);
  };

  const openDailyForDate = async (dateStr: string) => {
    try {
      const res = await getOrCreateDailyNote(dateStr);
      await refreshNotes();
      tabsStore.openTab(res.relative_path);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to open daily note:", e);
    }
  };

  return (
    <div class="relative" ref={popoverRef}>
      {/* Top-Right Calendar Toggle Icon Button */}
      <button
        onClick={() => {
          const next = !isOpen();
          setIsOpen(next);
          if (next) refreshNotes();
        }}
        class={`p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer relative ${
          isOpen()
            ? "text-indigo-400 bg-[var(--color-bg-tertiary)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        }`}
        title="Daily Notes & Calendar (Cmd+Shift+D)"
        aria-label="Daily Notes & Calendar"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <Show when={hasTodayNote()}>
          <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
        </Show>
      </button>

      {/* Floating Calendar Popover */}
      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-2 w-64 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-xs">
          {/* Header */}
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border)]">
            <span class="font-semibold text-xs text-[var(--color-text-primary)]">
              {monthNames[month()]} {year()}
            </span>

            <div class="flex items-center space-x-1">
              <button
                onClick={jumpToToday}
                class="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-indigo-400 font-medium transition-colors cursor-pointer"
                title="Jump to Today's Note"
              >
                Today
              </button>
              <button
                onClick={prevMonth}
                class="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer font-bold"
                title="Previous Month"
              >
                ‹
              </button>
              <button
                onClick={nextMonth}
                class="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer font-bold"
                title="Next Month"
                aria-label="Next Month"
              >
                ›
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                class="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-rose-400 transition-colors cursor-pointer ml-1 text-xs"
                title="Close Calendar (Esc)"
                aria-label="Close Calendar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--color-text-muted)] mb-1">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>

          {/* Calendar Grid */}
          <div class="grid grid-cols-7 gap-1 text-center">
            <For each={daysInMonth()}>
              {(item) => (
                <div class="h-6 w-full flex items-center justify-center relative">
                  <Show when={item.dayNum !== null}>
                    <button
                      onClick={() => openDailyForDate(item.dateStr)}
                      class={`h-6 w-6 rounded-full flex flex-col items-center justify-center text-[11px] transition-all cursor-pointer relative ${
                        item.dateStr === todayStr()
                          ? "bg-indigo-500 text-white font-bold shadow-xs"
                          : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                      }`}
                    >
                      <span>{item.dayNum}</span>
                      <Show when={hasNote(item.dateStr) && item.dateStr !== todayStr()}>
                        <span class="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-400" />
                      </Show>
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Footer Quick Action */}
          <div class="pt-2.5 mt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
            <span>Quick: <kbd class="font-mono">⌘⇧D</kbd></span>
            <button
              onClick={(e) => jumpToToday(e)}
              class="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              Open Today's Note
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};
