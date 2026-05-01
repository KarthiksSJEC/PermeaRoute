import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';

export default function ImageAnalysis() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    setAnalyzing(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('confidence', '0.35');

    try {
      // Assuming FastAPI is running on port 8000
      const response = await fetch('http://localhost:8000/analyze/image', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Is the backend running?");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Static Image Analysis</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!preview ? (
            <div 
              className="upload-area glass-panel" 
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem' }} />
              <h3>Upload Traffic Image</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Drag and drop or click to browse</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
          ) : (
            <div className="glass-panel" style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: '500' }}>Preview</span>
                <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => {setPreview(null); setFile(null); setResult(null);}}>Clear</button>
              </div>
              <div style={{ flex: 1, background: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img src={result ? result.image : preview} alt="Traffic" style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Controls</h3>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem' }} 
              onClick={handleAnalyze}
              disabled={!file || analyzing}
            >
              {analyzing ? 'Analyzing with YOLOv11...' : 'Run Analysis'}
            </button>
          </div>

          {result && result.pi_result && (
            <div className={`glass-card`} style={{ padding: '1.5rem', borderTop: `4px solid var(--accent-${result.pi_result.tier.toLowerCase()})` }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Permeability Index</div>
                <div style={{ fontSize: '3.5rem', fontWeight: '800', lineHeight: '1.1', color: `var(--accent-${result.pi_result.tier.toLowerCase()})` }}>
                  {result.pi_result.pi}%
                </div>
                <div className={`status-badge status-${result.pi_result.tier.toLowerCase()}`} style={{ marginTop: '0.5rem' }}>
                  {result.pi_result.tier_emoji} {result.pi_result.tier}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>🟢 Flexible Vehicles:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.pi_result.flexible}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>🔴 Rigid Vehicles:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.pi_result.rigid}</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Detected:</span>
                  <span style={{ fontWeight: 'bold' }}>{result.pi_result.total}</span>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Recommendation</div>
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>{result.pi_result.recommendation}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
