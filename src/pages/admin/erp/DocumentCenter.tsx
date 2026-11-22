import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeDate, safeFormatDate } from '@/src/lib/dateUtils';
import {
  Archive,
  Search,
  FileText,
  Download,
  Printer,
  Truck,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { printDocument, downloadDocument } from '@/src/lib/documentService';

const DocumentCenter = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [docs, setDocs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          docCategory: 'Invoice',
          docLabel: 'Invoice',
        }));
        setDocs((prev) => [...prev.filter((i) => i.docCategory !== 'Invoice'), ...data]);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      }
    );

    const unsubReceipts = onSnapshot(
      collection(db, 'receipts'),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          docCategory: 'Receipt',
          docLabel: 'Receipt',
        }));
        setDocs((prev) => [...prev.filter((i) => i.docCategory !== 'Receipt'), ...data]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'receipts')
    );

    const unsubSales = onSnapshot(
      collection(db, 'sales_documents'),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          docCategory: 'Sales Document',
          docLabel: String(d.data().type || 'Sales Document')
            .replace(/([A-Z])/g, ' $1')
            .trim(),
        }));
        setDocs((prev) => [...prev.filter((i) => i.docCategory !== 'Sales Document'), ...data]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'sales_documents')
    );

    const unsubPOs = onSnapshot(
      collection(db, 'purchase_orders'),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          docCategory: 'Purchase Order',
          docLabel: 'Purchase Order',
        }));
        setDocs((prev) => [...prev.filter((i) => i.docCategory !== 'Purchase Order'), ...data]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'purchase_orders')
    );

    const unsubWaybills = onSnapshot(
      collection(db, 'waybills'),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          docCategory: 'Waybill',
          docLabel: 'Waybill',
        }));
        setDocs((prev) => [...prev.filter((i) => i.docCategory !== 'Waybill'), ...data]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'waybills')
    );

    return () => {
      unsubInvoices();
      unsubReceipts();
      unsubSales();
      unsubPOs();
      unsubWaybills();
    };
  }, [currentUserRole]);

  const getIcon = (category: string) => {
    switch (category) {
      case 'Invoice':
        return <FileText className="text-blue-500" />;
      case 'Receipt':
        return <Archive className="text-green-500" />;
      case 'Purchase Order':
        return <ShoppingCart className="text-purple-500" />;
      case 'Waybill':
        return <Truck className="text-amber-500" />;
      default:
        return <Receipt className="text-teal-500" />;
    }
  };

  const sortedDocs = docs
    .filter((d) => filter === 'all' || d.docCategory === filter)
    .filter((d) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        d.customerName?.toLowerCase().includes(term) ||
        d.supplierName?.toLowerCase().includes(term) ||
        d.invoiceNumber?.toLowerCase().includes(term) ||
        d.receiptNumber?.toLowerCase().includes(term) ||
        d.docNumber?.toLowerCase().includes(term) ||
        d.poNumber?.toLowerCase().includes(term) ||
        d.waybillNumber?.toLowerCase().includes(term)
      );
    })
    .sort(
      (a, b) =>
        safeDate(b.createdAt || b.date).getTime() - safeDate(a.createdAt || a.date).getTime()
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">
            Document Archive
          </h2>
          <p className="text-sm font-medium text-gray-400 italic">
            Centralized medical and operations records repository
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border border-gray-100 shadow-sm w-full sm:w-96">
          <Search size={20} className="text-gray-300 shrink-0" />
          <input
            type="text"
            placeholder="Search by ID, Customer or Date..."
            className="bg-transparent border-none text-sm font-bold w-full focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
        <div className="p-6 sm:p-8 border-b border-gray-50 flex flex-wrap gap-3">
          {['all', 'Invoice', 'Receipt', 'Sales Document', 'Purchase Order', 'Waybill'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-[#0B3C5D] text-white'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All Docs' : `${f}s`}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Document
                </th>
                <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Entity / Party
                </th>
                <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Issued Date
                </th>
                <th className="px-6 sm:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Amount
                </th>
                <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Files
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedDocs.map((doc) => (
                <tr key={`${doc.docCategory}-${doc.id}`} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-6 sm:px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gray-50 rounded-xl">{getIcon(doc.docCategory)}</div>
                      <div>
                        <p className="font-black text-gray-800 uppercase tracking-tight">
                          {doc.docLabel}
                        </p>
                        <p className="text-xs font-mono text-gray-400">
                          {doc.invoiceNumber ||
                            doc.receiptNumber ||
                            doc.docNumber ||
                            doc.poNumber ||
                            doc.waybillNumber ||
                            doc.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-5">
                    <p className="font-bold text-[#0B3C5D] uppercase text-sm">
                      {doc.customerName || doc.supplierName || 'N/A'}
                    </p>
                  </td>
                  <td className="px-6 sm:px-8 py-5 text-sm font-medium text-gray-400 italic">
                    {safeFormatDate(doc.createdAt || doc.date, 'MMM dd, yyyy • HH:mm')}
                  </td>
                  <td className="px-6 sm:px-8 py-5 font-black text-gray-800">
                    {doc.total || doc.amount ? `GHC ${(doc.total || doc.amount).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 sm:px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc.docLabel, doc)}
                        className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                        title="Download PDF"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => printDocument(doc.docLabel, doc)}
                        className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-[#EAB308] hover:text-white transition-all"
                        title="Print Document"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && sortedDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-400 italic">
                    No matching documents found in the archive.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DocumentCenter;
