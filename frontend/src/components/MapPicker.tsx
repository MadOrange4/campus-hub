import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L, { LatLngLiteral, Icon } from "leaflet";

// Fix default marker icons for Vite bundling
const DefaultIcon = new Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Props = {
  value?: LatLngLiteral | null;
  onChange: (latlng: LatLngLiteral | null) => void;
  className?: string;
  // optional: start center (UMass Amherst)
  center?: LatLngLiteral;
  zoom?: number;
  draggable?: boolean;
};

function ClickToPlace({
  onSet,
}: {
  onSet: (latlng: LatLngLiteral) => void;
}) {
  useMapEvents({
    click(e) {
      onSet({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapPicker({
  value,
  onChange,
  className,
  center = { lat: 42.3868, lng: -72.5293 }, // UMass-ish
  zoom = 15,
  draggable = true,
}: Props) {
  const [pos, setPos] = useState<LatLngLiteral | null>(value ?? null);

  useEffect(() => {
    setPos(value ?? null);
  }, [value]);

  const setBoth = (ll: LatLngLiteral | null) => {
    setPos(ll);
    onChange(ll);
  };

  return (
    <div className={className}>
      <div className="h-72 rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={pos ?? center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onSet={(ll) => setBoth(ll)} />
          {pos && (
            <Marker
              position={pos}
              draggable={draggable}
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  setBoth({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Footer controls */}
      <div className="mt-2 flex items-center justify-between text-sm">
        {pos ? (
          <div className="text-text-muted">
            <b>Selected:</b> {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
          </div>
        ) : (
          <div className="text-text-muted">Click on the map to place a marker</div>
        )}
        <button
          type="button"
          onClick={() => setBoth(null)}
          className="px-2 py-1 rounded-lg border border-border bg-surface hover:bg-muted"
        >
          Clear
        </button>
      </div>
    </div>
  );
}