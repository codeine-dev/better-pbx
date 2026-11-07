import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { api } from './lib/api';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExtensionsPage } from './pages/ExtensionsPage';
import { TrunksPage } from './pages/TrunksPage';
import { OutboundRoutesPage } from './pages/OutboundRoutesPage';
import { Shell } from './components/Shell';

const queryClient = new QueryClient();

function Guarded({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const [required, setRequired] = useState<boolean | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const s = await api.setupStatus();
        setRequired(s.setupRequired);
      } catch {
        setRequired(false);
      }
    })();
  }, []);
  if (required === null) return <div className="grid min-h-screen place-items-center">Loading…</div>;
  if (required) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <SetupGuard>
                  <Guarded>
                    <Shell>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/extensions" element={<ExtensionsPage />} />
                        <Route path="/trunks" element={<TrunksPage />} />
                        <Route path="/outbound-routes" element={<OutboundRoutesPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Shell>
                  </Guarded>
                </SetupGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}