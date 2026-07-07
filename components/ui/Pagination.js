import React from 'react';

export default function Pagination({ page, total, limit, onPageChange, onLimitChange }) {
  const totalPages = Math.ceil(total / limit);

  const getPages = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="pagination-container">
      <div className="pagination-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>Showing <strong>{total === 0 ? 0 : (page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> entries</span>
        {onLimitChange && (
          <select 
            value={limit} 
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="form-select form-select-sm"
            style={{ width: 'auto', display: 'inline-block', fontSize: '13px', padding: '4px 24px 4px 8px' }}
          >
            {[5, 10, 15, 25, 50, 100].map(val => (
              <option key={val} value={val}>{val} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="pagination-controls">
        <button 
          className="pagination-btn" 
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          style={{ width: 'auto', padding: '0 12px' }}
        >
          <i className="fa-solid fa-chevron-left me-2" /> Previous
        </button>

        <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px' }}>
          Page {page} of {totalPages === 0 ? 1 : totalPages}
        </span>

        <button 
          className="pagination-btn" 
          disabled={page === totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
          style={{ width: 'auto', padding: '0 12px' }}
        >
          Next <i className="fa-solid fa-chevron-right ms-2" />
        </button>
      </div>

      <style jsx>{`
        .pagination-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
          background: var(--card-bg);
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pagination-info {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .pagination-info strong {
          color: var(--text-primary);
        }
        .pagination-controls {
          display: flex;
          gap: 6px;
        }
        .pagination-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pagination-btn:hover:not(:disabled) {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--primary-glow);
        }
        .pagination-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
          box-shadow: 0 4px 10px rgba(124, 58, 237, 0.2);
        }
        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (max-width: 600px) {
          .pagination-container {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
