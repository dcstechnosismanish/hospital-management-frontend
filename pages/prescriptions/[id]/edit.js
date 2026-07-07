import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';                               // ✅ Added
import { usePermission } from '../../../hooks/usePermission'; // ✅ Added

// ── Helpers ──────────────────────────────────────────────────
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

const FREQ_OPTS   = ['Once daily','Twice daily','Three times daily','Four times daily','Every 8 hours','Every 6 hours','As needed','At bedtime','With meals'];
const ROUTE_OPTS  = ['Oral','IV','IM','SC','Topical','Inhaled','Sublingual','Rectal'];
const VISIT_OPTS  = ['OPD','IPD','Teleconsult','Emergency'];
const STATUS_OPTS = ['active','completed','cancelled'];

const formatDoctorName = (name) => {
  if (!name) return '—';
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
};

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

const Label = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
    {children} {required && <span style={{ color: '#dc2626' }}>*</span>}
  </label>
);

// ════════════════════════════════════════════════════════════
// EDIT PAGE
// ════════════════════════════════════════════════════════════
export default function EditPrescription() {
  const router   = useRouter();
  const { id }   = router.query;
  const { user } = useAuth();

  // ✅ Permission hook
  const { canRead, canUpdate, loading: permLoading } = usePermission();

  const [tab,      setTab]      = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [notFound, setNotFound] = useState(false);

  const [patients, setPatients] = useState([]);
  const [doctors,  setDoctors]  = useState([]);
  const [medList,  setMedList]  = useState([]);

  const [rxNo, setRxNo] = useState('');

  const [form, setForm] = useState({
    patient:         '',
    doctor:          '',
    appointment:     '',
    visitType:       'OPD',
    status:          'active',
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

  // ── Load existing prescription + dropdown data ───────────
  // ✅ Wait for both router.query.id AND permissions before loading
  useEffect(() => {
    if (!id || permLoading) return;
    if (!canRead('prescriptions') || !canUpdate('prescriptions')) return;

    const load = async () => {
      setLoading(true);
      try {
        const [rxRes, pRes, dRes, mRes] = await Promise.all([
          api.get(`/prescriptions/${id}`),
          api.get('/patients?limit=200').catch(() => ({ data: { data: [] } })),
          api.get('/doctors?limit=200').catch(()  => ({ data: { data: [] } })),
          api.get('/medicines?limit=500').catch(() => ({ data: { data: [] } })),
        ]);

        if (!rxRes.data.success) { setNotFound(true); return; }

        const rx = rxRes.data.data;
        setRxNo(rx.prescriptionNo || '');
        setPatients(pRes.data.data || []);
        setDoctors(dRes.data.data  || []);
        setMedList(mRes.data.data  || []);

        setForm({
          patient:         rx.patient?._id         || rx.patient         || '',
          doctor:          rx.doctor?._id          || rx.doctor          || '',
          appointment:     rx.appointment?._id     || rx.appointment     || '',
          visitType:       rx.visitType            || 'OPD',
          status:          rx.status               || 'active',
          date:            rx.date ? new Date(rx.date).toISOString().slice(0, 10) : '',
          chiefComplaints: rx.chiefComplaints       || '',
          history:         rx.history              || '',
          examination:     rx.examination          || '',
          diagnosis:       rx.diagnosis            || '',
          icdCode:         rx.icdCode              || '',
          advice:          rx.advice               || '',
          followUpDate:    rx.followUpDate ? new Date(rx.followUpDate).toISOString().slice(0, 10) : '',
          followUpNotes:   rx.followUpNotes        || '',
          notes:           rx.notes                || '',
          labTests:        (rx.labTests || []).join(', '),
          vitals: {
            bp:          rx.vitals?.bp          || '',
            pulse:       rx.vitals?.pulse       || '',
            temperature: rx.vitals?.temperature || '',
            weight:      rx.vitals?.weight      || '',
            height:      rx.vitals?.height      || '',
            spo2:        rx.vitals?.spo2        || '',
          },
        });

        if (rx.medicines && rx.medicines.length > 0) {
          setMeds(rx.medicines.map(m => ({
            _key:         Math.random().toString(36).slice(2),
            medicine:     m.medicine?._id || m.medicine || '',
            medicineName: m.medicineName  || '',
            dosage:       m.dosage        || '',
            frequency:    m.frequency     || 'Once daily',
            duration:     m.duration      || '5 days',
            route:        m.route         || 'Oral',
            instructions: m.instructions  || '',
            quantity:     m.quantity      || 1,
          })));
        }
      } catch (e) {
        if (e.response?.status === 404) setNotFound(true);
        else setError(e.response?.data?.message || 'Failed to load prescription.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, permLoading]);

  // ── Form helpers ─────────────────────────────────────────
  const setF      = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setVital  = (k, v) => setForm(f => ({ ...f, vitals: { ...f.vitals, [k]: v } }));
  const addMed    = ()     => setMeds(m => [...m, EMPTY_MED()]);
  const removeMed = (key)  => setMeds(m => m.filter(r => r._key !== key));
  const updateMed = (key, field, value) =>
    setMeds(m => m.map(r => r._key === key ? { ...r, [field]: value } : r));

  // ── Validate current tab before Next ────────────────────
  const validateTab = (t) => {
    if (t === 0 && !form.patient) return 'Please select a patient.';
    if (t === 0 && !form.doctor)  return 'Please select a doctor.';
    if (t === 2) {
      const valid = meds.filter(m => m.medicineName.trim() && m.dosage.trim());
      if (valid.length === 0) return 'Add at least one medicine with name and dosage.';
    }
    return '';
  };

  const nextTab = () => {
    const err = validateTab(tab);
    if (err) { setError(err); return; }
    setError('');
    setTab(t => Math.min(3, t + 1));
  };
  const prevTab = () => { setError(''); setTab(t => Math.max(0, t - 1)); };

  // ── Submit (PUT) ─────────────────────────────────────────
  const handleSave = async () => {
    // ✅ Double-check update permission before submitting
    if (!canUpdate('prescriptions')) {
      setError('You do not have permission to update prescriptions.');
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
      status:          form.status,
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
    };
    if (form.appointment && form.appointment.trim())  payload.appointment  = form.appointment;
    if (form.followUpDate && form.followUpDate.trim()) payload.followUpDate = form.followUpDate;

    setSaving(true);
    try {
      const { data } = await api.put(`/prescriptions/${id}`, payload);
      if (data.success) {
        router.push(`/prescriptions/${id}`);
      } else {
        setError(data.message || 'Update failed.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Server error.');
    } finally {
      setSaving(false);
    }
  };

  const selPatient = patients.find(p => p._id === form.patient) || null;
  const selDoctor  = doctors.find(d => d._id === form.doctor)   || null;

  const TABS = [
    { label: 'Patient & Doctor', icon: 'fa-user-injured'    },
    { label: 'Clinical Details', icon: 'fa-stethoscope'     },
    { label: 'Medicines',        icon: 'fa-pills'           },
    { label: 'Review & Update',  icon: 'fa-clipboard-check' },
  ];

  // ✅ Permission loading spinner (shown before data load spinner)
  if (permLoading) {
    return (
      <>
        <SEOHead title="Edit Prescription" path={`/prescriptions/${id}/edit`} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, flexDirection: 'column', gap: 14, color: 'var(--text-muted)',
        }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#d97706' }} />
          <div style={{ fontWeight: 600 }}>Checking permissions…</div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen — needs both read + update permission
  if (!canRead('prescriptions') || !canUpdate('prescriptions')) {
    return (
      <>
        <SEOHead title="Edit Prescription" path={`/prescriptions/${id}/edit`} />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to edit prescriptions.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            {canRead('prescriptions') && id && (
              <Link href={`/prescriptions/${id}`}
                style={{ fontSize: 13, fontWeight: 700, color: '#0891b2', textDecoration: 'none' }}>
                ← View Prescription
              </Link>
            )}
            <Link href="/prescriptions"
              style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
              ← Back to Prescriptions
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ── Data loading state ───────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#7c3aed' }} />
      <div style={{ fontWeight: 600 }}>Loading prescription…</div>
    </div>
  );

  // ── Not found state ──────────────────────────────────────
  if (notFound) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-file-circle-xmark fa-3x"
        style={{ display: 'block', marginBottom: 16, opacity: 0.4, color: '#dc2626' }} />
      <h5 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Prescription Not Found</h5>
      <p>The prescription ID <code style={{ background: 'var(--hover-bg)', padding: '2px 8px', borderRadius: 6 }}>{id}</code> does not exist.</p>
      <button onClick={() => router.push('/prescriptions')}
        style={{ marginTop: 12, padding: '10px 22px', borderRadius: 10, background: '#7c3aed', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
        ← Back to Prescriptions
      </button>
    </div>
  );

  // ── Main render ──────────────────────────────────────────
  return (
    <>
      <SEOHead title={`Edit ${rxNo || 'Prescription'}`} path={`/prescriptions/${id}/edit`} />

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#d97706,#b45309)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>
              <i className="fa-solid fa-pen-to-square" />
            </span>
            Edit Prescription
          </h4>
          <p style={{ margin: '4px 0 0 48px', fontSize: 13, color: 'var(--text-muted)' }}>
            {rxNo && <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#7c3aed' }}>{rxNo}</span>}
            {rxNo && ' · '}Updating existing record
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push(`/prescriptions/${id}`)}
            style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="fa-solid fa-eye" /> View
          </button>
          <button onClick={() => router.push('/prescriptions')}
            style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="fa-solid fa-arrow-left" /> Back
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => {
          const done   = i < tab;
          const active = i === tab;
          return (
            <button key={i}
              onClick={() => { if (i !== tab) { setError(''); setTab(i); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 12,
                border:      active ? '2px solid #d97706' : done ? '2px solid #16a34a' : '2px solid var(--border-color)',
                background:  active ? 'rgba(217,119,6,0.1)' : done ? 'rgba(22,163,74,0.06)' : 'var(--hover-bg)',
                color:       active ? '#d97706' : done ? '#16a34a' : 'var(--text-muted)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {done
                ? <i className="fa-solid fa-circle-check" style={{ fontSize: 14 }} />
                : <i className={`fa-solid ${t.icon}`} style={{ fontSize: 13 }} />
              }
              <span className="tab-label-ed">{t.label}</span>
              <span style={{ width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? '#d97706' : done ? '#16a34a' : 'var(--border-color)', color: active || done ? 'white' : 'var(--text-muted)' }}>
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', marginBottom: 20, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-circle-exclamation" />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 0 — Patient & Doctor
      ══════════════════════════════════════ */}
      {tab === 0 && (
        <div className="content-card">
          <SectionTitle icon="fa-user-injured" title="Patient & Doctor" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>

            {/* Patient */}
            <div>
              <Label required>Patient</Label>
              <select value={form.patient} onChange={e => setF('patient', e.target.value)} style={fld()}>
                <option value="">— Select Patient —</option>
                {patients.map(p => (
                  <option key={p._id} value={p._id}>{p.name}{p.patientId ? ` (${p.patientId})` : ''}</option>
                ))}
              </select>
              {selPatient && (
                <div style={{ marginTop: 8, padding: '10px 13px', borderRadius: 10, background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0891b2' }}>{selPatient.name}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {selPatient.age && `${selPatient.age} yrs`}
                    {selPatient.gender     && ` · ${selPatient.gender}`}
                    {selPatient.bloodGroup && ` · ${selPatient.bloodGroup}`}
                    {selPatient.phone      && ` · ${selPatient.phone}`}
                  </div>
                </div>
              )}
            </div>

            {/* Doctor */}
            <div>
              <Label required>Doctor</Label>
              <select value={form.doctor} onChange={e => setF('doctor', e.target.value)} style={fld()}>
                <option value="">— Select Doctor —</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>{formatDoctorName(d.name)}{d.specialization ? ` · ${d.specialization}` : ''}</option>
                ))}
              </select>
              {selDoctor && (
                <div style={{ marginTop: 8, padding: '10px 13px', borderRadius: 10, background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0891b2' }}>{formatDoctorName(selDoctor.name)}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {selDoctor.specialization}{selDoctor.qualification && ` · ${selDoctor.qualification}`}
                  </div>
                </div>
              )}
            </div>

            {/* Visit Type */}
            <div>
              <Label>Visit Type</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VISIT_OPTS.map(v => (
                  <button key={v} onClick={() => setF('visitType', v)}
                    style={{ padding: '8px 16px', borderRadius: 9, border: `2px solid ${form.visitType === v ? '#d97706' : 'var(--border-color)'}`, background: form.visitType === v ? 'rgba(217,119,6,0.1)' : 'var(--hover-bg)', color: form.visitType === v ? '#d97706' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_OPTS.map(s => {
                  const col = s === 'active' ? '#0891b2' : s === 'completed' ? '#16a34a' : '#dc2626';
                  return (
                    <button key={s} onClick={() => setF('status', s)}
                      style={{ padding: '8px 16px', borderRadius: 9, border: `2px solid ${form.status === s ? col : 'var(--border-color)'}`, background: form.status === s ? `${col}15` : 'var(--hover-bg)', color: form.status === s ? col : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s', textTransform: 'capitalize' }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <Label>Date</Label>
              <input type="date" value={form.date} 
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setF('date', e.target.value)} style={fld()} />
            </div>

            {/* Appointment (optional) */}
            <div>
              <Label>Appointment ID <span style={{ fontWeight: 400, textTransform: 'none', color: '#6b7280', fontSize: 10 }}>(optional)</span></Label>
              <input value={form.appointment} onChange={e => setF('appointment', e.target.value)}
                placeholder="Leave blank if none" style={fld()} />
            </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16 }}>
              {[
                { k: 'bp',          label: 'Blood Pressure', placeholder: '120/80 mmHg' },
                { k: 'pulse',       label: 'Pulse',          placeholder: '72 bpm'      },
                { k: 'temperature', label: 'Temperature',    placeholder: '98.6 °F'     },
                { k: 'weight',      label: 'Weight',         placeholder: '70 kg'       },
                { k: 'height',      label: 'Height',         placeholder: '170 cm'      },
                { k: 'spo2',        label: 'SpO₂',           placeholder: '98%'         },
              ].map(v => (
                <div key={v.k}>
                  <Label>{v.label}</Label>
                  <input value={form.vitals[v.k]} onChange={e => setVital(v.k, e.target.value)}
                    placeholder={v.placeholder} style={fld()} />
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="content-card">
            <SectionTitle icon="fa-stethoscope" title="Clinical Notes" color="#0891b2" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
              {[
                { k: 'chiefComplaints', label: 'Chief Complaints', rows: 3, placeholder: 'Fever, headache...'        },
                { k: 'history',         label: 'History',          rows: 3, placeholder: 'Past medical history...'  },
                { k: 'examination',     label: 'Examination',      rows: 3, placeholder: 'Examination findings...'  },
                { k: 'diagnosis',       label: 'Diagnosis',        rows: 2, placeholder: 'Primary diagnosis...'     },
              ].map(f => (
                <div key={f.k}>
                  <Label>{f.label}</Label>
                  <textarea value={form[f.k]} onChange={e => setF(f.k, e.target.value)} rows={f.rows}
                    placeholder={f.placeholder} style={{ ...fld(), resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              ))}
              <div>
                <Label>ICD Code</Label>
                <input value={form.icdCode} onChange={e => setF('icdCode', e.target.value)}
                  placeholder="J06.9" style={fld()} />
              </div>
              <div>
                <Label>Lab Tests <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, color: '#6b7280' }}>(comma separated)</span></Label>
                <input value={form.labTests} onChange={e => setF('labTests', e.target.value)}
                  placeholder="CBC, LFT, Urine R/E" style={fld()} />
              </div>
            </div>
          </div>

          {/* Advice & Follow-up */}
          <div className="content-card">
            <SectionTitle icon="fa-calendar-plus" title="Advice & Follow-up" color="#16a34a" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <div>
                <Label>Advice</Label>
                <textarea value={form.advice} onChange={e => setF('advice', e.target.value)} rows={3}
                  placeholder="Rest, avoid spicy food..." style={{ ...fld(), resize: 'vertical' }} />
              </div>
              <div>
                <Label>Follow-up Date</Label>
                <input type="date" value={form.followUpDate} 
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setF('followUpDate', e.target.value)} style={fld()} />
                <Label>Follow-up Notes</Label>
                <input value={form.followUpNotes} onChange={e => setF('followUpNotes', e.target.value)}
                  placeholder="Review after 1 week" style={{ ...fld(), marginTop: 6 }} />
              </div>
              <div>
                <Label>Additional Notes</Label>
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
            <SectionTitle icon="fa-pills" title={`Medicines (${meds.filter(m => m.medicineName.trim()).length})`} color="#16a34a" />
            <button onClick={addMed}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
              <i className="fa-solid fa-plus" />Add Medicine
            </button>
          </div>

          {meds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-pills fa-2x" style={{ opacity: 0.3, marginBottom: 12, display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 12 }}>No medicines added</div>
              <button onClick={addMed}
                style={{ padding: '10px 22px', borderRadius: 10, background: 'rgba(22,163,74,0.1)', border: '2px dashed rgba(22,163,74,0.4)', color: '#16a34a', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                + Add First Medicine
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {meds.map((med, idx) => (
                <div key={med._key} style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--hover-bg)', border: '1.5px solid var(--border-color)', borderLeft: med.medicineName ? '4px solid #16a34a' : '4px solid var(--border-color)' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                    {/* Medicine name */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <Label required>Medicine Name</Label>
                      <input value={med.medicineName}
                        onChange={e => updateMed(med._key, 'medicineName', e.target.value)}
                        placeholder="Type medicine name..."
                        list={`medlist-${med._key}`}
                        style={fld({ borderColor: med.medicineName ? 'var(--border-color)' : 'rgba(220,38,38,0.4)' })} />
                      <datalist id={`medlist-${med._key}`}>
                        {medList.map(m => <option key={m._id} value={m.name} />)}
                      </datalist>
                    </div>
                    {/* Dosage */}
                    <div>
                      <Label required>Dosage</Label>
                      <input value={med.dosage} onChange={e => updateMed(med._key, 'dosage', e.target.value)}
                        placeholder="500mg"
                        style={fld({ borderColor: med.dosage ? 'var(--border-color)' : 'rgba(220,38,38,0.4)' })} />
                    </div>
                    {/* Frequency */}
                    <div>
                      <Label>Frequency</Label>
                      <select value={med.frequency} onChange={e => updateMed(med._key, 'frequency', e.target.value)} style={fld()}>
                        {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    {/* Duration */}
                    <div>
                      <Label>Duration</Label>
                      <input value={med.duration} onChange={e => updateMed(med._key, 'duration', e.target.value)}
                        placeholder="5 days" style={fld()} />
                    </div>
                    {/* Route */}
                    <div>
                      <Label>Route</Label>
                      <select value={med.route} onChange={e => updateMed(med._key, 'route', e.target.value)} style={fld()}>
                        {ROUTE_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {/* Qty */}
                    <div>
                      <Label>Qty</Label>
                      <input type="number" min={1} value={med.quantity}
                        onChange={e => updateMed(med._key, 'quantity', e.target.value)} style={fld()} />
                    </div>
                    {/* Instructions */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <Label>Instructions</Label>
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
          TAB 3 — Review & Update
      ══════════════════════════════════════ */}
      {tab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Doctor */}
          {selDoctor && (
            <div style={{ padding: '18px 22px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(8,145,178,0.07),rgba(8,145,178,0.01))', border: '1.5px solid rgba(8,145,178,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Prescribing Doctor</div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(8,145,178,0.15)', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  <i className="fa-solid fa-user-doctor" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{formatDoctorName(selDoctor.name)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selDoctor.specialization}{selDoctor.qualification && ` · ${selDoctor.qualification}`}{selDoctor.phone && ` · ${selDoctor.phone}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient */}
          {selPatient && (
            <div style={{ padding: '18px 22px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(124,58,237,0.01))', border: '1.5px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Patient</div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(124,58,237,0.15)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  <i className="fa-solid fa-user-injured" />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{selPatient.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selPatient.patientId}{selPatient.age && ` · ${selPatient.age} yrs`}{selPatient.gender && ` · ${selPatient.gender}`}{selPatient.bloodGroup && ` · ${selPatient.bloodGroup}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            <div className="content-card">
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Visit Info</div>
              {[
                { label: 'Type',      val: form.visitType },
                { label: 'Status',    val: form.status    },
                { label: 'Date',      val: form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Diagnosis', val: form.diagnosis || '—' },
                { label: 'ICD',       val: form.icdCode   || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right', maxWidth: '60%', textTransform: 'capitalize' }}>{r.val}</span>
                </div>
              ))}
            </div>
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
                No complete medicines. Go back to Tab 3 and fill in name + dosage.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meds.filter(m => m.medicineName.trim() && m.dosage.trim()).map((m, i) => (
                  <div key={m._key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)' }}>
                    <span style={{ fontWeight: 900, fontSize: 12, color: '#16a34a', minWidth: 22, textAlign: 'center' }}>{i + 1}</span>
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

          {/* Advice block */}
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
              <i className="fa-solid fa-chevron-left" /> Back
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {tab < 3 ? (
            <button onClick={nextTab}
              style={{ padding: '11px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#d97706,#b45309)', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(217,119,6,0.35)' }}>
              Next <i className="fa-solid fa-chevron-right" />
            </button>
          ) : (
            // ✅ Update button — disabled & greyed if no update permission
            <button
              onClick={handleSave}
              disabled={saving || !canUpdate('prescriptions')}
              title={!canUpdate('prescriptions') ? 'You do not have permission to update prescriptions' : ''}
              style={{
                padding: '11px 32px', borderRadius: 12,
                background: (saving || !canUpdate('prescriptions'))
                  ? '#9ca3af'
                  : 'linear-gradient(135deg,#d97706,#b45309)',
                color: 'white', border: 'none', fontWeight: 700, fontSize: 14,
                cursor: (saving || !canUpdate('prescriptions')) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: (saving || !canUpdate('prescriptions')) ? 'none' : '0 4px 16px rgba(217,119,6,0.35)',
              }}
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin" /> Updating…</>
                : <><i className="fa-solid fa-floppy-disk" /> Update Prescription</>
              }
            </button>
          )}
        </div>
      </div>

      <style>{`
        .content-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; }
        @media (max-width: 600px) { .tab-label-ed { display: none; } }
      `}</style>
    </>
  );
}

EditPrescription.getLayout = (page) => <Layout>{page}</Layout>;