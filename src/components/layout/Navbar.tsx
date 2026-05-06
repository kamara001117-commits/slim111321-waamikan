import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, User, LogIn, LogOut, ChevronDown, ShoppingBag, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout } from '@/src/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { SUPER_ADMIN_EMAILS } from '@/src/constants/auth';
import { useCart } from '@/src/lib/CartContext';

import Logo from '@/src/components/ui/Logo';

export const Navbar = () => {
  const { cartCount } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Force super_admin role for specific emails
        const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(u.email || '');
        
        const userDocRef = doc(db, 'users', u.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const storedRole = userDoc.data().role;
          // If they are on the list but don't have super_admin role in DB, update it
          if (isSuperAdminEmail && storedRole !== 'super_admin') {
            await setDoc(userDocRef, { role: 'super_admin' }, { merge: true });
            setRole('super_admin');
          } else {
            setRole(storedRole);
          }
        } else if (isSuperAdminEmail) {
          // New super admin login, provision them
          await setDoc(userDocRef, {
            email: u.email,
            displayName: u.displayName,
            role: 'super_admin',
            createdAt: new Date().toISOString()
          });
          setRole('super_admin');
        } else {
          setRole(null);
        }
      } else {
        setRole(null);
      }
    });
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Products', href: '/products' },
    { name: 'Clients', href: '/clients' },
    { name: 'Contact', href: '/contact' },
  ];

  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'staff';

  const formatRole = (r: string | null) => {
    if (!r) return '';
    return r.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center text-center">
            <Link to="/" className="flex-shrink-0 flex items-center justify-center">
              <Logo className="h-20" />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`text-sm font-bold transition-colors ${
                  location.pathname === link.href 
                  ? 'text-[#0B3C5D]' 
                  : 'text-gray-500 hover:text-[#0B3C5D]'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end mr-2">
                  <span className="text-[10px] font-black uppercase text-[#1F7A8C] tracking-widest">{formatRole(role)}</span>
                  <span className="text-xs font-bold text-gray-800">{user.displayName || user.email?.split('@')[0]}</span>
                </div>
                <div className="flex flex-col items-start mr-4">
                  <Link 
                    to="/orders" 
                    className="text-[#0B3C5D] font-bold text-sm hover:underline flex items-center gap-1"
                  >
                    <Package size={14} />
                    My Orders
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      className="text-[#1F7A8C] font-bold text-[10px] uppercase tracking-wider hover:underline"
                    >
                      Admin Console
                    </Link>
                  )}
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="text-gray-500 font-bold text-sm hover:text-[#0B3C5D]"
              >
                Login
              </button>
            )}
            
            <Link 
              to="/contact" 
              className="bg-[#1F7A8C] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-teal-900/10 hover:bg-[#0B3C5D] transition-all"
            >
              Request Quote
            </Link>
            <button className="p-2 text-gray-500 hover:text-[#0B3C5D]">
              <Search className="w-5 h-5" />
            </button>

            <Link to="/cart" className="p-2 text-gray-500 hover:text-[#0B3C5D] relative group">
              <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EAB308] text-[#0B3C5D] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="block px-3 py-4 text-base font-medium text-gray-700 hover:text-[#0B3C5D] hover:bg-gray-50 rounded-lg"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
                {user && (
                  <div className="px-3 py-2 bg-gray-50 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#1F7A8C] tracking-widest">{formatRole(role)}</p>
                      <p className="text-sm font-bold text-gray-800">{user.displayName || user.email?.split('@')[0]}</p>
                    </div>
                    <Link 
                      to="/orders" 
                      className="px-4 py-2 bg-white border border-gray-100 rounded-lg text-sm font-bold text-[#0B3C5D]"
                      onClick={() => setIsOpen(false)}
                    >
                      Orders
                    </Link>
                    <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <Link 
                  to="/contact" 
                   className="bg-[#1F7A8C] text-white px-5 py-3 rounded-xl font-bold text-center"
                  onClick={() => setIsOpen(false)}
                >
                  Request Quote
                </Link>
                {user && isAdmin && (
                  <Link 
                    to="/admin" 
                    className="bg-[#0B3C5D] text-white px-5 py-3 rounded-xl font-medium text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
                <Link 
                  to="/cart" 
                  className="bg-gray-100 text-[#0B3C5D] px-5 py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <ShoppingBag size={18} />
                  My Cart ({cartCount})
                </Link>
                {!user && (
                   <button 
                    onClick={() => { signInWithGoogle(); setIsOpen(false); }}
                    className="bg-[#EAB308] text-white px-5 py-3 rounded-xl font-medium w-full text-center"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export const Footer = () => {
  return (
    <footer className="bg-[#0B3C5D] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <Link to="/" className="flex items-center">
              <Logo className="h-24" dark />
            </Link>
            <p className="text-blue-100/70 text-sm leading-relaxed max-w-xs">
              Advancing healthcare solutions in Ghana and beyond. WAAMIKAN is committed to excellence in medical supplies and imaging technology.
            </p>
            <div className="flex space-x-4">
              {/* Social icons placeholder */}
              <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">F</div>
              <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">I</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-lg">Company</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Products</Link></li>
              <li><Link to="/clients" className="hover:text-white transition-colors">Clients</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Request Quote</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Solutions</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li><Link to="/products" className="hover:text-white transition-colors">Medical Consumables</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Imaging Equipment</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Hospital Furniture</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Life Support Systems</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Support</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><span className="block italic mt-4 text-xs opacity-50">Email: Waamikan@gmail.com</span></li>
              <li><span className="block italic mt-1 text-xs opacity-50">Tel: +233(0) 20 898 7185</span></li>
              <li><span className="block italic mt-1 text-xs opacity-50">Tel: 0537212475</span></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-blue-100/50">
          <p>© 2026 WAAMIKAN Enterprise. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
            <Link to="/cookies">Cookie Settings</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
