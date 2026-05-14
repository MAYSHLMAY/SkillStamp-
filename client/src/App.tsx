import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './hooks/useAuth';
import { AuthGuard } from './components/AuthGuard';
import { AppLayout } from './components/AppLayout';
import { JobsPage } from './pages/JobsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CandidateDashboardPage } from './pages/CandidateDashboardPage';
import { EmployerDashboardPage } from './pages/EmployerDashboardPage';
import { EmployerJobNewPage } from './pages/EmployerJobNewPage';
import { ApplicantsPage } from './pages/ApplicantsPage';
import { EmployerSessionsPage } from './pages/EmployerSessionsPage';
import { ApplyPage } from './pages/ApplyPage';
import { VerifyPage } from './pages/VerifyPage';
import { CandidateSessionPage } from './pages/CandidateSessionPage';

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster richColors theme="dark" position="bottom-right" />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify/:sessionId" element={<VerifyPage />} />
            </Route>

            <Route element={<AuthGuard role="candidate" />}>
              <Route element={<AppLayout />}>
                <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
                <Route path="/candidate/sessions/:sessionId" element={<CandidateSessionPage />} />
                <Route path="/jobs/:id/apply" element={<ApplyPage />} />
              </Route>
            </Route>

            <Route element={<AuthGuard role="employer" />}>
              <Route element={<AppLayout />}>
                <Route path="/employer/dashboard" element={<EmployerDashboardPage />} />
                <Route path="/employer/jobs/new" element={<EmployerJobNewPage />} />
                <Route path="/employer/jobs/:jobId/applicants" element={<ApplicantsPage />} />
                <Route path="/employer/sessions" element={<EmployerSessionsPage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="*" element={<Navigate to="/jobs" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
