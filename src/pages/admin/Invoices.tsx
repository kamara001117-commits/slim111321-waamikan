import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  getDocs,
  where,
  getDoc,
  setDoc,
  limit,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Invoice, Product, Customer, Payment, Receipt } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreError';
import { safeFormatDate, safeDate } from '@/src/lib/dateUtils';
import {
  Plus,
  Search,
  FileText,
  Download,
  CheckCircle,
  Clock,
  X,
  Trash2,
  Eye,
  CreditCard,
  History,
  Printer,
  ShoppingBag,
  ArrowRightCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import {
  recordPayment,
  createInvoice,
  convertWebOrderToInvoice,
  WebOrder,
} from '@/src/lib/invoiceService';
import {
  generateAndUploadInvoicePDF,
  generateAndUploadReceiptPDF,
  downloadDocument,
  printDocument,
} from '@/src/lib/documentService';
import { logActivity } from '@/src/lib/activity';

const Invoices = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [activeTab, setActiveTab] = useState<'invoices' | 'web_orders'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [webOrders, setWebOrders] = useState<(WebOrder & { id: string })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    items: [{ productId: '', name: '', quantity: 1, unitPrice: 0, total: 0 }],
    status: 'draft' as const,
    dueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Cheque'
  >('Cash');
  const [paymentChequeNumber, setPaymentChequeNumber] = useState('');
  const [invoicePayments, setInvoicePayments] = useState<Payment[]>([]);
  const [invoiceReceipts, setInvoiceReceipts] = useState<Receipt[]>([]);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedInvoice && isViewModalOpen) {
      // Single-field where queries sorted client-side avoid composite index failures
      const qPayments = query(
        collection(db, 'payments'),
        where('invoiceId', '==', selectedInvoice.id)
      );
      const unsubscribePayments = onSnapshot(
        qPayments,
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Payment))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setInvoicePayments(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'payments');
        }
      );

      const qReceipts = query(
        collection(db, 'receipts'),
        where('invoiceId', '==', selectedInvoice.id)
      );
      const unsubscribeReceipts = onSnapshot(
        qReceipts,
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Receipt))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setInvoiceReceipts(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'receipts');
        }
      );

      return () => {
        unsubscribePayments();
        unsubscribeReceipts();
      };
    }
  }, [selectedInvoice, isViewModalOpen]);

  useEffect(() => {
    if (!currentUserRole) return;

    const qInvoices = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubInvoices = onSnapshot(
      qInvoices,
      async (snapshot) => {
        const invs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
        setInvoices(invs);
        setLoading(false);

        // Automated Overdue Check
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        for (const inv of invs) {
          if (inv.status !== 'paid' && inv.status !== 'overdue' && inv.dueDate) {
            const dueDate = safeDate(inv.dueDate);
            if (dueDate && dueDate < now && format(dueDate, 'yyyy-MM-dd') !== todayStr) {
              try {
                await updateDoc(doc(db, 'invoices', inv.id), {
                  status: 'overdue',
                  updatedAt: new Date().toISOString(),
                });
                await logActivity(
                  'invoice',
                  `Invoice ${inv.invoiceNumber} auto-marked as Overdue`,
                  inv.id,
                  `Due date was ${inv.dueDate}`
                );
              } catch (e) {
                console.error('Auto-overdue update failed for:', inv.id, e);
              }
            }
          }
        }
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'invoices');
      }
    );

    const qWebOrders = query(collection(db, 'web_orders'), orderBy('createdAt', 'desc'));
    const unsubWebOrders = onSnapshot(
      qWebOrders,
      (snapshot) => {
        setWebOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'web_orders');
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      }
    );

    return () => {
      unsubInvoices();
      unsubWebOrders();
      unsubProducts();
      unsubCustomers();
    };
  }, [currentUserRole]);

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const total = subtotal;
    return { subtotal, vat: 0, total };
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', name: '', quantity: 1, unitPrice: 0, total: 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'productId') {
      const p = products.find((prod) => prod.id === value);
      if (p) {
        item.name = p.name;
        item.unitPrice = p.price;
        item.total = item.quantity * p.price;
      }
    } else if (field === 'quantity' || field === 'unitPrice') {
      const qVal = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
      const pVal = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0;
      item.total = qVal * pVal;
    }

    newItems[index] = item;
    setFormData({ ...formData, items: newItems });
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) return alert('Please select a customer');
    if (formData.items.some((i) => !i.productId || i.quantity <= 0)) {
      return alert('Please check line items and quantities');
    }

    setProcessing(true);
    const customer = customers.find((c) => c.id === formData.customerId);
    const { subtotal, vat, total } = calculateTotals(formData.items);

    const invoiceNumber =
      editMode && selectedInvoice
        ? selectedInvoice.invoiceNumber
        : `WAAM-INV-${(invoices.length + 1).toString().padStart(4, '0')}`;

    try {
      const docId = editingInvoiceId;

      if (editMode && docId) {
        const updatePayload = {
          customerId: formData.customerId,
          customerName: customer?.name || 'Unknown',
          items: formData.items,
          subtotal,
          vat,
          total,
          remainingBalance: Math.max(0, total - (selectedInvoice?.paidAmount || 0)),
          dueDate: formData.dueDate,
          updatedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'invoices', docId), updatePayload);

        const updatedInvoice = { ...selectedInvoice, ...updatePayload } as Invoice;
        const pdfUrl = await generateAndUploadInvoicePDF(updatedInvoice);
        if (pdfUrl) {
          await updateDoc(doc(db, 'invoices', docId), { pdfUrl });
        }

        await logActivity('invoice', `Updated invoice ${invoiceNumber}`, docId, `New Total: GHC ${total}`);
      } else {
        await createInvoice({
          customerId: formData.customerId,
          customerName: customer?.name || 'Unknown',
          items: formData.items,
          status: formData.status,
          dueDate: formData.dueDate,
        });
      }

      setIsModalOpen(false);
      setEditMode(false);
      setEditingInvoiceId(null);
      setFormData({
        customerId: '',
        items: [{ productId: '', name: '', quantity: 1, unitPrice: 0, total: 0 }],
        status: 'draft',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
      alert('Unable to save invoice. Check permissions.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!selectedInvoice || !Number.isFinite(amt) || amt <= 0) return;

    setProcessing(true);
    try {
      await recordPayment(
        selectedInvoice.id,
        amt,
        paymentMethod,
        '',
        paymentChequeNumber
      );
      setPaymentAmount('');
      setPaymentChequeNumber('');
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Check permissions or remaining balance.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveWebOrder = async (order: WebOrder & { id: string }) => {
    setProcessing(true);
    try {
      const inv = await convertWebOrderToInvoice(order);
      alert(`Order #${order.orderNumber} converted to Invoice ${inv.invoiceNumber}.`);
      setActiveTab('invoices');
    } catch (error) {
      console.error('Failed to approve web order:', error);
      alert('Failed to convert web order into invoice.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegenerateReceipt = async (payment: Payment) => {
    if (!selectedInvoice) return;
    setProcessing(true);
    try {
      const q = query(
        collection(db, 'receipts'),
        where('paymentId', '==', payment.id),
        limit(1)
      );
      const snap = await getDocs(q);

      let receiptData: Receipt;

      if (!snap.empty) {
        receiptData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Receipt;
      } else {
        const counterRef = doc(db, 'counters', 'receipts');
        const counterSnap = await getDoc(counterRef);
        const nextNum = (counterSnap.data()?.lastNumber || 0) + 1;
        const receiptNumber = `WAAM-RCPT-${nextNum.toString().padStart(4, '0')}`;
        await setDoc(counterRef, { lastNumber: nextNum }, { merge: true });

        receiptData = {
          id: '',
          receiptNumber,
          paymentId: payment.id,
          invoiceId: selectedInvoice.id,
          invoiceNumber: selectedInvoice.invoiceNumber,
          customerId: selectedInvoice.customerId,
          customerName: selectedInvoice.customerName,
          amount: payment.amount,
          method: payment.method as any,
          remainingBalance: selectedInvoice.remainingBalance || 0,
          date: payment.date,
          createdAt: new Date().toISOString(),
          pdfUrl: '',
        };
      }

      const pdfUrl = await generateAndUploadReceiptPDF(receiptData);

      if (receiptData.id) {
        await updateDoc(doc(db, 'receipts', receiptData.id), { pdfUrl });
      } else {
        receiptData.pdfUrl = pdfUrl;
        const { id: _ignored, ...payload } = receiptData;
        await addDoc(collection(db, 'receipts'), payload);
      }

      downloadDocument('Receipt', receiptData);
    } catch (error) {
      console.error('Error regenerating receipt:', error);
      alert('Failed to generate receipt.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingWebOrdersCount = webOrders.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-[#0B3C5D]">Billing &amp; Finance</h2>
          <p className="text-gray-400 text-sm">
            Manage enterprise invoices, payments, and incoming storefront orders
          </p>
        </div>
        <div className="flex flex-wrap w-full md:w-auto gap-3">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search invoices..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-[#1F7A8C] outline-none w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditMode(false);
              setEditingInvoiceId(null);
              setFormData({
                customerId: '',
                items: [{ productId: '', name: '', quantity: 1, unitPrice: 0, total: 0 }],
                status: 'draft',
                dueDate: format(new Date(), 'yyyy-MM-dd'),
              });
              setIsModalOpen(true);
            }}
            className="whitespace-nowrap bg-[#0B3C5D] text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-lg shadow-blue-900/10"
          >
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'bg-[#0B3C5D] text-white shadow'
              : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          <FileText size={16} />
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('web_orders')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'web_orders'
              ? 'bg-[#0B3C5D] text-white shadow'
              : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          <ShoppingBag size={16} />
          Web Store Orders
          {pendingWebOrdersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EAB308] text-[#0B3C5D]">
              {pendingWebOrdersCount} New
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
                Total Billings
              </p>
              <p className="text-2xl font-black text-[#0B3C5D]">
                GHC {invoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Received</p>
              <p className="text-2xl font-black text-green-600">
                GHC {invoices.reduce((s, i) => s + (i.paidAmount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
                Outstanding
              </p>
              <p className="text-2xl font-black text-red-600">
                GHC {invoices.reduce((s, i) => s + (i.remainingBalance || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'invoices' ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[760px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Reference
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Client
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Total
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Balance
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <span className="font-black text-[#0B3C5D]">{inv.invoiceNumber}</span>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {safeFormatDate(inv.createdAt, 'PP')}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-700">
                        {inv.customerName}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-gray-900">
                        GHC {(inv.total || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-red-500">
                        GHC {(inv.remainingBalance || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            inv.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : inv.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : inv.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-700'
                              : inv.status === 'sent'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => printDocument('Invoice', inv)}
                            className="p-2.5 bg-gray-50 text-gray-500 hover:text-[#EAB308] rounded-xl"
                            title="Print Invoice"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadDocument('Invoice', inv)}
                            className="p-2.5 bg-gray-50 text-gray-500 hover:text-[#0B3C5D] rounded-xl"
                            title="Download Invoice PDF"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsViewModalOpen(true);
                            }}
                            className="p-2.5 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-xl"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          {inv.status !== 'paid' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsPaymentModalOpen(true);
                              }}
                              className="p-2.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl"
                              title="Record Payment"
                            >
                              <CreditCard size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[760px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Order Ref
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Facility / Client
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Items
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Total
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {webOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No web store orders submitted yet.
                    </td>
                  </tr>
                ) : (
                  webOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-black text-[#0B3C5D]">{ord.orderNumber}</span>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {safeFormatDate(ord.createdAt, 'PP')}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-gray-800">{ord.customerName}</p>
                        <p className="text-xs text-gray-400">
                          {ord.contactName} • {ord.phone}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {ord.items?.reduce((s, i) => s + i.quantity, 0) || 0} units
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-[#0B3C5D]">
                        GHC {(ord.total || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            ord.status === 'invoiced'
                              ? 'bg-green-100 text-green-700'
                              : ord.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {ord.status === 'pending' ? (
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => handleApproveWebOrder(ord)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B3C5D] text-white rounded-xl text-xs font-bold hover:bg-[#1F7A8C] transition-all disabled:opacity-50"
                          >
                            <ArrowRightCircle size={15} />
                            Approve &amp; Invoice
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-gray-400">
                            {ord.invoiceNumber || 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-[#0B3C5D] text-white">
                <h3 className="text-2xl font-bold">
                  {editMode ? 'Edit' : 'New'} Invoice {editMode && selectedInvoice?.invoiceNumber}
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Select Customer
                    </label>
                    <select
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-[#0B3C5D]"
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      {customers.length === 0 && (
                        <option disabled>No customers found (Add one in Clients)</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Due Date
                    </label>
                    <input
                      type="date"
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest">
                      Line Items
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[#0B3C5D] text-xs font-bold underline"
                    >
                      + Add Item
                    </button>
                  </div>

                  {formData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-3 items-end bg-gray-50/50 p-4 rounded-2xl"
                    >
                      <div className="col-span-12 sm:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Product</label>
                        <select
                          className="w-full p-2 bg-white rounded-lg border border-gray-200 text-sm"
                          value={item.productId}
                          onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                        >
                          <option value="">Select Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Qty</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full p-2 bg-white rounded-lg border border-gray-200 text-sm"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Unit Price</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full p-2 bg-white rounded-lg border border-gray-200 text-sm"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Total</label>
                        <div className="p-2 text-sm font-bold">GHC {item.total.toLocaleString()}</div>
                      </div>
                      <div className="col-span-1 pb-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <div className="w-80 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="font-bold">
                        GHC {calculateTotals(formData.items).subtotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xl border-t border-gray-100 pt-3">
                      <span className="font-black text-[#0B3C5D]">TOTAL</span>
                      <span className="font-black text-[#0B3C5D]">
                        GHC {calculateTotals(formData.items).total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-gray-100 flex justify-end gap-4 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 font-bold text-gray-500"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  disabled={processing}
                  className="bg-[#0B3C5D] text-white px-8 py-3 rounded-2xl font-bold hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {processing
                    ? 'Processing...'
                    : editMode
                    ? 'Update Invoice'
                    : 'Generate & Save Invoice'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Invoice & Payments Modal */}
      <AnimatePresence>
        {isViewModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsViewModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b flex justify-between items-center bg-[#0B3C5D] text-white">
                <div>
                  <h3 className="text-xl font-bold">{selectedInvoice.invoiceNumber}</h3>
                  <p className="text-sm opacity-80">{selectedInvoice.customerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Amount</p>
                    <p className="text-lg font-black text-[#0B3C5D]">
                      GHC {(selectedInvoice.total || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                    <p className="text-[10px] font-bold text-green-500 uppercase">Paid So Far</p>
                    <p className="text-lg font-black text-green-600">
                      GHC {(selectedInvoice.paidAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[10px] font-bold text-orange-500 uppercase">Remaining</p>
                    <p className="text-lg font-black text-orange-600">
                      GHC {(selectedInvoice.remainingBalance || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Status</p>
                    <p className="text-lg font-black text-[#0B3C5D] uppercase">
                      {selectedInvoice.status}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <History size={18} className="text-blue-500" />
                    Payment History
                  </h4>
                  <div className="space-y-3">
                    {invoicePayments.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No payments recorded yet.</p>
                    ) : (
                      invoicePayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#0B3C5D]">{payment.method}</p>
                            <p className="text-[10px] text-gray-400">
                              {safeFormatDate(payment.date, 'PPP p')}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right border-r pr-4 border-gray-200">
                              <p className="font-black text-gray-800">
                                GHC {(payment.amount || 0).toLocaleString()}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                By {payment.recordedByName}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                to="/admin/receipts"
                                className="p-2 bg-white rounded-lg shadow-sm text-blue-500 hover:bg-blue-50 border border-gray-100"
                                title="Go to Receipts"
                              >
                                <FileText size={18} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleRegenerateReceipt(payment)}
                                disabled={processing}
                                className="p-2 bg-white rounded-lg shadow-sm text-green-600 hover:bg-green-50 border border-gray-100 disabled:opacity-50"
                                title="Download Receipt PDF"
                              >
                                <Download size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t flex flex-col gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <FileText size={18} className="text-[#0B3C5D]" />
                      Document Actions
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Invoice PDF */}
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-blue-900">Invoice Document</p>
                            <p className="text-[10px] text-blue-700 opacity-70 truncate">
                              {selectedInvoice.invoiceNumber}.pdf
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => downloadDocument('Invoice', selectedInvoice)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                            title="Download Invoice PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => printDocument('Invoice', selectedInvoice)}
                            className="p-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 shadow-sm"
                            title="Print Invoice"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Receipt PDFs */}
                      {invoiceReceipts.length > 0 ? (
                        invoiceReceipts.map((receipt) => (
                          <div
                            key={receipt.id}
                            className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100 gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-white rounded-lg text-green-600 shadow-sm shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-green-900 truncate">
                                  Receipt: {receipt.receiptNumber}
                                </p>
                                <p className="text-[10px] text-green-700 opacity-70">
                                  {safeFormatDate(receipt.date, 'MMM d, yyyy')} • GHC{' '}
                                  {(receipt.amount || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => downloadDocument('Receipt', receipt)}
                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                                title="Download Receipt PDF"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => printDocument('Receipt', receipt)}
                                className="p-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 shadow-sm"
                                title="Print Receipt"
                              >
                                <Printer size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 italic text-gray-400 text-xs">
                          No receipts generated yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsPaymentModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Record Payment</h3>
                <button type="button" onClick={() => setIsPaymentModalOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Invoice</p>
                  <p className="text-lg font-black text-[#0B3C5D]">
                    {selectedInvoice.invoiceNumber}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Amount to Pay (GHC)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-xl"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                    <p className="text-[10px] text-orange-500 font-medium">
                      Max Payable: GHC {(selectedInvoice.remainingBalance || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m as any)}
                          className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                            paymentMethod === m
                              ? 'bg-[#0B3C5D] text-white border-[#0B3C5D]'
                              : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'Cheque' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Cheque Number
                      </label>
                      <input
                        type="text"
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold"
                        placeholder="Enter cheque number..."
                        value={paymentChequeNumber}
                        onChange={(e) => setPaymentChequeNumber(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={processing || !paymentAmount}
                  className="w-full py-4 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm Payment & Generate Receipt'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Invoices;
