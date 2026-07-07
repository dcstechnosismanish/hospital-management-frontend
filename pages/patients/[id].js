import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import StatCard from '../../components/ui/StatCard';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added

const BLOOD_COLORS = {
  'O+': '#ef4444', 'O-': '#dc2626', 'A+': '#3b82f6', 'A-': '#2563eb',
  'B+': '#f59e0b', 'B-': '#d97706', 'AB+': '#8b5cf6', 'AB-': '#7c3aed',
};

const STATUS_STYLE = {
  completed: { c: '#16a34a', bg: 'rgba(22,163,74,0.1)',   label: 'Completed' },
  scheduled: { c: '#0891b2', bg: 'rgba(8,145,178,0.1)',   label: 'Scheduled' },
  cancelled: { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',   label: 'Cancelled' },
  'no-show': { c: '#d97706', bg: 'rgba(217,119,6,0.1)',   label: 'No Show'   },
  pending:   { c: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  label: 'Pending'   },
};

const PAYMENT_STYLE = {
  paid:    { c: '#16a34a', bg: 'rgba(22,163,74,0.1)',   label: 'Paid'    },
  partial: { c: '#d97706', bg: 'rgba(217,119,6,0.1)',   label: 'Partial' },
  unpaid:  { c: '#dc2626', bg: 'rgba(220,38,38,0.1)',   label: 'Unpaid'  },
  pending: { c: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  label: 'Pending' },
};

// ── Animated section heading ───────────────────────────────
function SectionHead({ icon, label, color = 'var(--primary)', count, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`fa-solid ${icon}`} style={{ color, fontSize: 15 }} />
        </div>
        <div>
          <h6 style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>
            {label}
          </h6>
          {count !== undefined && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} records</span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Info pill row ──────────────────────────────────────────
function InfoRow({ icon, label, value, color = 'var(--primary)' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0', borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: `${color}12`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`fa-solid ${icon}`} style={{ color, fontSize: 13 }} />
      </div>
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

// ── Empty state helper ─────────────────────────────────────
function EmptyState({ icon, label }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
      }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 22 }} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
    </div>
  );
}

