import { NavLink } from 'react-router';

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4.2 8.2A8.5 8.5 0 1 1 3.5 12" />
      <path d="M3.5 4.5v4h4M12 7.5V12l3 1.8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3.5 14 4l1 2 2 .8 2-.5 1.5 2.6-1.2 1.7v2.3l1.2 1.7-1.5 2.6-2-.5-2 .8-1 2-2 .5-2-.5-1-2-2-.8-2 .5-1.5-2.6 1.2-1.7v-2.3L3.5 9l1.5-2.6 2 .5 2-.8 1-2 2-.6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const navigationItems = [
  { label: 'Today', to: '/', Icon: TodayIcon, end: true },
  { label: 'History', to: '/history', Icon: HistoryIcon, end: false },
  { label: 'Settings', to: '/settings', Icon: SettingsIcon, end: false },
];

export default function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      <div className="bottom-navigation-inner">
        {navigationItems.map(({ label, to, Icon, end }) => (
          <NavLink
            className={({ isActive }) =>
              `navigation-link${isActive ? ' navigation-link-active' : ''}`
            }
            end={end}
            key={to}
            to={to}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
