import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Links from './pages/Links';
import LinkDetail from './pages/LinkDetail';
import ApiKeys from './pages/ApiKeys';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Team from './pages/Team';
import AuditLog from './pages/AuditLog';
import DashboardLayout from './components/DashboardLayout';
import './index.css';

// Initialize PostHog if configured
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (posthogKey) {
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
    });
    window.posthog = posthog;
  }).catch(() => {
    // PostHog failed to load - continue without analytics
  });
}


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Links />} />
            <Route path="links" element={<Links />} />
            <Route path="links/:id" element={<LinkDetail />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="team" element={<Team />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
