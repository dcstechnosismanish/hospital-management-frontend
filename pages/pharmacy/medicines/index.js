import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import BackButton from '../../../components/ui/BackButton';
import StatCard from '../../../components/ui/StatCard';
import Modal from '../../../components/ui/Modal';
import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';                              // ✅ Added
import { usePermission } from '../../../hooks/usePermission'; // ✅ Added
import Pagination from '../../../components/ui/Pagination';
import { confirmAction } from '../../../utils/sweetAlert';

const CATEGORIES = ['Tablet','Capsule','Syrup','Injection','Cream','Drops','Powder','Device','Vaccine','Other'];
const UNITS      = ['Strip','Bottle','Box','Vial','Tube','Sachet','Piece','Ampoule'];

const CAT_COLORS = {
  Tablet: '#16a34a', Capsule: '#7c3aed', Syrup: '#0891b2',
  Injection: '#dc2626', Cream: '#d97706', Drops: '#059669',
  Powder: '#db2777', Device: '#6b7280', Vaccine: '#0e7490', Other: '#9ca3af',
};

const EMPTY_FORM = {
  name: '', genericName: '', category: 'Tablet', manufacturer: '',
  unit: 'Strip', stock: 0, minStockLevel: 10,
  purchasePrice: 0, sellingPrice: 0,
  expiryDate: '', batchNumber: '', supplier: '', description: '',
};

