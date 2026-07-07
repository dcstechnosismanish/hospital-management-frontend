import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  let token = Cookies.get('token');
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    // 1. Handle session expiration
    if (err.response?.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      Cookies.remove('token');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    // 2. Attach a normalized message for components to use
    // Priority: API friendly message > fallback
    err.friendlyMessage = err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
    
    return Promise.reject(err);
  }
);

export default api;