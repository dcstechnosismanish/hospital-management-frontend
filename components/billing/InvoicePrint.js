import { useRef } from 'react';

export default function InvoicePrint({ bill }) {
  const printRef = useRef(null);

  if (!bill) return null;

  const {
    billNumber, patient, items = [],
    subtotal = 0, discount = 0, tax = 0,
    totalAmount = 0, amountPaid = 0, balance = 0,
    paymentMethod, paymentStatus, createdAt, type
  } = bill;

  // ── Opens a clean new window — sidebar/navbar never appear ──
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;

    const win = window.open('', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${billNumber}</title>
          <meta charset="UTF-8" />
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Inter, system-ui, sans-serif;
              background: #fff;
              color: #1a1a1a;
              padding: 0;
            }
            .invoice-wrapper {
              max-width: 820px;
              margin: 0 auto;
              padding: 40px 48px;
              background: #fff;
            }
            /* Header */
            .inv-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 32px;
              padding-bottom: 24px;
              border-bottom: 2px solid #16a34a;
            }
            .hospital-name {
              font-size: 24px;
              font-weight: 900;
              color: #15803d;
              margin-bottom: 4px;
            }
            .hospital-sub {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 10px;
            }
            .hospital-contact {
              font-size: 12px;
              color: #6b7280;
              line-height: 1.7;
            }
            .inv-badge {
              background: #f0fdf4;
              border: 2px solid #16a34a;
              border-radius: 10px;
              padding: 12px 20px;
              text-align: right;
            }
            .inv-badge .label {
              font-size: 10px;
              color: #6b7280;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            .inv-badge .bill-num {
              font-size: 20px;
              font-weight: 900;
              color: #16a34a;
              letter-spacing: 0.5px;
            }
            .inv-date { font-size: 12px; color: #6b7280; margin-top: 6px; text-align: right; }
            .status-pill {
              display: inline-block;
              padding: 3px 14px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.5px;
              margin-top: 6px;
              text-transform: uppercase;
            }
            .status-paid    { background: #dcfce7; color: #16a34a; }
            .status-partial { background: #fef3c7; color: #d97706; }
            .status-pending { background: #fee2e2; color: #dc2626; }
            /* Info Cards */
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 28px;
            }
            .info-card {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 10px;
              padding: 14px 18px;
            }
            .info-card-title {
              font-size: 10px;
              font-weight: 800;
              color: #16a34a;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
            }
            .info-card .patient-name {
              font-size: 17px;
              font-weight: 800;
              color: #111827;
              margin-bottom: 5px;
            }
            .info-card .info-row {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 3px;
              display: flex;
              gap: 6px;
              align-items: flex-start;
            }
            .info-card .info-row strong { color: #1f2937; }
            /* Table */
            .inv-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 28px;
              font-size: 13px;
            }
            .inv-table thead tr {
              background: #16a34a;
              color: white;
            }
            .inv-table thead th {
              padding: 11px 14px;
              font-weight: 700;
              font-size: 12px;
              letter-spacing: 0.3px;
            }
            .inv-table tbody tr { border-bottom: 1px solid #e5e7eb; }
            .inv-table tbody tr:last-child { border-bottom: 2px solid #d1fae5; }
            .inv-table tbody tr:nth-child(even) { background: #f9fafb; }
            .inv-table tbody td { padding: 11px 14px; vertical-align: middle; color: #1f2937; }
            .inv-table tfoot td {
              padding: 9px 14px;
              font-size: 13px;
              color: #6b7280;
            }
            /* Totals */
            .totals-wrap {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 36px;
            }
            .totals-box {
              min-width: 300px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 18px 20px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 0;
              font-size: 13px;
              border-bottom: 1px dashed #e5e7eb;
            }
            .total-row:last-child { border-bottom: none; }
            .total-row.grand {
              border-top: 2px solid #16a34a;
              border-bottom: none;
              margin-top: 8px;
              padding-top: 12px;
            }
            .total-row.grand .label-t { font-size: 16px; font-weight: 800; color: #111827; }
            .total-row.grand .val-t   { font-size: 20px; font-weight: 900; color: #16a34a; }
            .total-row .label-t { color: #6b7280; }
            .total-row .val-t   { font-weight: 600; color: #111827; }
            .total-row.discount .val-t { color: #16a34a; }
            .total-row.balance  .val-t { color: #dc2626; font-weight: 700; }
            .total-row.paid     .val-t { color: #16a34a; font-weight: 700; }
            /* Footer */
            .inv-footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px dashed #bbf7d0;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .inv-footer .note {
              font-size: 11px;
              color: #9ca3af;
              line-height: 1.8;
            }
            .sig-line {
              width: 140px;
              text-align: center;
            }
            .sig-line .line {
              border-top: 1.5px solid #374151;
              margin-bottom: 6px;
            }
            .sig-line .sig-label {
              font-size: 11px;
              color: #6b7280;
            }
            /* Watermark for paid */
            .watermark {
              position: fixed;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: 100px;
              font-weight: 900;
              color: rgba(22, 163, 74, 0.06);
              pointer-events: none;
              z-index: 0;
              letter-spacing: 4px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${paymentStatus === 'paid' ? '<div class="watermark">PAID</div>' : ''}
          ${content}
          <script>
            window.onload = function () {
              setTimeout(function () { window.print(); window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const statusClass =
    paymentStatus === 'paid'    ? 'status-paid' :
    paymentStatus === 'partial' ? 'status-partial' : 'status-pending';

  const taxAmount = tax > 0 ? (subtotal * tax) / 100 : 0;

  return (
    <>
      {/* ── Print Button (no-print, hidden in new window) ── */}
      <div className="no-print d-flex gap-2 justify-content-end mb-3">
        <button
          onClick={handlePrint}
          className="btn-primary-custom"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <i className="fa-solid fa-print" /> Print Invoice
        </button>
      </div>

      {/* ── Invoice Preview (shown on page) ── */}
      <div
        ref={printRef}
        style={{
          maxWidth: 820,
          margin: '0 auto',
          background: 'white',
          color: '#1a1a1a',
          padding: '40px 48px',
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
          fontFamily: "'Segoe UI', Inter, system-ui, sans-serif"
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 24, borderBottom: '2px solid #16a34a' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #16a34a, #10b981)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 }}>
                🏥
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>MediCare Hospital</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Multi-Specialty Hospital & Research Center</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
              123 Health Avenue, Medical District<br />
              📞 +91 98765 43210 &nbsp;|&nbsp; 📧 info@medicare.com
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 10, padding: '12px 20px', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Invoice No.</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', letterSpacing: 0.5 }}>{billNumber}</div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Date: {new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                display: 'inline-block', padding: '3px 14px', borderRadius: 20,
                fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                background: paymentStatus === 'paid' ? '#dcfce7' : paymentStatus === 'partial' ? '#fef3c7' : '#fee2e2',
                color:      paymentStatus === 'paid' ? '#16a34a' : paymentStatus === 'partial' ? '#d97706' : '#dc2626',
              }}>
                {paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ── BILL TO / PAYMENT DETAILS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Bill To</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 5 }}>{patient?.name || 'Walk-in Patient'}</div>
            {patient?.patientId && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>ID: {patient.patientId}</div>}
            {(patient?.age || patient?.gender) && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>
                {[patient.age && `Age: ${patient.age}`, patient.gender].filter(Boolean).join(' | ')}
              </div>
            )}
            {patient?.phone   && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>📞 {patient.phone}</div>}
            {patient?.address && <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {patient.address}</div>}
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Payment Details</div>
            {[
              ['Payment Method', paymentMethod],
              ['Bill Type', type],
              ['Payment Status', paymentStatus],
            ].map(([label, val]) => val && (
              <div key={label} style={{ fontSize: 13, color: '#6b7280', marginBottom: 5 }}>
                {label}: <strong style={{ color: '#1f2937' }}>{val}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28, fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#16a34a', color: 'white' }}>
              <th style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, textAlign: 'left', width: '5%' }}>#</th>
              <th style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, textAlign: 'left', width: '48%' }}>Description</th>
              <th style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, textAlign: 'center', width: '12%' }}>Qty</th>
              <th style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, textAlign: 'right', width: '17%' }}>Unit Price</th>
              <th style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, textAlign: 'right', width: '18%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 1 ? '#f9fafb' : 'white' }}>
                <td style={{ padding: '11px 14px', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1f2937' }}>{item.description || item.name}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', color: '#374151' }}>{item.quantity}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', color: '#374151' }}>₹{(item.unitPrice || 0).toFixed(2)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>₹{(item.total || item.quantity * item.unitPrice || 0).toFixed(2)}</td>
                
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 36 }}>
          <div style={{ minWidth: 300, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px dashed #e5e7eb' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px dashed #e5e7eb' }}>
                <span style={{ color: '#16a34a' }}>Discount</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>− ₹{discount.toFixed(2)}</span>
              </div>
            )}

            {tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px dashed #e5e7eb' }}>
                <span style={{ color: '#6b7280' }}>Tax ({tax}%)</span>
                <span style={{ fontWeight: 600 }}>₹{taxAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #16a34a', marginTop: 8, paddingTop: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Total Amount</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>₹{totalAmount.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>Amount Paid</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{amountPaid.toFixed(2)}</span>
            </div>

            {balance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderTop: '1px dashed #e5e7eb', marginTop: 4 }}>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>Balance Due</span>
                <span style={{ color: '#dc2626', fontWeight: 800 }}>₹{balance.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ paddingTop: 20, borderTop: '1px dashed #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}>Thank you for choosing MediCare Hospital.</p>
            <p style={{ margin: 0 }}>This is a computer-generated invoice. No signature required.</p>
            <p style={{ margin: 0, marginTop: 4 }}>
              For queries contact: 📞 +91 98765 43210 | 📧 info@medicare.com
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 140, borderTop: '1.5px solid #374151', paddingTop: 6, fontSize: 11, color: '#6b7280' }}>
              Authorized Signature
            </div>
          </div>
        </div>
      </div>
    </>
  );
}