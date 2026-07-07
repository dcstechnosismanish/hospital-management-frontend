import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import { useState, useEffect, useRef } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { usePermission } from '../../../hooks/usePermission'; // ✅ Added
import { formatDate } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  active:    { c: '#0891b2', bg: 'rgba(8,145,178,0.06)'  },
  completed: { c: '#16a34a', bg: 'rgba(22,163,74,0.06)'  },
  cancelled: { c: '#dc2626', bg: 'rgba(220,38,38,0.06)'  },
};

const formatDoctorName = (name) => {
  if (!name) return '—';
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
};

export default function ViewPrescription() {
  const router   = useRouter();
  const { id }   = router.query;
  const { user } = useAuth();
  const printRef = useRef(null);

  // ✅ Permission hook
  const { canRead, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [rx,       setRx]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [marking,  setMarking]  = useState(false);

  // ✅ Role-based flags (kept from original) combined with permission check
  const roleCanEdit    = ['admin', 'doctor'].includes(user?.role);
  const showEdit       = roleCanEdit  && !permLoading && canUpdate('prescriptions');
  const showMarkComplete = roleCanEdit && !permLoading && canUpdate('prescriptions');
  const showRefill     = roleCanEdit  && !permLoading && canCreate('prescriptions');
  // Print is always visible to anyone who can read
  const showPrint      = !permLoading && canRead('prescriptions');

  // ✅ Wait for permissions before loading data
  useEffect(() => {
    if (!id || permLoading) return;
    if (!canRead('prescriptions')) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/prescriptions/${id}`);
        if (data.success) setRx(data.data);
        else setNotFound(true);
      } catch (e) {
        if (e.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, permLoading]);

  // ── Mark Complete ────────────────────────────────────────
  const handleMarkComplete = async () => {
    // ✅ Double-check update permission
    if (!canUpdate('prescriptions')) return toast.error('You do not have permission to update prescriptions.');
    setMarking(true);
    try {
      const { data } = await api.put(`/prescriptions/${id}`, { status: 'completed' });
      if (data.success) setRx(data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setMarking(false);
    }
  };

  // ── Print ────────────────────────────────────────────────
  const handlePrint = () => {
    if (!rx) return;

    const doc    = rx.doctor   || {};
    const pat    = rx.patient  || {};
    const vitals = rx.vitals   || {};
    const meds   = rx.medicines || [];
    const date   = rx.date
      ? new Date(rx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';

    const medsRows = meds.map((m, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-weight:700;color:#7c3aed;text-align:center;">${i + 1}</td>
        <td style="padding:10px 12px;font-weight:700;color:#111827;">${m.medicineName || '—'}</td>
        <td style="padding:10px 12px;color:#374151;">${m.dosage || '—'}</td>
        <td style="padding:10px 12px;color:#0891b2;font-weight:600;">${m.frequency || '—'}</td>
        <td style="padding:10px 12px;color:#374151;">${m.duration || '—'}</td>
        <td style="padding:10px 12px;color:#374151;">${m.route || 'Oral'}</td>
        <td style="padding:10px 12px;color:#6b7280;font-style:italic;">${m.instructions || '—'}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:700;">${m.quantity || 1}</td>
      </tr>`).join('');

    const vitalsList = [
      ['BP', vitals.bp], ['Pulse', vitals.pulse],
      ['Temp', vitals.temperature], ['Weight', vitals.weight],
      ['Height', vitals.height], ['SpO₂', vitals.spo2],
    ].filter(([, v]) => v).map(([k, v]) => `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;margin:4px;">
        <span style="font-size:11px;color:#6b7280;font-weight:600;">${k}</span>
        <span style="font-size:14px;font-weight:800;color:#111827;">${v}</span>
      </div>`).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Prescription — ${rx.prescriptionNo || id}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#111827; font-size:13px; }
    @page { size: A4; margin: 12mm 14mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .page { max-width: 800px; margin: 0 auto; padding: 24px; }
    .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; border-bottom:3px solid #7c3aed; margin-bottom:18px; }
    .hosp-logo { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#7c3aed,#6d28d9); display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:900; flex-shrink:0; }
    .hosp-name { font-size:22px; font-weight:900; color:#111827; }
    .hosp-sub  { font-size:12px; color:#6b7280; margin-top:2px; }
    .hosp-info { font-size:11px; color:#9ca3af; margin-top:6px; }
    .rx-meta   { text-align:right; }
    .rx-no     { font-size:18px; font-weight:900; color:#7c3aed; font-family:monospace; }
    .rx-date   { font-size:12px; color:#6b7280; margin-top:4px; }
    .rx-visit  { font-size:11px; color:#9ca3af; margin-top:2px; }
    .badge { display:inline-block; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:capitalize; margin-top:6px; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
    .info-card { padding:14px 16px; border-radius:12px; border:1px solid #e5e7eb; }
    .info-card.doctor { background:#f0f9ff; border-color:#bae6fd; }
    .info-card.patient{ background:#faf5ff; border-color:#ddd6fe; }
    .info-label { font-size:10px; font-weight:800; letter-spacing:0.6px; text-transform:uppercase; margin-bottom:8px; }
    .info-label.doc { color:#0891b2; }
    .info-label.pat { color:#7c3aed; }
    .info-name  { font-size:16px; font-weight:900; color:#111827; }
    .info-sub   { font-size:12px; color:#6b7280; margin-top:3px; }
    .info-detail{ font-size:11px; color:#9ca3af; margin-top:2px; }
    .diag-box { border-left:4px solid #dc2626; padding:10px 16px; border-radius:0 10px 10px 0; background:#fff5f5; margin-bottom:16px; }
    .diag-label{ font-size:10px; font-weight:800; color:#dc2626; letter-spacing:0.6px; text-transform:uppercase; }
    .diag-val  { font-size:16px; font-weight:900; color:#111827; margin-top:2px; }
    .vitals-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; padding:10px 14px; background:#f9fafb; border-radius:10px; border:1px solid #e5e7eb; }
    .sec-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e5e7eb; }
    .sec-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; color:white; flex-shrink:0; }
    .sec-title{ font-size:14px; font-weight:800; color:#111827; }
    .med-table { width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .med-table thead tr { background:#f5f3ff; }
    .med-table thead th { padding:10px 12px; text-align:left; font-size:10px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px; }
    .notes-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
    .note-box   { padding:12px 14px; border-radius:10px; background:#f9fafb; border:1px solid #e5e7eb; }
    .note-title { font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
    .note-val   { font-size:13px; color:#374151; line-height:1.6; }
    .footer { margin-top:24px; padding-top:16px; border-top:2px solid #e5e7eb; display:flex; justify-content:space-between; align-items:flex-end; }
    .sig-block { text-align:center; }
    .sig-line  { width:160px; border-top:1.5px solid #374151; margin:0 auto 4px; }
    .sig-label { font-size:11px; color:#6b7280; }
    .footer-watermark { font-size:10px; color:#d1d5db; }
  </style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px;">
      <div class="hosp-logo">M</div>
      <div>
        <div class="hosp-name">MediCare Hospital</div>
        <div class="hosp-sub">Multispeciality Hospital &amp; Research Centre</div>
        <div class="hosp-info">📍 Jaipur, Rajasthan — 302001 &nbsp;|&nbsp; 📞 +91-141-XXXXXXX &nbsp;|&nbsp; 🌐 medicare-hospital.in</div>
      </div>
    </div>
    <div class="rx-meta">
      <div class="rx-no">${rx.prescriptionNo || id}</div>
      <div class="rx-date">${date}</div>
      <div class="rx-visit">Visit: ${rx.visitType || 'OPD'}</div>
      <span class="badge" style="background:${rx.status === 'active' ? 'rgba(8,145,178,0.12)' : rx.status === 'completed' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'};color:${rx.status === 'active' ? '#0891b2' : rx.status === 'completed' ? '#16a34a' : '#dc2626'};">${rx.status || 'active'}</span>
    </div>
  </div>
  <!-- DOCTOR + PATIENT -->
  <div class="two-col">
    <div class="info-card doctor">
      <div class="info-label doc">🩺 Prescribing Doctor</div>
      <div class="info-name">Dr. ${doc.name || '—'}</div>
      <div class="info-sub">${doc.specialization || ''}${doc.qualification ? ' · ' + doc.qualification : ''}</div>
      ${doc.phone ? `<div class="info-detail">📞 ${doc.phone}</div>` : ''}
    </div>
    <div class="info-card patient">
      <div class="info-label pat">🤕 Patient</div>
      <div class="info-name">${pat.name || '—'}</div>
      <div class="info-sub">${pat.patientId || ''}${pat.age ? ' · ' + pat.age + ' yrs' : ''}${pat.gender ? ' · ' + pat.gender : ''}</div>
      ${pat.phone     ? `<div class="info-detail">📞 ${pat.phone}</div>` : ''}
      ${pat.bloodGroup ? `<div class="info-detail">🩸 ${pat.bloodGroup}</div>` : ''}
      ${pat.address   ? `<div class="info-detail">📍 ${pat.address}</div>` : ''}
    </div>
  </div>
  <!-- DIAGNOSIS -->
  ${rx.diagnosis ? `
  <div class="diag-box">
    <div class="diag-label">DIAGNOSIS</div>
    <div class="diag-val">${rx.diagnosis}${rx.icdCode ? ' <span style="font-size:12px;color:#9ca3af;font-weight:500;">(' + rx.icdCode + ')</span>' : ''}</div>
  </div>` : ''}
  <!-- VITALS -->
  ${vitalsList ? `<div class="vitals-row">${vitalsList}</div>` : ''}
  <!-- CHIEF COMPLAINTS / HISTORY -->
  ${(rx.chiefComplaints || rx.history) ? `
  <div class="notes-grid" style="margin-bottom:16px;">
    ${rx.chiefComplaints ? `<div class="note-box"><div class="note-title">Chief Complaints</div><div class="note-val">${rx.chiefComplaints}</div></div>` : ''}
    ${rx.history ? `<div class="note-box"><div class="note-title">History</div><div class="note-val">${rx.history}</div></div>` : ''}
  </div>` : ''}
  <!-- MEDICINES -->
  <div class="sec-head">
    <div class="sec-icon" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);">℞</div>
    <div class="sec-title">Medications</div>
  </div>
  <table class="med-table">
    <thead>
      <tr>
        <th style="width:36px;">#</th><th>MEDICINE</th><th>DOSAGE</th><th>FREQUENCY</th>
        <th>DURATION</th><th>ROUTE</th><th>INSTRUCTIONS</th><th style="text-align:center;">QTY</th>
      </tr>
    </thead>
    <tbody>
      ${medsRows || '<tr><td colspan="8" style="text-align:center;padding:18px;color:#9ca3af;">No medicines prescribed</td></tr>'}
    </tbody>
  </table>
  <!-- LAB TESTS -->
  ${rx.labTests?.length ? `
  <div style="margin-bottom:16px;">
    <div class="sec-head">
      <div class="sec-icon" style="background:linear-gradient(135deg,#0891b2,#0e7490);">🧪</div>
      <div class="sec-title">Lab Investigations</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 0;">
      ${rx.labTests.map(t => `<span style="padding:5px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:20px;font-size:12px;font-weight:700;color:#0891b2;">${t}</span>`).join('')}
    </div>
  </div>` : ''}
  <!-- ADVICE + NOTES -->
  ${(rx.advice || rx.notes || rx.followUpDate || rx.followUpNotes) ? `
  <div class="notes-grid">
    ${rx.advice ? `<div class="note-box"><div class="note-title">💊 Advice</div><div class="note-val">${rx.advice}</div></div>` : ''}
    ${rx.notes  ? `<div class="note-box"><div class="note-title">📝 Notes</div><div class="note-val">${rx.notes}</div></div>` : ''}
    ${rx.followUpDate ? `<div class="note-box"><div class="note-title">📅 Follow-up Date</div><div class="note-val" style="font-weight:700;color:#7c3aed;">${new Date(rx.followUpDate).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>${rx.followUpNotes ? '<div class="note-val" style="margin-top:4px;font-size:12px;">' + rx.followUpNotes + '</div>' : ''}</div>` : ''}
  </div>` : ''}
  <!-- FOOTER -->
  <div class="footer">
    <div>
      <div style="font-size:11px;color:#9ca3af;">Printed on: ${new Date().toLocaleString('en-IN')}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Rx No: ${rx.prescriptionNo || id}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label" style="font-weight:700;color:#374151;">Dr. ${doc.name || '—'}</div>
      <div class="sig-label">${doc.specialization || ''}</div>
      <div class="sig-label">${doc.qualification || ''}</div>
    </div>
  </div>
</div>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.onafterprint = () => printWin.close();
    }, 400);
  };

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Prescription" path={`/prescriptions/${id}`} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, flexDirection: 'column', gap: 14,
        }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#7c3aed' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Checking permissions…</div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!permLoading && !canRead('prescriptions')) {
    return (
      <>
        <SEOHead title="Prescription" path={`/prescriptions/${id}`} />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view prescriptions.</p>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, flexDirection: 'column', gap: 14 }}>
      <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#7c3aed' }} />
      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Loading prescription…</div>
    </div>
  );

  // ── Not found ────────────────────────────────────────────
  if (notFound) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <i className="fa-solid fa-file-circle-xmark fa-3x"
        style={{ display: 'block', marginBottom: 16, opacity: 0.4, color: '#dc2626' }} />
      <h5 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Prescription Not Found</h5>
      <button onClick={() => router.push('/prescriptions')}
        style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#7c3aed', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
        ← Back to Prescriptions
      </button>
    </div>
  );

  const doc    = rx.doctor  || {};
  const pat    = rx.patient || {};
  const vitals = rx.vitals  || {};
  const sc     = STATUS_COLOR[rx.status] || STATUS_COLOR.active;

  return (
    <>
      <SEOHead title={rx.prescriptionNo || 'Prescription'} path={`/prescriptions/${id}`} />

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/prescriptions')}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.c, textTransform: 'capitalize' }}>
            {rx.status}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            {rx.date ? new Date(rx.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
            {rx.visitType && ` · ${rx.visitType}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* ✅ Refill — only if showRefill */}
          {showRefill && (
            <Link href={`/prescriptions/new?refillOf=${id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              <i className="fa-solid fa-rotate" />Refill
            </Link>
          )}

          {/* ✅ Mark Complete — only if showMarkComplete and status is active */}
          {showMarkComplete && rx.status === 'active' && (
            <button onClick={handleMarkComplete} disabled={marking}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1.5px solid #16a34a', background: 'rgba(22,163,74,0.07)', color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: marking ? 'not-allowed' : 'pointer' }}>
              {marking ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
              Mark Complete
            </button>
          )}

          {/* ✅ Edit — only if showEdit */}
          {showEdit && (
            <button onClick={() => router.push(`/prescriptions/${id}/edit`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1.5px solid #d97706', background: 'rgba(217,119,6,0.07)', color: '#d97706', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <i className="fa-solid fa-pen-to-square" />Edit
            </button>
          )}

          {/* ✅ Print — only if showPrint (canRead) */}
          {showPrint && (
            <button onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
              <i className="fa-solid fa-print" />Print / PDF
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PRESCRIPTION PREVIEW CARD
      ══════════════════════════════════════════════════════ */}
      <div ref={printRef} className="rx-preview content-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Hospital Header ── */}
        <div style={{ padding: '22px 28px', borderBottom: '3px solid #7c3aed', background: 'linear-gradient(135deg,rgba(124,58,237,0.04),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26, fontWeight: 900, flexShrink: 0 }}>M</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-primary)' }}>MediCare Hospital</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Multispeciality Hospital &amp; Research Centre</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>📍 Jaipur, Rajasthan — 302001</span>
                <span>📞 +91-141-XXXXXXX</span>
                <span>🌐 medicare-hospital.in</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#7c3aed', fontFamily: 'monospace' }}>{rx.prescriptionNo}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {formatDate(rx.date, false, true)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Visit: {rx.visitType || 'OPD'}</div>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>

          {/* ── Doctor + Patient ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 22 }}>
            {/* Doctor */}
            <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(8,145,178,0.05)', border: '1.5px solid rgba(8,145,178,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                <i className="fa-solid fa-user-doctor me-1" />Prescribing Doctor
              </div>
              <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--text-primary)' }}>{formatDoctorName(doc.name)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {doc.specialization}{doc.qualification && ` · ${doc.qualification}`}
              </div>
              {doc.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}><i className="fa-solid fa-phone me-1" />{doc.phone}</div>}
            </div>

            {/* Patient */}
            <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(124,58,237,0.05)', border: '1.5px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                <i className="fa-solid fa-user-injured me-1" />Patient
              </div>
              <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--text-primary)' }}>{pat.name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {pat.patientId}{pat.age && ` · ${pat.age} yrs`}{pat.gender && ` · ${pat.gender}`}{pat.bloodGroup && ` · 🩸 ${pat.bloodGroup}`}
              </div>
              {pat.phone   && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}><i className="fa-solid fa-phone me-1" />{pat.phone}</div>}
              {pat.address && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}><i className="fa-solid fa-location-dot me-1" />{pat.address}</div>}
            </div>
          </div>

          {/* ── Diagnosis ── */}
          {rx.diagnosis && (
            <div style={{ borderLeft: '4px solid #dc2626', padding: '10px 18px', borderRadius: '0 12px 12px 0', background: 'rgba(220,38,38,0.04)', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.6 }}>Diagnosis</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
                {rx.diagnosis}
                {rx.icdCode && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 10 }}>({rx.icdCode})</span>}
              </div>
            </div>
          )}

          {/* ── Vitals ── */}
          {Object.values(vitals).some(v => v) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, padding: '12px 16px', background: 'var(--hover-bg)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {[
                ['BP', vitals.bp], ['Pulse', vitals.pulse],
                ['Temp', vitals.temperature], ['Weight', vitals.weight],
                ['Height', vitals.height], ['SpO₂', vitals.spo2],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 9 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Chief Complaints / History / Examination ── */}
          {(rx.chiefComplaints || rx.history || rx.examination) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginBottom: 20 }}>
              {rx.chiefComplaints && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Chief Complaints</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rx.chiefComplaints}</div>
                </div>
              )}
              {rx.history && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>History</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rx.history}</div>
                </div>
              )}
              {rx.examination && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Examination</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rx.examination}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Medicines ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>℞</div>
              <h6 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Medications</h6>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(124,58,237,0.06)', borderBottom: '2px solid var(--border-color)' }}>
                    {['#','MEDICINE','DOSAGE','FREQUENCY','DURATION','ROUTE','INSTRUCTIONS','QTY'].map(h => (
                      <th key={h} style={{ padding: '11px 13px', textAlign: h === 'QTY' ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rx.medicines?.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>No medicines prescribed</td></tr>
                  ) : rx.medicines?.map((m, i) => (
                    <tr key={i}
                      style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 13px', fontWeight: 800, color: '#7c3aed', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '11px 13px', fontWeight: 700, color: 'var(--text-primary)', minWidth: 130 }}>{m.medicineName || '—'}</td>
                      <td style={{ padding: '11px 13px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.dosage || '—'}</td>
                      <td style={{ padding: '11px 13px', color: '#0891b2', fontWeight: 600 }}>{m.frequency || '—'}</td>
                      <td style={{ padding: '11px 13px', color: 'var(--text-primary)' }}>{m.duration || '—'}</td>
                      <td style={{ padding: '11px 13px', color: 'var(--text-primary)' }}>{m.route || 'Oral'}</td>
                      <td style={{ padding: '11px 13px', color: 'var(--text-muted)', fontStyle: 'italic', minWidth: 140 }}>{m.instructions || '—'}</td>
                      <td style={{ padding: '11px 13px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>{m.quantity || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Lab Tests ── */}
          {rx.labTests?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                <i className="fa-solid fa-flask me-2" />Lab Investigations
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rx.labTests.map((t, i) => (
                  <span key={i} style={{ padding: '5px 14px', background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#0891b2' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Advice / Notes / Follow-up ── */}
          {(rx.advice || rx.notes || rx.followUpDate || rx.followUpNotes) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
              {rx.advice && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>💊 Advice</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rx.advice}</div>
                </div>
              )}
              {rx.followUpDate && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>📅 Follow-up</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>
                    {new Date(rx.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  {rx.followUpNotes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{rx.followUpNotes}</div>}
                </div>
              )}
              {rx.notes && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>📝 Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{rx.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20, borderTop: '2px solid var(--border-color)', marginTop: 8, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {rx.createdBy && <div>Created by: {rx.createdBy.name}</div>}
              {rx.dispensed  && <div style={{ color: '#16a34a', fontWeight: 700, marginTop: 3 }}>✓ Dispensed{rx.dispensedAt ? ` on ${new Date(rx.dispensedAt).toLocaleDateString('en-IN')}` : ''}</div>}
              <div style={{ marginTop: 3 }}>Generated: {new Date().toLocaleString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 160, borderTop: '1.5px solid var(--text-primary)', margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{formatDoctorName(doc.name)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.specialization || ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.qualification || ''}</div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .content-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; }
      `}</style>
    </>
  );
}

ViewPrescription.getLayout = (page) => <Layout>{page}</Layout>;