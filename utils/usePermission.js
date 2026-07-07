import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ROLE_PERMISSIONS = {
  admin:         ['/', '/patients', '/doctors', '/appointments', '/admissions', '/pharmacy', '/pharmacy/medicines', '/pharmacy/billing', '/inventory', '/inventory/items', '/billing', '/settings/users'],
  doctor:        ['/', '/patients', '/doctors', '/appointments', '/admissions'],
  pharmacist:    ['/', '/patients', '/pharmacy', '/pharmacy/medicines', '/pharmacy/billing'],
  store_manager: ['/', '/inventory', '/inventory/items'],
  receptionist:  ['/', '/patients', '/doctors', '/appointments', '/billing'],
  nurse:         ['/', '/patients', '/admissions'],
};

export function usePermission(requiredPath) {
  const { user } = useAuth();
  const router   = useRouter();
  const role     = user?.role || 'receptionist';
  const allowed  = ROLE_PERMISSIONS[role] || [];
  const hasAccess = allowed.some(p =>
    requiredPath === '/' ? p === '/' : requiredPath.startsWith(p)
  );

  useEffect(() => {
    if (user && !hasAccess) {
      router.replace('/403');
    }
  }, [user, hasAccess]);

  return hasAccess;
}