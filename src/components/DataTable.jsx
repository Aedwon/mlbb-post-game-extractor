import React from 'react';
import { Copy, Download } from 'lucide-react';

export default function DataTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  // Derive columns from the first match's config
  const allColumns = rows[0]?.columns || [];
  const columns = allColumns.map(b => ({ id: b.id, label: b.label }));

  const copyToClipboard = (matchId) => {
    const match = rows.find(r => r.id === matchId);
    if (!match) return;
    
    // We'll copy all 10 players of this match
    const header = ['Player Index', ...columns.map(c => c.label)].join('\t');
    const textRows = match.data.map(player => {
      return [player.playerIndex, ...columns.map(col => player[col.id] || '')].join('\t');
    });
    const text = [header, ...textRows].join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadCSV = () => {
    const header = ['Match Timestamp', 'Player Index', ...columns.map(c => c.label)].join(',');
    const csvRows = [];
    rows.forEach(match => {
       match.data.forEach(player => {
          const rowValues = [match.timestamp, player.playerIndex, ...columns.map(col => player[col.id] || '')];
          csvRows.push(rowValues.join(','));
       });
    });
    const csv = [header, ...csvRows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb_batch_stats_${new Date().getTime()}.csv`;
    a.click();
  };

  return (
    <div className="data-table-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{rows.length} match(es) extracted (10 players each)</span>
        <button className="btn btn-cyan" onClick={downloadCSV}><Download size={16} /> Export All to CSV</button>
      </div>
      
      {rows.map((match, i) => (
        <div key={match.id} style={{ marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
             <h4 style={{ color: 'var(--color-gold-glow)', margin: 0 }}>Match #{i + 1} ({match.timestamp})</h4>
             <button 
                className="btn" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                onClick={() => copyToClipboard(match.id)}
                title="Copy Match Data (Tab-Separated)"
              >
                <Copy size={14} /> Copy Match
              </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>P#</th>
                  {columns.map(col => <th key={col.id}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {match.data.map(player => (
                  <tr key={player.playerIndex}>
                    <td style={{ color: 'var(--color-cyan-glow)', fontWeight: 'bold' }}>{player.playerIndex}</td>
                    {columns.map(col => (
                      <td key={col.id}>{player[col.id] || '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
