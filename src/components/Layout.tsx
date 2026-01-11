import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import AdminNavbar from './AdminNavbar';
import Footer from './Footer';
import { useAuthStore } from '@/store/useAuthStore';

const Layout = () => {
  const { checkUser } = useAuthStore();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  return (
    <div className="flex flex-col min-h-screen">
      {isAdminRoute ? <AdminNavbar /> : <Navbar />}
      <main className="flex-grow">
        <Outlet />
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
};

export default Layout;