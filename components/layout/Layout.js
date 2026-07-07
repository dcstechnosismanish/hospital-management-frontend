import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile]   = useState(false);
  const router = useRouter();

  // Detect screen size
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      // On desktop default open, on mobile default hidden
      if (mobile) setCollapsed(true);
      else setCollapsed(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on mobile route change
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [router.pathname]);

  const toggle = () => setCollapsed(prev => !prev);

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : 'sidebar-open'}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} onMobileClose={isMobile ? () => setCollapsed(true) : undefined} />
      <div className="main-content">
        <Navbar onMenuClick={toggle} sidebarCollapsed={collapsed} />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}