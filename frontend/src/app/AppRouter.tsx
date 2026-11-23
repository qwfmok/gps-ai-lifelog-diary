import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/Auth/LoginPage';
import HistoryPage from '../pages/History/HistoryPage';
import DiaryDetailPage from '../pages/History/DiaryDetailPage';
import SettingsPage from '../pages/Settings/SettingsPage';
import TodayPage from '../pages/Today/TodayPage';

export default function AppRouter() {
  const { status } = useAuth();

  if (status === 'LOADING') {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <span className="timeline-state__spinner" aria-hidden="true" />
        <p>로그인 상태를 확인하고 있습니다.</p>
      </main>
    );
  }

  const isAuthenticated = status === 'AUTHENTICATED';

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<TodayPage />} />
        <Route path="history/:diaryId" element={<DiaryDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
