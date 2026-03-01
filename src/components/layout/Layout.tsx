import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';
import { ModeToggle } from '@/components/mode-toggle';

export function Layout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 justify-end">
          <ModeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
