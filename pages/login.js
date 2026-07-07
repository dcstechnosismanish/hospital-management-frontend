import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Head from 'next/head';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Quick validation
    const emailRegex = /^(?=[^@]*[a-zA-Z])[a-zA-Z0-9._%+-]+@(?=[^@]*[a-zA-Z][^@]*\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
    if (!emailRegex.test(form.email)) return toast.error('Please enter a valid email address');

    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <>
      <Head>
        <title>Login | MediCare Hospital ERP</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <style>{`
        .login-page {
          min-height: 100vh;
          background: var(--bg-main);
          display: flex;
          position: relative;
          overflow: hidden;
        }
        /* Left panel */
        .login-left {
          flex: 1;
          background: linear-gradient(145deg, #0f5c2e 0%, #16a34a 50%, #10b981 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 60px 48px; position: relative; overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute; width: 400px; height: 400px;
          border-radius: 50%; top: -100px; left: -100px;
          background: rgba(255,255,255,0.06);
        }
        .login-left::after {
          content: '';
          position: absolute; width: 300px; height: 300px;
          border-radius: 50%; bottom: -80px; right: -80px;
          background: rgba(255,255,255,0.08);
        }
        .login-right {
          width: 480px; min-height: 100vh;
          background: var(--bg-main);
          display: flex; align-items: center; justify-content: center;
          padding: 40px 48px;
        }
        .login-card { width: 100%; }
        .floating-shapes span {
          position: absolute; border-radius: 50%;
          background: rgba(255,255,255,0.07);
          animation: floatUp 6s infinite linear;
        }
        @keyframes floatUp {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
        .stat-pill {
          display: flex; align-items: center; gap: 14px;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 16px; padding: 16px 20px;
          margin-bottom: 14px; color: white;
          transition: transform 0.2s ease;
        }
        .stat-pill:hover { transform: translateX(6px); }
        .stat-pill .pill-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        }
        .input-group-custom { position: relative; margin-bottom: 20px; }
        .input-group-custom label {
          display: block; font-size: 13px; font-weight: 600;
          color: var(--text-secondary); margin-bottom: 8px;
        }
        .input-group-custom .icon-left {
          position: absolute; left: 14px; top: 42px;
          color: var(--primary); font-size: 15px; z-index: 2;
        }
        .input-group-custom input {
          width: 100%; padding: 13px 14px 13px 42px;
          background: var(--card-bg) !important;
          border: 1.5px solid var(--border-color) !important;
          border-radius: 12px !important; font-size: 14px !important;
          color: var(--text-primary) !important;
          transition: all 0.2s ease !important;
          outline: none;
        }
        .input-group-custom input::placeholder { color: var(--placeholder-color) !important; }
        .input-group-custom input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--primary-glow) !important;
        }
        .icon-right-btn {
          position: absolute; right: 14px; top: 42px;
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 14px; padding: 0;
        }
        .submit-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #16a34a, #10b981);
          border: none; border-radius: 12px;
          color: white; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.25s ease;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          box-shadow: 0 6px 20px rgba(22,163,74,0.35);
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(22,163,74,0.45); }
        .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .demo-box {
          margin-top: 24px; padding: 14px 18px;
          background: var(--hover-bg);
          border: 1px dashed var(--border-color);
          border-radius: 12px;
        }
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right { width: 100%; padding: 24px; }
        }
      `}</style>

      <div className="login-page">
        {/* ── Left Panel ── */}
        <div className="login-left">
          <div className="floating-shapes">
            {[40,70,50,90,35].map((s, i) => (
              <span key={i} style={{ width: s, height: s, left: `${10 + i * 18}%`, animationDelay: `${i * 1.2}s`, animationDuration: `${5 + i}s` }} />
            ))}
          </div>

          <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
              <div style={{
                width: 56, height: 56, background: 'rgba(255,255,255,0.2)',
                borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
              }}>🏥</div>
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 22, lineHeight: 1.1 }}>MediCare ERP</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Hospital Management System</div>
              </div>
            </div>

            <h2 style={{ color: 'white', fontWeight: 900, fontSize: 32, marginBottom: 8, lineHeight: 1.2 }}>
              One Platform,<br />Complete Care.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 36 }}>
              Manage patients, pharmacy, inventory, billing and more — all in one place.
            </p>

            {[
              { icon: '🩺', title: 'Hospital Management', sub: 'Patients, doctors, appointments & EMR' },
              { icon: '💊', title: 'Pharmacy & Inventory', sub: 'Stock, billing & supplier management' },
              { icon: '🔬', title: 'Laboratory', sub: 'Lab partners, test tracking & reporting' },
            ].map((s, i) => (
              <div key={i} className="stat-pill">
                <div className="pill-icon">{s.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="login-right">
          <div className="login-card anim-fade-up">
            <div style={{ marginBottom: 36 }}>
              <div style={{
                width: 52, height: 52, background: 'linear-gradient(135deg, #16a34a, #10b981)',
                borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, marginBottom: 20
              }}>🏥</div>
              <h3 style={{ fontWeight: 900, fontSize: 26, color: 'var(--text-primary)', marginBottom: 6 }}>
                Welcome back
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Sign in to your MediCare ERP account
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group-custom">
                <label>Email Address</label>
                <i className="fa-solid fa-envelope icon-left" />
                <input
                  type="email"
                  placeholder="admin@hospital.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="input-group-custom">
                <label>Password</label>
                <i className="fa-solid fa-lock icon-left" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ paddingRight: 42 }}
                  required
                />
                <button type="button" className="icon-right-btn" onClick={() => setShowPass(!showPass)}>
                  <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? <><i className="fa-solid fa-spinner fa-spin" />Signing in...</>
                  : <><i className="fa-solid fa-right-to-bracket" />Sign In</>
                }
              </button>
            </form>

            <div className="demo-box">
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
                <i className="fa-solid fa-circle-info me-2" />Demo Credentials
              </div>
              {[
                ['admin', 'admin@hospital.com', 'admin123'],
                ['doctor', 'doctor@hospital.com', 'doctor123'],
                ['pharmacist', 'pharma@hospital.com', 'pharma123'],
              ].map(([role, email, pass]) => (
                <div key={role}
                  onClick={() => setForm({ email, password: pass })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                    transition: 'background 0.15s', marginBottom: 4,
                    background: form.email === email ? 'var(--primary-glow)' : 'transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                  onMouseLeave={e => e.currentTarget.style.background = form.email === email ? 'var(--primary-glow)' : 'transparent'}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: 'var(--primary)' }}>{role}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{email}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{pass}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}