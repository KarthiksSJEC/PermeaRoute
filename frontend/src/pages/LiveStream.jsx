import React, { useEffect, useState, useRef } from 'react';
import { Activity, Play, Square, AlertTriangle, MonitorUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  loadRoutePlan,
  loadSelectedRouteId,
  saveSelectedRouteId,
} from '../lib/routePlanner';

export default function LiveStream() {
  const [connected, setConnected] = useState(false);
  const [feedId, setFeedId] = useState(null);
  const [junctionName, setJunctionName] = useState('');
  const [routePlan, setRoutePlan] = useState(() => loadRoutePlan());
  const [selectedRouteId, setSelectedRouteId] = useState(() => loadSelectedRouteId());
  const [frame, setFrame] = useState(null);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const countdownIntervalRef = useRef(null);
  
  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const syncRoutePlan = () => setRoutePlan(loadRoutePlan());
    syncRoutePlan();
    window.addEventListener('storage', syncRoutePlan);
    return () => window.removeEventListener('storage', syncRoutePlan);
  }, []);

  const selectedRoute = routePlan?.routes?.find((route) => route.routeId === selectedRouteId) || routePlan?.routes?.[0] || null;

  const startScreenShare = async () => {
    try {
      setErrorMsg(null);
      // Request screen share from the browser
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" },
        audio: false 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Handle user clicking "Stop sharing" on the browser native UI
      stream.getVideoTracks()[0].onended = () => {
        disconnect();
      };
      
      const feedLabel = selectedRoute?.samplingJunction || junctionName || 'Unnamed Junction';

      // Register feed with backend before connecting
      let registeredFeedId = null;
      try {
        const resp = await fetch('http://localhost:8000/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: feedLabel,
            route_id: selectedRoute?.routeId || null,
            route_name: selectedRoute?.routeName || null,
            sampling_junction: selectedRoute?.samplingJunction || feedLabel,
            start_name: routePlan?.start?.name || null,
            destination_name: routePlan?.destination?.name || null,
          })
        });
        const json = await resp.json();
        registeredFeedId = json.feed_id;
        setFeedId(registeredFeedId);
      } catch (e) {
        console.error('Failed to register feed', e);
        setErrorMsg('Failed to register feed with backend');
        return;
      }

      // Start 30s countdown timer
      setTimeLeft(30);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            disconnect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      connectWebSocket(registeredFeedId);
    } catch (err) {
      console.error("Screen share error:", err);
      setErrorMsg("Screen sharing was denied or failed. Please allow screen sharing to use this feature.");
    }
  };

  const connectWebSocket = (targetFeedId) => {
    // Connect to FastAPI WebSocket for this feed
    if (!targetFeedId) {
      setErrorMsg('Feed registration failed. Please try again.');
      return;
    }

    const target = `ws://localhost:8000/stream/${targetFeedId}`;
    const ws = new WebSocket(target);
    
    ws.onopen = () => {
      setConnected(true);
      // Start capturing frames and sending them
      intervalRef.current = setInterval(captureAndSendFrame, 200); // 5 FPS guardrail for multi-feed demos
    };
    
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.error) {
        setErrorMsg(payload.error);
        disconnect();
        return;
      }
      setFrame(payload.image);
      setData(payload.pi_result);
      
      if (payload.pi_result && payload.pi_result.pi !== undefined) {
        setHistory(prev => {
          const piValue = payload.pi_result.smoothed_pi ?? payload.pi_result.pi;
          const newHist = [...prev, { time: new Date().toLocaleTimeString(), pi: piValue }];
          if (newHist.length > 30) return newHist.slice(newHist.length - 30);
          return newHist;
        });
      }
    };
    
    ws.onclose = () => {
      setConnected(false);
      clearInterval(intervalRef.current);
    };
    
    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setErrorMsg("WebSocket connection to backend failed. Is the backend running?");
    };
    
    wsRef.current = ws;
  };

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Draw current video frame to canvas
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get base64 string
      const base64Frame = canvas.toDataURL('image/jpeg', 0.6);
      
      // Send to backend
      wsRef.current.send(base64Frame);
    }
  };

  const disconnect = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setTimeLeft(null);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnected(false);
    setFrame(null);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const handleRouteSelect = (routeId) => {
    setSelectedRouteId(routeId);
    saveSelectedRouteId(routeId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      {/* Hidden elements for capturing */}
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {routePlan?.finalized && selectedRouteId && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1.5rem', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: routePlan.bestRouteId === selectedRouteId ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
            border: `2px solid ${routePlan.bestRouteId === selectedRouteId ? 'var(--accent-green)' : 'var(--text-muted)'}`,
            borderRadius: '12px'
          }}
        >
          {routePlan.bestRouteId === selectedRouteId ? (
            <h2 style={{ margin: 0, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.8rem', fontWeight: 800 }}>
              🏆 THIS IS THE WINNING ROUTE 🏆
            </h2>
          ) : (
            <h2 style={{ margin: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
              ❌ ALTERNATE ROUTE (Winner is {routePlan.routes.find(r => r.routeId === routePlan.bestRouteId)?.routeName})
            </h2>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MonitorUp className={connected ? "text-gradient animate-pulse-green" : ""} /> 
          Live Screen Capture (WebRTC)
        </h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input placeholder="Junction name (e.g. Nanthoor)" value={junctionName} onChange={e => setJunctionName(e.target.value)} className="input-field" style={{ padding: '0.5rem', borderRadius: '8px' }} />
          {!connected ? (
            <button className="btn btn-primary" onClick={startScreenShare}>
              <Play size={18} /> Share Tab & Capture
            </button>
          ) : (
            <button className="btn btn-outline" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)', position: 'relative' }} onClick={disconnect}>
              <Square size={18} /> Stop Capture
              {timeLeft !== null && (
                <span style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--accent-red)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {timeLeft}s
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {routePlan && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Selected route for this tab</div>
            <select className="input-field" value={selectedRouteId || routePlan.routes?.[0]?.routeId || ''} onChange={(event) => handleRouteSelect(event.target.value)}>
              {routePlan.routes.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {route.routeName} - {route.samplingJunction}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '2 1 360px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {selectedRoute ? (
              <>
                Capture {selectedRoute.samplingJunction} for {selectedRoute.routeName}. Use one browser tab per route.
              </>
            ) : (
              'Generate routes in Planner first, then choose one route per tab here.'
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <span>Feed: {selectedRoute?.samplingJunction || junctionName || 'Unassigned'}</span>
        <span>{feedId ? `Feed ID: ${feedId}` : 'Feed not registered yet'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '0.5rem', borderRadius: '16px' }}>
            <div className="video-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#050505' }}>
              {errorMsg ? (
                <div style={{ color: 'var(--accent-red)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                  <AlertTriangle size={48} />
                  <span style={{ fontWeight: 'bold' }}>Capture Error</span>
                  <p style={{ fontSize: '0.85rem', maxWidth: '400px', textAlign: 'center' }}>
                    {errorMsg}
                  </p>
                </div>
              ) : frame ? (
                <img src={frame} alt="Live Stream" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <MonitorUp size={48} opacity={0.2} />
                  <span>Ready to capture</span>
                  <p style={{ fontSize: '0.85rem', maxWidth: '400px', textAlign: 'center', opacity: 0.7 }}>
                    Click 'Share Tab & Capture' and select a YouTube traffic video tab to begin streaming to the AI backend.
                  </p>
                </div>
              )}
              
              {connected && !errorMsg && (
                <div className="video-overlay animate-pulse-red" style={{ top: '1rem', right: '1rem', left: 'auto' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }}></div>
                  LIVE
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', height: '250px' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Permeability Index Trend (Smoothed)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                <ReferenceLine y={60} stroke="var(--accent-green)" strokeDasharray="3 3" />
                <ReferenceLine y={40} stroke="var(--accent-red)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="pi" stroke="var(--accent-blue)" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Real-time Telemetry</h3>
            
            {data ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>CURRENT PI</div>
                  <div style={{ fontSize: '4rem', fontWeight: '800', lineHeight: '1', color: `var(--accent-${data.tier.toLowerCase()})` }}>
                    {data.smoothed_pi ?? data.pi}%
                  </div>
                  <div className={`status-badge status-${data.tier.toLowerCase()}`} style={{ marginTop: '1rem' }}>
                    {data.tier_emoji} {data.tier}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Flexible (Bikes/Autos)</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>{data.flexible}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(data.flexible / Math.max(data.total, 1)) * 100}%`, height: '100%', background: 'var(--accent-green)' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Rigid (Cars/Buses)</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-red)' }}>{data.rigid}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(data.rigid / Math.max(data.total, 1)) * 100}%`, height: '100%', background: 'var(--accent-red)' }}></div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border-color)' }}></div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <AlertTriangle size={20} color={`var(--accent-${data.tier.toLowerCase()})`} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>DISPATCHER ADVISORY</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{data.recommendation}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                Start capture to view telemetry.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
