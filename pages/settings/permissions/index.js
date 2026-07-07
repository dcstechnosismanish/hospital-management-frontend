import Layout from '../../../components/layout/Layout';
import SEOHead from '../../../components/ui/SEOHead';
import { useEffect, useState, useCallback } from 'react';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../../hooks/usePermission';

const ACTIONS = ['read','create','update','delete'];
const ACTION_META = {
  read:   { icon:'fa-eye',           color:'#0891b2', label:'Read'   },
  create: { icon:'fa-plus-circle',   color:'#16a34a', label:'Create' },
  update: { icon:'fa-pen',           color:'#d97706', label:'Update' },
  delete: { icon:'fa-trash',         color:'#dc2626', label:'Delete' },
};
const MODULE_ICONS = {
  dashboard:'fa-gauge-high', patients:'fa-user-injured', doctors:'fa-user-doctor', appointments:'fa-calendar-check',
  'admissions-beds':'fa-bed', 'prescriptions':'fa-prescription',
  'pharmacy':'fa-pills', 'medicine-inventory':'fa-capsules', 'pharmacy-billing':'fa-file-medical',
  'inventory':'fa-boxes-stacked', 'item-master':'fa-box',
  'billing':'fa-file-invoice-dollar', 'users':'fa-users-cog', 'roles':'fa-shield-halved', 'permissions':'fa-key',
  'laboratory':'fa-microscope', 'emergency':'fa-truck-medical', 'pharmacy-stores':'fa-store', 'lab-billing':'fa-file-invoice',
};

