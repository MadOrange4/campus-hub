// src/pages/App.tsx
// Auth-only app shell with a feed and custom multi-select filters.
// Uses semantic theme tokens and no extra deps.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Filter,
  LogOut,
  User,
  ChevronDown,
  Check,
  X,
  Search,
  CalendarRange,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth"

type EventItem = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string;  // ISO
  location: string;
  tags: string[];
  bannerUrl?: string;
};

const MOCK_EVENTS: EventItem[] = [
  { id: "1", title: "Welcome Back BBQ", start: new Date().toISOString(), location: "Campus Green", tags: ["social", "food", "freshmen"] },
  { id: "2", title: "Women in CS Meetup", start: new Date(Date.now() + 86_400_000).toISOString(), location: "CS Building 101", tags: ["tech", "networking"] },
  { id: "3", title: "Intramural Basketball Finals", start: new Date(Date.now() + 2 * 86_400_000).toISOString(), location: "Rec Center", tags: ["sports", "campus-life"] },
  { id: "4", title: "Career Fair", start: new Date(Date.now() + 3 * 86_400_000).toISOString(), location: "Campus Center", tags: ["career", "networking"] },
];

const ALL_TAGS = Array.from(new Set(MOCK_EVENTS.flatMap((e) => e.tags))).sort();

export default function AppPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);

  // Guard route
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) nav("/login", { replace: true });
    });
    return () => off();
  }, [nav]);

  // Filters
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filtered = useMemo(() => {
    return MOCK_EVENTS.filter((e) => {
      const qi = q.trim().toLowerCase();
      const hitQ =
        !qi ||
        e.title.toLowerCase().includes(qi) ||
        e.location.toLowerCase().includes(qi) ||
        e.tags.some((t) => t.toLowerCase().includes(qi));

      const hitTags =
        selectedTags.length === 0 ||
        selectedTags.every((t) => e.tags.includes(t)); // AND logic; switch to some() for OR

      const t = new Date(e.start).getTime();
      const fromOk = !dateFrom || t >= new Date(dateFrom).getTime();
      const toOk = !dateTo || t <= new Date(dateTo).getTime();

      return hitQ && hitTags && fromOk && toOk;
    }).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  }, [q, selectedTags, dateFrom, dateTo]);

  async function doLogout() {
    await signOut(auth);
    nav("/login", { replace: true });
  }

  if (!user) {
    return <div className="min-h-dvh grid place-items-center bg-background text-text">Loading…</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-text">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center size-8 rounded-xl bg-brand/10 border border-brand/20">
              <CalendarDays className="size-4 text-brand" />
            </div>
            <span className="font-semibold">Campus Hub</span>
            <span className="text-text-muted text-sm hidden sm:inline">· Events</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/profile")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
              title="Profile"
            >
              <User className="size-4" />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={doLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
              title="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Filters
          q={q}
          setQ={setQ}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          allTags={ALL_TAGS}
          clearAll={() => {
            setQ(""); setSelectedTags([]); setDateFrom(""); setDateTo("");
          }}
        />

        {/* Feed */}
        <section className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((e) => (
                <EventCard key={e.id} item={e} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Filters(props: {
  q: string;
  setQ: (v: string) => void;
  selectedTags: string[];
  setSelectedTags: (v: string[]) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  allTags: string[];
  clearAll: () => void;
}) {
  const {
    q, setQ,
    selectedTags, setSelectedTags,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    allTags, clearAll
  } = props;

  // Custom dropdown (popover)
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <section className="bg-surface border border-border rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="size-4 text-text-muted" />
        <h2 className="font-semibold">Filter events</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="Search title, location, tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>
        </div>

        {/* Dates */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>
        </div>

        {/* Categories (custom multi-select) */}
        <div className="lg:col-span-2" ref={popRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="text-left truncate">
              {selectedTags.length === 0 ? "All categories" : `${selectedTags.length} selected`}
            </span>
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div
              className="relative"
              role="listbox"
              aria-label="Categories"
            >
              <div className="absolute z-30 mt-2 w-full bg-surface border border-border rounded-2xl shadow-soft p-2">
                <div className="max-h-64 overflow-auto pr-1">
                  {allTags.map((t) => {
                    const active = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between hover:bg-muted ${
                          active ? "bg-brand/10 border border-brand/20" : ""
                        }`}
                        aria-selected={active}
                      >
                        <span className="capitalize">{t}</span>
                        {active && <Check className="size-4 text-brand" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTags([])}
                    className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted text-sm"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected chips */}
      {selectedTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedTags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                className="p-0.5 rounded hover:bg-brand/15"
                onClick={() => setSelectedTags(selectedTags.filter((x) => x !== t))}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-sm px-2 py-1 rounded-lg border border-border bg-surface hover:bg-muted"
            title="Clear all filters"
          >
            Reset
          </button>
        </div>
      )}
    </section>
  );
}

function EventCard({ item }: { item: EventItem }) {
  const date = new Date(item.start);
  const nice = date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <article className="bg-surface border border-border rounded-2xl shadow-soft overflow-hidden">
      {/* banner (placeholder) */}
      <div className="h-28 bg-brand/10 border-b border-border">
        {item.bannerUrl && <img src={item.bannerUrl} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="p-4">
        <h3 className="font-semibold line-clamp-2">{item.title}</h3>
        <p className="mt-1 text-sm text-text-muted">{nice} · {item.location}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span key={t} className="text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted">
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-8 grid place-items-center text-center">
      <CalendarDays className="size-8 text-brand" />
      <p className="mt-3 text-text-muted">No events match your filters. Try clearing them.</p>
    </div>
  );
}
