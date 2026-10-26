import { Link, Outlet } from 'react-router';
import BottomNavigation from '../components/navigation/BottomNavigation';
import { LocationProvider } from '../hooks/useLocation';

export default function AppLayout() {
  const appName = import.meta.env.VITE_APP_NAME?.trim() || 'LifeLog Diary';

  return (
    <LocationProvider>
      <div className="app-shell">
        <header className="app-header">
          <Link className="brand" to="/" aria-label={`${appName} 홈`}>
            <span className="brand-mark" aria-hidden="true">
              L
            </span>
            <span className="brand-name">{appName}</span>
          </Link>
          <p className="header-caption">나의 하루를 차분히 기록해요</p>
        </header>

        <main className="app-main" id="main-content">
          <Outlet />
        </main>

        <BottomNavigation />
      </div>
    </LocationProvider>
  );
}
