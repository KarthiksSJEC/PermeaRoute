import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { loadRoutePlan } from '../lib/routePlanner';

// Small convenience: demo coordinate lookup for known junction names
const JUNCTION_COORDS = {
  'Nanthoor Junction': [12.8833, 74.8667],
  'Lalbagh': [12.8913, 74.8396],
  'Pumpwell': [12.8644, 74.8569],
  'Hampankatta': [12.8687, 74.8436],
  'Kadri Park': [12.8860, 74.8580]
};

export default function MapView() {
  const [feeds, setFeeds] = useState([]);
  const [coordsCache, setCoordsCache] = useState({});
  const [routePlan, setRoutePlan] = useState(() => loadRoutePlan());

  useEffect(() => {
    let mounted = true;
    const fetchFeeds = async () => {
      try {
        const resp = await fetch('http://localhost:8000/feeds');
        const json = await resp.json();
        if (!mounted) return;
        setFeeds(json);
      } catch (e) {
        console.error('Failed to fetch feeds', e);
      }
    };

    fetchFeeds();
    const iv = setInterval(fetchFeeds, 3000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const syncRoutePlan = () => setRoutePlan(loadRoutePlan());
    syncRoutePlan();
    window.addEventListener('storage', syncRoutePlan);
    return () => window.removeEventListener('storage', syncRoutePlan);
  }, []);

  useEffect(() => {
    const unknownNames = feeds
      .map(feed => feed.name)
      .filter(name => name && !JUNCTION_COORDS[name] && !coordsCache[name]);

    if (unknownNames.length === 0) {
      return;
    }

    unknownNames.forEach(async (name) => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (json?.length > 0) {
          const lat = Number(json[0].lat);
          const lng = Number(json[0].lon);
          setCoordsCache(prev => ({ ...prev, [name]: [lat, lng] }));
        }
      } catch (error) {
        console.error(`Geocoding failed for ${name}`, error);
      }
    });
  }, [feeds, coordsCache]);

  const getTierColor = (tier) => {
    switch(tier) {
      case 'GREEN': return '#10b981';
      case 'AMBER': return '#f59e0b';
      case 'RED': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const now = Date.now() / 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Corridor Map (Mangaluru)</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="status-badge status-green">🟢 &gt;60% PI</div>
          <div className="status-badge status-amber">🟡 40-60% PI</div>
          <div className="status-badge status-red">🔴 &lt;40% PI</div>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', padding: '0.25rem' }}>
        <MapContainer center={[12.8750, 74.8500]} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '14px', background: '#0b1120' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {routePlan?.routes?.map((route) => (
            <Polyline
              key={route.routeId}
              positions={route.path.map((point) => [point.lat, point.lng])}
              pathOptions={{
                color: route.routeId === routePlan.bestRouteId ? '#10b981' : '#64748b',
                weight: route.routeId === routePlan.bestRouteId ? 5 : 3,
                opacity: route.routeId === routePlan.bestRouteId ? 0.95 : 0.5,
                dashArray: route.routeId === routePlan.bestRouteId ? '' : '8, 10',
              }}
            />
          ))}
          
          {feeds.map(feed => {
            const pi = feed.latest_pi ? (feed.latest_pi.pi || 0) : 0;
            const tier = feed.latest_pi ? feed.latest_pi.tier || 'UNKNOWN' : 'UNKNOWN';
            const routeMarker = routePlan?.routes?.find((route) => route.routeId === feed.route_id);
            const coords = routeMarker?.samplingCoords || JUNCTION_COORDS[feed.name] || coordsCache[feed.name] || [12.8750, 74.8500];
            const stale = !feed.last_seen_ts || (now - feed.last_seen_ts) > 30;
            return (
              <CircleMarker
                key={feed.id}
                center={coords}
                radius={stale ? 8 : 10}
                pathOptions={{ 
                  color: stale ? '#64748b' : getTierColor(tier), 
                  fillColor: stale ? '#64748b' : getTierColor(tier),
                  fillOpacity: stale ? 0.45 : 0.75,
                  weight: 2
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '180px', color: '#333' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                      {feed.name}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                      {feed.route_name || routeMarker?.routeName || 'Unassigned route'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <b>PI Score:</b>
                      <span style={{ color: getTierColor(tier), fontWeight: 'bold' }}>{pi}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Last update: {feed.last_seen_ts ? new Date(feed.last_seen_ts*1000).toLocaleTimeString() : 'Never'}</span>
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '6px', color: stale ? '#b91c1c' : '#059669' }}>
                      {stale ? 'Stale feed' : 'Active feed'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