export default function PermissionsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { canRead, canUpdate, loading: permLoading } = usePermission();

  const [roles,       setRoles]       = useState([]);
  const [modules,     setModules]     = useState([]);
  const [activeRole,  setActiveRole]  = useState(null); // role object
  const [perms,       setPerms]       = useState({});   // { moduleName: { read, create, update, delete } }
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [changed,     setChanged]     = useState(false);
  const [search,      setSearch]      = useState('');

  // Load roles + modules
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('permissions')) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      try {
        const [rRes, mRes] = await Promise.all([
          api.get('/roles'),
          api.get('/roles/modules'),
        ]);
        const roleList   = rRes.data.data  || [];
        const moduleList = mRes.data.data  || [];
        setRoles(roleList);
        setModules(moduleList);

        // Pre-select role from query param or first role
        const qRole = router.query.role;
        const init  = qRole ? roleList.find(r => r._id === qRole) || roleList[0] : roleList[0];
        if (init) selectRole(init, moduleList);
      } catch { toast.error('Failed to load'); }
      finally { setLoading(false); }
    };
    load();
  }, [router.query.role, permLoading]);

  const selectRole = (role, modList = modules) => {
    setActiveRole(role);
    setChanged(false);
    // Build perms map from role.permissions
    const map = {};
    (modList.length ? modList : modules).forEach(mod => {
      const found = role.permissions?.find(p => p.module === mod) || {};
      map[mod] = {
        read:   !!found.read,
        create: !!found.create,
        update: !!found.update,
        delete: !!found.delete,
      };
    });
    setPerms(map);
  };

  // Toggle single permission
  const toggle = (mod, action) => {
    setPerms(prev => ({ ...prev, [mod]: { ...prev[mod], [action]: !prev[mod][action] } }));
    setChanged(true);
  };

  // Toggle entire row (all actions for one module)
  const toggleRow = (mod) => {
    const allOn = ACTIONS.every(a => perms[mod]?.[a]);
    setPerms(prev => ({ ...prev, [mod]: { read:!allOn, create:!allOn, update:!allOn, delete:!allOn } }));
    setChanged(true);
  };

  // Toggle entire column (one action for all modules)
  const toggleCol = (action, targetMods) => {
    const allOn = targetMods.every(m => perms[m]?.[action]);
    const updated = { ...perms };
    targetMods.forEach(m => { updated[m] = { ...updated[m], [action]: !allOn }; });
    setPerms(updated);
    setChanged(true);
  };

  // Select / Deselect all
  const toggleAll = (val, targetMods) => {
    const updated = { ...perms };
    targetMods.forEach(m => { updated[m] = { read:val, create:val, update:val, delete:val }; });
    setPerms(updated);
    setChanged(true);
  };

  // Set read-only for all modules
  const setReadOnly = (targetMods) => {
    const updated = { ...perms };
    targetMods.forEach(m => { updated[m] = { read:true, create:false, update:false, delete:false }; });
    setPerms(updated);
    setChanged(true);
  };

  // Save
  const handleSave = async () => {
    if (!activeRole) return;
    if (!canUpdate('permissions')) return toast.error('No permission to update permissions');
    setSaving(true);
    try {
      const permissions = modules.map(mod => ({
        module: mod,
        ...perms[mod],
      }));
      await api.put(`/roles/${activeRole._id}`, { permissions });
      toast.success(`Permissions saved for ${activeRole.label}!`);
      setChanged(false);
      // Refresh role data
      const { data } = await api.get(`/roles/${activeRole._id}`);
      setActiveRole(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const activeRoleIsAdmin = activeRole?.name === 'admin' || activeRole?.name === 'superadmin';

  const filteredMods = modules.filter(m => {
    // ✅ Hide 'permissions' and 'roles' from the list if the role being configured is not an admin
    if (!activeRoleIsAdmin && (m === 'permissions' || m === 'roles')) return false;
    return !search || m.toLowerCase().includes(search.toLowerCase());
  });

  // Stats for active role
  const totalOn  = filteredMods.reduce((acc, m) => acc + ACTIONS.filter(a => perms[m]?.[a]).length, 0);
  const totalAll = filteredMods.length * ACTIONS.length;
  const pct      = totalAll > 0 ? Math.round((totalOn / totalAll) * 100) : 0;

  return (
    <>
      <SEOHead title="Permissions" path="/settings/permissions" />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Link href="/settings/roles"
              style={{ width:32,height:32,borderRadius:9,border:'1px solid var(--border-color)',background:'var(--hover-bg)',color:'var(--text-secondary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,textDecoration:'none' }}>
              <i className="fa-solid fa-arrow-left" />
            </Link>
            <h4 style={{ fontWeight:900, fontSize:24, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#0891b2,#0e7490)',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:18 }}>
                <i className="fa-solid fa-key" />
              </span>
              Permissions
            </h4>
          </div>
          <p style={{ color:'var(--text-muted)', margin:'4px 0 0 82px', fontSize:13 }}>
            Module-wise CRUD permissions per role
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {changed && (
            <span style={{ fontSize:12,fontWeight:700,color:'#d97706',display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(217,119,6,0.1)',borderRadius:8 }}>
              <i className="fa-solid fa-circle-exclamation" />Unsaved changes
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !changed || !activeRole || !canUpdate('permissions')}
            style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,background:(changed && canUpdate('permissions'))?'linear-gradient(135deg,#0891b2,#0e7490)':'var(--hover-bg)',color:(changed && canUpdate('permissions'))?'white':'var(--text-muted)',border:'none',fontWeight:700,fontSize:13,cursor:changed&&!saving&&canUpdate('permissions')?'pointer':'not-allowed',boxShadow:changed&&canUpdate('permissions')?'0 4px 14px rgba(8,145,178,0.3)':'none',transition:'all 0.2s' }}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</> : <><i className="fa-solid fa-floppy-disk" />Save Permissions</>}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems:'start' }}>

        {/* ── Left: Role selector ── */}
        <div className="content-card" style={{ padding:'16px', position:'sticky', top:80 }}>
          <div style={{ fontSize:11,fontWeight:800,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.6,marginBottom:12 }}>
            Select Role
          </div>
          {loading ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" />
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {roles.map(role => {
                const isActive = activeRole?._id === role._id;
                return (
                  <button key={role._id} onClick={() => selectRole(role)}
                    style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,border:`1.5px solid ${isActive?role.color:'transparent'}`,background:isActive?`${role.color}10`:'transparent',cursor:'pointer',textAlign:'left',transition:'all 0.15s',width:'100%' }}>
                    <div style={{ width:10,height:10,borderRadius:'50%',background:role.color,flexShrink:0 }} />
                    <div style={{ flex:1,overflow:'hidden' }}>
                      <div style={{ fontWeight:700,fontSize:13,color:isActive?role.color:'var(--text-primary)',textTransform:'capitalize' }}>{role.label}</div>
                      <div style={{ fontSize:10,fontFamily:'monospace',color:'var(--text-muted)' }}>{role.name}</div>
                    </div>
                    {role.isSystem && (
                      <span style={{ fontSize:9,fontWeight:700,color:'#6b7280',background:'var(--hover-bg)',padding:'2px 6px',borderRadius:12 }}>SYS</span>
                    )}
                    {isActive && <i className="fa-solid fa-chevron-right" style={{ fontSize:10,color:role.color }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Permissions matrix ── */}
        <div>
          {activeRole ? (
            <>
              {/* Role info bar */}
              <div style={{ padding:'16px 20px', borderRadius:14, background:`${activeRole.color}08`, border:`1.5px solid ${activeRole.color}25`, marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:`${activeRole.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:activeRole.color }}>
                    <i className="fa-solid fa-shield-halved" />
                  </div>
                  <div>
                    <div style={{ fontWeight:900,fontSize:16,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:8 }}>
                      {activeRole.label}
                      {activeRole.isSystem && <span style={{ fontSize:10,fontWeight:700,background:'var(--hover-bg)',color:'#6b7280',padding:'2px 8px',borderRadius:20 }}>System Role</span>}
                    </div>
                    <div style={{ fontSize:12,color:'var(--text-muted)',marginTop:2 }}>{activeRole.description||activeRole.name}</div>
                  </div>
                </div>
                {/* Usage bar */}
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12,fontWeight:700,color:activeRole.color,marginBottom:4 }}>
                    {totalOn} / {totalAll} permissions ({pct}%)
                  </div>
                  <div style={{ width:160,height:7,borderRadius:20,background:'var(--border-color)',overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`,height:'100%',borderRadius:20,background:`linear-gradient(90deg,${activeRole.color},${activeRole.color}aa)`,transition:'width 0.4s' }} />
                  </div>
                </div>
              </div>

              {/* Quick action buttons */}
              {canUpdate('permissions') && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                  <button onClick={() => toggleAll(true, filteredMods)}
                    style={{ padding:'7px 14px',borderRadius:9,border:'1px solid rgba(22,163,74,0.3)',background:'rgba(22,163,74,0.07)',color:'#16a34a',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                    <i className="fa-solid fa-check-double" />Grant All
                  </button>
                  <button onClick={() => toggleAll(false, filteredMods)}
                    disabled={activeRole.name === 'superadmin' && currentUser?.role === 'superadmin'}
                    style={{ padding:'7px 14px',borderRadius:9,border:'1px solid rgba(220,38,38,0.3)',background:'rgba(220,38,38,0.07)',color:'#dc2626',fontSize:12,fontWeight:700,cursor: (activeRole.name === 'superadmin' && currentUser?.role === 'superadmin') ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',gap:6, opacity: (activeRole.name === 'superadmin' && currentUser?.role === 'superadmin') ? 0.5 : 1 }}>
                    <i className="fa-solid fa-ban" />Revoke All
                  </button>
                  <button onClick={() => setReadOnly(filteredMods)}
                    disabled={activeRole.name === 'superadmin' && currentUser?.role === 'superadmin'}
                    style={{ padding:'7px 14px',borderRadius:9,border:'1px solid rgba(8,145,178,0.3)',background:'rgba(8,145,178,0.07)',color:'#0891b2',fontSize:12,fontWeight:700,cursor: (activeRole.name === 'superadmin' && currentUser?.role === 'superadmin') ? 'not-allowed' : 'pointer',display:'flex',alignItems:'center',gap:6, opacity: (activeRole.name === 'superadmin' && currentUser?.role === 'superadmin') ? 0.5 : 1 }}>
                    <i className="fa-solid fa-eye" />Read Only
                  </button>
                  <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ position:'relative' }}>
                      <i className="fa-solid fa-search" style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:11 }} />
                      <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filter modules…"
                        style={{ width:'100%',padding:'7px 10px 7px 30px',borderRadius:9,border:'1px solid var(--border-color)',background:'var(--hover-bg)',color:'var(--text-primary)',fontSize:12,outline:'none' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Permissions table */}
              <div className="content-card" style={{ padding:0, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--hover-bg)', borderBottom:'2px solid var(--border-color)' }}>
                      <th style={{ padding:'13px 16px', textAlign:'left', fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.5, width:'40%' }}>
                        Module
                        <span style={{ marginLeft:8,fontWeight:600,color:'var(--text-muted)',textTransform:'none',letterSpacing:0,fontSize:11 }}>
                          ({filteredMods.length})
                        </span>
                      </th>
                      {ACTIONS.map(action => {
                        const meta   = ACTION_META[action];
                        const allOn  = filteredMods.every(m => perms[m]?.[action]);
                        return (
                          <th key={action} style={{ padding:'13px 8px', textAlign:'center', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, color:meta.color }}>
                            <button onClick={() => canUpdate('permissions') && toggleCol(action, filteredMods)}
                              disabled={!canUpdate('permissions')}
                              style={{ display:'inline-flex',flexDirection:'column',alignItems:'center',gap:4,background:'transparent',border:'none',cursor:canUpdate('permissions')?'pointer':'not-allowed',color:'inherit',padding:'4px 8px',borderRadius:8,transition:'background 0.15s' }}
                              title={`Toggle all ${action}`}>
                              <i className={`fa-solid ${meta.icon}`} style={{ fontSize:14 }} />
                              <span style={{ fontSize:10 }}>{meta.label}</span>
                              <div style={{ width:14,height:14,borderRadius:4,border:`2px solid ${meta.color}`,background:allOn?meta.color:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
                                {allOn && <i className="fa-solid fa-check" style={{ fontSize:8,color:'white' }} />}
                              </div>
                            </button>
                          </th>
                        );
                      })}
                      <th style={{ padding:'13px 8px', textAlign:'center', fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.5 }}>All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMods.map((mod, idx) => {
                      const rowAllOn  = ACTIONS.every(a => perms[mod]?.[a]);
                      const rowSomeOn = ACTIONS.some(a => perms[mod]?.[a]);
                      const icon      = MODULE_ICONS[mod] || 'fa-circle';
                      return (
                        <tr key={mod} style={{ borderBottom:'1px solid var(--border-color)', background:idx%2===0?'transparent':'rgba(0,0,0,0.01)', transition:'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--hover-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background=idx%2===0?'transparent':'rgba(0,0,0,0.01)'}>

                          {/* Module name */}
                          <td style={{ padding:'13px 16px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:32,height:32,borderRadius:9,background:rowSomeOn?`${activeRole.color}12`:'var(--hover-bg)',color:rowSomeOn?activeRole.color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,transition:'all 0.15s' }}>
                                <i className={`fa-solid ${icon}`} />
                              </div>
                              <div>
                                <div style={{ fontWeight:700,fontSize:13,color:'var(--text-primary)',textTransform:'capitalize' }}>
                                  {mod === 'admissions-beds' ? 'Admissions & Beds' : mod.replace(/-/g,' ')}
                                </div>
                                <div style={{ fontSize:10,color:'var(--text-muted)',fontFamily:'monospace' }}>{mod}</div>
                              </div>
                            </div>
                          </td>

                          {/* CRUD toggles */}
                          {ACTIONS.map(action => {
                            const isOn = !!perms[mod]?.[action];
                            const meta = ACTION_META[action];
                            const isSuperAdminEditingOwn = activeRole.name === 'superadmin' && currentUser?.role === 'superadmin';
                            
                            // ✅ Restriction: Only 'read' allowed for 'users' module for non-admin roles
                            const isUsersModuleRestricted = mod === 'users' && !activeRoleIsAdmin && action !== 'read';

                            return (
                              <td key={action} style={{ padding:'13px 8px', textAlign:'center' }}>
                                {isUsersModuleRestricted ? (
                                  <div style={{ width:36, height:36, display:'inline-flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', opacity:0.3 }} 
                                    title="Only 'Read' allowed for non-admin roles">
                                    <i className="fa-solid fa-ban" />
                                  </div>
                                ) : (
                                  <button onClick={() => !isSuperAdminEditingOwn && canUpdate('permissions') && toggle(mod, action)}
                                    disabled={(isSuperAdminEditingOwn && isOn) || !canUpdate('permissions')}
                                    title={isSuperAdminEditingOwn && isOn ? "You cannot revoke superadmin permissions" : !canUpdate('permissions') ? "No permission to edit" : `${isOn?'Revoke':'Grant'} ${action} on ${mod}`}
                                    style={{ 
                                      width:36,height:36,borderRadius:9,
                                      border:`2px solid ${isOn?meta.color:' var(--border-color)'}`,
                                      background:isOn?`${meta.color}12`:'transparent',
                                      color:isOn?meta.color:'var(--text-muted)',
                                      cursor: ((isSuperAdminEditingOwn && isOn) || !canUpdate('permissions')) ? 'not-allowed' : 'pointer',
                                      display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:14,transition:'all 0.15s',
                                      transform:isOn?'scale(1.05)':'scale(1)',
                                      opacity: ((isSuperAdminEditingOwn && isOn) || !canUpdate('permissions')) ? 0.7 : 1
                                    }}>
                                    <i className={`fa-solid ${isOn?'fa-check':'fa-xmark'}`} />
                                  </button>
                                )}
                              </td>
                            );
                          })}

                          {/* Row toggle — all on/off */}
                          <td style={{ padding:'13px 8px', textAlign:'center' }}>
                            <button onClick={() => {
                              if (!canUpdate('permissions')) return toast.error('No permission to update permissions');
                              const isSuperAdminEditingOwn = activeRole.name === 'superadmin' && currentUser?.role === 'superadmin';
                              if (isSuperAdminEditingOwn && rowAllOn) {
                                toast.error("You cannot revoke Super Admin permissions");
                                return;
                              }
                              toggleRow(mod);
                            }}
                              disabled={!canUpdate('permissions')}
                              title={rowAllOn?'Revoke all for this module':'Grant all for this module'}
                              style={{ 
                                width:36,height:36,borderRadius:9,
                                border:`2px solid ${rowAllOn?activeRole.color:' var(--border-color)'}`,
                                background:rowAllOn?`${activeRole.color}12`:'transparent',
                                color:rowAllOn?activeRole.color:'var(--text-muted)',
                                cursor:canUpdate('permissions')?'pointer':'not-allowed',
                                display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:14,transition:'all 0.15s',
                                transform:rowAllOn?'scale(1.05)':'scale(1)',
                                opacity:canUpdate('permissions')?1:0.7 
                              }}>
                              <i className={`fa-solid ${rowAllOn?'fa-check':'fa-xmark'}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save bar */}
              {changed && canUpdate('permissions') && (
                <div style={{ position:'sticky',bottom:20,marginTop:16,padding:'14px 20px',borderRadius:14,background:'var(--card-bg)',border:'1.5px solid #d97706',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,zIndex:10 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#d97706' }}>
                    <i className="fa-solid fa-triangle-exclamation" />
                    You have unsaved permission changes for <strong>{activeRole.label}</strong>
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    <button onClick={() => selectRole(activeRole)}
                      style={{ padding:'8px 16px',borderRadius:9,border:'1px solid var(--border-color)',background:'var(--hover-bg)',color:'var(--text-secondary)',fontWeight:600,fontSize:12,cursor:'pointer' }}>
                      Discard
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius:9,background:'linear-gradient(135deg,#0891b2,#0e7490)',color:'white',border:'none',fontWeight:700,fontSize:12,cursor:'pointer' }}>
                      {saving ? <><i className="fa-solid fa-spinner fa-spin" />Saving…</> : <><i className="fa-solid fa-floppy-disk" />Save Now</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:'center',padding:'80px 0',color:'var(--text-muted)' }}>
              <i className="fa-solid fa-arrow-left fa-2x" style={{ display:'block',marginBottom:16,opacity:0.3 }} />
              <div style={{ fontWeight:600,fontSize:14 }}>Select a role to manage permissions</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

PermissionsPage.getLayout = (page) => <Layout>{page}</Layout>;