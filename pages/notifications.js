import Layout from '../components/layout/Layout';
import SEOHead from '../components/ui/SEOHead';
import BackButton from '../components/ui/BackButton';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { confirmAction } from '../utils/sweetAlert';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=100');
      setNotifications(data.data || []);
    } catch (e) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      toast.error('Failed to mark as read');
    }
  };

  const deleteNotif = async (id) => {
    if (!await confirmAction('Delete Notification?', 'Delete this notification?', 'Yes, delete')) return;
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n._id !== id));
      toast.success('Deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const getIcon = (module) => {
    switch (module) {
      case 'patients':     return 'fa-user-injured';
      case 'doctors':      return 'fa-user-doctor';
      case 'appointments': return 'fa-calendar-check';
      case 'medicines':    return 'fa-pills';
      case 'inventory':    return 'fa-boxes-stacked';
      default:             return 'fa-bell';
    }
  };

  return (
    <>
      <SEOHead title="Notifications" path="/notifications" />
      <div>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <BackButton />
            <h4 style={{ fontWeight: 900, margin: 0 }}>Notifications</h4>
          </div>
        </div>

        <div className="content-card">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-bell-slash fa-3x mb-3 opacity-20" />
              <h5>No notifications yet</h5>
              <p>System alerts and updates will appear here.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {notifications.map(n => (
                <div key={n._id} className={`list-group-item py-3 ${!n.isRead ? 'bg-light' : ''}`} 
                  style={{ borderBottom: '1px solid var(--border-color)', background: !n.isRead ? 'var(--hover-bg)' : 'transparent' }}>
                  <div className="d-flex gap-3">
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: n.type === 'warning' ? 'rgba(217,119,6,0.1)' : n.type === 'error' ? 'rgba(220,38,38,0.1)' : 'rgba(8,145,178,0.1)',
                      color: n.type === 'warning' ? '#d97706' : n.type === 'error' ? '#dc2626' : '#0891b2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <i className={`fa-solid ${getIcon(n.module)}`} />
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between">
                        <h6 style={{ fontWeight: 700, margin: 0, fontSize: 15 }}>{n.title}</h6>
                        <small className="text-muted">{new Date(n.createdAt).toLocaleString()}</small>
                      </div>
                      <p className="mb-2 mt-1" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{n.message}</p>
                      <div className="d-flex gap-2">
                        {!n.isRead && (
                          <button onClick={() => markRead(n._id)} className="btn btn-sm btn-outline-primary" style={{ fontSize: 11 }}>Mark Read</button>
                        )}
                        <button onClick={() => deleteNotif(n._id)} className="btn btn-sm btn-outline-danger" style={{ fontSize: 11 }}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

NotificationsPage.getLayout = (page) => <Layout>{page}</Layout>;