export default function Medicines() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [medicines,   setMedicines]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [page,        setPage]        = useState(1);
  const [limit,       setLimit]       = useState(10);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = () => {
    setLoading(true);
    api.get('/medicines').then(res => {
      setMedicines(res.data?.data || []);
    }).finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('medicine-inventory')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading]);

  // ── Stats ──────────────────────────────────────────────────
  const outOfStock   = medicines.filter(m => m.stock === 0);
  const lowStock     = medicines.filter(m => m.stock > 0 && m.stock <= m.minStockLevel);
  const inStock      = medicines.filter(m => m.stock > m.minStockLevel);
  const expiringSoon = medicines.filter(m => {
    if (!m.expiryDate) return false;
    const days = (new Date(m.expiryDate) - new Date()) / 86400000;
    return days <= 30 && days > 0;
  });
  const expired    = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) < new Date());
  const totalValue = medicines.reduce((s, m) => s + ((m.stock || 0) * (m.purchasePrice || 0)), 0);
  const cats       = [...new Set(medicines.map(m => m.category).filter(Boolean))];

  const statCards = [
    {
      icon: 'fa-pills', label: 'Total Medicines', value: medicines.length,
      color: '#16a34a', sub: 'Registered items',
      change: `${inStock.length} well stocked`, changeType: 'up', delay: 0,
    },
    {
      icon: 'fa-circle-xmark', label: 'Out of Stock', value: outOfStock.length,
      color: '#dc2626', sub: 'Zero inventory',
      change: outOfStock.length > 0 ? 'Action required' : 'All good',
      changeType: outOfStock.length > 0 ? 'down' : 'neutral', delay: 1,
    },
    {
      icon: 'fa-triangle-exclamation', label: 'Low Stock', value: lowStock.length,
      color: '#f59e0b', sub: 'Below minimum',
      change: 'Order soon', changeType: lowStock.length > 0 ? 'down' : 'neutral', delay: 2,
    },
    {
      icon: 'fa-clock', label: 'Expiring Soon', value: expiringSoon.length,
      color: '#d97706', sub: 'Within 30 days',
      change: expired.length > 0 ? `${expired.length} already expired` : 'Check dates',
      changeType: expired.length > 0 ? 'down' : 'neutral', delay: 3,
    },
    {
      icon: 'fa-tags', label: 'Categories', value: cats.length,
      color: '#7c3aed', sub: 'Drug classifications',
      change: `${CATEGORIES.length} available`, changeType: 'neutral', delay: 4,
    },
  ];

  // ── Modal helpers ──────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };

  const openEdit = (m) => {
    setEditId(m._id);
    setForm({
      name:          m.name          || '',
      genericName:   m.genericName   || '',
      category:      m.category      || 'Tablet',
      manufacturer:  m.manufacturer  || '',
      unit:          m.unit          || 'Strip',
      stock:         m.stock         ?? 0,
      minStockLevel: m.minStockLevel ?? 10,
      purchasePrice: m.purchasePrice ?? 0,
      sellingPrice:  m.sellingPrice  ?? 0,
      expiryDate:    m.expiryDate ? m.expiryDate.split('T')[0] : '',
      batchNumber:   m.batchNumber   || '',
      supplier:      m.supplier?._id || m.supplier || '',
      description:   m.description   || '',
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setForm(EMPTY_FORM); setEditId(null); };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasLetters = (str) => /[a-zA-Z]/.test(str || '');

    // ── Required Fields ──
    if (!form.name?.trim())     return toast.error('Medicine name is required');
    if (!form.category)         return toast.error('Category is required');
    if (!form.expiryDate)       return toast.error('Expiry date is required');
    if (form.purchasePrice < 0) return toast.error('Purchase price cannot be negative');
    if (form.sellingPrice < 0)  return toast.error('Selling price cannot be negative');

    // ── Content Validation (Anti-Dummy) ──
    if (!hasLetters(form.name)) return toast.error('Medicine name must contain letters');
    if (form.genericName && !hasLetters(form.genericName))
      return toast.error('Generic name must contain letters');
    if (form.manufacturer && !hasLetters(form.manufacturer))
      return toast.error('Manufacturer must contain letters');
    if (form.batchNumber && !hasLetters(form.batchNumber))
      return toast.error('Batch number must contain letters');
    if (form.supplier && !hasLetters(form.supplier))
      return toast.error('Supplier name must contain letters');
    if (form.description && !hasLetters(form.description))
      return toast.error('Description must contain letters');

    // ── Numeric Logic ──
    if (form.stock < 0) return toast.error('Current stock cannot be negative');
    if (form.minStockLevel < 0) return toast.error('Minimum stock level cannot be negative');

    // ✅ Double-check permissions before submitting
    if (editId  && !canUpdate('medicine-inventory')) return toast.error('You do not have permission to edit medicines');
    if (!editId && !canCreate('medicine-inventory')) return toast.error('You do not have permission to add medicines');
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/medicines/${editId}`, form);
        toast.success('Medicine updated!');
      } else {
        await api.post('/medicines', form);
        toast.success('Medicine added!');
      }
      closeModal();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save medicine');
    } finally { setSubmitting(false); }
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id, name) => {
    // ✅ Double-check delete permission
    if (!canDelete('medicine-inventory')) return toast.error('You do not have permission to delete medicines');
    if (!await confirmAction('Delete Medicine?', `Delete "${name}"? This cannot be undone.`, 'Yes, delete')) return;
    try {
      await api.delete(`/medicines/${id}`);
      toast.success('Medicine deleted');
      fetchAll();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Stock style helper ─────────────────────────────────────
  const getStockStyle = (m) => {
    if (m.expiryDate) {
      const days = Math.round((new Date(m.expiryDate) - new Date()) / 86400000);
      if (days < 0) return { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',  label: 'Expired' };
    }
    if (m.stock === 0)              return { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',  label: 'Out of Stock' };
    if (m.stock <= m.minStockLevel) return { c: '#d97706', bg: 'rgba(217,119,6,0.1)',  label: 'Low Stock' };
    return                                 { c: '#16a34a', bg: 'rgba(22,163,74,0.1)',  label: 'In Stock' };
  };

  // ── Expiry helper ──────────────────────────────────────────
  const getExpiryStyle = (expiryDate) => {
    if (!expiryDate) return { label: '—', color: 'var(--text-muted)', days: null };
    const days = Math.round((new Date(expiryDate) - new Date()) / 86400000);
    if (days < 0)   return { label: 'Expired',       color: '#dc2626', days, bold: true };
    if (days <= 30) return { label: `${days}d left`,  color: '#d97706', days, bold: true };
    return { label: new Date(expiryDate).toLocaleDateString('en-IN'), color: 'var(--text-secondary)', days };
  };

  // ── Filter ─────────────────────────────────────────────────
  const filtered = medicines.filter(m => {
    const q           = search.toLowerCase();
    const matchSearch = !search
      || m.name?.toLowerCase().includes(q)
      || m.genericName?.toLowerCase().includes(q)
      || m.batchNumber?.toLowerCase().includes(q)
      || m.manufacturer?.toLowerCase().includes(q);
    const matchCat   = !filterCat   || m.category === filterCat;
    let isExpired = false;
    if (m.expiryDate) {
      const days = Math.round((new Date(m.expiryDate) - new Date()) / 86400000);
      if (days < 0) isExpired = true;
    }

    const matchStock = !filterStock
      || (filterStock === 'expired' && isExpired)
      || (filterStock === 'out' && !isExpired && m.stock === 0)
      || (filterStock === 'low' && !isExpired && m.stock > 0 && m.stock <= m.minStockLevel)
      || (filterStock === 'ok'  && !isExpired && m.stock > m.minStockLevel);
    return matchSearch && matchCat && matchStock;
  });

  const paginatedMedicines = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, filterCat, filterStock]);

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  // ✅ Determine actions column span
  const showEditCol   = !permLoading && canUpdate('medicine-inventory');
  const showDeleteCol = !permLoading && canDelete('medicine-inventory');
  const showActionsCol = showEditCol || showDeleteCol;

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Medicine Inventory" path="/pharmacy/medicines" />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', flexDirection: 'column', gap: 14,
        }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: 'var(--primary)' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Checking permissions…</div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!canRead('medicine-inventory')) {
    return (
      <>
        <SEOHead title="Medicine Inventory" path="/pharmacy/medicines" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Medicine Inventory.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Medicine Inventory" path="/pharmacy/medicines" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-capsules me-3" style={{ color: 'var(--primary)' }} />
                Medicine Inventory
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {medicines.length} medicines registered
              </p>
            </div>
          </div>
          {/* ✅ Add Medicine — only if canCreate */}
          {canCreate('medicine-inventory') && (
            <button className="btn-primary-custom" onClick={openAdd}>
              <i className="fa-solid fa-plus" />Add Medicine
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Category Quick Filter Pills ── */}
        {cats.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => setFilterCat('')} style={{
              padding: '6px 16px', borderRadius: 30, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: `1.5px solid ${!filterCat ? 'var(--primary)' : 'var(--border-color)'}`,
              background: !filterCat ? 'var(--primary-glow)' : 'var(--card-bg)',
              color: !filterCat ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s',
            }}>All</button>
            {cats.map(cat => {
              const color  = CAT_COLORS[cat] || '#6b7280';
              const active = filterCat === cat;
              const count  = medicines.filter(m => m.category === cat).length;
              return (
                <button key={cat} onClick={() => setFilterCat(active ? '' : cat)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px', borderRadius: 30, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  border: `1.5px solid ${active ? color : 'var(--border-color)'}`,
                  background: active ? `${color}15` : 'var(--card-bg)',
                  color: active ? color : 'var(--text-muted)',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  {cat}
                  <span style={{ fontWeight: 800, color }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Table Card ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>
              All Medicines
              {filtered.length !== medicines.length && (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                  ({filtered.length} of {medicines.length})
                </span>
              )}
            </h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name / generic / batch..."
                className="form-control"
                style={{ maxWidth: 240, fontSize: 13 }}
              />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="form-select" style={{ maxWidth: 150, fontSize: 13 }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
                className="form-select" style={{ maxWidth: 140, fontSize: 13 }}>
                <option value="">All Stock</option>
                <option value="expired">Expired</option>
                <option value="out">Out of Stock</option>
                <option value="low">Low Stock</option>
                <option value="ok">In Stock</option>
              </select>
            </div>
          </div>

          {/* ✅ Skeleton while loading */}
          {loading ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Medicine</th><th>Category</th><th>Stock</th><th>Min Level</th>
                    <th>Purchase ₹</th><th>Selling ₹</th><th>Margin</th><th>Expiry</th>
                    <th>Supplier</th><th>Status</th>{showActionsCol && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: showActionsCol ? 11 : 10 }).map((__, j) => (
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
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Min Level</th>
                    <th>Purchase ₹</th>
                    <th>Selling ₹</th>
                    <th>Margin</th>
                    <th>Expiry</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    {/* ✅ Actions column only if at least one action available */}
                    {showActionsCol && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedMedicines.map(m => {
                    const sc     = getStockStyle(m);
                    const expiry = getExpiryStyle(m.expiryDate);
                    const catClr = CAT_COLORS[m.category] || '#6b7280';
                    const margin = m.sellingPrice && m.purchasePrice
                      ? Math.round(((m.sellingPrice - m.purchasePrice) / m.purchasePrice) * 100)
                      : null;
                    const pct = Math.min(100, Math.round(((m.stock || 0) / Math.max((m.minStockLevel || 10) * 2, 1)) * 100));

                    return (
                      <tr key={m._id}>

                        {/* Medicine name */}
                        <td style={{ minWidth: 170 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                            {m.name}
                          </div>
                          {m.genericName && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.genericName}</div>
                          )}
                          {m.batchNumber && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                              Batch: {m.batchNumber}
                            </div>
                          )}
                          {m.manufacturer && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.manufacturer}</div>
                          )}
                        </td>

                        {/* Category */}
                        <td>
                          <span style={{
                            background: `${catClr}15`, color: catClr,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: catClr }} />
                            {m.category || '—'}
                          </span>
                        </td>

                        {/* Stock */}
                        <td style={{ minWidth: 90 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <strong style={{ fontSize: 16, color: sc.c }}>{m.stock ?? 0}</strong>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.unit}</span>
                          </div>
                          <div style={{ height: 3, width: 64, background: 'var(--border-color)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: sc.c, borderRadius: 10, transition: 'width 0.8s ease' }} />
                          </div>
                        </td>

                        {/* Min Level */}
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.minStockLevel ?? 10}</td>

                        {/* Purchase ₹ */}
                        <td style={{ fontSize: 13 }}>
                          {m.purchasePrice ? `₹${m.purchasePrice.toFixed(2)}` : '—'}
                        </td>

                        {/* Selling ₹ */}
                        <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>
                          {m.sellingPrice ? `₹${m.sellingPrice.toFixed(2)}` : '—'}
                        </td>

                        {/* Margin % */}
                        <td>
                          {margin !== null ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color:      margin >= 20 ? '#16a34a' : margin >= 0 ? '#d97706' : '#dc2626',
                              background: margin >= 20 ? 'rgba(22,163,74,0.1)' : margin >= 0 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                              padding: '2px 8px', borderRadius: 20,
                            }}>
                              {margin > 0 ? '+' : ''}{margin}%
                            </span>
                          ) : '—'}
                        </td>

                        {/* Expiry */}
                        <td style={{
                          fontSize: 12, fontWeight: expiry.bold ? 700 : 400,
                          color: expiry.color, whiteSpace: 'nowrap',
                        }}>
                          {expiry.days !== null
                            ? <>
                                <i className={`fa-solid ${expiry.days < 0 ? 'fa-circle-exclamation' : 'fa-clock'} me-1`}
                                  style={{ fontSize: 10 }} />
                                {expiry.label}
                              </>
                            : '—'
                          }
                        </td>

                        {/* Supplier */}
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {m.supplier || '—'}
                        </td>

                        {/* Status badge */}
                        <td>
                          <span style={{
                            background: sc.bg, color: sc.c,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                          }}>
                            {sc.label}
                          </span>
                        </td>

                        {/* ✅ Actions — only rendered if at least one permission exists */}
                        {showActionsCol && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {/* ✅ Edit — only if canUpdate */}
                              {showEditCol && (
                                <button
                                  onClick={() => openEdit(m)}
                                  title="Edit"
                                  style={{
                                    background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                                    borderRadius: 7, padding: '4px 10px', fontSize: 12,
                                    color: 'var(--primary)', cursor: 'pointer',
                                  }}
                                >
                                  <i className="fa-solid fa-pen" />
                                </button>
                              )}
                              {/* ✅ Delete — only if canDelete */}
                              {showDeleteCol && (
                                <button
                                  onClick={() => handleDelete(m._id, m.name)}
                                  title="Delete"
                                  style={{
                                    background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                                    borderRadius: 7, padding: '4px 10px', fontSize: 12,
                                    color: '#dc2626', cursor: 'pointer',
                                  }}
                                >
                                  <i className="fa-solid fa-trash" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={showActionsCol ? 11 : 10} className="text-center py-5"
                        style={{ color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-pills fa-2x d-block mb-2" />
                        {search || filterCat || filterStock
                          ? 'No medicines match your filters'
                          : 'No medicines yet — click "Add Medicine" to get started'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && (
            <Pagination 
              page={page} 
              total={filtered.length} 
              limit={limit} 
              onPageChange={setPage} 
              onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            />
          )}
        </div>

        {/* ── Add / Edit Modal — only if canCreate or canUpdate ── */}
        {(canCreate('medicine-inventory') || canUpdate('medicine-inventory')) && (
          <Modal
            show={showModal}
            onClose={closeModal}
            title={editId ? '✏️ Edit Medicine' : '💊 Add Medicine'}
            size="xl"
            footer={<>
              <button onClick={closeModal} style={{
                background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)',
              }}>Cancel</button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Saving...</>
                  : <><i className="fa-solid fa-floppy-disk" />{editId ? 'Update' : 'Add Medicine'}</>
                }
              </button>
            </>}
          >
            <div className="row g-3">

              {/* Row 1 */}
              <div className="col-md-5">
                <label className="form-label">Medicine Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => f('name', e.target.value)}
                  placeholder="e.g. Paracetamol 500mg" list="medicine-names" required />
                <datalist id="medicine-names">
                  {[...new Set(medicines.map(m => m.name))].map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div className="col-md-4">
                <label className="form-label">Generic Name</label>
                <input className="form-control" value={form.genericName}
                  onChange={e => f('genericName', e.target.value)}
                  placeholder="e.g. Acetaminophen" list="generic-names" />
                <datalist id="generic-names">
                  {[...new Set(medicines.map(m => m.genericName).filter(Boolean))].map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div className="col-md-3">
                <label className="form-label">Manufacturer</label>
                <input className="form-control" value={form.manufacturer}
                  onChange={e => f('manufacturer', e.target.value)}
                  placeholder="e.g. Cipla Ltd." />
              </div>

              {/* Row 2 */}
              <div className="col-md-3">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => f('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => f('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Batch Number</label>
                <input className="form-control" value={form.batchNumber}
                  onChange={e => f('batchNumber', e.target.value)}
                  placeholder="e.g. BTH-20261" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Expiry Date</label>
                <input type="date" className="form-control" value={form.expiryDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => f('expiryDate', e.target.value)} />
              </div>

              {/* Row 3 */}
              <div className="col-md-3">
                <label className="form-label">Current Stock</label>
                <input type="number" className="form-control" value={form.stock}
                  onChange={e => f('stock', e.target.value === '' ? '' : +e.target.value)} min={0} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Min Stock Level</label>
                <input type="number" className="form-control" value={form.minStockLevel}
                  onChange={e => f('minStockLevel', e.target.value === '' ? '' : +e.target.value)} min={0} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Purchase Price ₹</label>
                <input type="number" className="form-control" value={form.purchasePrice}
                  onChange={e => f('purchasePrice', e.target.value === '' ? '' : +e.target.value)} min={0} step="0.01" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Selling Price ₹</label>
                <input type="number" className="form-control" value={form.sellingPrice}
                  onChange={e => f('sellingPrice', e.target.value === '' ? '' : +e.target.value)} min={0} step="0.01" />
              </div>

              {/* Margin preview */}
              {form.purchasePrice > 0 && form.sellingPrice > 0 && (
                <div className="col-12">
                  <div style={{
                    padding: '10px 16px', borderRadius: 10,
                    background: form.sellingPrice >= form.purchasePrice
                      ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${form.sellingPrice >= form.purchasePrice
                      ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                  }}>
                    <i className="fa-solid fa-chart-line"
                      style={{ color: form.sellingPrice >= form.purchasePrice ? '#16a34a' : '#dc2626' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Profit margin:{' '}
                      <strong style={{ color: form.sellingPrice >= form.purchasePrice ? '#16a34a' : '#dc2626' }}>
                        {Math.round(((form.sellingPrice - form.purchasePrice) / form.purchasePrice) * 100)}%
                        {' '}(₹{(form.sellingPrice - form.purchasePrice).toFixed(2)} per unit)
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="col-md-6">
                <label className="form-label">Supplier Name</label>
                <input className="form-control" value={form.supplier}
                  onChange={e => f('supplier', e.target.value)}
                  placeholder="e.g. ABC Pharma" list="supplier-names" />
                <datalist id="supplier-names">
                  {[...new Set(medicines.map(m => m.supplier).filter(Boolean))].map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="col-md-6">
                <label className="form-label">Description / Storage Instructions</label>
                <input className="form-control" value={form.description}
                  onChange={e => f('description', e.target.value)}
                  placeholder="e.g. Store below 25°C, away from light" />
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

Medicines.getLayout = (page) => <Layout>{page}</Layout>;