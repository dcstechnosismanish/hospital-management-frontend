import Layout from '../components/layout/Layout';
import SEOHead from '../components/ui/SEOHead';
import StatCard from '../components/ui/StatCard';
import { useEffect, useState, useMemo } from 'react';
import api from '../utils/api';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';  




// ── Role meta ──────────────────────────────────────────────
const ROLE_META = {
  admin:         { label: 'Super Admin',   icon: 'fa-user-shield',   color: '#ef4444', greeting: 'Hospital Overview'     },
  superadmin:    { label: 'Super Admin',   icon: 'fa-user-shield',   color: '#ef4444', greeting: 'Hospital Overview'     },
  doctor:        { label: 'Doctor',        icon: 'fa-user-doctor',   color: '#0891b2', greeting: 'Your Patient Overview' },
  pharmacist:    { label: 'Pharmacist',    icon: 'fa-pills',         color: '#16a34a', greeting: 'Pharmacy Overview'     },
  store_manager: { label: 'Store Manager', icon: 'fa-boxes-stacked', color: '#7c3aed', greeting: 'Inventory Overview'    },
  receptionist:  { label: 'Receptionist',  icon: 'fa-headset',       color: '#d97706', greeting: 'Front Desk Overview'   },
};

const STATUS_STYLE = {
  completed: { c: '#16a34a', bg: 'rgba(22,163,74,0.12)'  },
  cancelled: { c: '#dc2626', bg: 'rgba(239,68,68,0.12)'  },
  scheduled: { c: '#0891b2', bg: 'rgba(6,182,212,0.12)'  },
  'no-show': { c: '#d97706', bg: 'rgba(217,119,6,0.12)'  },
};

// ── Indian Holidays & Festivals 2026 ──────────────────────
const INDIA_HOLIDAYS = {
  '2026-01-01': { name: 'New Year',                        type: 'festival', emoji: '🎉' },
  '2026-01-13': { name: 'Lohri',                           type: 'festival', emoji: '🔥' },
  '2026-01-14': { name: 'Makar Sankranti',                 type: 'festival', emoji: '🪁' },
  '2026-01-23': { name: 'Basant Panchami',                 type: 'festival', emoji: '🌼' },
  '2026-01-26': { name: 'Republic Day',                    type: 'national', emoji: '🇮🇳' },
  '2026-02-18': { name: 'Maha Shivratri',                  type: 'festival', emoji: '🙏' },
  '2026-03-03': { name: 'Holika Dahan',                    type: 'festival', emoji: '🔥' },
  '2026-03-04': { name: 'Holi',                            type: 'national', emoji: '🎨' },
  '2026-03-19': { name: 'Ugadi / Gudi Padwa',              type: 'festival', emoji: '🌅' },
  '2026-03-26': { name: 'Ram Navami',                      type: 'national', emoji: '🏹' },
  '2026-03-31': { name: 'Mahavir Jayanti',                 type: 'national', emoji: '✋' },
  '2026-04-03': { name: 'Good Friday',                     type: 'national', emoji: '✝️' },
  '2026-04-05': { name: 'Easter Sunday',                   type: 'festival', emoji: '🐣' },
  '2026-04-14': { name: 'Vaisakhi / Ambedkar Jayanti',     type: 'national', emoji: '🌾' },
  '2026-05-01': { name: 'Buddha Purnima',                  type: 'national', emoji: '☸️' },
  '2026-05-27': { name: 'Eid ul-Adha (Bakrid)',            type: 'national', emoji: '🌙' },
  '2026-06-26': { name: 'Muharram',                        type: 'national', emoji: '🌙' },
  '2026-07-16': { name: 'Rath Yatra',                      type: 'festival', emoji: '🎡' },
  '2026-08-15': { name: 'Independence Day',                type: 'national', emoji: '🇮🇳' },
  '2026-08-28': { name: 'Raksha Bandhan',                  type: 'festival', emoji: '🪢' },
  '2026-09-04': { name: 'Janmashtami',                     type: 'festival', emoji: '🦚' },
  '2026-09-17': { name: 'Ganesh Chaturthi',                type: 'festival', emoji: '🐘' },
  '2026-10-02': { name: 'Gandhi Jayanti',                  type: 'national', emoji: '🕊️' },
  '2026-10-20': { name: 'Dussehra',                        type: 'national', emoji: '🏹' },
  '2026-10-29': { name: 'Karva Chauth',                    type: 'festival', emoji: '🌕' },
  '2026-11-06': { name: 'Dhanteras',                       type: 'festival', emoji: '💰' },
  '2026-11-08': { name: 'Diwali',                          type: 'national', emoji: '🪔' },
  '2026-11-09': { name: 'Govardhan Puja',                  type: 'festival', emoji: '🙏' },
  '2026-11-11': { name: 'Bhai Dooj',                       type: 'festival', emoji: '👫' },
  '2026-11-14': { name: "Children's Day",                  type: 'festival', emoji: '👦' },
  '2026-11-24': { name: 'Guru Nanak Jayanti',              type: 'national', emoji: '☬'  },
  '2026-12-25': { name: 'Christmas',                       type: 'national', emoji: '🎄' },
  '2026-12-31': { name: "New Year's Eve",                  type: 'festival', emoji: '🎆' },
};

