// src/pages/Calendar.tsx
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

/** Keep in sync with pages/App.tsx */
export type EventItem = {
  id: string;
  title: string;
  start: string;          // ISO
  end?: string;
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string;
  locationLatLng?: { lat: number; lng: number };
};

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onDateSelect: (date: Date) => void;
  events: EventItem[];
  onEventClick?: (id: string) => void;
}

export default function Calendar({
  currentDate,
  setCurrentDate,
  onDateSelect,
  events,
  onEventClick,
}: CalendarProps) {
  const navigate = useNavigate();

  // ---- helpers ----
  const getDaysInMonth = (date: Date): (number | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const goPrevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const goNextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const goToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: number | null) => {
    if (!day) return;
    const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onDateSelect(selected);
  };

  const close = () => navigate("/app");

  const isToday = (y: number, m: number, d: number) => {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  };

  // Keyboard shortcuts: Esc = back, ←/→ = prev/next month
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") goPrevMonth();
      else if (e.key === "ArrowRight") goNextMonth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // --- Build per-day buckets + tag palette ---
  const days = getDaysInMonth(currentDate);

  const { byDay, tagColors, orderedTags } = useMemo(() => {
    // stable tailwind color pool (explicit so purge keeps classes)
    const palette = [
      "bg-rose-500",
      "bg-amber-500",
      "bg-emerald-500",
      "bg-sky-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-lime-500",
      "bg-fuchsia-500",
      "bg-cyan-500",
    ];
    const tagSet: string[] = [];
    const tagColors = new Map<string, string>();

    // simple deterministic assignment by tag name
    const colorForTag = (tag: string) => {
      if (!tagColors.has(tag)) {
        const idx = Math.abs(hash(tag)) % palette.length;
        tagColors.set(tag, palette[idx]);
        if (!tagSet.includes(tag)) tagSet.push(tag);
      }
      return tagColors.get(tag)!;
    };

    // group events by day number for current month/view
    const byDay: Record<number, (EventItem & { _color: string })[]> = {};
    for (const ev of events) {
      const d = new Date(ev.start);
      if (
        d.getFullYear() === currentDate.getFullYear() &&
        d.getMonth() === currentDate.getMonth()
      ) {
        const day = d.getDate();
        const color = colorForTag(ev.tags?.[0] || "event");
        (byDay[day] ||= []).push({ ...ev, _color: color });
      }
    }

    // lightweight sort by time within a day
    for (const k of Object.keys(byDay)) {
      byDay[+k].sort(
        (a, b) => +new Date(a.start) - +new Date(b.start)
      );
    }

    return { byDay, tagColors, orderedTags: tagSet };
  }, [events, currentDate]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={close}
      aria-label="Close calendar"
    >
      {/* modal shell (larger) */}
      <div
        className="w-full max-w-5xl rounded-2xl border border-border bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-title"
      >
        {/* top bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
            onClick={close}
            aria-label="Back"
          >
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface p-2 hover:bg-muted"
              onClick={goPrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-5" />
            </button>

            <h2 id="cal-title" className="text-lg sm:text-xl font-semibold">
              {currentDate.toLocaleString("default", { month: "long" })} {currentDate.getFullYear()}
            </h2>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface p-2 hover:bg-muted"
              onClick={goNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="size-5" />
            </button>

            <button
              type="button"
              className="ml-2 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
              onClick={goToday}
              aria-label="Jump to today"
            >
              <CalendarDays className="size-4" />
              Today
            </button>
          </div>

          <div className="w-[112px] sm:w-[140px]" aria-hidden />
        </div>

        {/* grid */}
        <div className="px-5 pb-6 pt-4">
          {/* weekday headers (larger spacing) */}
          <div className="grid grid-cols-7 gap-3 text-sm text-text-muted mb-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center select-none">{d}</div>
            ))}
          </div>

          {/* days (larger cells) */}
          <div className="grid grid-cols-7 gap-3">
            {days.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={idx}
                    className="h-24 sm:h-28 rounded-xl border border-transparent"
                    aria-hidden="true"
                  />
                );
              }

              const y = currentDate.getFullYear();
              const m = currentDate.getMonth();
              const today = isToday(y, m, day);
              const list = byDay[day] || [];

              return (
                <div key={idx} className="relative">
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleDayClick(day)}
                    aria-label={`Select ${day}`}
                    className={[
                      "group relative flex h-24 sm:h-28 w-full flex-col rounded-2xl border p-3 text-left outline-none transition",
                      "focus:ring-2 focus:ring-brand focus:border-brand",
                      today
                        ? "border-brand/40 bg-brand/5"
                        : "border-border bg-surface hover:bg-muted"
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-base sm:text-lg font-medium">{day}</span>
                      {today && (
                        <span className="inline-flex items-center rounded-md bg-brand px-2 py-0.5 text-[10px] font-semibold text-background">
                          Today
                        </span>
                      )}
                    </div>

                    {/* dot row */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {list.slice(0, 8).map((ev) => (
                        <span
                          key={ev.id}
                          className={`inline-block h-2.5 w-2.5 rounded-full ${ev._color}`}
                          title={ev.title}
                        />
                      ))}
                      {list.length > 8 && (
                        <span className="text-[10px] text-text-muted">+{list.length - 8}</span>
                      )}
                    </div>

                    {/* hover/focus panel */}
                    {list.length > 0 && (
                      <div
                        className="absolute left-0 top-[calc(100%+8px)] hidden w-80 rounded-xl border border-border bg-surface p-3 shadow-lg group-hover:block group-focus-within:block z-30"
                      >
                        <p className="mb-2 text-xs text-text-muted">
                          {new Date(y, m, day).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                          {list.map((ev) => (
                            <li
                              key={ev.id}
                              className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(ev.id);
                              }}
                            >
                              <span className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${ev._color}`} />
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{ev.title}</div>
                                <div className="text-xs text-text-muted truncate">
                                  {timeRange(ev.start, ev.end)}
                                  {ev.location ? ` · ${ev.location}` : ""}
                                </div>
                                {ev.desc && (
                                  <div className="mt-0.5 text-xs line-clamp-2 text-text-muted">
                                    {ev.desc}
                                  </div>
                                )}
                                {/* tag chips */}
                                {ev.tags?.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {ev.tags.slice(0, 3).map((t, i) => (
                                      <span
                                        key={t + i}
                                        className="text-[10px] px-1.5 py-0.5 rounded-md border border-border"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                    {ev.tags.length > 3 && (
                                      <span className="text-[10px] text-text-muted">
                                        +{ev.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* legend / helper */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-text-muted">
            <div className="inline-flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-brand" />
                <span>Today</span>
              </div>
              {/* Tag legend */}
              {orderedTags.slice(0, 10).map((t) => (
                <span key={t} className="inline-flex items-center gap-2 mr-2">
                  <span className={`inline-block h-3 w-3 rounded ${tagColors.get(t)}`} />
                  <span className="capitalize">{t}</span>
                </span>
              ))}
              {orderedTags.length > 10 && (
                <span>+{orderedTags.length - 10} more</span>
              )}
            </div>
            <p className="text-right">Esc to close • ← / → to switch months • Click a day to select</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- utils ---------- */

function timeRange(startISO?: string, endISO?: string) {
  if (!startISO) return "";
  const s = new Date(startISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!endISO) return s;
  const e = new Date(endISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${s}–${e}`;
}

// simple string hash (stable palette indexing)
function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}