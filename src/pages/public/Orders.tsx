import React, { useState, useEffect } from 'react';
import { auth, db } from '@/src/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Invoice } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Download, Search, Clock, CheckCircle2, AlertCircle, Eye, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router-dom';

const Orders = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'invoices'),
        where('userId', '==', u.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubInvoices = onSnapshot(q, (snap) => {
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
        setLoading(false);
      });

      return () => unsubInvoices();
    });

    return () => unsubAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3C5D]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6 font-black italic text-4xl">?</div>
        <h2 className="text-2xl font-black text-[#0B3C5D]">Authentication Required</h2>
        <p className="text-gray-400 mt-2 max-w-xs">Please sign in to view your order history and tracking info.</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6">
          <Package size={40} />
        </div>
        <h2 className="text-2xl font-black text-[#0B3C5D]">No orders yet</h2>
        <p className="text-gray-400 mt-2 max-w-xs">When you purchase items, your order history will appear here.</p>
        <Link to="/products" className="mt-8 bg-[#0B3C5D] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all">
          <ShoppingCart size={18} />
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-[#0B3C5D]">My Purchases</h1>
        <p className="text-gray-400 font-medium">Track your medical supply requests and payments</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {invoices.map((inv, idx) => (
          <motion.div 
            key={inv.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="p-8 flex flex-col lg:flex-row justify-between gap-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-black text-[#0B3C5D]">#{inv.invoiceNumber}</span>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                    inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    inv.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {inv.status}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">• {format(new Date(inv.createdAt), 'PPP')}</span>
                </div>
                
                <div className="flex flex-wrap gap-8 pt-2">
                   <div className="space-y-1">
                     <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Total Amount</p>
                     <p className="font-black text-[#0B3C5D]">GH₵ {inv.total.toLocaleString()}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Items</p>
                     <p className="font-bold text-gray-600">{inv.items.reduce((s, i) => s + i.quantity, 0)} units</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Due Date</p>
                     <div className="flex items-center gap-1 text-gray-600 font-bold">
                       <Clock size={14} />
                       {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                     </div>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {inv.pdfUrl && (
                  <a 
                    href={inv.pdfUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-grow lg:flex-grow-0 flex items-center justify-center gap-2 bg-gray-50 text-[#0B3C5D] px-6 py-3 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    <Download size={18} />
                    Invoice PDF
                  </a>
                )}
                <button className="flex-grow lg:flex-grow-0 flex items-center justify-center gap-2 bg-[#0B3C5D] text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-[#1F7A8C] transition-all">
                  <Eye size={18} />
                  View Details
                </button>
              </div>
            </div>

            <div className="bg-gray-50/50 p-6 border-t border-gray-50">
               <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
                  {inv.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 shrink-0">
                       <div className="w-10 h-10 bg-white rounded-lg border border-gray-100 flex items-center justify-center text-[10px] font-black text-[#0B3C5D]">
                         {item.quantity}x
                       </div>
                       <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{item.name}</span>
                    </div>
                  ))}
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
