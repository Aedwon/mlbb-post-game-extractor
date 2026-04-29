import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Plus, Play, Download, Copy, Trash2, Crosshair, X, RefreshCcw, GripVertical } from 'lucide-react';
import Tesseract from 'tesseract.js';
import ReviewModal from './components/ReviewModal';
import DataTable from './components/DataTable';
import { useDragReorder } from './hooks/useDragReorder';

// Default reference width for mirroring (typical MLBB screenshot)
const DEFAULT_IMG_WIDTH = 1920;

const BASE_PRESETS = {
  main: [
    { id: 'battle_id', label: 'Battle ID', x: 20, y: 700, width: 250, height: 40, type: 'header' },
    { id: 'kills', label: 'Kills', x: 400, y: 350, width: 40, height: 400 },
    { id: 'deaths', label: 'Deaths', x: 450, y: 350, width: 40, height: 400 },
    { id: 'assists', label: 'Assists', x: 500, y: 350, width: 40, height: 400 },
    { id: 'gold', label: 'Gold', x: 550, y: 350, width: 80, height: 400 },
    { id: 'rating', label: 'Rating', x: 650, y: 350, width: 60, height: 400 }
  ],
  dps: [
    { id: 'hero_dmg', label: 'Hero Damage', x: 400, y: 350, width: 100, height: 400 },
    { id: 'consec_kills', label: 'Consecutive Kills', x: 550, y: 350, width: 100, height: 400 }
  ],
  team: [
    { id: 'teamfight', label: 'Teamfight', x: 400, y: 350, width: 100, height: 400 },
    { id: 'cc', label: 'Crowd Control', x: 550, y: 350, width: 100, height: 400 },
    { id: 'healing', label: 'Healing/Shields', x: 700, y: 350, width: 100, height: 400 },
    { id: 'dmg_taken', label: 'Damage Taken', x: 850, y: 350, width: 100, height: 400 }
  ],
  overall: [
    { id: 'hero_dmg_ov', label: 'Overall Hero Dmg', x: 400, y: 350, width: 100, height: 400 },
    { id: 'turret_dmg', label: 'Turret Damage', x: 550, y: 350, width: 100, height: 400 },
    { id: 'dmg_taken_ov', label: 'Overall Dmg Taken', x: 700, y: 350, width: 100, height: 400 },
    { id: 'teamfight_ov', label: 'Overall Teamfight', x: 850, y: 350, width: 100, height: 400 }
  ],
  farm: [
    { id: 'total_gold', label: 'Total Gold', x: 400, y: 350, width: 100, height: 400 },
    { id: 'jungle_gold', label: 'Jungle Gold', x: 550, y: 350, width: 100, height: 400 },
    { id: 'kill_gold', label: 'Kill Gold', x: 700, y: 350, width: 100, height: 400 },
    { id: 'minion_gold', label: 'Minion Gold', x: 850, y: 350, width: 100, height: 400 }
  ]
};

