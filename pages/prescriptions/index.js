import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/router';
import { usePermission } from '../../hooks/usePermission'; // ✅ Added
import BackButton from '../../components/ui/BackButton';
import { formatDate } from '../../utils/dateUtils';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';
import { confirmAction } from '../../utils/sweetAlert';

const STATUS_COLOR = {
  active:    { c: '#0891b2', bg: 'rgba(8,145,178,0.1)'  },
  completed: { c: '#16a34a', bg: 'rgba(22,163,74,0.1)'  },
  cancelled: { c: '#dc2626', bg: 'rgba(220,38,38,0.1)'  },
};

const formatDoctorName = (name) => {
  if (!name) return '—';
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
};

export default function PrescriptionList() {
  const { user }  = useAuth();
  const router    = useRouter();

  // ✅ Permission hook
  const { canRead, canCreate, canUpdate, canDelete, loading: permLoading } = usePermission();

  const [list,     setList]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [limit,    setLimit]    = useState(15);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState({ status: '', dispensed: '' });
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);

  // ✅ Action flags based ONLY on DB permissions (superadmin bypasses via hook)
  const showCreate   = !permLoading && canCreate('prescriptions');
  const showDispense = !permLoading && canUpdate('prescriptions');
  const showEdit     = !permLoading && canUpdate('prescriptions');
  const showDelete   = !permLoading && canDelete('prescriptions');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search)               params.set('search',    search);
      if (filter.status)        params.set('status',    filter.status);
      if (filter.dispensed !== '') params.set('dispensed', filter.dispensed);
      const { data } = await api.get(`/prescriptions?${params}`);
      setList(data.data  || []);
      setTotal(data.total || 0);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, limit]);

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('prescriptions')) { setLoading(false); return; }
    fetchList();
  }, [fetchList, permLoading]);

  const handleDelete = async (id) => {
    // ✅ Double-check delete permission
    if (!canDelete('prescriptions')) return toast.error('You do not have permission to delete prescriptions.');
    if (!await confirmAction('Delete Prescription?', 'Delete this prescription?', 'Yes, delete')) return;
    setDeleting(id);
    try {
      await api.delete(`/prescriptions/${id}`);
      fetchList();
    } catch (e) {
      toast.error(e.friendlyMessage || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleDispense = async (id) => {
    // ✅ Double-check dispense (update) permission
    if (!canUpdate('prescriptions')) return toast.error('You do not have permission to dispense prescriptions.');
    try {
      await api.patch(`/prescriptions/${id}/dispense`);
      fetchList();
    } catch (e) {
      toast.error(e.friendlyMessage || 'Failed');
    }
  };

  const totalPages = Math.ceil(total / 15);

  // ── Actions column visibility: show only if at least one action can appear
  const showActionsCol = true; // View is always visible; conditionals inside

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Prescriptions" path="/prescriptions" />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', flexDirection: 'column', gap: 14,
        }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#7c3aed' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Checking permissions…</div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!canRead('prescriptions')) {
    return (
      <>
        <SEOHead title="Prescriptions" path="/prescriptions" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Prescriptions.</p>
          <Link href="/"
            style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Prescriptions" path="/prescriptions" />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div className="d-flex align-items-center gap-3">
          <BackButton />
          <div>
            <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 17 }}>
                <i className="fa-solid fa-prescription" />
              </span>
              Prescriptions
            </h4>
            <p style={{ margin: '4px 0 0 48px', fontSize: 13, color: 'var(--text-muted)' }}>
              {total} prescription{total !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
        {/* ✅ New Prescription — only if showCreate */}
        {showCreate && (
          <Link href="/prescriptions/new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(124,58,237,0.35)', transition: 'all 0.2s' }}>
            <i className="fa-solid fa-plus" />New Prescription
          </Link>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="content-card mb-4" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Rx No…"
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {[
            { label: 'Status',    key: 'status',    opts: [['','All Status'],['active','Active'],['completed','Completed'],['cancelled','Cancelled']] },
            { label: 'Dispensed', key: 'dispensed', opts: [['','All'],['false','Pending'],['true','Dispensed']] },
          ].map(f => (
            <select
              key={f.key}
              value={filter[f.key]}
              onChange={e => { setFilter(p => ({ ...p, [f.key]: e.target.value })); setPage(1); }}
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', minWidth: 140 }}
            >
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <button
            onClick={() => { setSearch(''); setFilter({ status: '', dispensed: '' }); setPage(1); }}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            <i className="fa-solid fa-rotate me-1" />Reset
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg)', borderBottom: '2px solid var(--border-color)' }}>
                {['Rx No','Patient','Doctor','Date','Medicines','Visit','Status','Dispensed','Actions'].map(h => (
                  <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div className="skel" style={{ height: 14, borderRadius: 6, width: j === 0 ? 90 : j === 7 ? 60 : '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <i className="fa-regular fa-file-medical fa-2x" style={{ display: 'block', marginBottom: 10, opacity: 0.35 }} />
                    <div style={{ fontWeight: 600 }}>No prescriptions found</div>
                    {/* ✅ Empty state CTA — only if showCreate */}
                    {showCreate && (
                      <Link href="/prescriptions/new"
                        style={{ display: 'inline-block', marginTop: 12, padding: '8px 18px', borderRadius: 9, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                        + Create First Prescription
                      </Link>
                    )}
                  </td>
                </tr>
              ) : list.map((rx) => {
                const sc = STATUS_COLOR[rx.status] || STATUS_COLOR.active;
                return (
                  <tr key={rx._id}
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Rx No */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#7c3aed', fontFamily: 'monospace' }}>
                        {rx.prescriptionNo || '—'}
                      </span>
                    </td>

                    {/* Patient */}
                    <td style={{ padding: '14px 16px', minWidth: 140 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{rx.patient?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.patient?.patientId || ''}</div>
                    </td>

                    <td style={{ padding: '14px 16px', minWidth: 130 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{formatDoctorName(rx.doctor?.name)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.doctor?.specialization || ''}</div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {formatDate(rx.date)}
                      </div>
                    </td>

                    {/* Medicines */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rx.medicines?.length || 0}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                        drug{rx.medicines?.length !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Visit */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(8,145,178,0.1)', color: '#0891b2' }}>
                        {rx.visitType || 'OPD'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.c, textTransform: 'capitalize' }}>
                        {rx.status}
                      </span>
                    </td>

                    {/* Dispensed */}
                    <td style={{ padding: '14px 16px' }}>
                      {rx.dispensed ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                          ✓ Done
                        </span>
                      ) : showDispense ? (
                        // ✅ Dispense button — only if showDispense
                        <button
                          onClick={() => handleDispense(rx._id)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid #d97706', background: 'rgba(217,119,6,0.08)', color: '#d97706', cursor: 'pointer' }}
                        >
                          Dispense
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* View — always visible to anyone who can read */}
                        <button
                          onClick={() => router.push(`/prescriptions/${rx._id}`)}
                          title="View"
                          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: '#0891b2', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <i className="fa-solid fa-eye" />
                        </button>

                        {/* ✅ Edit — only if showEdit */}
                        {showEdit && (
                          <button
                            onClick={() => router.push(`/prescriptions/${rx._id}/edit`)}
                            title="Edit"
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: '#d97706', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        )}

                        {/* ✅ Delete — only if showDelete */}
                        {showDelete && (
                          <button
                            onClick={() => handleDelete(rx._id)}
                            disabled={deleting === rx._id}
                            title="Delete"
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', cursor: deleting === rx._id ? 'not-allowed' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {deleting === rx._id
                              ? <i className="fa-solid fa-spinner fa-spin" />
                              : <i className="fa-solid fa-trash" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination 
          page={page} 
          total={total} 
          limit={limit} 
          onPageChange={setPage} 
          onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
        />
      </div>

      <style>{`
        .skel { background: linear-gradient(90deg, var(--hover-bg) 25%, var(--border-color) 50%, var(--hover-bg) 75%); background-size: 200% 100%; animation: sk 1.4s infinite; border-radius: 6px; }
        @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </>
  );
}

PrescriptionList.getLayout = (page) => <Layout>{page}</Layout>;