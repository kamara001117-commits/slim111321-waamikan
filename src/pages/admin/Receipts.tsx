import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Receipt } from '@/src/types';
import { 
  Plus, 
  Search, 
  FileText, 
  Download, 
  Eye,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';

const Receipts = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!currentUserRole) return;

    const q = query(collection(db, 'receipts'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });

    return () => unsubscribe();
  }, [currentUserRole]);

  const filteredReceipts = receipts.filter(r => 
    r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Payment Receipts</h2>
          <p className="text-sm text-gray-400">Manage and track official payment records</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by receipt #, customer, or invoice..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#0B3C5D]/10 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest pl-8">Receipt Details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Method</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right pr-8">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading receipts...</td>
              </tr>
            ) : filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No receipts found.</td>
              </tr>
            ) : (
              filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5 pl-8">
                    <div>
                      <p className="font-bold text-[#0B3C5D]">{receipt.receiptNumber}</p>
                      <p className="text-[10px] text-gray-400 font-medium">REF: {receipt.invoiceNumber}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-medium text-gray-700">{receipt.customerName}</td>
                  <td className="px-6 py-5">
                    <span className="font-black text-[#1F7A8C]">GH₵ {receipt.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase">{receipt.method}</span>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-400">
                    {format(new Date(receipt.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-5 text-right pr-8">
                    <div className="flex justify-end gap-2 text-gray-400">
                      <button 
                        onClick={() => setSelectedReceipt(receipt)}
                        className="p-2 hover:text-[#0B3C5D] transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <a 
                        href={receipt.pdfUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 hover:text-[#1F7A8C] transition-colors"
                        title="Download PDF"
                      >
                        <Download size={18} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedReceipt(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-[#1F7A8C] p-8 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black">{selectedReceipt.receiptNumber}</h3>
                    <p className="text-sm opacity-80 uppercase tracking-widest font-bold">Official Receipt</p>
                  </div>
                  <button onClick={() => setSelectedReceipt(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors font-bold">
                    X
                  </button>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Issue Date</p>
                    <p className="font-bold">{format(new Date(selectedReceipt.date), 'PPPP')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">Reference</p>
                    <Link to="/admin/invoices" className="font-bold border-b border-white/30 hover:border-white transition-all">
                      {selectedReceipt.invoiceNumber}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-[#1F7A8C]"><User size={20} /></div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Received From</p>
                      <p className="font-black text-[#0B3C5D]">{selectedReceipt.customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-green-500"><Hash size={20} /></div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Amount Paid</p>
                      <p className="text-2xl font-black text-gray-800">GH₵ {selectedReceipt.amount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-orange-500"><Calendar size={20} /></div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Payment Method</p>
                      <p className="font-black text-gray-800 uppercase">
                        {selectedReceipt.method}
                        {selectedReceipt.chequeNumber && <span className="ml-2 text-xs text-gray-400 font-medium">({selectedReceipt.chequeNumber})</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Balance Remaining</p>
                    <p className="font-black text-[#0B3C5D]">GH₵ {selectedReceipt.remainingBalance.toLocaleString()}</p>
                  </div>
                  <a 
                    href={selectedReceipt.pdfUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-[#0B3C5D] text-white px-6 py-3 rounded-2xl font-bold hover:shadow-xl transition-all"
                  >
                    <Download size={18} />
                    Download PDF
                  </a>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 text-center text-[10px] text-gray-400 uppercase font-black tracking-widest">
                Thank you for choosing Waamikan Enterprise
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Receipts;
