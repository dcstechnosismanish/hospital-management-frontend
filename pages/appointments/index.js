import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import BackButton from '../../components/ui/BackButton';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../../utils/api';

import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission';
import Pagination from '../../components/ui/Pagination';
import { confirmAction } from '../../utils/sweetAlert';

export default function Appointments() {
  const router = useRouter();
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();


  const [appointments, setAppointments] = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [doctors,      setDoctors]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [filterDate,   setFilterDate]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');
  const [mounted,      setMounted]      = useState(false);
  const [slots,        setSlots]        = useState([]);
  const [editSlots,    setEditSlots]    = useState([]);
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [limit,        setLimit]        = useState(10);
  const [form, setForm] = useState({
    patient: '', doctor: '', date: '', timeSlot: '', type: 'OPD', reason: '', notes: ''
  });
  const [editForm, setEditForm] = useState({
    patient: '', doctor: '', date: '', timeSlot: '', type: 'OPD', reason: '', notes: '', status: 'scheduled'
  });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get(`/appointments?page=${page}&limit=${limit}&search=${search}&status=${filterStatus}&date=${filterDate}`),
      api.get('/patients?limit=300'),
      api.get('/doctors')
    ]).then(([a, p, d]) => {
      setAppointments(a.data.data || []);
      setTotal(a.data.total || 0);
      setPatients(p.data.data    || []);
      setDoctors(d.data.data     || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    if (permLoading) return;
    if (!canRead('appointments')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading, page, filterDate, filterStatus, limit]);

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

  // ✅ Handle reschedule from URL
  useEffect(() => {
    if (!router.isReady || !router.query.reschedule || permLoading || !canCreate('appointments')) return;
    
    const oldId = router.query.reschedule;
    api.get(`/appointments/${oldId}`)
      .then(res => {
        const a = res.data.data;
        if (a) {
          setForm({
            patient: a.patient?._id || '',
            doctor: a.doctor?._id || '',
            date: '', // Force choosing a new date
            timeSlot: '',
            type: a.type || 'OPD',
            reason: `Rescheduling appointment #${a.tokenNumber}: ${a.reason || ''}`,
            notes: a.notes || ''
          });
          setShowModal(true);
        }
      })
      .catch(() => toast.error('Failed to load appointment for rescheduling'));
      
    // Clear query param
    router.replace('/appointments', undefined, { shallow: true });
  }, [router.isReady, router.query.reschedule, permLoading]);


  const fetchSlots = async (doctorId, date, setter = setSlots) => {
    if (!doctorId || !date) return;
    try {
      const res = await api.get(`/doctors/${doctorId}/slots?date=${date}`);
      setter(res.data.slots || []);
    } catch { setter([]); }
  };

  // Stats
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(todayDate);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const today     = todayDate.toDateString();
  const todayApts = appointments.filter(a => new Date(a.date).toDateString() === today);
  const last7DaysStart = new Date(todayDate);
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);
  const last7DaysStr   = last7DaysStart.toISOString().split('T')[0];

  const todayStr     = todayDate.toISOString().split('T')[0];
  const scheduled = appointments.filter(a => a.status === 'scheduled' && a.date?.split('T')[0] >= todayStr);
  const completed = appointments.filter(a => a.status === 'completed');
  const cancelled = appointments.filter(a => a.status === 'cancelled');
  const last7Days = appointments.filter(a => {
    const dStr = a.date?.split('T')[0];
    return dStr >= last7DaysStr && dStr <= todayStr;
  });

  const statCards = [
    { icon: 'fa-calendar-check', label: 'Total Appointments', value: total, color: '#16a34a', sub: 'All time', delay: 0 },
    { icon: 'fa-calendar-day',   label: "Today's",            value: todayApts.length,    color: '#0891b2',
      change: `${todayApts.filter(a => a.status === 'scheduled').length} pending`, changeType: 'neutral', sub: 'Scheduled today', delay: 1 },
    { icon: 'fa-hourglass-half', label: 'Scheduled',          value: scheduled.length,    color: '#7c3aed',
      change: 'Upcoming', changeType: 'up', sub: 'Awaiting completion', delay: 2 },
    { icon: 'fa-circle-check',   label: 'Completed',          value: completed.length,    color: '#059669',
      change: `${Math.round((completed.length / Math.max(appointments.length, 1)) * 100)}%`, changeType: 'up', sub: 'Completion rate', delay: 3 },
    { icon: 'fa-circle-xmark',   label: 'Cancelled',          value: cancelled.length,    color: '#dc2626',
      change: cancelled.length > 0 ? 'Review needed' : 'All good', changeType: cancelled.length > 0 ? 'down' : 'neutral', sub: 'This month', delay: 4 },
    { icon: 'fa-calendar-week',  label: 'Last 7 Days',        value: last7Days.length,    color: '#d97706',
      change: 'Recent', changeType: 'neutral', sub: 'Last 7 days', delay: 5 },
  ];

  // ✅ Only compute AFTER permLoading is false — never false-positive
  const showActionsCol = !permLoading && (canUpdate('appointments') || canDelete('appointments'));
  const colSpan        = showActionsCol ? 9 : 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient || !form.doctor || !form.date || !form.timeSlot)
      return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.post('/appointments', form);
      toast.success('Appointment booked!');
      setShowModal(false);
      setForm({ patient: '', doctor: '', date: '', timeSlot: '', type: 'OPD', reason: '', notes: '' });
      setSlots([]);
      fetchAll();
    } catch (err) { toast.error(err.friendlyMessage || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const openEdit = (a) => {
    setEditTarget(a._id);
    setEditForm({
      patient:  a.patient?._id  || '',
      doctor:   a.doctor?._id   || '',
      date:     a.date ? new Date(a.date).toISOString().split('T')[0] : '',
      timeSlot: a.timeSlot      || '',
      type:     a.type          || 'OPD',
      reason:   a.reason        || '',
      notes:    a.notes         || '',
      status:   a.status        || 'scheduled',
    });
    fetchSlots(
      a.doctor?._id,
      a.date ? new Date(a.date).toISOString().split('T')[0] : '',
      setEditSlots
    );
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.patient || !editForm.doctor || !editForm.date || !editForm.timeSlot)
      return toast.error('Fill all required fields');
    setSubmitting(true);
    try {
      await api.put(`/appointments/${editTarget}`, editForm);
      toast.success('Appointment updated!');
      setShowEdit(false);
      setEditTarget(null);
      setEditSlots([]);
      fetchAll();
    } catch (err) { toast.error(err.friendlyMessage || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const cancelApt = async (id) => {
    if (!await confirmAction('Cancel Appointment?', 'Cancel this appointment?', 'Yes, cancel')) return;
    try { await api.delete(`/appointments/${id}`); toast.success('Cancelled'); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const deleteApt = async (id) => {
    if (!await confirmAction('Delete Appointment?', 'Permanently delete this appointment? This cannot be undone.', 'Yes, delete')) return;
    try { await api.delete(`/appointments/${id}`); toast.success('Appointment deleted'); fetchAll(); }
    catch { toast.error('Failed to delete'); }
  };

  const filtered = appointments; // Filtered on backend now

  const STATUS_COLORS = {
    scheduled: { bg: 'rgba(6,182,212,0.12)',  color: '#0891b2' },
    completed: { bg: 'rgba(22,163,74,0.12)',  color: '#16a34a' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
    'no-show': { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  };

  // ── Access Denied ─────────────────────────────────────────
  if (!permLoading && !canRead('appointments')) {
    return (
      <>
        <SEOHead title="Appointments" path="/appointments" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Appointments.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Appointments" path="/appointments" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-calendar-check me-3" style={{ color: 'var(--primary)' }} />Appointments
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {appointments.length} total appointments
              </p>
            </div>
          </div>
          {!permLoading && canCreate('appointments') && (
            <button className="btn-primary-custom" onClick={() => setShowModal(true)}>
              <i className="fa-solid fa-plus" />Book Appointment
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {mounted && statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Table ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Appointments</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient / doctor..." className="form-control"
                style={{ maxWidth: 210, fontSize: 13 }}
              />
              <input
                type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="form-control" style={{ maxWidth: 160, fontSize: 13 }}
              />
              <select
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="form-select" style={{ maxWidth: 140, fontSize: 13 }}
              >
                <option value="">All Status</option>
                {['scheduled', 'completed', 'cancelled', 'no-show'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table table-custom w-100">
              <thead>
                <tr>
                  <th>Token</th><th>Patient</th><th>Doctor</th><th>Date</th>
                  <th>Slot</th><th>Type</th><th>Reason</th><th>Status</th>
                  {/* ✅ Header only after permLoading done */}
                  {showActionsCol && <th style={{ minWidth: 160 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {/* ── Skeleton while loading data OR permissions ── */}
                {(loading || permLoading) ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {/* ✅ Always render 9 skeleton cols so table doesn't jump */}
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j}><div className="skel" style={{ height: 14, borderRadius: 6 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-calendar-xmark fa-2x d-block mb-2" />No appointments found
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.scheduled;
                    return (
                      <tr key={a._id}>
                        <td>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>
                            #{a.tokenNumber}
                          </div>
                        </td>
                        <td>
                          <Link href={`/patients/${a.patient?._id}`} style={{ textDecoration: 'none' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{a.patient?.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.patient?.patientId}</div>
                          </Link>
                        </td>
                        <td>
                          <Link href={`/doctors/${a.doctor?._id}`} style={{ textDecoration: 'none' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Dr. {a.doctor?.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.doctor?.specialization}</div>
                          </Link>
                        </td>
                        <td style={{ fontSize: 13 }}>{new Date(a.date).toLocaleDateString('en-IN')}</td>
                        <td><span className="badge-info-custom">{a.timeSlot}</span></td>
                        <td><span className="badge-primary-custom">{a.type}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.reason || '—'}
                        </td>
                        <td>
                          <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                            {a.status}
                          </span>
                        </td>

                        {/* ✅ Actions cell — only after permissions loaded */}
                        {showActionsCol && (
                          <td>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap' }}>
                              {canUpdate('appointments') && (
                                <button
                                  onClick={() => openEdit(a)}
                                  title="Edit"
                                  style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                                >
                                  <i className="fa-solid fa-pen-to-square" /> Edit
                                </button>
                              )}
                              {canUpdate('appointments') && a.status === 'scheduled' && (
                                <button
                                  onClick={() => cancelApt(a._id)}
                                  title="Cancel"
                                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                                >
                                  <i className="fa-solid fa-ban" /> Cancel
                                </button>
                              )}
                              {canDelete('appointments') && (
                                <button
                                  onClick={() => deleteApt(a._id)}
                                  title="Delete"
                                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '4px 9px', fontSize: 11, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                                >
                                  <i className="fa-solid fa-trash" /> Delete
                                </button>
                              )}
                            </div>
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

        {/* ── Book Modal ── */}
        {!permLoading && canCreate('appointments') && (
          <Modal
            show={showModal} onClose={() => setShowModal(false)}
            title="📅 Book Appointment" size="lg"
            footer={<>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting ? <><i className="fa-solid fa-spinner fa-spin" />Booking...</> : <><i className="fa-solid fa-calendar-plus" />Book</>}
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
                <label className="form-label">Doctor *</label>
                <select className="form-select" value={form.doctor} onChange={e => { setForm({ ...form, doctor: e.target.value, timeSlot: '' }); fetchSlots(e.target.value, form.date, setSlots); }}>
                  <option value="">Select Doctor</option>
                  {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} — {d.specialization}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Date *</label>
                <input
                  type="date" className="form-control" value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => { setForm({ ...form, date: e.target.value, timeSlot: '' }); fetchSlots(form.doctor, e.target.value, setSlots); }}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Time Slot *</label>
                <select className="form-select" value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })}>
                  <option value="">Select Slot</option>
                  {slots.map(s => (
                    <option key={s.slot} value={s.slot} disabled={!s.available}>
                      {s.slot}{!s.available ? ' (Booked)' : ''}
                    </option>
                  ))}
                  {slots.length === 0 && <option disabled>Select doctor & date first</option>}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['OPD', 'IPD', 'Emergency', 'Follow-up'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Reason for Visit</label>
                <input className="form-control" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Chest pain, Routine checkup..." />
              </div>
              <div className="col-12">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
              </div>
            </div>
          </Modal>
        )}

        {/* ── Edit Modal ── */}
        {!permLoading && canUpdate('appointments') && (
          <Modal
            show={showEdit}
            onClose={() => { setShowEdit(false); setEditTarget(null); setEditSlots([]); }}
            title="✏️ Edit Appointment" size="lg"
            footer={<>
              <button onClick={() => { setShowEdit(false); setEditTarget(null); setEditSlots([]); }} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleEdit} className="btn-primary-custom" disabled={submitting}>
                {submitting ? <><i className="fa-solid fa-spinner fa-spin" />Saving...</> : <><i className="fa-solid fa-floppy-disk" />Save Changes</>}
              </button>
            </>}
          >
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Patient *</label>
                <select className="form-select" value={editForm.patient} onChange={e => setEditForm({ ...editForm, patient: e.target.value })}>
                  <option value="">Select Patient</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.name} — {p.patientId}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Doctor *</label>
                <select className="form-select" value={editForm.doctor} onChange={e => { setEditForm({ ...editForm, doctor: e.target.value, timeSlot: '' }); fetchSlots(e.target.value, editForm.date, setEditSlots); }}>
                  <option value="">Select Doctor</option>
                  {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} — {d.specialization}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Date *</label>
                <input
                  type="date" className="form-control" value={editForm.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => { setEditForm({ ...editForm, date: e.target.value, timeSlot: '' }); fetchSlots(editForm.doctor, e.target.value, setEditSlots); }}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Time Slot *</label>
                <select className="form-select" value={editForm.timeSlot} onChange={e => setEditForm({ ...editForm, timeSlot: e.target.value })}>
                  <option value="">Select Slot</option>
                  {editSlots.map(s => (
                    <option key={s.slot} value={s.slot} disabled={!s.available && s.slot !== editForm.timeSlot}>
                      {s.slot}{(!s.available && s.slot !== editForm.timeSlot) ? ' (Booked)' : ''}
                    </option>
                  ))}
                  {editSlots.length === 0 && <option disabled>Select doctor & date first</option>}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Type</label>
                <select className="form-select" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                  {['OPD', 'IPD', 'Emergency', 'Follow-up'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Status</label>
                <select className="form-select" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                  {['scheduled', 'completed', 'cancelled', 'no-show'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Reason for Visit</label>
                <input className="form-control" value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} placeholder="e.g. Chest pain, Routine checkup..." />
              </div>
              <div className="col-12">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-control" rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any notes..." />
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

Appointments.getLayout = (page) => <Layout>{page}</Layout>;