import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import Modal from '../../../components/ui/Modal';
import BackButton from '../../../components/ui/BackButton'; // ✅ Added
import { useEffect, useState } from 'react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import { usePermission } from '../../../hooks/usePermission';
import Link from 'next/link';
import { confirmAction } from '../../../utils/sweetAlert';

const COLOR_PRESETS = ['#7c3aed','#0891b2','#16a34a','#d97706','#dc2626','#ec4899','#059669','#f59e0b','#3b82f6','#8b5cf6','#14b8a6','#64748b'];

const emptyForm = () => ({ name:'', label:'', description:'', color:'#7c3aed' });

export default function RolesPage() {
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();
  
  const [roles,      setRoles]      = useState([]);
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editRole,   setEditRole]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [form,       setForm]       = useState(emptyForm());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rRes, uRes] = await Promise.all([
        api.get('/roles'),
        api.get('/users?limit=1000'),
      ]);
      setRoles(rRes.data.data || []);
      setUsers(uRes.data.data || []);
    } catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (permLoading) return;
    if (!canRead('roles')) { setLoading(false); return; }
    fetchAll();
  }, [permLoading]);

  const userCount = (roleName) => users.filter(u => u.role === roleName).length;

  const openAdd  = () => { setForm(emptyForm()); setEditRole(null); setShowModal(true); };
  const openEdit = (r) => {
    setEditRole(r._id);
    setForm({ name:r.name, label:r.label, description:r.description||'', color:r.color||'#7c3aed' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasLetters = (str) => /[a-zA-Z]/.test(str || '');
    const nameTrimmed  = form.name.toLowerCase().trim();
    const labelTrimmed = form.label.trim();

    if (!nameTrimmed || !labelTrimmed) return toast.error('Role name and label are required');
    
    if (!hasLetters(nameTrimmed))  return toast.error('Role Name (ID) must contain at least one letter');
    if (!hasLetters(labelTrimmed)) return toast.error('Display Label must contain at least one letter');
    
    if (!/^[a-z0-9_-]+$/.test(nameTrimmed))
      return toast.error('Role name: only lowercase letters, numbers, hyphens and underscores allowed');
    
    if (form.description && !hasLetters(form.description))
      return toast.error('Description must contain letters if provided');

    // ✅ Permission check
    if (editRole && !canUpdate('roles')) return toast.error('No permission to update roles');
    if (!editRole && !canCreate('roles')) return toast.error('No permission to create roles');

    setSubmitting(true);
    try {
      const payload = { ...form, name: form.name.toLowerCase().trim() };
      if (editRole) { await api.put(`/roles/${editRole}`, payload);  toast.success('Role updated!'); }
      else          { await api.post('/roles', payload);              toast.success('Role created!'); }
      setShowModal(false); setEditRole(null); setForm(emptyForm()); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, label, isSystem) => {
    if (isSystem) return toast.error('System roles cannot be deleted');
    if (!canDelete('roles')) return toast.error('No permission to delete roles');
    if (!await confirmAction('Delete Role?', `Delete role "${label}"? Users with this role will lose access.`, 'Yes, delete')) return;
    setDeleting(id);
    try { await api.delete(`/roles/${id}`); toast.success('Role deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  return (
    <>
      <SEOHead title="Roles" path="/settings/roles" />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <BackButton />
            <h4 style={{ fontWeight:900, fontSize:24, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:18 }}>
                <i className="fa-solid fa-shield-halved" />
              </span>
              Manage Roles
            </h4>
          </div>
          <p style={{ color:'var(--text-muted)', margin:'4px 0 0 82px', fontSize:13 }}>
            {roles.length} roles · {roles.filter(r=>r.isSystem).length} system · {roles.filter(r=>!r.isSystem).length} custom
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {canRead('permissions') && (
            <Link href="/settings/permissions"
              style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'1.5px solid #0891b2',background:'rgba(8,145,178,0.07)',color:'#0891b2',fontWeight:700,fontSize:13,textDecoration:'none' }}>
              <i className="fa-solid fa-key" />Set Permissions
            </Link>
          )}
          {canCreate('roles') && (
            <button onClick={openAdd}
              style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'white',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 4px 14px rgba(124,58,237,0.3)' }}>
              <i className="fa-solid fa-plus" />Create Role
            </button>
          )}
        </div>
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color:'#7c3aed' }} />
          <div style={{ marginTop:12, fontWeight:600 }}>Loading roles…</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:18 }}>
          {roles.map(role => {
            const uc  = userCount(role.name);
            const isRoleAdmin = role.name === 'admin' || role.name === 'superadmin';
            const validPerms = role.permissions?.filter(p => {
              if (!isRoleAdmin && (p.module === 'permissions' || p.module === 'roles')) return false;
              return p.read || p.create || p.update || p.delete;
            }) || [];
            const permsCount = validPerms.length;
            
            return (
              <div key={role._id} className="content-card" style={{ padding:'22px 24px', borderTop:`3px solid ${role.color}`, transition:'transform 0.15s,box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow=''; }}>

                {/* Role header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:44,height:44,borderRadius:12,background:`${role.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:role.color }}>
                      <i className={`fa-solid ${role.name==='admin'?'fa-user-shield':role.name==='doctor'?'fa-user-doctor':role.name==='pharmacist'?'fa-pills':role.name==='nurse'?'fa-user-nurse':role.name==='receptionist'?'fa-headset':'fa-id-badge'}`} />
                    </div>
                    <div>
                      <div style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
                        {role.label}
                        {role.isSystem && (
                          <span style={{ fontSize:10,background:'rgba(107,114,128,0.12)',color:'#6b7280',padding:'2px 8px',borderRadius:20,fontWeight:700 }}>System</span>
                        )}
                      </div>
                      <div style={{ fontSize:12,fontFamily:'monospace',color:role.color,marginTop:2,fontWeight:600 }}>{role.name}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    {canUpdate('roles') && (
                      <button onClick={() => openEdit(role)}
                        style={{ width:32,height:32,borderRadius:8,border:'1px solid var(--border-color)',background:'var(--hover-bg)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>
                        <i className="fa-solid fa-pen" />
                      </button>
                    )}
                    {!role.isSystem && canDelete('roles') && (
                      <button onClick={() => handleDelete(role._id, role.label, role.isSystem)} disabled={deleting===role._id}
                        style={{ width:32,height:32,borderRadius:8,border:'1px solid rgba(220,38,38,0.25)',background:'rgba(220,38,38,0.07)',color:'#dc2626',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>
                        {deleting===role._id ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-trash" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {role.description && (
                  <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14, lineHeight:1.5 }}>{role.description}</p>
                )}

                {/* Stats row */}
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  <div style={{ flex:1, padding:'10px 12px', borderRadius:10, background:'var(--hover-bg)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:role.color }}>{uc}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Users</div>
                  </div>
                  <div style={{ flex:1, padding:'10px 12px', borderRadius:10, background:'var(--hover-bg)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:role.color }}>{permsCount}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Modules</div>
                  </div>
                  <div style={{ flex:1, padding:'10px 12px', borderRadius:10, background:'var(--hover-bg)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:role.color }}>
                      {validPerms.reduce((acc,p) => acc + (p.read?1:0)+(p.create?1:0)+(p.update?1:0)+(p.delete?1:0), 0)}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Actions</div>
                  </div>
                </div>

                {/* Permission pills preview */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:16 }}>
                  {validPerms.slice(0,6).map(p => (
                    <span key={p.module} style={{ fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:`${role.color}10`,color:role.color,textTransform:'capitalize' }}>
                      {p.module}
                    </span>
                  ))}
                  {validPerms.length > 6 && (
                    <span style={{ fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'var(--hover-bg)',color:'var(--text-muted)' }}>
                      +{validPerms.length-6} more
                    </span>
                  )}
                </div>

                {/* Set Permissions link */}
                {canRead('permissions') && (
                  <Link href={`/settings/permissions?role=${role._id}`}
                    style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'9px',borderRadius:10,border:`1.5px solid ${role.color}30`,background:`${role.color}08`,color:role.color,fontWeight:700,fontSize:12,textDecoration:'none',transition:'all 0.15s' }}>
                    <i className="fa-solid fa-key" />Set Permissions
                  </Link>
                )}
              </div>
            );
          })}

          {/* Add Role Card */}
          {canCreate('roles') && (
            <div onClick={openAdd}
              style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:'40px 24px',borderRadius:16,border:'2px dashed var(--border-color)',cursor:'pointer',color:'var(--text-muted)',transition:'all 0.15s',minHeight:200 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#7c3aed'; e.currentTarget.style.color='#7c3aed'; e.currentTarget.style.background='rgba(124,58,237,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-color)'; e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='transparent'; }}>
              <div style={{ width:52,height:52,borderRadius:14,border:'2px dashed currentColor',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>
                <i className="fa-solid fa-plus" />
              </div>
              <div style={{ fontWeight:700, fontSize:14 }}>Create Custom Role</div>
              <div style={{ fontSize:12, textAlign:'center', opacity:0.7 }}>Add a new role with custom permissions</div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(canCreate('roles') || canUpdate('roles')) && (
        <Modal show={showModal}
        onClose={() => { setShowModal(false); setEditRole(null); setForm(emptyForm()); }}
        title={editRole ? '✏️ Edit Role' : '🛡️ Create Role'}
        size="md"
        footer={<>
          <button onClick={() => { setShowModal(false); setEditRole(null); setForm(emptyForm()); }}
            style={{ background:'var(--hover-bg)',border:'1px solid var(--border-color)',borderRadius:10,padding:'10px 20px',cursor:'pointer',color:'var(--text-secondary)',fontWeight:600 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'white',border:'none',fontWeight:700,fontSize:13,cursor:'pointer' }}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</> : <><i className="fa-solid fa-floppy-disk" />{editRole ? 'Update Role' : 'Create Role'}</>}
          </button>
        </>}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold">Role Name (ID) <span style={{ color:'#dc2626' }}>*</span></label>
            <input className="form-control" value={form.name}
              onChange={e => setForm({...form, name:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')})}
              placeholder="e.g. lab_technician" disabled={editRole && roles.find(r=>r._id===editRole)?.isSystem} />
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Lowercase, no spaces (use _ or -)</div>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Display Label <span style={{ color:'#dc2626' }}>*</span></label>
            <input className="form-control" value={form.label}
              onChange={e => setForm({...form, label:e.target.value})}
              placeholder="e.g. Lab Technician" />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Description</label>
            <input className="form-control" value={form.description}
              onChange={e => setForm({...form, description:e.target.value})}
              placeholder="What does this role do?" />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Role Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {COLOR_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setForm({...form, color:c})}
                  style={{ width:30,height:30,borderRadius:8,background:c,border:form.color===c?`3px solid var(--text-primary)`:'2px solid transparent',cursor:'pointer',transition:'all 0.12s',transform:form.color===c?'scale(1.15)':'scale(1)' }} />
              ))}
              <input type="color" value={form.color} onChange={e => setForm({...form, color:e.target.value})}
                style={{ width:36,height:36,borderRadius:9,border:'1px solid var(--border-color)',cursor:'pointer',padding:2 }} title="Custom color" />
            </div>
          </div>
          {/* Preview */}
          <div className="col-12">
            <div style={{ padding:'12px 16px',borderRadius:10,background:`${form.color}10`,border:`1.5px solid ${form.color}30`,display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:32,height:32,borderRadius:9,background:`${form.color}20`,color:form.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>
                <i className="fa-solid fa-shield-halved" />
              </div>
              <div>
                <div style={{ fontWeight:700,color:form.color,fontSize:14 }}>{form.label||'Role Label'}</div>
                <div style={{ fontSize:11,fontFamily:'monospace',color:'var(--text-muted)' }}>{form.name||'role_name'}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}

RolesPage.getLayout = (page) => <Layout>{page}</Layout>;