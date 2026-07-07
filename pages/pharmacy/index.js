import Layout from '../../components/layout/Layout';
import SEOHead from '../../components/ui/SEOHead';
import StatCard from '../../components/ui/StatCard';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import Link from 'next/link';
import { usePermission } from '../../hooks/usePermission';
import BackButton from '../../components/ui/BackButton'; // ✅ Added

export default function Pharmacy() {
  // ✅ Permission hook
  const { canRead, canCreate, loading: permLoading } = usePermission();

  const [medicines,  setMedicines]  = useState([]);
  const [bills,      setBills]      = useState([]);
  const [stores,     setStores]     = useState([]);
  const [totals,     setTotals]     = useState({ medicines: 0, bills: 0, stores: 0 });
  const [loading,    setLoading]    = useState(true);

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (permLoading) return;
    if (!canRead('pharmacy')) { setLoading(false); return; }
    Promise.all([
      api.get('/medicines'),
      api.get('/pharmacy-bills'),
      canRead('pharmacy-stores') ? api.get('/pharmacy-stores') : Promise.resolve({ data: { data: [], total: 0 } }),
    ]).then(([m, b, s]) => {
      setMedicines(m.data.data  || []);
      setBills(b.data.data      || []);
      setStores(s.data.data     || []);
      setTotals({
        medicines: m.data.total || (m.data.data || []).length,
        bills: b.data.total || (b.data.data || []).length,
        stores: s.data.total || (s.data.data || []).length
      });
    }).finally(() => setLoading(false));
  }, [permLoading, canRead]);

  // ── Stats ──────────────────────────────────────────────────
  const today        = new Date().toDateString();
  const todayBills   = bills.filter(b => new Date(b.createdAt).toDateString() === today);
  const todayRev     = todayBills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const totalRev     = bills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const lowStock     = medicines.filter(m => m.stock <= m.minStockLevel);
  const expiringSoon = medicines.filter(m => {
    if (!m.expiryDate) return false;
    const diff = (new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff > 0;
  });
  const outOfStock = medicines.filter(m => m.stock === 0);

  const statCards = [
    {
      icon: 'fa-pills', label: 'Total Medicines', value: totals.medicines,
      color: '#16a34a', sub: 'Active items in inventory',
      change: `${outOfStock.length} out of stock`,
      changeType: outOfStock.length > 0 ? 'down' : 'neutral', delay: 0,
    },
    {
      icon: 'fa-triangle-exclamation', label: 'Low Stock Alerts', value: lowStock.length,
      color: '#dc2626', sub: 'Below minimum level',
      change: lowStock.length > 0 ? 'Reorder needed' : 'All stocked',
      changeType: lowStock.length > 0 ? 'down' : 'neutral', delay: 1,
    },
    {
      icon: 'fa-calendar-day', label: "Today's Sales", value: todayBills.length,
      color: '#7c3aed', sub: 'Bills generated today',
      change: `₹${todayRev.toLocaleString('en-IN')}`, changeType: 'up', delay: 2,
    },
    {
      icon: 'fa-indian-rupee-sign', label: 'Total Revenue', value: totalRev,
      color: '#059669', prefix: '₹', sub: 'All time pharmacy sales',
      change: 'Collected', changeType: 'up', delay: 3,
    },
    {
      icon: 'fa-clock-rotate-left', label: 'Expiring Soon', value: expiringSoon.length,
      color: '#d97706', sub: 'Within next 30 days',
      change: expiringSoon.length > 0 ? 'Check stock' : 'All good',
      changeType: expiringSoon.length > 0 ? 'down' : 'neutral', delay: 4,
    },
    {
      icon: 'fa-store', label: 'Total Pharmacies', value: totals.stores,
      color: '#0891b2', sub: 'Active pharmacy branches',
      change: 'Manage stores', changeType: 'neutral', delay: 5,
    },
  ];

  const recentBills = bills.slice(-5).reverse();
  const CATEGORY_COLORS = {
    Tablet: '#16a34a', Syrup: '#0891b2', Injection: '#dc2626',
    Capsule: '#7c3aed', Cream: '#d97706', Drops: '#059669',
  };

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Pharmacy" path="/pharmacy" />
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

  // ✅ Access Denied screen
  if (!canRead('pharmacy')) {
    return (
      <>
        <SEOHead title="Pharmacy" path="/pharmacy" />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view Pharmacy.</p>
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Pharmacy" path="/pharmacy" />
      <div>

        {/* ── Header ── */}
        <div className="d-flex align-items-center justify-content-between mb-4"
          style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <div>
              <h4 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', margin: 0 }}>
                <i className="fa-solid fa-pills me-3" style={{ color: 'var(--primary)' }} />Pharmacy
              </h4>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
                {totals.medicines} medicines · {totals.bills} total bills · {totals.stores} stores
              </p>
            </div>
          </div>
          {canRead('pharmacy-stores') && (
            <Link href="/pharmacy/stores" className="btn-primary-custom" style={{ textDecoration: 'none' }}>
              <i className="fa-solid fa-store" /> Manage Pharmacies
            </Link>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-cards-grid mb-4">
          {statCards.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* ── Content Panels ── */}
        <div className="row g-4">

          {/* ── Low Stock Alert ── */}
          <div className="col-lg-6">
            <div className="content-card">
              <div className="card-header-custom">
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-triangle-exclamation me-2" style={{ color: '#dc2626' }} />
                  Low Stock Alert
                </h6>
                <Link href="/pharmacy/medicines"
                  style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Manage →
                </Link>
              </div>

              {/* ✅ Skeleton while loading */}
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div className="skel" style={{ width: 140, height: 13, borderRadius: 6 }} />
                      <div className="skel" style={{ width: 40, height: 13, borderRadius: 6 }} />
                    </div>
                    <div className="skel" style={{ height: 4, borderRadius: 10 }} />
                  </div>
                ))
              ) : lowStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#16a34a' }}>
                  <i className="fa-solid fa-circle-check fa-2x d-block mb-2" />
                  All medicines are well stocked!
                </div>
              ) : (
                lowStock.slice(0, 6).map(m => {
                  const pct = Math.min(100, Math.round((m.stock / Math.max(m.minStockLevel * 2, 1)) * 100));
                  return (
                    <div key={m._id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{m.category}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 900, fontSize: 16, color: m.stock === 0 ? '#dc2626' : '#d97706' }}>{m.stock}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{m.unit}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct < 25 ? '#dc2626' : '#d97706', borderRadius: 10, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Min: {m.minStockLevel} {m.unit}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Recent Bills ── */}
          <div className="col-lg-6">
            <div className="content-card">
              <div className="card-header-custom">
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-file-medical me-2" style={{ color: 'var(--primary)' }} />
                  Recent Bills
                </h6>
                <Link href="/pharmacy/billing"
                  style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  View all →
                </Link>
              </div>

              {/* ✅ Skeleton while loading */}
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="skel" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skel" style={{ width: '60%', height: 13, borderRadius: 6, marginBottom: 6 }} />
                      <div className="skel" style={{ width: '40%', height: 11, borderRadius: 6 }} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="skel" style={{ width: 60, height: 13, borderRadius: 6, marginBottom: 6 }} />
                      <div className="skel" style={{ width: 40, height: 11, borderRadius: 6 }} />
                    </div>
                  </div>
                ))
              ) : recentBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No bills yet
                </div>
              ) : (
                recentBills.map(b => (
                  <div key={b._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-file-medical" style={{ color: 'var(--primary)', fontSize: 15 }} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.patient?.name || b.patientName || 'Walk-in'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {b.billNumber} · {new Date(b.createdAt).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                        ₹{b.totalAmount?.toLocaleString('en-IN')}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                        background: b.paymentStatus === 'paid' ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)',
                        color: b.paymentStatus === 'paid' ? '#16a34a' : '#d97706',
                      }}>
                        {b.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Stock by Category ── */}
          <div className="col-lg-6">
            <div className="content-card">
              <div className="card-header-custom">
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-chart-pie me-2" style={{ color: '#7c3aed' }} />
                  Stock by Category
                </h6>
              </div>

              {/* ✅ Skeleton while loading */}
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div className="skel" style={{ width: 100, height: 13, borderRadius: 6 }} />
                      <div className="skel" style={{ width: 70, height: 13, borderRadius: 6 }} />
                    </div>
                    <div className="skel" style={{ height: 5, borderRadius: 10 }} />
                  </div>
                ))
              ) : (() => {
                const cats  = medicines.reduce((acc, m) => { acc[m.category] = (acc[m.category] || 0) + 1; return acc; }, {});
                const total = medicines.length || 1;
                return Object.entries(cats).map(([cat, count]) => {
                  const color = CATEGORY_COLORS[cat] || '#6b7280';
                  const pct   = Math.round((count / total) * 100);
                  return (
                    <div key={cat} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{cat}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} items ({pct}%)</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 10, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* ── Expiring Soon ── */}
          <div className="col-lg-6">
            <div className="content-card">
              <div className="card-header-custom">
                <h6 style={{ margin: 0, fontWeight: 700 }}>
                  <i className="fa-solid fa-clock me-2" style={{ color: '#d97706' }} />
                  Expiring Soon (30 days)
                </h6>
              </div>

              {/* ✅ Skeleton while loading */}
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="skel" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skel" style={{ width: '55%', height: 13, borderRadius: 6, marginBottom: 6 }} />
                      <div className="skel" style={{ width: '70%', height: 11, borderRadius: 6 }} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="skel" style={{ width: 50, height: 13, borderRadius: 6, marginBottom: 6 }} />
                      <div className="skel" style={{ width: 60, height: 11, borderRadius: 6 }} />
                    </div>
                  </div>
                ))
              ) : expiringSoon.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#16a34a', fontSize: 13 }}>
                  <i className="fa-solid fa-circle-check fa-2x d-block mb-2" />
                  No medicines expiring soon
                </div>
              ) : (
                expiringSoon.slice(0, 5).map(m => {
                  const days = Math.round((new Date(m.expiryDate) - new Date()) / 86400000);
                  return (
                    <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="fa-solid fa-clock" style={{ color: '#d97706', fontSize: 15 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Batch: {m.batchNumber || 'N/A'} · Stock: {m.stock}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: days <= 10 ? '#dc2626' : '#d97706' }}>
                          {days}d left
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(m.expiryDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .stat-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 1200px) { .stat-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stat-cards-grid { grid-template-columns: 1fr; } }
        .btn-secondary-custom {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--hover-bg); border: 1.5px solid var(--border-color);
          color: var(--text-secondary); padding: 10px 18px; border-radius: 12px;
          font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary-custom:hover { border-color: var(--primary); color: var(--primary); }
        .skel {
          background: linear-gradient(90deg, var(--hover-bg) 25%, var(--border-color) 50%, var(--hover-bg) 75%);
          background-size: 200% 100%;
          animation: skelShimmer 1.4s infinite;
        }
        @keyframes skelShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>
    </>
  );
}

Pharmacy.getLayout = (page) => <Layout>{page}</Layout>;