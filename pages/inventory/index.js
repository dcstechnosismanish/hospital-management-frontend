import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import BackButton from '../../components/ui/BackButton';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added
import Pagination from '../../components/ui/Pagination';
import { confirmAction } from '../../utils/sweetAlert';

export default function Inventory() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [transactions, setTransactions] = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [editId,      setEditId]      = useState(null);
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [limit,       setLimit]       = useState(10);
  const [form, setForm] = useState({
    item: '', quantity: 1, type: 'in', reason: '', reference: ''
  });

  const fetchAll = () => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/inventory?page=${page}&limit=${limit}&search=${search}&type=${filterType}`),
      api.get('/inventory/items?limit=300'),
    ]).then(([t, i]) => {
      if (t.status === 'fulfilled') {
        setTransactions(t.value.data?.data || []);
        setTotal(t.value.data?.total || 0);
      }
      if (i.status === 'fulfilled') setItems(i.value.data?.data        || []);
    }).finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('inventory')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading, page, filterType, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('inventory')) {
        setPage(1);
        fetchAll();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Stats ───────────────────────────────────────────────
  const today      = new Date().toDateString();
  const todayIn    = transactions.filter(t => t.type === 'in'  && new Date(t.date || t.createdAt).toDateString() === today);
  const todayOut   = transactions.filter(t => t.type === 'out' && new Date(t.date || t.createdAt).toDateString() === today);
  const totalIn    = transactions.filter(t => t.type === 'in').reduce((s, t)  => s + (t.quantity || 0), 0);
  const totalOut   = transactions.filter(t => t.type === 'out').reduce((s, t) => s + (t.quantity || 0), 0);
  const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekTx = transactions.filter(t => new Date(t.date || t.createdAt) >= weekAgo);

  const statCards = [
    {
      icon: 'fa-boxes-stacked', label: 'Total Transactions', value: total,
      color: '#16a34a', sub: 'All time records',
      change: `${thisWeekTx.length} this week`, changeType: 'up', delay: 0,
    },
    {
      icon: 'fa-arrow-down', label: 'Stock In (Total)', value: totalIn,
      color: '#059669', sub: 'Total units received',
      change: `${todayIn.length} entries today`, changeType: 'up', delay: 1,
    },
    {
      icon: 'fa-arrow-up', label: 'Stock Out (Total)', value: totalOut,
      color: '#dc2626', sub: 'Total units dispatched',
      change: `${todayOut.length} entries today`,
      changeType: totalOut > totalIn ? 'down' : 'neutral', delay: 2,
    },
    {
      icon: 'fa-box', label: 'Item Types', value: items.length,
      color: '#7c3aed', sub: 'Unique items in master',
      change: 'Item master', changeType: 'neutral', delay: 3,
    },
    {
      icon: 'fa-calendar-week', label: 'This Week', value: thisWeekTx.length,
      color: '#d97706', sub: 'Movements in last 7 days',
      change: 'Recent activity', changeType: 'neutral', delay: 5,
    },
  ];

  // ── Submit transaction ──────────────────────────────────
  const openEdit = (t) => {
    setEditId(t._id);
    setForm({
      item: t.item?._id || t.item || '',
      quantity: t.quantity,
      type: t.type,
      reason: t.reason || '',
      reference: t.reference || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item)     return toast.error('Please select an item');
    if (!form.quantity) return toast.error('Quantity is required');
    
    // ✅ Permission check
    if (editId && !canUpdate('inventory')) return toast.error('No permission to update transactions');
    if (!editId && !canCreate('inventory')) return toast.error('No permission to record transactions');

    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/inventory/${editId}`, form);
        toast.success('Transaction updated successfully!');
      } else {
        await api.post('/inventory', form);
        toast.success(`Stock ${form.type === 'in' ? 'added' : 'removed'} successfully!`);
      }
      setShowModal(false);
      setEditId(null);
      setForm({ item: '', quantity: 1, type: 'in', reason: '', reference: '' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete transaction ──────────────────────────────────
  const handleDelete = async (id) => {
    if (!canDelete('inventory')) return toast.error('No permission to delete transactions');
    if (!await confirmAction('Delete Transaction?', 'Delete this transaction? Stock will be reversed.', 'Yes, delete')) return;
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Transaction deleted and stock reversed');
      fetchAll();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Filter ──────────────────────────────────────────────
  const filtered = transactions; // Handled on backend

  // ✅ Show actions column only after perms loaded
  const showEditCol    = !permLoading && canUpdate('inventory');
  const showDeleteCol  = !permLoading && canDelete('inventory');
  const showActionsCol = showEditCol || showDeleteCol;
  const colSpan        = showActionsCol ? 8 : 7;

  // ✅ Access Denied screen
  if (!permLoading && !canRead('inventory')) {
    return (
      <>
        <SEOHead title="Inventory" path="/inventory" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Inventory.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Inventory" path="/inventory" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-boxes-stacked me-3" style={{ color: 'var(--primary)' }} />
                Inventory
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {total} stock transactions recorded
              </p>
            </div>
          </div>
          {/* ✅ Only show Record Transaction button if canCreate */}
          {!permLoading && canCreate('inventory') && (
            <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" />Record Transaction
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Table ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>Stock Transactions</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search item / reason..."
                className="form-control"
                style={{ maxWidth: 210, fontSize: 13 }}
              />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="form-select"
                style={{ maxWidth: 130, fontSize: 13 }}
              >
                <option value="">All Types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
              </select>
            </div>
          </div>

          {/* ✅ Skeleton while loading data OR permissions */}
          {(loading || permLoading) ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Item</th><th>Type</th><th>Quantity</th><th>Reason</th>
                    <th>Reference</th><th>Date</th><th>By</th>
                    {showActionsCol && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: colSpan }).map((__, j) => (
                        <td key={j}><div className="skel" style={{ height: 14, borderRadius: 6 }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Item</th><th>Type</th><th>Quantity</th><th>Reason</th>
                    <th>Reference</th><th>Date</th><th>By</th>
                    {/* ✅ Actions column only if at least one action available */}
                    {showActionsCol && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-boxes-stacked fa-2x d-block mb-2" />
                        {search || filterType ? 'No matching transactions' : 'No transactions yet'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(t => (
                      <tr key={t._id}>
                        <td>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {t.item?.name || '—'}
                          </strong>
                          {t.item?.category && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {t.item.category}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            background: t.type === 'in' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                            color:      t.type === 'in' ? '#16a34a' : '#dc2626',
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                            <i className={`fa-solid ${t.type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'}`} />
                            Stock {t.type === 'in' ? 'In' : 'Out'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 16, color: t.type === 'in' ? '#16a34a' : '#dc2626' }}>
                            {t.quantity}
                          </strong>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.reason || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.reference || '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {new Date(t.date || t.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {t.createdBy?.name || '—'}
                        </td>
                        {/* ✅ Actions button — only if canUpdate/canDelete */}
                        {showActionsCol && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {showEditCol && (
                                <button onClick={() => openEdit(t)} title="Edit" style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-pen" />
                                </button>
                              )}
                              {showDeleteCol && (
                                <button onClick={() => handleDelete(t._id)} title="Delete & reverse stock" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination 
            page={page} 
            total={total} 
            limit={limit} 
            onPageChange={setPage} 
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>

        {/* ── Modal — only if canCreate ── */}
        {!permLoading && canCreate('inventory') && (
          <Modal
            show={showModal}
            onClose={() => { setShowModal(false); setEditId(null); setForm({ item: '', quantity: 1, type: 'in', reason: '', reference: '' }); }}
            title={editId ? "✏️ Edit Stock Transaction" : "📦 Record Stock Transaction"}
            size="md"
            footer={<>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Saving...</>
                  : <><i className="fa-solid fa-floppy-disk" />Record</>
                }
              </button>
            </>}
          >
            <div className="row g-3">

              {/* Item Select */}
              <div className="col-12">
                <label className="form-label">Item *</label>
                {items.length === 0 ? (
                  <div style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)',
                    fontSize: 13, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <i className="fa-solid fa-triangle-exclamation" />
                    No items found. Please add items in{' '}
                    <a href="/inventory/items" style={{ color: '#d97706', fontWeight: 700 }}>
                      Item Master
                    </a>{' '}first.
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={form.item}
                    onChange={e => setForm({ ...form, item: e.target.value })}
                    required
                  >
                    <option value="">Select Item</option>
                    {items.map(i => (
                      <option key={i._id} value={i._id}>
                        {i.name} ({i.category}) — Stock: {i.currentStock} {i.unit}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Type + Quantity */}
              <div className="col-6">
                <label className="form-label">Type *</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  <option value="in">📥 Stock In</option>
                  <option value="out">📤 Stock Out</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Quantity *</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: +e.target.value })}
                  min={1}
                  required
                />
              </div>

              {/* Reason */}
              <div className="col-12">
                <label className="form-label">Reason</label>
                <input
                  className="form-control"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Purchase received, Used in ward, Damaged..."
                />
              </div>

              {/* Reference */}
              <div className="col-12">
                <label className="form-label">Reference No.</label>
                <input
                  className="form-control"
                  value={form.reference}
                  onChange={e => setForm({ ...form, reference: e.target.value })}
                  placeholder="e.g. PO-001, Invoice no., Requisition no."
                />
              </div>

            </div>
          </Modal>
        )}

      </div>

      <style>{`
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        @media (max-width: 1200px) { .stat-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } }
        .skel {
          background: linear-gradient(90deg, var(--hover-bg) 25%, var(--border-color) 50%, var(--hover-bg) 75%);
          background-size: 200% 100%;
          animation: skelShimmer 1.4s infinite;
        }
        @keyframes skelShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>
    </>
  );
}

Inventory.getLayout = (page) => <Layout>{page}</Layout>;