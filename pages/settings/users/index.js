import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import StatCard from '../../../components/ui/StatCard';
import Modal from '../../../components/ui/Modal';
import BackButton from '../../../components/ui/BackButton';
import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../../hooks/usePermission';
import Link from 'next/link';
import { confirmAction } from '../../../utils/sweetAlert';
import Pagination from '../../../components/ui/Pagination';

export default function Users() {
  const { user: me }        = useAuth();
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();
  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';

  const [users,      setUsers]      = useState([]);
  const [roles,      setRoles]      = useState([]);   // dynamic from API
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [deleting,   setDeleting]   = useState(null);
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(10);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'receptionist', isActive: true });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        api.get('/users?limit=1000'),
        api.get('/roles'),
      ]);
      setUsers(uRes.data.data || []);
      setRoles(rRes.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('users')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading]);

  // Role color map from API data
  const getRoleColor = (roleName) => {
    const found = roles.find(r => r.name === roleName);
    return found?.color || '#6b7280';
  };

  const resetForm = () => setForm({ name: '', email: '', password: '', phone: '', role: roles[0]?.name || 'receptionist', isActive: true });

  const openAdd  = () => { resetForm(); setEditUser(null); setShowModal(true); };
  const openEdit = (u) => {
    setEditUser(u._id);
    setForm({ name: u.name || '', email: u.email || '', password: '', phone: u.phone || '', role: u.role || 'receptionist', isActive: u.isActive !== false });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and email required');
    
    // Email Validation (Strict pattern: prevents all-numeric parts)
    const emailRegex = /^(?=[^@]*[a-zA-Z])[a-zA-Z0-9._%+-]+@(?=[^@]*[a-zA-Z][^@]*\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
    if (!emailRegex.test(form.email)) return toast.error('Please enter a valid email address (must contain letters in both parts)');

    if (form.phone && !/^[0-9]{10}$/.test(form.phone)) return toast.error('Phone number must be exactly 10 digits');

    if (!editUser && !form.password) return toast.error('Password required for new user');
    if (!editUser && form.password.length < 6) return toast.error('Password must be at least 6 characters');

    // ✅ Permission check
    if (editUser && !canUpdate('users')) return toast.error('No permission to update users');
    if (!editUser && !canCreate('users')) return toast.error('No permission to create users');

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (editUser && !form.password) delete payload.password;
      if (editUser) { await api.put(`/users/${editUser}`, payload);  toast.success('User updated!'); }
      else          { await api.post('/users', payload);              toast.success('User created!'); }
      setShowModal(false); resetForm(); setEditUser(null); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (id === me?._id) return toast.error("You can't delete yourself!");
    if (!canDelete('users')) return toast.error("No permission to delete users");
    if (!await confirmAction('Delete User?', `Delete user "${name}"? This cannot be undone.`, 'Yes, delete')) return;
    setDeleting(id);
    try { await api.delete(`/users/${id}`); toast.success('User deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const toggleStatus = async (u) => {
    try {
      await api.put(`/users/${u._id}`, { isActive: !u.isActive });
      toast.success(`User ${!u.isActive ? 'activated' : 'deactivated'}`);
      fetchAll();
    } catch { toast.error('Failed to update status'); }
  };

  // Stats
  const active   = users.filter(u => u.isActive !== false);
  const inactive = users.filter(u => u.isActive === false);
  const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const newUsers = users.filter(u => new Date(u.createdAt) >= weekAgo);

  // Role counts from dynamic roles
  const roleCounts = roles.reduce((acc, r) => {
    acc[r.name] = users.filter(u => u.role === r.name).length;
    return acc;
  }, {});

  const statCards = [
    { icon: 'fa-users',       label: 'Total Users',  value: users.length,    color: '#16a34a', sub: 'All system users',  change: `${newUsers.length} new this week`, changeType: 'up',      delay: 0 },
    { icon: 'fa-user-check',  label: 'Active',       value: active.length,   color: '#059669', sub: 'Can login',        change: `${Math.round((active.length / Math.max(users.length,1))*100)}% active`, changeType: 'up', delay: 1 },
    { icon: 'fa-user-xmark',  label: 'Inactive',     value: inactive.length, color: '#dc2626', sub: 'Access disabled',  change: inactive.length > 0 ? 'Disabled' : 'All active', changeType: inactive.length > 0 ? 'down' : 'neutral', delay: 2 },
    { icon: 'fa-id-card',     label: 'Total Roles',  value: roles.length,    color: '#7c3aed', sub: 'Defined roles',    change: `${roles.filter(r=>!r.isSystem).length} custom roles`, changeType: 'info', delay: 3 },
  ];

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !search || u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
    const matchRole   = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const paginatedUsers = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, filterRole]);
  return (
    <>
      <SEOHead title="Users" path="/settings/users" />

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>User Management</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
              {users.length} registered users
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {isAdmin && canRead('permissions') && (
            <Link href="/settings/permissions"
              style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'1.5px solid #0891b2', background:'rgba(8,145,178,0.07)', color:'#0891b2', fontWeight:700, fontSize:13, textDecoration:'none' }}>
              <i className="fa-solid fa-key" />Permissions
            </Link>
          )}
          {isAdmin && canCreate('users') && (
            <button onClick={openAdd}
              style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 4px 14px rgba(124,58,237,0.3)' }}>
              <i className="fa-solid fa-user-plus" />Add User
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards-grid mb-4">
        {statCards.map((s,i) => <StatCard key={i} {...s} />)}
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        <button onClick={() => setFilterRole('')}
          style={{ padding:'6px 16px', borderRadius:30, border:`1.5px solid ${!filterRole ? '#7c3aed' : 'var(--border-color)'}`, background:!filterRole ? 'rgba(124,58,237,0.1)' : 'var(--card-bg)', color:!filterRole ? '#7c3aed' : 'var(--text-muted)', fontWeight:700, fontSize:12, cursor:'pointer' }}>
          All ({users.length})
        </button>
        {roles.map(role => (
          <button key={role._id} onClick={() => setFilterRole(filterRole === role.name ? '' : role.name)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 16px', borderRadius:30, border:`1.5px solid ${filterRole===role.name ? role.color : 'var(--border-color)'}`, background:filterRole===role.name ? `${role.color}15` : 'var(--card-bg)', color:filterRole===role.name ? role.color : 'var(--text-muted)', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:role.color }} />
            <span style={{ textTransform:'capitalize' }}>{role.label}</span>
            <span style={{ fontWeight:900, color:role.color }}>{roleCounts[role.name]||0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="content-card">
        <div className="card-header-custom d-flex align-items-center justify-content-between" style={{ flexWrap:'wrap', gap:10 }}>
          <h6 style={{ margin:0, fontWeight:700 }}>
            All Users
            <span style={{ marginLeft:8, fontSize:11, fontWeight:600, background:'var(--hover-bg)', padding:'2px 10px', borderRadius:20, color:'var(--text-muted)' }}>{filtered.length}</span>
          </h6>
          <div className="d-flex gap-2" style={{ flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name / email..." className="form-control form-control-sm"
                style={{ paddingLeft: 32, borderRadius: 10, fontSize: 13, height: 40 }} />
            </div>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="form-select form-select-sm" style={{ width: 150, borderRadius: 10, fontSize: 13, height: 40, cursor: 'pointer' }}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r._id} value={r.name} style={{ textTransform: 'capitalize' }}>{r.label}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color:'#7c3aed' }} />
            <div style={{ marginTop:12, fontWeight:600 }}>Loading users…</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="table table-custom w-100">
              <thead>
                <tr>
                  <th>User</th><th>Role</th><th>Email</th><th>Phone</th>
                  <th>Status</th><th>Joined</th><th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(u => {
                  const rc   = getRoleColor(u.role);
                  const isMe = u._id === me?._id;
                  const roleLabel = roles.find(r => r.name === u.role)?.label || u.role;
                  return (
                    <tr key={u._id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:38,height:38,borderRadius:'50%',background:`linear-gradient(135deg,${rc}30,${rc}60)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:rc,fontSize:15,flexShrink:0 }}>
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
                              {u.name}
                              {isMe && <span style={{ fontSize:10,background:'rgba(124,58,237,0.1)',color:'#7c3aed',padding:'1px 8px',borderRadius:20,fontWeight:700 }}>You</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ background:`${rc}15`,color:rc,padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize',display:'inline-flex',alignItems:'center',gap:5 }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:rc }} />
                          {roleLabel}
                        </span>
                      </td>
                      <td style={{ fontSize:13, color:'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ fontSize:13, color:'var(--text-muted)' }}>{u.phone || '—'}</td>
                      <td>
                        <button onClick={() => !isMe && isAdmin && canUpdate('users') && toggleStatus(u)} disabled={isMe || !isAdmin || !canUpdate('users')}
                          style={{ background:u.isActive!==false?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.08)', color:u.isActive!==false?'#16a34a':'#dc2626', border:'none', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:(isMe || !isAdmin || !canUpdate('users'))?'not-allowed':'pointer', display:'inline-flex', alignItems:'center', gap:5, opacity:(isMe || !isAdmin || !canUpdate('users'))?0.6:1 }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:u.isActive!==false?'#16a34a':'#dc2626' }} />
                          {u.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          {isAdmin && canUpdate('users') && (
                            <button onClick={() => openEdit(u)}
                              style={{ background:'var(--primary-glow)',border:'1px solid var(--primary)',borderRadius:7,padding:'5px 10px',fontSize:12,color:'var(--primary)',cursor:'pointer' }}>
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          {!isMe && isAdmin && canDelete('users') && (
                            <button onClick={() => handleDelete(u._id, u.name)} disabled={deleting===u._id}
                              style={{ background:'rgba(220,38,38,0.07)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:7,padding:'5px 10px',fontSize:12,color:'#dc2626',cursor:'pointer' }}>
                              {deleting===u._id ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-trash" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
                    <i className="fa-solid fa-users fa-2x" style={{ display:'block', marginBottom:12, opacity:0.3 }} />
                    {search || filterRole ? 'No users match your filter.' : 'No users yet.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination 
            page={page} 
            total={filtered.length} 
            limit={limit} 
            onPageChange={setPage} 
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        )}
      </div>

      {/* Add / Edit Modal */}
      {isAdmin && (canCreate('users') || canUpdate('users')) && (
        <Modal show={showModal}
        onClose={() => { setShowModal(false); resetForm(); setEditUser(null); }}
        title={editUser ? '✏️ Edit User' : '👤 Add New User'}
        size="md"
        footer={<>
          <button onClick={() => { setShowModal(false); resetForm(); setEditUser(null); }}
            style={{ background:'var(--hover-bg)',border:'1px solid var(--border-color)',borderRadius:10,padding:'10px 20px',cursor:'pointer',color:'var(--text-secondary)',fontWeight:600 }}>
            Cancel
          </button>
          <button onClick={handleSubmit}
            style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'white',border:'none',fontWeight:700,fontSize:13,cursor:'pointer' }}
            disabled={submitting}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</> : <><i className="fa-solid fa-floppy-disk" />{editUser ? 'Update User' : 'Create User'}</>}
          </button>
        </>}>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label fw-semibold">Full Name <span style={{ color:'#dc2626' }}>*</span></label>
            <input className="form-control" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value.replace(/[^a-zA-Z\s.]/g, '')})} 
              placeholder="e.g. Dr. Ramesh Kumar" />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Email <span style={{ color:'#dc2626' }}>*</span></label>
            <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="user@medicare.com" />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">{editUser ? 'New Password (optional)' : 'Password *'}</label>
            <input type="password" className="form-control" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder={editUser ? 'Leave blank to keep' : 'Min 6 characters'} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Phone</label>
            <input className="form-control" 
              value={form.phone} 
              maxLength={10}
              onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
              placeholder="10-digit mobile number" />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Role <span style={{ color:'#dc2626' }}>*</span></label>
            <select className="form-select" value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
              {roles.map(r => (
                <option key={r._id} value={r.name}>{r.label}{r.isSystem ? ' (System)' : ''}</option>
              ))}
            </select>
            {form.role && (() => {
              const sel = roles.find(r => r.name === form.role);
              return sel ? (
                <div style={{ marginTop:8, padding:'8px 12px', borderRadius:9, background:`${sel.color}10`, border:`1px solid ${sel.color}30`, fontSize:12, color:sel.color, fontWeight:600 }}>
                  <i className="fa-solid fa-circle-info me-2" />{sel.description || `${sel.label} role`}
                </div>
              ) : null;
            })()}
          </div>
          {editUser && (
            <div className="col-12">
              <label className="form-label fw-semibold">Account Status</label>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                {[true, false].map(val => (
                  <button key={String(val)} type="button" onClick={() => setForm({...form, isActive:val})}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:`1.5px solid ${form.isActive===val?(val?'#16a34a':'#dc2626'):'var(--border-color)'}`, background:form.isActive===val?(val?'rgba(22,163,74,0.08)':'rgba(220,38,38,0.08)'):'var(--hover-bg)', color:form.isActive===val?(val?'#16a34a':'#dc2626'):'var(--text-muted)', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s' }}>
                    <i className={`fa-solid ${val?'fa-circle-check':'fa-circle-xmark'} me-2`} />
                    {val ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    )}

      <style>{`
        .stat-cards-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        @media(max-width:1200px){ .stat-cards-grid{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:600px) { .stat-cards-grid{ grid-template-columns:1fr; } }
      `}</style>
    </>
  );
}

Users.getLayout = (page) => <Layout>{page}</Layout>;