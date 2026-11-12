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
import { InboundRoutesPage } from './pages/InboundRoutesPage';
import { RingGroupsPage } from './pages/RingGroupsPage';
import { IvrsPage } from './pages/IvrsPage';
import { PromptsPage } from './pages/PromptsPage';
import { MusicOnHoldPage } from './pages/MusicOnHoldPage';
import { VoicemailPage } from './pages/VoicemailPage';
import { SettingsPage } from './pages/SettingsPage';
import { SecurityPage } from './pages/SecurityPage';
import { SnapshotsPage } from './pages/SnapshotsPage';
import { LogsPage } from './pages/LogsPage';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/Toast';

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
      <ToastProvider>
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
                        <Route path="/inbound-routes" element={<InboundRoutesPage />} />
                        <Route path="/ring-groups" element={<RingGroupsPage />} />
                        <Route path="/ivrs" element={<IvrsPage />} />
                        <Route path="/prompts" element={<PromptsPage />} />
                        <Route path="/music-on-hold" element={<MusicOnHoldPage />} />
                        <Route path="/voicemail" element={<VoicemailPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/security" element={<SecurityPage />} />
                        <Route path="/snapshots" element={<SnapshotsPage />} />
                        <Route path="/logs" element={<LogsPage />} />
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
      </ToastProvider>
    </QueryClientProvider>
  );
}