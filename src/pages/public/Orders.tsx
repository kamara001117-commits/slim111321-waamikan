import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Invoice } from '@/src/types';
import { WebOrder } from '@/src/lib/invoiceService';
import { useAuth } from '@/src/lib/AuthContext';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { downloadDocument, printDocument } from '@/src/lib/documentService';
import { motion } from 'motion/react';
import { Package, Download, Clock, Eye, ShoppingCart, Printer, X, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

type UnifiedOrder =
  | (Invoice & { kind: 'invoice' })
  | (WebOrder & { id: string; kind: 'web_order' });

const Orders = () => {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { kind: 'invoice' })[]>([]);
  const [webOrders, setWebOrders] = useState<(WebOrder & { id: string; kind: 'web_order' })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setInvoices([]);
      setWebOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let invLoaded = false;
    let ordLoaded = false;

    const invQuery = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubInv = onSnapshot(
      invQuery,
      (snap) => {
        setInvoices(snap.docs.map((d) => ({ id: d.id, kind: 'invoice', ...d.data() } as any)));
        invLoaded = true;
        if (invLoaded && ordLoaded) setLoading(false);
      },
      (err) => {
        invLoaded = true;
        if (invLoaded && ordLoaded) setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    const ordQuery = query(collection(db, 'web_orders'), where('userId', '==', user.uid));
    const unsubOrd = onSnapshot(
      ordQuery,
      (snap) => {
        setWebOrders(snap.docs.map((d) => ({ id: d.id, kind: 'web_order', ...d.data() } as any)));
        ordLoaded = true;
        if (invLoaded && ordLoaded) setLoading(false);
      },
      (err) => {
        ordLoaded = true;
        if (invLoaded && ordLoaded) setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'web_orders');
      }
    );

    return () => {
      unsubInv();
      unsubOrd();
    };
  }, [user, authLoading]);

  const combinedOrders: UnifiedOrder[] = [
    ...webOrders.filter((wo) => wo.status !== 'invoiced'),
    ...invoices,
  ].sort((a, b) => {
    const da = new Date(a.createdAt || 0).getTime();
    const dbTime = new Date(b.createdAt || 0).getTime();
    return dbTime - da;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3C5D]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center space-y-5">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-[#0B3C5D] font-black text-3xl">
          <Package size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-[#0B3C5D]">Sign In Required</h2>
          <p className="text-gray-500 max-w-sm text-sm">
            Sign in with your Google account to track your submitted orders, invoices, and receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loginWithGoogle()}
          className="bg-[#0B3C5D] text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all"
        >
          <LogIn size={18} />
          Login with Google
        </button>
      </div>
    );
  }

  if (combinedOrders.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-6">
          <Package size={40} />
        </div>
        <h2 className="text-2xl font-black text-[#0B3C5D]">No orders yet</h2>
        <p className="text-gray-400 mt-2 max-w-xs">
          When you purchase items, your order history and invoices will appear here.
        </p>
        <Link
          to="/products"
          className="mt-8 bg-[#0B3C5D] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all"
        >
          <ShoppingCart size={18} />
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#0B3C5D]">My Purchases</h1>
        <p className="text-gray-500 font-medium mt-1">
          Track your medical supply requests, proforma orders, and official invoices
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {combinedOrders.map((order, idx) => {
          const isInvoice = order.kind === 'invoice';
          const refNumber = isInvoice ? order.invoiceNumber : order.orderNumber;
          const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;

          return (
            <motion.div
              key={`${order.kind}-${order.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6 sm:p-8 flex flex-col lg:flex-row justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-black text-[#0B3C5D]">#{refNumber}</span>
                    <span
                      className={`px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        order.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'overdue' || order.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : order.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {order.status === 'pending' ? 'Pending Review' : order.status}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">
                      • {safeFormatDate(order.createdAt, 'PPP')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 sm:gap-8 pt-1">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Total Amount
                      </p>
                      <p className="font-black text-[#0B3C5D]">
                        GHC {(order.total || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Items
                      </p>
                      <p className="font-bold text-gray-700">{itemCount} units</p>
                    </div>
                    {isInvoice && order.dueDate && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Due Date
                        </p>
                        <div className="flex items-center gap-1 text-gray-700 font-bold text-sm">
                          <Clock size={14} />
                          {safeFormatDate(order.dueDate, 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isInvoice && (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadDocument('Invoice', order)}
                        className="flex items-center justify-center gap-2 bg-gray-50 text-[#0B3C5D] px-5 py-3 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        <Download size={16} />
                        Invoice PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => printDocument('Invoice', order)}
                        className="flex items-center justify-center gap-2 bg-gray-50 text-[#0B3C5D] px-5 py-3 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        <Printer size={16} />
                        Print
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center justify-center gap-2 bg-[#0B3C5D] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#1F7A8C] transition-all"
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                </div>
              </div>

              <div className="bg-gray-50/70 p-4 sm:p-6 border-t border-gray-100">
                <div className="flex items-center gap-6 overflow-x-auto pb-1">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 shrink-0">
                      <div className="w-9 h-9 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-[10px] font-black text-[#0B3C5D]">
                        {item.quantity}x
                      </div>
                      <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 bg-[#0B3C5D] text-white flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#EAB308]">
                  {selectedOrder.kind === 'invoice' ? 'Official Invoice' : 'Web Supply Request'}
                </p>
                <h3 className="text-xl font-black">
                  #
                  {selectedOrder.kind === 'invoice'
                    ? selectedOrder.invoiceNumber
                    : selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-white/70 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-2xl">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Customer / Facility</p>
                  <p className="font-bold text-[#0B3C5D]">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Status</p>
                  <p className="font-bold uppercase text-[#1F7A8C]">{selectedOrder.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Order Date</p>
                  <p className="font-medium text-gray-700">
                    {safeFormatDate(selectedOrder.createdAt, 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total</p>
                  <p className="font-black text-[#0B3C5D]">
                    GHC {(selectedOrder.total || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Line Items
                </p>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="p-3.5 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} × GHC {(item.unitPrice || 0).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-bold text-[#0B3C5D]">
                        GHC {(item.total || item.quantity * item.unitPrice || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedOrder.kind === 'invoice' && (
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => printDocument('Invoice', selectedOrder)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white font-bold text-sm text-[#0B3C5D] flex items-center gap-2 hover:bg-gray-50"
                >
                  <Printer size={16} />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument('Invoice', selectedOrder)}
                  className="px-5 py-2.5 rounded-xl bg-[#0B3C5D] text-white font-bold text-sm flex items-center gap-2 hover:bg-[#1F7A8C]"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
