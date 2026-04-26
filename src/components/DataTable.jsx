import React from 'react';
import { Copy, Download } from 'lucide-react';

export default function DataTable({ rows, boxes }) {
  const columns = boxes.map(b => ({ id: b.id, label: b.label }));

  const copyToClipboard = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const text = columns.map(col => row.data[col.id] || '').join('\t');
    navigator.clipboard.writeText(text);
  };

  const downloadCSV = () => {
    const header = columns.map(c => c.label).join(',');
    const csvRows = rows.map(r => columns.map(col => r.data[col.id] || '').join(','));
    const csv = [header, ...csvRows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb_stats_${new Date().getTime()}.csv`;
    a.click();
  };

  return (
    <div className="data-table-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{rows.length} row(s) processed</span>
        <button className="btn btn-cyan" onClick={downloadCSV}><Download size={16} /> Export CSV</button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {columns.map(col => <th key={col.id}>{col.label}</th>)}
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td style={{ color: 'var(--color-text-muted)' }}>{row.timestamp}</td>
              {columns.map(col => (
                <td key={col.id}>{row.data[col.id] || '-'}</td>
              ))}
              <td style={{ textAlign: 'right' }}>
                <button 
                  className="btn" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                  onClick={() => copyToClipboard(row.id)}
                  title="Copy Tab-Separated Row"
                >
                  <Copy size={14} /> Copy Row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
