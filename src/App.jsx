import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Plus, Play, Download, Copy, Trash2, Crosshair, X, RefreshCcw } from 'lucide-react';
import Tesseract from 'tesseract.js';
import ReviewModal from './components/ReviewModal';
import DataTable from './components/DataTable';

const PRESET_DEFAULTS = {
  main: [
    { id: 'kills', label: 'Kills', x: 10, y: 10, width: 60, height: 250 },
    { id: 'deaths', label: 'Deaths', x: 80, y: 10, width: 60, height: 250 },
    { id: 'assists', label: 'Assists', x: 150, y: 10, width: 60, height: 250 },
    { id: 'gold', label: 'Gold', x: 220, y: 10, width: 80, height: 250 },
    { id: 'rating', label: 'Rating', x: 310, y: 10, width: 60, height: 250 }
  ],
  dps: [
    { id: 'hero_dmg', label: 'Hero Damage', x: 10, y: 10, width: 80, height: 250 },
    { id: 'consec_kills', label: 'Consecutive Kills', x: 100, y: 10, width: 80, height: 250 }
  ],
  team: [
    { id: 'teamfight', label: 'Teamfight', x: 10, y: 10, width: 80, height: 250 },
    { id: 'cc', label: 'Crowd Control', x: 100, y: 10, width: 80, height: 250 },
    { id: 'healing', label: 'Healing/Shields', x: 190, y: 10, width: 80, height: 250 },
    { id: 'dmg_taken', label: 'Damage Taken', x: 280, y: 10, width: 80, height: 250 }
  ],
  overall: [
    { id: 'hero_dmg_ov', label: 'Hero Damage', x: 10, y: 10, width: 80, height: 250 },
    { id: 'turret_dmg', label: 'Turret Damage', x: 100, y: 10, width: 80, height: 250 },
    { id: 'dmg_taken_ov', label: 'Damage Taken', x: 190, y: 10, width: 80, height: 250 },
    { id: 'teamfight_ov', label: 'Teamfight', x: 280, y: 10, width: 80, height: 250 }
  ],
  farm: [
    { id: 'total_gold', label: 'Total Gold', x: 10, y: 10, width: 80, height: 250 },
    { id: 'jungle_gold', label: 'Jungle Gold', x: 100, y: 10, width: 80, height: 250 },
    { id: 'kill_gold', label: 'Kill Gold', x: 190, y: 10, width: 80, height: 250 },
    { id: 'minion_gold', label: 'Minion Gold', x: 280, y: 10, width: 80, height: 250 }
  ]
};

