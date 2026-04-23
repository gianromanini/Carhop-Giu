import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface VehicleWithCoords {
  id: number;
  model: string;
  price: number;
  images?: string[];
  locationLat?: number | null;
  locationLon?: number | null;
  distance: number;
  coords: { lat: number; lon: number };
}

interface VehicleMapProps {
  userCoords: { lat: number; lon: number };
  vehicles: Array<{
    id: number;
    model: string;
    price: number;
    images?: string[];
    locationLat?: number | null;
    locationLon?: number | null;
  }>;
  selectedMapVehicle: number | null;
  setSelectedMapVehicle: (id: number | null) => void;
  handleViewDetails: (v: any) => void;
}

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function VehicleMap({ userCoords, vehicles, selectedMapVehicle, setSelectedMapVehicle, handleViewDetails }: VehicleMapProps) {
  const userIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const vehiclesWithCoords: VehicleWithCoords[] = vehicles
    .map(v => {
      let lat: number, lon: number;
      if (v.locationLat !== null && v.locationLat !== undefined && v.locationLon !== null && v.locationLon !== undefined) {
        lat = v.locationLat;
        lon = v.locationLon;
      } else {
        const seed = v.id * 0.01;
        lat = userCoords.lat + (Math.sin(seed * 13.7) * 0.05);
        lon = userCoords.lon + (Math.cos(seed * 17.3) * 0.05);
      }
      return { ...v, coords: { lat, lon }, distance: 0 };
    })
    .map(v => ({
      ...v,
      distance: haversineDistance(userCoords.lat, userCoords.lon, v.coords.lat, v.coords.lon)
    }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <MapContainer
      center={[userCoords.lat, userCoords.lon]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[userCoords.lat, userCoords.lon]} icon={userIcon}>
        <Popup>
          <div className="text-center">
            <strong>Your Location</strong>
          </div>
        </Popup>
      </Marker>
      {vehiclesWithCoords.slice(0, 10).map((v) => {
        const isSelected = selectedMapVehicle === v.id;
        const carIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: #000000; color: white; padding: 2px 6px; border-radius: 50%; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; display: flex; align-items: center; justify-content: center; height: 28px; width: 38px; ${isSelected ? 'border: 3px solid #22c55e;' : ''}">$ ${v.price}</div>`,
          iconSize: [38, 28],
          iconAnchor: [19, 14],
        });
        return (
          <Marker
            key={v.id}
            position={[v.coords.lat, v.coords.lon]}
            icon={carIcon}
            eventHandlers={{ click: () => setSelectedMapVehicle(isSelected ? null : v.id) }}
          >
            <Popup>
              <div className="text-center">
                <img
                  src={v.images?.[0] || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=100&q=60'}
                  alt={v.model}
                  className="w-24 h-16 object-cover rounded mb-2"
                />
                <strong>{v.model}</strong>
                <div className="text-green-600 font-bold">${v.price}/day</div>
                <div className="text-xs text-zinc-500">{v.distance.toFixed(1)} miles away</div>
                <button
                  onClick={() => handleViewDetails(v)}
                  className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
