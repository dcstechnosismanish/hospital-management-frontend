import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import BackButton from '../../components/ui/BackButton'; // ✅ Added
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission';

// ── Empty medicine row template ──
const EMPTY_MED = () => ({
  _key:         Math.random().toString(36).slice(2),
  medicineName: '',
  medicine:     '',
  dosage:       '',
  frequency:    'Once daily',
  duration:     '5 days',
  route:        'Oral',
  instructions: '',
  quantity:     1,
});

const FREQ_OPTS  = ['Once daily','Twice daily','Three times daily','Four times daily','Every 8 hours','Every 6 hours','As needed','At bedtime','With meals'];
const ROUTE_OPTS = ['Oral','IV','IM','SC','Topical','Inhaled','Sublingual','Rectal'];
const VISIT_OPTS = ['OPD','IPD','Teleconsult','Emergency'];
const STATUS_OPTS = ['active','completed','cancelled'];

const formatDoctorName = (name) => {
  if (!name) return '—';
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
};

// ── Field style helper ──
const fld = (extra = {}) => ({
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid var(--border-color)',
  background: 'var(--input-bg,var(--hover-bg))',
  color: 'var(--text-primary)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  ...extra,
});

const SectionTitle = ({ icon, title, color = '#7c3aed' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--border-color)' }}>
    <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
      <i className={`fa-solid ${icon}`} />
    </div>
    <h6 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{title}</h6>
  </div>
);

