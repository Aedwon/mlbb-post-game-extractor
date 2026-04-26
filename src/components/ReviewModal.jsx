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
      <div className="modal-content glass-panel">
        <header className="modal-header">
          <h2 className="text-gold">VERIFY_EXTRACTED_DATA</h2>
          <button className="btn-icon" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>
        
        <p className="subtitle">
          // Compare image snippets with OCR output. Correct discrepancies manually.
        </p>

        <div className="review-list">
          {data.map(item => (
            <div key={item.id} className="review-item">
              <div className="review-image-wrapper">
                <img src={item.imgDataUrl} alt={item.label} />
              </div>
              <div className="review-input-group">
                <label className={item.playerIndex <= 5 ? "text-blue" : "text-red"}>
                  PLAYER_{item.playerIndex} // {item.label.toUpperCase()}
                </label>
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

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>DISCARD</button>
          <button className="btn btn-cyan" onClick={handleConfirm}><Check size={16} /> COMMIT_CHANGES</button>
        </div>
      </div>
    </div>
  );
}
