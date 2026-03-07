import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { Activity, Target, Play, GitBranch } from 'lucide-react';

const navItems = [
  { title: 'Overview', path: '/cockpit', icon: Activity },
  { title: 'Missions', path: '/cockpit/missions', icon: Target },
  { title: 'Runs', path: '/cockpit/runs', icon: Play },
];

export function CockpitSidebar() {
  const location = useLocation();
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card min-h-screen">
      <div className="px-4 py-5">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Agent OS Cockpit</h2>
        <p className="text-xs text-muted-foreground mt-0.5">SmartFunds Operator</p>
      </div>
      <nav className="px-2 space-y-0.5">
        {navItems.map(item => {
          const isActive = item.path === '/cockpit'
            ? location.pathname === '/cockpit'
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/cockpit'}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
              activeClassName=""
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
