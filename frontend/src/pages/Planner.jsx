import React, { useEffect, useMemo, useState } from 'react';
import { Route as RouteIcon, MapPin, Search, Clock } from 'lucide-react';
import {
  buildRoutePlan,
  loadRoutePlan,
  loadSelectedRouteId,
  saveRoutePlan,
  saveSelectedRouteId,
  scoreRoutePlan,
} from '../lib/routePlanner';

export default function Planner() {
  const [startingPoint, setStartingPoint] = useState('KMC Hospital, Ambedkar Circle');
  const [destination, setDestination] = useState('Kavoor Junction');
  const [routePlan, setRoutePlan] = useState(() => loadRoutePlan());
  const [selectedRouteId, setSelectedRouteId] = useState(() => loadSelectedRouteId());
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    const syncRoutePlan = () => {
      const savedPlan = loadRoutePlan();
      if (savedPlan) {
        setRoutePlan(savedPlan);
      }
    };

    syncRoutePlan();
    window.addEventListener('storage', syncRoutePlan);
    return () => window.removeEventListener('storage', syncRoutePlan);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshFeeds = async () => {
      try {
        const response = await fetch('http://localhost:8000/feeds');
        const json = await response.json();
        if (!mounted) {
          return;
        }

        setFeeds(json);

        const savedPlan = loadRoutePlan();
        if (savedPlan) {
          const scoredPlan = scoreRoutePlan(savedPlan, json);
          saveRoutePlan(scoredPlan);
          setRoutePlan(scoredPlan);
        }
      } catch (error) {
        console.error('Failed to refresh feeds for planner', error);
      }
    };

    refreshFeeds();
    const interval = setInterval(refreshFeeds, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const analysisAgeSeconds = routePlan ? Math.floor((Date.now() - routePlan.generatedAt) / 1000) : 0;
  const finalReady = Boolean(routePlan) && analysisAgeSeconds >= 30;
  const displayRoutes = useMemo(() => {
    if (!routePlan?.routes) {
      return [];
    }

    return [...routePlan.routes].sort((left, right) => {
      if (left.isBlocked !== right.isBlocked) return left.isBlocked ? 1 : -1;
      return left.distanceKm - right.distanceKm;
    });
  }, [routePlan]);

  const bestRoute = routePlan?.routes?.find((route) => route.routeId === routePlan.bestRouteId) || displayRoutes[0] || null;

  const generateRoutes = async () => {
    setLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const generatedPlan = await buildRoutePlan(startingPoint.trim(), destination.trim());
      const scoredPlan = scoreRoutePlan(generatedPlan, feeds);
      saveRoutePlan(scoredPlan);
      setRoutePlan(scoredPlan);

      if (scoredPlan.routes[0]) {
        saveSelectedRouteId(scoredPlan.routes[0].routeId);
        setSelectedRouteId(scoredPlan.routes[0].routeId);
      }

      setInfoMessage('Routes generated. Open three Live tabs and capture the highlighted sampling junction for each route.');
    } catch (error) {
      console.error('Route generation failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate routes from the provided places.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = (routeId) => {
    setSelectedRouteId(routeId);
    saveSelectedRouteId(routeId);
  };

  const getTierClass = (route) => {
    if (route.isBlocked) return 'red';
    if (route.routeId === routePlan?.bestRouteId) return 'green';
    return 'amber';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>Route Planner Comparison</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Auto-generate three route options from your start and destination, then capture one junction video per route.
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} />
          {routePlan ? `${analysisAgeSeconds}s elapsed` : 'waiting for route generation'}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>STARTING POINT</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              value={startingPoint}
              onChange={(event) => setStartingPoint(event.target.value)}
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Enter start location"
            />
          </div>
        </div>

        <div style={{ flex: '1 1 280px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>DESTINATION</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Enter destination"
            />
          </div>
        </div>

        <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={generateRoutes} disabled={loading}>
          <Search size={18} /> {loading ? 'Generating...' : 'Generate Routes'}
        </button>
      </div>

      {errorMessage && (
        <div className="glass-card" style={{ borderTop: '4px solid var(--accent-red)', padding: '1rem 1.25rem', color: 'var(--accent-red)' }}>
          {errorMessage}
        </div>
      )}

      {infoMessage && (
        <div className="glass-card" style={{ borderTop: '4px solid var(--accent-green)', padding: '1rem 1.25rem' }}>
          {infoMessage}
        </div>
      )}

      {routePlan ? (
        <>
          <div className="glass-card" style={{ borderTop: '4px solid var(--accent-green)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div className="status-badge status-green" style={{ marginBottom: '0.75rem' }}>ROUTE BATCH READY</div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>Dispatcher sampling plan</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {routePlan.start.name} → {routePlan.destination.name}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: 'var(--accent-green)' }}>
                  {bestRoute ? bestRoute.distanceKm + ' km' : '--'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {finalReady ? 'Shortest eligible distance' : 'Provisional distance'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="status-badge status-green">Active feeds: {feeds.filter((feed) => feed.active).length}</div>
              <div className="status-badge status-amber">Analysis window: 30s</div>
              <div className="status-badge status-red">Capture one junction per route</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.5rem' }}>
            {displayRoutes.map((route) => {
              const tierClass = getTierClass(route);
              const isBest = route.routeId === routePlan.bestRouteId;
              const isSelected = route.routeId === selectedRouteId;

              return (
                <div
                  key={route.routeId}
                  className="glass-card"
                  style={{ borderTop: `4px solid var(--accent-${tierClass})`, padding: '1.5rem', opacity: isBest ? 1 : 0.95 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div className={`status-badge status-${tierClass}`} style={{ marginBottom: '0.5rem' }}>
                        {isBest ? 'RECOMMENDED' : 'ALTERNATE'}
                      </div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>{route.routeName}</h3>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{route.samplingJunction}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: route.isBlocked ? '1.4rem' : '1.9rem', fontWeight: 800, lineHeight: 1, color: `var(--accent-${tierClass})` }}>
                        {route.isBlocked ? 'Blocked' : `${route.distanceKm} km`}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{route.isBlocked ? 'PI < 40%' : 'distance'}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Distance</span>
                      <span>{route.distanceKm} km</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Latest PI</span>
                      <span style={{ fontWeight: 700 }}>{route.latestPi ?? '--'}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Live feed</span>
                      <span>{route.feedCount ? 'Connected' : 'Waiting'}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.95rem', background: 'rgba(0,0,0,0.18)', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                      Capture junction for this route
                    </div>
                    <div style={{ fontWeight: 700 }}>{route.samplingJunction}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`} style={{ flex: '1 1 140px' }} onClick={() => handleSelectRoute(route.routeId)}>
                      {isSelected ? 'Selected in Live tab' : 'Use in Live tab'}
                    </button>
                    <div className="status-badge status-amber" style={{ flex: '1 1 140px', justifyContent: 'center' }}>
                      {route.reportStatus}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-card" style={{ borderTop: '4px solid var(--accent-green)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Final Report</h3>
              <div className={`status-badge status-${finalReady ? 'green' : 'amber'}`}>
                {finalReady ? 'Ready' : `Collecting live data (${Math.min(30, analysisAgeSeconds)} / 30s)`}
              </div>
            </div>

            {bestRoute ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Recommended route</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.35rem' }}>{bestRoute.routeName}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sampling junction</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.35rem' }}>{bestRoute.samplingJunction}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Distance</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.35rem' }}>{bestRoute.distanceKm} km</div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Generate routes first to see the final report.</div>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
          Enter start and destination, then generate three candidate routes. Each route will get one sampling junction for a Live tab.
        </div>
      )}
    </div>
  );
}