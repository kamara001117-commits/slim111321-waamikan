import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Archive, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  ExternalLink,
  ChevronRight,
  Printer,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { printDocument, downloadDocument } from '@/src/lib/documentService';

const DocumentCenter = () => {
  const [docs, setDocs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // In a real app, we might use a collection group or aggregate multiple streams
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'Invoice', icon: <FileText className="text-blue-500" /> }));
      setDocs(prev => [...prev.filter(i => i.type !== 'Invoice'), ...data]);
    });

    const unsubReceipts = onSnapshot(collection(db, 'receipts'), (snap) => {
       const data = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'Receipt', icon: <Archive className="text-green-500" /> }));
       setDocs(prev => [...prev.filter(i => i.type !== 'Receipt'), ...data]);
    });

    return () => {
      unsubInvoices();
      unsubReceipts();
    };
  }, []);

  const sortedDocs = docs
    .filter(d => filter === 'all' || d.type === filter)
    .filter(d => 
      searchTerm === '' || 
      d.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">Document Archive</h2>
           <p className="text-sm font-medium text-gray-400 italic">Centralized medical and operations records repository</p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-gray-100 shadow-sm w-96">
              <Search size={20} className="text-gray-300" />
              <input 
                type="text" 
                placeholder="Search by ID, Customer or Date..." 
                className="bg-transparent border-none text-sm font-bold w-full focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-[#0B3C5D] hover:text-white transition-all">
              <Filter size={20} />
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
         <div className="p-8 border-b border-gray-50 flex gap-4">
            {['all', 'Invoice', 'Receipt'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-[#0B3C5D] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {f}s
              </button>
            ))}
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-gray-50/50">
                     <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
                     <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Entity / Customer</th>
                     <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Issued Date</th>
                     <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                     <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Files</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {sortedDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50/30 transition-colors group">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-gray-50 rounded-xl">{doc.icon}</div>
                             <div>
                                <p className="font-black text-gray-800 uppercase tracking-tight">{doc.type}</p>
                                <p className="text-xs font-mono text-gray-400">{doc.invoiceNumber || doc.receiptNumber || doc.docNumber || doc.id.slice(0,8)}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <p className="font-bold text-[#0B3C5D] uppercase text-sm">{doc.customerName || 'N/A'}</p>
                       </td>
                       <td className="px-8 py-6 text-sm font-medium text-gray-400 italic">
                          {format(new Date(doc.createdAt), 'MMM dd, yyyy • HH:mm')}
                       </td>
                       <td className="px-8 py-6 font-black text-gray-800">
                          GH₵ {(doc.total || doc.amount || 0).toLocaleString()}
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             <a 
                               href={doc.pdfUrl} 
                               target="_blank" 
                               rel="noreferrer"
                               className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                             >
                                <Download size={18} />
                             </a>
                             <button 
                                onClick={() => printDocument(doc.type, doc)}
                                className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-[#EAB308] hover:text-white transition-all"
                             >
                                <Printer size={18} />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default DocumentCenter;
