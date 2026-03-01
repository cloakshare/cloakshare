import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import NotificationBell from './NotificationBell';

const navItems = [
  { label: 'Links', path: '/dashboard/links' },
  { label: 'API Keys', path: '/dashboard/api-keys' },
  { label: 'Team', path: '/dashboard/team' },
  { label: 'Audit Log', path: '/dashboard/audit-log' },
  { label: 'Billing', path: '/dashboard/billing' },
  { label: 'Settings', path: '/dashboard/settings' },
];

export default function DashboardLayout() {
  const { user, logout, activeOrg, switchOrg } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-56 bg-surface border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border-subtle">
          <span className="flex items-center gap-2 font-mono font-bold text-lg text-foreground tracking-tight">
            <img src="/logo.png" alt="CloakShare" className="w-6 h-6" />
            CloakShare
          </span>
        </div>

        {/* Org Switcher */}
        {user?.orgs && user.orgs.length > 1 && (
          <div className="px-3 pt-3">
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => switchOrg(e.target.value)}
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
            >
              {user.orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-mono transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-elevated'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-text-secondary truncate font-mono">{user?.email}</p>
              <p className="text-xs text-text-tertiary mt-0.5 uppercase tracking-wide">
                {activeOrg?.plan || user?.plan}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="text-xs text-text-tertiary hover:text-text-primary transition-colors font-mono"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 min-h-screen">
        <div className="max-w-5xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
