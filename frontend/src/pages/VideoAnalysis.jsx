import React from 'react';
import { PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VideoAnalysis() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', textAlign: 'center' }}>
        <PlayCircle size={64} color="var(--accent-blue)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
        <h2 style={{ marginBottom: '1rem' }}>Video Analysis Mode</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
          For pre-recorded MP4/AVI videos, we recommend using the Live Stream screen capture mode 
          while playing the video in another window. This ensures maximum compatibility and real-time visualization.
        </p>
        <Link to="/live" className="btn btn-primary" style={{ width: '100%' }}>
          Go to Live Stream (Screen Capture)
        </Link>
      </div>
    </div>
  );
}
