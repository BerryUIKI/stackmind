import { Component, createSignal, onMount, For, Show } from "solid-js";
import { getOrCreateDailyNote, listDailyNotes, DailyNoteEntry } from "@/lib/tauri/commands";
import { tabsStore } from "@/store/tabs";

export const CalendarWidget: Component = () => {
  const [collapsed, setCollapsed] = createSignal(false);
  const [viewDate, setViewDate] = createSignal(new Date());
  const [dailyNotes, setDailyNotes] = createSignal<DailyNoteEntry[]>([]);

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
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = () => viewDate().getFullYear();
  const month = () => viewDate().getMonth();

  const prevMonth = () => {
    const d = new Date(viewDate());
    d.setMonth(d.getMonth() - 1);
    setViewDate(d);
  };

  const nextMonth = () => {
    const d = new Date(viewDate());
    d.setMonth(d.getMonth() + 1);
    setViewDate(d);
  };

  const jumpToToday = () => {
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

  const daysInMonth = () => {
    const y = year();
    const m = month();
    const firstDayIndex = new Date(y, m, 1).getDay(); // 0 = Sunday, 1 = Monday ...
    // Adjust so 0 = Monday, 6 = Sunday
    const startOffset = (firstDayIndex + 6) % 7;
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
    } catch (e) {
      console.error("Failed to open daily note:", e);
    }
  };

  return (
    <div class="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] select-none">
      {/* Header Bar */}
      <div class="flex items-center justify-between px-3 py-2 text-xs text-[var(--color-text-secondary)] font-medium">
        <button
          onClick={() => setCollapsed(!collapsed())}
          class="flex items-center space-x-1.5 hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <span class="text-[10px] transform transition-transform duration-150" classList={{ "rotate-90": !collapsed() }}>
            ▶
          </span>
          <span class="font-semibold text-xs text-[var(--color-text-primary)]">
            {monthNames[month()]} {year()}
          </span>
        </button>

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
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            title="Previous Month"
          >
            ‹
          </button>
          <button
            onClick={nextMonth}
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            title="Next Month"
          >
            ›
          </button>
        </div>
      </div>

      {/* Collapsible Month Grid */}
      <Show when={!collapsed()}>
        <div class="px-3 pb-2.5 pt-0.5">
          {/* Day of week headers */}
          <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--color-text-muted)] mb-1">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>

          {/* Calendar Day Grid */}
          <div class="grid grid-cols-7 gap-1 text-center text-xs">
            <For each={daysInMonth()}>
              {(item) => (
                <div class="h-6 w-full flex items-center justify-center relative">
                  <Show when={item.dayNum !== null}>
                    <button
                      onClick={() => openDailyForDate(item.dateStr)}
                      class={`h-6 w-6 rounded-full flex flex-col items-center justify-center text-[11px] transition-all cursor-pointer relative ${
                        item.dateStr === todayStr()
                          ? "bg-indigo-500 text-white font-bold shadow-sm"
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
        </div>
      </Show>
    </div>
  );
};
