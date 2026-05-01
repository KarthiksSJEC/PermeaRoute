import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, Camera, Video, Map, Route as RouteIcon, FileText, LayoutDashboard } from 'lucide-react';
import Home from './pages/Home';
import ImageAnalysis from './pages/ImageAnalysis';
import VideoAnalysis from './pages/VideoAnalysis';
import LiveStream from './pages/LiveStream';
import MapView from './pages/MapView';
import Planner from './pages/Planner';

function Sidebar() {
  const links = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/image', icon: <Camera size={20} />, label: 'Image Analysis' },
    { to: '/video', icon: <Video size={20} />, label: 'Video Analysis' },
    { to: '/live', icon: <Activity size={20} />, label: 'Live Stream' },
    { to: '/map', icon: <Map size={20} />, label: 'Map View' },
    { to: '/planner', icon: <RouteIcon size={20} />, label: 'Route Planner' },
  ];

  return (
    <div className="sidebar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🚑</span> PermeaRoute
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Ambulance Permeability Index
        </p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {links.map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to}
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--glow-green)' }}></div>
          Backend Online
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/image" element={<ImageAnalysis />} />
            <Route path="/video" element={<VideoAnalysis />} />
            <Route path="/live" element={<LiveStream />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/planner" element={<Planner />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
