import { useState } from 'react';

export default function DataTable({ columns, data, searchable = true, loading = false }) {
  const [search, setSearch] = useState('');

  const filtered = searchable
    ? data.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
    : data;

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border" style={{ color: 'var(--primary)' }} />
    </div>
  );

  return (
    <div>
      {searchable && (
        <div className="mb-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search in table..."
            className="form-control" style={{ maxWidth: 280, fontSize: 14 }} />
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="table table-custom w-100">
          <thead>
            <tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-inbox me-2" />No records found
              </td></tr>
            ) : filtered.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}