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

export default function Admissions() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, loading: permLoading } = usePermission();

  const [admissions,    setAdmissions]    = useState([]);
  const [patients,      setPatients]      = useState([]);
  const [doctors,       setDoctors]       = useState([]);
  const [beds,          setBeds]          = useState([]);
  const [bedStats,     setBedStats]      = useState({ total: 0, available: 0 });
  const [admissionStats, setAdmissionStats] = useState({ admitted:0, discharged:0, icu:0, thisMonth:0, avgStay:0, wardBreakdown:{} });
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [showDischarge, setShowDischarge] = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const [page,          setPage]          = useState(1);
  const [total,         setTotal]         = useState(0);
  const [limit,         setLimit]         = useState(10);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [form, setForm] = useState({
    patient: '', doctor: '', bed: '', diagnosis: '', notes: '',
    admissionDate: new Date().toISOString().split('T')[0]
  });
  const [dischargeForm, setDischargeForm] = useState({ dischargeDate: '', dischargeNotes: '' });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get(`/admissions?page=${page}&limit=${limit}&search=${search}&status=${filterStatus}`),
      api.get('/patients?limit=300'),
      api.get('/doctors'),
      api.get('/beds?status=available'),
      api.get('/beds/stats'),
      api.get('/admissions/stats')
    ]).then(([a, p, d, b, s, st]) => {
      setAdmissions(a.data.data || []);
      setTotal(a.data.total || 0);
      setPatients(p.data.data   || []);
      setDoctors(d.data.data    || []);
      setBeds(b.data.data       || []);
      setBedStats(s.data.data   || { total: 0, available: 0 });
      setAdmissionStats(st.data.data || { admitted:0, discharged:0, icu:0, thisMonth:0, avgStay:0, wardBreakdown:{} });
    }).finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    setMounted(true);
    if (permLoading) return;
    if (!canRead('admissions-beds')) {
      setLoading(false);
      return;
    }
    fetchAll();
  }, [permLoading, page, filterStatus, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mounted) {
        setPage(1);
        fetchAll();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Local helper for table row (stays local to current page)
  const admittedCount = admissions.filter(a => a.status === 'admitted').length;

  const statCards = [
    { icon: 'fa-bed',               label: 'Currently Admitted', value: admissionStats.admitted,   color: '#16a34a',
      change: `${admissionStats.icu} in ICU`, changeType: admissionStats.icu > 0 ? 'down' : 'neutral', sub: 'Active inpatients',      delay: 0 },
    { icon: 'fa-right-from-bracket', label: 'Discharged',        value: admissionStats.discharged, color: '#0891b2',
      change: 'Total',                changeType: 'up',                                  sub: 'Successfully discharged', delay: 1 },
    { icon: 'fa-heart-pulse',        label: 'ICU Patients',      value: admissionStats.icu,        color: '#dc2626',
      change: admissionStats.icu > 0 ? 'Critical care' : 'All stable', changeType: admissionStats.icu > 0 ? 'down' : 'neutral', sub: 'In intensive care', delay: 2 },
    { icon: 'fa-calendar-plus',      label: 'This Month',        value: admissionStats.thisMonth,  color: '#7c3aed',
      change: 'Admissions',           changeType: 'up',                                  sub: 'Current month',          delay: 3 },
    { icon: 'fa-clock',              label: 'Avg Stay',          value: admissionStats.avgStay,    color: '#d97706',
      suffix: ' days',                                                                    sub: 'Average length of stay', delay: 4 },
    { icon: 'fa-bed-pulse',          label: 'Available Beds',    value: `${bedStats.available} / ${bedStats.total}`, color: '#059669',
      change: 'Capacity',             changeType: 'neutral',                             sub: 'Ready for admission',    delay: 5 },
  ];

  const handleAdmit = async (e) => {
    e.preventDefault();
    if (!form.patient || !form.doctor || !form.bed || !form.diagnosis)
      return toast.error('Fill all required fields');
    
    if (form.admissionDate && new Date(form.admissionDate) > new Date())
      return toast.error('Admission date cannot be in the future');
    
    if (!/[a-zA-Z]/.test(form.diagnosis)) return toast.error('Diagnosis must contain letters');
    setSubmitting(true);
    try {
      await api.post('/admissions', form);
      toast.success('Patient admitted!');
      setShowModal(false);
      setForm({ patient: '', doctor: '', bed: '', diagnosis: '', notes: '', admissionDate: new Date().toISOString().split('T')[0] });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDischarge = async (e) => {
    e.preventDefault();
    if (!dischargeForm.dischargeDate) return toast.error('Select discharge date');
    setSubmitting(true);
    try {
      const adm  = admissions.find(a => a._id === showDischarge);
      const days = Math.max(1, Math.round((new Date(dischargeForm.dischargeDate) - new Date(adm.admissionDate)) / 86400000));
      await api.put(`/admissions/${showDischarge}`, {
        status:         'discharged',
        dischargeDate:  dischargeForm.dischargeDate,
        dischargeNotes: dischargeForm.dischargeNotes,
        totalDays:      days
      });
      toast.success('Patient discharged!');
      setShowDischarge(null);
      setDischargeForm({ dischargeDate: '', dischargeNotes: '' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const filtered = admissions; // Handled on backend

  const WARD_COLORS = { ICU: '#dc2626', Private: '#7c3aed', 'Semi-Private': '#0891b2', General: '#16a34a' };

  // ✅ Access Denied screen — shown after permissions are loaded
  if (!permLoading && !canRead('admissions-beds')) {
    return (
      <>
        <SEOHead title="Admissions & Beds" path="/admissions" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Admissions.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Admissions & Beds" path="/admissions" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-bed me-3" style={{ color: 'var(--primary)' }} />Admissions & Beds
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {admissionStats.admitted} currently admitted
              </p>
            </div>
          </div>
          {/* ✅ Only show Admit button if canCreate */}
          {canCreate('admissions') && (
            <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" />Admit Patient
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {mounted && statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Ward Breakdown ── */}
        <div className="row g-3 mb-4">
          {['General', 'Semi-Private', 'Private', 'ICU'].map(ward => {
            const wardCount = admissionStats.wardBreakdown[ward] || 0;
            const color = WARD_COLORS[ward];
            return (
              <div key={ward} className="col-6 col-md-3">
                <div className="content-card hover-lift" style={{ padding: '16px 18px', borderLeft: `3px solid ${color}`, cursor: 'default' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color }}>{wardCount}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{ward} Ward</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>occupied beds</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Admissions Table ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Admissions</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient / diagnosis..." className="form-control"
                style={{ maxWidth: 220, fontSize: 13 }}
              />
              <select
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="form-select" style={{ maxWidth: 140, fontSize: 13 }}
              >
                <option value="">All Status</option>
                <option value="admitted">Admitted</option>
                <option value="discharged">Discharged</option>
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-custom w-100">
              <thead>
                <tr>
                  <th>Patient</th><th>Doctor</th><th>Bed / Ward</th>
                  <th>Diagnosis</th><th>Admitted</th><th>Days</th><th>Status</th>
                  {/* ✅ Only show Actions column if canUpdate */}
                  {canUpdate('admissions') && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading || permLoading ? (
                  // ✅ Skeleton rows while loading
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: canUpdate('admissions') ? 8 : 7 }).map((__, j) => (
                        <td key={j}><div className="skel" style={{ height: 14, borderRadius: 6 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canUpdate('admissions') ? 8 : 7} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-bed fa-2x d-block mb-2" />No admissions found
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => {
                    const days   = Math.max(0, Math.round((new Date() - new Date(a.admissionDate)) / 86400000));
                    const wColor = WARD_COLORS[a.bed?.ward] || '#6b7280';
                    return (
                      <tr key={a._id}>
                        <td>
                          <Link href={`/patients/${a.patient?._id}`} style={{ textDecoration: 'none' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{a.patient?.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.patient?.patientId}</div>
                          </Link>
                        </td>
                        <td>
                          <strong>{a.doctor?.name ? `Dr. ${a.doctor.name}` : '—'}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.doctor?.specialization}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: wColor, flexShrink: 0 }} />
                            <div>
                              <strong>{a.bed?.bedNumber || '—'}</strong>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.bed?.ward}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ maxWidth: 160 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.diagnosis}</div>
                          {a.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>{new Date(a.admissionDate).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: days > 7 ? '#dc2626' : 'var(--text-primary)', fontSize: 15 }}>
                            {a.status === 'discharged' ? (a.totalDays || '—') : days}
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {a.status === 'discharged' ? 'total' : 'so far'}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            background: a.status === 'admitted' ? 'rgba(22,163,74,0.12)' : 'rgba(6,182,212,0.12)',
                            color:      a.status === 'admitted' ? '#16a34a' : '#0891b2',
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
                          }}>
                            {a.status}
                          </span>
                        </td>
                        {/* ✅ Discharge button — only if canUpdate */}
                        {canUpdate('admissions') && (
                          <td>
                            {a.status === 'admitted' && (
                              <button
                                onClick={() => {
                                  setShowDischarge(a._id);
                                  setDischargeForm({ dischargeDate: new Date().toISOString().split('T')[0], dischargeNotes: '' });
                                }}
                                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 7, padding: '4px 10px', fontSize: 11, color: '#0891b2', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                <i className="fa-solid fa-right-from-bracket me-1" />Discharge
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
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

        {/* ── Admit Modal — only renders if canCreate ── */}
        {canCreate('admissions') && (
          <Modal
            show={showModal} onClose={() => setShowModal(false)}
            title="🏥 Admit Patient" size="lg"
            footer={<>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button onClick={handleAdmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Admitting...</>
                  : <><i className="fa-solid fa-bed" />Admit Patient</>
                }
              </button>
            </>}
          >
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Patient *</label>
                <select className="form-select" value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.name} — {p.patientId}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Attending Doctor *</label>
                <select className="form-select" value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })}>
                  <option value="">Select Doctor</option>
                  {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} — {d.specialization}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Assign Bed *</label>
                <select className="form-select" value={form.bed} onChange={e => setForm({ ...form, bed: e.target.value })}>
                  <option value="">Select Available Bed</option>
                  {beds.map(b => <option key={b._id} value={b._id}>{b.bedNumber} — {b.ward} (₹{b.pricePerDay}/day)</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Admission Date</label>
                <input type="date" className="form-control" value={form.admissionDate} 
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, admissionDate: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label">Diagnosis *</label>
                <input className="form-control" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Acute Myocardial Infarction" required />
              </div>
              <div className="col-12">
                <label className="form-label">Clinical Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes, treatment plan..." />
              </div>
            </div>
          </Modal>
        )}

        {/* ── Discharge Modal — only renders if canUpdate ── */}
        {canUpdate('admissions') && (
          <Modal
            show={!!showDischarge} onClose={() => setShowDischarge(null)}
            title="🚪 Discharge Patient" size="md"
            footer={<>
              <button
                onClick={() => setShowDischarge(null)}
                style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button onClick={handleDischarge} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Discharging...</>
                  : <><i className="fa-solid fa-right-from-bracket" />Confirm Discharge</>
                }
              </button>
            </>}
          >
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Discharge Date *</label>
                <input
                  type="date" className="form-control"
                  value={dischargeForm.dischargeDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDischargeForm({ ...dischargeForm, dischargeDate: e.target.value })}
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label">Discharge Notes</label>
                <textarea
                  className="form-control" rows={4}
                  value={dischargeForm.dischargeNotes}
                  onChange={e => setDischargeForm({ ...dischargeForm, dischargeNotes: e.target.value })}
                  placeholder="Discharge summary, follow-up instructions, medications to continue..."
                />
              </div>
            </div>
          </Modal>
        )}

      </div>

      <style>{`
        .stat-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
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

Admissions.getLayout = (page) => <Layout>{page}</Layout>;