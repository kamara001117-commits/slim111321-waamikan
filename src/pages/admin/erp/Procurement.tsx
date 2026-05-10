import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Supplier, PurchaseOrder, SupplierBill } from '@/src/types/erp';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { 
  ShoppingCart, 
  Plus, 
  Users, 
  PackageCheck, 
  Clock, 
  CheckCircle2, 
  Search,
  Truck,
  ArrowRight,
  ChevronRight,
  MoreHorizontal,
  FileBox,
  X,
  ClipboardList,
  Archive,
  FileMinus,
  Receipt
} from 'lucide-react';
import { 
  createSupplier, 
  createPurchaseQuote, 
  createPurchaseOrder, 
  recordGoodsReceipt, 
  recordSupplierBill, 
  convertQuoteToPO,
  createDebitNote
} from '@/src/lib/procurementService';
import { format } from 'date-fns';

const Procurement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'pos' | 'bills' | 'quotes' | 'receipts' | 'debit_notes'>('suppliers');
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers'));

    const unsubPOs = onSnapshot(
      query(collection(db, 'purchase_orders'), orderBy('date', 'desc')), 
      (snap) => {
        setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'purchase_orders')
    );

    const unsubBills = onSnapshot(
      query(collection(db, 'supplier_bills'), orderBy('date', 'desc')), 
      (snap) => {
        setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierBill)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'supplier_bills')
    );

    const unsubQuotes = onSnapshot(collection(db, 'purchase_quotes'), (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'purchase_quotes'));

    const unsubReceipts = onSnapshot(collection(db, 'goods_receipts'), (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goods_receipts'));

    const unsubDebitNotes = onSnapshot(collection(db, 'debit_notes'), (snap) => {
      setDebitNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'debit_notes'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => {
      unsubSuppliers();
      unsubPOs();
      unsubBills();
      unsubQuotes();
      unsubReceipts();
      unsubDebitNotes();
      unsubProducts();
    };
  }, []);

  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showAddPO, setShowAddPO] = useState(false);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddDebitNote, setShowAddDebitNote] = useState(false);

  const [newQuote, setNewQuote] = useState({ supplierId: '', supplierName: '', total: 0, items: [] });
  const [newPO, setNewPO] = useState({ supplierId: '', supplierName: '', total: 0, items: [] });
  const [newReceipt, setNewReceipt] = useState({ poId: '', poNumber: '', deliveryNote: '', items: [] });
  const [newBill, setNewBill] = useState({ supplierId: '', supplierName: '', billNumber: '', total: 0, date: format(new Date(), 'yyyy-MM-dd'), updateStock: false });
  const [newDebitNote, setNewDebitNote] = useState({ supplierId: '', supplierName: '', amount: 0, reason: '' });

  const handleAddDebitNote = async () => {
    try {
      await createDebitNote(newDebitNote);
      setShowAddDebitNote(false);
      setNewDebitNote({ supplierId: '', supplierName: '', amount: 0, reason: '' });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddQuote = async () => {
    await createPurchaseQuote(newQuote);
    setShowAddQuote(false);
  };

  const handleAddPO = async () => {
    await createPurchaseOrder(newPO);
    setShowAddPO(false);
  };

  const handleAddReceipt = async () => {
    await recordGoodsReceipt(newReceipt);
    setShowAddReceipt(false);
  };

  const handleAddBill = async () => {
    await recordSupplierBill(newBill);
    setShowAddBill(false);
  };

  const handleConvertQuote = async (quoteId: string) => {
    try {
      await convertQuoteToPO(quoteId);
      setActiveTab('pos');
    } catch (error) {
      console.error(error);
    }
  };

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    email: '',
    paymentTerms: 'Net 30'
  });

  const handleAddSupplier = async () => {
    if (!newSupplier.name) return;
    try {
      await createSupplier(newSupplier);
      setShowAddSupplier(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-gray-100 pb-8">
        <div>
           <h2 className="text-4xl font-black text-[#0B3C5D] tracking-tighter uppercase italic underline decoration-[6px] decoration-[#EAB308] underline-offset-8">PROCUREMENT</h2>
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-4">Sourcing, Purchasing and Account Payables</p>
        </div>
        <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100 rounded-[2rem]">
          {[
            { id: 'suppliers', name: 'Suppliers', icon: <Users size={16} /> },
            { id: 'quotes', name: 'Quotes', icon: <Search size={16} /> },
            { id: 'pos', name: 'Orders', icon: <ShoppingCart size={16} /> },
            { id: 'receipts', name: 'Receipts', icon: <PackageCheck size={16} /> },
            { id: 'bills', name: 'Bills', icon: <FileBox size={16} /> },
            { id: 'debit_notes', name: 'Debit Notes', icon: <ArrowRight size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                ? 'bg-white text-[#0B3C5D] shadow-xl shadow-blue-900/5' 
                : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className={activeTab === tab.id ? 'text-[#EAB308]' : 'opacity-40'}>{tab.icon}</div>
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {suppliers.map(supplier => (
             <div key={supplier.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group">
                <div className="flex justify-between items-start mb-8">
                   <div className="p-4 bg-blue-50 rounded-2xl text-blue-600"><Truck size={24} /></div>
                   <button className="text-gray-300 hover:text-[#0B3C5D]"><MoreHorizontal size={20} /></button>
                </div>
                <div className="space-y-4">
                   <div>
                      <h3 className="text-xl font-black text-[#0B3C5D] uppercase tracking-tight">{supplier.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{supplier.contactPerson}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-400">Current Balance</p>
                      <p className="text-2xl font-black text-red-500">GH₵ {supplier.balance.toLocaleString()}</p>
                   </div>
                   <div className="flex gap-2">
                      <span className="text-[9px] font-black bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest text-gray-400 border border-gray-100">
                        {supplier.paymentTerms}
                      </span>
                   </div>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="text-sm font-black text-[#1F7A8C] uppercase tracking-widest flex items-center gap-2">
                      VIEW STATEMENT <ArrowRight size={16} />
                   </button>
                </div>
             </div>
           ))}
           <button 
             onClick={() => setShowAddSupplier(true)}
             className="bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 transition-all group"
           >
              <Plus size={48} className="mb-4 opacity-20 group-hover:opacity-100 transition-all" />
              <p className="font-black text-xs uppercase tracking-widest">Register New Supplier</p>
           </button>
        </div>
      )}

      {activeTab === 'pos' && (
        <div className="space-y-6">
           <div className="flex justify-end">
              <button 
                onClick={() => setShowAddPO(true)}
                className="flex items-center gap-2 px-8 py-4 bg-[#0B3C5D] text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-blue-900/10"
              >
                 <Plus size={18} /> INITIALIZE PURCHASE ORDER
              </button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Order #</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {purchaseOrders.map(po => (
                    <tr key={po.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                      <td className="px-8 py-6">
                        <span className="font-mono text-sm font-bold text-[#0B3C5D]">{po.poNumber}</span>
                      </td>
                      <td className="px-8 py-6">
                         <p className="font-black text-gray-800 uppercase tracking-tight">{po.supplierName}</p>
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{po.items.length} items ordered</p>
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-gray-500 italic">
                        {format(new Date(po.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-gray-800">
                        GH₵ {po.total.toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex justify-center">
                           <span className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                             po.status === 'Closed' ? 'bg-green-50 text-green-600 border-green-100' :
                             po.status === 'Ordered' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                             'bg-gray-50 text-gray-500 border-gray-100'
                           }`}>
                             {po.status}
                           </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                  {purchaseOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-400 font-medium italic">
                        No purchase orders initiated. Start procurement cycle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
       </div>
      )}

      {activeTab === 'quotes' && (
        <div className="space-y-6">
           <div className="flex justify-end">
              <button 
                onClick={() => setShowAddQuote(true)}
                className="flex items-center gap-2 px-8 py-4 bg-[#0B3C5D] text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all"
              >
                 <Plus size={18} /> REQUEST NEW QUOTATION
              </button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Quote #</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quotes.map(q => (
                    <tr key={q.id}>
                      <td className="px-8 py-6 font-mono text-sm font-bold text-blue-600">{q.quoteNumber}</td>
                      <td className="px-8 py-6 font-black uppercase">{q.supplierName}</td>
                      <td className="px-8 py-6 text-right font-black">GH₵ {q.total?.toLocaleString()}</td>
                      <td className="px-8 py-6 text-center italic text-xs text-gray-400">
                        {q.status === 'Converted' ? 'Converted to PO' : 'Requesting pricing'}
                      </td>
                      <td className="px-8 py-6 text-right">
                         {q.status !== 'Converted' && (
                           <button 
                             onClick={() => handleConvertQuote(q.id)}
                             className="text-[10px] font-black text-[#0B3C5D] hover:underline uppercase tracking-tighter"
                           >
                             To Purchase Order →
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
       </div>
      )}

      {activeTab === 'receipts' && (
        <div className="space-y-6">
           <div className="flex justify-end">
              <button 
                onClick={() => setShowAddReceipt(true)}
                className="flex items-center gap-2 px-8 py-4 bg-[#0B3C5D] text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all"
              >
                 <Archive size={18} /> RECORD GOODS RECEIPT (GRN)
              </button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt #</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">PO Link</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Received Date</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Inventory Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {receipts.map(r => (
                    <tr key={r.id}>
                      <td className="px-8 py-6 font-mono text-sm font-bold text-green-600">{r.receiptNumber}</td>
                      <td className="px-8 py-6 font-bold">{r.poNumber || 'Manual Receipt'}</td>
                      <td className="px-8 py-6 text-sm italic">{format(new Date(r.createdAt), 'MMM dd, yyyy HH:mm')}</td>
                      <td className="px-8 py-6 text-center">
                         <span className="text-[10px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full uppercase">Stock Updated</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
       </div>
      )}

      {activeTab === 'debit_notes' && (
        <div className="space-y-6">
           <div className="flex justify-end">
              <button 
                onClick={() => setShowAddDebitNote(true)}
                className="flex items-center gap-2 px-8 py-4 bg-[#0B3C5D] text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all"
              >
                 <Plus size={18} /> ISSUE DEBIT NOTE (ADJUSTMENT)
              </button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Note #</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {debitNotes.map(dn => (
                    <tr key={dn.id}>
                      <td className="px-8 py-6 font-mono text-sm font-bold text-orange-600">{dn.noteNumber}</td>
                      <td className="px-8 py-6 font-black uppercase tracking-tight">{dn.supplierName}</td>
                      <td className="px-8 py-6 text-right font-black text-orange-600">- GH₵ {dn.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
       </div>
      )}
      {activeTab === 'bills' && (
        <div className="space-y-6">
           <div className="flex justify-end">
              <button 
                onClick={() => setShowAddBill(true)}
                className="flex items-center gap-2 px-8 py-4 bg-[#0B3C5D] text-white rounded-[2rem] font-bold text-xs uppercase tracking-widest hover:bg-black transition-all"
              >
                 <Receipt size={18} /> RECORD NEW SUPPLIER BILL
              </button>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Bill #</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Date</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount Due</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-6 font-mono text-sm font-black text-[#1F7A8C]">{bill.billNumber}</td>
                      <td className="px-8 py-6 font-black text-gray-800 uppercase tracking-tight">{bill.supplierName}</td>
                      <td className="px-8 py-6 text-sm font-bold text-red-400 italic">
                        {format(new Date(bill.dueDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-8 py-6 text-right font-black text-[#0B3C5D]">
                        GH₵ {bill.total.toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex justify-center">
                           <span className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                             bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' :
                             bill.status === 'Partial' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                             'bg-red-50 text-red-600 border-red-100 text-red-600'
                           }`}>
                             {bill.status}
                           </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-400 font-medium italic">
                        No outstanding supplier bills in ledger.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
       </div>
      )}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddSupplier(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">REGISTER SUPPLIER</h3>
             <input placeholder="Supplier Name" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
             <input placeholder="Contact Person" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" value={newSupplier.contactPerson} onChange={e => setNewSupplier({...newSupplier, contactPerson: e.target.value})} />
             <input placeholder="Email" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
             <button onClick={handleAddSupplier} className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl">Confirm Onboarding</button>
          </div>
        </div>
      )}

      {showAddQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddQuote(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">REQUEST QUOTATION</h3>
             <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => {
                const s = suppliers.find(sup => sup.id === e.target.value);
                setNewQuote({...newQuote, supplierId: e.target.value, supplierName: s?.name || ''});
             }}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <input type="number" placeholder="Estimated Total (GH₵)" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewQuote({...newQuote, total: Number(e.target.value)})} />
             <button onClick={handleAddQuote} className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl">Send Request</button>
          </div>
        </div>
      )}

      {showAddPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddPO(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">INITIALIZE PURCHASE ORDER</h3>
             <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => {
                const s = suppliers.find(sup => sup.id === e.target.value);
                setNewPO({...newPO, supplierId: e.target.value, supplierName: s?.name || ''});
             }}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <input type="number" placeholder="PO Total (GH₵)" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewPO({...newPO, total: Number(e.target.value)})} />
             <button onClick={handleAddPO} className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl">Generate PO</button>
          </div>
        </div>
      )}

      {showAddReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddReceipt(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">GOODS RECEIPT (GRN)</h3>
             <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => {
                const po = purchaseOrders.find(p => p.id === e.target.value);
                setNewReceipt({...newReceipt, poId: e.target.value, poNumber: po?.poNumber || '', items: po?.items || []});
             }}>
                <option value="">Link to PO</option>
                {purchaseOrders.filter(p => p.status !== 'Received').map(p => <option key={p.id} value={p.id}>{p.poNumber} - {p.supplierName}</option>)}
             </select>
             <input placeholder="Delivery Note #" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewReceipt({...newReceipt, deliveryNote: e.target.value})} />
             <button onClick={handleAddReceipt} className="w-full py-5 bg-green-600 text-white font-black rounded-2xl">Confirm Receipt</button>
          </div>
        </div>
      )}

      {showAddBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddBill(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">RECORD SUPPLIER BILL</h3>
             <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => {
                const s = suppliers.find(sup => sup.id === e.target.value);
                setNewBill({...newBill, supplierId: e.target.value, supplierName: s?.name || ''});
             }}>
                <option value="">Select Vendor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <input placeholder="Bill Number" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewBill({...newBill, billNumber: e.target.value})} />
             <input type="number" placeholder="Bill Amount" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewBill({...newBill, total: Number(e.target.value)})} />
             <label className="flex items-center gap-2 cursor-pointer p-4 bg-gray-50 rounded-2xl">
                <input type="checkbox" checked={newBill.updateStock} onChange={e => setNewBill({...newBill, updateStock: e.target.checked})} />
                <span className="text-xs font-bold text-gray-500">Update Stock (Check if no GRN)</span>
             </label>
             <button onClick={handleAddBill} className="w-full py-5 bg-[#0B3C5D] text-white font-black rounded-2xl">Post to Ledger</button>
          </div>
        </div>
      )}

      {showAddDebitNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddDebitNote(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-4">
             <h3 className="text-2xl font-black text-[#0B3C5D]">ISSUE DEBIT NOTE</h3>
             <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => {
                const s = suppliers.find(sup => sup.id === e.target.value);
                setNewDebitNote({...newDebitNote, supplierId: e.target.value, supplierName: s?.name || ''});
             }}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <input type="number" placeholder="Net Adjustment (GH₵)" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewDebitNote({...newDebitNote, amount: Number(e.target.value)})} />
             <input placeholder="Reason / Reference Bill #" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none" onChange={e => setNewDebitNote({...newDebitNote, reason: e.target.value})} />
             <button onClick={handleAddDebitNote} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl">Issue Adjustment</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Procurement;
