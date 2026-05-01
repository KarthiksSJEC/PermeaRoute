import React, { useEffect, useState } from 'react';
import { ShieldAlert, Activity, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [feeds, setFeeds] = useState([]);

  useEffect(() => {
    let mounted = true;
    const fetchFeeds = async () => {
      try {
        const resp = await fetch('http://localhost:8000/feeds');
        const json = await resp.json();
        if (mounted) {
          setFeeds(json);
        }
      } catch (error) {
        console.error('Failed to fetch live feeds', error);
      }
    };

    fetchFeeds();
    const interval = setInterval(fetchFeeds, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            We don't show how slow.<br />We show what the road is slow <i>with</i>.
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
            PermeaRoute analyzes live traffic composition using YOLOv11 to calculate the Permeability Index (PI). 
            Unlike traditional GPS which only shows speed, we detect if a road is blocked by rigid vehicles (buses/trucks) 
            or flexible ones (bikes/autos) that can yield to an ambulance siren.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/live" className="btn btn-primary">
              <Activity size={18} /> View Live Stream
            </Link>
            <Link to="/map" className="btn btn-outline">
              <ShieldAlert size={18} /> View Blocked Routes
            </Link>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div style={{ position: 'absolute', right: '-10%', top: '-20%', width: '400px', height: '400px', background: 'var(--accent-blue)', opacity: '0.1', filter: 'blur(100px)', borderRadius: '50%' }}></div>
      </div>

      <h2 style={{ fontSize: '1.25rem', marginTop: '1rem' }}>Permeability Tiers</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid var(--accent-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="status-badge status-green">🟢 GREEN</div>
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>PI &gt; 60%</span>
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Ambulance Friendly</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>High concentration of flexible vehicles. Traffic will easily part for emergency sirens.</p>
        </div>
        
        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid var(--accent-amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="status-badge status-amber">🟡 AMBER</div>
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>PI 40-60%</span>
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Marginal Caution</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Mixed traffic. An ambulance may experience moderate delays navigating through.</p>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid var(--accent-red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="status-badge status-red">🔴 RED</div>
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>PI &lt; 40%</span>
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Solid Block</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>High concentration of buses and trucks. An ambulance will be physically trapped. Avoid.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} className="text-gradient" /> Live System Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Streams</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>{feeds.filter(feed => feed.active).length}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Detections</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>24,891</div>
            </div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Ready to Deploy</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>No new hardware required. PermeaRoute integrates directly into existing Smart City CCTV networks via standard RTSP feeds.</p>
          <button className="btn btn-outline" style={{ width: 'fit-content' }}>Documentation <ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Live Feed Tiles</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Browser feeds update every 3s</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {feeds.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No active feeds yet. Start capture from Live Stream.</div>
          ) : feeds.map(feed => (
            <div key={feed.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div style={{ aspectRatio: '16 / 9', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {feed.latest_image ? (
                  <img src={feed.latest_image} alt={feed.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Waiting for video</span>
                )}
              </div>
              <div style={{ padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{feed.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{feed.route_name || 'Unassigned route'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{feed.active ? 'Live' : 'Stale'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: feed.latest_pi?.tier === 'RED' ? 'var(--accent-red)' : feed.latest_pi?.tier === 'AMBER' ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                      {feed.latest_pi?.pi ?? '--'}%
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{feed.latest_pi?.tier ?? 'UNKNOWN'}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
