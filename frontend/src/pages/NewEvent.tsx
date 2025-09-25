// src/pages/NewEvent.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  serverTimestamp,
  GeoPoint,
  Timestamp,
} from "firebase/firestore";
import { isAdminUser } from "../lib/roles";
import MapPicker from "../components/MapPicker";
import type { LatLngLiteral } from "leaflet";
import {
  CalendarDays,
  MapPin,
  Tag,
  Image,
  Type,
  FileText,
  Save,
  ArrowLeft,
} from "lucide-react";

export default function NewEvent() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Guard: must be authed + admin
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return nav("/login", { replace: true });
      const ok = await isAdminUser(u);
      setIsAdmin(ok);
      setReady(true);
      if (!ok) nav("/app", { replace: true });
    });
    return () => off();
  }, [nav]);

  // Form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [locationName, setLocationName] = useState("");
  const [picked, setPicked] = useState<LatLngLiteral | null>(null); // from MapPicker
  const [start, setStart] = useState<string>(""); // datetime-local
  const [end, setEnd] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (!ready || !isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background text-text">
        Loading…
      </div>
    );
  }

  async function handleCreate() {
    setErr(null);
    setOkMsg(null);

    // Basic validation
    if (!title.trim()) return setErr("Title is required.");
    if (!start) return setErr("Start date/time is required.");
    if (!picked) return setErr("Please choose a location on the map.");

    // Build payload
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    if (endDate && endDate < startDate) {
      return setErr("End time must be after start time.");
    }

    const location = new GeoPoint(picked.lat, picked.lng);

    const user = auth.currentUser!;
    const docData = {
      title: title.trim(),
      desc: desc.trim(),
      locationName: locationName.trim(),
      location, // GeoPoint
      start: Timestamp.fromDate(startDate),
      end: endDate ? Timestamp.fromDate(endDate) : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      bannerUrl: bannerUrl.trim() || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      setSaving(true);
      await addDoc(collection(db, "events"), docData);
      setOkMsg("Event created!");
      nav("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-text">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => nav("/app")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to Events
          </button>
          <div className="inline-flex items-center gap-2 font-semibold">
            <CalendarDays className="size-4 text-brand" />
            New Event
          </div>
          <div />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6 space-y-4">
          {err && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}
          {okMsg && (
            <div className="rounded-xl border border-success/40 bg-success/10 text-success px-3 py-2 text-sm">
              {okMsg}
            </div>
          )}

          {/* Title */}
          <label className="block text-sm font-medium mb-1">Title</label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="e.g., Welcome Back BBQ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Type className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          {/* Description */}
          <label className="block text-sm font-medium mt-3 mb-1">
            Description
          </label>
          <div className="relative">
            <textarea
              className="w-full min-h-28 rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="Tell people what this is about…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <FileText className="absolute right-3 top-3 size-4 text-text-muted" />
          </div>

          {/* Location (map picker) */}
          <label className="block text-sm font-medium mt-3 mb-1">Location</label>
          <MapPicker value={picked} onChange={setPicked} className="mt-1" />

          {/* Location name */}
          <label className="block text-sm font-medium mt-3 mb-1">
            Location name
          </label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="Student Union, Campus Green, etc."
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Start</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                End (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <label className="block text-sm font-medium mt-3 mb-1">
            Tags (comma-separated)
          </label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="social, food, freshmen"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          {/* Banner URL */}
          <label className="block text-sm font-medium mt-3 mb-1">
            Banner URL (optional)
          </label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="https://…"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
            />
            <Image className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={() => nav("/app")}
              className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
              type="button"
            >
              <Save className="size-4" />
              {saving ? "Saving…" : "Create event"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}