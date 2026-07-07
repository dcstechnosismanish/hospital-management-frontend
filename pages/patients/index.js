import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import SEOHead from '../../components/ui/SEOHead'; // ✅ Added for consistency
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { usePermission } from '../../hooks/usePermission';
import { useRouter } from 'next/router';
import Link from 'next/link'; // ✅ Added for consistency
import BackButton from '../../components/ui/BackButton';
import Pagination from '../../components/ui/Pagination';
import { confirmAction } from '../../utils/sweetAlert';

const emptyForm = {
  name: '', age: '', gender: 'Male', phone: '', email: '', address: '',
  bloodGroup: 'O+', type: 'OPD', allergies: '', chronicConditions: '',
  emergencyContact: { name: '', phone: '', relation: '' }
};

export default function Patients() {
  const router = useRouter();
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [patients,   setPatients]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [deleting,   setDeleting]   = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);

  const filteredPatients = patients; // Handled on backend

  // ✅ Permission guard — redirect if no read access
  useEffect(() => {
    if (!permLoading && !canRead('patients')) {
      toast.error('You do not have access to Patients.');
      router.replace('/');
    }
  }, [permLoading]);

  // ✅ Fetch patients — only after permissions confirmed
  const fetchPatients = () => {
    setLoading(true);
    const url = `/patients?page=${page}&limit=${limit}&search=${encodeURIComponent(localSearch)}`;
    api.get(url)
      .then(r => {
        setPatients(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => toast.error('Failed to load patients'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!permLoading && canRead('patients')) {
      fetchPatients();
    }
  }, [permLoading, page, limit]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('patients')) {
        setPage(1);
        fetchPatients();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // ── Open Add modal ─────────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // ── Open Edit modal ────────────────────────────────────────
  const openEdit = (patient) => {
    setEditId(patient._id);
    setForm({
      name:              patient.name              || '',
      age:               patient.age               || '',
      gender:            patient.gender            || 'Male',
      phone:             patient.phone             || '',
      email:             patient.email             || '',
      address:           patient.address           || '',
      bloodGroup:        patient.bloodGroup        || 'O+',
      type:              patient.type              || 'OPD',
      allergies:         (patient.allergies        || []).join(', '),
      chronicConditions: (patient.chronicConditions|| []).join(', '),
      emergencyContact:  patient.emergencyContact  || { name: '', phone: '', relation: '' },
    });
    setShowModal(true);
  };

  // ── Submit Add / Edit ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.age)
      return toast.error('Name, age and phone are required');

    // Validation
    if (!/^[a-zA-Z\s\.]+$/.test(form.name)) return toast.error('Name can only contain letters and spaces');
    if (!/^[0-9]{10}$/.test(form.phone)) return toast.error('Phone number must be exactly 10 digits');
    if (form.email && !/^(?=[^@]*[a-zA-Z])[a-zA-Z0-9._%+-]+@(?=[^@]*[a-zA-Z][^@]*\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(form.email)) 
      return toast.error('Invalid email format (must contain letters in both parts)');
    
    const ageNum = parseInt(form.age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) return toast.error('Age must be between 1 and 120');

    if (form.address && (form.address.length < 5 || !/[a-zA-Z]/.test(form.address)))
      return toast.error('Address must be at least 5 characters and contain letters');

    if (form.allergies && (!/[a-zA-Z]/.test(form.allergies) || !/^[a-zA-Z\s,]+$/.test(form.allergies)))
      return toast.error('Allergies must contain only letters, spaces, and commas');
    
    if (form.chronicConditions && (!/[a-zA-Z]/.test(form.chronicConditions) || !/^[a-zA-Z\s,]+$/.test(form.chronicConditions)))
      return toast.error('Chronic conditions must contain only letters, spaces, and commas');

    if (form.emergencyContact?.name && !/^[a-zA-Z\s]+$/.test(form.emergencyContact.name))
      return toast.error('Emergency contact name must contain only letters and spaces');
      
    if (form.emergencyContact?.relation && !/^[a-zA-Z\s]+$/.test(form.emergencyContact.relation))
      return toast.error('Emergency contact relation must contain only letters and spaces');

    if (form.emergencyContact?.phone && !/^[0-9]{10}$/.test(form.emergencyContact.phone)) 
      return toast.error('Emergency contact phone must be 10 digits');

    // ✅ Double-check permission before submitting
    if (editId && !canUpdate('patients')) return toast.error('You do not have permission to edit patients');
    if (!editId && !canCreate('patients')) return toast.error('You do not have permission to add patients');

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        allergies:         form.allergies.split(',').map(s => s.trim()).filter(Boolean),
        chronicConditions: form.chronicConditions.split(',').map(s => s.trim()).filter(Boolean),
      };

      if (editId) {
        await api.put(`/patients/${editId}`, payload);
        toast.success('Patient updated successfully!');
      } else {
        await api.post('/patients', payload);
        toast.success('Patient registered successfully!');
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditId(null);
      fetchPatients();
    } catch (err) {
      toast.error(err.friendlyMessage || 'Operation failed');
    } finally { setSubmitting(false); }
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id, name) => {
    // ✅ Double-check permission before deleting
    if (!canDelete('patients')) return toast.error('You do not have permission to delete patients');
    if (!await confirmAction('Delete Patient?', `Delete patient "${name}"? This cannot be undone.`, 'Yes, delete')) return;
    setDeleting(id);
    try {
      await api.delete(`/patients/${id}`);
      toast.success('Patient deleted');
      fetchPatients();
    } catch (err) {
      toast.error(err.friendlyMessage || 'Delete failed');
    } finally { setDeleting(null); }
  };

  // ── Table columns ──────────────────────────────────────────
  const columns = [
    {
      key: 'patientId', label: 'Patient ID',
      render: r => <span className="badge-primary-custom">{r.patientId}</span>
    },
    {
      key: 'name', label: 'Name',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--primary-glow)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, flexShrink: 0,
          }}>
            {r.name?.[0]?.toUpperCase()}
          </div>
          <strong style={{ fontSize: 13 }}>{r.name}</strong>
        </div>
      )
    },
    { key: 'age',   label: 'Age / Gender', render: r => `${r.age}y / ${r.gender}` },
    { key: 'phone', label: 'Phone' },
    {
      key: 'bloodGroup', label: 'Blood Group',
      render: r => <span className="badge-danger-custom">{r.bloodGroup}</span>
    },
    {
      key: 'type', label: 'Type',
      render: r => (
        <span className={r.type === 'IPD' ? 'badge-warning-custom' : 'badge-success-custom'}>
          {r.type}
        </span>
      )
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>

          {/* ✅ View — always visible to anyone with canRead */}
          <a
            href={`/patients/${r._id}`}
            style={{
              background: 'var(--primary-glow)', color: 'var(--primary)',
              border: '1px solid var(--primary)', borderRadius: 6,
              padding: '4px 10px', fontSize: 12, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <i className="fa-solid fa-eye" />View
          </a>

          {/* ✅ Edit — only if canUpdate */}
          {canUpdate('patients') && (
            <button
              onClick={() => openEdit(r)}
              style={{
                background: 'rgba(8,145,178,0.08)', color: '#0891b2',
                border: '1px solid rgba(8,145,178,0.25)', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <i className="fa-solid fa-pen" />Edit
            </button>
          )}

          {/* ✅ Delete — only if canDelete */}
          {canDelete('patients') && (
            <button
              onClick={() => handleDelete(r._id, r.name)}
              disabled={deleting === r._id}
              style={{
                background: 'rgba(220,38,38,0.07)', color: '#dc2626',
                border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                opacity: deleting === r._id ? 0.6 : 1,
              }}
            >
              {deleting === r._id
                ? <i className="fa-solid fa-spinner fa-spin" />
                : <><i className="fa-solid fa-trash" />Delete</>
              }
            </button>
          )}
        </div>
      )
    },
  ];

  // ✅ Full-page permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Patients" path="/patients" />
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

  // ✅ Access Denied fallback (shown briefly before redirect fires)
  if (!canRead('patients')) {
    return (
      <>
        <SEOHead title="Patients" path="/patients" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Patients.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Patients" path="/patients" />
      <div>

        {/* ── Page Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <h4 style={{
              fontWeight: 800, color: 'var(--text-primary)', margin: 0,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #6d28d9))',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 16,
              }}>
                <i className="fa-solid fa-user-injured" />
              </span>
              Patients
            </h4>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 46px', fontSize: 13 }}>
              {total} registered patients
            </p>
          </div>

          {/* ✅ Register button — only if canCreate */}
          {canCreate('patients') && (
            <button className="btn-primary-custom" onClick={openAdd}>
              <i className="fa-solid fa-plus" />Register Patient
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="content-card">
          <div className="card-header-custom" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h6 style={{ margin: 0, fontWeight: 700 }}>All Patients</h6>
            <div style={{ position: 'relative' }}>
             
              <input 
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                placeholder="Search name, ID, phone..."
                className="form-control"
                style={{ width: 220, paddingLeft: 34, fontSize: 13, height: 36, borderRadius: 10 }}
              />
            </div>
          </div>
          <DataTable columns={columns} data={filteredPatients} loading={loading} searchable={false} />
          <Pagination 
            page={page} 
            total={total} 
            limit={limit} 
            onPageChange={setPage} 
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>

        {/* ── Add / Edit Modal — only renders if user has appropriate permission ── */}
        {(canCreate('patients') || canUpdate('patients')) && (
          <Modal
            show={showModal}
            onClose={() => { setShowModal(false); setForm(emptyForm); setEditId(null); }}
            title={editId ? '✏️ Edit Patient' : '🏥 Register New Patient'}
            size="lg"
            footer={<>
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); setEditId(null); }}
                style={{
                  background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
                {submitting
                  ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</>
                  : <><i className="fa-solid fa-floppy-disk" />{editId ? 'Update Patient' : 'Register'}</>
                }
              </button>
            </>}
          >
            <form onSubmit={handleSubmit}>
              <div className="row g-3">

                {/* Row 1 */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input className="form-control" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z\s\.]/g, '') })}
                    placeholder="e.g. Ramesh Kumar" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Age <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" min="0" max="150" className="form-control" value={form.age}
                    onChange={e => setForm({ ...form, age: e.target.value })}
                    placeholder="e.g. 35" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Gender <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select className="form-select" value={form.gender}
                    onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>

                {/* Row 2 */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Phone <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input className="form-control" value={form.phone}
                    maxLength={10}
                    onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g. 9800000000" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Email</label>
                  <input type="email" className="form-control" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="patient@email.com" />
                </div>

                {/* Row 3 */}
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Blood Group</label>
                  <select className="form-select" value={form.bloodGroup}
                    onChange={e => setForm({ ...form, bloodGroup: e.target.value })}>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                      <option key={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Patient Type</label>
                  <select className="form-select" value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option>OPD</option><option>IPD</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Address</label>
                  <input className="form-control" value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="City, State" />
                </div>

                {/* Row 4 */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Allergies
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}> (comma separated)</span>
                  </label>
                  <input className="form-control" value={form.allergies}
                    onChange={e => setForm({ ...form, allergies: e.target.value.replace(/[^a-zA-Z\s,]/g, '') })}
                    placeholder="e.g. Penicillin, Sulfa" />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Chronic Conditions
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}> (comma separated)</span>
                  </label>
                  <input className="form-control" value={form.chronicConditions}
                    onChange={e => setForm({ ...form, chronicConditions: e.target.value.replace(/[^a-zA-Z\s,]/g, '') })}
                    placeholder="e.g. Diabetes, Hypertension" />
                </div>

                {/* Emergency Contact */}
                <div className="col-12">
                  <label className="form-label fw-semibold" style={{
                    color: 'var(--text-muted)', fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    Emergency Contact
                  </label>
                </div>
                <div className="col-md-4">
                  <input className="form-control" placeholder="Contact Name"
                    value={form.emergencyContact.name}
                    onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value.replace(/[^a-zA-Z\s]/g, '') } })} />
                </div>
                <div className="col-md-4">
                  <input className="form-control" placeholder="Contact Phone"
                    maxLength={10}
                    value={form.emergencyContact.phone}
                    onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value.replace(/\D/g, '') } })} />
                </div>
                <div className="col-md-4">
                  <input className="form-control" placeholder="Relation (e.g. Father)"
                    value={form.emergencyContact.relation}
                    onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relation: e.target.value.replace(/[^a-zA-Z\s]/g, '') } })} />
                </div>

              </div>
            </form>
          </Modal>
        )}

      </div>
    </>
  );
}

Patients.getLayout = (page) => <Layout>{page}</Layout>;