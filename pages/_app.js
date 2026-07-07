import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/globals.css';
import '../styles/theme.css';
import '../styles/animations.css';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    require('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);

  const getLayout = Component.getLayout || ((page) => page);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" containerStyle={{ zIndex: 10000 }} toastOptions={{
          style: { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
        }} />
        {getLayout(<Component {...pageProps} />)}
      </AuthProvider>
    </ThemeProvider>
  );
}