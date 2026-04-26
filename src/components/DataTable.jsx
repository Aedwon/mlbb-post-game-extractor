import React from 'react';
import { Copy, Download } from 'lucide-react';

export default function DataTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  // Derive unique columns by stripping _red suffix
  const allColumns = rows[0]?.columns || [];
  const uniqueFieldIds = Array.from(new Set(allColumns.map(b => b.id.replace('_red', ''))));
  const columns = uniqueFieldIds.map(fieldId => {
    const originalBox = allColumns.find(b => b.id.replace('_red', '') === fieldId);
    return { id: fieldId, label: originalBox?.label || fieldId };
  });

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <span className="subtitle" style={{ fontSize: '0.75rem' }}>// {rows.length} MATCH_RECORDS_INITIALIZED (10_SLOT_EXTRACTION)</span>
        <button className="btn btn-cyan" onClick={downloadCSV}><Download size={16} /> EXPORT_ALL_CSV</button>
      </div>
      
      {rows.map((match, i) => (
        <div key={match.id} className="glass-panel" style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
             <h4 style={{ color: 'var(--color-gold-glow)', fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>MATCH_ID: {i + 1} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: '1rem' }}>[{match.timestamp}]</span></h4>
              <button 
                 className="btn" 
                 onClick={() => copyToClipboard(match.id)}
                 title="Copy Match Data (Tab-Separated)"
               >
                 <Copy size={14} /> COPY_BUFFER
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
                    <td style={{ color: 'var(--color-mlbb-blue)', fontWeight: 'bold' }}>{player.playerIndex}</td>
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
