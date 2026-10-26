import { Navigate, Route, Routes } from 'react-router';
import AppLayout from '../layouts/AppLayout';
import HistoryPage from '../pages/History/HistoryPage';
import DiaryDetailPage from '../pages/History/DiaryDetailPage';
import SettingsPage from '../pages/Settings/SettingsPage';
import TodayPage from '../pages/Today/TodayPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="history/:diaryId" element={<DiaryDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
