import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Account, JournalEntry } from '@/src/types/erp';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar,
  FileText,
  Printer,
  ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const Reports = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [activeReport, setActiveReport] = useState<'PL' | 'BS' | 'VAT' | 'Aging'>('PL');
  const [dateRange, setDateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    const unsubAcc = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'accounts'));

    const unsubJournal = onSnapshot(collection(db, 'journal_entries'), (snap) => {
      setJournalEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'journal_entries'));

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAcc();
      unsubJournal();
      unsubSuppliers();
      unsubCustomers();
    };
  }, []);

  // Simple P&L Calculation logic
  const revenue = accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0);
  const expenses = accounts.filter(a => a.type === 'Expense').reduce((sum, a) => sum + a.balance, 0);
  const netProfit = revenue - expenses;

  // Balance Sheet logic
  const assets = accounts.filter(a => a.type === 'Asset');
  const liabilities = accounts.filter(a => a.type === 'Liability');
  const equity = accounts.filter(a => a.type === 'Equity');

  const handlePrint = () => {
     window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
         <div>
            <h2 className="text-3xl font-black text-[#0B3C5D] tracking-tight uppercase"> FINANCIAL STATEMENTS</h2>
            <p className="text-sm font-medium text-gray-400 italic">Official fiscal reporting and audit-ready exports</p>
         </div>
         <div className="flex gap-4">
            <div className="flex items-center gap-2 px-6 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm font-bold text-gray-500 text-sm">
               <Calendar size={18} />
               {format(dateRange.start, 'MMM dd')} - {format(dateRange.end, 'MMM dd, yyyy')}
            </div>
            <button 
              onClick={handlePrint}
              className="p-4 bg-[#0B3C5D] text-white rounded-2xl shadow-lg hover:scale-[1.02] transition-all"
            >
               <Printer size={20} />
            </button>
         </div>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { id: 'PL', name: 'Profit & Loss', icon: <TrendingUp size={16} /> },
          { id: 'BS', name: 'Balance Sheet', icon: <PieChart size={16} /> },
          { id: 'VAT', name: 'Tax / VAT Report', icon: <FileText size={16} /> },
          { id: 'Aging', name: 'Aging & Balances', icon: <BarChart3 size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black text-sm transition-all ${
              activeReport === tab.id 
              ? 'bg-white text-[#0B3C5D] shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 font-bold'
            }`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
         {activeReport === 'PL' && (
           <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center pb-8 border-b border-gray-50">
                 <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">Statement of Profit or Loss</h3>
                 <p className="text-sm text-gray-400 font-medium">For the period ending {format(dateRange.end, 'MMMM yyyy')}</p>
              </div>

              {/* Revenue */}
              <section className="space-y-4">
                 <div className="flex justify-between items-center bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">REVENUE</h4>
                    <span className="font-mono font-black text-[#0B3C5D]">GHC {revenue.toLocaleString()}</span>
                 </div>
                 <div className="pl-6 space-y-2">
                    {accounts.filter(a => a.type === 'Revenue').map(acc => (
                      <div key={acc.id} className="flex justify-between text-sm italic text-gray-500">
                         <span>{acc.name}</span>
                         <span className="font-mono">GHC {acc.balance.toLocaleString()}</span>
                      </div>
                    ))}
                 </div>
              </section>

              {/* COGS (Simplified as inventory assets if we tracked COGS account) */}
              <section className="space-y-4">
                 <div className="flex justify-between items-center bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">OPERATING EXPENSES</h4>
                    <span className="font-mono font-black text-red-500">(GHC {expenses.toLocaleString()})</span>
                 </div>
                 <div className="pl-6 space-y-2">
                    {accounts.filter(a => a.type === 'Expense').map(acc => (
                      <div key={acc.id} className="flex justify-between text-sm italic text-gray-500">
                         <span>{acc.name}</span>
                         <span className="font-mono">GHC {acc.balance.toLocaleString()}</span>
                      </div>
                    ))}
                 </div>
              </section>

              {/* Net Profit */}
              <div className="pt-8 border-t-2 border-[#0B3C5D] flex justify-between items-center">
                 <h4 className="text-xl font-black text-[#0B3C5D] uppercase tracking-tight">NET PROFIT / LOSS</h4>
                 <div className="text-right">
                    <span className={`text-3xl font-black ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                       GHC {netProfit.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Pre-tax consolidated earnings</p>
                 </div>
              </div>
           </div>
         )}

          {activeReport === 'BS' && (
           <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center pb-8 border-b border-gray-50">
                 <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">Balance Sheet (Financial Position)</h3>
                 <p className="text-sm text-gray-400 font-medium italic">As at {format(dateRange.end, 'MMMM dd, yyyy')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-8">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] italic">ASSETS</h4>
                    <div className="space-y-3">
                       {assets.map(acc => (
                         <div key={acc.id} className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{acc.name}</span>
                            <span className="font-mono text-sm font-black text-gray-800">GHC {acc.balance.toLocaleString()}</span>
                         </div>
                       ))}
                       <div className="flex justify-between pt-4 font-black text-[#0B3C5D]">
                          <span>TOTAL ASSETS</span>
                          <span>GHC {assets.reduce((sum, a) => sum + a.balance, 0).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <h4 className="text-sm font-black text-red-600 uppercase tracking-[0.2em] italic">LIABILITIES & EQUITY</h4>
                    <div className="space-y-6">
                       <div className="space-y-3">
                          {liabilities.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center border-b border-gray-50 pb-2">
                               <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{acc.name}</span>
                               <span className="font-mono text-sm font-black text-gray-800">GHC {acc.balance.toLocaleString()}</span>
                            </div>
                          ))}
                       </div>
                       <div className="space-y-3 pt-4">
                          <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Equity</h5>
                          {equity.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center border-b border-gray-50 pb-2">
                               <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">{acc.name}</span>
                               <span className="font-mono text-sm font-black text-gray-800">GHC {acc.balance.toLocaleString()}</span>
                            </div>
                          ))}
                          {/* Net Profit adds to Retained Earnings / Equity */}
                          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                             <span className="text-sm font-black text-green-600 uppercase tracking-tight italic">Net Profit (Current Period)</span>
                             <span className="font-mono text-sm font-black text-green-600">GHC {netProfit.toLocaleString()}</span>
                          </div>
                       </div>

                       <div className="flex justify-between pt-4 font-black text-[#0B3C5D] border-t-2 border-[#0B3C5D]">
                          <span>TOTAL L & EQ</span>
                          <span>GHC {(liabilities.reduce((sum, a) => sum + a.balance, 0) + equity.reduce((sum, e) => sum + e.balance, 0) + netProfit).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
         )}

         {activeReport === 'Aging' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               <div className="space-y-8">
                  <h3 className="text-xl font-black text-[#0B3C5D] uppercase tracking-tight">Accounts Receivable Aging</h3>
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                     <table className="w-full text-xs font-bold uppercase tracking-tight">
                        <thead>
                           <tr className="text-gray-400 text-[10px] tracking-widest border-b border-gray-200">
                              <th className="py-2 text-left">Customer</th>
                              <th className="py-2 text-right">0-30</th>
                              <th className="py-2 text-right">31-60</th>
                              <th className="py-2 text-right">60+</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {customers.map(c => (
                              <tr key={c.id}>
                                 <td className="py-4 font-black">{c.name}</td>
                                 <td className="py-4 text-right">GHC {c.balance > 0 ? c.balance.toLocaleString() : 0}</td>
                                 <td className="py-4 text-right text-gray-400">0</td>
                                 <td className="py-4 text-right text-gray-400">0</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="space-y-8">
                  <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">Accounts Payable Aging</h3>
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                     <table className="w-full text-xs font-bold uppercase tracking-tight">
                        <thead>
                           <tr className="text-gray-400 text-[10px] tracking-widest border-b border-gray-200">
                              <th className="py-2 text-left">Supplier</th>
                              <th className="py-2 text-right">Balance</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {suppliers.map(s => (
                              <tr key={s.id}>
                                 <td className="py-4 font-black">{s.name}</td>
                                 <td className="py-4 text-right text-red-600">GHC {s.balance?.toLocaleString()}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default Reports;
