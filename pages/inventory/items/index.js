import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import StatCard from '../../../components/ui/StatCard';
import Modal from '../../../components/ui/Modal';
import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';                                  // ✅ Added
import { usePermission } from '../../../hooks/usePermission';  // ✅ Added
import Pagination from '../../../components/ui/Pagination';
import { confirmAction } from '../../../utils/sweetAlert';

const CATEGORIES = ['Surgical', 'Linen', 'Equipment', 'Stationery', 'Medical Supplies', 'Cleaning', 'Office', 'Lab', 'Other'];
const UNITS      = ['Pieces', 'Box', 'Kg', 'Litre', 'Pack', 'Roll', 'Set', 'Strip', 'Bottle'];
const DEPTS      = ['OPD', 'IPD', 'ICU', 'Pharmacy', 'Lab', 'Operation Theatre', 'Admin', 'Housekeeping', 'Store'];

const CAT_COLORS = {
  Surgical: '#dc2626', Linen: '#7c3aed', Equipment: '#0891b2',
  Stationery: '#d97706', 'Medical Supplies': '#16a34a',
  Cleaning: '#059669', Office: '#6b7280', Lab: '#db2777', Other: '#9ca3af',
};

const EMPTY_FORM = {
  name: '', code: '', category: '', department: '', unit: '',
  stock: 0, minStockLevel: 5, purchasePrice: 0,
  location: '', isActive: true,
};

