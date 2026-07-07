import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import StatCard from '../../components/ui/StatCard';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added

const DAYS_FULL = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

const SPEC_COLORS = {
  Cardiology: '#dc2626', Orthopedics: '#7c3aed', Gynecology: '#db2777',
  Pediatrics: '#0891b2', Neurology: '#d97706', Dermatology: '#059669',
  'General Medicine': '#16a34a', Psychiatry: '#6366f1', ENT: '#0e7490',
};
const getSpecColor = (spec) => SPEC_COLORS[spec] || '#16a34a';

const STATUS_STYLE = {
  completed: { c: '#16a34a', bg: 'rgba(22,163,74,0.1)',   label: 'Completed' },
  scheduled: { c: '#0891b2', bg: 'rgba(8,145,178,0.1)',   label: 'Scheduled' },
  cancelled: { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',   label: 'Cancelled' },
  'no-show': { c: '#d97706', bg: 'rgba(217,119,6,0.1)',   label: 'No Show'   },
  pending:   { c: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  label: 'Pending'   },
};

export default function DoctorDetail() {
  const router = useRouter();
  const { id } = router.query;

  // ✅ Permission hook
  const { canRead, canUpdate, loading: permLoading } = usePermission();

  const [doctor,       setDoctor]       = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  // ✅ Final action flags
  const showToggleAvailability = !permLoading && canUpdate('doctors');
  const showBookNew            = !permLoading && canRead('appointments');

  // ✅ Wait for permissions before loading data
  useEffect(() => {
    if (!id || permLoading) return;
    if (!canRead('doctors')) { setLoading(false); return; }

    Promise.allSettled([
      api.get(`/doctors/${id}`),
      api.get(`/appointments?doctor=${id}`),
    ]).then(([d, a]) => {
      if (d.status === 'fulfilled') setDoctor(d.value.data?.data);
      else router.push('/doctors');
      if (a.status === 'fulfilled') setAppointments(a.value.data?.data || []);
    }).finally(() => setLoading(false));
  }, [id, permLoading]);

  // ── Toggle Availability ──────────────────────────────────
  const toggleAvailability = async () => {
    // ✅ Double-check update permission
    if (!canUpdate('doctors')) return toast.error('You do not have permission to update doctor availability.');
    try {
      const res = await api.put(`/doctors/${id}`, { isAvailable: !doctor.isAvailable });
      setDoctor(res.data.data);
      toast.success(`Dr. ${doctor.name} marked as ${!doctor.isAvailable ? 'Available' : 'Unavailable'}`);
    } catch {
      toast.error('Failed to update availability');
    }
  };

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Doctor Profile" path={`/doctors/${id}`} />
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
  if (!canRead('doctors')) {
    return (
      <>
        <SEOHead title="Doctor Profile" path={`/doctors/${id}`} />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view doctor profiles.</p>
          <Link href="/"
            style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  // ── Data loading state ───────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x d-block mb-3" />
        Loading doctor profile...
      </div>
    </div>
  );

  if (!doctor) return null;

  const color     = getSpecColor(doctor.specialization);
  const today     = new Date().toDateString();
  const todayApts = appointments.filter(a => new Date(a.date).toDateString() === today);
  const completed = appointments.filter(a => a.status === 'completed');
  const upcoming  = appointments.filter(a => a.status === 'scheduled' && new Date(a.date) >= new Date());
  const cancelled = appointments.filter(a => a.status === 'cancelled');

  const statCards = [
    {
      icon: 'fa-users', label: 'Total Patients', value: appointments.length,
      color: '#16a34a', sub: 'All time appointments',
      change: `${completed.length} completed`, changeType: 'up', delay: 0,
    },
    {
      icon: 'fa-calendar-day', label: "Today's", value: todayApts.length,
      color: '#0891b2', sub: 'Appointments today',
      change: `${upcoming.length} upcoming`, changeType: 'neutral', delay: 1,
    },
    {
      icon: 'fa-circle-check', label: 'Completed', value: completed.length,
      color: '#059669', sub: 'Consultations done',
      change: appointments.length > 0
        ? `${Math.round((completed.length / appointments.length) * 100)}% rate`
        : '0% rate',
      changeType: 'up', delay: 2,
    },
    {
      icon: 'fa-calendar-xmark', label: 'Cancelled', value: cancelled.length,
      color: '#dc2626', sub: 'Cancelled appointments',
      change: cancelled.length > 0 ? 'Review needed' : 'None',
      changeType: cancelled.length > 0 ? 'down' : 'neutral', delay: 3,
    },
  ];

  const filteredApts = appointments.filter(a => !filterStatus || a.status === filterStatus);

  return (
    <>
      <SEOHead title={doctor.name?.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`} path={`/doctors/${id}`} />
      <div>

        {/* ── Back ── */}
        <div className="mb-4">
          <Link href="/doctors" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: 14, fontWeight: 600,
          }}>
            <i className="fa-solid fa-arrow-left" />Back to Doctors
          </Link>
        </div>

        {/* ── Hero Banner ── */}
        <div style={{
          borderRadius: 20, marginBottom: 28, overflow: 'hidden',
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}88 100%)`,
          position: 'relative',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: 80,
            width: 150, height: 150, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
          }} />

          <div style={{ padding: '32px 32px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>

              {/* Avatar */}
              <div style={{
                width: 92, height: 92, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 38, color: 'white', fontWeight: 900, flexShrink: 0,
              }}>
                {doctor.name?.[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ color: 'white', margin: 0, fontWeight: 900, fontSize: 26 }}>
                    {doctor.name?.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`}
                  </h3>
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: 'white',
                    padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  }}>
                    {doctor.specialization}
                  </span>
                  <span style={{
                    background: doctor.isAvailable ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                    color: 'white', padding: '4px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: doctor.isAvailable ? '#4ade80' : '#f87171',
                    }} />
                    {doctor.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Meta info row */}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {[
                    doctor.qualification && { icon: 'fa-graduation-cap',      val: doctor.qualification },
                    doctor.experience    && { icon: 'fa-briefcase-medical',    val: `${doctor.experience} yrs experience` },
                    doctor.phone         && { icon: 'fa-phone',                val: doctor.phone },
                    doctor.department    && { icon: 'fa-building',             val: doctor.department },
                    doctor.email         && { icon: 'fa-envelope',             val: doctor.email },
                  ].filter(Boolean).map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      color: 'rgba(255,255,255,0.88)', fontSize: 13,
                    }}>
                      <i className={`fa-solid ${item.icon}`} style={{ opacity: 0.75, fontSize: 12 }} />
                      {item.val}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right block — Fee + Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 16, padding: '14px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: 'white' }}>
                    ₹{doctor.consultationFee || 0}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Consultation Fee</div>
                </div>

                {/* ✅ Toggle Availability — only if showToggleAvailability */}
                {showToggleAvailability && (
                  <button
                    onClick={toggleAvailability}
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      border: '1px solid rgba(255,255,255,0.35)',
                      borderRadius: 10, padding: '8px 18px',
                      color: 'white', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.2s',
                    }}
                  >
                    <i className={`fa-solid ${doctor.isAvailable ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
                    Toggle Availability
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        <div className="row g-4">

          {/* ── Left: Schedule ── */}
          <div className="col-lg-4">
            <div className="content-card" style={{ height: '100%' }}>
              <div className="card-header-custom">
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-clock me-2" style={{ color }} />
                  Weekly Schedule
                </h6>
                <span style={{
                  fontSize: 11, background: `${color}15`, color,
                  padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                }}>
                  {doctor.schedule?.length || 0} days
                </span>
              </div>

              {doctor.schedule?.length ? (
                doctor.schedule.map((s, i) => {
                  const isToday = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3) === s.day;
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 14px', margin: '6px 0', borderRadius: 12,
                      background: isToday ? `${color}10` : 'var(--hover-bg)',
                      border: `1px solid ${isToday ? `${color}30` : 'var(--border-color)'}`,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: isToday ? `${color}20` : 'var(--card-bg)',
                          border: `1.5px solid ${isToday ? color : 'var(--border-color)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isToday ? color : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 800, flexShrink: 0,
                        }}>{s.day}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {DAYS_FULL[s.day]}
                            {isToday && (
                              <span style={{ marginLeft: 6, fontSize: 10, color, fontWeight: 700 }}>Today</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {s.slotDuration} min slots
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {s.startTime}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          to {s.endTime}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-calendar-xmark fa-2x d-block mb-2" />
                  No schedule set
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Appointments ── */}
          <div className="col-lg-8">
            <div className="content-card">
              <div className="card-header-custom" style={{ flexWrap: 'wrap', gap: 10 }}>
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-calendar-check me-2" style={{ color }} />
                  Patient Appointments
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                    ({filteredApts.length})
                  </span>
                </h6>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="form-select"
                    style={{ fontSize: 12, maxWidth: 140 }}
                  >
                    <option value="">All Status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No Show</option>
                  </select>

                  {/* ✅ Book New — only if showBookNew */}
                  {showBookNew && (
                    <Link href="/appointments" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                      borderRadius: 8, padding: '5px 14px', fontSize: 12,
                      color: 'var(--primary)', textDecoration: 'none', fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      <i className="fa-solid fa-plus" />Book New
                    </Link>
                  )}
                </div>
              </div>

              {filteredApts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-calendar-xmark fa-2x d-block mb-2" />
                  {filterStatus ? 'No appointments with this status' : 'No appointments yet'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-custom w-100">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Patient</th>
                        <th>Date</th>
                        <th>Slot</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApts.map(apt => {
                        const ss      = STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled;
                        const isToday = new Date(apt.date).toDateString() === today;
                        return (
                          <tr key={apt._id} style={{ background: isToday ? `${color}05` : 'transparent' }}>

                            {/* Token */}
                            <td>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: `${color}15`, color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13,
                              }}>
                                #{apt.tokenNumber}
                              </div>
                            </td>

                            {/* Patient */}
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                                {apt.patient?.name || 'Unknown'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {apt.patient?.patientId}
                              </div>
                            </td>

                            {/* Date */}
                            <td style={{ fontSize: 13 }}>
                              <div style={{ fontWeight: isToday ? 700 : 400, color: isToday ? color : 'var(--text-primary)' }}>
                                {new Date(apt.date).toLocaleDateString('en-IN')}
                              </div>
                              {isToday && (
                                <div style={{ fontSize: 10, color, fontWeight: 700 }}>Today</div>
                              )}
                            </td>

                            {/* Slot */}
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              <i className="fa-regular fa-clock me-1" style={{ fontSize: 10 }} />
                              {apt.timeSlot}
                            </td>

                            {/* Status */}
                            <td>
                              <span style={{
                                background: ss.bg, color: ss.c,
                                padding: '4px 12px', borderRadius: 20,
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {ss.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        @media (max-width: 1200px) { .stat-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}

DoctorDetail.getLayout = (page) => <Layout>{page}</Layout>;