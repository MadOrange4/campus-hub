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
  const [attendingEventIds, setAttendingEventIds] = useState<Set<string>>(new Set()); 
  const [showOnlyAttending, setShowOnlyAttending] = useState(true); 
  const navigate = useNavigate();

  if (!currentUser || !currentUser.uid) {
      // This is the simplest graceful exit. 
      // You could also show a "Loading..." screen if you prefer.
      return <div className="min-h-dvh grid place-items-center bg-background text-text">
        <p>Loading user data for calendar...</p>
      </div>;
  }

  // Load ALL events
  // eslint-disable-next-line react-hooks/rules-of-hooks
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

  // Load the IDs of events the current user is attending (RSVPs)
  // eslint-disable-next-line react-hooks/rules-of-hooks
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

  // Filter the events list based on the toggle and attending IDs
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const filteredEvents = useMemo(() => {
      if (showOnlyAttending) {
          return allEvents.filter(event => attendingEventIds.has(event.id));
      }
      return allEvents;
  }, [allEvents, attendingEventIds, showOnlyAttending]);

  const handleToggleAttending = () => setShowOnlyAttending(s => !s); 

  return (
    <div className="calendar-route-container">
      <Calendar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onDateSelect={onDateSelect}
        events={filteredEvents} 
        onEventClick={(id) => {
          navigate(`/app?e=${encodeURIComponent(id)}`);
        }}
        showOnlyAttending={showOnlyAttending}
        onToggleAttending={handleToggleAttending}
      />
    </div>
  );
}