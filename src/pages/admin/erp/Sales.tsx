import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import {
  SalesDocument,
  SalesDocType,
  fulfillOrder,
  convertToSalesOrder,
  convertToInvoice,
  createSalesDocument,
} from '@/src/lib/salesService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { Product, Customer } from '@/src/types/index';
import { COMPANY_INFO } from '@/src/constants/auth';
import {
  FileText,
  Plus,
  Truck,
  Zap,
  Printer,
  FileCheck,
  RefreshCw,
  Receipt,
  X,
  Download,
  Trash2,
} from 'lucide-react';
import { printDocument, downloadDocument } from '@/src/lib/documentService';

const Sales = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [activeTab, setActiveTab] = useState<SalesDocType>('SalesQuote');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoc, setNewDoc] = useState({
    customerId: '',
    customerName: '',
    items: [] as any[],
    total: 0,
    status: 'Draft',
  });

  const formatDocType = (type: string) => {
    return type.replace(/([A-Z])/g, ' $1').trim();
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const unsub = onSnapshot(
      query(collection(db, 'sales_documents'), orderBy('createdAt', 'desc')),
      (snap) => {
        setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesDocument)));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'sales_documents');
      }
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    return () => {
      unsub();
      unsubCustomers();
      unsubProducts();
    };
  }, [currentUserRole]);

  const recalcTotal = (items: any[]) =>
    items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);

  const handleUpdateQty = (index: number, delta: number) => {
    const updated = newDoc.items
      .map((item, i) => {
        if (i !== index) return item;
        const qty = Math.max(1, Number(item.quantity || 1) + delta);
        return { ...item, quantity: qty, total: qty * Number(item.unitPrice || 0) };
      });
    setNewDoc({ ...newDoc, items: updated, total: recalcTotal(updated) });
  };

  const handleRemoveItem = (index: number) => {
    const updated = newDoc.items.filter((_, i) => i !== index);
    setNewDoc({ ...newDoc, items: updated, total: recalcTotal(updated) });
  };

  const handleAddDocument = async () => {
    if (!newDoc.customerId || newDoc.items.length === 0) {
      setFeedback('Please select a customer and add at least one product.');
      return;
    }

    try {
      const typeLabel = formatDocType(activeTab);
      await createSalesDocument({
        ...newDoc,
        type: activeTab,
        date: new Date().toISOString(),
      });
      setShowAddModal(false);
      setNewDoc({ customerId: '', customerName: '', items: [], total: 0, status: 'Draft' });
      setFeedback(`${typeLabel} created successfully.`);
    } catch (error: any) {
      console.error(error);
      setFeedback(`Failed to create ${formatDocType(activeTab)}: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleAction = async (id: string, action: () => Promise<any>) => {
    setProcessing(id);
    setFeedback(null);
    try {
      await action();
    } catch (error: any) {
      console.error(error);
      setFeedback(error?.message || 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const filteredDocs = documents.filter((doc) => doc.type === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">
            Sales Operations
          </h2>
          <p className="text-sm font-medium text-gray-400 italic">
            Manage the full order-to-cash lifecycle
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-4 bg-[#EAB308] text-[#0B3C5D] rounded-2xl font-black shadow-lg shadow-yellow-200/50 hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
        >
          <Plus size={20} />
          NEW {formatDocType(activeTab).toUpperCase()}
        </button>
      </div>

      {/* Institutional Projects & Servicing Notice */}
      <div className="bg-blue-50/70 border border-blue-100 rounded-2xl px-6 py-4 text-xs sm:text-sm text-[#0B3C5D] font-medium">
        {COMPANY_INFO.projectsNotice}
      </div>

      {feedback && (
        <div className="p-4 bg-white border border-blue-200 rounded-2xl text-sm font-bold text-[#0B3C5D] flex items-center justify-between shadow-sm">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-black text-[#0B3C5D]">
                NEW {formatDocType(activeTab).toUpperCase()}
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                value={newDoc.customerId}
                onChange={(e) => {
                  const c = customers.find((cust) => cust.id === e.target.value);
                  setNewDoc({ ...newDoc, customerId: e.target.value, customerName: c?.name || '' });
                }}
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                  Add Items
                </p>
                <select
                  className="w-full px-5 py-4 bg-gray-50 rounded-2xl outline-none"
                  value=""
                  onChange={(e) => {
                    const p = products.find((prod) => prod.id === e.target.value);
                    if (p) {
                      const existing = newDoc.items.find((i) => i.productId === p.id);
                      const updatedItems = existing
                        ? newDoc.items.map((i) =>
                            i.productId === p.id
                              ? {
                                  ...i,
                                  quantity: i.quantity + 1,
                                  total: (i.quantity + 1) * i.unitPrice,
                                }
                              : i
                          )
                        : [
                            ...newDoc.items,
                            {
                              productId: p.id,
                              name: p.name,
                              quantity: 1,
                              unitPrice: p.price,
                              total: p.price,
                            },
                          ];
                      setNewDoc({
                        ...newDoc,
                        items: updatedItems,
                        total: recalcTotal(updatedItems),
                      });
                    }
                  }}
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - GHC {p.price}
                    </option>
                  ))}
                </select>
              </div>

              {newDoc.items.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-2xl">
                  {newDoc.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#0B3C5D] uppercase truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {item.quantity} x GHC {item.unitPrice}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-6 h-6 rounded bg-gray-100 text-xs font-bold"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-6 h-6 rounded bg-gray-100 text-xs font-bold"
                        >
                          +
                        </button>
                        <p className="text-xs font-black text-[#EAB308] min-w-[60px] text-right">
                          GHC {item.total}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center px-4 py-4 bg-gray-50 rounded-2xl">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
                  Grand Total
                </p>
                <p className="text-xl font-black text-[#0B3C5D]">
                  GHC {newDoc.total.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddDocument}
              className="w-full py-5 bg-[#EAB308] text-[#0B3C5D] font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-yellow-200/50"
            >
              Confirm {formatDocType(activeTab)}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl w-fit max-w-full">
        {[
          { id: 'SalesQuote', name: 'Sales Quote', icon: <FileText size={18} /> },
          { id: 'ProformaInvoice', name: 'Proforma Invoice', icon: <Receipt size={18} /> },
          { id: 'SalesOrder', name: 'Sales Order', icon: <Zap size={18} /> },
          { id: 'DeliveryNote', name: 'Delivery Note', icon: <Truck size={18} /> },
          { id: 'CreditNote', name: 'Credit Note', icon: <RefreshCw size={18} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#0B3C5D] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Doc #
                </th>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Customer
                </th>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Date
                </th>
                <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Total
                </th>
                <th className="px-6 sm:px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading &&
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 group transition-colors">
                    <td className="px-6 sm:px-8 py-5">
                      <span className="font-mono text-sm font-black text-[#0B3C5D]">
                        {doc.docNumber}
                      </span>
                    </td>
                    <td className="px-6 sm:px-8 py-5">
                      <p className="font-black text-gray-800 uppercase tracking-tight">
                        {doc.customerName}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                        {(doc.items || []).length} items
                      </p>
                    </td>
                    <td className="px-6 sm:px-8 py-5 text-sm font-bold text-gray-500">
                      {safeFormatDate(doc.date || doc.createdAt, 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 sm:px-8 py-5 text-right font-black text-gray-800">
                      GHC {(Number(doc.total) || 0).toLocaleString()}
                    </td>
                    <td className="px-6 sm:px-8 py-5">
                      <div className="flex justify-center">
                        <span
                          className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                            doc.status === 'Fulfilled'
                              ? 'bg-green-50 text-green-600 border-green-100'
                              : doc.status === 'Draft'
                              ? 'bg-gray-50 text-gray-400 border-gray-100'
                              : 'bg-blue-50 text-blue-600 border-blue-100'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {processing === doc.id ? (
                          <RefreshCw size={18} className="animate-spin text-gray-400" />
                        ) : (
                          <>
                            {(activeTab === 'SalesQuote' ||
                              activeTab === 'Quotation' ||
                              activeTab === 'ProformaInvoice') && (
                              <button
                                type="button"
                                className="p-2 bg-yellow-50 text-[#EAB308] rounded-xl hover:bg-[#EAB308] hover:text-white transition-all shadow-sm"
                                title="Convert to Sales Order"
                                onClick={() => handleAction(doc.id, () => convertToSalesOrder(doc.id))}
                              >
                                <Zap size={18} />
                              </button>
                            )}
                            {activeTab === 'SalesOrder' && doc.status !== 'Fulfilled' && (
                              <>
                                <button
                                  type="button"
                                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Generate Invoice"
                                  onClick={() => handleAction(doc.id, () => convertToInvoice(doc.id))}
                                >
                                  <FileText size={18} />
                                </button>
                                <button
                                  type="button"
                                  className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                  title="Fulfill (Deduct Inventory)"
                                  onClick={() => handleAction(doc.id, () => fulfillOrder(doc.id))}
                                >
                                  <FileCheck size={18} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadDocument(formatDocType(activeTab), doc)}
                          className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => printDocument(formatDocType(activeTab), doc)}
                          className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-[#0B3C5D] hover:text-white transition-all"
                          title="Print Document"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 font-medium italic">
                    No {formatDocType(activeTab)}s matching your current parameters.
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

export default Sales;
