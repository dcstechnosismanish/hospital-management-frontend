import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import api from '../utils/api';
import { useRouter } from 'next/router';
import { clearPermissionCache } from '../hooks/usePermission';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let token = Cookies.get('token');
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('token');
    }
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data.user))
        .catch(() => {
          Cookies.remove('token');
          if (typeof window !== 'undefined') localStorage.removeItem('token');
          clearPermissionCache();   // ✅ clear stale perms if token is invalid
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    Cookies.set('token', res.data.token, { expires: 7, path: '/' });
    if (typeof window !== 'undefined') localStorage.setItem('token', res.data.token);
    clearPermissionCache();   // ✅ clear previous user's cached permissions
    setUser(res.data.user);
    router.push('/');
    return res.data;
  };

  const logout = () => {
    Cookies.remove('token', { path: '/' });
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    clearPermissionCache();   // ✅ clear perms so next login starts fresh
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);