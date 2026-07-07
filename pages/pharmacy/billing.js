import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import Modal from '../../components/ui/Modal';
import { useEffect, useState } from 'react';
import BackButton from '../../components/ui/BackButton'; // ✅ Added
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added
import Pagination from '../../components/ui/Pagination';
import { confirmAction } from '../../utils/sweetAlert';

export default function PharmacyBilling() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [medicines,  setMedicines]  = useState([]);
  const [patients,   setPatients]   = useState([]);
  const [bills,      setBills]      = useState([]);
  const [stores,     setStores]     = useState([]);
  const [loading,    setLoading]    = useState(true); // ✅ Added loading state
  const [showModal,  setShowModal]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [editId,     setEditId]     = useState(null);
  const [page,       setPage]       = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit,      setLimit]      = useState(10);
  const [form, setForm] = useState({
    patient: '', pharmacyStore: '', paymentMethod: 'Cash', discount: 0,
    items: [{ medicine: '', name: '', quantity: 1, unitPrice: 0, total: 0 }]
  });

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('pharmacy-billing')) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get('/medicines?limit=1000'),
      api.get('/patients?limit=1000'),
      api.get(`/pharmacy-bills?page=${page}&limit=${limit}&search=${search}`),
      api.get('/pharmacy-stores?limit=1000').catch(() => ({ data: { data: [] } }))
    ]).then(([m, p, b, s]) => {
      setMedicines(m.data.data || []);
      setPatients(p.data.data  || []);
      setBills(b.data.data     || []);
      setTotalCount(b.data.total || 0);
      setStores(s.data.data    || []);
    }).finally(() => setLoading(false));
  }, [permLoading, page, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('pharmacy-billing')) {
        setPage(1);
        // Force refresh for search
        api.get(`/pharmacy-bills?page=1&limit=${limit}&search=${search}`).then(res => {
          setBills(res.data.data || []);
          setTotalCount(res.data.total || 0);
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Medicine helpers ──────────────────────────────────────
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i][field] = val;
    
    // If selecting by name (datalist), try to find the real medicine to auto-fill price
    if (field === 'name') {
      const med = medicines.find(m => m.name === val);
      if (med) {
        items[i].medicine = med._id;
        items[i].unitPrice = med.sellingPrice;
      } else {
        items[i].medicine = null; // Custom medicine (must be null, not empty string)
      }
    }
    
    items[i].total = (items[i].quantity || 0) * (items[i].unitPrice || 0);
    setForm({ ...form, items });
  };

  const updateQty = (i, qty) => updateItem(i, 'quantity', qty);

  const addItem    = () => setForm({ ...form, items: [...form.items, { medicine: null, name: '', quantity: 1, unitPrice: 0, total: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal   = form.items.reduce((s, i) => s + i.total, 0);
  const grandTotal = subtotal - (parseFloat(form.discount) || 0);

  // ── Submit ────────────────────────────────────────────────
  const openEdit = (b) => {
    setEditId(b._id);
    setForm({
      patient: b.patient?._id || b.patient || '',
      pharmacyStore: b.pharmacyStore?._id || b.pharmacyStore || '',
      paymentMethod: b.paymentMethod || 'Cash',
      discount: b.discount || 0,
      items: b.items.map(i => ({
        medicine: i.medicine?._id || i.medicine,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total
      }))
    });
    setShowModal(true);
  };

  const handleDelete = async (id, num) => {
    if (!canDelete('pharmacy-billing')) return toast.error('No permission to delete');
    if (!await confirmAction('Delete Bill?', `Delete bill ${num}? This will reverse stock.`, 'Yes, delete')) return;
    try {
      await api.delete(`/pharmacy-bills/${id}`);
      toast.success('Bill deleted');
      const res = await api.get('/pharmacy-bills');
      setBills(res.data.data || []);
    } catch { toast.error('Delete failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId && !canUpdate('pharmacy-billing')) return toast.error('No permission to edit');
    if (!editId && !canCreate('pharmacy-billing')) return toast.error('No permission to create');
    if (!form.items[0].name) return toast.error('Select at least one medicine');
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/pharmacy-bills/${editId}`, form);
        toast.success('Bill updated!');
      } else {
        await api.post('/pharmacy-bills', form);
        toast.success('Pharmacy bill created!');
      }
      setShowModal(false);
      setEditId(null);
      setForm({
        patient: '', pharmacyStore: '', paymentMethod: 'Cash', discount: 0,
        items: [{ medicine: null, name: '', quantity: 1, unitPrice: 0, total: 0 }],
      });
      const res = await api.get(`/pharmacy-bills?page=${page}&limit=${limit}&search=${search}`);
      setBills(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      toast.error(err.friendlyMessage || 'Failed');
    } finally { setSubmitting(false); }
  };

  // ── Filter ────────────────────────────────────────────────
  const filtered = bills; // Handled on backend

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Pharmacy Billing" path="/pharmacy/billing" />
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
  if (!canRead('pharmacy-billing')) {
    return (
      <>
        <SEOHead title="Pharmacy Billing" path="/pharmacy/billing" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Pharmacy Billing.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Pharmacy Billing" path="/pharmacy/billing" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pharmacy Billing</h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {totalCount} bills generated
              </p>
            </div>
          </div>
          {/* ✅ New Bill button — only if canCreate */}
          {canCreate('pharmacy-billing') && (
            <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" />New Pharmacy Bill
            </button>
          )}
        </div>

        {/* ── Bills Table ── */}
        <div className="content-card">
          <div className="card-header-custom">
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Pharmacy Bills</h6>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bill or patient..."
              className="form-control"
              style={{ maxWidth: 240, fontSize: 13 }}
            />
          </div>

          {/* ✅ Skeleton while loading */}
          {loading ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Bill No.</th><th>Patient</th><th>Pharmacy Store</th><th>Items</th><th>Subtotal</th>
                    <th>Discount</th><th>Total</th><th>Method</th><th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j}>
                          <div className="skel" style={{ height: 14, borderRadius: 6 }} />
                        </td>
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
                    <th>Bill No.</th><th>Patient</th><th>Pharmacy Store</th><th>Items</th><th>Subtotal</th>
                    <th>Discount</th><th>Total</th><th>Method</th><th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b._id}>
                      <td><span className="badge-primary-custom">{b.billNumber}</span></td>
                      <td>
                        <strong>{b.patient?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</strong>
                      </td>
                      <td>{b.pharmacyStore?.name || '-'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{b.items?.length}</td>
                      <td>₹{b.subtotal?.toLocaleString('en-IN')}</td>
                      <td style={{ color: '#16a34a' }}>- ₹{b.discount || 0}</td>
                      <td><strong style={{ color: 'var(--primary)' }}>₹{b.totalAmount?.toLocaleString('en-IN')}</strong></td>
                      <td><span className="badge-info-custom">{b.paymentMethod}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canUpdate('pharmacy-billing') && (
                            <button onClick={() => openEdit(b)} title="Edit" style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          {canDelete('pharmacy-billing') && (
                            <button onClick={() => handleDelete(b._id, b.billNumber)} title="Delete" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-receipt fa-2x d-block mb-2" />
                        {search ? 'No matching bills found' : 'No bills generated yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination 
            page={page} 
            total={totalCount} 
            limit={limit} 
            onPageChange={setPage} 
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>

        {/* ── New Bill Modal — only if canCreate ── */}
        {canCreate('pharmacy-billing') && (
          <Modal
            show={showModal}
            onClose={() => { setShowModal(false); setEditId(null); }}
            title={editId ? "✏️ Edit Pharmacy Bill" : "💊 New Pharmacy Bill"}
            size="xl"
            footer={<>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin me-2" />Creating...</>
                  : <><i className="fa-solid fa-receipt me-1" />Create Bill</>
                }
              </button>
            </>}
          >
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">
                  Patient{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional — walk-in allowed)</span>
                </label>
                <select
                  className="form-select"
                  value={form.patient}
                  onChange={e => setForm({ ...form, patient: e.target.value })}
                >
                  <option value="">Walk-in / No Patient</option>
                  {patients.map(p => (
                    <option key={p._id} value={p._id}>{p.name} — {p.patientId}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Pharmacy Store</label>
                <select
                  className="form-select"
                  value={form.pharmacyStore}
                  onChange={e => setForm({ ...form, pharmacyStore: e.target.value })}
                >
                  <option value="">Select Store (Optional)</option>
                  {stores.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Payment</label>
                <select
                  className="form-select"
                  value={form.paymentMethod}
                  onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  {['Cash', 'UPI', 'Card', 'Pending'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Discount (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.discount}
                  onChange={e => setForm({ ...form, discount: e.target.value })}
                />
              </div>
            </div>

            {/* ── Medicine Items ── */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'var(--hover-bg)', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Medicine Items</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--hover-bg)' }}>
                    {['Medicine', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 12px', fontSize: 11, fontWeight: 700,
                        color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: 0.8, textAlign: 'left',
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          className="form-control"
                          value={item.name}
                          onChange={e => updateItem(i, 'name', e.target.value)}
                          placeholder="Type or select medicine..."
                          list={`med-list-${i}`}
                          style={{ fontSize: 13 }}
                        />
                        <datalist id={`med-list-${i}`}>
                          {medicines.map(m => (
                            <option key={m._id} value={m.name}>{m.name} (Stock: {m.stock})</option>
                          ))}
                        </datalist>
                      </td>
                      <td style={{ padding: '8px 6px', width: 80 }}>
                        <input
                          type="number"
                          className="form-control"
                          value={item.quantity}
                          min={1}
                          max={item.medicine ? medicines.find(m => m._id === item.medicine)?.stock : 999}
                          onChange={e => updateQty(i, +e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', width: 110 }}>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₹</span>
                          <input
                            type="number"
                            className="form-control"
                            value={item.unitPrice}
                            onChange={e => updateItem(i, 'unitPrice', +e.target.value)}
                            style={{ fontSize: 13, fontWeight: 600 }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', width: 110, fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{item.total.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 6px', width: 40 }}>
                        {form.items.length > 1 && (
                          <button
                            onClick={() => removeItem(i)}
                            style={{
                              background: 'rgba(239,68,68,0.1)', border: 'none',
                              borderRadius: 6, padding: '4px 8px',
                              cursor: 'pointer', color: '#dc2626', fontSize: 12,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{
                padding: '10px 12px', borderTop: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <button
                  onClick={addItem}
                  style={{
                    background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                    borderRadius: 8, padding: '6px 14px', color: 'var(--primary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-plus me-1" />Add Medicine
                </button>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Subtotal: <strong>₹{subtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>
                    Total: ₹{grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

      </div>

      <style>{`
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

PharmacyBilling.getLayout = (page) => <Layout>{page}</Layout>;