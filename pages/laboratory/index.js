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

export default function LaboratoryPage() {
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [partners, setPartners] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    address: '',
    contact: '',
    testCategories: '',
    status: 'pending'
  });

  const fetchPartners = () => {
    setLoading(true);
    api.get(`/laboratory?page=${page}&limit=${limit}&search=${search}`)
      .then(res => {
        setPartners(res.data?.data || []);
        setTotal(res.data?.total || 0);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to fetch lab partners'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('laboratory')) { setLoading(false); return; }
    fetchPartners();
  }, [permLoading, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('laboratory')) {
        setPage(1);
        fetchPartners();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenModal = (partner = null) => {
    if (partner) {
      setEditingId(partner._id);
      setForm({
        name: partner.name,
        address: partner.address,
        contact: partner.contact,
        testCategories: partner.testCategories?.join(', ') || '',
        status: partner.status
      });
    } else {
      setEditingId(null);
      setForm({ name: '', address: '', contact: '', testCategories: '', status: 'pending' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.address || !form.contact) {
      return toast.error('Name, address, and contact are required');
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        testCategories: form.testCategories.split(',').map(c => c.trim()).filter(Boolean)
      };

      if (editingId) {
        await api.put(`/laboratory/${editingId}`, payload);
        toast.success('Lab partner updated');
      } else {
        await api.post('/laboratory', payload);
        toast.success('Lab partner added');
      }
      setModalOpen(false);
      fetchPartners();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!canUpdate('laboratory')) return toast.error('No permission to update');
    try {
      await api.put(`/laboratory/${id}`, { status: newStatus });
      toast.success(`Lab partner marked as ${newStatus}`);
      fetchPartners();
    } catch (err) {
      toast.error('Status update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lab partner?')) return;
    try {
      await api.delete(`/laboratory/${id}`);
      toast.success('Lab partner deleted');
      fetchPartners();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Partner Name', render: r => <strong style={{ fontSize: 13 }}>{r.name}</strong> },
    { key: 'contact', label: 'Contact', render: r => <span>{r.contact}</span> },
    { key: 'address', label: 'Address', render: r => <span>{r.address}</span> },
    { 
      key: 'testCategories', label: 'Test Categories',
      render: r => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {r.testCategories?.map((cat, i) => (
            <span key={i} className="badge-info-custom" style={{ padding: '2px 8px', fontSize: 11 }}>
              {cat}
            </span>
          ))}
        </div>
      )
    },
    { 
      key: 'status', label: 'Status',
      render: r => {
        if (r.status === 'approved') return <span className="badge-success-custom">Approved</span>;
        if (r.status === 'pending') return <span className="badge-warning-custom">Pending</span>;
        if (r.status === 'deactivated') return <span className="badge-danger-custom">Deactivated</span>;
        return <span>{r.status}</span>;
      }
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {canUpdate('laboratory') && r.status === 'pending' && (
            <button
              onClick={() => handleStatusChange(r._id, 'approved')}
              style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa-solid fa-check" />Approve
            </button>
          )}
          {canUpdate('laboratory') && r.status === 'approved' && (
            <button
              onClick={() => handleStatusChange(r._id, 'deactivated')}
              style={{ background: 'rgba(220,38,38,0.07)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa-solid fa-ban" />Deactivate
            </button>
          )}
          {canUpdate('laboratory') && (
            <button
              onClick={() => handleOpenModal(r)}
              style={{ background: 'rgba(8,145,178,0.08)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa-solid fa-pen" />Edit
            </button>
          )}
          {canDelete('laboratory') && (
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

  if (!canRead('laboratory')) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
        <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
        <p style={{ fontSize: 13 }}>You don't have permission to view Laboratory.</p>
      </div>
    </Layout>
  );

  return (
    <>
      <SEOHead title="Laboratory | MediCare ERP" path="/laboratory" />
      
      <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #6d28d9))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>
              <i className="fa-solid fa-microscope" />
            </span>
            Laboratory Partners
          </h4>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 46px', fontSize: 13 }}>
            Manage onboarded lab partners and their statuses
          </p>
        </div>
        {canCreate('laboratory') && (
          <button className="btn-primary-custom" onClick={() => handleOpenModal()}>
            <i className="fa-solid fa-plus" /> Add Lab Partner
          </button>
        )}
      </div>

      <div className="content-card">
        <div className="card-header-custom" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>All Lab Partners</h6>
          <div style={{ position: 'relative' }}>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="form-control"
              style={{ width: 220, fontSize: 13, height: 36, borderRadius: 10 }}
            />
          </div>
        </div>

        <DataTable columns={columns} data={partners} loading={loading} searchable={false} />
        
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

      <Modal show={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Lab Partner' : 'Add Lab Partner'} size="md"
        footer={<>
          <button onClick={() => setModalOpen(false)} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary-custom" disabled={submitting}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : <><i className="fa-solid fa-save" /> Save</>}
          </button>
        </>}
      >
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Partner Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="text" className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Contact Details <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="text" className="form-control" required value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} placeholder="Phone / Email" />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Address <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea className="form-control" required value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows="2" />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Test Categories <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}> (comma separated)</span></label>
              <input type="text" className="form-control" value={form.testCategories} onChange={e => setForm({...form, testCategories: e.target.value})} placeholder="Blood Test, MRI, X-Ray" />
            </div>
            {editingId && (
              <div className="col-12">
                <label className="form-label fw-semibold">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

LaboratoryPage.getLayout = (page) => <Layout>{page}</Layout>;
