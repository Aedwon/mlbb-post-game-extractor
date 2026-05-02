import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { HEROES } from '../constants/mlbbHeroes';

const DEFAULT_METADATA = {
  patch: '',
  winning_side: '',
  ban_mode: 6,
  bans: Array(10).fill(''),
};

export function makeDefaultMetadata() {
  return { ...DEFAULT_METADATA, bans: Array(10).fill('') };
}

export default function MatchMetadataForm({ metadata, onChange }) {
  const [collapsed, setCollapsed] = useState(false);

  const banSlots = metadata.ban_mode === 6 ? 6 : 10;

  // Ban draft order labels: alternating Blue/Red starting with Blue
  const banLabel = (i) => {
    const side = i % 2 === 0 ? 'Blue' : 'Red';
    return `Ban ${i + 1} (${side})`;
  };

  const updateField = (field, value) => {
    onChange({ ...metadata, [field]: value });
  };

  const updateBan = (i, value) => {
    const nextBans = [...metadata.bans];
    nextBans[i] = value;
    onChange({ ...metadata, bans: nextBans });
  };

  const handleBanModeChange = (mode) => {
    if (mode === 6 && metadata.ban_mode === 10) {
      const truncated = metadata.bans.slice(0, 6).concat(Array(4).fill(''));
      const wouldDiscard = metadata.bans.slice(6).some(b => b !== '');
      if (wouldDiscard) {
        // eslint-disable-next-line no-alert
        const ok = confirm('Switching to 6-ban mode discards bans 7–10. Continue?');
        if (!ok) return;
      }
      onChange({ ...metadata, ban_mode: 6, bans: truncated });
    } else {
      onChange({ ...metadata, ban_mode: mode });
    }
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <h3 style={{ margin: 0, fontSize: '0.95rem' }} className="text-gold">
          MATCH_METADATA
        </h3>
        <span className="subtitle" style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>
          // Optional pre-OCR fields. Patch + winner recommended.
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="review-input-group">
              <label>PATCH</label>
              <input
                type="text"
                value={metadata.patch}
                onChange={e => updateField('patch', e.target.value)}
                placeholder="e.g. 1.9.42"
                autoComplete="off"
              />
            </div>
            <div className="review-input-group">
              <label>WINNING_SIDE</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="winning_side"
                    value="blue"
                    checked={metadata.winning_side === 'blue'}
                    onChange={() => updateField('winning_side', 'blue')}
                  />
                  <span className="text-blue">Blue</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="winning_side"
                    value="red"
                    checked={metadata.winning_side === 'red'}
                    onChange={() => updateField('winning_side', 'red')}
                  />
                  <span className="text-red">Red</span>
                </label>
              </div>
            </div>
            <div className="review-input-group">
              <label>BAN_MODE</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 6}
                    onChange={() => handleBanModeChange(6)}
                  />
                  6-ban
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 10}
                    onChange={() => handleBanModeChange(10)}
                  />
                  10-ban
                </label>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', opacity: 0.7 }}>BANS (draft order, optional)</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem', marginTop: '0.5rem',
            }}>
              {Array.from({ length: banSlots }, (_, i) => (
                <div key={i} className="review-input-group">
                  <label style={{ fontSize: '0.7rem' }}>{banLabel(i)}</label>
                  <input
                    list={`ban-hero-list-${i}`}
                    value={metadata.bans[i] || ''}
                    onChange={e => updateBan(i, e.target.value)}
                    placeholder="Hero"
                    autoComplete="off"
                  />
                  <datalist id={`ban-hero-list-${i}`}>
                    {HEROES.map(h => <option key={h} value={h} />)}
                  </datalist>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
