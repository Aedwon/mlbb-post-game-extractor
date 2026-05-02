import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { HEROES } from '../constants/mlbbHeroes';
import { ROLES, ROLE_LABELS } from '../constants/mlbbRoles';
import { validateRoster } from '../utils/validateRoster';

export default function ReviewModal({
  data,
  playerAssignments,
  onAssignmentsChange,
  onConfirm,
  onCancel,
}) {
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const initial = {};
    data.forEach(item => {
      initial[item.id] = item.text;
    });
    setEditedData(initial);
  }, [data]);

  // Group OCR items by player_index
  const playerGroups = useMemo(() => {
    const groups = {};
    for (const item of data) {
      const idx = item.playerIndex;
      if (!groups[idx]) groups[idx] = [];
      groups[idx].push(item);
    }
    return groups;
  }, [data]);

  const playerIndexes = Array.from({ length: 10 }, (_, i) => i + 1);

  // Build a 10-player array for validation
  const rosterForValidation = useMemo(() => {
    return playerIndexes.map(idx => ({
      player_index: idx,
      hero: playerAssignments[idx]?.hero || '',
      role: playerAssignments[idx]?.role || '',
    }));
  }, [playerAssignments]);

  const validation = useMemo(() => validateRoster(rosterForValidation), [rosterForValidation]);

  const handleChange = (id, val) => {
    setEditedData(prev => ({ ...prev, [id]: val }));
  };

  const handleAssignmentChange = (playerIdx, field, value) => {
    onAssignmentsChange({
      ...playerAssignments,
      [playerIdx]: {
        ...playerAssignments[playerIdx],
        [field]: value,
      },
    });
  };

  const handleConfirm = () => {
    if (!validation.valid) return;
    onConfirm(editedData);
  };

  // Per-player error highlighting
  const errorsByField = useMemo(() => {
    const map = {};
    for (const err of validation.errors) {
      const heroMatch = err.match(/^Player (\d+) missing hero$/);
      const roleMatch = err.match(/^Player (\d+) missing role$/);
      const dupMatch = err.match(/^(Blue|Red) side has \d+x (\w+)$/);
      if (heroMatch) map[`hero_${heroMatch[1]}`] = err;
      if (roleMatch) map[`role_${roleMatch[1]}`] = err;
      if (dupMatch) {
        const sideKey = dupMatch[1].toLowerCase();
        const role = dupMatch[2];
        for (const p of rosterForValidation) {
          const pSide = p.player_index <= 5 ? 'blue' : 'red';
          if (pSide === sideKey && p.role === role) {
            map[`role_${p.player_index}`] = err;
          }
        }
      }
    }
    return map;
  }, [validation.errors, rosterForValidation]);

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
          // Compare image snippets with OCR output. Assign hero + role per player.
        </p>

        {!validation.valid && (
          <div className="validation-banner" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem', marginBottom: '1rem',
            background: 'rgba(255, 80, 80, 0.1)',
            border: '1px solid rgba(255, 80, 80, 0.4)',
            borderRadius: '4px',
          }}>
            <AlertCircle size={16} color="#ff5050" />
            <span style={{ fontSize: '0.85rem' }}>
              {validation.errors.length} issue(s) — fix to enable commit
            </span>
          </div>
        )}

        <div className="review-list">
          {playerIndexes.map(idx => {
            const items = playerGroups[idx] || [];
            const heroErr = errorsByField[`hero_${idx}`];
            const roleErr = errorsByField[`role_${idx}`];
            return (
              <div key={idx} className="review-player-block" style={{
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '1rem', marginBottom: '1rem',
              }}>
                <div style={{
                  display: 'flex', gap: '1rem', alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <label className={idx <= 5 ? 'text-blue' : 'text-red'} style={{ minWidth: '90px' }}>
                    PLAYER_{idx}
                  </label>
                  <div style={{ flex: 1 }}>
                    <input
                      list={`hero-list-${idx}`}
                      value={playerAssignments[idx]?.hero || ''}
                      onChange={e => handleAssignmentChange(idx, 'hero', e.target.value)}
                      placeholder="Hero"
                      autoComplete="off"
                      style={heroErr ? { borderColor: '#ff5050' } : {}}
                      title={heroErr || ''}
                    />
                    <datalist id={`hero-list-${idx}`}>
                      {HEROES.map(h => <option key={h} value={h} />)}
                    </datalist>
                  </div>
                  <select
                    value={playerAssignments[idx]?.role || ''}
                    onChange={e => handleAssignmentChange(idx, 'role', e.target.value)}
                    style={roleErr ? { borderColor: '#ff5050' } : {}}
                    title={roleErr || ''}
                  >
                    <option value="">Role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="player-stat-row" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.5rem',
                }}>
                  {items.map(item => (
                    <div key={item.id} className="review-input-group">
                      <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                        {item.label.toUpperCase()}
                      </label>
                      <input
                        type="text"
                        value={editedData[item.id] || ''}
                        onChange={e => handleChange(item.id, e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>DISCARD</button>
          <button
            className="btn btn-cyan"
            onClick={handleConfirm}
            disabled={!validation.valid}
            style={!validation.valid ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            title={!validation.valid ? validation.errors.join('; ') : ''}
          >
            <Check size={16} /> COMMIT_CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}
