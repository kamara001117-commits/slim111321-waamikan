import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Search,
  LogOut,
  ShoppingBag,
  Package,
  Facebook,
  Instagram,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/lib/AuthContext';
import { useCart } from '@/src/lib/CartContext';
import { COMPANY_INFO } from '@/src/constants/auth';
import Logo from '@/src/components/ui/Logo';

export const Navbar = () => {
  const { cartCount } = useCart();
  const { user, role, isAdmin, signingIn, loginWithGoogle, signOutUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Products', href: '/products' },
    { name: 'Clients', href: '/clients' },
    { name: 'Contact', href: '/contact' },
  ];

  const formatRole = (r: string | null) => {
    if (!r) return 'Customer';
    return r
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
    setSearchOpen(false);
    setIsOpen(false);
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center text-center">
            <Link to="/" className="flex-shrink-0 flex items-center justify-center">
              <Logo className="h-14 sm:h-20" />
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
                <div className="flex flex-col items-end mr-1">
                  <span className="text-[10px] font-black uppercase text-[#1F7A8C] tracking-widest">
                    {formatRole(role)}
                  </span>
                  <span className="text-xs font-bold text-gray-800 max-w-[140px] truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <div className="flex flex-col items-start mr-2">
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
                      className="text-[#1F7A8C] font-bold text-[10px] uppercase tracking-wider hover:underline flex items-center gap-1"
                    >
                      <ShieldCheck size={11} />
                      Admin Console
                    </Link>
                  )}
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={signOutUser}
                  title="Sign Out"
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                disabled={signingIn}
                className="text-gray-600 font-bold text-sm hover:text-[#0B3C5D] px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                {signingIn ? 'Signing in...' : 'Login'}
              </button>
            )}

            <Link
              to="/contact"
              className="bg-[#1F7A8C] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-teal-900/10 hover:bg-[#0B3C5D] transition-all whitespace-nowrap"
            >
              Request Quote
            </Link>

            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Search Products"
              className={`p-2 rounded-xl transition-colors ${
                searchOpen ? 'bg-blue-50 text-[#0B3C5D]' : 'text-gray-500 hover:text-[#0B3C5D]'
              }`}
            >
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

          <div className="md:hidden flex items-center gap-2">
            <Link to="/cart" className="p-2 text-gray-600 hover:text-[#0B3C5D] relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-[#EAB308] text-[#0B3C5D] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle Menu"
              className="p-2 text-gray-600"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Expandable Search Bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSearchSubmit}
              className="hidden md:flex items-center gap-3 pb-4 overflow-hidden"
            >
              <div className="relative flex-grow">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search medical equipment, consumables, or SKUs..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1F7A8C]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0B3C5D] text-white rounded-xl text-sm font-bold hover:bg-[#1F7A8C] transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
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
            <div className="px-4 pt-3 pb-6 space-y-2">
              <form onSubmit={handleSearchSubmit} className="relative mb-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none"
                />
              </form>

              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`block px-3 py-3 text-base font-medium rounded-lg ${
                    location.pathname === link.href
                      ? 'text-[#0B3C5D] bg-blue-50/50 font-bold'
                      : 'text-gray-700 hover:text-[#0B3C5D] hover:bg-gray-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                {user && (
                  <div className="px-3 py-2.5 bg-gray-50 rounded-xl flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-[#1F7A8C] tracking-widest">
                        {formatRole(role)}
                      </p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to="/orders"
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#0B3C5D]"
                        onClick={() => setIsOpen(false)}
                      >
                        Orders
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          signOutUser();
                          setIsOpen(false);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
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
                    Admin Console
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
                    type="button"
                    disabled={signingIn}
                    onClick={() => {
                      setIsOpen(false);
                      loginWithGoogle();
                    }}
                    className="bg-[#EAB308] text-[#0B3C5D] font-bold px-5 py-3 rounded-xl w-full text-center flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    {signingIn ? 'Signing in...' : 'Login with Google'}
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
              <Logo className="h-16 sm:h-24" dark />
            </Link>
            <p className="text-blue-100/70 text-sm leading-relaxed max-w-xs">
              Advancing healthcare through medical supplies, specialized hospital projects, and
              professional equipment servicing across Ghana and beyond.
            </p>
            <div className="flex space-x-4">
              <a
                href={COMPANY_INFO.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-[#1877F2] hover:border-transparent hover:text-white transition-colors"
                title="Follow WAAMIKAN on Facebook"
              >
                <Facebook size={16} />
              </a>
              <a
                href={COMPANY_INFO.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-[#E1306C] hover:border-transparent hover:text-white transition-colors"
                title="Follow WAAMIKAN on Instagram"
              >
                <Instagram size={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Company</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/clients" className="hover:text-white transition-colors">
                  Clients
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Request Quote
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Solutions</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Medical Consumables
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Imaging Equipment
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Hospital Infrastructure
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Servicing &amp; Repairs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-lg">Support</h4>
            <ul className="space-y-4 text-sm text-blue-100/70">
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <span className="block italic mt-4 text-xs opacity-60">
                  Address: {COMPANY_INFO.address}
                </span>
              </li>
              <li>
                <span className="block italic mt-1 text-xs opacity-60">
                  Email: {COMPANY_INFO.email}
                </span>
              </li>
              <li>
                <span className="block italic mt-1 text-xs opacity-60">
                  Tel: {COMPANY_INFO.phone1}
                </span>
              </li>
              <li>
                <span className="block italic mt-1 text-xs opacity-60">
                  Tel: {COMPANY_INFO.phone2}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-blue-100/50">
          <p>© 2026 {COMPANY_INFO.name}. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Use
            </Link>
            <Link to="/cookies" className="hover:text-white transition-colors">
              Cookie Settings
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
