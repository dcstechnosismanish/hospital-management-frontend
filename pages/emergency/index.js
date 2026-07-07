import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import BackButton from '../../components/ui/BackButton';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { usePermission } from '../../hooks/usePermission';

export default function EmergencyPage() {
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // active or resolved
  
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [doctors, setDoctors] = useState([]);

  const [form, setForm] = useState({
    patientName: '',
    complaint: '',
    isVip: false
  });

  const [assignForm, setAssignForm] = useState({ doctorId: '' });

  const fetchCases = () => {
    setLoading(true);
    api.get(`/emergency?page=${page}&limit=${limit}&search=${search}&status=${statusFilter}`)
      .then(res => {
        setCases(res.data?.data || []);
        setTotal(res.data?.total || 0);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to fetch emergency cases'))
      .finally(() => setLoading(false));
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/doctors?limit=200');
      setDoctors(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load doctors');
    }
  };

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('emergency')) { setLoading(false); return; }
    fetchCases();
  }, [permLoading, page, limit, statusFilter]);

  useEffect(() => {
    if (permLoading || !canRead('emergency')) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchCases();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (canUpdate('emergency')) fetchDoctors();
  }, [canUpdate('emergency')]);

  const handleOpenModal = () => {
    setForm({ patientName: '', complaint: '', isVip: false });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/emergency', form);
      toast.success('Emergency flag created');
      setModalOpen(false);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.doctorId) return toast.error('Please select a doctor');
    setSubmitting(true);
    try {
      await api.put(`/emergency/${editingId}`, { assignedDoctor: assignForm.doctorId });
      toast.success('Doctor assigned');
      setAssignModalOpen(false);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id) => {
    if (!confirm('Mark this emergency as resolved?')) return;
    try {
      await api.put(`/emergency/${id}`, { status: 'resolved' });
      toast.success('Emergency resolved');
      fetchCases();
    } catch (err) {
      toast.error('Failed to resolve');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      await api.delete(`/emergency/${id}`);
      toast.success('Record deleted');
      fetchCases();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const columns = [
    {
      key: 'patient', label: 'Patient',
      render: r => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.patientName}</div>
          {r.isVip && <span className="badge-warning-custom" style={{ fontSize: 10, marginTop: 4, padding: '2px 8px' }}><i className="fa-solid fa-star" /> VIP</span>}
        </div>
      )
    },
    {
      key: 'timeOfFlag', label: 'Time of Flag',
      render: r => (
        <div>
          <div style={{ fontWeight: 600 }}>{new Date(r.timeOfFlag).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.timeOfFlag).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      )
    },
    {
      key: 'complaint', label: 'Complaint',
      render: r => <div style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.complaint}>{r.complaint}</div>
    },
    {
      key: 'assignedDoctor', label: 'Assigned Doctor',
      render: r => r.assignedDoctor ? (
        <div>
          <div style={{ fontWeight: 600 }}>Dr. {r.assignedDoctor.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.assignedDoctor.department}</div>
        </div>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unresponded</span>
      )
    },
    {
      key: 'status', label: 'Status',
      render: r => {
        if (r.status === 'active') return <span className="badge-danger-custom" style={{ animation: 'pulse 2s infinite' }}>Active</span>;
        if (r.status === 'resolved') return <span className="badge-success-custom">Resolved</span>;
        return <span>{r.status}</span>;
      }
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {canUpdate('emergency') && r.status === 'active' && (
            <>
              <button
                onClick={() => {
                  setEditingId(r._id);
                  setAssignForm({ doctorId: r.assignedDoctor?._id || '' });
                  setAssignModalOpen(true);
                }}
                style={{ background: 'rgba(8,145,178,0.08)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <i className="fa-solid fa-user-md" />Assign
              </button>
              <button
                onClick={() => handleResolve(r._id)}
                style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <i className="fa-solid fa-check" />Resolve
              </button>
            </>
          )}
          {canDelete('emergency') && (
            <button
              onClick={() => handleDelete(r._id)}
              style={{ background: 'rgba(220,38,38,0.07)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa-solid fa-trash" />Delete
            </button>
          )}
        </div>
      )
    }
  ];

  if (permLoading) return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 14 }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: 'var(--primary)' }} />
        <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Checking permissions...</div>
      </div>
    </Layout>
  );

  if (!canRead('emergency')) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
        <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
        <p style={{ fontSize: 13 }}>You don't have permission to view Emergency.</p>
      </div>
    </Layout>
  );

  return (
    <>
      <SEOHead title="Emergency Management | MediCare ERP" path="/emergency" />
      
      <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #dc2626, #991b1b)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>
              <i className="fa-solid fa-truck-medical" />
            </span>
            Emergency Management
          </h4>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 46px', fontSize: 13 }}>
            Real-time alerts, VIP flags, and rapid response
          </p>
        </div>
        {canCreate('emergency') && (
          <button className="btn-primary-custom" onClick={handleOpenModal} style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
            <i className="fa-solid fa-triangle-exclamation" /> Log Emergency
          </button>
        )}
      </div>

      <div className="content-card">
        <div className="card-header-custom" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="form-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontWeight: 600 }}>
              <option value="active">Active Alerts</option>
              <option value="resolved">Alert History Log</option>
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient or complaint..."
              className="form-control"
              style={{ width: 260, fontSize: 13, height: 36, borderRadius: 10 }}
            />
          </div>
        </div>

        <DataTable columns={columns} data={cases} loading={loading} searchable={false} />
        
        {total > 0 && (
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        )}
      </div>

      <Modal show={modalOpen} onClose={() => setModalOpen(false)} title="Log Emergency" size="md"
        footer={<>
          <button onClick={() => setModalOpen(false)} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting} style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : <><i className="fa-solid fa-triangle-exclamation" /> Alert Now</>}
          </button>
        </>}
      >
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Patient Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="text" className="form-control" required value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Complaint / Reason <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea className="form-control" required value={form.complaint} onChange={e => setForm({...form, complaint: e.target.value})} rows="3" />
            </div>
            <div className="col-12 d-flex align-items-center gap-2">
              <input type="checkbox" id="vipCheck" checked={form.isVip} onChange={e => setForm({...form, isVip: e.target.checked})} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <label htmlFor="vipCheck" style={{ margin: 0, fontWeight: 700, color: '#ca8a04', cursor: 'pointer' }}><i className="fa-solid fa-star" /> Flag as VIP Case</label>
            </div>
          </div>
        </form>
      </Modal>

      <Modal show={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Doctor" size="sm"
        footer={<>
          <button onClick={() => setAssignModalOpen(false)} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleAssignSubmit} className="btn-primary-custom" disabled={submitting}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : <><i className="fa-solid fa-save" /> Confirm</>}
          </button>
        </>}
      >
        <form onSubmit={handleAssignSubmit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Select Doctor</label>
              <select className="form-select" required value={assignForm.doctorId} onChange={e => setAssignForm({ doctorId: e.target.value })}>
                <option value="">-- Select a Doctor --</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>Dr. {d.name} ({d.department})</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

EmergencyPage.getLayout = (page) => <Layout>{page}</Layout>;
