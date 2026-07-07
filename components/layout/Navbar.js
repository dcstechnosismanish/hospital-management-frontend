import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import api from '../../utils/api';
import { confirmAction } from '../../utils/sweetAlert';

export default function Navbar({ onMenuClick, sidebarCollapsed }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const notifRef = useRef(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef(null);


  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications?limit=5');
      setNotifications(data.data || []);
    } catch (e) {
      if (e.response?.status !== 401) {
        console.error('Failed to fetch notifications', e);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setDark(true);
    }
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (search.trim().length > 1) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.get(`/patients?search=${encodeURIComponent(search)}&limit=5`);
          setSuggestions(res.data.data || []);
          setShowSuggestions(true);
        } catch (e) {
          setSuggestions([]);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [search]);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    if (await confirmAction('Logout?', 'Are you sure you want to log out?', 'Yes, Logout')) {
      logout();
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      router.push(`/patients?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  const getNotifIcon = (module) => {
    switch (module) {
      case 'patients':     return 'fa-user-injured';
      case 'doctors':      return 'fa-user-doctor';
      case 'appointments': return 'fa-calendar-check';
      case 'medicines':    return 'fa-pills';
      case 'inventory':    return 'fa-boxes-stacked';
      default:             return 'fa-bell';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav className="top-navbar">
      {/* Left — hamburger + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
            borderRadius: 10, width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s',
            flexShrink: 0
          }}
          title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
        >
          <i className="fa-solid fa-bars" />
        </button>
      </div>

      {/* Right — theme + notifications + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggleTheme} style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <i className={`fa-solid ${dark ? 'fa-sun' : 'fa-moon'}`} />
        </button>

        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            style={{ position: 'relative', background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <i className="fa-solid fa-bell" />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--navbar-bg)' }} />
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: 320,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)',
              borderRadius: 16, boxShadow: 'var(--shadow-lg)', zIndex: 1000,
              overflow: 'hidden', animation: 'fadeInDown 0.2s ease-out'
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h6 style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>Notifications</h6>
                <span onClick={markAllRead} style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>Mark all as read</span>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-bell-slash d-block mb-2 opacity-50" />
                    <span style={{ fontSize: 12 }}>No new notifications</span>
                  </div>
                ) : notifications.map(n => (
                  <div key={n._id} className="notif-item" style={{
                    padding: '12px 18px', display: 'flex', gap: 12,
                    borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                    transition: 'background 0.2s',
                    background: n.isRead ? 'transparent' : 'var(--hover-bg)'
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: n.type === 'warning' ? 'rgba(217,119,6,0.1)' : n.type === 'error' ? 'rgba(220,38,38,0.1)' : 'rgba(8,145,178,0.1)',
                      color: n.type === 'warning' ? '#d97706' : n.type === 'error' ? '#dc2626' : '#0891b2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <i className={`fa-solid ${getNotifIcon(n.module)}`} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px', textAlign: 'center', background: 'var(--hover-bg)' }}>
                <Link href="/notifications" onClick={() => setNotifOpen(false)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textDecoration: 'none' }}>View all notifications</Link>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-right-from-bracket" />
          <span className="d-none d-sm-inline">Logout</span>
        </button>
      </div>

      <style jsx>{`
        .notif-item:hover { background: var(--hover-bg); }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
  );
}