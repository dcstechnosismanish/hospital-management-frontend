import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added
import BackButton from '../../components/ui/BackButton';
import Pagination from '../../components/ui/Pagination';
import { confirmAction } from '../../utils/sweetAlert';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SPEC_COLORS = {
  Cardiology: '#dc2626', Orthopedics: '#7c3aed', Gynecology: '#db2777',
  Pediatrics: '#0891b2', Neurology: '#d97706', Dermatology: '#059669',
  'General Medicine': '#16a34a', Psychiatry: '#6366f1', ENT: '#0e7490',
  Ophthalmology: '#9333ea', Oncology: '#b45309', Urology: '#0f766e',
};

const getSpecColor = (spec) => SPEC_COLORS[spec] || '#16a34a';

const emptyForm = {
  name: '', specialization: '', qualification: '', experience: '',
  phone: '', email: '', department: '', consultationFee: '', schedule: []
};

export default function Doctors() {
  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [doctors,    setDoctors]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [form,       setForm]       = useState(emptyForm);
  const [editId,     setEditId]     = useState(null);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [limit,      setLimit]      = useState(10);

  const fetchDoctors = () => {
    setLoading(true);
    api.get(`/doctors?all=true&page=${page}&limit=${limit}&search=${search}&specialization=${filterSpec}`)
      .then(r => {
        setDoctors(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .finally(() => setLoading(false));
  };

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('doctors')) { setLoading(false); return; }
    fetchDoctors();
  }, [permLoading, page, filterSpec, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('doctors')) {
        setPage(1);
        fetchDoctors();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditId(d._id);
    setForm({
      name: d.name,
      specialization: d.specialization,
      qualification: d.qualification,
      experience: d.experience,
      phone: d.phone,
      email: d.email,
      department: d.department,
      consultationFee: d.consultationFee,
      schedule: d.schedule || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!await confirmAction('Delete Doctor?', 'Are you sure you want to delete this doctor?', 'Yes, delete')) return;
    try {
      await api.delete(`/doctors/${id}`);
      toast.success('Doctor deleted successfully');
      fetchDoctors();
    } catch (err) {
      toast.error('Failed to delete doctor');
    }
  };

  const isCurrentlyAvailable = (d) => {
    if (!d.isAvailable) return false;
    
    // If no schedule exists, default to true if isAvailable is true
    if (!d.schedule || d.schedule.length === 0) return true;
    
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. 'Mon'
    const todaySchedule = d.schedule.find(s => s.day === todayStr);
    
    if (!todaySchedule) return false;
    
    try {
      const currentTotal = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = todaySchedule.startTime.split(':').map(Number);
      const [eh, em] = todaySchedule.endTime.split(':').map(Number);
      
      return currentTotal >= (sh * 60 + sm) && currentTotal <= (eh * 60 + em);
    } catch (e) {
      return true; // Fallback
    }
  };

  // ── Stats ─────────────────────────────────────────────────
  const availableNow   = doctors.filter(d => isCurrentlyAvailable(d));
  const unavailableNow = doctors.filter(d => !isCurrentlyAvailable(d));
  const specs          = [...new Set(doctors.map(d => d.specialization).filter(Boolean))];



  // ── Schedule helpers ───────────────────────────────────────
  const toggleDay = (day) => {
    const exists = form.schedule.find(s => s.day === day);
    setForm(prev => ({
      ...prev,
      schedule: exists
        ? prev.schedule.filter(s => s.day !== day)
        : [...prev.schedule, { day, startTime: '09:00', endTime: '17:00', slotDuration: 15 }],
    }));
  };

  const updateSchedule = (day, field, val) => {
    setForm(prev => ({
      ...prev,
      schedule: prev.schedule.map(s => s.day === day ? { ...s, [field]: val } : s),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.specialization) return toast.error('Name and specialization are required');
    
    // Validation
    if (form.name.trim().length < 3) return toast.error('Name must be at least 3 characters long');
    if (!form.phone && !form.email) return toast.error('Either Phone Number or Email is required');
    if (!/^[a-zA-Z\s\.]+$/.test(form.name)) return toast.error('Name can only contain letters and spaces');
    if (form.specialization && (!/[a-zA-Z]/.test(form.specialization) || !/^[a-zA-Z0-9\s\.,\-\/&]+$/.test(form.specialization))) 
      return toast.error('Specialization must contain letters and valid characters only');
    if (form.qualification && (!/[a-zA-Z]/.test(form.qualification) || !/^[a-zA-Z0-9\s\.,\-\/&]+$/.test(form.qualification))) 
      return toast.error('Qualification must contain letters and valid characters only');
    if (form.department && (!/[a-zA-Z]/.test(form.department) || !/^[a-zA-Z0-9\s\.,\-\/&]+$/.test(form.department))) 
      return toast.error('Department must contain letters and valid characters only');
    if (form.phone && !/^[0-9]{10}$/.test(form.phone)) return toast.error('Phone number must be exactly 10 digits');
    if (form.email && !/^(?=[^@]*[a-zA-Z])[a-zA-Z0-9._%+-]+@(?=[^@]*[a-zA-Z][^@]*\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(form.email)) 
      return toast.error('Invalid email format (must contain letters in both parts)');

    // Schedule Validation
    for (const s of form.schedule) {
      if (s.startTime >= s.endTime) {
        return toast.error(`Invalid schedule for ${s.day}: Start time must be before end time`);
      }
    }

    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/doctors/${editId}`, form);
        toast.success('Doctor updated successfully!');
      } else {
        await api.post('/doctors', form);
        toast.success('Doctor added successfully!');
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditId(null);
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save doctor');
    } finally { setSubmitting(false); }
  };

  const filtered = doctors; // Handled on backend

  const avgFee = filtered.length
    ? Math.round(filtered.reduce((s, d) => s + (d.consultationFee || 0), 0) / filtered.length)
    : 0;

  const statCards = [
    {
      icon: 'fa-user-doctor', label: 'Total Doctors', value: total,
      color: '#16a34a', sub: 'Registered doctors',
      change: `${availableNow.length} available now`, changeType: 'up', delay: 0,
    },
    {
      icon: 'fa-circle-check', label: 'Available Today', value: availableNow.length,
      color: '#059669', sub: 'Currently on duty',
      change: `${unavailableNow.length} off duty`,
      changeType: unavailableNow.length > 0 ? 'down' : 'neutral', delay: 1,
    },
    {
      icon: 'fa-stethoscope', label: 'Specializations', value: specs.length,
      color: '#7c3aed', sub: 'Unique specializations',
      change: 'Departments', changeType: 'neutral', delay: 2,
    },
    {
      icon: 'fa-indian-rupee-sign', label: 'Avg. Fee', value: avgFee,
      color: '#0891b2', prefix: '₹', sub: 'Average consultation fee',
      change: 'Per visit', changeType: 'neutral', delay: 3,
    },
  ];

  // ✅ Access Denied screen
  if (!permLoading && !canRead('doctors')) {
    return (
      <>
        <SEOHead title="Doctors" path="/doctors" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Doctors.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Doctors" path="/doctors" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-user-doctor me-3" style={{ color: 'var(--primary)' }} />
                Doctors
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {doctors.length} doctors registered · {specs.length} specializations
              </p>
            </div>
          </div>
          {/* ✅ Only show Add Doctor button if canCreate */}
          {!permLoading && canCreate('doctors') && (
            <button className="btn-primary-custom" onClick={openAdd}>
              <i className="fa-solid fa-plus" />Add Doctor
            </button>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Doctor Cards (top 4 preview) ── */}
        {(loading || permLoading) ? (
          // ✅ Skeleton for doctor cards while loading
          <div className="row g-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="col-md-6 col-xl-3">
                <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="skel" style={{ height: 6 }} />
                  <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div className="skel" style={{ width: 68, height: 68, borderRadius: '50%' }} />
                    <div className="skel" style={{ width: 80, height: 12, borderRadius: 6 }} />
                    <div className="skel" style={{ width: 120, height: 14, borderRadius: 6 }} />
                    <div className="skel" style={{ width: 90, height: 12, borderRadius: 6 }} />
                    <div className="skel" style={{ width: '100%', height: 36, borderRadius: 10, marginTop: 8 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : doctors.length > 0 && (
          <div className="row g-3 mb-4">
            {doctors.slice(0, 4).map((d, i) => {
              const color = getSpecColor(d.specialization);
              return (
                <div key={d._id} className="col-md-6 col-xl-3">
                  <div className="content-card hover-lift" style={{
                    padding: 0, overflow: 'hidden', textAlign: 'center',
                    animationDelay: `${i * 0.08}s`,
                  }}>
                    {/* Card top accent */}
                    <div style={{ height: 6, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                    <div style={{ padding: '24px 20px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: 68, height: 68, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                        border: `3px solid ${color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, color, fontWeight: 900,
                        margin: '0 auto 14px',
                      }}>
                        {d.name?.[0]?.toUpperCase()}
                      </div>

                      {/* Availability dot */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 700,
                          color: isCurrentlyAvailable(d) ? '#16a34a' : '#dc2626',
                          background: isCurrentlyAvailable(d) ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                          padding: '3px 10px', borderRadius: 20,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isCurrentlyAvailable(d) ? '#16a34a' : '#dc2626',
                          }} />
                          {isCurrentlyAvailable(d) ? 'Available Now' : 'Unavailable'}
                        </span>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>
                        Dr. {d.name}
                      </div>
                      <div style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 2 }}>
                        {d.specialization}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        {d.department || d.qualification}
                      </div>

                      {/* Fee pill */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                        padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                        color: 'var(--text-primary)', marginBottom: 16,
                      }}>
                        <i className="fa-solid fa-indian-rupee-sign" style={{ color, fontSize: 11 }} />
                        {d.consultationFee || 0}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>/ visit</span>
                      </div>

                      {/* Schedule days */}
                      {d.schedule?.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                          {DAYS.map(day => {
                            const active = d.schedule.find(s => s.day === day);
                            return (
                              <span key={day} style={{
                                width: 28, height: 28, borderRadius: 7,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700,
                                background: active ? `${color}18` : 'var(--hover-bg)',
                                color: active ? color : 'var(--text-muted)',
                                border: `1px solid ${active ? `${color}40` : 'var(--border-color)'}`,
                              }}>
                                {day}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/doctors/${d._id}`} style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          textDecoration: 'none'
                        }} title="View Profile">
                          <i className="fa-solid fa-eye" />
                        </Link>
                        {/* ✅ Add Prescription button */}
                        {canCreate('prescriptions') && (
                          <Link href={`/prescriptions/new?doctor=${d._id}`} style={{
                            width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-color)',
                            background: 'var(--hover-bg)', color: '#7c3aed', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            textDecoration: 'none'
                          }} title="New Prescription">
                            <i className="fa-solid fa-prescription" />
                          </Link>
                        )}
                        {canUpdate('doctors') && (
                          <button onClick={() => openEdit(d)} style={{
                            width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-color)',
                            background: 'var(--hover-bg)', color: '#d97706', cursor: 'pointer'
                          }}>
                            <i className="fa-solid fa-pen" />
                          </button>
                        )}
                        {canDelete('doctors') && (
                          <button onClick={() => handleDelete(d._id)} style={{
                            width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-color)',
                            background: 'var(--hover-bg)', color: '#dc2626', cursor: 'pointer'
                          }}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── All Doctors Table ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Doctors</h6>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name / dept..."
                className="form-control"
                style={{ maxWidth: 210, fontSize: 13 }}
              />
              <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)}
                className="form-select" style={{ maxWidth: 180, fontSize: 13 }}>
                <option value="">All Specializations</option>
                {specs.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ✅ Skeleton table rows while loading */}
          {(loading || permLoading) ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-custom w-100">
                <thead>
                  <tr>
                    <th>Doctor</th><th>Specialization</th><th>Department</th>
                    <th>Phone</th><th>Fee</th><th>Schedule</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
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
                    <th>Doctor</th><th>Specialization</th><th>Department</th>
                    <th>Phone</th><th>Fee</th><th>Schedule</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const color = getSpecColor(d.specialization);
                    return (
                      <tr key={d._id}>

                        {/* Doctor */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                              border: `2px solid ${color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 15, color, fontWeight: 900, flexShrink: 0,
                            }}>
                              {d.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                                Dr. {d.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {d.qualification}{d.experience ? ` · ${d.experience} yrs` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Specialization */}
                        <td>
                          <span style={{
                            background: `${color}15`, color,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                            {d.specialization || '—'}
                          </span>
                        </td>

                        {/* Department */}
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.department || '—'}</td>

                        {/* Phone */}
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {d.phone
                            ? <a href={`tel:${d.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <i className="fa-solid fa-phone me-1" style={{ fontSize: 10, color }} />
                                {d.phone}
                              </a>
                            : '—'
                          }
                        </td>

                        {/* Fee */}
                        <td>
                          <span style={{ fontWeight: 700, color, fontSize: 14 }}>
                            ₹{d.consultationFee || 0}
                          </span>
                        </td>

                        {/* Schedule dots */}
                        <td>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {DAYS.map(day => {
                              const active = d.schedule?.find(s => s.day === day);
                              return (
                                <span key={day}
                                  title={active ? `${day}: ${active.startTime}–${active.endTime}` : `${day}: Off`}
                                  style={{
                                    width: 22, height: 22, borderRadius: 5,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 700,
                                    background: active ? `${color}18` : 'var(--hover-bg)',
                                    color: active ? color : 'var(--text-muted)',
                                    border: `1px solid ${active ? `${color}40` : 'var(--border-color)'}`,
                                  }}>
                                  {day[0]}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700,
                            color: isCurrentlyAvailable(d) ? '#16a34a' : '#dc2626',
                            background: isCurrentlyAvailable(d) ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            padding: '3px 10px', borderRadius: 20,
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: isCurrentlyAvailable(d) ? '#16a34a' : '#dc2626',
                            }} />
                            {isCurrentlyAvailable(d) ? 'Available Now' : 'Unavailable'}
                          </span>
                        </td>

                        {/* View/Edit/Delete */}
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Link href={`/doctors/${d._id}`} style={{
                              width: 32, height: 32, borderRadius: 7,
                              background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, color: 'var(--primary)',
                              textDecoration: 'none'
                            }} title="View Profile">
                              <i className="fa-solid fa-eye" />
                            </Link>
                            {/* ✅ Add Prescription button */}
                            {canCreate('prescriptions') && (
                              <Link href={`/prescriptions/new?doctor=${d._id}`} style={{
                                width: 32, height: 32, borderRadius: 7,
                                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, color: '#7c3aed',
                                textDecoration: 'none'
                              }} title="New Prescription">
                                <i className="fa-solid fa-prescription" />
                              </Link>
                            )}
                            {canUpdate('doctors') && (
                              <button onClick={() => openEdit(d)} style={{
                                width: 32, height: 32, borderRadius: 7,
                                border: '1px solid #d97706', background: 'rgba(217,119,6,0.1)',
                                color: '#d97706', cursor: 'pointer'
                              }}>
                                <i className="fa-solid fa-pen" />
                              </button>
                            )}
                            {canDelete('doctors') && (
                              <button onClick={() => handleDelete(d._id)} style={{
                                width: 32, height: 32, borderRadius: 7,
                                border: '1px solid #dc2626', background: 'rgba(220,38,38,0.1)',
                                color: '#dc2626', cursor: 'pointer'
                              }}>
                                <i className="fa-solid fa-trash" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-user-doctor fa-2x d-block mb-2" />
                        {search || filterSpec ? 'No doctors match your search' : 'No doctors yet — click "Add Doctor"'}
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

        {/* ── Add Doctor Modal — only if canCreate ── */}
        {!permLoading && canCreate('doctors') && (
          <Modal
            show={showModal}
            onClose={() => { setShowModal(false); setForm(emptyForm); }}
            title="👨‍⚕️ Add New Doctor"
            size="lg"
            footer={<>
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); }}
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
                  : <><i className="fa-solid fa-floppy-disk" />Save Doctor</>
                }
              </button>
            </>}
          >
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z\s\.]/g, '') })}
                  placeholder="Full Name" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Specialization *</label>
                <input className="form-control" list="spec-list" value={form.specialization}
                  onChange={e => setForm({ ...form, specialization: e.target.value })}
                  placeholder="e.g. Cardiology" required />
                <datalist id="spec-list">
                  {Object.keys(SPEC_COLORS).map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="col-md-6">
                <label className="form-label">Qualification</label>
                <input className="form-control" value={form.qualification}
                  onChange={e => setForm({ ...form, qualification: e.target.value })}
                  placeholder="e.g. MBBS, MD" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Experience (yrs)</label>
                <input type="number" className="form-control" value={form.experience}
                  onChange={e => setForm({ ...form, experience: e.target.value })} min={0} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Consultation Fee ₹</label>
                <input type="number" className="form-control" value={form.consultationFee}
                  onChange={e => setForm({ ...form, consultationFee: e.target.value })} min={0} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone}
                  maxLength={10}
                  onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="10-digit mobile number" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label">Department</label>
                <input className="form-control" value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Cardiology & Vascular, Orthopedics..." />
              </div>

              {/* ── Schedule Builder ── */}
              <div className="col-12">
                <label className="form-label">Weekly Schedule</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {DAYS.map(day => {
                    const active = form.schedule.find(s => s.day === day);
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                        padding: '6px 16px', borderRadius: 20, fontSize: 13,
                        cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s',
                        border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                        background: active ? 'var(--primary-glow)' : 'var(--hover-bg)',
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                      }}>{day}</button>
                    );
                  })}
                </div>

                {/* Time inputs for selected days */}
                {form.schedule.length > 0 && (
                  <div style={{
                    background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    {form.schedule.map(s => (
                      <div key={s.day} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{
                          width: 44, height: 32, borderRadius: 8,
                          background: 'var(--primary-glow)', color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, flexShrink: 0,
                        }}>{s.day}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="time" className="form-control" value={s.startTime}
                            onChange={e => updateSchedule(s.day, 'startTime', e.target.value)}
                            style={{ width: 120, fontSize: 13 }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
                          <input type="time" className="form-control" value={s.endTime}
                            onChange={e => updateSchedule(s.day, 'endTime', e.target.value)}
                            style={{ width: 120, fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select className="form-select" value={s.slotDuration}
                            onChange={e => updateSchedule(s.day, 'slotDuration', +e.target.value)}
                            style={{ width: 130, fontSize: 13 }}>
                            {[10, 15, 20, 30, 45, 60].map(v => (
                              <option key={v} value={v}>{v} min slots</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

      </div>

      <style>{`
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        @media (max-width: 1200px) { .stat-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } }
        .hover-lift { transition: transform 0.2s, box-shadow 0.2s; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
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

Doctors.getLayout = (page) => <Layout>{page}</Layout>;
