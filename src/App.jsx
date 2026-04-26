import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Plus, Play, Download, Copy, Trash2, Crosshair, X, RefreshCcw } from 'lucide-react';
import Tesseract from 'tesseract.js';
import ReviewModal from './components/ReviewModal';
import DataTable from './components/DataTable';

const BASE_PRESETS = {
  main: [
    { id: 'battle_id', label: 'Battle ID', x: 20, y: 700, width: 250, height: 40, type: 'header' },
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

const generateDefaults = (presets) => {
  const result = {};
  for (const [presetName, boxes] of Object.entries(presets)) {
    const finalBoxes = [];
    for (const box of boxes) {
      if (box.type === 'header') {
        finalBoxes.push(box);
      } else {
        finalBoxes.push({ ...box, team: 'blue' });
        finalBoxes.push({
          ...box,
          id: box.id + '_red',
          x: box.x + 1300,
          team: 'red'
        });
      }
    }
    result[presetName] = finalBoxes;
  }
  return result;
};

const PRESET_DEFAULTS = generateDefaults(BASE_PRESETS);

const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }
  return matrix[a.length][b.length];
};

function App() {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);
  
  const [presetConfigs, setPresetConfigs] = useState(PRESET_DEFAULTS);
  
  const activeImgData = uploadedImages.find(img => img.id === activeImageId);
  const imageSrc = activeImgData?.url;
  const imageSize = activeImgData ? { width: activeImgData.width, height: activeImgData.height } : null;
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
  const [symmetryLock, setSymmetryLock] = useState(true);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageObjRef = useRef(null);

  useEffect(() => {
    if (activeImgData) {
      imageObjRef.current = activeImgData.imgObj;
    }
  }, [activeImgData]);

  // Load image
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const availablePresets = ['main', 'dps', 'team', 'overall', 'farm'];
    
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setUploadedImages(prev => {
          const usedPresets = prev.map(p => p.preset);
          const nextPreset = availablePresets.find(p => !usedPresets.includes(p)) || 'main';
          
          const newImg = {
            id: Date.now().toString() + index + Math.random(),
            url,
            width: img.naturalWidth,
            height: img.naturalHeight,
            imgObj: img,
            preset: nextPreset,
            file
          };
          
          const newList = [...prev, newImg];
          if (newList.length === 1 && prev.length === 0) {
             setActiveImageId(newImg.id);
             setActivePreset(nextPreset);
             loadConfigForPreset(img.naturalWidth, img.naturalHeight, nextPreset);
          }
          return newList;
        });
      };
      img.src = url;
    });
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
    setPresetConfigs(prev => ({ ...prev, [activePreset]: boxes }));
    setActivePreset(newPreset);
    if (presetConfigs[newPreset]) {
      setBoxes(presetConfigs[newPreset]);
    } else {
      if (imageSize) {
        loadConfigForPreset(imageSize.width, imageSize.height, newPreset);
      }
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
    
    setBoxes(prev => {
      const activeBox = prev.find(b => b.id === activeBoxId);
      if (!activeBox) return prev;
      
      const newX = Math.max(0, Math.min(x - dragOffset.x, imageSize.width - activeBox.width));
      const newY = Math.max(0, Math.min(y - dragOffset.y, imageSize.height - activeBox.height));
      const newWidth = Math.max(20, x - activeBox.x);
      const newHeight = Math.max(20, y - activeBox.y);

      return prev.map(b => {
        if (b.id === activeBoxId) {
          if (isDragging) return { ...b, x: newX, y: newY };
          if (isResizing) return { ...b, width: newWidth, height: newHeight };
        }
        
        // Symmetry Lock mirroring logic
        if (symmetryLock && b.type !== 'header') {
           const isSisterBox = 
             (activeBox.team === 'blue' && b.id === activeBox.id + '_red') ||
             (activeBox.team === 'red' && activeBox.id === b.id + '_red');
             
           if (isSisterBox) {
              if (isDragging) return { ...b, y: newY }; // Match vertical pos exactly
              if (isResizing) return { ...b, width: newWidth, height: newHeight }; // Match size exactly
           }
        }
        
        return b;
      });
    });
  }, [isDragging, isResizing, activeBoxId, displayScale, dragOffset, imageSize, symmetryLock]);

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
    if (!imageObjRef.current || boxes.length === 0 || uploadedImages.length === 0) return;
    setIsProcessing(true);
    
    const results = [];
    
    try {
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789./%',
      });

      // --- Battle ID Verification Pass ---
      const mainConfig = activePreset === 'main' ? boxes : presetConfigs.main;
      const battleIdBox = mainConfig.find(b => b.id === 'battle_id');
      
      if (battleIdBox) {
         let referenceId = null;
         for (const imgData of uploadedImages) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = battleIdBox.width;
            offCanvas.height = battleIdBox.height;
            const ctx = offCanvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            ctx.drawImage(
               imgData.imgObj,
               battleIdBox.x, battleIdBox.y,
               battleIdBox.width, battleIdBox.height,
               0, 0,
               battleIdBox.width, battleIdBox.height
            );
            const { data: { text } } = await worker.recognize(offCanvas.toDataURL('image/png'));
            const extractedId = text.trim().replace(/[^0-9]/g, '');
            
            if (extractedId.length > 5) {
                if (!referenceId) {
                   referenceId = extractedId;
                } else {
                   const dist = levenshtein(referenceId, extractedId);
                   if (dist > 3) {
                      alert(`Battle ID mismatch detected!\nExpected: ${referenceId}\nFound: ${extractedId} (in ${imgData.preset} tab)\n\nPlease ensure all screenshots are from the same match.`);
                      await worker.terminate();
                      setIsProcessing(false);
                      return;
                   }
                }
            }
         }
      }
      
      const allResults = [];

      for (const imgData of uploadedImages) {
        const configBoxes = presetConfigs[imgData.preset];
        if (!configBoxes || configBoxes.length === 0) continue;

        for (const box of configBoxes) {
          if (box.type === 'header') {
             // Standard 1-to-1 extraction for header boxes
             const offCanvas = document.createElement('canvas');
             offCanvas.width = box.width;
             offCanvas.height = box.height;
             const ctx = offCanvas.getContext('2d');
             ctx.fillStyle = 'white';
             ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
             ctx.drawImage(
                imgData.imgObj,
                box.x, box.y, box.width, box.height,
                0, 0, box.width, box.height
             );
             const { data: { text } } = await worker.recognize(offCanvas.toDataURL('image/png'));
             
             // Prevent pushing duplicate header entries from multiple images (e.g. Battle ID)
             if (!allResults.some(r => r.id === box.id)) {
                 allResults.push({
                   id: box.id,
                   boxId: box.id,
                   label: box.label,
                   playerIndex: 0,
                   text: text.replace(/[^0-9./%\s]/g, '').replace(/\s+/g, ' ').trim(),
                   imgDataUrl: offCanvas.toDataURL('image/png')
                 });
             }
             continue;
          }

          const sliceHeight = box.height / 5;
          const isLeftTeam = box.x < (imgData.width / 2);
          
          for (let i = 0; i < 5; i++) {
            const offCanvas = document.createElement('canvas');
            const pad = 4;
            offCanvas.width = box.width + pad*2;
            offCanvas.height = sliceHeight + pad*2;
            const ctx = offCanvas.getContext('2d');
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            
            ctx.drawImage(
              imgData.imgObj,
              Math.max(0, box.x - pad), Math.max(0, box.y + (sliceHeight * i) - pad),
              box.width + pad*2, sliceHeight + pad*2,
              0, 0,
              box.width + pad*2, sliceHeight + pad*2
            );
            
            const dataUrl = offCanvas.toDataURL('image/png');
            const { data: { text } } = await worker.recognize(dataUrl);
            
            const playerIndex = isLeftTeam ? (i + 1) : (i + 6);
            
            allResults.push({
              id: `${box.id}_p${playerIndex}`,
              boxId: box.id,
              label: `[${imgData.preset.toUpperCase()}] ${box.label}`,
              playerIndex,
              text: text.replace(/[^0-9./%\s]/g, '').replace(/\s+/g, ' ').trim(),
              imgDataUrl: dataUrl
            });
          }
        }
      }
      
      await worker.terminate();
      
      allResults.sort((a, b) => a.playerIndex - b.playerIndex);
      setReviewData(allResults);
    } catch (err) {
      console.error(err);
      alert("OCR Processing failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewConfirm = (finalData) => {
    const playerRows = [];
    for (let p = 1; p <= 10; p++) {
      const row = { playerIndex: p };
      Object.keys(presetConfigs).forEach(preset => {
        presetConfigs[preset].forEach(box => {
          if (box.type === 'header') {
            row[box.id] = finalData[box.id] || '';
          } else {
            row[box.id] = finalData[`${box.id}_p${p}`] || '';
          }
        });
      });
      playerRows.push(row);
    }
    
    setSavedRows(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      data: playerRows,
      columns: Object.values(presetConfigs).flat()
    }]);
    setReviewData(null);
  };

  const duplicateTabs = uploadedImages.filter((img, i, arr) => arr.findIndex(img2 => img2.preset === img.preset) !== i).map(img => img.preset);
  const hasDuplicates = duplicateTabs.length > 0;

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title-glow">MLBB Stat Extractor</h1>
        <p className="subtitle">Batch Upload Mode (10-Player Extraction)</p>
      </header>

      <div className="glass-panel">
        {uploadedImages.length === 0 ? (
          <div className="upload-area" onClick={() => document.getElementById('file-upload').click()}>
            <Upload size={48} color="var(--color-cyan-glow)" style={{ marginBottom: '1rem' }} />
            <h3>Upload Post-Game Screenshots</h3>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Select up to 5 tabs from the same match</p>
            <input 
              id="file-upload" 
              type="file" 
              accept="image/*" 
              multiple
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Batch Gallery UI */}
            <div className="batch-gallery" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {uploadedImages.map(imgData => (
                 <div key={imgData.id} 
                      onClick={() => {
                         setPresetConfigs(prev => ({ ...prev, [activePreset]: boxes }));
                         setActiveImageId(imgData.id);
                         setActivePreset(imgData.preset);
                         setBoxes(presetConfigs[imgData.preset]);
                      }}
                      style={{ 
                         cursor: 'pointer',
                         padding: '0.5rem',
                         border: activeImageId === imgData.id ? '2px solid var(--color-cyan-glow)' : '2px solid transparent',
                         borderRadius: '8px',
                         background: 'var(--color-bg-deep)',
                         minWidth: '150px',
                         display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center'
                      }}>
                    <img src={imgData.url} alt="thumb" style={{ height: '80px', objectFit: 'contain' }} />
                    <select 
                       value={imgData.preset} 
                       onClick={(e) => e.stopPropagation()}
                       onChange={(e) => {
                          const val = e.target.value;
                          setUploadedImages(prev => prev.map(p => p.id === imgData.id ? { ...p, preset: val } : p));
                          if (activeImageId === imgData.id) {
                             setPresetConfigs(prev => ({ ...prev, [activePreset]: boxes }));
                             setActivePreset(val);
                             setBoxes(presetConfigs[val]);
                          }
                       }}
                       style={{ background: 'transparent', color: duplicateTabs.includes(imgData.preset) ? '#ff4a4a' : 'var(--color-gold-glow)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.2rem' }}
                    >
                      <option value="main">Main Tab</option>
                      <option value="dps">DPS Tab</option>
                      <option value="team">Team Tab</option>
                      <option value="overall">Overall Tab</option>
                      <option value="farm">Farm Tab</option>
                    </select>
                 </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', minWidth: '100px' }} onClick={() => document.getElementById('file-upload').click()}>
                 <Plus size={24} color="var(--color-text-muted)" />
              </div>
            </div>

            {hasDuplicates && (
              <div style={{ padding: '0.5rem', background: 'rgba(255, 74, 74, 0.2)', color: '#ff4a4a', borderRadius: '4px', textAlign: 'center' }}>
                Warning: Duplicate tabs selected. Please assign a unique tab to each screenshot.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{color: 'var(--color-gold-glow)', fontWeight: 'bold'}}>{activePreset.toUpperCase()} TAB CONFIG</span>
                <button className="btn btn-cyan" onClick={addBox}><Plus size={16} /> Add Box</button>
                <button className="btn" onClick={removeBox} disabled={!activeBoxId}><Trash2 size={16} /> Remove Selected</button>
                <button className="btn" onClick={resetConfig}><RefreshCcw size={16} /> Reset Config</button>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', border: '1px solid var(--color-border)', borderRadius: '4px', color: symmetryLock ? 'var(--color-gold-glow)' : 'var(--color-text-muted)' }}>
                  <input type="checkbox" checked={symmetryLock} onChange={(e) => setSymmetryLock(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Symmetry Lock</span>
                </label>
              </div>
              <button className="btn btn-cyan" onClick={processOCR} disabled={isProcessing || hasDuplicates}>
                {isProcessing ? 'Processing...' : <><Play size={16} /> Run Batch OCR (All Tabs)</>}
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
                  className={`bounding-box ${activeBoxId === box.id ? 'active' : ''} ${box.team === 'blue' ? 'team-blue' : box.team === 'red' ? 'team-red' : ''}`}
                  style={{
                    left: `${box.x * displayScale}px`,
                    top: `${box.y * displayScale}px`,
                    width: `${box.width * displayScale}px`,
                    height: `${box.height * displayScale}px`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, box, 'move')}
                >
                  <div className="bounding-box-label">{box.label} {box.team === 'red' ? '(Red)' : box.team === 'blue' ? '(Blue)' : ''}</div>
                  
                  {/* Visual dividers for the 5 slices (only if not a header) */}
                  {box.type !== 'header' && (
                    <>
                      <div style={{ position: 'absolute', top: '20%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                      <div style={{ position: 'absolute', top: '40%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                      <div style={{ position: 'absolute', top: '60%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                      <div style={{ position: 'absolute', top: '80%', left: 0, width: '100%', borderTop: '1px dashed rgba(255,255,255,0.3)' }} />
                    </>
                  )}
                  
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
            <button className="btn" style={{alignSelf: 'center'}} onClick={() => { setUploadedImages([]); setActiveImageId(null); setBoxes([]); }}>Clear All Uploads</button>
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
