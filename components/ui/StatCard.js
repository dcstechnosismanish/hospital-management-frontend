import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Animated number counter
function CountUp({ target, duration = 1200, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isNumeric = !isNaN(parseFloat(target)) && isFinite(target);
    if (!isNumeric) { setDisplay(target); return; }

    const end = parseFloat(target);
    const start = performance.now();
    startRef.current = start;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * end));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return <>{prefix}{typeof display === 'number' ? display.toLocaleString('en-IN') : display}{suffix}</>;
}

export default function StatCard({
  icon,
  label,
  value,
  change,
  changeType = 'up',
  color = '#16a34a',
  gradient,
  sub,
  delay = 0,
  prefix = '',
  suffix = '',
  sparkline,       // optional array of numbers for mini sparkline
  href,            // optional link destination
}) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // Intersection observer — animate on enter viewport
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const grad = gradient || `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`;

  const CardContent = (
    <div
      ref={ref}
      className="ultra-stat-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        '--card-color': color,
        animationDelay: `${delay * 0.12}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: `opacity 0.5s ease ${delay * 0.12}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay * 0.12}s`,
      }}
    >
      {/* Animated gradient blob background */}
      <div className="card-blob" style={{ background: grad }} />

      {/* Subtle grid lines */}
      <div className="card-grid-lines" />

      {/* Top row — icon + change badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        {/* Icon with glow ring */}
        <div className="stat-icon-wrap" style={{ '--ic': color }}>
          <div className="stat-icon-ring" />
          <div className="stat-icon-inner">
            <i className={`fa-solid ${icon}`} />
          </div>
        </div>

        {/* Change badge */}
        {change && (
          <div
            className={`change-badge ${changeType === 'up' ? 'badge-up' : changeType === 'down' ? 'badge-down' : 'badge-neutral'}`}
            style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
          >
            {changeType === 'up' && <i className="fa-solid fa-arrow-trend-up" />}
            {changeType === 'down' && <i className="fa-solid fa-arrow-trend-down" />}
            {changeType === 'neutral' && <i className="fa-solid fa-minus" />}
            <span>{change}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="stat-value-wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div className="stat-num" style={{ color: 'var(--text-primary)' }}>
          {visible
            ? <CountUp target={value} prefix={prefix} suffix={suffix} />
            : `${prefix}0${suffix}`
          }
        </div>
        <div className="stat-lbl">{label}</div>
        {sub && (
          <div className="stat-sub">
            <span className="sub-dot" style={{ background: color }} />
            {sub}
          </div>
        )}
      </div>

      {/* Optional mini sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="sparkline-wrap" style={{ position: 'relative', zIndex: 2 }}>
          <svg viewBox={`0 0 ${sparkline.length * 10} 32`} preserveAspectRatio="none"
            style={{ width: '100%', height: 32 }}>
            <defs>
              <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const max = Math.max(...sparkline);
              const min = Math.min(...sparkline);
              const range = max - min || 1;
              const pts = sparkline.map((v, i) => `${i * 10},${28 - ((v - min) / range) * 24}`).join(' ');
              const area = `${pts} ${(sparkline.length - 1) * 10},32 0,32`;
              return (
                <>
                  <polygon points={area} fill={`url(#sg-${label})`} />
                  <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </>
              );
            })()}
          </svg>
        </div>
      )}

      {/* Bottom progress bar */}
      <div className="stat-progress-bar" style={{ position: 'relative', zIndex: 2 }}>
        <div className="progress-track">
          <div className="progress-fill" style={{
            background: color,
            width: visible ? `${Math.min(100, (parseFloat(value) / ((parseFloat(value) || 1) * 1.3)) * 100)}%` : '0%',
            transition: `width 1.2s cubic-bezier(0.34,1.0,0.64,1) ${delay * 0.12 + 0.4}s`
          }} />
        </div>
      </div>

      {/* Hover shine sweep */}
      <div className={`card-shine ${hovered ? 'active' : ''}`} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}