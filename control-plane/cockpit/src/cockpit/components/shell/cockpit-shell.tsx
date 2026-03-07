import { Outlet } from 'react-router-dom';
import { CockpitSidebar } from './sidebar';
import { Topbar } from './topbar';

export function CockpitShell() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <CockpitSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
