// src/pages/CalendarRoute.tsx
import { useEffect, useState } from "react";
import Calendar, { type EventItem } from "./Calendar";
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";

/** keep the same mapping logic as pages/App.tsx */
function tsToISO(ts: any): string {
  if (ts?.toDate) return ts.toDate().toISOString();
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toISOString();
}

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

  useEffect(() => {
    // same feed query style; no additional filters here
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
  }, []);

  return (
    <Calendar
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      onDateSelect={onDateSelect}
      events={events}
      // Optional: jump to feed with selected event id
      onEventClick={(id) => {
        // If later you want the details modal to auto-open,
        // read ?e=ID in pages/App.tsx and open it.
        window.location.href = `/app?e=${encodeURIComponent(id)}`;
      }}
    />
  );
}