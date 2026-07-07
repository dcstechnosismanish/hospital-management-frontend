import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../../utils/api';

// ── Full nav definition ───────────────────────────────────────
const ALL_NAV = [
  {
    section: 'Main',
    items: [
      { href: '/', icon: 'fa-chart-pie', label: 'Dashboard', module: 'dashboard' },
    ],
  },
  {
    section: 'HMS',
    items: [
      { href: '/patients',      icon: 'fa-user-injured',   label: 'Patients',          module: 'patients'      },
      { href: '/doctors',       icon: 'fa-user-md',        label: 'Doctors',           module: 'doctors'       },
      { href: '/appointments',  icon: 'fa-calendar-check', label: 'Appointments',      module: 'appointments'  },
      { href: '/admissions',    icon: 'fa-bed',            label: 'Admissions & Beds', module: 'admissions-beds' },
      { href: '/prescriptions', icon: 'fa-prescription',   label: 'Prescriptions',     module: 'prescriptions'     },
      { href: '/emergency',     icon: 'fa-truck-medical',  label: 'Emergency',         module: 'emergency'         },
      { href: '/laboratory',         icon: 'fa-microscope',     label: 'Laboratory',        module: 'laboratory'        },
      { href: '/laboratory/billing', icon: 'fa-file-invoice',   label: 'Lab Billing',       module: 'lab-billing'       },
    ],
  },
  {
    section: 'Pharmacy',
    items: [
      { href: '/pharmacy',           icon: 'fa-pills',        label: 'Pharmacy',           module: 'pharmacy'         },
      { href: '/pharmacy/stores',    icon: 'fa-store',        label: 'Pharmacy Stores',    module: 'pharmacy-stores'  },
      { href: '/pharmacy/medicines', icon: 'fa-capsules',     label: 'Medicine Inventory', module: 'medicine-inventory' },
      { href: '/pharmacy/billing',   icon: 'fa-file-medical', label: 'Pharmacy Billing',   module: 'pharmacy-billing'   },
    ],
  },
  {
    section: 'Stores',
    items: [
      { href: '/inventory',       icon: 'fa-boxes-stacked', label: 'Inventory',   module: 'inventory'   },
      { href: '/inventory/items', icon: 'fa-box',           label: 'Item Master', module: 'item-master' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/billing', icon: 'fa-file-invoice-dollar', label: 'Billing', module: 'billing' },
    ],
  },
  {
    section: 'Admin',
    items: [
      { href: '/settings/users',       icon: 'fa-users-cog',     label: 'Users',       module: 'users'       },
      { href: '/settings/roles',       icon: 'fa-shield-halved', label: 'Roles',       module: 'roles'       },
      { href: '/settings/permissions', icon: 'fa-key',           label: 'Permissions', module: 'permissions' },
    ],
  },
];

// ── Role badge icon defaults (display only) ───────────────────
const ROLE_BADGE_DEFAULTS = {
  admin:        { icon: 'fa-user-shield'   },
  superadmin:   { icon: 'fa-user-shield'   },
  doctor:       { icon: 'fa-user-doctor'   },
  pharmacist:   { icon: 'fa-pills'         },
  store_manager:{ icon: 'fa-boxes-stacked' },
  receptionist: { icon: 'fa-headset'       },
  nurse:        { icon: 'fa-user-nurse'    },
};

export default function Sidebar({ collapsed, onToggle, onMobileClose }) {
  const router   = useRouter();
  const { user } = useAuth();

  const [roleData, setRoleData] = useState(null);
  const [permMap,  setPermMap]  = useState({});
  const [loading,  setLoading]  = useState(true);

  // ── Load permissions from DB — skip for superadmin ─────────
  useEffect(() => {
    if (!user?.role) return;

    // ✅ Superadmin bypass — show all nav items immediately
    if (user.role === 'superadmin' || user.role === 'admin') {
      setRoleData({ label: 'Super Admin', color: '#ef4444' });
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/roles/my-permissions');
        const found    = data.data;
        if (found && found.permissions) {
          setRoleData(found);
          const map = {};
          (found.permissions || []).forEach(p => { map[p.module] = p; });
          setPermMap(map);
        } else {
          // Role not in DB — show only dashboard
          setPermMap({ dashboard: { read: true, create: false, update: false, delete: false } });
        }
      } catch (e) {
        console.error('Sidebar: failed to load permissions', e.message);
        setPermMap({ dashboard: { read: true, create: false, update: false, delete: false } });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.role]);

  // ── Check nav item access ─────────────────────────────────
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  // Superadmin sees everything; others filtered by DB permMap
  const canAccess = (item) => {
    if (isSuperAdmin) return true;
    // ✅ Explicitly block 'roles' and 'permissions' for non-admins
    if (item.module === 'roles' || item.module === 'permissions') return false;
    const perm = permMap[item.module];
    return perm && perm.read;
  };

  // ── Filter sections ───────────────────────────────────────
  const filteredNav = ALL_NAV
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccess(item)),
    }))
    .filter(section => section.items.length > 0);

  // ── Active Link Logic ────────────────────────────────────
  // We find the longest href that matches the start of the current pathname
  // to ensure specific sub-routes (like /pharmacy/billing) are favored 
  // over parent routes (like /pharmacy).
  const activeHref = (() => {
    let best = '';
    ALL_NAV.forEach(section => {
      section.items.forEach(item => {
        if (item.href === '/') {
          if (router.pathname === '/') best = '/';
        } else if (router.pathname.startsWith(item.href)) {
          if (item.href.length > best.length) best = item.href;
        }
      });
    });
    return best;
  })();

  const isActive = (href) => href === activeHref;

  // ── Badge display ─────────────────────────────────────────
  const badgeColor = roleData?.color || '#6b7280';
  const badgeIcon  = ROLE_BADGE_DEFAULTS[user?.role]?.icon || 'fa-id-badge';
  const badgeLabel = roleData?.label || user?.role || 'User';

  // Count accessible modules (excluding dashboard)
  const moduleCount = filteredNav.reduce(
    (acc, s) => acc + s.items.filter(i => i.href !== '/').length, 0
  );

  // ── Permission summary pills (from real permMap) ──────────
  const hasRead   = Object.values(permMap).some(p => p.read);
  const hasWrite  = Object.values(permMap).some(p => p.create || p.update);
  const hasDelete = Object.values(permMap).some(p => p.delete);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${collapsed ? '' : 'visible'}`}
        onClick={onToggle}
      />

      <aside className={`sidebar ${collapsed ? 'collapsed' : 'open'}`}>

        {/* ── Logo + Collapse Button ── */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <i className="fa-solid fa-hospital-user" />
          </div>
          <div className="sidebar-logo-text">
            <h6 style={{ margin: 0 }}>MediCare ERP</h6>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hospital Management</span>
          </div>
        </div>

        {/* ── User Profile ── */}
        <div className="sidebar-user">
          <div
            className="sidebar-avatar"
            style={{
              background: `linear-gradient(135deg, ${badgeColor}33, ${badgeColor}66)`,
              color: badgeColor,
            }}
          >
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="sidebar-user-text">
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.name || 'User'}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, marginTop: 2,
              background: `${badgeColor}18`, color: badgeColor,
              padding: '2px 8px', borderRadius: 20,
            }}>
              <i className={`fa-solid ${badgeIcon}`} style={{ fontSize: 9 }} />
              {badgeLabel}
            </span>
          </div>
        </div>

        {/* ── Nav Items ── */}
        <div className="sidebar-nav">
          {loading ? (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 60, 70, 55, 65].map((w, i) => (
                <div key={i} style={{
                  height: 34, borderRadius: 9,
                  background: 'var(--hover-bg)',
                  width: `${w}%`,
                  animation: 'skelShimmer 1.4s infinite',
                }} />
              ))}
            </div>
          ) : filteredNav.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fa-solid fa-lock fa-lg" style={{ display: 'block', marginBottom: 8, opacity: 0.3 }} />
              No modules available
            </div>
          ) : (
            filteredNav.map(section => (
              <div key={section.section}>
                <div className="nav-section-title sidebar-section-label">
                  <span className="section-text">{section.section}</span>
                  <span className="section-dot">•</span>
                </div>

                {section.items.map(item => {
                  const active = isActive(item.href);
                  const perm   = permMap[item.module] || {};
                  const caps   = [];
                  if (perm.create) caps.push('Add');
                  if (perm.update) caps.push('Edit');
                  if (perm.delete) caps.push('Delete');
                  const tooltip = caps.length > 0
                    ? `${item.label} · ${caps.join(', ')}`
                    : item.label;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className={`nav-item-link ${active ? 'active' : ''}`}
                      title={tooltip}
                    >
                      <i className={`fa-solid ${item.icon} nav-icon`} />
                      <span className="nav-label">{item.label}</span>
                      {active && <span className="active-dot" />}
                      {!active && (perm.create || perm.update) && (
                        <span className="nav-perm-dot" style={{ background: badgeColor }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Access summary ── */}
        <div className="sidebar-access-info">
          <div style={{
            margin: '12px 14px', padding: '10px 12px', borderRadius: 12,
            background: `${badgeColor}10`, border: `1px solid ${badgeColor}25`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: badgeColor,
              marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <i className={`fa-solid ${badgeIcon}`} />
              {badgeLabel} Access
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {moduleCount} module{moduleCount !== 1 ? 's' : ''} available
            </div>
            {/* ✅ Permission pills from real DB data — no hardcoded admin check */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {isSuperAdmin ? (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                  Full Access
                </span>
              ) : (
                <>
                  {hasRead && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(8,145,178,0.12)', color: '#0891b2' }}>
                      Read
                    </span>
                  )}
                  {hasWrite && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
                      Write
                    </span>
                  )}
                  {hasDelete && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                      Delete
                    </span>
                  )}
                  {!hasRead && !hasWrite && !hasDelete && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>
                      No Access
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </aside>

      <style>{`
        .sidebar-access-info {
          opacity: 1;
          transition: opacity 0.2s;
        }
        .sidebar.collapsed .sidebar-access-info {
          opacity: 0;
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .nav-perm-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-left: auto;
          flex-shrink: 0;
          opacity: 0.6;
        }
        .sidebar.collapsed .nav-perm-dot {
          display: none;
        }
        @keyframes skelShimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.9; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}