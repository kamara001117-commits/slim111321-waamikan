import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  BookOpen,
  Zap
} from 'lucide-react';
import { auth, db } from '@/src/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SUPER_ADMIN_EMAILS } from '@/src/constants/auth';
import Logo from '@/src/components/ui/Logo';
import { initializeSystemAccounts } from '@/src/lib/accountingService';


const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Automatically close sidebar on mobile when route changes
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    // Initialize accounting system accounts
    initializeSystemAccounts();

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/');
        return;
      }

      const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(user.email || '');
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let currentRole = null;

      if (userDoc.exists()) {
        currentRole = userDoc.data().role;
        // Provision if on list but not super_admin
        if (isSuperAdminEmail && currentRole !== 'super_admin') {
          await setDoc(userDocRef, { role: 'super_admin' }, { merge: true });
          currentRole = 'super_admin';
        }
      } else if (isSuperAdminEmail) {
        // Auto-provision
        await setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          role: 'super_admin',
          createdAt: new Date().toISOString()
        });
        currentRole = 'super_admin';
      }

      const allowedRoles = ['admin', 'super_admin', 'staff', 'finance_manager', 'inventory_manager', 'sales_staff', 'hr_staff'];
      if (allowedRoles.includes(currentRole || '')) {
        setAuthorized(true);
        setCurrentUserRole(currentRole);
      } else {
        // For development/new users, if email is allowed, grant access
        if (isSuperAdminEmail) {
          setAuthorized(true);
          setCurrentUserRole('super_admin');
        } else {
          navigate('/');
        }
      }
      setLoading(false);
    });
  }, [navigate]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!authorized) return null;

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
      ]
    },
    {
      title: 'ERP Financials',
      items: [
        { name: 'Accounting', icon: <Calculator size={20} />, path: '/admin/erp/accounting' },
        { name: 'Reports', icon: <BarChart3 size={20} />, path: '/admin/erp/reports' },
        { name: 'Banking', icon: <Wallet size={20} />, path: '/admin/erp/banking' },
        { name: 'Procurement', icon: <ShoppingCart size={20} />, path: '/admin/erp/procurement' },
      ]
    },
    {
      title: 'Organization',
      items: [
        { name: 'HR & Payroll', icon: <Briefcase size={20} />, path: '/admin/erp/hr' },
        { name: 'Logistics', icon: <Truck size={20} />, path: '/admin/logistics' },
        { name: 'Warehouse', icon: <Layers size={20} />, path: '/admin/erp/warehouse' },
        { name: 'CRM Requests', icon: <Bell size={20} />, path: '/admin/crm' },
      ]
    }
  ];

  if (currentUserRole === 'super_admin') {
    sections.push({
      title: 'System',
      items: [
        { name: 'Documents', icon: <Archive size={20} />, path: '/admin/erp/documents' },
        { name: 'Staff', icon: <ShieldCheck size={20} />, path: '/admin/staff' },
        { name: 'Settings', icon: <Settings size={20} />, path: '/admin/settings' },
        { name: 'Logs', icon: <FileSearch size={20} />, path: '/admin/logs' },
      ]
    });
  }

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
      <aside className={`
        bg-[#0B3C5D] text-white transition-all duration-300 flex flex-col z-50
        ${isSidebarOpen ? 'w-64' : 'w-20 -translate-x-full md:translate-x-0'} 
        fixed inset-y-0 left-0 md:relative
      `}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className={`flex-grow flex justify-center ${!isSidebarOpen && 'md:justify-center'}`}>
             <Logo dark className={isSidebarOpen || isMobile ? "h-16" : "h-10"} />
          </div>
          {isMobile && (
            <button className="text-white/50 hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          )}
        </div>
        
        <nav className="flex-grow py-6 px-4 space-y-8 overflow-y-auto custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              {isSidebarOpen && <p className="text-[10px] font-black text-blue-100/30 uppercase tracking-[0.2em] px-3">{section.title}</p>}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                      location.pathname === item.path 
                      ? 'bg-[#EAB308] text-white shadow-lg' 
                      : 'hover:bg-white/10 text-blue-100/70'
                    }`}
                  >
                    {item.icon}
                    {isSidebarOpen && <span className="font-medium text-sm">{item.name}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-4 text-blue-100/50 hover:text-white transition-colors w-full"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button className="md:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              {sections.flatMap(s => s.items).find(i => i.path === location.pathname)?.name || 'Admin'}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell size={20} className="text-gray-400 cursor-pointer" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">{auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0]}</p>
                <p className="text-xs text-[#1F7A8C] font-black uppercase tracking-widest leading-none mt-1">
                   {currentUserRole?.replace('_', ' ')}
                </p>
              </div>
              <img 
                src={auth.currentUser?.photoURL || 'https://ui-avatars.com/api/?name=Admin'} 
                className="w-10 h-10 rounded-full border-2 border-[#EAB308]"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        {/* Dynamic Page */}
        <main className="flex-grow overflow-y-auto p-8">
          <Outlet context={{ currentUserRole }} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
