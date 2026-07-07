import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import SEOHead from '../../../components/ui/SEOHead';
import InvoicePrint from '../../../components/billing/InvoicePrint';
import api from '../../../utils/api';
import Layout from '../../../components/layout/Layout';
import Link from 'next/link';                                // ✅ Added
import { usePermission } from '../../../hooks/usePermission'; // ✅ Added

export default function InvoicePage() {
  const router   = useRouter();
  const { id }   = router.query;
  const printRef = useRef();

  // ✅ Permission hook
  const { canRead, loading: permLoading } = usePermission();

  const [bill,    setBill]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Wait for permissions before fetching
  useEffect(() => {
    if (!id || permLoading) return;
    if (!canRead('billing')) { setLoading(false); return; }

    api.get(`/bills/${id}`)
      .then(r => setBill(r.data.data))
      .catch(() => setBill(null))
      .finally(() => setLoading(false));
  }, [id, permLoading]);

  const handlePrint = () => window.print();

  // ✅ Permission loading spinner
  if (permLoading) {
    return (
      <>
        <SEOHead title="Invoice" path={`/billing/invoice/${id}`} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, flexDirection: 'column', gap: 14,
        }}>
          <div className="spinner-border" style={{ color: 'var(--primary)' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 14 }}>
            Checking permissions…
          </div>
        </div>
      </>
    );
  }

  // ✅ Access Denied screen
  if (!canRead('billing')) {
    return (
      <>
        <SEOHead title="Invoice" path={`/billing/invoice/${id}`} />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-lock fa-3x"
            style={{ opacity: 0.3, marginBottom: 16, display: 'block', color: '#dc2626' }} />
          <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Access Denied
          </h5>
          <p style={{ fontSize: 13 }}>You don't have permission to view billing invoices.</p>
          <Link href="/"
            style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  // ── Data loading state ───────────────────────────────────
  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border" style={{ color: 'var(--primary)' }} />
    </div>
  );

  // ── Not found ────────────────────────────────────────────
  if (!bill) return (
    <div className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
      Bill not found
    </div>
  );

  return (
    <>
      <SEOHead title={`Invoice ${bill.billNumber}`} path={`/billing/invoice/${id}`} />
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

      {/* ── Action bar ── */}
      <div className="no-print mb-3 d-flex gap-2 align-items-center">
        <button
          onClick={() => router.back()}
          style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}
        >
          <i className="fa-solid fa-arrow-left me-2" />Back
        </button>

      </div>

      <div ref={printRef}>
        <InvoicePrint bill={bill} />
      </div>
    </>
  );
}

InvoicePage.getLayout = (page) => <Layout>{page}</Layout>;