function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [boxes, setBoxes] = useState([]);
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [savedRows, setSavedRows] = useState([]);
  const [activePreset, setActivePreset] = useState('main');
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageObjRef = useRef(null);

  // Load image
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageSrc(url);
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      imageObjRef.current = img;
      
      loadConfigForPreset(img.naturalWidth, img.naturalHeight, activePreset);
    };
    img.src = url;
  };

  const loadConfigForPreset = (width, height, preset) => {
    const configKey = `mlbb_config_${width}x${height}_${preset}`;
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      try {
        setBoxes(JSON.parse(savedConfig));
      } catch(e) {
        setBoxes(PRESET_DEFAULTS[preset]);
      }
    } else {
      setBoxes(PRESET_DEFAULTS[preset]);
    }
  };

  const handlePresetChange = (e) => {
    const newPreset = e.target.value;
    setActivePreset(newPreset);
    if (imageSize) {
      loadConfigForPreset(imageSize.width, imageSize.height, newPreset);
    }
  };

  // Draw image to canvas and calculate scale
  useEffect(() => {
    if (!imageSrc || !imageSize || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    
    // Set canvas display size to fit container width
    const containerWidth = container.clientWidth;
    const scale = containerWidth / imageSize.width;
    setDisplayScale(scale);
    
    // Actually draw full res to canvas
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${imageSize.height * scale}px`;
    
    ctx.drawImage(imageObjRef.current, 0, 0);
  }, [imageSrc, imageSize]);

  // Save config on box change
  useEffect(() => {
    if (!imageSize || boxes.length === 0) return;
    const configKey = `mlbb_config_${imageSize.width}x${imageSize.height}_${activePreset}`;
    localStorage.setItem(configKey, JSON.stringify(boxes));
  }, [boxes, imageSize, activePreset]);

  // Mouse interaction for boxes (simplified)
  const handleMouseDown = (e, box, action) => {
    e.stopPropagation();
    setActiveBoxId(box.id);
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / displayScale;
    const y = (e.clientY - rect.top) / displayScale;
    
    if (action === 'move') {
      setIsDragging(true);
      setDragOffset({ x: x - box.x, y: y - box.y });
    } else if (action === 'resize') {
      setIsResizing(true);
      setDragOffset({ x, y });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !isResizing) return;
    if (!activeBoxId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / displayScale;
    const y = (e.clientY - rect.top) / displayScale;
    
    setBoxes(prev => prev.map(b => {
      if (b.id !== activeBoxId) return b;
      
      if (isDragging) {
        return {
          ...b,
          x: Math.max(0, Math.min(x - dragOffset.x, imageSize.width - b.width)),
          y: Math.max(0, Math.min(y - dragOffset.y, imageSize.height - b.height))
        };
      } else if (isResizing) {
        return {
          ...b,
          width: Math.max(20, x - b.x),
          height: Math.max(20, y - b.y)
        };
      }
      return b;
    }));
  }, [isDragging, isResizing, activeBoxId, displayScale, dragOffset, imageSize]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);

  const addBox = () => {
    const label = prompt("Enter stat name (e.g., Kills):", "New Stat");
    if (!label) return;
    
    const newBox = {
      id: Date.now().toString(),
      label,
      x: 50, y: 50, width: 80, height: 40
    };
    setBoxes([...boxes, newBox]);
    setActiveBoxId(newBox.id);
  };

  const removeBox = () => {
    if (!activeBoxId) return;
    setBoxes(boxes.filter(b => b.id !== activeBoxId));
    setActiveBoxId(null);
  };

  const resetConfig = () => {
    if (!confirm("Are you sure you want to reset all boxes to the default layout?")) return;
    setBoxes(PRESET_DEFAULTS[activePreset]);
  };

  const processOCR = async () => {
    if (!imageObjRef.current || boxes.length === 0) return;
    setIsProcessing(true);
    
    const results = [];
    
    try {
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789./%',
      });
      
      for (const box of boxes) {
        const sliceHeight = box.height / 5;
        const isLeftTeam = box.x < (imageSize.width / 2);
        
        for (let i = 0; i < 5; i++) {
          const offCanvas = document.createElement('canvas');
          const pad = 4;
          offCanvas.width = box.width + pad*2;
          offCanvas.height = sliceHeight + pad*2;
          const ctx = offCanvas.getContext('2d');
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
          
          ctx.drawImage(
            imageObjRef.current,
            Math.max(0, box.x - pad), Math.max(0, box.y + (sliceHeight * i) - pad),
            box.width + pad*2, sliceHeight + pad*2,
            0, 0,
            box.width + pad*2, sliceHeight + pad*2
          );
          
          const dataUrl = offCanvas.toDataURL('image/png');
          const { data: { text } } = await worker.recognize(dataUrl);
          
          const playerIndex = isLeftTeam ? (i + 1) : (i + 6);
          
          results.push({
            id: `${box.id}_p${playerIndex}`,
            boxId: box.id,
            label: box.label,
            playerIndex,
            text: text.trim().replace(/[^0-9./%]/g, ''),
            imgDataUrl: dataUrl
          });
        }
      }
      
      await worker.terminate();
      
      results.sort((a, b) => a.playerIndex - b.playerIndex);
      setReviewData(results);
    } catch (err) {
      console.error(err);
      alert("OCR Processing failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewConfirm = (finalData) => {
    setSavedRows(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      data: finalData
    }]);
    setReviewData(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title-glow">MLBB Stat Extractor</h1>
        <p className="subtitle">On-Device OCR Engine</p>
      </header>

      <div className="glass-panel">
        {!imageSrc ? (
          <div className="upload-area" onClick={() => document.getElementById('file-upload').click()}>
            <Upload size={48} color="var(--color-cyan-glow)" style={{ marginBottom: '1rem' }} />
            <h3>Upload Post-Game Screenshot</h3>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Drag & drop or click to select</p>
            <input 
              id="file-upload" 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select 
                  value={activePreset} 
                  onChange={handlePresetChange}
                  style={{
                    background: 'var(--color-bg-deep)', color: 'var(--color-cyan-glow)',
                    border: '1px solid var(--color-cyan-glow)', padding: '0.6rem 1rem',
                    borderRadius: '4px', fontFamily: 'var(--font-display)', cursor: 'pointer'
                  }}
                >
                  <option value="main">Main Tab</option>
                  <option value="dps">DPS Tab</option>
                  <option value="team">Team Tab</option>
                  <option value="overall">Overall Tab</option>
                  <option value="farm">Farm Tab</option>
                </select>
                <button className="btn btn-cyan" onClick={addBox}><Plus size={16} /> Add Box</button>
                <button className="btn" onClick={removeBox} disabled={!activeBoxId}><Trash2 size={16} /> Remove Selected</button>
                <button className="btn" onClick={resetConfig}><RefreshCcw size={16} /> Reset Config</button>
              </div>
              <button className="btn btn-cyan" onClick={processOCR} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : <><Play size={16} /> Run OCR</>}
              </button>
            </div>
            
            <div 
              ref={containerRef} 
              className="canvas-container" 
              style={{ minHeight: '300px' }}
              onClick={() => setActiveBoxId(null)}
            >
              <canvas ref={canvasRef} />
              
              {boxes.map((box) => (
                <div
                  key={box.id}
                  className={`bounding-box ${activeBoxId === box.id ? 'active' : ''}`}
                  style={{
                    left: `${box.x * displayScale}px`,
                    top: `${box.y * displayScale}px`,
                    width: `${box.width * displayScale}px`,
                    height: `${box.height * displayScale}px`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, box, 'move')}
                >
                  <div className="bounding-box-label">{box.label}</div>
                  
                  {/* Visual dividers for the 5 slices */}
                  <div style={{ position: 'absolute', top: '20%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', top: '40%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', top: '60%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', top: '80%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                  
                  <div 
                    className="resize-handle"
                    onMouseDown={(e) => handleMouseDown(e, box, 'resize')}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Resolution: {imageSize?.width}x{imageSize?.height}. Config automatically saved for <strong>{activePreset.toUpperCase()}</strong> preset.
            </p>
            <button className="btn" style={{alignSelf: 'center'}} onClick={() => { setImageSrc(null); setBoxes([]); }}>Upload Different Image</button>
          </div>
        )}
      </div>

      {savedRows.length > 0 && (
        <div className="glass-panel">
          <h2 style={{ color: 'var(--color-gold-glow)', marginBottom: '1rem' }}>Extracted Data</h2>
          <DataTable rows={savedRows} boxes={boxes} />
        </div>
      )}

      {reviewData && (
        <ReviewModal 
          data={reviewData} 
          onConfirm={handleReviewConfirm} 
          onCancel={() => setReviewData(null)} 
        />
      )}
    </div>
  );
}

export default App;
