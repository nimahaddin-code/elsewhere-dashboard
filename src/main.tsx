import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { supabaseConfigured } from '../lib/supabase';
import '../app/globals.css';

// Public visitors do not need the staff dashboard or its operational data loaders.
const Page = window.location.pathname.startsWith('/dashboard') || !supabaseConfigured
  ? lazy(() => import('../app/page'))
  : lazy(() => import('../app/landing'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<main className="auth-screen" role="status">Memuat Elsewhere…</main>}>
      <Page />
    </Suspense>
  </React.StrictMode>,
);
