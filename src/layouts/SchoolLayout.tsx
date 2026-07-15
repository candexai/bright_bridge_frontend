import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { TopNavbar } from '../components/TopNavbar';
import { useAuthStore } from '../store/authStore';
import { TourProvider } from '../tour/TourProvider';

export const SchoolLayout = () => {
  const { user } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user || user.role !== 'school') {
    return null;
  }

  return (
    <TourProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar role="school" isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all duration-300">
          <TopNavbar onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50 transition-all">
            <Outlet />
          </main>
        </div>
      </div>
    </TourProvider>
  );
};

