"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatArrondissement } from "@/lib/utils";

// Fix Leaflet default icon paths broken by webpack/Next.js bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Showtime {
  show_time: string;
  version: string;
  format: string;
}

interface Cinema {
  cinema_name: string;
  arrondissement: number;
  latitude: number | null;
  longitude: number | null;
  showtimes: Showtime[];
}

interface CinemaMapProps {
  cinemas: Cinema[];
}

const PARIS_CENTER: [number, number] = [48.8566, 2.3522];

export default function CinemaMap({ cinemas }: CinemaMapProps) {
  const mappable = cinemas.filter(
    (c): c is Cinema & { latitude: number; longitude: number } =>
      c.latitude !== null && c.longitude !== null
  );

  return (
    <MapContainer
      center={PARIS_CENTER}
      zoom={13}
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mappable.map((cinema) => (
        <Marker
          key={cinema.cinema_name}
          position={[cinema.latitude, cinema.longitude]}
        >
          <Popup>
            <div>
              <strong>{cinema.cinema_name}</strong>
              <span style={{ color: "#888", marginLeft: 4, fontSize: 12 }}>
                ({formatArrondissement(cinema.arrondissement)})
              </span>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {cinema.showtimes.map((st, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: "#e0e7ff",
                      color: "#3730a3",
                    }}
                  >
                    {st.show_time}
                    {st.version !== "VF" && ` ${st.version}`}
                    {st.format !== "2D" && ` ${st.format}`}
                  </span>
                ))}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