export default function ItemMaster() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [items,      setItems]      = useState([]);
  const [stats,      setStats]      = useState({ totalItems: 0, inStock: 0, wellStocked: 0, lowStock: 0, outOfStock: 0, categories: 0, departments: 0, totalValue: 0 });
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [limit,      setLimit]      = useState(15);

  // ✅ Final action flags
  const showAddItem  = !permLoading && canCreate('item-master');
  const showEdit     = !permLoading && canUpdate('item-master');
  const showDelete   = !permLoading && canDelete('item-master');
  const showActions  = showEdit || showDelete; // controls Actions column visibility

  const fetchAll = () => {
    setLoading(true);
    const query = `search=${search}&category=${filterCat}&department=${filterDept}`;
    api.get(`/inventory/items?page=${page}&limit=${limit}&${query}`)
      .then(res => {
        setItems(res.data?.data || []);
        setTotal(res.data?.total || 0);
      })
      .finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('item-master')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading, page, limit, filterCat, filterDept]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('item-master')) {
        setPage(1);
        fetchAll();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, filterCat, filterDept]);

  // ── Stats ──────────────────────────────────────────────────
  const lowStock   = items.filter(i => i.stock > 0 && i.stock <= (i.minStockLevel || 5));
  const outOfStock = items.filter(i => i.stock === 0);
  const inStock    = items.filter(i => i.stock > (i.minStockLevel || 5)); // well stocked
  const totalValue = items.reduce((s, i) => s + ((i.stock || 0) * (i.purchasePrice || 0)), 0);
  const cats       = [...new Set(items.map(i => i.category).filter(Boolean))];
  const depts      = [...new Set(items.map(i => i.department).filter(Boolean))];

  const statCards = [
    {
      icon: 'fa-box', label: 'Total Items', value: total,
      color: '#16a34a', sub: 'Registered products',
      change: `${inStock.length} well stocked`, changeType: 'up', delay: 0,
    },
    {
      icon: 'fa-circle-xmark', label: 'Out of Stock', value: outOfStock.length,
      color: '#dc2626', sub: 'Zero quantity',
      change: outOfStock.length > 0 ? 'Needs restocking' : 'All available',
      changeType: outOfStock.length > 0 ? 'down' : 'neutral', delay: 1,
    },
    {
      icon: 'fa-triangle-exclamation', label: 'Low Stock', value: lowStock.length,
      color: '#d97706', sub: 'Below min level',
      change: lowStock.length > 0 ? 'Reorder soon' : 'Good levels',
      changeType: lowStock.length > 0 ? 'down' : 'neutral', delay: 2,
    },
    {
      icon: 'fa-check-circle', label: 'In Stock', value: inStock.length,
      color: '#10b981', sub: 'Well stocked items',
      change: 'Healthy levels', changeType: 'up', delay: 3,
    },
    {
      icon: 'fa-tags', label: 'Categories', value: cats.length,
      color: '#7c3aed', sub: 'Item categories',
      change: `${CATEGORIES.length} available`, changeType: 'neutral', delay: 4,
    },
    {
      icon: 'fa-indian-rupee-sign', label: 'Stock Value', value: totalValue,
      color: '#059669', prefix: '₹', sub: 'At purchase price',
      change: 'Current page', changeType: 'up', delay: 5,
    },
  ];

  // ── Modal helpers ──────────────────────────────────────────
  const openAdd = () => {
    if (!canCreate('item-master')) return toast.error('You do not have permission to add items.');
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    if (!canUpdate('item-master')) return toast.error('You do not have permission to edit items.');
    setEditId(item._id);
    setForm({
      name:          item.name          || '',
      code:          item.code          || '',
      category:      item.category      || '',
      department:    item.department    || '',
      unit:          item.unit          || '',
      stock:         item.stock         ?? 0,
      minStockLevel: item.minStockLevel ?? 5,
      purchasePrice: item.purchasePrice ?? 0,
      location:      item.location      || '',
      vendor:        item.vendor?._id || item.vendor || '',
      isActive:      item.isActive      !== false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    // ✅ Double-check create/update permission before submitting
    if (editId && !canUpdate('item-master')) return toast.error('You do not have permission to update items.');
    if (!editId && !canCreate('item-master')) return toast.error('You do not have permission to add items.');
    if (!form.name)     return toast.error('Item name is required');
    if (!/[a-zA-Z]/.test(form.name)) return toast.error('Item name must contain letters');
    if (!form.category) return toast.error('Category is required');
    if (!/[a-zA-Z]/.test(form.category)) return toast.error('Category must contain letters');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.vendor) delete payload.vendor; // Don't send empty strings for vendor (ObjectId)

      if (editId) {
        await api.put(`/inventory/items/${editId}`, payload);
        toast.success('Item updated successfully!');
      } else {
        await api.post('/inventory/items', payload);
        toast.success('Item added successfully!');
      }
      closeModal();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete (soft) ──────────────────────────────────────────
  const handleDelete = async (id, name) => {
    // ✅ Double-check delete permission
    if (!canDelete('item-master')) return toast.error('You do not have permission to delete items.');
    if (!await confirmAction('Deactivate Item?', `Deactivate "${name}"? It will be hidden from the list.`, 'Yes, deactivate')) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      toast.success('Item deactivated');
      fetchAll();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Stock color helper ─────────────────────────────────────
  const getStockStyle = (item) => {
    if (item.stock === 0)                 return { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',  label: 'Out of Stock' };
    if (item.stock <= item.minStockLevel) return { c: '#d97706', bg: 'rgba(217,119,6,0.1)',  label: 'Low Stock'    };
    return { c: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'In Stock' };
  };

  // ── Filtered list ──────────────────────────────────────────
  const filtered = items; // Handled on backend

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Item Master" path="/inventory/items" />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin fa-2x d-block mb-3" />
            Checking permissions…
          </div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!canRead('item-master')) {
    return (
      <>
        <SEOHead title="Item Master" path="/inventory/items" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view inventory items.</p>
          <Link href="/"
            style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Item Master" path="/inventory/items" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
              <i className="fa-solid fa-box me-3" style={{ color: 'var(--primary)' }} />
              Item Master
            </h4>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
              {total} items registered · {depts.length} departments
            </p>
          </div>
          {/* ✅ Add Item button — only if showAddItem */}
          {showAddItem && (
            <button className="btn-primary-custom" onClick={openAdd}>
              <i className="fa-solid fa-plus" />Add Item
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
            <button
              onClick={() => setFilterCat('')}
              style={{
                padding: '6px 16px', borderRadius: 30, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                border: `1.5px solid ${!filterCat ? 'var(--primary)' : 'var(--border-color)'}`,
                background: !filterCat ? 'var(--primary-glow)' : 'var(--card-bg)',
                color: !filterCat ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              All
            </button>
            {cats.map(cat => {
              const color  = CAT_COLORS[cat] || '#6b7280';
              const active = filterCat === cat;
              const count  = items.filter(i => i.category === cat).length;
              return (
                <button key={cat} onClick={() => setFilterCat(active ? '' : cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 30, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    border: `1.5px solid ${active ? color : 'var(--border-color)'}`,
                    background: active ? `${color}15` : 'var(--card-bg)',
                    color: active ? color : 'var(--text-muted)',
                  }}
                >
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
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Items</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name / code / location..."
                className="form-control"
                style={{ maxWidth: 230, fontSize: 13 }}
              />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="form-select" style={{ maxWidth: 150, fontSize: 13 }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="form-select" style={{ maxWidth: 160, fontSize: 13 }}>
                <option value="">All Departments</option>
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x d-block mb-3" />Loading items...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Code</th>
                    <th>Category</th>
                    <th>Department</th>
                    <th>Stock</th>
                    <th>Min Level</th>
                    <th>Purchase ₹</th>
                    <th>Value ₹</th>
                    <th>Location</th>
                    <th>Status</th>
                    {/* ✅ Actions column header — only if at least one action is allowed */}
                    {showActions && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const sc       = getStockStyle(item);
                    const catColor = CAT_COLORS[item.category] || '#6b7280';
                    const value    = ((item.stock || 0) * (item.purchasePrice || 0));
                    return (
                      <tr key={item._id}>

                        {/* Name */}
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                            {item.name}
                          </div>
                          {item.unit && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Unit: {item.unit}
                            </div>
                          )}
                        </td>

                        {/* Code */}
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                            color: 'var(--text-muted)', fontFamily: 'monospace',
                            background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: 6,
                          }}>
                            {item.code || '—'}
                          </span>
                        </td>

                        {/* Category */}
                        <td>
                          <span style={{
                            background: `${catColor}15`, color: catColor,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: catColor }} />
                            {item.category || '—'}
                          </span>
                        </td>

                        {/* Department */}
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.department || '—'}
                        </td>

                        {/* Stock */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: 16, color: sc.c, minWidth: 28 }}>
                              {item.stock ?? 0}
                            </strong>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {item.unit || 'pcs'}
                            </span>
                          </div>
                          {/* Mini stock bar */}
                          <div style={{ height: 3, width: 60, background: 'var(--border-color)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, Math.round(((item.stock || 0) / Math.max((item.minStockLevel || 5) * 2, 1)) * 100))}%`,
                              background: sc.c, borderRadius: 10,
                            }} />
                          </div>
                        </td>

                        {/* Min Level */}
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {item.minStockLevel ?? 5}
                        </td>

                        {/* Purchase Price */}
                        <td style={{ fontSize: 13 }}>
                          {item.purchasePrice ? `₹${item.purchasePrice.toFixed(2)}` : '—'}
                        </td>

                        {/* Stock Value */}
                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
                          {value > 0 ? `₹${value.toLocaleString('en-IN')}` : '—'}
                        </td>

                        {/* Location */}
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.location
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-location-dot" style={{ fontSize: 10 }} />
                                {item.location}
                              </span>
                            : '—'
                          }
                        </td>



                        {/* Status badge */}
                        <td>
                          <span style={{
                            background: sc.bg, color: sc.c,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 10, fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {sc.label}
                          </span>
                        </td>

                        {/* ✅ Actions — only if showActions */}
                        {showActions && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {/* ✅ Edit — only if showEdit */}
                              {showEdit && (
                                <button onClick={() => openEdit(item)}
                                  title="Edit item"
                                  style={{
                                    background: 'var(--primary-glow)',
                                    border: '1px solid var(--primary)',
                                    borderRadius: 7, padding: '4px 10px',
                                    fontSize: 12, color: 'var(--primary)', cursor: 'pointer',
                                  }}>
                                  <i className="fa-solid fa-pen" />
                                </button>
                              )}
                              {/* ✅ Delete — only if showDelete */}
                              {showDelete && (
                                <button onClick={() => handleDelete(item._id, item.name)}
                                  title="Deactivate item"
                                  style={{
                                    background: 'rgba(220,38,38,0.08)',
                                    border: '1px solid rgba(220,38,38,0.2)',
                                    borderRadius: 7, padding: '4px 10px',
                                    fontSize: 12, color: '#dc2626', cursor: 'pointer',
                                  }}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={showActions ? 12 : 11} className="text-center py-5"
                        style={{ color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-box fa-2x d-block mb-2" />
                        {search || filterCat || filterDept
                          ? 'No items match your filters'
                          : 'No items yet — click "Add Item" to get started'
                        }
                      </td>
                    </tr>
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

        {/* ── Add / Edit Modal ── */}
        <Modal
          show={showModal}
          onClose={closeModal}
          title={editId ? '✏️ Edit Item' : '📦 Add New Item'}
          size="xl"
          footer={<>
            <button onClick={closeModal} style={{
              background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
              borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
              Cancel
            </button>
            <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin" />Saving...</>
                : <><i className="fa-solid fa-floppy-disk" />{editId ? 'Update Item' : 'Add Item'}</>
              }
            </button>
          </>}
        >
          <div className="row g-3">

            {/* Name */}
            <div className="col-md-5">
              <label className="form-label">Item Name *</label>
              <input className="form-control" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Surgical Gloves Size M" required list="item-names-list" />
              <datalist id="item-names-list">
                {[...new Set(items.map(i => i.name).filter(Boolean))].map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Code */}
            <div className="col-md-3">
              <label className="form-label">Item Code</label>
              <input className="form-control" value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="Auto-generated if empty" />
            </div>

            {/* Category */}
            <div className="col-md-4">
              <label className="form-label">Category *</label>
              <input className="form-control" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })} 
                placeholder="Select or type category" required list="category-list" />
              <datalist id="category-list">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
                {[...new Set(items.map(i => i.category).filter(c => c && !CATEGORIES.includes(c)))].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Department */}
            <div className="col-md-4">
              <label className="form-label">Department</label>
              <input className="form-control" value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })} 
                placeholder="Select or type department" list="dept-list" />
              <datalist id="dept-list">
                {DEPTS.map(d => <option key={d} value={d} />)}
                {[...new Set(items.map(i => i.department).filter(d => d && !DEPTS.includes(d)))].map(d => <option key={d} value={d} />)}
              </datalist>
            </div>

            {/* Unit */}
            <div className="col-md-4">
              <label className="form-label">Unit</label>
              <input className="form-control" value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })} 
                placeholder="Select or type unit" list="unit-list" />
              <datalist id="unit-list">
                {UNITS.map(u => <option key={u} value={u} />)}
                {[...new Set(items.map(i => i.unit).filter(u => u && !UNITS.includes(u)))].map(u => <option key={u} value={u} />)}
              </datalist>
            </div>

            {/* Location */}
            <div className="col-md-4">
              <label className="form-label">Storage Location</label>
              <input className="form-control" value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Rack A, Store Room 2" />
            </div>

            {/* Stock */}
            <div className="col-md-3">
              <label className="form-label">Current Stock</label>
              <input type="number" className="form-control" value={form.stock}
                onChange={e => setForm({ ...form, stock: +e.target.value })} min={0} />
            </div>

            {/* Min Stock */}
            <div className="col-md-3">
              <label className="form-label">Min Stock Level</label>
              <input type="number" className="form-control" value={form.minStockLevel}
                onChange={e => setForm({ ...form, minStockLevel: +e.target.value })} min={0} />
            </div>

            {/* Purchase Price */}
            <div className="col-md-3">
              <label className="form-label">Purchase Price ₹</label>
              <input type="number" className="form-control" value={form.purchasePrice}
                onChange={e => setForm({ ...form, purchasePrice: +e.target.value })}
                min={0} step="0.01" />
            </div>

            {/* isActive (edit only) */}
            {editId && (
              <div className="col-12">
                <label className="form-label">Status</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {[true, false].map(val => (
                    <button key={String(val)} type="button"
                      onClick={() => setForm({ ...form, isActive: val })}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600,
                        fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                        border: `1.5px solid ${form.isActive === val
                          ? (val ? '#16a34a' : '#dc2626')
                          : 'var(--border-color)'}`,
                        background: form.isActive === val
                          ? (val ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)')
                          : 'var(--hover-bg)',
                        color: form.isActive === val
                          ? (val ? '#16a34a' : '#dc2626')
                          : 'var(--text-muted)',
                      }}>
                      <i className={`fa-solid ${val ? 'fa-circle-check' : 'fa-circle-xmark'} me-2`} />
                      {val ? 'Active' : 'Inactive'}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </Modal>
      </div>

      <style>{`
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        @media (max-width: 1200px) { .stat-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}

ItemMaster.getLayout = (page) => <Layout>{page}</Layout>;