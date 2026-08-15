import { useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useJobsStore } from './store';
import { DashboardLayout } from './components/DashboardLayout';
import { SignInPage } from './routes/SignIn/SignInPage';
import { Spinner } from '@refloop/ui';

// Lazy-load route modules for faster initial paint
const JobsPage = lazy(() => import('./routes/Jobs/JobsPage').then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() => import('./routes/Jobs/JobDetailPage').then((m) => ({ default: m.JobDetailPage })));
const LaunchControlPage = lazy(() => import('./routes/LaunchControl/LaunchControlPage').then((m) => ({ default: m.LaunchControlPage })));
const FollowUpQueuePage = lazy(() => import('./routes/FollowUpQueue/FollowUpQueuePage').then((m) => ({ default: m.FollowUpQueuePage })));
const ReferralReceivedPage = lazy(() => import('./routes/ReferralReceived/ReferralReceivedPage').then((m) => ({ default: m.ReferralReceivedPage })));
const HistoryPage = lazy(() => import('./routes/History/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import('./routes/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EmailFinderPage = lazy(() => import('./routes/EmailFinder/EmailFinderPage').then((m) => ({ default: m.EmailFinderPage })));

export function App() {
  const { user, loading: authLoading } = useAuthStore();
  const { loading: jobsLoading } = useJobsStore();

  useEffect(() => {
    const theme = localStorage.getItem('refloop_theme') || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const loading = authLoading || jobsLoading;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  return (
    <HashRouter>
      <DashboardLayout>
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/launch" element={<LaunchControlPage />} />
            <Route path="/followups" element={<FollowUpQueuePage />} />
            <Route path="/referrals" element={<ReferralReceivedPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/email-finder" element={<EmailFinderPage />} />
          </Routes>
        </Suspense>
      </DashboardLayout>
    </HashRouter>
  );
}
