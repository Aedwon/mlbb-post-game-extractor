import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
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

  const playerGroups = useMemo(() => {
    const groups = {};
    for (const item of data) {
      const idx = item.playerIndex;
      if (!groups[idx]) groups[idx] = [];
      groups[idx].push(item);
    }
    return groups;
  }, [data]);

  const matchItems = playerGroups[0] || [];
  const playerIndexes = Array.from({ length: 10 }, (_, i) => i + 1);

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

  const renderOCRField = (item) => (
    <div key={item.id} className="review-input-group">
      <label>{item.label.replace(/^\[[^\]]+\]\s*/, '')}</label>
      {item.imgDataUrl && (
        <div className="ocr-preview" title="Preprocessed crop used by OCR">
          <img src={item.imgDataUrl} alt="OCR crop" />
        </div>
      )}
      <input
        type="text"
        value={editedData[item.id] || ''}
        onChange={e => handleChange(item.id, e.target.value)}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <header className="modal-header">
          <div>
            <h2>Review extraction</h2>
            <span className="subtitle">Verify OCR values, then assign hero and role</span>
          </div>
          <button className="btn-icon" onClick={onCancel} aria-label="Close review">
            <X size={20} />
          </button>
        </header>

        <div className="review-modal__intro">
          <p className="subtitle">
            Preprocessed image strips show exactly what the OCR engine evaluated.
          </p>
          <span className={validation.valid ? 'text-blue' : 'text-muted'}>
            {validation.valid ? 'Roster complete' : `${validation.errors.length} roster issue(s)`}
          </span>
        </div>

        {!validation.valid && (
          <div className="validation-banner" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255, 80, 80, 0.08)',
            color: '#ff8a8a',
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.82rem' }}>
              Assign one hero and one unique role per player to enable commit.
            </span>
          </div>
        )}

        <div className="review-list">
          {matchItems.length > 0 && (
            <div className="review-player-block">
              <div className="review-player-header">
                <span className="review-player-label text-gold">MATCH</span>
                <span className="text-muted" style={{ gridColumn: 'span 2', fontSize: '0.82rem' }}>
                  Match-level values shared across all ten player rows
                </span>
              </div>
              <div className="player-stat-row">
                {matchItems.map(renderOCRField)}
              </div>
            </div>
          )}

          {playerIndexes.map(idx => {
            const items = playerGroups[idx] || [];
            const heroErr = errorsByField[`hero_${idx}`];
            const roleErr = errorsByField[`role_${idx}`];
            const isBlue = idx <= 5;

            return (
              <Fragment key={idx}>
                {(idx === 1 || idx === 6) && (
                  <div className={`review-player-label ${isBlue ? 'text-blue' : 'text-red'}`} style={{ margin: '1rem 0 0.55rem' }}>
                    {isBlue ? 'BLUE TEAM' : 'RED TEAM'}
                  </div>
                )}

                <div className="review-player-block">
                  <div className="review-player-header">
                    <span className={`review-player-label ${isBlue ? 'text-blue' : 'text-red'}`}>
                      Player {idx}
                    </span>

                    <div>
                      <input
                        list={`hero-list-${idx}`}
                        value={playerAssignments[idx]?.hero || ''}
                        onChange={e => handleAssignmentChange(idx, 'hero', e.target.value)}
                        placeholder="Select hero"
                        autoComplete="off"
                        style={heroErr ? { borderColor: '#ff5050' } : {}}
                        title={heroErr || ''}
                        aria-label={`Player ${idx} hero`}
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
                      aria-label={`Player ${idx} role`}
                    >
                      <option value="">Select role</option>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>

                  <div className="player-stat-row">
                    {items.map(renderOCRField)}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Discard</button>
          <button
            className="btn btn-cyan"
            onClick={handleConfirm}
            disabled={!validation.valid}
            title={!validation.valid ? validation.errors.join('; ') : ''}
          >
            <Check size={16} /> Commit match
          </button>
        </div>
      </div>
    </div>
  );
}
