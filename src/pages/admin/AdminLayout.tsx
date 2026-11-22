import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  CreditCard,
  ShieldCheck,
  Calculator,
  Wallet,
  ShoppingCart,
  Truck,
  Briefcase,
  Layers,
  FileSearch,
  Archive,
  Zap,
  LogIn,
  Loader2,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import Logo from '@/src/components/ui/Logo';
import { initializeSystemAccounts } from '@/src/lib/accountingService';

const AdminLayout = () => {
  const { user, role, loading, signingIn, isAdmin, loginWithGoogle, signOutUser } = useAuth();
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Only initialize system chart-of-accounts AFTER authenticated admin role is confirmed
  useEffect(() => {
    if (user && isAdmin) {
      initializeSystemAccounts().catch((err) => {
        console.error('Chart of accounts initialization failed:', err);
      });
    }
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7FAFC] gap-4">
        <Loader2 className="w-10 h-10 text-[#0B3C5D] animate-spin" />
        <p className="text-sm font-bold text-gray-500">Verifying Admin Session...</p>
      </div>
    );
  }

  // Dedicated Admin Sign-In Gate when not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-md w-full p-8 sm:p-10 text-center space-y-6">
          <div className="flex justify-center">
            <Logo className="h-16" />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-blue-50 text-[#1F7A8C] rounded-full text-[10px] font-black uppercase tracking-widest">
              Staff &amp; Admin Portal
            </span>
            <h1 className="text-2xl font-black text-[#0B3C5D]">Sign in to Admin Console</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Sign in with your authorized WAAMIKAN Enterprise Google account to access inventory,
              sales, accounting, and operations.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              disabled={signingIn}
              className="w-full py-4 px-6 rounded-2xl bg-[#0B3C5D] text-white font-bold hover:bg-[#1F7A8C] transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {signingIn ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}
            </button>
            <Link
              to="/"
              className="w-full py-3.5 px-6 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, but account is not an authorized staff/admin role
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-md w-full p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 text-[#EAB308] rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={34} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[#0B3C5D]">Admin Access Required</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Signed in as <span className="font-bold text-gray-800">{user.email}</span> (Role:{' '}
              <span className="uppercase font-bold text-[#1F7A8C]">{role || 'customer'}</span>).
              This account does not have staff or administrator permissions.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                await signOutUser();
                await loginWithGoogle();
              }}
              disabled={signingIn}
              className="w-full py-4 px-6 rounded-2xl bg-[#0B3C5D] text-white font-bold hover:bg-[#1F7A8C] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {signingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              Switch Google Account
            </button>
            <Link
              to="/"
              className="w-full py-3.5 px-6 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const effectiveRole = role || 'super_admin';

  const sections = [
    {
      title: 'Operations',
      items: [
        { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin' },
        { name: 'Sales Workflow', icon: <Zap size={20} />, path: '/admin/erp/sales' },
        { name: 'Inventory', icon: <Package size={20} />, path: '/admin/inventory' },
        { name: 'Invoices', icon: <FileText size={20} />, path: '/admin/invoices' },
        { name: 'Receipts', icon: <CreditCard size={20} />, path: '/admin/receipts' },
        { name: 'Clients', icon: <Users size={20} />, path: '/admin/customers' },
        { name: 'Analytics', icon: <BarChart3 size={20} />, path: '/admin/analytics' },
      ],
    },
    {
      title: 'ERP Financials',
      items: [
        { name: 'Accounting', icon: <Calculator size={20} />, path: '/admin/erp/accounting' },
        { name: 'Reports', icon: <BarChart3 size={20} />, path: '/admin/erp/reports' },
        { name: 'Banking', icon: <Wallet size={20} />, path: '/admin/erp/banking' },
        { name: 'Procurement', icon: <ShoppingCart size={20} />, path: '/admin/erp/procurement' },
      ],
    },
    {
      title: 'Organization',
      items: [
        { name: 'HR & Payroll', icon: <Briefcase size={20} />, path: '/admin/erp/hr' },
        { name: 'Logistics', icon: <Truck size={20} />, path: '/admin/logistics' },
        { name: 'Warehouse', icon: <Layers size={20} />, path: '/admin/erp/warehouse' },
        { name: 'CRM Requests', icon: <Bell size={20} />, path: '/admin/crm' },
      ],
    },
  ];

  if (effectiveRole === 'super_admin' || effectiveRole === 'admin') {
    sections.push({
      title: 'System',
      items: [
        { name: 'Documents', icon: <Archive size={20} />, path: '/admin/erp/documents' },
        { name: 'Staff', icon: <ShieldCheck size={20} />, path: '/admin/staff' },
        { name: 'Settings', icon: <Settings size={20} />, path: '/admin/settings' },
        { name: 'Logs', icon: <FileSearch size={20} />, path: '/admin/logs' },
      ],
    });
  }

  const activeTitle =
    sections.flatMap((s) => s.items).find((i) => i.path === location.pathname)?.name || 'Admin';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          bg-[#0B3C5D] text-white transition-all duration-300 flex flex-col z-50 shrink-0
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}
          fixed inset-y-0 left-0 md:relative
        `}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex-grow flex justify-center">
            <Logo dark className={isSidebarOpen || isMobile ? 'h-16' : 'h-10'} />
          </div>
          {isMobile && (
            <button
              type="button"
              aria-label="Close Sidebar"
              className="text-white/70 hover:text-white transition-colors p-1"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="flex-grow py-6 px-4 space-y-8 overflow-y-auto custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              {(isSidebarOpen || isMobile) && (
                <p className="text-[10px] font-black text-blue-100/30 uppercase tracking-[0.2em] px-3">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => {
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                      location.pathname === item.path
                        ? 'bg-[#EAB308] text-[#0B3C5D] font-bold shadow-lg'
                        : 'hover:bg-white/10 text-blue-100/80'
                    }`}
                  >
                    {item.icon}
                    {(isSidebarOpen || isMobile) && (
                      <span className="font-medium text-sm">{item.name}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <button
            type="button"
            onClick={signOutUser}
            className="flex items-center gap-4 text-blue-100/60 hover:text-white transition-colors w-full"
          >
            <LogOut size={20} />
            {(isSidebarOpen || isMobile) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open Navigation Menu"
              className="md:hidden p-2 -ml-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 truncate">{activeTitle}</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <Link to="/admin/crm" className="relative text-gray-400 hover:text-[#0B3C5D]">
              <Bell size={20} />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-[#1F7A8C] font-black uppercase tracking-widest leading-none mt-1">
                  {effectiveRole.replace(/_/g, ' ')}
                </p>
              </div>
              <img
                src={
                  user.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.displayName || 'Admin'
                  )}&background=0B3C5D&color=fff`
                }
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#EAB308] object-cover"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        {/* Dynamic Page */}
        <main className="flex-grow overflow-y-auto p-4 sm:p-8">
          <Outlet context={{ currentUserRole: effectiveRole }} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