const generateDefaults = (presets, imgWidth = DEFAULT_IMG_WIDTH) => {
  const result = {};
  for (const [presetName, boxes] of Object.entries(presets)) {
    const finalBoxes = [];
    for (const box of boxes) {
      if (box.type === 'header') {
        finalBoxes.push(box);
      } else {
        finalBoxes.push({ ...box, team: 'blue' });
        // Mirror the x-position across the image center axis.
        // In MLBB, the red team's columns are in reverse order (mirrored).
        const mirroredX = imgWidth - box.x - box.width;
        finalBoxes.push({
          ...box,
          id: box.id + '_red',
          x: mirroredX,
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

const sanitizeOCR = (text) => {
  // Split into potential value tokens
  const tokens = text.split(/\s+/).filter(t => t.trim().length > 0);
  
  const isPercent = (t) => /%\s*$/.test(t) || /^\s*%/.test(t) || t.includes('%');
  
  const percentTokens = tokens.filter(isPercent);
  const nonPercentTokens = tokens.filter(t => !isPercent(t));
  
  let result;
  if (nonPercentTokens.length > 0) {
    // If we have non-percentage values, prioritize them
    result = nonPercentTokens.join(' ');
  } else {
    // If only percentages exist (like Teamfight %), keep them
    result = tokens.join(' ');
  }

  // Keep numbers, dots, slashes, K/M multipliers, and % (if it was preserved), plus spaces
  return result.replace(/[^0-9./KkMm%\s]/g, '').replace(/\s+/g, ' ').trim();
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

  // Drag-to-reorder for batch gallery thumbnails (purely visual)
  const {
    isDragging: isThumbDragging,
    dragIndex: thumbDragIndex,
    overIndex: thumbOverIndex,
    ghost: thumbGhost,
    setItemRef: setThumbRef,
    getItemStyle: getThumbStyle,
    getItemProps: getThumbDragProps,
  } = useDragReorder({
    itemCount: uploadedImages.length,
    onReorder: (fromIndex, toIndex) => {
      setUploadedImages(prev => {
        const next = [...prev];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      });
    },
  });

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
    canvas.style.display = 'block';
    
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

      // Find the center axis of the image for symmetry mirroring
      const centerX = imageSize.width / 2;

      return prev.map(b => {
        if (b.id === activeBoxId) {
          if (isDragging) return { ...b, x: newX, y: newY };
          if (isResizing) return { ...b, width: newWidth, height: newHeight };
        }
        
        // Symmetry Lock mirroring logic
        if (symmetryLock && b.type !== 'header') {
           // Find the sister box: blue <-> red pairs
           const baseId = activeBox.id.replace('_red', '');
           const sisterBaseId = b.id.replace('_red', '');
           const isSisterBox = (baseId === sisterBaseId) && (b.id !== activeBox.id);
             
           if (isSisterBox) {
              if (isDragging) {
                // Mirror the x position across the center axis
                // If blue box left edge is at distance D from center, red box left edge should be
                // at center + (center - blueLeftEdge - blueWidth) = imageWidth - newX - activeBox.width
                const mirroredX = imageSize.width - newX - activeBox.width;
                return { ...b, y: newY, x: mirroredX, width: activeBox.width, height: activeBox.height };
              }
              if (isResizing) {
                // Mirror the resize: keep the box anchored at its mirrored position
                const mirroredX = imageSize.width - activeBox.x - newWidth;
                return { ...b, width: newWidth, height: newHeight, x: mirroredX };
              }
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
    
    // Sync the current preset's boxes into presetConfigs before processing
    const currentConfigs = { ...presetConfigs, [activePreset]: boxes };
    setPresetConfigs(currentConfigs);
    
    const results = [];
    
    try {
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789./%',
      });

      // --- Battle ID Verification Pass ---
      const mainConfig = activePreset === 'main' ? boxes : currentConfigs.main;
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
        const configBoxes = currentConfigs[imgData.preset];
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
                   text: sanitizeOCR(text),
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
              text: sanitizeOCR(text),
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
          const fieldId = box.id.replace('_red', '');
          if (box.type === 'header') {
            row[fieldId] = finalData[box.id] || '';
          } else {
            // Merge blue and red into the same field
            const value = finalData[`${box.id}_p${p}`];
            if (value !== undefined) {
              row[fieldId] = value;
            }
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
        <h1 className="title-glow">MLBB <span>STAT</span> EXTRACTOR</h1>
        <p className="subtitle">// BATCH EXTRACTION TERMINAL v2.0</p>
      </header>

      <div className="glass-panel">
        {uploadedImages.length === 0 ? (
          <div className="upload-area" onClick={() => document.getElementById('file-upload').click()}>
            <Upload size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
            <h3>INITIALIZE BATCH UPLOAD</h3>
            <p className="subtitle" style={{ marginTop: '0.5rem' }}>Drop screenshots or click to browse</p>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Batch Gallery UI */}
            <div className={`batch-gallery ${isThumbDragging ? 'is-reordering' : ''}`}>
              {uploadedImages.map((imgData, idx) => (
                 <div key={imgData.id}
                      ref={(el) => setThumbRef(idx, el)}
                      onClick={() => {
                         // Only fire click if not dragging
                         if (isThumbDragging) return;
                         setPresetConfigs(prev => ({ ...prev, [activePreset]: boxes }));
                         setActiveImageId(imgData.id);
                         setActivePreset(imgData.preset);
                         setBoxes(presetConfigs[imgData.preset]);
                      }}
                      className={`thumbnail-container ${activeImageId === imgData.id ? 'active-thumb' : ''} ${thumbDragIndex === idx ? 'drag-placeholder' : ''}`}
                      style={getThumbStyle(idx)}
                      {...getThumbDragProps(idx)}
                 >
                    <div className="thumb-drag-handle" title="Drag to reorder">
                       <GripVertical size={14} />
                    </div>
                    <button 
                       className="thumb-delete-btn"
                       onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Remove this screenshot from the batch?")) {
                             setUploadedImages(prev => prev.filter(img => img.id !== imgData.id));
                             if (activeImageId === imgData.id) {
                                setActiveImageId(null);
                                setBoxes([]);
                             }
                          }
                       }}
                       title="Remove Image"
                    >
                       <Trash2 size={12} />
                    </button>
                    <img src={imgData.url} alt="thumb" style={{ height: '80px', objectFit: 'contain', pointerEvents: 'none' }} />
                    <select 
                       value={imgData.preset} 
                       className={`thumbnail-select ${duplicateTabs.includes(imgData.preset) ? 'error' : ''}`}
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
                    >
                      <option value="main">Main Tab</option>
                      <option value="dps">DPS Tab</option>
                      <option value="team">Team Tab</option>
                      <option value="overall">Overall Tab</option>
                      <option value="farm">Farm Tab</option>
                    </select>
                 </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '1px dashed var(--color-border)', cursor: 'pointer', minWidth: '160px' }} onClick={() => document.getElementById('file-upload').click()}>
                 <Plus size={32} color="var(--color-text-muted)" />
              </div>
            </div>

            {/* Drag ghost overlay */}
            {isThumbDragging && thumbDragIndex !== -1 && uploadedImages[thumbDragIndex] && (
              <div
                className="drag-ghost"
                style={{
                  left: `${thumbGhost.x}px`,
                  top: `${thumbGhost.y}px`,
                  width: `${thumbGhost.width}px`,
                  height: `${thumbGhost.height}px`,
                }}
              >
                <img src={uploadedImages[thumbDragIndex].url} alt="drag" style={{ height: '80px', objectFit: 'contain', pointerEvents: 'none' }} />
                <span className="drag-ghost-label">{uploadedImages[thumbDragIndex].preset.toUpperCase()} TAB</span>
              </div>
            )}

            {hasDuplicates && (
              <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--color-mlbb-red)', background: 'rgba(255, 0, 60, 0.05)', color: 'var(--color-mlbb-red)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 'bold' }}>! CRITICAL_ERROR:</span> DUPLICATE_TABS_DETECTED // PLEASE_ASSIGN_UNIQUE_TYPES
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="subtitle" style={{ fontSize: '0.8rem', color: 'var(--color-gold-glow)' }}>[ {activePreset.toUpperCase()}_CONFIGURATION ]</span>
                <button className="btn" onClick={addBox}><Plus size={16} /> ADD_SLOT</button>
                <button className="btn" onClick={removeBox} disabled={!activeBoxId}><Trash2 size={16} /> DELETE_ACTIVE</button>
                <button className="btn" onClick={resetConfig}><RefreshCcw size={16} /> RESET</button>
                
                <label className="custom-toggle">
                  <input type="checkbox" checked={symmetryLock} onChange={(e) => setSymmetryLock(e.target.checked)} />
                  <div className="toggle-indicator"></div>
                  <span className="toggle-text">SYMMETRY LOCK</span>
                </label>
              </div>
              <button className="btn btn-cyan" onClick={processOCR} disabled={isProcessing || hasDuplicates}>
                {isProcessing ? 'SCANNING...' : <><Play size={16} /> INITIALIZE BATCH OCR</>}
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
                  <div className="bounding-box-label">{box.label}</div>
                  
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
            <p className="subtitle" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
              IMAGE_DIMENSIONS: {imageSize?.width}x{imageSize?.height} // AUTOSAVE_STATUS: ACTIVE
            </p>
            <button className="btn" style={{ margin: '0 auto' }} onClick={() => { 
              if (window.confirm("Are you sure you want to clear all uploads and reset the current batch?")) {
                setUploadedImages([]); setActiveImageId(null); setBoxes([]); 
              }
            }}>TERMINATE BATCH</button>
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
