import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export default function ReviewModal({ data, onConfirm, onCancel }) {
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const initial = {};
    data.forEach(item => {
      initial[item.id] = item.text;
    });
    setEditedData(initial);
  }, [data]);

  const handleChange = (id, val) => {
    setEditedData(prev => ({ ...prev, [id]: val }));
  };

  const handleConfirm = () => {
    onConfirm(editedData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 style={{ color: 'var(--color-cyan-glow)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Verify Extracted Data</span>
          <button style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer'}} onClick={onCancel}><X size={24} /></button>
        </h2>
        
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Compare the cropped image snippets with the extracted text. Correct any OCR mistakes below.
        </p>

        <div className="review-list">
          {data.map(item => (
            <div key={item.id} className="review-item">
              <div className="review-image-wrapper">
                <img src={item.imgDataUrl} alt={item.label} />
              </div>
              <div className="review-input-group">
                <label>P{item.playerIndex} - {item.label}</label>
                <input 
                  type="text" 
                  value={editedData[item.id] || ''} 
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-cyan" onClick={handleConfirm}><Check size={16} /> Confirm & Save</button>
        </div>
      </div>
    </div>
  );
}