const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];



// ══════════════════════════════════════════════════════════════
// MINI CALENDAR COMPONENT
// ══════════════════════════════════════════════════════════════
function MiniCalendar({ appointments }) {
  const allApts = appointments || [];
  const now     = new Date();

  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth());
  const [selected, setSelected] = useState(null);
  const [view,     setView]     = useState('month');

  // Build appointment map keyed by YYYY-MM-DD
  const aptMap = useMemo(() => {
    const map = {};
    allApts.forEach(a => {
      if (!a.date) return;
      const key = new Date(a.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [allApts]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(null);
    setView('month');
  };

  // Build grid cells (always 42 = 6 rows × 7 cols)
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, cur: false, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm      = String(month + 1).padStart(2, '0');
    const dd      = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    cells.push({ day: d, cur: true, dateStr });
  }
  const rem = 42 - cells.length;
  for (let d = 1; d <= rem; d++)
    cells.push({ day: d, cur: false, dateStr: null });

  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  // ── DAY VIEW ────────────────────────────────────────────
  if (view === 'day' && selected) {
    const [sy, sm, sd] = selected.split('-').map(Number);
    const selDate      = new Date(sy, sm - 1, sd);
    const hol          = INDIA_HOLIDAYS[selected];
    const dayApts      = aptMap[selected] || [];

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button
            onClick={() => setView('month')}
            style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fa-solid fa-chevron-left" style={{ fontSize: 10 }} /> Back
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text-primary)' }}>
              {selDate.toLocaleDateString('en-IN', { weekday: 'long' })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ width: 64 }} />
        </div>

        {/* Holiday banner */}
        {hol && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginBottom: 12,
            background: hol.type === 'national' ? 'rgba(239,68,68,0.08)' : 'rgba(124,58,237,0.08)',
            border: `1px solid ${hol.type === 'national' ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)'}`,
          }}>
            <span style={{ fontSize: 22 }}>{hol.emoji}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: hol.type === 'national' ? '#dc2626' : '#7c3aed' }}>
                {hol.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {hol.type} holiday
              </div>
            </div>
          </div>
        )}

        {/* Appointments list */}
        {dayApts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)' }}>
            <i className="fa-regular fa-calendar-xmark fa-2x" style={{ opacity: 0.35, marginBottom: 8, display: 'block' }} />
            <div style={{ fontSize: 13 }}>No appointments on this day</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              {dayApts.length} Appointment{dayApts.length > 1 ? 's' : ''}
            </div>
            {dayApts.map((a, i) => {
              const ss = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${ss.c}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.patient?.name || 'Patient'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Dr. {a.doctor?.name || '—'} &nbsp;·&nbsp; {a.timeSlot || a.time || '—'}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: ss.bg, color: ss.c, textTransform: 'capitalize', flexShrink: 0 }}>
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── MONTH VIEW ──────────────────────────────────────────
  return (
    <div>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          onClick={prevMonth}
          style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <i className="fa-solid fa-chevron-left" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text-primary)' }}>
            {MONTH_NAMES[month]} {year}
          </div>
          <button
            onClick={goToday}
            style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1 }}
          >
            Today
          </button>
        </div>
        <button
          onClick={nextMonth}
          style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--hover-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((cell, idx) => {
          const isToday    = cell.cur && cell.dateStr === todayStr;
          const isSelected = cell.cur && cell.dateStr === selected;
          const hasApts    = cell.cur && cell.dateStr && (aptMap[cell.dateStr]?.length > 0);
          const holiday    = cell.cur && cell.dateStr ? INDIA_HOLIDAYS[cell.dateStr] : null;

          let cellBg = 'transparent';
          if (isSelected) cellBg = '#7c3aed';
          else if (isToday) cellBg = 'rgba(124,58,237,0.12)';
          else if (holiday) cellBg = holiday.type === 'national' ? 'rgba(239,68,68,0.06)' : 'rgba(124,58,237,0.04)';

          return (
            <div
              key={idx}
              onClick={() => {
                if (!cell.cur || !cell.dateStr) return;
                setSelected(cell.dateStr);
                setView('day');
              }}
              style={{
                minHeight: 38,
                borderRadius: 9,
                padding: '4px 3px 3px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: cell.cur ? 'pointer' : 'default',
                position: 'relative',
                background: cellBg,
                border: isToday && !isSelected ? '1.5px solid rgba(124,58,237,0.4)' : '1.5px solid transparent',
                opacity: cell.cur ? 1 : 0.3,
                transition: 'all 0.15s',
              }}
            >
              {/* Day number */}
              <span style={{
                fontSize: 12,
                fontWeight: isToday || isSelected ? 900 : 500,
                lineHeight: 1,
                color: isSelected ? 'white' : isToday ? '#7c3aed' : 'var(--text-primary)',
              }}>
                {cell.day}
              </span>

              {/* Holiday emoji */}
              {holiday && !isSelected && (
                <span style={{ fontSize: 9, lineHeight: 1, marginTop: 1 }} title={holiday.name}>
                  {holiday.emoji}
                </span>
              )}

              {/* Appointment dots */}
              {hasApts && (
                <div style={{ display: 'flex', gap: 2, marginTop: 'auto', paddingBottom: 1 }}>
                  {(aptMap[cell.dateStr] || []).slice(0, 3).map((a, di) => {
                    const ss = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled;
                    return (
                      <div
                        key={di}
                        style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.9)' : ss.c }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
        {[
          { dot: false, border: true,  color: 'rgba(124,58,237,0.5)', bg: 'transparent',            label: 'Today'     },
          { dot: true,                 color: '#0891b2',               bg: '',                        label: 'Scheduled' },
          { dot: true,                 color: '#16a34a',               bg: '',                        label: 'Completed' },
          { dot: true,                 color: '#dc2626',               bg: '',                        label: 'Cancelled' },
          { dot: false,                color: '#dc2626',               bg: 'rgba(239,68,68,0.12)',    label: '🇮🇳 National' },
          { dot: false,                color: '#7c3aed',               bg: 'rgba(124,58,237,0.08)',   label: 'Festival'  },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {l.dot
              ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              : <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.color}`, flexShrink: 0 }} />
            }
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Upcoming holidays this month */}
      {(() => {
        const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`;
        const upcoming  = Object.entries(INDIA_HOLIDAYS)
          .filter(([d]) => d >= todayStr && d.startsWith(monthKey))
          .slice(0, 3);
        if (!upcoming.length) return null;
        return (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Upcoming This Month
            </div>
            {upcoming.map(([d, hol]) => (
              <div
                key={d}
                onClick={() => { setSelected(d); setView('day'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 8, cursor: 'pointer', marginBottom: 3, transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16 }}>{hol.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{hol.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                  background: hol.type === 'national' ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)',
                  color: hol.type === 'national' ? '#dc2626' : '#7c3aed',
                }}>
                  {hol.type}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { canRead, canCreate, loading: permLoading } = usePermission();
  const router                         = useRouter();
  const role                           = user?.role; // No default admin here
  const meta                           = ROLE_META[role || 'admin'] || ROLE_META.admin;

  const [stats,   setStats]   = useState({});
  const [apts,    setApts]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [time,    setTime]    = useState(new Date());
  const [dashSearch, setDashSearch] = useState('');

   // ✅ MUST BE HERE (inside Dashboard)
  const [mounted, setMounted] = useState(false);

  // ✅ MUST BE HERE (inside Dashboard)
  useEffect(() => {
    setMounted(true);
  }, []);
  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ Redirect to login if not authenticated after loading finishes
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading]);



  // ✅ Wait for permissions to load before fetching data
  useEffect(() => {
    if (permLoading) return;

    const fetchAll = async () => {
      if (!user || permLoading) return;
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().slice(0, 10);

        if (role === 'admin' || role === 'superadmin') {
          // ✅ Admin: always has full access, fetch everything
          const [p, d, a, adm, rx, med, bil, low, lab, phmStore, usr] = await Promise.all([
            api.get('/patients?limit=1'),
            api.get('/doctors?limit=1'),
            api.get('/appointments'),
            api.get('/admissions?limit=1'),
            api.get('/prescriptions/stats').catch(() => ({ data: { data: {} } })),
            api.get('/medicines?limit=1').catch(() => ({ data: { total: 0 } })),
            api.get('/bills?limit=500').catch(() => ({ data: { data: [] } })),
            api.get('/medicines/low-stock').catch(() => ({ data: { count: 0 } })),
            api.get('/laboratory?limit=1').catch(() => ({ data: { total: 0 } })),
            api.get('/pharmacy-stores?limit=1').catch(() => ({ data: { total: 0 } })),
            api.get('/users?limit=1').catch(() => ({ data: { total: 0 } })),
          ]);
          const allApts = a.data.data || [];
          const todayDate = new Date();
          todayDate.setHours(0,0,0,0);

          // Calculate Revenue
          const allBills = bil.data.data || [];
          const totalRevenue = allBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

          setApts(allApts);
          setStats({
            patients:      p.data.total         || 0,
            doctors:       d.data.total         || 0,
            appointments:  allApts.length,
            todayApts:     allApts.filter(x => x.date?.slice(0, 10) === todayStr).length,
            pending:       allApts.filter(x => x.status === 'scheduled' && x.date?.split('T')[0] >= todayStr).length,
            admissions:    adm.data.totalActive || adm.data.total || 0,
            prescriptions: rx.data.data?.total  || 0,
            medicines:     med.data.total       || 0,
            billing:       bil.data.total       || 0,
            revenue:       totalRevenue,
            lowStock:      low.data.count || 0,
            staff:         usr.data.total || 0, 
            laboratories:  lab.data.total || 0,
            pharmacies:    phmStore.data.total || 0,
          });
        }

        else if (role === 'doctor') {
          // ✅ Conditionally fetch based on permissions
          const fetches = [
            canRead('appointments') ? api.get('/appointments?limit=200') : Promise.resolve({ data: { data: [] } }),
            canRead('patients')     ? api.get('/patients?limit=1')        : Promise.resolve({ data: { total: 0 } }),
            canRead('prescriptions')? api.get('/prescriptions/stats').catch(() => ({ data: { data: {} } })) : Promise.resolve({ data: { data: {} } }),
          ];
          const [a, p, rx] = await Promise.all(fetches);
          const allApts = a.data.data || [];
          const todayDate = new Date();
          todayDate.setHours(0,0,0,0);

          setApts(allApts);
          setStats({
            patients:      p.data.total              || 0,
            appointments:  allApts.length,
            todayApts:     allApts.filter(x => x.date?.slice(0, 10) === todayStr).length,
            prescriptions: rx.data.data?.total       || 0,
            rxPending:     rx.data.data?.pending     || 0,
            rxDispensed:   rx.data.data?.dispensed   || 0,
            pending:       allApts.filter(x => x.status === 'scheduled' && x.date?.split('T')[0] >= todayStr).length,
            completed:     allApts.filter(x => x.status === 'completed').length,
          });
        }

        else if (role === 'pharmacist') {
          const fetches = [
            canRead('medicine-inventory') ? api.get('/medicines?limit=200').catch(() => ({ data: { data: [], total: 0 } })) : Promise.resolve({ data: { data: [], total: 0 } }),
            canRead('prescriptions')      ? api.get('/prescriptions/stats').catch(() => ({ data: { data: {} } }))           : Promise.resolve({ data: { data: {} } }),
          ];
          const [m, rx] = await Promise.all(fetches);
          const meds = m.data.data || [];
          setStats({
            medicines:     m.data.total              || 0,
            prescriptions: rx.data.data?.total       || 0,
            rxPending:     rx.data.data?.pending     || 0,
            rxDispensed:   rx.data.data?.dispensed   || 0,
            lowStock:      meds.filter(x => (x.stock || 0) < 20).length,
            outOfStock:    meds.filter(x => (x.stock || 0) === 0).length,
          });
        }

        else if (role === 'store_manager') {
          const inv = canRead('inventory')
            ? await api.get('/inventory?limit=200').catch(() => ({ data: { data: [], total: 0 } }))
            : { data: { data: [], total: 0 } };
          const items = inv.data.data || [];
          setStats({
            inventory:  inv.data.total || 0,
            lowStock:   items.filter(x => (x.quantity || 0) < 5).length,
            outOfStock: items.filter(x => (x.quantity || 0) === 0).length,
          });
        }

        else if (role === 'receptionist') {
          const fetches = [
            canRead('patients')      ? api.get('/patients?limit=1')       : Promise.resolve({ data: { total: 0 } }),
            canRead('appointments')  ? api.get('/appointments?limit=200') : Promise.resolve({ data: { data: [] } }),
            canRead('billing')       ? api.get('/bills?limit=1').catch(() => ({ data: { total: 0 } })) : Promise.resolve({ data: { total: 0 } }),
          ];
          const [p, a, bil] = await Promise.all(fetches);
          const allApts = a.data.data || [];
          setApts(allApts);
          setStats({
            patients:     p.data.total   || 0,
            appointments: allApts.length,
            todayApts:    allApts.filter(x => x.date?.slice(0, 10) === todayStr).length,
            billing:      bil.data.total || 0,
          });
        }

      } catch (e) {
        if (e.response?.status !== 401) {
          console.error('Dashboard fetch error:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [role, permLoading]); // ✅ Re-fetch when permissions finish loading

  // ── Stat cards per role ──────────────────────────────────
  const getStatCards = () => {
    switch (role) {
      case 'superadmin':
      case 'admin': return [
        { icon: 'fa-user-injured',        label: 'Total Patients',  value: stats.patients      || 0, color: '#0891b2', change: 'All registered',              changeType: 'neutral', sub: 'Patients',      delay: 0, href: '/patients'           },
        { icon: 'fa-user-doctor',         label: 'Doctors',         value: stats.doctors       || 0, color: '#16a34a', change: 'Active staff',                 changeType: 'neutral', sub: 'Medical staff', delay: 1, href: '/doctors'             },
        { icon: 'fa-calendar-check',      label: 'Appointments',    value: stats.appointments  || 0, color: '#7c3aed', change: `${stats.todayApts || 0} today`, changeType: 'info',    sub: 'Total',         delay: 2, href: '/appointments'        },
        { icon: 'fa-bed',                 label: 'Admissions',      value: stats.admissions    || 0, color: '#d97706', change: 'Admitted',                     changeType: 'neutral', sub: 'Current',       delay: 3, href: '/admissions'          },
        { icon: 'fa-microscope',          label: 'Lab Partners',    value: stats.laboratories  || 0, color: '#ec4899', change: 'Active labs',                  changeType: 'neutral', sub: 'Partners',      delay: 4, href: '/laboratory'          },
        { icon: 'fa-store',               label: 'Pharmacy Stores', value: stats.pharmacies    || 0, color: '#f59e0b', change: 'Active stores',                changeType: 'neutral', sub: 'Branches',      delay: 5, href: '/pharmacy/stores'     },
        { icon: 'fa-prescription',        label: 'Prescriptions',   value: stats.prescriptions || 0, color: '#7c3aed', change: 'All time',                     changeType: 'neutral', sub: 'Total',         delay: 6, href: '/prescriptions'       },
        { icon: 'fa-pills',               label: 'Medicines',       value: stats.medicines     || 0, color: '#0891b2', change: 'In inventory',                 changeType: 'neutral', sub: 'Items',         delay: 7, href: '/pharmacy/medicines'  },
        { icon: 'fa-file-invoice-dollar', label: 'Bills',           value: stats.billing       || 0, color: '#16a34a', change: 'Generated',                    changeType: 'neutral', sub: 'Total',         delay: 8, href: '/billing'             },
        { icon: 'fa-indian-rupee-sign',   label: 'Revenue',         value: stats.revenue       || 0, color: '#059669', change: 'Lifetime sum',                 changeType: 'up',      sub: 'Earnings',      delay: 9, href: '/billing', prefix: '₹' },
        { icon: 'fa-triangle-exclamation',label: 'Low Stock',       value: stats.lowStock      || 0, color: '#dc2626', change: 'Items < 10',                   changeType: 'down',    sub: 'Inventory',     delay: 10, href: '/pharmacy/medicines'  },
        { icon: 'fa-users',               label: 'Active Staff',    value: stats.staff         || 6, color: '#6366f1', change: 'System users',                 changeType: 'neutral', sub: 'Personnel',     delay: 11, href: '/settings/users'      },
      ];
      case 'doctor': return [
        // ✅ Only show stat cards for modules the user can read
        ...(canRead('appointments') ? [{ icon: 'fa-calendar-check', label: 'Appointments', value: stats.appointments || 0, color: '#0891b2', change: `${stats.todayApts || 0} today`, changeType: 'info',    sub: 'Total',    delay: 0, href: '/appointments'  }] : []),
        ...(canRead('appointments') ? [{ icon: 'fa-clock',          label: 'Pending',      value: stats.pending      || 0, color: '#d97706', change: 'Scheduled',                     changeType: 'warning', sub: 'Waiting',  delay: 1, href: '/appointments'  }] : []),
        ...(canRead('appointments') ? [{ icon: 'fa-circle-check',   label: 'Completed',    value: stats.completed    || 0, color: '#16a34a', change: 'Done',                          changeType: 'success', sub: 'Today',    delay: 2, href: '/appointments'  }] : []),
        ...(canRead('patients')     ? [{ icon: 'fa-user-injured',   label: 'Patients',     value: stats.patients     || 0, color: '#7c3aed', change: 'Registered',                    changeType: 'neutral', sub: 'Total',    delay: 3, href: '/patients'      }] : []),
        ...(canRead('prescriptions')? [{ icon: 'fa-prescription',   label: 'Prescriptions',value: stats.prescriptions|| 0, color: '#0891b2', change: 'Written',                       changeType: 'neutral', sub: 'All time', delay: 4, href: '/prescriptions' }] : []),
      ];
      case 'pharmacist': return [
        ...(canRead('medicine-inventory') ? [{ icon: 'fa-pills',                label: 'Medicines',    value: stats.medicines    || 0, color: '#16a34a', change: 'In stock',     changeType: 'success', sub: 'Items', delay: 0, href: '/pharmacy/medicines'  }] : []),
        ...(canRead('prescriptions') ? [{ icon: 'fa-prescription',         label: 'Prescriptions',value: stats.prescriptions|| 0, color: '#7c3aed', change: 'Total',        changeType: 'neutral', sub: 'All',   delay: 1, href: '/prescriptions'       }] : []),
        ...(canRead('prescriptions') ? [{ icon: 'fa-hourglass-half',       label: 'Pending Rx',   value: stats.rxPending    || 0, color: '#d97706', change: 'To dispense',  changeType: 'warning', sub: 'Queue', delay: 2, href: '/prescriptions'       }] : []),
        ...(canRead('prescriptions') ? [{ icon: 'fa-circle-check',         label: 'Dispensed',    value: stats.rxDispensed  || 0, color: '#0891b2', change: 'Completed',    changeType: 'info',    sub: 'Total', delay: 3, href: '/prescriptions'       }] : []),
        ...(canRead('medicine-inventory') ? [{ icon: 'fa-triangle-exclamation', label: 'Low Stock',    value: stats.lowStock     || 0, color: '#d97706', change: 'Need reorder', changeType: 'warning', sub: 'Items', delay: 4, href: '/pharmacy/medicines'  }] : []),
        ...(canRead('medicine-inventory') ? [{ icon: 'fa-ban',                  label: 'Out of Stock', value: stats.outOfStock   || 0, color: '#dc2626', change: 'Unavailable',  changeType: 'danger',  sub: 'Items', delay: 5, href: '/pharmacy/medicines'  }] : []),
      ];
      case 'store_manager': return [
        ...(canRead('inventory') ? [{ icon: 'fa-boxes-stacked',        label: 'Inventory',    value: stats.inventory  || 0, color: '#7c3aed', change: 'Total',      changeType: 'neutral', sub: 'Items', delay: 0, href: '/inventory'       }] : []),
        ...(canRead('inventory') ? [{ icon: 'fa-triangle-exclamation', label: 'Low Stock',    value: stats.lowStock   || 0, color: '#d97706', change: '< 5 units',  changeType: 'warning', sub: 'Items', delay: 1, href: '/inventory/items'  }] : []),
        ...(canRead('inventory') ? [{ icon: 'fa-ban',                  label: 'Out of Stock', value: stats.outOfStock || 0, color: '#dc2626', change: 'Zero units', changeType: 'danger',  sub: 'Items', delay: 2, href: '/inventory/items'  }] : []),
      ];
      case 'receptionist': return [
        ...(canRead('patients')     ? [{ icon: 'fa-user-injured',        label: 'Patients',     value: stats.patients     || 0, color: '#0891b2', change: 'Registered',              changeType: 'neutral', sub: 'Total', delay: 0, href: '/patients'      }] : []),
        ...(canRead('appointments') ? [{ icon: 'fa-calendar-check',      label: 'Appointments', value: stats.appointments || 0, color: '#7c3aed', change: `${stats.todayApts || 0} today`, changeType: 'info', sub: 'Total', delay: 1, href: '/appointments'  }] : []),
        ...(canRead('billing')      ? [{ icon: 'fa-file-invoice-dollar', label: 'Bills',        value: stats.billing      || 0, color: '#16a34a', change: 'Generated',               changeType: 'neutral', sub: 'Total', delay: 2, href: '/billing'        }] : []),
      ];
      default: return [];
    }
  };

  // ── Quick links per role ─────────────────────────────────
  const getQuickLinks = () => {
    const all = [
      { href: '/patients',          icon: 'fa-user-injured',        label: 'Patients',      color: '#0891b2', module: 'patients'      },
      { href: '/appointments',      icon: 'fa-calendar-check',      label: 'Appointments',  color: '#7c3aed', module: 'appointments'  },
      { href: '/prescriptions',     icon: 'fa-prescription',        label: 'Prescriptions', color: '#7c3aed', module: 'prescriptions' },
      { href: '/admissions',        icon: 'fa-bed',                 label: 'Admissions',    color: '#d97706', module: 'admissions-beds' },
      { href: '/pharmacy',          icon: 'fa-pills',               label: 'Pharmacy',      color: '#16a34a', module: 'pharmacy'      },
      { href: '/billing',           icon: 'fa-file-invoice-dollar', label: 'Billing',       color: '#ef4444', module: 'billing'       },
      { href: '/inventory',         icon: 'fa-boxes-stacked',       label: 'Inventory',     color: '#7c3aed', module: 'inventory'     },
      { href: '/doctors',           icon: 'fa-user-doctor',         label: 'Doctors',       color: '#0891b2', module: 'doctors'       },
      { href: '/prescriptions/new', icon: 'fa-file-prescription',   label: 'New Rx',        color: '#0891b2', module: 'prescriptions', action: 'create' },
      { href: '/inventory/items',   icon: 'fa-box',                 label: 'Items',         color: '#0891b2', module: 'item-master'   },
    ];

    let roleLinks = [];
    switch (role) {
      case 'superadmin':
      case 'admin':         roleLinks = [all[0], all[1], all[2], all[8], all[3], all[4], all[5], all[6], all[7]]; break;
      case 'doctor':        roleLinks = [all[0], all[1], all[2], all[3], all[8]];                         break;
      case 'pharmacist':    roleLinks = [all[0], all[2], all[4], all[8]];                                 break;
      case 'store_manager': roleLinks = [all[6], all[9]];                                                 break;
      case 'receptionist':  roleLinks = [all[0], all[1], all[5]];                                         break;
      default:              roleLinks = [all[0], all[1]];
    }

    // ✅ Filter quick links by permissions (admin bypasses — always show all)
    return (role === 'admin' || role === 'superadmin')
      ? roleLinks
      : roleLinks.filter(ql => {
          const hasRead = canRead(ql.module);
          if (ql.action === 'create') return hasRead && canCreate(ql.module);
          return hasRead;
        });
  };

  const statCards  = getStatCards();
  const quickLinks = getQuickLinks();

  const greetHour = time.getHours();
  const greeting  = greetHour < 12 ? 'Good Morning' : greetHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayStr  = new Date().toISOString().slice(0, 10);
  const filteredToday = apts.filter(a => {
    if (a.date?.slice(0, 10) !== todayStr) return false;
    if (!dashSearch) return true;
    const q = dashSearch.toLowerCase();
    return a.patient?.name?.toLowerCase().includes(q) || a.doctor?.name?.toLowerCase().includes(q);
  });
  const todayApts = filteredToday.slice(0, 10);

  // ── RENDER ───────────────────────────────────────────────
  return (
    <>
      <SEOHead title="Dashboard" path="/" />

      {/* ── Welcome Banner ── */}
      <div style={{
        background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}06)`,
        border: `1px solid ${meta.color}25`,
        borderRadius: 18,
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15,
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, flexShrink: 0,
            boxShadow: `0 6px 20px ${meta.color}40`,
          }}>
            <i className={`fa-solid ${meta.icon}`} />
          </div>
          <div>
            <h5 style={{ margin: 0, fontWeight: 900, fontSize: 20, color: 'var(--text-primary)' }}>
              {greeting}, {user?.name?.split(' ')[0] || 'User'}! 👋
            </h5>
            {mounted && (
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {meta.greeting} &nbsp;·&nbsp;
                {time.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
         <div style={{ fontWeight: 900, fontSize: 28, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
  {mounted
    ? time.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '--:--:--'}
</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>IST · India</div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {(loading || permLoading) ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: 110, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {statCards.map((s, i) => (
            <StatCard key={i} {...s} />
          ))}
        </div>
      )}


      {/* ── Appointments + Calendar grid ── */}
      <div className="dashboard-main-grid">
        {/* Today's Appointments — only if user can read appointments */}
        {canRead('appointments') && (
          <div className="content-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h6 style={{ fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-calendar-day" style={{ color: '#0891b2' }} />
                {role === 'doctor' ? "My Today's Schedule" : "Today's Appointments"}
              </h6>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 11 }} />
                  <input 
                    value={dashSearch}
                    onChange={e => setDashSearch(e.target.value)}
                    placeholder="Search today..."
                    style={{
                      background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                      borderRadius: 8, padding: '5px 12px 5px 30px', fontSize: 12,
                      width: 160, outline: 'none'
                    }}
                  />
                </div>
                <Link href="/appointments" style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
                  View All <i className="fa-solid fa-arrow-right ms-1" />
                </Link>
              </div>
            </div>

            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div className="skel" style={{ width: 40, height: 40, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ height: 13, width: '60%', marginBottom: 6, borderRadius: 6 }} />
                    <div className="skel" style={{ height: 11, width: '40%', borderRadius: 6 }} />
                  </div>
                </div>
              ))
            ) : todayApts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <i className="fa-regular fa-calendar-xmark fa-2x" style={{ opacity: 0.35, marginBottom: 10, display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No appointments today</div>
                {canRead('appointments') && (
                  <Link
                    href="/appointments"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, fontWeight: 700, color: '#7c3aed', textDecoration: 'none', padding: '8px 16px', background: 'rgba(124,58,237,0.08)', borderRadius: 9 }}
                  >
                    <i className="fa-solid fa-plus" /> Book Appointment
                  </Link>
                )}
              </div>
            ) : (
              todayApts.map((a, i) => {
                const ss = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: i < todayApts.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ss.c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ss.c, fontSize: 16, flexShrink: 0 }}>
                      <i className="fa-solid fa-user-injured" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.patient?.name || 'Patient'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        <i className="fa-solid fa-user-doctor me-1" />Dr. {a.doctor?.name || '—'} &nbsp;·&nbsp;
                        <i className="fa-regular fa-clock me-1" />{a.timeSlot || a.time || '—'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: ss.bg, color: ss.c, textTransform: 'capitalize', flexShrink: 0 }}>
                      {a.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Calendar */}
        <div className="content-card" style={{ padding: 20 }}>
          <h6 style={{ fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-calendar" style={{ color: '#7c3aed' }} />Calendar
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
              {apts.length} apts
            </span>
          </h6>
          <MiniCalendar appointments={apts} />
        </div>
      </div>

      {/* ── Prescription panel (doctor + pharmacist) ── */}
      {(role === 'doctor' || role === 'pharmacist') && canRead('prescriptions') && (
        <div className="content-card mt-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <h6 style={{ fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-prescription" style={{ color: '#7c3aed' }} />
              {role === 'doctor' ? 'Prescription Overview' : 'Pending Dispensals'}
            </h6>
            <div style={{ display: 'flex', gap: 8 }}>
              {role === 'doctor' && (
                <Link
                  href="/prescriptions/new"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
                >
                  <i className="fa-solid fa-plus" />New Prescription
                </Link>
              )}
              <Link
                href="/prescriptions"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
              >
                View All
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Prescriptions', val: stats.prescriptions || 0, icon: 'fa-prescription',    color: '#7c3aed' },
              { label: 'Pending Dispense',     val: stats.rxPending     || 0, icon: 'fa-hourglass-half',  color: '#d97706' },
              { label: 'Dispensed',            val: stats.rxDispensed   || 0, icon: 'fa-circle-check',    color: '#16a34a' },
            ].map((c, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 13, background: 'var(--hover-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  <i className={`fa-solid ${c.icon}`} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .skel {
          background: linear-gradient(90deg, var(--hover-bg) 25%, var(--border-color) 50%, var(--hover-bg) 75%);
          background-size: 200% 100%;
          animation: skelShimmer 1.4s infinite;
        }
        @keyframes skelShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media (max-width: 900px) {
          .dash-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

Dashboard.getLayout = (page) => <Layout>{page}</Layout>;