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

export default function Billing() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [bills,        setBills]        = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [editId,       setEditId]       = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [limit,        setLimit]        = useState(15);
  const [form, setForm] = useState({
    patient: '', type: 'OPD', paymentMethod: 'Cash',
    discount: 0, tax: 0, amountPaid: 0,
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/bills?page=${page}&limit=${limit}&search=${search}&status=${filterStatus}`),
      api.get('/patients?limit=300')
    ])
      .then(([b, p]) => {
        setBills(b.data.data     || []);
        setTotal(b.data.total    || 0);
        setPatients(p.data.data  || []);
      })
      .finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('bills')) { setLoading(false); return; }
    fetchData();
  }, [permLoading, page, limit, filterStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('bills')) {
        setPage(1);
        fetchData();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, filterStatus]);

  // ── Stats ──
  const today      = new Date().toDateString();
  const todayBills = bills.filter(b => new Date(b.createdAt).toDateString() === today);
  const todayRev   = todayBills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const totalRev   = bills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const pending    = bills.filter(b => b.paymentStatus === 'pending' || b.paymentStatus === 'partial');
  const pendingAmt = pending.reduce((s, b) => s + (b.balance || 0), 0);

  // ── Item helpers ──
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i][field] = val;
    if (field === 'quantity' || field === 'unitPrice')
      items[i].total = items[i].quantity * items[i].unitPrice;
    setForm({ ...form, items });
  };
  const addItem    = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0, total: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal    = form.items.reduce((s, i) => s + (i.total || 0), 0);
  const taxAmount   = subtotal * (parseFloat(form.tax) || 0) / 100;
  const totalAmount = subtotal - (parseFloat(form.discount) || 0) + taxAmount;
  const balance     = totalAmount - (parseFloat(form.amountPaid) || 0);

  const openEdit = (b) => {
    setEditId(b._id);
    setForm({
      patient: b.patient?._id || b.patient || '',
      type: b.type || 'OPD',
      paymentMethod: b.paymentMethod || 'Cash',
      discount: b.discount || 0,
      tax: b.tax || 0,
      amountPaid: b.amountPaid || 0,
      items: b.items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total
      }))
    });
    setShowModal(true);
  };

  const handleDelete = async (id, num) => {
    if (!canDelete('billing')) return toast.error('No permission to delete bills');
    if (!await confirmAction('Delete Bill?', `Delete bill ${num}? This cannot be undone.`, 'Yes, delete')) return;
    try {
      await api.delete(`/bills/${id}`);
      toast.success('Bill deleted');
      fetchData();
    } catch { toast.error('Delete failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient)              return toast.error('Select a patient');
    if (!form.items[0].description) return toast.error('Add at least one item');
    
    // ✅ Permission check
    if (editId && !canUpdate('billing')) return toast.error('No permission to edit bills');
    if (!editId && !canCreate('billing')) return toast.error('No permission to create bills');

    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/bills/${editId}`, {
          ...form, subtotal, totalAmount,
          balance: Math.max(0, balance),
          items: form.items.map(i => ({ ...i, total: i.quantity * i.unitPrice }))
        });
        toast.success('Bill updated!');
      } else {
        const billNum = `BILL-${new Date().getFullYear()}-${String(bills.length + 1).padStart(5, '0')}`;
        await api.post('/bills', {
          ...form, subtotal, totalAmount,
          balance: Math.max(0, balance),
          billNumber: billNum,
          items: form.items.map(i => ({ ...i, total: i.quantity * i.unitPrice }))
        });
        toast.success('Bill created!');
      }
      setShowModal(false);
      setEditId(null);
      setForm({ patient: '', type: 'OPD', paymentMethod: 'Cash', discount: 0, tax: 0, amountPaid: 0, items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }] });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const filtered = bills; // Handled on backend

  const statCards = [
    { icon: 'fa-file-invoice-dollar', label: 'Total Bills',     value: total,      color: '#16a34a', sub: 'All time',          delay: 0 },
    { icon: 'fa-calendar-day',        label: "Today's Bills",   value: todayBills.length, color: '#0891b2', sub: 'Generated today',   delay: 1 },
    { icon: 'fa-indian-rupee-sign',   label: "Today's Revenue", value: todayRev,           color: '#7c3aed', prefix: '₹', sub: 'Collected today', delay: 2 },
    { icon: 'fa-coins',               label: 'Total Collected', value: totalRev,           color: '#059669', prefix: '₹', sub: 'All time',        delay: 3 },
    { icon: 'fa-clock-rotate-left',   label: 'Pending Balance', value: pendingAmt,         color: '#dc2626', prefix: '₹',
      change: `${pending.length} bills`, changeType: pending.length > 0 ? 'down' : 'neutral', sub: 'Outstanding dues', delay: 4 },
    { icon: 'fa-circle-check',        label: 'Paid Bills',
      value: bills.filter(b => b.paymentStatus === 'paid').length, color: '#16a34a',
      change: `${Math.round((bills.filter(b => b.paymentStatus === 'paid').length / Math.max(bills.length, 1)) * 100)}% rate`,
      changeType: 'up', sub: 'Fully settled', delay: 5 },
  ];

  // ✅ Access Denied screen
  if (!permLoading && !canRead('billing')) {
    return (
      <>
        <SEOHead title="Billing" path="/billing" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Billing.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Billing" path="/billing" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-file-invoice-dollar me-3" style={{ color: 'var(--primary)' }} />Billing
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>{total} total bills</p>
            </div>
          </div>
          {/* ✅ Only show New Bill button if canCreate */}
          {!permLoading && canCreate('billing') && (
            <button className="btn-primary-custom" onClick={() => {
              setForm({ patient: '', type: 'OPD', paymentMethod: 'Cash', discount: 0, tax: 0, amountPaid: 0, items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }] });
              setEditId(null);
              setShowModal(true);
            }}>
              <i className="fa-solid fa-plus" />New Bill
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Table ── */}
        <div className="content-card">
          <div className="card-header-custom">
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Bills</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search bill / patient..." className="form-control"
                style={{ maxWidth: 220, fontSize: 13 }}
              />
              <select
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="form-select" style={{ maxWidth: 140, fontSize: 13 }}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-custom w-100">
              <thead>
                <tr>
                  <th>Bill No.</th><th>Patient</th><th>Type</th><th>Total</th>
                  <th>Paid</th><th>Balance</th><th>Method</th><th>Status</th>
                  <th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {/* ✅ Skeleton while loading data OR permissions */}
                {(loading || permLoading) ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j}><div className="skel" style={{ height: 14, borderRadius: 6 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-file-invoice fa-2x d-block mb-2" />No bills found
                    </td>
                  </tr>
                ) : (
                  filtered.map(b => (
                    <tr key={b._id}>
                      <td><span className="badge-primary-custom">{b.billNumber}</span></td>
                      <td>
                        <strong>{b.patient?.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.patient?.patientId}</div>
                      </td>
                      <td><span className="badge-info-custom">{b.type}</span></td>
                      <td><strong>₹{b.totalAmount?.toLocaleString('en-IN')}</strong></td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>₹{b.amountPaid?.toLocaleString('en-IN')}</td>
                      <td style={{ color: b.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        ₹{b.balance?.toLocaleString('en-IN')}
                      </td>
                      <td><span className="badge-info-custom">{b.paymentMethod}</span></td>
                      <td>
                        <span className={
                          b.paymentStatus === 'paid'    ? 'badge-success-custom' :
                          b.paymentStatus === 'partial' ? 'badge-warning-custom' :
                          'badge-danger-custom'
                        }>
                          {b.paymentStatus}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {/* ✅ View Invoice — always visible if canRead */}
                          <Link
                            href={`/billing/invoice/${b._id}`}
                            style={{ background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 8, padding: '4px 12px', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                          >
                            <i className="fa-solid fa-file-invoice me-1" />View
                          </Link>
                          {canUpdate('billing') && (
                            <button onClick={() => openEdit(b)} title="Edit" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#7c3aed', cursor: 'pointer' }}>
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          {canDelete('billing') && (
                            <button onClick={() => handleDelete(b._id, b.billNumber)} title="Delete" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            page={page} 
            total={total} 
            limit={limit} 
            onPageChange={setPage} 
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>

        {/* ── New / Edit Bill Modal — only if canCreate or canUpdate ── */}
        {!permLoading && (canCreate('billing') || canUpdate('billing')) && (
          <Modal
            show={showModal} onClose={() => { setShowModal(false); setEditId(null); }}
            title={editId ? "✏️ Edit Bill" : "🧾 New Bill"} size="xl"
            footer={<>
              <button
                onClick={() => { setShowModal(false); setEditId(null); }}
                style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Saving...</>
                  : <><i className="fa-solid fa-file-invoice" />{editId ? 'Update Bill' : 'Create Bill'}</>
                }
              </button>
            </>}
          >
            <div className="row g-3 mb-3">
              <div className="col-md-5">
                <label className="form-label">Patient *</label>
                <select className="form-select" value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.name} — {p.patientId}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['OPD', 'IPD', 'Emergency', 'Lab', 'Pharmacy'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Payment</label>
                <select className="form-select" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  {['Cash', 'UPI', 'Card', 'Insurance', 'Pending'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-md-1">
                <label className="form-label">Disc ₹</label>
                <input type="number" className="form-control" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
              </div>
              <div className="col-md-1">
                <label className="form-label">Tax %</label>
                <input type="number" className="form-control" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })} />
              </div>
              <div className="col-md-1">
                <label className="form-label">Paid ₹</label>
                <input type="number" className="form-control" value={form.amountPaid} onChange={e => setForm({ ...form, amountPaid: e.target.value })} />
              </div>
            </div>

            {/* ── Bill Items ── */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'var(--hover-bg)', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Bill Items</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--hover-bg)' }}>
                    {['Description', 'Qty', 'Unit Price ₹', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
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
                          className="form-control" value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          placeholder="e.g. Consultation Fee" style={{ fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', width: 70 }}>
                        <input type="number" className="form-control" value={item.quantity} min={1}
                          onChange={e => updateItem(i, 'quantity', +e.target.value)} style={{ fontSize: 13 }} />
                      </td>
                      <td style={{ padding: '8px 6px', width: 120 }}>
                        <input type="number" className="form-control" value={item.unitPrice}
                          onChange={e => updateItem(i, 'unitPrice', +e.target.value)} style={{ fontSize: 13 }} />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary)', width: 110 }}>
                        ₹{(item.total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 6px', width: 40 }}>
                        {form.items.length > 1 && (
                          <button
                            onClick={() => removeItem(i)}
                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={addItem}
                  style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: 8, padding: '6px 14px', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <i className="fa-solid fa-plus me-1" />Add Item
                </button>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subtotal: <strong>₹{subtotal.toFixed(2)}</strong></div>
                  {parseFloat(form.discount) > 0 && (
                    <div style={{ fontSize: 12, color: '#16a34a' }}>Discount: − ₹{parseFloat(form.discount).toFixed(2)}</div>
                  )}
                  {parseFloat(form.tax) > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tax ({form.tax}%): + ₹{taxAmount.toFixed(2)}</div>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>Total: ₹{totalAmount.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    Balance: ₹{Math.max(0, balance).toFixed(2)}
                  </div>
                </div>
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

Billing.getLayout = (page) => <Layout>{page}</Layout>;