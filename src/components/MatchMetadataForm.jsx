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

  const banLabel = (i) => {
    const side = i % 2 === 0 ? 'Blue' : 'Red';
    return `Ban ${i + 1} · ${side}`;
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
    <section className="glass-panel match-setup" aria-labelledby="match-setup-title">
      <button
        type="button"
        className="match-setup__toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <div className="match-setup__title-group">
          <h3 id="match-setup-title" className="match-setup__title">Match setup</h3>
          <span className="match-setup__hint">Patch, winner, and draft context</span>
        </div>
        <span className="match-setup__optional">OPTIONAL</span>
      </button>

      {!collapsed && (
        <div className="match-setup__body">
          <div className="match-setup__primary-grid">
            <div className="metadata-field">
              <label className="field-label" htmlFor="metadata-patch">Patch</label>
              <input
                id="metadata-patch"
                className="metadata-input"
                type="text"
                value={metadata.patch}
                onChange={e => updateField('patch', e.target.value)}
                placeholder="e.g. 1.9.42"
                autoComplete="off"
              />
            </div>

            <div className="metadata-field">
              <span className="field-label">Winning side</span>
              <div className="segmented-control" role="radiogroup" aria-label="Winning side">
                <label className="blue">
                  <input
                    type="radio"
                    name="winning_side"
                    value="blue"
                    checked={metadata.winning_side === 'blue'}
                    onChange={() => updateField('winning_side', 'blue')}
                  />
                  Blue
                </label>
                <label className="red">
                  <input
                    type="radio"
                    name="winning_side"
                    value="red"
                    checked={metadata.winning_side === 'red'}
                    onChange={() => updateField('winning_side', 'red')}
                  />
                  Red
                </label>
              </div>
            </div>

            <div className="metadata-field">
              <span className="field-label">Ban format</span>
              <div className="segmented-control" role="radiogroup" aria-label="Ban format">
                <label>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 6}
                    onChange={() => handleBanModeChange(6)}
                  />
                  6 bans
                </label>
                <label>
                  <input
                    type="radio"
                    name="ban_mode"
                    checked={metadata.ban_mode === 10}
                    onChange={() => handleBanModeChange(10)}
                  />
                  10 bans
                </label>
              </div>
            </div>
          </div>

          <div className="match-setup__bans">
            <div className="match-setup__bans-heading">
              <span className="field-label">Draft bans</span>
              <span>Optional · entered in draft order</span>
            </div>
            <div className="match-setup__ban-grid">
              {Array.from({ length: banSlots }, (_, i) => (
                <div key={i} className="metadata-field">
                  <label className="field-label" htmlFor={`ban-${i}`}>{banLabel(i)}</label>
                  <input
                    id={`ban-${i}`}
                    className="metadata-input"
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
    </section>
  );
}