export default function PatientDetail() {
  const router = useRouter();
  const { id } = router.query;

  // ✅ Permission hook
  const { canRead, loading: permLoading } = usePermission();

  const [patient,       setPatient]       = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills,         setBills]         = useState([]);
  const [appointments,  setAppointments]  = useState([]);
  const [admissions,    setAdmissions]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('prescriptions');

  // ✅ Granular tab-level read permission flags
  const canReadPrescriptions = !permLoading && canRead('prescriptions');
  const canReadBills         = !permLoading && canRead('billing');
  const canReadAppointments  = !permLoading && canRead('appointments');
  const canReadAdmissions    = !permLoading && canRead('admissions-beds');

  // ✅ Build tabs dynamically based on permissions
  const ALL_TABS = [
    { key: 'prescriptions', icon: 'fa-prescription',        label: 'Prescriptions', count: prescriptions.length, allowed: canReadPrescriptions },
    { key: 'appointments',  icon: 'fa-calendar-check',      label: 'Appointments',  count: appointments.length,  allowed: canReadAppointments  },
    { key: 'admissions',    icon: 'fa-bed',                 label: 'Admissions',    count: admissions.length,    allowed: canReadAdmissions    },
    { key: 'bills',         icon: 'fa-file-invoice-dollar', label: 'Bills',         count: bills.length,         allowed: canReadBills          },
  ];
  const TABS = ALL_TABS.filter(t => t.allowed);

  // ✅ Wait for permissions before fetching data
  useEffect(() => {
    if (!id || permLoading) return;
    if (!canRead('patients')) { setLoading(false); return; }

    setLoading(true);
    Promise.allSettled([
      api.get(`/patients/${id}`),
      canReadPrescriptions ? api.get(`/prescriptions/patient/${id}`)  : Promise.resolve(null),
      canReadBills         ? api.get(`/bills/patient/${id}`)          : Promise.resolve(null),
      canReadAppointments  ? api.get(`/appointments?patient=${id}`)   : Promise.resolve(null),
      canReadAdmissions    ? api.get(`/admissions?patient=${id}`)     : Promise.resolve(null),
    ]).then(([p, rx, b, a, adm]) => {
      if (p.status === 'fulfilled' && p.value)  setPatient(p.value.data?.data);
      else if (p.status === 'rejected') router.push('/patients');
      if (rx?.status === 'fulfilled' && rx.value) setPrescriptions(rx.value.data?.data || []);
      if (b?.status  === 'fulfilled' && b.value)  setBills(b.value.data?.data          || []);
      if (a?.status  === 'fulfilled' && a.value)  setAppointments(a.value.data?.data   || []);
      if (adm?.status === 'fulfilled' && adm.value) setAdmissions(adm.value.data?.data || []);
    }).finally(() => setLoading(false));
  }, [id, permLoading]);

  // ✅ Sync activeTab to first allowed tab when permissions resolve
  useEffect(() => {
    if (!permLoading && TABS.length > 0 && !TABS.find(t => t.key === activeTab)) {
      setActiveTab(TABS[0].key);
    }
  }, [permLoading]);

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Patient Profile" path={`/patients/${id}`} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin fa-3x d-block mb-3" style={{ color: 'var(--primary)' }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Checking permissions…</div>
          </div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!canRead('patients')) {
    return (
      <>
        <SEOHead title="Patient Profile" path={`/patients/${id}`} />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view patient profiles.</p>
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-spinner fa-spin fa-3x d-block mb-3" style={{ color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Loading patient profile...</div>
      </div>
    </div>
  );

  if (!patient) return null;

  const bloodColor = BLOOD_COLORS[patient.bloodGroup] || '#16a34a';

  // ── Stats ──────────────────────────────────────────────────
  const today       = new Date().toDateString();
  const totalBilled = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalPaid   = bills.reduce((s, b) => s + (b.amountPaid  || 0), 0);
  const totalDue    = totalBilled - totalPaid;
  const lastVisit   = appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const statCards = [
    {
      icon: 'fa-calendar-check', label: 'Appointments', value: appointments.length,
      color: '#16a34a', sub: 'All time visits',
      change: lastVisit ? `Last: ${new Date(lastVisit.date).toLocaleDateString('en-IN')}` : 'No visits yet',
      changeType: 'neutral', delay: 0,
    },
    {
      icon: 'fa-prescription', label: 'Prescriptions', value: prescriptions.length,
      color: '#7c3aed', sub: 'Medical prescriptions',
      change: prescriptions.length > 0 ? 'View below' : 'None yet',
      changeType: 'neutral', delay: 1,
    },
    {
      icon: 'fa-indian-rupee-sign', label: 'Total Billed', value: totalBilled,
      color: '#0891b2', prefix: '₹', sub: 'All bills combined',
      change: `₹${totalPaid.toLocaleString('en-IN')} paid`,
      changeType: 'up', delay: 2,
    },
    {
      icon: 'fa-circle-exclamation', label: 'Amount Due', value: totalDue,
      color: totalDue > 0 ? '#dc2626' : '#16a34a', prefix: '₹', sub: 'Outstanding balance',
      change: totalDue > 0 ? 'Pending payment' : 'Fully cleared',
      changeType: totalDue > 0 ? 'down' : 'neutral', delay: 3,
    },
  ];

  return (
    <>
      <SEOHead title={`${patient.name} — Patient`} path={`/patients/${id}`} />
      <div>

        {/* ── Back ── */}
        <div className="mb-4">
          <Link href="/patients" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: 14, fontWeight: 600, transition: 'color 0.2s',
          }}>
            <i className="fa-solid fa-arrow-left" />Back to Patients
          </Link>
        </div>

        {/* ── Hero Banner ── */}
        <div style={{
          borderRadius: 20, marginBottom: 28, overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--primary) 0%, #059669 100%)',
          position: 'relative',
        }}>
          {/* Decorative blobs */}
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 220, height: 220,
            borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: 120, width: 160, height: 160,
            borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: '30%', left: '40%', width: 100, height: 100,
            borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
          }} />

          <div style={{ padding: '28px 32px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>

              {/* Avatar */}
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: 'white', fontWeight: 900, flexShrink: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}>
                {patient.name?.[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <h3 style={{ color: 'white', margin: 0, fontWeight: 900, fontSize: 26 }}>
                    {patient.name}
                  </h3>
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: 'white',
                    padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    fontFamily: 'monospace', letterSpacing: 0.5,
                  }}>
                    {patient.patientId}
                  </span>
                  <span style={{
                    background: patient.type === 'IPD'
                      ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.2)',
                    color: 'white', padding: '4px 14px',
                    borderRadius: 20, fontSize: 12, fontWeight: 700,
                  }}>
                    {patient.type || 'OPD'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {[
                    { icon: 'fa-cake-candles',  val: `${patient.age} years old` },
                    { icon: 'fa-venus-mars',     val: patient.gender              },
                    { icon: 'fa-phone',          val: patient.phone               },
                    patient.email   && { icon: 'fa-envelope',     val: patient.email    },
                    patient.address && { icon: 'fa-location-dot', val: patient.address  },
                  ].filter(Boolean).map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      color: 'rgba(255,255,255,0.88)', fontSize: 13,
                    }}>
                      <i className={`fa-solid ${item.icon}`} style={{ opacity: 0.7, fontSize: 11 }} />
                      {item.val}
                    </div>
                  ))}
                </div>
              </div>

              {/* Blood Group badge */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: bloodColor,
                border: '3px solid rgba(255,255,255,0.4)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 900, fontSize: 20,
                flexShrink: 0, boxShadow: `0 6px 20px ${bloodColor}80`,
              }}>
                {patient.bloodGroup || '—'}
                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, letterSpacing: 1 }}>BLOOD</span>
              </div>

            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Main Layout ── */}
        <div className="row g-4">

          {/* ── Left Column ── */}
          <div className="col-lg-4">

            {/* Personal Info Card */}
            <div className="content-card mb-4 anim-fade-up" style={{ animationDelay: '0.1s' }}>
              <SectionHead icon="fa-circle-user" label="Personal Info" />
              <InfoRow icon="fa-cake-candles"  label="Age"          value={`${patient.age} years`} />
              <InfoRow icon="fa-venus-mars"    label="Gender"       value={patient.gender} />
              <InfoRow icon="fa-droplet"       label="Blood Group"
                value={
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: `${bloodColor}15`, color: bloodColor,
                    padding: '3px 12px', borderRadius: 20, fontWeight: 800, fontSize: 13,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: bloodColor }} />
                    {patient.bloodGroup}
                  </span>
                }
                color={bloodColor}
              />
              <InfoRow icon="fa-notes-medical" label="Patient Type" value={patient.type} />
              <InfoRow icon="fa-location-dot"  label="Address"      value={patient.address} />
              {patient.phone && (
                <InfoRow icon="fa-phone" label="Phone"
                  value={
                    <a href={`tel:${patient.phone}`} style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 700 }}>
                      {patient.phone}
                    </a>
                  }
                  color="#16a34a"
                />
              )}
              {patient.email && (
                <InfoRow icon="fa-envelope" label="Email"
                  value={
                    <a href={`mailto:${patient.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                      {patient.email}
                    </a>
                  }
                />
              )}
            </div>

            {/* Medical Flags Card */}
            <div className="content-card mb-4 anim-fade-up" style={{ animationDelay: '0.15s' }}>
              <SectionHead icon="fa-triangle-exclamation" label="Medical Flags" color="#d97706" />

              {/* Allergies */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.8, color: '#dc2626', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 10 }} />Allergies
                </div>
                {patient.allergies?.length ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {patient.allergies.map(a => (
                      <span key={a} style={{
                        background: 'rgba(220,38,38,0.1)', color: '#dc2626',
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        border: '1px solid rgba(220,38,38,0.2)',
                      }}>{a}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{
                    fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(22,163,74,0.1)', padding: '4px 12px', borderRadius: 20, fontWeight: 600,
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />None recorded
                  </span>
                )}
              </div>

              {/* Chronic conditions */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.8, color: '#d97706', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <i className="fa-solid fa-heart-pulse" style={{ fontSize: 10 }} />Chronic Conditions
                </div>
                {patient.chronicConditions?.length ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {patient.chronicConditions.map(c => (
                      <span key={c} style={{
                        background: 'rgba(217,119,6,0.1)', color: '#d97706',
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        border: '1px solid rgba(217,119,6,0.2)',
                      }}>{c}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{
                    fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(22,163,74,0.1)', padding: '4px 12px', borderRadius: 20, fontWeight: 600,
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />None recorded
                  </span>
                )}
              </div>
            </div>

            {/* Emergency Contact Card */}
            {patient.emergencyContact?.name && (
              <div className="content-card anim-fade-up" style={{ animationDelay: '0.2s' }}>
                <SectionHead icon="fa-phone-volume" label="Emergency Contact" color="#dc2626" />
                <div style={{
                  background: 'rgba(220,38,38,0.05)',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 14, padding: '16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#dc2626', fontWeight: 900, fontSize: 18, flexShrink: 0,
                  }}>
                    {patient.emergencyContact.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {patient.emergencyContact.name}
                    </div>
                    <a href={`tel:${patient.emergencyContact.phone}`} style={{
                      fontSize: 13, color: '#dc2626', textDecoration: 'none', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4,
                    }}>
                      <i className="fa-solid fa-phone" style={{ fontSize: 10 }} />
                      {patient.emergencyContact.phone}
                    </a>
                    <span style={{
                      fontSize: 11, background: 'rgba(8,145,178,0.1)', color: '#0891b2',
                      padding: '2px 10px', borderRadius: 20, fontWeight: 700,
                    }}>
                      {patient.emergencyContact.relation}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column — Tabs ── */}
          <div className="col-lg-8">
            <div className="content-card anim-fade-up" style={{ animationDelay: '0.05s' }}>

              {/* ── Tab Buttons ── */}
              {/* ✅ Only renders tabs the user has permission to see */}
              {TABS.length > 0 ? (
                <>
                  <div style={{
                    display: 'flex', gap: 6, marginBottom: 24,
                    background: 'var(--hover-bg)',
                    padding: 6, borderRadius: 14,
                    border: '1px solid var(--border-color)',
                  }}>
                    {TABS.map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 8,
                          padding: '10px 12px', borderRadius: 10,
                          border: 'none', cursor: 'pointer', fontWeight: 700,
                          fontSize: 13, transition: 'all 0.2s',
                          background: activeTab === tab.key ? 'var(--card-bg)' : 'transparent',
                          color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                          boxShadow: activeTab === tab.key ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
                        }}>
                        <i className={`fa-solid ${tab.icon}`} style={{ fontSize: 13 }} />
                        <span className="tab-label">{tab.label}</span>
                        <span style={{
                          minWidth: 20, height: 20, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800, padding: '0 6px',
                          background: activeTab === tab.key ? 'var(--primary-glow)' : 'rgba(0,0,0,0.05)',
                          color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                        }}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* ── Prescriptions Tab ── */}
                  {activeTab === 'prescriptions' && canReadPrescriptions && (
                    <div>
                      {prescriptions.length === 0 ? (
                        <EmptyState icon="fa-file-medical" label="No prescriptions yet" />
                      ) : (
                        prescriptions.map((rx, idx) => (
                          <div key={rx._id} className="anim-fade-up"
                            style={{
                              padding: 18, marginBottom: 14, borderRadius: 14,
                              background: 'var(--hover-bg)',
                              border: '1px solid var(--border-color)',
                              animationDelay: `${idx * 0.05}s`,
                              transition: 'box-shadow 0.2s',
                            }}>
                            {/* Rx header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)', marginBottom: 2 }}>
                                  <i className="fa-solid fa-stethoscope me-2" style={{ fontSize: 13 }} />
                                  {rx.diagnosis}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <i className="fa-solid fa-user-doctor" style={{ fontSize: 10, color: 'var(--primary)' }} />
                                  Dr. {rx.doctor?.name}
                                  {rx.doctor?.specialization && ` · ${rx.doctor.specialization}`}
                                </div>
                              </div>
                              <span style={{
                                fontSize: 11, color: 'var(--text-muted)',
                                background: 'var(--card-bg)', padding: '4px 10px',
                                borderRadius: 20, border: '1px solid var(--border-color)',
                              }}>
                                <i className="fa-regular fa-calendar me-1" />
                                {new Date(rx.createdAt).toLocaleDateString('en-IN')}
                              </span>
                            </div>

                            {/* Medicines */}
                            {rx.medicines?.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: rx.notes ? 10 : 0 }}>
                                {rx.medicines.map((m, i) => (
                                  <span key={i} style={{
                                    background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                                    border: '1px solid rgba(22,163,74,0.2)',
                                    padding: '4px 12px', borderRadius: 20,
                                    fontSize: 12, fontWeight: 700,
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                  }}>
                                    <i className="fa-solid fa-pills" style={{ fontSize: 9 }} />
                                    {m.name} {m.dosage}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {rx.notes && (
                              <div style={{
                                marginTop: 10, padding: '10px 14px', borderRadius: 10,
                                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                fontSize: 12, color: 'var(--text-secondary)',
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                              }}>
                                <i className="fa-solid fa-note-sticky" style={{ color: '#d97706', marginTop: 1, flexShrink: 0 }} />
                                {rx.notes}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ── Appointments Tab ── */}
                  {activeTab === 'appointments' && canReadAppointments && (
                    <div>
                      {appointments.length === 0 ? (
                        <EmptyState icon="fa-calendar-xmark" label="No appointments yet" />
                      ) : (
                        appointments.map((apt, idx) => {
                          const ss      = STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled;
                          const isToday = new Date(apt.date).toDateString() === today;
                          return (
                            <div key={apt._id} className="anim-fade-up"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 16px', marginBottom: 10, borderRadius: 14,
                                background: isToday ? 'rgba(22,163,74,0.05)' : 'var(--hover-bg)',
                                border: `1px solid ${isToday ? 'rgba(22,163,74,0.2)' : 'var(--border-color)'}`,
                                animationDelay: `${idx * 0.04}s`,
                                transition: 'all 0.2s',
                              }}>

                              {/* Token */}
                              <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${ss.c}15`,
                                border: `1.5px solid ${ss.c}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, color: ss.c, fontSize: 13, flexShrink: 0,
                              }}>
                                #{apt.tokenNumber || '—'}
                              </div>

                              {/* Doctor info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                                  Dr. {apt.doctor?.name || 'Unknown'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {apt.doctor?.specialization && (
                                    <span><i className="fa-solid fa-stethoscope me-1" style={{ fontSize: 9 }} />{apt.doctor.specialization}</span>
                                  )}
                                  <span><i className="fa-regular fa-clock me-1" style={{ fontSize: 9 }} />{apt.timeSlot}</span>
                                </div>
                              </div>

                              {/* Date */}
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{
                                  fontSize: 13, fontWeight: isToday ? 800 : 500,
                                  color: isToday ? '#16a34a' : 'var(--text-secondary)',
                                  marginBottom: 4,
                                }}>
                                  {isToday ? 'Today' : new Date(apt.date).toLocaleDateString('en-IN')}
                                </div>
                                <span style={{
                                  background: ss.bg, color: ss.c,
                                  padding: '3px 10px', borderRadius: 20,
                                  fontSize: 10, fontWeight: 700,
                                }}>
                                  {ss.label}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* ── Admissions Tab ── */}
                  {activeTab === 'admissions' && canReadAdmissions && (
                    <div>
                      {admissions.length === 0 ? (
                        <EmptyState icon="fa-bed" label="No admissions recorded" />
                      ) : (
                        admissions.map((adm, idx) => (
                          <div key={adm._id} className="anim-fade-up"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '14px 16px', marginBottom: 10, borderRadius: 14,
                              background: adm.status === 'admitted' ? 'rgba(22,163,74,0.05)' : 'var(--hover-bg)',
                              border: `1px solid ${adm.status === 'admitted' ? 'rgba(22,163,74,0.2)' : 'var(--border-color)'}`,
                              animationDelay: `${idx * 0.04}s`,
                              transition: 'all 0.2s',
                            }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12,
                              background: adm.status === 'admitted' ? 'rgba(22,163,74,0.1)' : 'rgba(8,145,178,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: adm.status === 'admitted' ? '#16a34a' : '#0891b2', flexShrink: 0,
                            }}>
                              <i className="fa-solid fa-bed" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                                {adm.diagnosis}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {adm.bed?.bedNumber} ({adm.bed?.ward} Ward) · Admitted: {new Date(adm.admissionDate).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                background: adm.status === 'admitted' ? 'rgba(22,163,74,0.1)' : 'rgba(8,145,178,0.1)',
                                color: adm.status === 'admitted' ? '#16a34a' : '#0891b2',
                                padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'capitalize'
                              }}>
                                {adm.status}
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                {adm.status === 'discharged' ? `Stay: ${adm.totalDays} days` : 'Active'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ── Bills Tab ── */}
                  {activeTab === 'bills' && canReadBills && (
                    <div>
                      {/* Bills summary strip */}
                      {bills.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                          {[
                            { label: 'Total Billed', val: `₹${totalBilled.toLocaleString('en-IN')}`, color: '#0891b2'  },
                            { label: 'Total Paid',   val: `₹${totalPaid.toLocaleString('en-IN')}`,   color: '#16a34a'  },
                            { label: 'Amount Due',   val: `₹${totalDue.toLocaleString('en-IN')}`,    color: totalDue > 0 ? '#dc2626' : '#16a34a' },
                          ].map((item, i) => (
                            <div key={i} style={{
                              textAlign: 'center', padding: '14px 8px', borderRadius: 12,
                              background: `${item.color}08`, border: `1px solid ${item.color}20`,
                            }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.val}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {bills.length === 0 ? (
                        <EmptyState icon="fa-file-invoice" label="No bills found" />
                      ) : (
                        bills.map((b, idx) => {
                          const ps = PAYMENT_STYLE[b.paymentStatus] || PAYMENT_STYLE.pending;
                          return (
                            <div key={b._id} className="anim-fade-up"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 16px', marginBottom: 10, borderRadius: 14,
                                background: 'var(--hover-bg)',
                                border: '1px solid var(--border-color)',
                                animationDelay: `${idx * 0.04}s`,
                                transition: 'all 0.2s',
                              }}>

                              {/* Bill icon */}
                              <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${ps.c}15`,
                                border: `1.5px solid ${ps.c}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: ps.c, flexShrink: 0,
                              }}>
                                <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 16 }} />
                              </div>

                              {/* Bill info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 800, color: 'var(--primary)',
                                    fontFamily: 'monospace', letterSpacing: 0.5,
                                    background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: 6,
                                  }}>
                                    {b.billNumber}
                                  </span>
                                  {b.type && (
                                    <span style={{
                                      fontSize: 11, background: 'rgba(8,145,178,0.1)', color: '#0891b2',
                                      padding: '2px 10px', borderRadius: 20, fontWeight: 700,
                                    }}>
                                      {b.type}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  <i className="fa-regular fa-calendar me-1" />
                                  {new Date(b.createdAt).toLocaleDateString('en-IN')}
                                </div>
                              </div>

                              {/* Amount */}
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: 16, marginBottom: 4 }}>
                                  ₹{b.totalAmount?.toLocaleString('en-IN')}
                                </div>
                                <span style={{
                                  background: ps.bg, color: ps.c,
                                  padding: '3px 10px', borderRadius: 20,
                                  fontSize: 10, fontWeight: 700,
                                }}>
                                  {ps.label}
                                </span>
                              </div>

                              {/* View button */}
                              <Link href={`/billing/invoice/${b._id}`} style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                                borderRadius: 9, padding: '7px 12px', fontSize: 12,
                                color: 'var(--primary)', textDecoration: 'none', fontWeight: 600,
                                flexShrink: 0,
                              }}>
                                <i className="fa-solid fa-file-invoice" />
                                <span className="btn-label">View</span>
                              </Link>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              ) : (
                // ✅ No tabs visible — user can read patient but no related data
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-lock fa-2x d-block mb-3" style={{ opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    No additional data available for your role.
                  </div>
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
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } .tab-label { display: none; } .btn-label { display: none; } }
        .anim-fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .content-card:hover { transition: box-shadow 0.25s; }
      `}</style>
    </>
  );
}

PatientDetail.getLayout = (page) => <Layout>{page}</Layout>;