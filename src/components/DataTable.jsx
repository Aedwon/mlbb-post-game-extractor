import React, { useState } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { exportLongCSV, exportWideCSV } from '../utils/exportCSV';

function buildMatchObject(savedRow) {
  const { data: players, metadata, assignments, timestamp } = savedRow;

  const battleId = players?.[0]?.battle_id || '';

  const matchTopLevel = {
    battle_id: battleId,
    match_timestamp: timestamp || '',
    patch: metadata?.patch || '',
    duration: metadata?.duration ?? '',
    winning_side: metadata?.winning_side || '',
    ban_mode: metadata?.ban_mode || 6,
  };

  // Map bans (alternating draft order: even idx = blue, odd = red) to side-prefixed columns
  const banSlots = metadata?.ban_mode === 10 ? 5 : 3;
  for (let i = 1; i <= 5; i++) {
    matchTopLevel[`blue_ban_${i}`] = '';
    matchTopLevel[`red_ban_${i}`] = '';
  }
  if (metadata?.bans) {
    let blueCount = 0;
    let redCount = 0;
    metadata.bans.forEach((hero, idx) => {
      const side = idx % 2 === 0 ? 'blue' : 'red';
      const slotIdx = side === 'blue' ? ++blueCount : ++redCount;
      if (slotIdx > banSlots) return;
      matchTopLevel[`${side}_ban_${slotIdx}`] = hero || '';
    });
  }

  const playersWithMeta = players.map(p => {
    const idx = p.playerIndex;
    return {
      player_index: idx,
      side: idx <= 5 ? 'blue' : 'red',
      role: assignments?.[idx]?.role || '',
      ign: p.ign || '',
      hero: assignments?.[idx]?.hero || '',
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold: p.gold,
      rating: p.rating,
      hero_dmg: p.hero_dmg,
      consec_kills: p.consec_kills,
      teamfight_pct: p.teamfight,
      crowd_control: p.cc,
      healing_shields: p.healing,
      dmg_taken: p.dmg_taken,
      hero_dmg_overall: p.hero_dmg_ov,
      turret_dmg: p.turret_dmg,
      dmg_taken_overall: p.dmg_taken_ov,
      teamfight_pct_overall: p.teamfight_ov,
      total_gold: p.total_gold,
      jungle_gold: p.jungle_gold,
      kill_gold: p.kill_gold,
      minion_gold: p.minion_gold,
    };
  });

  return { ...matchTopLevel, players: playersWithMeta };
}

export default function DataTable({ rows }) {
  const [exportPickerOpen, setExportPickerOpen] = useState(false);

  if (!rows || rows.length === 0) return null;

  const downloadCSV = (format) => {
    const matches = rows.map(buildMatchObject);
    const serializer = format === 'wide' ? exportWideCSV : exportLongCSV;

    let csv;
    if (format === 'long') {
      // Long: 1 header + (10 * N matches) data rows
      const header = serializer(matches[0]).split('\n')[0];
      const allDataRows = matches.flatMap(m => serializer(m).split('\n').slice(1));
      csv = [header, ...allDataRows].join('\n');
    } else {
      // Wide: 1 header + N data rows
      const header = serializer(matches[0]).split('\n')[0];
      const allDataRows = matches.map(m => serializer(m).split('\n')[1]);
      csv = [header, ...allDataRows].join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb_${format}_${new Date().getTime()}.csv`;
    a.click();
    setExportPickerOpen(false);
  };

  const copyToClipboard = (matchId) => {
    const match = rows.find(r => r.id === matchId);
    if (!match) return;
    const matchObj = buildMatchObject(match);
    const csv = exportLongCSV(matchObj);
    // Convert CSV to TSV for clipboard
    const tsv = csv.split('\n').map(line => {
      // naive CSV→TSV; assumes no commas in values (we already CSV-escape elsewhere)
      return line.replace(/,/g, '\t');
    }).join('\n');
    navigator.clipboard.writeText(tsv);
  };

  return (
    <div className="data-table-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <span className="subtitle" style={{ fontSize: '0.75rem' }}>
          // {rows.length} MATCH_RECORDS_INITIALIZED (10_SLOT_EXTRACTION)
        </span>
        <button className="btn btn-cyan" onClick={() => setExportPickerOpen(true)}>
          <Download size={16} /> EXPORT_CSV
        </button>
      </div>

      {exportPickerOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
            <header className="modal-header">
              <h2 className="text-gold">EXPORT_FORMAT</h2>
              <button className="btn-icon" onClick={() => setExportPickerOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <p className="subtitle">// Choose CSV shape for your downstream pipeline.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn btn-cyan"
                style={{ flex: 1 }}
                onClick={() => downloadCSV('long')}
              >
                LONG (10 rows/match)
              </button>
              <button
                className="btn btn-cyan"
                style={{ flex: 1 }}
                onClick={() => downloadCSV('wide')}
              >
                WIDE (1 row/match)
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.map((match, i) => (
        <div key={match.id} className="glass-panel" style={{ marginBottom: '3rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem',
          }}>
            <h4 style={{ color: 'var(--color-gold-glow)', fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>
              MATCH_ID: {i + 1}
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: '1rem' }}>
                [{match.timestamp}]
              </span>
            </h4>
            <button
              className="btn"
              onClick={() => copyToClipboard(match.id)}
              title="Copy Match Data (Tab-Separated, long format)"
            >
              <Copy size={14} /> COPY_BUFFER
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>P#</th>
                  <th>SIDE</th>
                  <th>ROLE</th>
                  <th>IGN</th>
                  <th>HERO</th>
                </tr>
              </thead>
              <tbody>
                {match.data.map(player => {
                  const idx = player.playerIndex;
                  return (
                    <tr key={idx}>
                      <td style={{ color: 'var(--color-mlbb-blue)', fontWeight: 'bold' }}>{idx}</td>
                      <td>{idx <= 5 ? 'blue' : 'red'}</td>
                      <td>{match.assignments?.[idx]?.role || '-'}</td>
                      <td style={{ fontWeight: '600' }}>{player.ign || '-'}</td>
                      <td>{match.assignments?.[idx]?.hero || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
