import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, collectionGroup, query, where, orderBy, documentId } from "firebase/firestore";
import {
  ArrowLeft,
  ShieldCheck,
  UserMinus,
  UserPlus,
  CheckCircle2,
  Clock,
} from "lucide-react";

type Role = "student"|"staff"|"admin"|"professor"|"ta"|"club_officer";
type Visibility = "public"|"campus"|"private";
type Year = "freshman"|"sophomore"|"junior"|"senior"|"grad"|"alumni"|"staff"|"faculty"|"other";
type Preference_Types = "defaultPreference"|"preference1"|"preference2"

type PublicUser = {
  uid: string;
  email?: string;
  name?: string;
  photoURL?: string;
  primaryRole?: Role;
  roles?: Role[];
  year?: Year | null;
  major?: string | null;
  bio?: string | null;
  visibility?: Visibility;
  isStaffVerified?: boolean;
  friendsCount?: number;
  pendingCount?: number;
  //TODO something may be wrong...
  preferences: Preference_Types[];
};

type EventMini = {
  id: string;
  title: string;
  start?: string;        // ISO
  location?: string;
  bannerUrl?: string;
};

export default function UserProfilePage() {
  const { uid: profileUid } = useParams();
  const nav = useNavigate();

  const [ready, setReady] = useState(false);
  const [meUid, setMeUid] = useState<string | null>(null);

  const [userDoc, setUserDoc] = useState<PublicUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [attending, setAttending] = useState<EventMini[]>([]);
  const [organizing, setOrganizing] = useState<EventMini[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Relationship status (from backend Option B)
  const [rel, setRel] = useState<{
    friend: boolean;
    incomingPending: boolean; // they -> me
    iSentPending: boolean;    // me -> them
    loading: boolean;
  }>({ friend: false, incomingPending: false, iSentPending: false, loading: true });

  const [acting, setActing] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setReady(true);
      setMeUid(u?.uid ?? null);
      if (!u) {
        nav("/login", { replace: true });
        return;
      }
    });
    return () => off();
  }, [nav]);

  // Load target user doc (basic public profile)
  useEffect(() => {
    if (!profileUid) return;
    (async () => {
      try {
        setErr(null);
        const snap = await getDoc(doc(db, "users", profileUid));
        if (!snap.exists()) {
          setErr("User not found.");
          setUserDoc(null);
          return;
        }
        const d = snap.data() || {};
        setUserDoc({
          uid: profileUid,
          email: d.email,
          name: d.name,
          photoURL: d.photoURL,
          primaryRole: d.primaryRole,
          roles: d.roles || [],
          year: d.year ?? null,
          major: d.major ?? null,
          bio: d.bio ?? "",
          visibility: d.visibility || "campus",
          isStaffVerified: !!d.isStaffVerified,
          friendsCount: Number(d.friendsCount || 0),
          pendingCount: Number(d.pendingCount || 0),
          preferences: d.preferences || [],
        });
      } catch (e: any) {
        setErr(e.message || "Failed to load profile");
      }
    })();
  }, [profileUid]);

    useEffect(() => {
    if (!profileUid) {
        return;
    }

    let alive = true;

    (async () => {
        try {
        setEventsLoading(true);

        // ---- RSVPs via collectionGroup ----
            // A) RSVPs via collection group, filter by field 'uid'
            const rsvpQ = query(
                collectionGroup(db, "rsvps"),
                where("uid", "==", profileUid)   // <-- instead of documentId()
                );

                const rsvpSnap = await getDocs(rsvpQ);

                // fetch parent events in parallel
                const eventDocs = await Promise.all(
                rsvpSnap.docs.map((r) => {
                    const parent = r.ref.parent.parent; // /events/{eventId}
                    return parent ? getDoc(parent) : Promise.resolve(null);
                })
                );

                const attendingEvents: EventMini[] = eventDocs
                .filter((d): d is NonNullable<typeof d> => !!d && d.exists())
                .map((ev) => {
                    const data = ev!.data() || {};
                    return {
                    id: ev!.id,
                    title: data.title || "(Untitled event)",
                    start: tsToISO(data.start),
                    location: data.locationName ?? data.location ?? "",
                    bannerUrl: data.bannerUrl || undefined,
                    };
                })
                .sort((a, b) => (+new Date(a.start || 0)) - (+new Date(b.start || 0)));

                const now = Date.now();
                const upcoming = attendingEvents.filter(e => (e.start ? +new Date(e.start) >= now : true));
                setAttending(upcoming);

        // ---- Events they created ----
        const orgQ = query(
            collection(db, "events"),
            where("createdBy", "==", profileUid),
            orderBy("start", "asc")
        );
        const orgSnap = await getDocs(orgQ);
        const organizingEvents: EventMini[] = orgSnap.docs.map((ev) => {
            const d = ev.data() || {};
            return {
            id: ev.id,
            title: d.title || "(Untitled event)",
            start: tsToISO(d.start),
            location: d.locationName ?? d.location ?? "",
            bannerUrl: d.bannerUrl || undefined,
            };
        });

        if (!alive) return;
        setAttending(upcoming);
        setOrganizing(organizingEvents);
        } catch (e) {
        console.error("[UserProfilePage] load events error:", e);
        setErr(e instanceof Error ? e.message : "Failed to load events");
        } finally {
        if (alive) setEventsLoading(false);
        }
    })();

    return () => { alive = false; };
    }, [profileUid, db]);

  // Load relationship status via backend (authoritative)
  async function loadFriendStatus() {
    if (!auth.currentUser || !profileUid || auth.currentUser.uid === profileUid) {
      setRel(r => ({ ...r, loading: false }));
      return;
    }
    try {
      setRel(r => ({ ...r, loading: true }));
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/friends/status/${encodeURIComponent(profileUid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // { friend, incomingPending, iSentPending }
      setRel({ ...data, loading: false });
    } catch (e: any) {
      setErr(e.message || "Failed to load relationship");
      setRel(r => ({ ...r, loading: false }));
    }
  }

  useEffect(() => {
    if (!auth.currentUser || !profileUid) return;
    loadFriendStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUid]);

  function toast(msg: string) {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 1600);
  }

  // Actions (refresh status after each)
  async function sendRequest() {
    if (!profileUid) return;
    try {
      setActing(true);
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/friends/requests/${encodeURIComponent(profileUid)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Friend request sent");
      await loadFriendStatus();
    } catch (e: any) {
      setErr(e.message || "Failed to send request");
    } finally {
      setActing(false);
    }
  }

  async function accept() {
    if (!profileUid) return;
    try {
      setActing(true);
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/friends/requests/${encodeURIComponent(profileUid)}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      toast("You're friends now");
      await loadFriendStatus();
    } catch (e: any) {
      setErr(e.message || "Failed to accept");
    } finally {
      setActing(false);
    }
  }

  async function decline() {
    if (!profileUid) return;
    try {
      setActing(true);
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/friends/requests/${encodeURIComponent(profileUid)}/decline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Request declined");
      await loadFriendStatus();
    } catch (e: any) {
      setErr(e.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  }

  async function unfriend() {
    if (!profileUid) return;
    try {
      setActing(true);
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/friends/${encodeURIComponent(profileUid)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Removed from friends");
      await loadFriendStatus();
    } catch (e: any) {
      setErr(e.message || "Failed to remove friend");
    } finally {
      setActing(false);
    }
  }

  const isMe = useMemo(() => meUid && profileUid && meUid === profileUid, [meUid, profileUid]);

  if (!ready) {
    return <div className="min-h-dvh grid place-items-center bg-background text-text">Loading…</div>;
  }

  if (!userDoc) {
    return (
      <div className="min-h-dvh bg-background text-text">
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
          <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
            <button
              onClick={() => nav(-1)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <div />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          {err ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          ) : (
            <p className="text-text-muted">User not found.</p>
          )}
        </main>
      </div>
    );
  }

  const roleChip = userDoc.primaryRole ? userDoc.primaryRole : (userDoc.roles?.[0] || "student");

  return (
    <div className="min-h-dvh bg-background text-text">
      <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => nav(-1)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {okMsg && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 px-3 py-2 text-sm">
            {okMsg}
          </div>
        )}
        {err && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          <div className="flex items-start gap-5">
            {userDoc.photoURL ? (
              <img src={userDoc.photoURL} alt={userDoc.name} className="size-20 rounded-2xl border border-border object-cover" />
            ) : (
              <div className="size-20 rounded-2xl border border-border bg-brand/10 grid place-items-center">
                <span className="text-brand font-semibold text-xl">
                  {(userDoc.name || userDoc.email || "U").slice(0,1).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{userDoc.name || userDoc.email || userDoc.uid}</h1>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 capitalize">
                  {roleChip}
                </span>
                {userDoc.isStaffVerified && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-600/10 text-emerald-600 border border-emerald-600/20">
                    <ShieldCheck className="size-3.5" /> Verified staff
                  </span>
                )}
              </div>

              {userDoc.bio && (
                <p className="mt-2 text-sm text-text-muted whitespace-pre-line">{userDoc.bio}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                {userDoc.year && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-4" /> {capitalize(userDoc.year)}
                  </span>
                )}
                {userDoc.major && (
                  <span>{userDoc.major}</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-4" />
                  {userDoc.friendsCount ?? 0} friends
                </span>
              </div>
            </div>

            {/* Relationship control */}
            {!isMe && (
              <div className="flex flex-col items-end gap-2">
                {rel.loading ? (
                  <span className="text-sm text-text-muted">Checking…</span>
                ) : rel.friend ? (
                  <button
                    onClick={unfriend}
                    disabled={acting}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted"
                    title="Remove friend"
                  >
                    <UserMinus className="size-4" />
                    Remove
                  </button>
                ) : rel.incomingPending ? (
                  <div className="flex gap-2">
                    <button
                      onClick={accept}
                      disabled={acting}
                      className="px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
                    >
                      Accept
                    </button>
                    <button
                      onClick={decline}
                      disabled={acting}
                      className="px-3 py-2 rounded-xl border border-border hover:bg-muted"
                    >
                      Decline
                    </button>
                  </div>
                ) : rel.iSentPending ? (
                  <button
                    disabled
                    className="px-3 py-2 rounded-xl border border-border text-text-muted cursor-not-allowed"
                    title="Request pending"
                  >
                    Pending
                  </button>
                ) : (
                  <button
                    onClick={sendRequest}
                    disabled={acting}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
                  >
                    <UserPlus className="size-4" />
                    Add friend
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Events sections */}
        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          <h2 className="text-lg font-semibold">Attending</h2>
          {eventsLoading ? (
            <p className="mt-2 text-sm text-text-muted">Loading…</p>
          ) : attending.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              {userDoc.uid === meUid ? "You’re" : "This user is"} not attending any upcoming events.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attending.map(ev => (
                <li key={ev.id} className="overflow-hidden rounded-xl border border-border">
                  {ev.bannerUrl && (
                    <div className="h-24 w-full overflow-hidden border-b border-border">
                      <img src={ev.bannerUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-medium line-clamp-2">{ev.title}</div>
                    <div className="mt-1 text-sm text-text-muted">
                      {niceDate(ev.start)}{ev.location ? ` · ${ev.location}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-6 text-lg font-semibold">Created</h2>
          {eventsLoading ? (
            <p className="mt-2 text-sm text-text-muted">Loading…</p>
          ) : organizing.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              {userDoc.uid === meUid ? "You haven’t" : "This user hasn’t"} created any events.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {organizing.map(ev => (
                <li key={ev.id} className="overflow-hidden rounded-xl border border-border">
                  {ev.bannerUrl && (
                    <div className="h-24 w-full overflow-hidden border-b border-border">
                      <img src={ev.bannerUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-medium line-clamp-2">{ev.title}</div>
                    <div className="mt-1 text-sm text-text-muted">
                      {niceDate(ev.start)}{ev.location ? ` · ${ev.location}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function capitalize(s?: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tsToISO(ts: any): string | undefined {
  if (!ts) return undefined;
  if (typeof ts?.toDate === "function") return ts.toDate().toISOString();
  try { return new Date(ts).toISOString(); } catch { return undefined; }
}

function niceDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}