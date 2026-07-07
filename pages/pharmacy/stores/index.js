import { useState, useEffect } from 'react';
import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/ui/DataTable';
import Pagination from '../../../components/ui/Pagination';
import BackButton from '../../../components/ui/BackButton';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import { usePermission } from '../../../hooks/usePermission';

export default function PharmacyStoresPage() {
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [stores, setStores] = useState([]);
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
    contactNumber: '',
    address: '',
    licenseNumber: '',
    operatingHours: '',
    status: 'active'
  });

  const fetchStores = () => {
    setLoading(true);
    api.get(`/pharmacy-stores?page=${page}&limit=${limit}&search=${search}`)
      .then(res => {
        setStores(res.data?.data || []);
        setTotal(res.data?.total || 0);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to fetch pharmacy stores'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('pharmacy-stores')) { setLoading(false); return; }
    fetchStores();
  }, [permLoading, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!permLoading && canRead('pharmacy-stores')) {
        setPage(1);
        fetchStores();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenModal = (store = null) => {
    if (store) {
      setEditingId(store._id);
      setForm({
        name: store.name,
        contactNumber: store.contactNumber,
        address: store.address || '',
        licenseNumber: store.licenseNumber || '',
        operatingHours: store.operatingHours || '',
        status: store.status
      });
    } else {
      setEditingId(null);
      setForm({ name: '', contactNumber: '', address: '', licenseNumber: '', operatingHours: '', status: 'active' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.contactNumber) {
      return toast.error('Name and contact number are required');
    }
    if (!/^[0-9]{10}$/.test(form.contactNumber)) {
      return toast.error('Contact number must be exactly 10 digits');
    }
    if (form.licenseNumber && !/^[a-zA-Z0-9\-]+$/.test(form.licenseNumber)) {
      return toast.error('License number can only contain letters, numbers, and hyphens');
    }
    if (form.operatingHours && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?-\s?([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(form.operatingHours)) {
      return toast.error('Operating hours must be in HH:MM - HH:MM format (e.g., 09:00 - 17:00)');
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/pharmacy-stores/${editingId}`, form);
        toast.success('Pharmacy store updated');
      } else {
        await api.post('/pharmacy-stores', form);
        toast.success('Pharmacy store added');
      }
      setModalOpen(false);
      fetchStores();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this pharmacy store?')) return;
    try {
      await api.delete(`/pharmacy-stores/${id}`);
      toast.success('Pharmacy store deleted');
      fetchStores();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Store Name', render: r => <strong style={{ fontSize: 13 }}>{r.name}</strong> },
    { key: 'contactNumber', label: 'Contact', render: r => <span>{r.contactNumber}</span> },
    { key: 'licenseNumber', label: 'License No', render: r => <span>{r.licenseNumber || 'N/A'}</span> },
    { key: 'operatingHours', label: 'Hours', render: r => <span>{r.operatingHours || 'N/A'}</span> },
    { 
      key: 'status', label: 'Status',
      render: r => {
        if (r.status === 'active') return <span className="badge-success-custom">Active</span>;
        if (r.status === 'inactive') return <span className="badge-danger-custom">Inactive</span>;
        return <span>{r.status}</span>;
      }
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {canUpdate('pharmacy-stores') && (
            <button
              onClick={() => handleOpenModal(r)}
              style={{ background: 'rgba(8,145,178,0.08)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa-solid fa-pen" />Edit
            </button>
          )}
          {canDelete('pharmacy-stores') && (
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

  if (!canRead('pharmacy-stores')) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-lock fa-3x" style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
        <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
        <p style={{ fontSize: 13 }}>You don't have permission to view Pharmacy Stores.</p>
      </div>
    </Layout>
  );

  return (
    <>
      <SEOHead title="Pharmacy Stores | MediCare ERP" path="/pharmacy/stores" />
      
      <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #059669))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>
              <i className="fa-solid fa-store" />
            </span>
            Pharmacy Stores
          </h4>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 46px', fontSize: 13 }}>
            Manage in-house and partner pharmacy branches
          </p>
        </div>
        {canCreate('pharmacy-stores') && (
          <button className="btn-primary-custom" onClick={() => handleOpenModal()}>
            <i className="fa-solid fa-plus" /> Add Pharmacy
          </button>
        )}
      </div>

      <div className="content-card">
        <div className="card-header-custom" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>All Pharmacies</h6>
          <div style={{ position: 'relative' }}>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or license..."
              className="form-control"
              style={{ width: 260, fontSize: 13, height: 36, borderRadius: 10 }}
            />
          </div>
        </div>

        <DataTable columns={columns} data={stores} loading={loading} searchable={false} />
        
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

      <Modal show={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Pharmacy' : 'Add Pharmacy'} size="md"
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
              <label className="form-label fw-semibold">Store Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="text" className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Contact Number <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="text" className="form-control" required value={form.contactNumber} 
                maxLength={10} onChange={e => setForm({...form, contactNumber: e.target.value.replace(/\D/g, '')})} 
                placeholder="10-digit number" />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">License Number</label>
              <input type="text" className="form-control" value={form.licenseNumber} onChange={e => setForm({...form, licenseNumber: e.target.value})} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Operating Hours</label>
              <input type="text" className="form-control" value={form.operatingHours} onChange={e => setForm({...form, operatingHours: e.target.value})} placeholder="e.g., 9:00 AM - 10:00 PM" />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Address</label>
              <textarea className="form-control" value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows="2" />
            </div>
            {editingId && (
              <div className="col-12">
                <label className="form-label fw-semibold">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

PharmacyStoresPage.getLayout = (page) => <Layout>{page}</Layout>;
