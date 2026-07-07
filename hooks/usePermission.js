import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Module-level cache — cleared when role changes
let _cachedRole  = null;
let _cachedPerms = null;

// ✅ Standalone named export — imported directly by AuthContext
// Must be at module level, NOT inside the hook function
export const clearPermissionCache = () => {
  _cachedRole  = null;
  _cachedPerms = null;
};

export function usePermission() {
  const { user, loading: authLoading } = useAuth();
  const [permMap, setPermMap] = useState(_cachedPerms || {});
  const [loading, setLoading] = useState(true); // Default to true

  useEffect(() => {
    // 1. Wait for auth state to be determined
    if (authLoading) {
      setLoading(true);
      return;
    }

    // 2. If no user after auth loaded, stop loading (deny all)
    if (!user?.role) {
      setLoading(false);
      return;
    }

    // 3. SUPERADMIN BYPASS — full access to everything
    if (user.role === 'superadmin' || user.role === 'admin') {
      console.log(`[usePermission] Superadmin detected: ${user.role}. Bypassing DB permissions.`);
      setLoading(false);
      setPermMap({});
      return;
    }

    // Use cache only if same role
    if (_cachedRole === user.role && _cachedPerms) {
      setPermMap(_cachedPerms);
      setLoading(false);
      return;
    }

    // ✅ ALL other roles — load permissions from DB
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/roles/my-permissions');
        const found    = data.data;

        if (found && found.permissions) {
          const map = {};
          (found.permissions || []).forEach(p => { map[p.module] = p; });
          _cachedRole  = user.role;
          _cachedPerms = map;
          setPermMap(map);
        } else {
          // Role not found in DB — deny everything
          _cachedRole  = user.role;
          _cachedPerms = {};
          setPermMap({});
        }
      } catch (e) {
        console.error('usePermission: failed to load', e.message);
        setPermMap({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.role, authLoading]);

  // ── Helper functions ─────────────────────────────────────────
  // ✅ Superadmin always gets true for everything
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const can       = (module, action = 'read') => isSuperAdmin || !!permMap[module]?.[action];
  const canRead   = (module) => isSuperAdmin || can(module, 'read');
  const canCreate = (module) => isSuperAdmin || can(module, 'create');
  const canUpdate = (module) => isSuperAdmin || can(module, 'update');
  const canDelete = (module) => isSuperAdmin || can(module, 'delete');

  // Also expose as hook return for any component that needs to clear manually
  const clearPermCache = () => {
    clearPermissionCache();   // reuse the module-level function
    setPermMap({});
  };

  return { can, canRead, canCreate, canUpdate, canDelete, permMap, loading, clearPermCache };
}