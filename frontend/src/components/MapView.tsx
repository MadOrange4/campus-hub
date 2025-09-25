// src/components/MapView.tsx
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type EventItem = {
  id: string;
  title: string;
  start: string;
  end?: string;
  location: string;
  tags: string[];
  bannerUrl?: string;
  desc?: string;
  locationLatLng?: { lat: number; lng: number };
};

export default function MapView({
  events,
  onOpen,
}: {
  events: EventItem[];
  onOpen: (id: string) => void;
}) {
  const points = events.filter(e => e.locationLatLng);
  const center = points[0]?.locationLatLng ?? { lat: 42.389, lng: -72.527 }; // fallback campus-ish

  return (
    <div className="relative rounded-2xl border border-border overflow-hidden">
      <MapContainer
        center={center}
        zoom={15}
        minZoom={3}
        maxZoom={19}
        style={{ height: "60vh", width: "100%" }}
        zoomControl={true}
        preferCanvas
      >
        {/* Dark, pretty basemap (Carto Dark Matter) */}
        <TileLayer
        attribution='&copy; OpenStreetMap contributors, &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Fit bounds to all visible points */}
        <FitToPoints events={points} />

        {/* Markers */}
        {points.map((ev) => {
          const pos = ev.locationLatLng!;
          const color = colorForTag(ev.tags?.[0]); // color by first tag
          return (
            <CircleMarker
              key={ev.id}
              center={pos}
              radius={9}
              pathOptions={{
                color: "rgba(255,255,255,0.9)", // ring
                weight: 2,
                fillColor: color.fill,
                fillOpacity: 0.9,
              }}
              // soft glow via canvas shadow (works when preferCanvas)
              eventHandlers={{
                add: (e) => {
                  const layer = e.target as any;
                  if (layer && layer._renderer && layer._renderer._ctx) {
                    const ctx = layer._renderer._ctx as CanvasRenderingContext2D;
                    // this applies per frame; simple approach is CSS filter on map (below)
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <div className="font-medium">{ev.title}</div>
                <div className="text-xs opacity-80">{ev.location}</div>
              </Tooltip>
              <Popup>
                <div className="space-y-2">
                  <div className="font-semibold">{ev.title}</div>
                  <div className="text-xs opacity-80">{ev.location}</div>
                  {ev.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {ev.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: colorForTag(t).border,
                            background: colorForTag(t).chip,
                            color: "#dbeafe",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => onOpen(ev.id)}
                    className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-background hover:bg-brand-600"
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend / UI overlay */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500]">
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/80 backdrop-blur px-3 py-2 shadow-soft">
          <div className="text-xs font-semibold mb-1 opacity-80">Categories</div>
          <div className="flex flex-wrap gap-2">
            {["social", "food", "sports", "tech", "career", "networking", "campus-life"].map((t) => {
              const c = colorForTag(t);
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-lg border"
                  style={{ borderColor: c.border, background: c.legendBg, color: "#e5e7eb" }}
                >
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: c.fill, boxShadow: `0 0 8px ${c.glow}` }}
                  />
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function FitToPoints({ events }: { events: Array<{ locationLatLng: { lat: number; lng: number } }> }) {
  const map = useMap();
  const first = useRef(true);

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (!events.length) return null;
    const b = L.latLngBounds(events.map((e) => e.locationLatLng));
    return b;
  }, [events]);

  useEffect(() => {
    if (!bounds || !first.current) return;
    first.current = false;
    try {
      map.fitBounds(bounds, { padding: [40, 40] });
    } catch {}
  }, [map, bounds]);

  return null;
}

function colorForTag(tag?: string) {
  const key = (tag || "").toLowerCase();
  const palette: Record<
    string,
    { fill: string; border: string; chip: string; legendBg: string; glow: string }
  > = {
    social:       mk("#7c3aed"), // purple
    food:         mk("#f59e0b"), // amber
    sports:       mk("#10b981"), // emerald
    tech:         mk("#06b6d4"), // cyan
    career:       mk("#3b82f6"), // blue
    networking:   mk("#ec4899"), // pink
    "campus-life":mk("#8b5cf6"), // violet
    default:      mk("#22c55e"), // green
  };
  return palette[key] || palette.default;
}

function mk(hex: string) {
  return {
    fill: hex,
    border: hex + "99",
    chip: hex + "22",
    legendBg: "rgba(17, 24, 39, 0.6)", // slate-ish
    glow: hex + "88",
  };
}