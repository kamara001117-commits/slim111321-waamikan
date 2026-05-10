import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { SalesDocument, fulfillOrder, convertToSalesOrder, convertToInvoice, createSalesDocument } from '@/src/lib/salesService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { Product, Customer } from '@/src/types/index';
import { 
  FileText, 
  Plus, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  User, 
  Truck, 
  Zap,
  Printer,
  FileCheck,
  RefreshCw,
  X
} from 'lucide-react';
import { format } from 'date-fns';

const Sales = () => {
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'Quotation' | 'SalesOrder' | 'DeliveryNote' | 'CreditNote'>('Quotation');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoc, setNewDoc] = useState({
    customerId: '',
    customerName: '',
    items: [] as any[],
    total: 0,
    status: 'Draft'
  });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'sales_documents'), orderBy('createdAt', 'desc')), 
      (snap) => {
        setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesDocument)));
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales_documents')
    );

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    return () => {
      unsub();
      unsubCustomers();
      unsubProducts();
    };
  }, []);

  const handleAddQuotation = async () => {
    try {
      await createSalesDocument({
        ...newDoc,
        type: activeTab,
        date: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewDoc({ customerId: '', customerName: '', items: [], total: 0, status: 'Draft' });
      alert(`${activeTab} created successfully.`);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to create ${activeTab}: ` + (error.message || "Unknown error"));
    }
  };

  const handleAction = async (id: string, action: () => Promise<any>) => {
    setProcessing(id);
    try {
      await action();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const filteredDocs = documents.filter(doc => doc.type === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">Sales Operations</h2>
           <p className="text-sm font-medium text-gray-400 italic">Manage the full order-to-cash lifecycle</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={() => setShowAddModal(true)}
             className="flex items-center gap-2 px-6 py-4 bg-[#EAB308] text-white rounded-2xl font-black shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-all"
           >
             <Plus size={20} />
             NEW {activeTab.toUpperCase()}
           </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-[#0B3C5D]">NEW {activeTab.toUpperCase()}</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400"><X size={24} /></button>
             </div>
             <div className="space-y-4">
                <select 
                  className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#EAB308]"
                  value={newDoc.customerId}
                  onChange={e => {
                    const c = customers.find(cust => cust.id === e.target.value);
                    setNewDoc({...newDoc, customerId: e.target.value, customerName: c?.name || ''});
                  }}
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Add Items</p>
                  <select 
                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none"
                    onChange={e => {
                      const p = products.find(prod => prod.id === e.target.value);
                      if (p) {
                         const existing = newDoc.items.find(i => i.productId === p.id);
                         if (existing) {
                           setNewDoc({...newDoc, items: newDoc.items.map(i => i.productId === p.id ? {...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice} : i), total: newDoc.total + p.price});
                         } else {
                           setNewDoc({...newDoc, items: [...newDoc.items, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.price, total: p.price }], total: newDoc.total + p.price});
                         }
                      }
                    }}
                  >
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - GH₵ {p.price}</option>)}
                  </select>
                </div>

                {newDoc.items.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-2xl">
                     {newDoc.items.map((item, idx) => (
                       <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                          <div>
                            <p className="text-xs font-black text-[#0B3C5D] uppercase">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{item.quantity} x GH₵ {item.unitPrice}</p>
                          </div>
                          <p className="text-xs font-black text-[#EAB308]">GH₵ {item.total}</p>
                       </div>
                     ))}
                  </div>
                )}

                <div className="flex justify-between items-center px-4 py-4 bg-gray-50 rounded-2xl">
                   <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Grand Total</p>
                   <p className="text-xl font-black text-[#0B3C5D]">GH₵ {newDoc.total.toLocaleString()}</p>
                </div>
             </div>
             <button 
               onClick={handleAddQuotation}
               className="w-full py-5 bg-[#EAB308] text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-yellow-200"
             >
                Confirm {activeTab}
             </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { id: 'Quotation', name: 'Quotations', icon: <FileText size={18} /> },
          { id: 'SalesOrder', name: 'Sales Orders', icon: <Zap size={18} /> },
          { id: 'DeliveryNote', name: 'Delivery Notes', icon: <Truck size={18} /> },
          { id: 'CreditNote', name: 'Credit Notes', icon: <RefreshCw size={18} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
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
            <table className="w-full">
               <thead>
                  <tr className="bg-gray-50/50">
                     <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Doc #</th>
                     <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                     <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                     <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                     <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                     <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {filteredDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50/50 group transition-colors">
                       <td className="px-8 py-6">
                         <span className="font-mono text-sm font-black text-[#0B3C5D]">{doc.docNumber}</span>
                       </td>
                       <td className="px-8 py-6">
                          <p className="font-black text-gray-800 uppercase tracking-tight">{doc.customerName}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">{doc.items.length} items</p>
                       </td>
                       <td className="px-8 py-6 text-sm font-bold text-gray-500">
                         {format(new Date(doc.date), 'MMM dd, yyyy')}
                       </td>
                       <td className="px-8 py-6 text-right font-black text-gray-800">
                         GH₵ {doc.total.toLocaleString()}
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={`text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest border ${
                              doc.status === 'Fulfilled' ? 'bg-green-50 text-green-600 border-green-100' :
                              doc.status === 'Draft' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                              'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             {processing === doc.id ? (
                               <RefreshCw size={18} className="animate-spin text-gray-400" />
                             ) : (
                               <>
                                 {activeTab === 'Quotation' && (
                                   <button 
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
                                       className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                       title="Generate Invoice"
                                       onClick={() => handleAction(doc.id, () => convertToInvoice(doc.id))}
                                     >
                                       <FileText size={18} />
                                     </button>
                                     <button 
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
                             <button className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-[#0B3C5D] hover:text-white transition-all">
                               <Printer size={18} />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {filteredDocs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-gray-300 font-medium italic">
                        No {activeTab}s matching your current parameters.
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
