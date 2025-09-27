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
  MapPin,
  Clock,
  Users,
  Plus,
  UserStar,
  UserMinus,
} from "lucide-react";
import { isAdminUser } from "../lib/roles";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L, { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser, IdTokenResult } from "firebase/auth";
import type { DocumentData } from "firebase/firestore";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";

type EventItem = {
  id: string;
  title: string;
  start: string;
  end?: string;
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string;
  locationLatLng?: { lat: number; lng: number }; // <-- add this
};

export default function AppPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    isAdminUser(user).then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [user]);

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
  const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>("");     // YYYY-MM-DD

  // Events from Firestore
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  //Friend panel state
  const [showSocial, setShowSocial] = useState(false);
  const [socialTab, setSocialTab] = useState<"friends" | "requests" | "search">("friends");

  // Live lists
  type FriendEdge = { uid: string; since?: any; name?: string; photoURL?: string };
  type RequestRow = { fromUid: string; createdAt?: any };

  const [friends, setFriends] = useState<FriendEdge[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialErr, setSocialErr] = useState<string | null>(null);

    // --- Search tab state ---
  const [searchQ, setSearchQ] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{uid:string; name?:string; photoURL?:string}>>([]);

  // success toast + set of “already sent” uids for this session
  const [socialOk, setSocialOk] = useState<string | null>(null);
  const [sentReqs, setSentReqs] = useState<Set<string>>(new Set());

  function showOk(msg: string) {
    setSocialOk(msg);
    setTimeout(() => setSocialOk(null), 1600);
  }


  // quick lookup to disable "Add" when already friend/pending
  const friendSet   = useMemo(() => new Set(friends.map(f => f.uid)), [friends]);
  const pendingSet = useMemo(() => {
    // requests are incoming (fromUid), sentReqs are what YOU just sent
    return new Set<string>([
      ...requests.map(r => r.fromUid),
      ...Array.from(sentReqs),
    ]);
  }, [requests, sentReqs]);


  async function runSearch(q: string) {
    setSearchQ(q);
    setSearchErr(null);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const token = await user!.getIdToken();
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e:any) {
      setSearchErr(e.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  // Cache basic user docs to show names/photos
  const [userCache, setUserCache] = useState<Record<string, {name?: string; photoURL?: string}>>({});

  async function acceptRequest(fromUid: string) {
    try {
      setSocialErr(null);
      const token = await user!.getIdToken();
      const res = await fetch("/api/friends/requests/" + encodeURIComponent(fromUid) + "/accept", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e:any) {
      setSocialErr(e.message || "Failed to accept request");
    }
  }

  async function declineRequest(fromUid: string) {
    try {
      setSocialErr(null);
      const token = await user!.getIdToken();
      const res = await fetch("/api/friends/requests/" + encodeURIComponent(fromUid) + "/decline", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e:any) {
      setSocialErr(e.message || "Failed to decline request");
    }
  }

  async function unfriend(friendUid: string) {
    try {
      setSocialErr(null);
      const token = await user!.getIdToken();
      const res = await fetch("/api/friends/" + encodeURIComponent(friendUid), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      // No manual state update necessary: your onSnapshot(friends) listener will refresh the list
    } catch (e: any) {
      setSocialErr(e.message || "Failed to remove friend");
    }
  }

  async function sendFriendRequest(toUid: string) {
    try {
      setSocialErr(null);
      const token = await user!.getIdToken();
      const res = await fetch("/api/friends/requests/" + encodeURIComponent(toUid), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());

      // Optimistic UI: remember we sent this one
      setSentReqs((prev) => {
        const next = new Set(prev);
        next.add(toUid);
        return next;
      });
      showOk("Friend request sent");
    } catch (e: any) {
      setSocialErr(e.message || "Failed to send request");
    }
  }

  useEffect(() => {
    if (!user) return;
    setSocialLoading(true);
    setSocialErr(null);

    // Friends watcher
    const offFriends = onSnapshot(
      collection(db, "users", user.uid, "friends"),
      async (snap) => {
        const rows: FriendEdge[] = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
        setFriends(rows);
        // fetch basics for any unknown uids
        const need = rows.map(r => r.uid).filter(uid => !userCache[uid]);
        if (need.length) {
          const entries = await Promise.all(need.map(async uid => {
            const u = await getDoc(doc(db, "users", uid));
            const data = u.data() || {};
            return [uid, { name: data.name || data.email?.split("@")[0], photoURL: data.photoURL || "" }] as const;
          }));
          setUserCache(prev => {
            const next = { ...prev };
            for (const [k,v] of entries) next[k] = v;
            return next;
          });
        }
        setSocialLoading(false);
      },
      (e) => { setSocialErr(e.message || "Failed to load friends"); setSocialLoading(false); }
    );

    // Requests watcher (incoming inbox)
    const offReqs = onSnapshot(
      query(collection(db, "users", user.uid, "friendRequests"), orderBy("createdAt", "desc")),
      async (snap) => {
        const rows: RequestRow[] = snap.docs.map(d => ({ fromUid: d.id, ...(d.data() as any) }));
        setRequests(rows);
        const need = rows.map(r => r.fromUid).filter(uid => !userCache[uid]);
        if (need.length) {
          const entries = await Promise.all(need.map(async uid => {
            const u = await getDoc(doc(db, "users", uid));
            const data = u.data() || {};
            return [uid, { name: data.name || data.email?.split("@")[0], photoURL: data.photoURL || "" }] as const;
          }));
          setUserCache(prev => {
            const next = { ...prev };
            for (const [k,v] of entries) next[k] = v;
            return next;
          });
        }
      },
      (e) => { setSocialErr(e.message || "Failed to load requests"); }
    );

    return () => { offFriends(); offReqs(); };
  }, [user]);

  // Listen to Firestore whenever date filters change
  useEffect(() => {
    setLoadingEvents(true);
    setErr(null);

    const col = collection(db, "events");
    const clauses: any[] = [];

    if (dateFrom) clauses.push(where("start", ">=", Timestamp.fromDate(new Date(dateFrom))));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      clauses.push(where("start", "<", Timestamp.fromDate(to)));
    }

    const qy = query(col, ...clauses, orderBy("start", "asc"));

    const off = onSnapshot(
      qy,
      (snap) => {
        const rows: EventItem[] = snap.docs.map((d) => mapEventDoc(d.id, d.data()));
        setEvents(rows);
        setLoadingEvents(false);
      },
      (e) => {
        setErr(e?.message ?? "Failed to load events");
        setLoadingEvents(false);
      }
    );

    return () => off();
  }, [dateFrom, dateTo]);

  // Build tag list from loaded events
  const ALL_TAGS = useMemo(
    () => Array.from(new Set(events.flatMap((e) => e.tags))).sort(),
    [events]
  );

  // Client-side search + tag filter
  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        const qi = q.trim().toLowerCase();
        const hitQ =
          !qi ||
          e.title.toLowerCase().includes(qi) ||
          e.location.toLowerCase().includes(qi) ||
          e.tags.some((t) => t.toLowerCase().includes(qi));

        const hitTags =
          selectedTags.length === 0 ||
          selectedTags.every((t) => e.tags.includes(t)); // AND logic

        const t = new Date(e.start).getTime();
        const fromOk = !dateFrom || t >= new Date(dateFrom).getTime();
        const toOk =
          !dateTo ||
          t < new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000).getTime();

        return hitQ && hitTags && fromOk && toOk;
      })
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  }, [events, q, selectedTags, dateFrom, dateTo]);

  // Details modal state
  const [openId, setOpenId] = useState<string | null>(null);

  async function doLogout() {
    await signOut(auth);
    nav("/login", { replace: true });
  }

  if (!user) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background text-text">
        Loading…
      </div>
    );
  }

  const openEvent = (id: string) => setOpenId(id);
  const closeEvent = () => setOpenId(null);

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
              onClick={() => { setSocialTab("friends"); setShowSocial(true); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
              title="Friends & Requests"
            >
              <Users className="size-4" />
              <span className="hidden sm:inline">Friends</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => nav("/events/new")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
                title="Create event"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">New event</span>
              </button>
            )}
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

        {err && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
            {err}
          </div>
        )}

        {/* Feed */}
        <section className="space-y-3">
          {loadingEvents ? (
            <div className="bg-surface border border-border rounded-2xl p-8 grid place-items-center text-center">
              Loading events…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((e) => (
                <EventCard key={e.id} item={e} onOpen={() => openEvent(e.id)} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Details modal */}
      {openId && (
        <EventDetailsModal
          eventId={openId}
          onClose={closeEvent}
          currentUser={user}
          friends={friends}
          userCache={userCache} 
        />
      )}

      {/* Friends & Requests Panel (drawer) */}
      {showSocial && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Friends and Requests"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSocial(false)}
          />
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-md bg-surface border-l border-border shadow-soft flex flex-col">
            {/* Header w/ Tabs */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Social</h2>
                <button
                  onClick={() => setShowSocial(false)}
                  className="text-sm px-2 py-1 rounded-md hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setSocialTab("friends")}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    socialTab === "friends"
                      ? "bg-brand text-background hover:bg-brand-600"
                      : "bg-surface border-border hover:bg-muted"
                  }`}
                  aria-selected={socialTab === "friends"}
                  role="tab"
                >
                  Friends
                </button>
                <button
                  onClick={() => setSocialTab("requests")}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    socialTab === "requests"
                      ? "bg-brand text-background hover:bg-brand-600"
                      : "bg-surface border-border hover:bg-muted"
                  }`}
                  aria-selected={socialTab === "requests"}
                  role="tab"
                >
                  Requests
                </button>
                <button
                  onClick={() => setSocialTab("search")}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    socialTab === "search"
                      ? "bg-brand text-background hover:bg-brand-600"
                      : "bg-surface border-border hover:bg-muted"
                  }`}
                  aria-selected={socialTab === "search"}
                  role="tab"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {socialOk && (
                <div className="mb-3 rounded-xl border border-success/40 bg-success/10 text-success px-3 py-2 text-sm">
                  {socialOk}
                </div>
              )}
              {socialErr && (
                <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
                  {socialErr}
                </div>
              )}

              {socialTab === "friends" ? (
                friends.length === 0 ? (
                  <p className="text-sm text-text-muted">No friends yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {friends.map(f => {
                      const meta = userCache[f.uid] || {};
                      return (
                        <li
                          key={f.uid}
                          className="group relative flex items-center gap-3 p-2 rounded-xl border border-border"
                        >
                          {meta.photoURL ? (
                            <img src={meta.photoURL} alt={meta.name} className="size-8 rounded-lg object-cover" />
                          ) : (
                            <div className="size-8 rounded-lg bg-muted grid place-items-center text-xs">
                              {(meta.name || "U").slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate cursor-pointer hover:underline" onClick={() => nav(`/u/${f.uid}`)}>
                              <div className="font-medium truncate">{meta.name || f.uid}</div>
                            </div>
                            <div className="text-xs text-text-muted">Friend</div>
                          </div>

                          {/* Unfriend on hover */}
                          <button
                            onClick={() => unfriend(f.uid)}
                            title="Unfriend"
                            aria-label={`Unfriend ${meta.name || f.uid}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-muted text-xs"
                          >
                            <UserMinus className="size-4" />
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : socialTab == 'requests' ? (
                requests.length === 0 ? (
                  <p className="text-sm text-text-muted">No pending requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {requests.map(r => {
                      const meta = userCache[r.fromUid] || {};
                      return (
                        <li key={r.fromUid} className="flex items-center gap-3 p-2 rounded-xl border border-border">
                          {meta.photoURL ? (
                            <img src={meta.photoURL} alt={meta.name} className="size-8 rounded-lg object-cover" />
                          ) : (
                            <div className="size-8 rounded-lg bg-muted grid place-items-center text-xs">
                              {(meta.name || "U").slice(0,1).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate cursor-pointer hover:underline" onClick={() => nav(`/u/${f.uid}`)}>
                              <div className="font-medium truncate">{meta.name || r.fromUid}</div>
                            </div>
                            <div className="text-xs text-text-muted">sent you a request</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => acceptRequest(r.fromUid)}
                              className="text-sm px-2 py-1 rounded-lg bg-brand text-background hover:bg-brand-600"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => declineRequest(r.fromUid)}
                              className="text-sm px-2 py-1 rounded-lg border border-border hover:bg-muted"
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : socialTab == 'search' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        className="w-full rounded-xl border border-border bg-surface pl-3 pr-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                        placeholder="Search by name or email (min 2 chars)…"
                        value={searchQ}
                        onChange={(e) => runSearch(e.target.value)}
                      />
                    </div>

                    {searchErr && (
                      <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
                        {searchErr}
                      </div>
                    )}

                    {searchLoading ? (
                      <p className="text-sm text-text-muted">Searching…</p>
                    ) : searchQ.length >= 2 && searchResults.length === 0 ? (
                      <p className="text-sm text-text-muted">No users found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {searchResults.map(u => {
                          const isFriend  = friendSet.has(u.uid);
                          const isPending = pendingSet.has(u.uid);
                          const disabled  = isFriend || isPending || u.uid === user!.uid;

                          return (
                            <li key={u.uid} className="flex items-center gap-3 p-2 rounded-xl border border-border">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.name} className="size-8 rounded-lg object-cover" />
                              ) : (
                                <div className="size-8 rounded-lg bg-muted grid place-items-center text-xs">
                                  {(u.name || "U").slice(0,1).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate cursor-pointer hover:underline" onClick={() => nav(`/u/${u.uid}`)}>
                                  <div className="font-medium truncate">{u.name || u.uid}</div>
                                </div>
                              </div>
                              <button
                                disabled={disabled}
                                onClick={() => sendFriendRequest(u.uid)}
                                className={`text-sm px-2 py-1 rounded-lg border ${
                                  disabled ? "opacity-60 cursor-not-allowed" : "border-border hover:bg-muted"
                                }`}
                                title={
                                  isFriend ? "Already friends"
                                  : isPending ? "Request pending"
                                  : "Send friend request"
                                }
                              >
                                {isFriend ? "Friends" : isPending ? "Pending" : "Add"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Firestore mapping ---------------- */

function mapEventDoc(id: string, data: DocumentData): EventItem {
  const startISO = tsToISO(data.start);
  const endISO = data.end ? tsToISO(data.end) : undefined;

  return {
    id,
    title: data.title ?? "",
    start: startISO,
    end: endISO,
    location: data.locationName ?? data.location ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    bannerUrl: data.bannerUrl ?? undefined,
    desc: data.desc ?? "",
    // NEW: coords from Firestore GeoPoint `location`
    locationLatLng: data.location && data.location.latitude != null
      ? { lat: data.location.latitude, lng: data.location.longitude }
      : undefined,
  };
}
function tsToISO(ts: any): string {
  if (ts?.toDate) return ts.toDate().toISOString();
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toISOString();
}

/* ---------------- Filters UI ---------------- */

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
            <div className="relative" role="listbox" aria-label="Categories">
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

/* ---------------- Event Card ---------------- */

function EventCard({ item, onOpen }: { item: EventItem; onOpen: () => void }) {
  const date = new Date(item.start);
  const nice = date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article className="bg-surface border border-border rounded-2xl shadow-soft overflow-hidden">
      <div className="h-28 bg-brand/10 border-b border-border">
        {item.bannerUrl && (
          <img src={item.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold line-clamp-2">{item.title}</h3>
        <p className="mt-1 text-sm text-text-muted">
          {nice} · {item.location}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Details Modal + RSVP ---------------- */

function EventDetailsModal({
  eventId,
  onClose,
  currentUser,
  friends,
  userCache,
}: {
  eventId: string;
  onClose: () => void;
  currentUser: FirebaseUser;
  friends: { uid: string }[];
  userCache: Record<string, { name?: string }>; 
}) {
  const [data, setData] = useState<EventItem | null>(null);
  const [rsvpCount, setRsvpCount] = useState<number>(0);
  const [attending, setAttending] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [friendsAttending, setFriendsAttending] = useState<string[]>([]);

  // Load full doc once (to get desc/bannerUrl/etc)
  useEffect(() => {
    (async () => {
      try {
        const dref = doc(db, "events", eventId);
        const snap = await getDoc(dref);
        if (snap.exists()) setData(mapEventDoc(snap.id, snap.data()));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load event");
      }
    })();
  }, [eventId]);

  // Load RSVP count
  useEffect(() => {
    (async () => {
      try {
        const c = await getCountFromServer(collection(db, "events", eventId, "rsvps"));
        setRsvpCount(c.data().count);
      } catch (e) {
        // ignore count errors
      }
    })();
  }, [eventId]);

  // Check my RSVP doc (existence == attending)
  useEffect(() => {
    const myRef = doc(db, "events", eventId, "rsvps", currentUser.uid);
    // one-time read is fine here (could also onSnapshot if you want live)
    (async () => {
      try {
        const snap = await getDoc(myRef);
        setAttending(snap.exists());
      } catch {}
    })();
  }, [eventId, currentUser.uid]);

  useEffect(() => {
    // live RSVPs for this event
    const r = onSnapshot(
      collection(db, "events", eventId, "rsvps"),
      (snap) => {
        const rsvpUids = new Set(snap.docs.map(d => d.id));
        // intersect with my friends
        const names = friends
          .map(f => f.uid)
          .filter(uid => rsvpUids.has(uid))
          .map(uid => userCache[uid]?.name || uid);

        setFriendsAttending(names);
      },
      () => setFriendsAttending([])
    );
    return () => r();
  }, [eventId, friends, userCache]);

  async function handleAttend() {
    setSaving(true);
    setErr(null);
    try {
      const myRef = doc(db, "events", eventId, "rsvps", currentUser.uid);
      await setDoc(myRef, { uid: currentUser.uid, attending: true, createdAt: serverTimestamp() }, { merge: true });
      setAttending(true);
      setRsvpCount((c) => c + 1);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to RSVP");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setSaving(true);
    setErr(null);
    try {
      const myRef = doc(db, "events", eventId, "rsvps", currentUser.uid);
      await deleteDoc(myRef);
      setAttending(false);
      setRsvpCount((c) => Math.max(0, c - 1));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to cancel");
    } finally {
      setSaving(false);
    }
  }

  const niceDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  const umassIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41], // size of the icon
    iconAnchor: [12, 41], // point of the icon which corresponds to marker's location
    popupAnchor: [1, -34], // point from which the popup should open relative to the iconAnchor
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = umassIcon;

  function MiniMap({ lat, lng }: { lat: number; lng: number }) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="h-96">
          <MapContainer
            center={{ lat, lng }}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            preferCanvas
            attributionControl={false}
          >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
            <Marker position={{ lat, lng }} />
          </MapContainer>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* panel */}
      <div className="relative z-50 w-full sm:max-w-4xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-soft p-4 sm:p-6">
        {data ? (
          <>
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center size-10 rounded-xl bg-brand/10 border border-brand/20">
                <CalendarDays className="size-5 text-brand" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{data.title}</h3>
                <div className="mt-1 text-sm text-text-muted flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-4" />
                    {niceDate(data.start)}
                    {data.end ? ` – ${niceDate(data.end)}` : ""}
                  </span>
                  {data.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" />
                      {data.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-4" />
                    {rsvpCount}
                  </span>
                  {friendsAttending.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <UserStar className="size-4" />
                      <span className="truncate">
                        {friendsAttending.slice(0, 3).join(", ")}
                        {friendsAttending.length > 3 && ` and ${friendsAttending.length - 3} others`}{" "}
                        {friendsAttending.length === 1 ? "is" : "are"} attending
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>


            {data.locationLatLng && (
              <MiniMap lat={data.locationLatLng.lat} lng={data.locationLatLng.lng} />
            )}

            {/* Body */}
            {data.desc && (
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">
                {data.desc}
              </p>
            )}

            {/* Tags */}
            {data.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Error */}
            {err && (
              <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
                {err}
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
              >
                Close
              </button>
              {attending ? (
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-muted disabled:opacity-70"
                >
                  {saving ? "Cancelling…" : "Cancel attendance"}
                </button>
              ) : (
                <button
                  onClick={handleAttend}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
                >
                  {saving ? "Saving…" : "Attend"}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="p-6">Loading…</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Empty State ---------------- */

function EmptyState() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-8 grid place-items-center text-center">
      <CalendarDays className="size-8 text-brand" />
      <p className="mt-3 text-text-muted">
        No events match your filters. Try clearing them.
      </p>
    </div>
  );
}