// src/pages/CalendarRoute.tsx - Transformed & Refined
import { useEffect, useState } from "react";
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
}: {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  onDateSelect: (d: Date) => void;
}) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // This query fetches ALL events, which is correct for a multi-month calendar view,
    // as it does not include the date-range 'where' clauses used in App.tsx feed.
    const qy = query(collection(db, "events"), orderBy("start", "asc"));
    const off = onSnapshot(
      qy,
      (snap) => {
        const rows: EventItem[] = snap.docs.map((d) => mapEventDoc(d.id, d.data()));
        setEvents(rows);
      },
      () => setEvents([])
    );
    return () => off();
  }, []); // Empty dependency array ensures it only runs once and loads ALL events.

  return (
    <Calendar
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      onDateSelect={onDateSelect}
      events={events} // Passing the full, unfiltered list of events
      // Optional: jump to feed with selected event id
      onEventClick={(id) => {
        // If later you want the details modal to auto-open,
        // read ?e=ID in pages/App.tsx and open it.
        navigate(`/app?e=${encodeURIComponent(id)}`);
      }}
    />
  );
}