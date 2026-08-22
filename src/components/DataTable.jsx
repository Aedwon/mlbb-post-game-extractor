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
      const header = serializer(matches[0]).split('\n')[0];
      const allDataRows = matches.flatMap(m => serializer(m).split('\n').slice(1));
      csv = [header, ...allDataRows].join('\n');
    } else {
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
    URL.revokeObjectURL(url);
    setExportPickerOpen(false);
  };

  const copyToClipboard = (matchId) => {
    const match = rows.find(r => r.id === matchId);
    if (!match) return;
    const matchObj = buildMatchObject(match);
    const csv = exportLongCSV(matchObj);
    const tsv = csv.split('\n').map(line => line.replace(/,/g, '\t')).join('\n');
    navigator.clipboard.writeText(tsv);
  };

  return (
    <div className="data-table-wrapper">
      <div className="data-table-toolbar">
        <div className="data-table-summary">
          <strong>{rows.length}</strong>
          <span>{rows.length === 1 ? 'match ready to export' : 'matches ready to export'}</span>
        </div>
        <button className="btn btn-cyan" onClick={() => setExportPickerOpen(true)}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {exportPickerOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '560px' }}>
            <header className="modal-header">
              <div>
                <h2>Export format</h2>
                <span className="subtitle">Choose the shape that matches your downstream analysis.</span>
              </div>
              <button className="btn-icon" onClick={() => setExportPickerOpen(false)} aria-label="Close export dialog">
                <X size={20} />
              </button>
            </header>

            <div className="export-options">
              <button className="export-option" onClick={() => downloadCSV('long')}>
                <strong>Long format</strong>
                <span>10 rows per match. Best for analysis, pivots, databases, and player-level statistics.</span>
              </button>
              <button className="export-option" onClick={() => downloadCSV('wide')}>
                <strong>Wide format</strong>
                <span>1 row per match. Best when each match is a single record in a larger dataset.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.map((match, i) => {
        const battleId = match.data?.[0]?.battle_id || '';
        return (
          <div key={match.id} className="glass-panel match-card">
            <div className="match-card__header">
              <div className="match-card__identity">
                <h4>Match {i + 1}</h4>
                <span>{battleId ? `Battle ID ${battleId}` : match.timestamp}</span>
              </div>
              <button
                className="btn"
                onClick={() => copyToClipboard(match.id)}
                title="Copy match data as tab-separated long format"
              >
                <Copy size={14} /> Copy
              </button>
            </div>

            <div className="match-card__table">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Side</th>
                    <th>Role</th>
                    <th>IGN</th>
                    <th>Hero</th>
                  </tr>
                </thead>
                <tbody>
                  {match.data.map(player => {
                    const idx = player.playerIndex;
                    const side = idx <= 5 ? 'blue' : 'red';
                    return (
                      <tr key={idx}>
                        <td className={side === 'blue' ? 'text-blue' : 'text-red'} style={{ fontWeight: 700 }}>
                          P{idx}
                        </td>
                        <td><span className={`side-pill ${side}`}>{side}</span></td>
                        <td>{match.assignments?.[idx]?.role || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{player.ign || '—'}</td>
                        <td>{match.assignments?.[idx]?.hero || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
