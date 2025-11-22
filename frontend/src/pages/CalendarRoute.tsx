// src/pages/CalendarRoute.tsx - Transformed & Refined
import { useEffect, useState, useMemo} from "react";
// Import the updated EventItem type from the transformed Calendar file
import Calendar, { type EventItem } from "./Calendar"; 
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  Timestamp, // Import Timestamp for consistency with App.tsx mapping helpers
} from "firebase/firestore";
import { useNavigate } from "react-router-dom"; 
import { CalendarDays } from "lucide-react";

interface FirebaseUser {
  uid: string;
  // ... other properties
}

/** keep the same mapping logic as pages/App.tsx */
function tsToISO(ts: any): string {
  if (ts?.toDate) return ts.toDate().toISOString();
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toISOString();
}

/** keep the same mapping logic as pages/App.tsx */
function mapEventDoc(id: string, data: DocumentData): EventItem {
  const startISO = tsToISO(data.start);
  const endISO = data.end ? tsToISO(data.end) : undefined;

  return {
    id,
    title: data.title ?? "",
    start: startISO,
    end: endISO,
    location: data.locationName ?? data.location ?? "",
    tags: Array.isArray(data.tags) ? data.tags.map((t: any) => String(t)) : [],
    bannerUrl: data.bannerUrl ?? undefined,
    desc: data.desc ?? "", // Included optional desc
    locationLatLng:
      data.location && data.location.latitude != null
        ? { lat: data.location.latitude, lng: data.location.longitude }
        : undefined,
  };
}

export default function CalendarRoute({
  currentDate,
  setCurrentDate,
  onDateSelect,
  currentUser,
}: {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  onDateSelect: (d: Date) => void;
  currentUser: FirebaseUser;
}) {
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  // NEW: State to hold the IDs of events the user has RSVP'd to
  const [attendingEventIds, setAttendingEventIds] = useState<Set<string>>(new Set()); 
  // NEW: State to toggle the filter (default to true to show ONLY attending)
  const [showOnlyAttending, setShowOnlyAttending] = useState(true); 
  const navigate = useNavigate();

  if (!currentUser || !currentUser.uid) {
      // This is the simplest graceful exit. 
      // You could also show a "Loading..." screen if you prefer.
      return <div className="min-h-dvh grid place-items-center bg-background text-text">
        <p>Loading user data for calendar...</p>
      </div>;
  }

  // 1. Load ALL events
  useEffect(() => {
    const qy = query(collection(db, "events"), orderBy("start", "asc"));
    const off = onSnapshot(
      qy,
      (snap) => {
        const rows: EventItem[] = snap.docs.map((d) => mapEventDoc(d.id, d.data()));
        setAllEvents(rows);
      },
      () => setAllEvents([])
    );
    return () => off();
  }, []);

  // 2. NEW: Load the IDs of events the current user is attending (RSVPs)
  useEffect(() => {
    // Query the collection: users/{currentUser.uid}/rsvps (denormalized path from App.tsx change)
    const rsvpQuery = collection(db, "users", currentUser.uid, "rsvps");

    const offRsvps = onSnapshot(
      rsvpQuery,
      (snap) => {
        const ids = new Set(snap.docs.map((d) => d.id));
        setAttendingEventIds(ids);
      },
      () => setAttendingEventIds(new Set())
    );
    return () => offRsvps();
  }, [currentUser.uid]);

  // 3. NEW: Filter the events list based on the toggle and attending IDs
  const filteredEvents = useMemo(() => {
      if (showOnlyAttending) {
          return allEvents.filter(event => attendingEventIds.has(event.id));
      }
      return allEvents;
  }, [allEvents, attendingEventIds, showOnlyAttending]);

  return (
    <div className="calendar-route-container">
      {/* Toggle Button to switch between Attending/All events */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        <button 
          onClick={() => setShowOnlyAttending(s => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
        >
          <CalendarDays className="size-4" />
          {showOnlyAttending ? "Show All Events" : "Show Only Attending Events"}
        </button>
      </div>

      <Calendar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onDateSelect={onDateSelect}
        events={filteredEvents} // <--- PASS THE FILTERED LIST
        onEventClick={(id) => {
          navigate(`/app?e=${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}