export default function NewPrescription() {
  const { user } = useAuth();
  const router   = useRouter();

  // ✅ Permission hook
  const { canRead, canCreate, loading: permLoading } = usePermission();

  // ── State ──
  const [tab,    setTab]    = useState(0);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const [doctorInfo, setDoctorInfo] = useState(null);
  const [doctorId,   setDoctorId]   = useState('');

  const [patients,  setPatients]  = useState([]);
  const [doctors,   setDoctors]   = useState([]);
  const [medicines, setMedicines] = useState([]);

  const [form, setForm] = useState({
    patient:         '',
    doctor:          '',
    appointment:     '',
    visitType:       'OPD',
    date:            new Date().toISOString().slice(0, 10),
    chiefComplaints: '',
    history:         '',
    examination:     '',
    diagnosis:       '',
    icdCode:         '',
    advice:          '',
    followUpDate:    '',
    followUpNotes:   '',
    notes:           '',
    labTests:        '',
    vitals: { bp: '', pulse: '', temperature: '', weight: '', height: '', spo2: '' },
  });
  const [meds, setMeds] = useState([EMPTY_MED()]);

  // ✅ Wait for permissions before loading data
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('prescriptions')) return; // guard — redirect handled below

    const load = async () => {
      try {
        const [p, d, m] = await Promise.all([
          api.get('/patients?limit=200').catch(() => ({ data: { data: [] } })),
          api.get('/doctors?limit=200').catch(()  => ({ data: { data: [] } })),
          api.get('/medicines?limit=500').catch(() => ({ data: { data: [] } })),
        ]);
        setPatients(p.data.data  || []);
        setDoctors(d.data.data   || []);
        setMedicines(m.data.data || []);

        // Auto-resolve doctor from logged-in user
        if (user?.role === 'doctor') {
          const docList = d.data.data || [];
          const matched = docList.find(
            doc => doc.userId === (user._id || user.id) ||
                   doc.userId?.toString() === (user._id || user.id)?.toString() ||
                   doc.name?.toLowerCase() === user.name?.toLowerCase()
          );
          if (matched) {
            setDoctorInfo(matched);
            setDoctorId(matched._id);
            setForm(f => ({ ...f, doctor: matched._id }));
          } else if (docList.length === 1) {
            setDoctorInfo(docList[0]);
            setDoctorId(docList[0]._id);
            setForm(f => ({ ...f, doctor: docList[0]._id }));
          }
        }
      } catch (e) {
        console.error('Load error:', e);
      }
    };
    load();
  }, [permLoading, user]);

  const setF     = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setVital = (k, v) => setForm(f => ({ ...f, vitals: { ...f.vitals, [k]: v } }));

  // ✅ Force numeric input for vitals and auto-format BP
  const handleVitalChange = (k, v) => {
    let val = v;
    if (k === 'bp') {
      val = v.replace(/[^0-9/]/g, ''); // Allow digits and /
      
      // Auto-insert slash after 3 digits if not present and user is typing forward
      if (val.length === 3 && !val.includes('/') && val.length > (form.vitals.bp?.length || 0)) {
        val = val + '/';
      }
      
      const parts = val.split('/');
      // ✅ Limit after slash to 3 digits
      if (parts.length > 1 && parts[1].length > 3) {
        val = parts[0] + '/' + parts[1].slice(0, 3);
      }
      
      // Prevent multiple slashes
      if (parts.length > 2) val = parts[0] + '/' + parts[1].replace(/\//g, '');
    } else {
      val = v.replace(/[^0-9.]/g, ''); // Allow digits and .
    }
    setVital(k, val);
  };

  // ── Medicine row helpers ──
  const addMed    = () => setMeds(m => [...m, EMPTY_MED()]);
  const removeMed = (key) => setMeds(m => m.filter(r => r._key !== key));
  const updateMed = (key, field, value) =>
    setMeds(m => m.map(r => r._key === key ? { ...r, [field]: value } : r));
  const selectMedFromList = (key, medObj) => {
    setMeds(m => m.map(r => r._key === key ? {
      ...r,
      medicine:     medObj._id,
      medicineName: medObj.name,
    } : r));
  };

  // ── Validation ──
  const validateTab = (t) => {
    const hasLetters = (str) => /[a-zA-Z]/.test(str || '');

    if (t === 0) {
      if (!form.patient) return 'Please select a patient.';
      if (!form.doctor)  return 'Please select a doctor.';
      
      // ✅ Prevent back-dating
      const todayStr = new Date().toISOString().slice(0, 10);
      if (form.date < todayStr) {
        return 'Back-dating is not allowed. Please select today or a future date.';
      }
    }

    if (t === 1) {
      const fields = [
        { key: 'chiefComplaints', label: 'Chief Complaints' },
        { key: 'history',         label: 'History'          },
        { key: 'examination',     label: 'Examination'      },
        { key: 'diagnosis',       label: 'Diagnosis'        },
        { key: 'advice',          label: 'Advice'           },
      ];
      for (const f of fields) {
        const val = form[f.key]?.trim();
        if (val && !hasLetters(val)) {
          return `${f.label} must contain at least one letter (avoid purely numeric entries).`;
        }
      }
    }

    if (t === 2) {
      for (let i = 0; i < meds.length; i++) {
        const m = meds[i];
        if (m.medicineName?.trim() && !hasLetters(m.medicineName)) {
          return `Medicine Name in row ${i + 1} must contain at least one letter.`;
        }
        if (m.dosage?.trim() && !hasLetters(m.dosage)) {
          return `Dosage in row ${i + 1} must contain at least one letter (e.g., 500mg).`;
        }
      }

      const validMeds = meds.filter(m => m.medicineName?.trim() && m.dosage?.trim());
      if (validMeds.length === 0 && !form.advice?.trim() && !form.labTests?.trim()) {
        return 'Add at least one medicine, or provide advice/lab tests.';
      }
    }
    return '';
  };

  const nextTab = () => {
    const err = validateTab(tab);
    if (err) { setError(err); return; }
    setError('');
    setTab(t => t + 1);
  };
  const prevTab = () => { setError(''); setTab(t => t - 1); };

  // ── Submit ──
  const handleSubmit = async () => {
    // ✅ Double-check create permission before submitting
    if (!canCreate('prescriptions')) {
      setError('You do not have permission to create prescriptions.');
      return;
    }

    setError('');
    const validMeds = meds
      .filter(m => m.medicineName.trim() && m.dosage.trim())
      .map(({ _key, ...rest }) => ({
        ...rest,
        medicine: rest.medicine || undefined
      }));

    const payload = {
      patient:         form.patient,
      doctor:          form.doctor,
      visitType:       form.visitType,
      date:            form.date,
      chiefComplaints: form.chiefComplaints,
      history:         form.history,
      examination:     form.examination,
      diagnosis:       form.diagnosis,
      icdCode:         form.icdCode,
      advice:          form.advice,
      followUpNotes:   form.followUpNotes,
      notes:           form.notes,
      vitals:          form.vitals,
      medicines:       validMeds,
      labTests:        form.labTests ? form.labTests.split(',').map(s => s.trim()).filter(Boolean) : [],
      status:          'active',
    };

    if (form.appointment && form.appointment.trim()) payload.appointment = form.appointment;
    if (form.followUpDate && form.followUpDate.trim()) payload.followUpDate = form.followUpDate;

    setSaving(true);
    try {
      const { data } = await api.post('/prescriptions', payload);
      if (data.success) {
        router.push(`/prescriptions/${data.data._id}`);
      } else {
        setError(data.message || 'Failed to save prescription.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Server error');
    } finally {
      setSaving(false);
    }
  };

  const selectedDoctor  = doctorInfo || doctors.find(d => d._id === form.doctor) || null;
  const selectedPatient = patients.find(p => p._id === form.patient) || null;

  const TABS = [
    { label: 'Patient & Doctor', icon: 'fa-user-injured'     },
    { label: 'Clinical Details', icon: 'fa-stethoscope'       },
    { label: 'Medicines',        icon: 'fa-pills'             },
    { label: 'Review & Save',    icon: 'fa-clipboard-check'   },
  ];

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="New Prescription" path="/prescriptions/new" />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', flexDirection: 'column', gap: 14,
        }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#7c3aed' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Checking permissions…</div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  // canCreate check: this is a "new prescription" page — no point showing it without create access
  if (!canRead('prescriptions') || !canCreate('prescriptions')) {
    return (
      <>
        <SEOHead title="New Prescription" path="/prescriptions/new" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to create prescriptions.</p>
          <Link href="/prescriptions"
            style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Prescriptions
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="New Prescription" path="/prescriptions/new" />

      {/* ── Page Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <div>
            <h4 style={{ margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>
                <i className="fa-solid fa-file-prescription" />
              </span>
              New Prescription
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => {
          const done   = i < tab;
          const active = i === tab;
          return (
            <button key={i}
              onClick={() => { if (i < tab) { setError(''); setTab(i); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 12,
                border:      active ? '2px solid #7c3aed' : done ? '2px solid #16a34a' : '2px solid var(--border-color)',
                background:  active ? 'rgba(124,58,237,0.1)' : done ? 'rgba(22,163,74,0.06)' : 'var(--hover-bg)',
                color:       active ? '#7c3aed' : done ? '#16a34a' : 'var(--text-muted)',
                fontWeight: 700, fontSize: 13, cursor: i < tab ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              {done
                ? <i className="fa-solid fa-circle-check" style={{ fontSize: 14 }} />
                : <i className={`fa-solid ${t.icon}`} style={{ fontSize: 13 }} />
              }
              <span className="tab-label">{t.label}</span>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? '#7c3aed' : done ? '#16a34a' : 'var(--border-color)',
                color: active || done ? 'white' : 'var(--text-muted)',
              }}>{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', marginBottom: 20, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-circle-exclamation" />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 0 — Patient & Doctor
      ══════════════════════════════════════ */}
      {tab === 0 && (
        <div className="content-card">
          <SectionTitle icon="fa-user-injured" title="Patient & Doctor Information" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>

            {/* Patient */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Patient <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select value={form.patient} onChange={e => setF('patient', e.target.value)} style={fld()}>
                <option value="">— Select Patient —</option>
                {patients.map(p => (
                  <option key={p._id} value={p._id}>{p.name} {p.patientId ? `(${p.patientId})` : ''}</option>
                ))}
              </select>
              {selectedPatient && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0891b2' }}>{selectedPatient.name}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                    {selectedPatient.age ? `${selectedPatient.age} yrs` : ''}
                    {selectedPatient.gender    ? ` · ${selectedPatient.gender}`    : ''}
                    {selectedPatient.bloodGroup ? ` · ${selectedPatient.bloodGroup}` : ''}
                  </div>
                  {selectedPatient.phone && (
                    <div style={{ color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-phone me-1" />{selectedPatient.phone}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Doctor <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {user?.role === 'doctor' && selectedDoctor ? (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(8,145,178,0.06)', border: '1.5px solid rgba(8,145,178,0.35)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(8,145,178,0.15)', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                      <i className="fa-solid fa-user-doctor" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatDoctorName(selectedDoctor.name)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {selectedDoctor.specialization || ''}
                        {selectedDoctor.qualification ? ` · ${selectedDoctor.qualification}` : ''}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                      <i className="fa-solid fa-lock me-1" />Auto
                    </span>
                  </div>
                </div>
              ) : (
                <select value={form.doctor} onChange={e => setF('doctor', e.target.value)} style={fld()}>
                  <option value="">— Select Doctor —</option>
                  {doctors.map(d => (
                  <option key={d._id} value={d._id}>{formatDoctorName(d.name)} {d.specialization ? `· ${d.specialization}` : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Visit Type */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Visit Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VISIT_OPTS.map(v => (
                  <button key={v} onClick={() => setF('visitType', v)}
                    style={{ padding: '8px 16px', borderRadius: 9, border: `2px solid ${form.visitType === v ? '#7c3aed' : 'var(--border-color)'}`, background: form.visitType === v ? 'rgba(124,58,237,0.1)' : 'var(--hover-bg)', color: form.visitType === v ? '#7c3aed' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</label>
              <input type="date" value={form.date} 
                onChange={e => setF('date', e.target.value)} 
                min={new Date().toISOString().slice(0, 10)}
                style={fld()} />
            </div>

            {/* Appointment (optional) - REMOVED per user request */}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 1 — Clinical Details
      ══════════════════════════════════════ */}
      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Vitals */}
          <div className="content-card">
            <SectionTitle icon="fa-heart-pulse" title="Vitals" color="#dc2626" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {[
                { k: 'bp',          label: 'Blood Pressure', placeholder: '120/80 mmHg' },
                { k: 'pulse',       label: 'Pulse',          placeholder: '72 bpm'      },
                { k: 'temperature', label: 'Temperature',    placeholder: '98.6 °F'     },
                { k: 'weight',      label: 'Weight',         placeholder: '70 kg'       },
                { k: 'height',      label: 'Height',         placeholder: '170 cm'      },
                { k: 'spo2',        label: 'SpO₂',           placeholder: '98%'         },
              ].map(v => (
                <div key={v.k}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{v.label}</label>
                  <input value={form.vitals[v.k]} onChange={e => handleVitalChange(v.k, e.target.value)} placeholder={v.placeholder} style={fld()} />
                </div>
              ))}
            </div>
          </div>

          {/* Clinical notes */}
          <div className="content-card">
            <SectionTitle icon="fa-stethoscope" title="Clinical Notes" color="#0891b2" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {[
                { k: 'chiefComplaints', label: 'Chief Complaints', rows: 3, placeholder: 'Fever, headache since 3 days...' },
                { k: 'history',         label: 'History',          rows: 3, placeholder: 'Past medical history...'         },
                { k: 'examination',     label: 'Examination',      rows: 3, placeholder: 'General examination findings...' },
                { k: 'diagnosis',       label: 'Diagnosis',        rows: 2, placeholder: 'Primary diagnosis...'            },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
                  <textarea value={form[f.k]} onChange={e => setF(f.k, e.target.value)} rows={f.rows} placeholder={f.placeholder}
                    style={{ ...fld(), resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ICD Code <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={form.icdCode} onChange={e => setF('icdCode', e.target.value)} placeholder="e.g. J06.9" style={fld()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Lab Tests <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma separated)</span>
                </label>
                <input value={form.labTests} onChange={e => setF('labTests', e.target.value)} placeholder="CBC, LFT, Urine R/E" style={fld()} />
              </div>
            </div>
          </div>

          {/* Advice + Follow-up */}
          <div className="content-card">
            <SectionTitle icon="fa-calendar-plus" title="Advice & Follow-up" color="#16a34a" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Advice</label>
                <textarea value={form.advice} onChange={e => setF('advice', e.target.value)} rows={3}
                  placeholder="Rest, avoid spicy food..." style={{ ...fld(), resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Follow-up Date</label>
                <input type="date" value={form.followUpDate} 
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setF('followUpDate', e.target.value)} style={fld()} />
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Follow-up Notes</label>
                <input value={form.followUpNotes} onChange={e => setF('followUpNotes', e.target.value)} placeholder="Review after 1 week" style={fld()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Additional Notes</label>
                <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={4}
                  placeholder="Any additional notes..." style={{ ...fld(), resize: 'vertical' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 2 — Medicines
      ══════════════════════════════════════ */}
      {tab === 2 && (
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <SectionTitle icon="fa-pills" title={`Medicines (${meds.filter(m => m.medicineName.trim()).length} added)`} color="#16a34a" />
            <button onClick={addMed}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
              <i className="fa-solid fa-plus" />Add Medicine
            </button>
          </div>

          {meds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-pills fa-2x" style={{ opacity: 0.3, marginBottom: 12, display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 12 }}>No medicines added yet</div>
              <button onClick={addMed}
                style={{ padding: '10px 22px', borderRadius: 10, background: 'rgba(22,163,74,0.1)', border: '2px dashed rgba(22,163,74,0.4)', color: '#16a34a', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                + Add First Medicine
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {meds.map((med, idx) => (
                <div key={med._key} style={{
                  padding: '18px 20px', borderRadius: 14,
                  background: 'var(--hover-bg)',
                  border: '1.5px solid var(--border-color)',
                  position: 'relative',
                  borderLeft: med.medicineName ? '4px solid #16a34a' : '4px solid var(--border-color)',
                }}>
                  {/* Row header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(22,163,74,0.15)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {med.medicineName || 'New Medicine'}
                      </span>
                    </div>
                    <button onClick={() => removeMed(med._key)}
                      style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>

                  {/* Fields grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>

                    {/* Medicine name with typeahead */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Medicine Name <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          value={med.medicineName}
                          onChange={e => updateMed(med._key, 'medicineName', e.target.value)}
                          placeholder="Type medicine name..."
                          style={fld({ borderColor: med.medicineName ? 'var(--border-color)' : 'rgba(220,38,38,0.4)' })}
                          list={`med-list-${med._key}`}
                        />
                        <datalist id={`med-list-${med._key}`}>
                          {medicines.map(m => (
                            <option key={m._id} value={m.name}>{m.genericName ? `${m.name} (${m.genericName})` : m.name}</option>
                          ))}
                        </datalist>
                        {medicines.find(m => m.name.toLowerCase() === med.medicineName.toLowerCase()) && (
                          <button
                            onClick={() => {
                              const found = medicines.find(m => m.name.toLowerCase() === med.medicineName.toLowerCase());
                              if (found) selectMedFromList(med._key, found);
                            }}
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)', cursor: 'pointer' }}>
                            Link
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dosage */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Dosage <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input value={med.dosage} onChange={e => updateMed(med._key, 'dosage', e.target.value)}
                        placeholder="500mg"
                        style={fld({ borderColor: med.dosage ? 'var(--border-color)' : 'rgba(220,38,38,0.4)' })} />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Frequency</label>
                      <select value={med.frequency} onChange={e => updateMed(med._key, 'frequency', e.target.value)} style={fld()}>
                        {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Duration</label>
                      <input value={med.duration} onChange={e => updateMed(med._key, 'duration', e.target.value)}
                        placeholder="5 days" style={fld()} />
                    </div>

                    {/* Route */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Route</label>
                      <select value={med.route} onChange={e => updateMed(med._key, 'route', e.target.value)} style={fld()}>
                        {ROUTE_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Qty</label>
                      <input type="number" min={1} value={med.quantity}
                        onChange={e => updateMed(med._key, 'quantity', e.target.value)} style={fld()} />
                    </div>

                    {/* Instructions */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Instructions</label>
                      <input value={med.instructions} onChange={e => updateMed(med._key, 'instructions', e.target.value)}
                        placeholder="After meals, with water..." style={fld()} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 3 — Review & Save
      ══════════════════════════════════════ */}
      {tab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Doctor card */}
          {selectedDoctor && (
            <div style={{ padding: '18px 22px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(8,145,178,0.07),rgba(8,145,178,0.02))', border: '1.5px solid rgba(8,145,178,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                <i className="fa-solid fa-user-doctor me-1" />Prescribing Doctor
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(8,145,178,0.15)', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  <i className="fa-solid fa-user-doctor" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{formatDoctorName(selectedDoctor.name)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {selectedDoctor.specialization && <span>{selectedDoctor.specialization}</span>}
                    {selectedDoctor.qualification  && <span> &nbsp;·&nbsp; {selectedDoctor.qualification}</span>}
                    {selectedDoctor.phone          && <span> &nbsp;·&nbsp; <i className="fa-solid fa-phone me-1" />{selectedDoctor.phone}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient card */}
          {selectedPatient && (
            <div style={{ padding: '18px 22px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(124,58,237,0.02))', border: '1.5px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                <i className="fa-solid fa-user-injured me-1" />Patient
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(124,58,237,0.15)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  <i className="fa-solid fa-user-injured" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {selectedPatient.patientId  && <span>{selectedPatient.patientId}</span>}
                    {selectedPatient.age        && <span> · {selectedPatient.age} yrs</span>}
                    {selectedPatient.gender     && <span> · {selectedPatient.gender}</span>}
                    {selectedPatient.bloodGroup && <span> · {selectedPatient.bloodGroup}</span>}
                  </div>
                  {selectedPatient.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-phone me-1" />{selectedPatient.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>

            {/* Visit Info */}
            <div className="content-card">
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Visit Info</div>
              {[
                { label: 'Type',      val: form.visitType },
                { label: 'Date',      val: form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Diagnosis', val: form.diagnosis || '—' },
                { label: 'ICD Code',  val: form.icdCode   || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{r.val}</span>
                </div>
              ))}
            </div>

            {/* Vitals */}
            <div className="content-card">
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Vitals</div>
              {[
                { label: 'BP',    val: form.vitals.bp          || '—' },
                { label: 'Pulse', val: form.vitals.pulse        || '—' },
                { label: 'Temp',  val: form.vitals.temperature  || '—' },
                { label: 'Wt',    val: form.vitals.weight       || '—' },
                { label: 'SpO₂',  val: form.vitals.spo2         || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Medicines review */}
          <div className="content-card">
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
              <i className="fa-solid fa-pills me-2" />
              Medicines ({meds.filter(m => m.medicineName.trim() && m.dosage.trim()).length})
            </div>
            {meds.filter(m => m.medicineName.trim() && m.dosage.trim()).length === 0 ? (
              <div style={{ color: '#d97706', fontWeight: 600, fontSize: 13, padding: '10px 14px', background: 'rgba(217,119,6,0.08)', borderRadius: 10 }}>
                <i className="fa-solid fa-triangle-exclamation me-2" />
                No medicines with complete details. Go back and fill medicine name + dosage.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meds.filter(m => m.medicineName.trim() && m.dosage.trim()).map((m, i) => (
                  <div key={m._key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)' }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: '#16a34a', minWidth: 24, textAlign: 'center' }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{m.medicineName}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                        {m.dosage} · {m.frequency} · {m.duration} · {m.route}
                        {m.instructions && ` · ${m.instructions}`}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', flexShrink: 0 }}>Qty: {m.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advice & Notes */}
          {(form.advice || form.notes || form.labTests || form.followUpDate) && (
            <div className="content-card">
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Advice & Follow-up</div>
              {form.advice       && <div style={{ marginBottom: 8 }}><strong style={{ fontSize: 12 }}>Advice:</strong><span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{form.advice}</span></div>}
              {form.followUpDate && <div style={{ marginBottom: 8 }}><strong style={{ fontSize: 12 }}>Follow-up:</strong><span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{new Date(form.followUpDate + 'T00:00:00').toLocaleDateString('en-IN')}</span></div>}
              {form.labTests     && <div style={{ marginBottom: 8 }}><strong style={{ fontSize: 12 }}>Lab Tests:</strong><span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{form.labTests}</span></div>}
              {form.notes        && <div><strong style={{ fontSize: 12 }}>Notes:</strong><span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{form.notes}</span></div>}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          {tab > 0 && (
            <button onClick={prevTab}
              style={{ padding: '11px 24px', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-chevron-left" />Back
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {tab < 3 ? (
            <button onClick={nextTab}
              style={{ padding: '11px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}>
              Next <i className="fa-solid fa-chevron-right" />
            </button>
          ) : (
            // ✅ Save button — only active if canCreate, otherwise shows disabled tooltip
            <button
              onClick={handleSubmit}
              disabled={saving || !canCreate('prescriptions')}
              title={!canCreate('prescriptions') ? 'You do not have permission to save prescriptions' : ''}
              style={{
                padding: '11px 32px', borderRadius: 12,
                background: (saving || !canCreate('prescriptions'))
                  ? '#9ca3af'
                  : 'linear-gradient(135deg,#16a34a,#15803d)',
                color: 'white', border: 'none', fontWeight: 700, fontSize: 14,
                cursor: (saving || !canCreate('prescriptions')) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: (saving || !canCreate('prescriptions')) ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
              }}
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</>
                : <><i className="fa-solid fa-floppy-disk" />Save Prescription</>
              }
            </button>
          )}
        </div>
      </div>

      <style>{`
        .content-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; }
        @media (max-width: 600px) { .tab-label { display: none; } }
      `}</style>
    </>
  );
}

NewPrescription.getLayout = (page) => <Layout>{page}</Layout>;