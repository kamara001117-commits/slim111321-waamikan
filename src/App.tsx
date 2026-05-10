import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar, Footer } from '@/src/components/layout/Navbar';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

// Lazy load implementation or direct imports for now
import Home from '@/src/pages/public/Home';
import About from '@/src/pages/public/About';
import Products from '@/src/pages/public/Products';
import Cart from '@/src/pages/public/Cart';
import Checkout from '@/src/pages/public/Checkout';
import Orders from '@/src/pages/public/Orders';
import Clients from '@/src/pages/public/Clients';
import Contact from '@/src/pages/public/Contact';
import AdminLayout from '@/src/pages/admin/AdminLayout';
import Dashboard from '@/src/pages/admin/Dashboard';
import Inventory from '@/src/pages/admin/Inventory';
import Invoices from '@/src/pages/admin/Invoices';
import Receipts from '@/src/pages/admin/Receipts';
import Staff from '@/src/pages/admin/Staff';
import CRM from '@/src/pages/admin/CRM';
import Analytics from '@/src/pages/admin/Analytics';
import Customers from '@/src/pages/admin/Customers';
import Accounting from '@/src/pages/admin/erp/Accounting';
import Banking from '@/src/pages/admin/erp/Banking';
import Procurement from '@/src/pages/admin/erp/Procurement';
import HR from '@/src/pages/admin/erp/HR';
import Warehouse from '@/src/pages/admin/erp/Warehouse';
import Reports from '@/src/pages/admin/erp/Reports';
import Sales from '@/src/pages/admin/erp/Sales';
import DocumentCenter from '@/src/pages/admin/erp/DocumentCenter';
import Logistics from '@/src/pages/admin/Logistics';
import Settings from '@/src/pages/admin/Settings';
import { CartProvider } from '@/src/lib/CartContext';

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        // Test connection to the specific database
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or network.");
        }
      }
    }
    testConnection();
  }, []);

  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#F7FAFC]">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/products" element={<Products />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/contact" element={<Contact />} />
              
              {/* Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="receipts" element={<Receipts />} />
                  <Route path="staff" element={<Staff />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="crm" element={<CRM />} />
                  <Route path="analytics" element={<Analytics />} />
                  {/* ERP Routes */}
                  <Route path="erp/accounting" element={<Accounting />} />
                  <Route path="erp/banking" element={<Banking />} />
                  <Route path="erp/procurement" element={<Procurement />} />
                  <Route path="erp/hr" element={<HR />} />
                  <Route path="erp/warehouse" element={<Warehouse />} />
                  <Route path="erp/reports" element={<Reports />} />
                  <Route path="erp/sales" element={<Sales />} />
                  <Route path="erp/documents" element={<DocumentCenter />} />
                  <Route path="logistics" element={<Logistics />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </CartProvider>
  );
}
