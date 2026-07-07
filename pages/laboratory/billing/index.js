import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import Modal from '../../../components/ui/Modal';
import { useEffect, useState } from 'react';
import BackButton from '../../../components/ui/BackButton';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermission } from '../../../hooks/usePermission';
import Pagination from '../../../components/ui/Pagination';
import { confirmAction } from '../../../utils/sweetAlert';

export default function LaboratoryBilling() {
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [patients,    setPatients]    = useState([]);
  const [labPartners, setLabPartners] = useState([]);
  const [bills,       setBills]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [editId,      setEditId]      = useState(null);
  const [page,        setPage]        = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);
  const [limit,       setLimit]       = useState(10);
  const [form, setForm] = useState({
    patient: '', labPartner: '', paymentMethod: 'Cash', discount: 0,
    tests: [{ testName: '', cost: 0 }]
  });

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('lab-billing')) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get('/patients?limit=1000'),
      api.get('/laboratory?limit=1000').catch(() => ({ data: { data: [] } })),
      api.get(`/laboratory-bills?page=${page}&limit=${limit}&search=${search}`),
    ]).then(([p, l, b]) => {
      setPatients(p.data.data  || []);
      setLabPartners(l.data.data || []);
      setBills(b.data.data     || []);
      setTotalCount(b.data.total || 0);
    }).finally(() => setLoading(false));
  }, [permLoading, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('lab-billing')) {
        setPage(1);
        api.get(`/laboratory-bills?page=1&limit=${limit}&search=${search}`).then(res => {
          setBills(res.data.data || []);
          setTotalCount(res.data.total || 0);
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const updateTest = (i, field, val) => {
    const tests = [...form.tests];
    tests[i][field] = val;
    setForm({ ...form, tests });
  };

  const addTest    = () => setForm({ ...form, tests: [...form.tests, { testName: '', cost: 0 }] });
  const removeTest = (i) => setForm({ ...form, tests: form.tests.filter((_, idx) => idx !== i) });

  const subtotal   = form.tests.reduce((s, i) => s + (i.cost || 0), 0);
  const grandTotal = subtotal - (parseFloat(form.discount) || 0);

  const openEdit = (b) => {
    setEditId(b._id);
    setForm({
      patient: b.patient?._id || b.patient || '',
      labPartner: b.labPartner?._id || b.labPartner || '',
      paymentMethod: b.paymentMethod || 'Cash',
      discount: b.discount || 0,
      tests: b.tests.map(t => ({
        testName: t.testName,
        cost: t.cost
      }))
    });
    setShowModal(true);
  };

  const handleDelete = async (id, num) => {
    if (!canDelete('lab-billing')) return toast.error('No permission to delete');
    if (!await confirmAction('Delete Bill?', `Delete lab bill ${num}?`, 'Yes, delete')) return;
    try {
      await api.delete(`/laboratory-bills/${id}`);
      toast.success('Bill deleted');
      const res = await api.get(`/laboratory-bills?page=${page}&limit=${limit}&search=${search}`);
      setBills(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch { toast.error('Delete failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId && !canUpdate('lab-billing')) return toast.error('No permission to edit');
    if (!editId && !canCreate('lab-billing')) return toast.error('No permission to create');
    if (!form.tests[0].testName) return toast.error('Enter at least one test name');
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/laboratory-bills/${editId}`, form);
        toast.success('Lab Bill updated!');
      } else {
        await api.post('/laboratory-bills', form);
        toast.success('Lab bill created!');
      }
      setShowModal(false);
      setEditId(null);
      setForm({
        patient: '', labPartner: '', paymentMethod: 'Cash', discount: 0,
        tests: [{ testName: '', cost: 0 }],
      });
      const res = await api.get(`/laboratory-bills?page=${page}&limit=${limit}&search=${search}`);
      setBills(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      toast.error(err.friendlyMessage || 'Failed');
    } finally { setSubmitting(false); }
  };

  if (permLoading) {
    return (
      <>
        <SEOHead title="Laboratory Billing" path="/laboratory/billing" />
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

  if (!canRead('lab-billing')) {
    return (
      <>
        <SEOHead title="Laboratory Billing" path="/laboratory/billing" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Laboratory Billing.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Laboratory Billing" path="/laboratory/billing" />
      <div>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Laboratory Billing</h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {totalCount} bills generated
              </p>
            </div>
          </div>
          {canCreate('lab-billing') && (
            <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" />New Lab Bill
            </button>
          )}
        </div>

        <div className="content-card">
          <div className="card-header-custom">
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Lab Bills</h6>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bill or patient..."
              className="form-control"
              style={{ maxWidth: 240, fontSize: 13 }}
            />
          </div>

          {loading ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Bill No.</th><th>Patient</th><th>Lab Partner</th><th>Tests</th><th>Subtotal</th>
                    <th>Discount</th><th>Total</th><th>Method</th><th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
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
                    <th>Bill No.</th><th>Patient</th><th>Lab Partner</th><th>Tests</th><th>Subtotal</th>
                    <th>Discount</th><th>Total</th><th>Method</th><th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b => (
                    <tr key={b._id}>
                      <td><span className="badge-primary-custom">{b.billNumber}</span></td>
                      <td>
                        <strong>{b.patient?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</strong>
                      </td>
                      <td>{b.labPartner?.name || '-'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{b.tests?.length}</td>
                      <td>₹{b.subtotal?.toLocaleString('en-IN')}</td>
                      <td style={{ color: '#16a34a' }}>- ₹{b.discount || 0}</td>
                      <td><strong style={{ color: 'var(--primary)' }}>₹{b.totalAmount?.toLocaleString('en-IN')}</strong></td>
                      <td><span className="badge-info-custom">{b.paymentMethod}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canUpdate('lab-billing') && (
                            <button onClick={() => openEdit(b)} title="Edit" style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          {canDelete('lab-billing') && (
                            <button onClick={() => handleDelete(b._id, b.billNumber)} title="Delete" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
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

        {canCreate('lab-billing') && (
          <Modal
            show={showModal}
            onClose={() => { setShowModal(false); setEditId(null); }}
            title={editId ? "✏️ Edit Lab Bill" : "🔬 New Lab Bill"}
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
              <div className="col-md-5">
                <label className="form-label">
                  Patient{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
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
                <label className="form-label">Lab Partner</label>
                <select
                  className="form-select"
                  value={form.labPartner}
                  onChange={e => setForm({ ...form, labPartner: e.target.value })}
                >
                  <option value="">In-House / None</option>
                  {labPartners.map(l => (
                    <option key={l._id} value={l._id}>{l.name}</option>
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

            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'var(--hover-bg)', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Lab Tests</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--hover-bg)' }}>
                    {['Test Name', 'Cost (₹)', ''].map(h => (
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
                  {form.tests.map((test, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          className="form-control"
                          value={test.testName}
                          onChange={e => updateTest(i, 'testName', e.target.value)}
                          placeholder="E.g., Complete Blood Count"
                          style={{ fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', width: 200 }}>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₹</span>
                          <input
                            type="number"
                            className="form-control"
                            value={test.cost}
                            onChange={e => updateTest(i, 'cost', +e.target.value)}
                            style={{ fontSize: 13, fontWeight: 600 }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px', width: 40 }}>
                        {form.tests.length > 1 && (
                          <button
                            onClick={() => removeTest(i)}
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
                  onClick={addTest}
                  style={{
                    background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                    borderRadius: 8, padding: '6px 14px', color: 'var(--primary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <i className="fa-solid fa-plus me-1" />Add Test
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

LaboratoryBilling.getLayout = (page) => <Layout>{page}</Layout>;
