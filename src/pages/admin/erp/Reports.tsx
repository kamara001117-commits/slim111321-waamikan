import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { Account, SupplierBill } from '@/src/types/erp';
import { Invoice } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeDate, safeFormatDate } from '@/src/lib/dateUtils';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Calendar,
  FileText,
  Printer,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

const Reports = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [activeReport, setActiveReport] = useState<'PL' | 'BS' | 'VAT' | 'Aging'>('PL');
  const [dateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubAcc = onSnapshot(
      collection(db, 'accounts'),
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'accounts')
    );

    const unsubSuppliers = onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers')
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snap) => {
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    const unsubBills = onSnapshot(
      collection(db, 'supplier_bills'),
      (snap) => {
        setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupplierBill)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supplier_bills')
    );

    return () => {
      unsubAcc();
      unsubSuppliers();
      unsubCustomers();
      unsubInvoices();
      unsubBills();
    };
  }, [currentUserRole]);

  // Profit & Loss calculations
  const revenue = accounts
    .filter((a) => a.type === 'Revenue')
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const expenses = accounts
    .filter((a) => a.type === 'Expense')
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const netProfit = revenue - expenses;

  // Balance Sheet calculations
  const assets = accounts.filter((a) => a.type === 'Asset');
  const liabilities = accounts.filter((a) => a.type === 'Liability');
  const equity = accounts.filter((a) => a.type === 'Equity');

  // VAT Report calculations
  const outputVat = invoices.reduce((sum, inv) => sum + (Number(inv.vat) || 0), 0);
  const taxableSales = invoices.reduce(
    (sum, inv) => sum + (Number(inv.subtotal ?? inv.total) || 0),
    0
  );
  const inputVat = bills.reduce((sum, b) => sum + (Number(b.tax) || 0), 0);
  const taxablePurchases = bills.reduce(
    (sum, b) => sum + (Number(b.subtotal ?? b.total) || 0),
    0
  );
  const netVatPayable = outputVat - inputVat;

  // AR Aging calculations from unpaid/partial invoices
  const now = new Date();
  const arAgingRows = customers.map((customer) => {
    const custInvoices = invoices.filter(
      (inv) => inv.customerId === customer.id && (Number(inv.remainingBalance) || 0) > 0
    );
    let bucket0_30 = 0;
    let bucket31_60 = 0;
    let bucket60Plus = 0;

    custInvoices.forEach((inv) => {
      const due = safeDate(inv.dueDate || inv.createdAt);
      const age = Math.max(0, differenceInDays(now, due));
      const bal = Number(inv.remainingBalance) || 0;
      if (age <= 30) bucket0_30 += bal;
      else if (age <= 60) bucket31_60 += bal;
      else bucket60Plus += bal;
    });

    return {
      id: customer.id,
      name: customer.name,
      bucket0_30,
      bucket31_60,
      bucket60Plus,
      total: bucket0_30 + bucket31_60 + bucket60Plus,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] tracking-tight uppercase">
            FINANCIAL STATEMENTS
          </h2>
          <p className="text-sm font-medium text-gray-400 italic">
            Official fiscal reporting and audit-ready exports
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm font-bold text-gray-500 text-sm">
            <Calendar size={18} />
            {format(dateRange.start, 'MMM dd')} - {format(dateRange.end, 'MMM dd, yyyy')}
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3.5 bg-[#0B3C5D] text-white rounded-2xl shadow-lg hover:scale-[1.02] transition-all font-bold text-sm"
          >
            <Printer size={18} />
            Print Report
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl w-fit max-w-full">
        {[
          { id: 'PL', name: 'Profit & Loss', icon: <TrendingUp size={16} /> },
          { id: 'BS', name: 'Balance Sheet', icon: <PieChart size={16} /> },
          { id: 'VAT', name: 'Tax / VAT Report', icon: <FileText size={16} /> },
          { id: 'Aging', name: 'Aging & Balances', icon: <BarChart3 size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveReport(tab.id as any)}
            className={`flex items-center gap-2 sm:gap-3 px-5 sm:px-7 py-3.5 rounded-xl font-black text-xs sm:text-sm transition-all ${
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

      <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-sm mb-20">
        {activeReport === 'PL' && (
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center pb-8 border-b border-gray-50">
              <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                Statement of Profit or Loss
              </h3>
              <p className="text-sm text-gray-400 font-medium">
                For the period ending {format(dateRange.end, 'MMMM yyyy')}
              </p>
            </div>

            <section className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">REVENUE</h4>
                <span className="font-mono font-black text-[#0B3C5D]">
                  GHC {revenue.toLocaleString()}
                </span>
              </div>
              <div className="pl-6 space-y-2">
                {accounts
                  .filter((a) => a.type === 'Revenue')
                  .map((acc) => (
                    <div key={acc.id} className="flex justify-between text-sm italic text-gray-500">
                      <span>{acc.name}</span>
                      <span className="font-mono">GHC {(Number(acc.balance) || 0).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                  OPERATING EXPENSES
                </h4>
                <span className="font-mono font-black text-red-500">
                  (GHC {expenses.toLocaleString()})
                </span>
              </div>
              <div className="pl-6 space-y-2">
                {accounts
                  .filter((a) => a.type === 'Expense')
                  .map((acc) => (
                    <div key={acc.id} className="flex justify-between text-sm italic text-gray-500">
                      <span>{acc.name}</span>
                      <span className="font-mono">GHC {(Number(acc.balance) || 0).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </section>

            <div className="pt-8 border-t-2 border-[#0B3C5D] flex flex-wrap justify-between items-center gap-4">
              <h4 className="text-xl font-black text-[#0B3C5D] uppercase tracking-tight">
                NET PROFIT / LOSS
              </h4>
              <div className="text-right">
                <span
                  className={`text-3xl font-black ${
                    netProfit >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  GHC {netProfit.toLocaleString()}
                </span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Pre-tax consolidated earnings
                </p>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'BS' && (
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center pb-8 border-b border-gray-50">
              <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                Balance Sheet (Financial Position)
              </h3>
              <p className="text-sm text-gray-400 font-medium italic">
                As at {format(dateRange.end, 'MMMM dd, yyyy')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h4 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] italic">
                  ASSETS
                </h4>
                <div className="space-y-3">
                  {assets.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex justify-between items-center border-b border-gray-50 pb-2"
                    >
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                        {acc.name}
                      </span>
                      <span className="font-mono text-sm font-black text-gray-800">
                        GHC {(Number(acc.balance) || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-4 font-black text-[#0B3C5D]">
                    <span>TOTAL ASSETS</span>
                    <span>
                      GHC {assets.reduce((sum, a) => sum + (Number(a.balance) || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h4 className="text-sm font-black text-red-600 uppercase tracking-[0.2em] italic">
                  LIABILITIES &amp; EQUITY
                </h4>
                <div className="space-y-6">
                  <div className="space-y-3">
                    {liabilities.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex justify-between items-center border-b border-gray-50 pb-2"
                      >
                        <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                          {acc.name}
                        </span>
                        <span className="font-mono text-sm font-black text-gray-800">
                          GHC {(Number(acc.balance) || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 pt-4">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Equity
                    </h5>
                    {equity.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex justify-between items-center border-b border-gray-50 pb-2"
                      >
                        <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                          {acc.name}
                        </span>
                        <span className="font-mono text-sm font-black text-gray-800">
                          GHC {(Number(acc.balance) || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                      <span className="text-sm font-black text-green-600 uppercase tracking-tight italic">
                        Net Profit (Current Period)
                      </span>
                      <span className="font-mono text-sm font-black text-green-600">
                        GHC {netProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 font-black text-[#0B3C5D] border-t-2 border-[#0B3C5D]">
                    <span>TOTAL L &amp; EQ</span>
                    <span>
                      GHC{' '}
                      {(
                        liabilities.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) +
                        equity.reduce((sum, e) => sum + (Number(e.balance) || 0), 0) +
                        netProfit
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'VAT' && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center pb-8 border-b border-gray-50">
              <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                Tax &amp; VAT Return Schedule
              </h3>
              <p className="text-sm text-gray-400 font-medium">
                Consolidated Output VAT (Sales) vs Input VAT (Procurement)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-blue-50/60 rounded-3xl border border-blue-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Output VAT (Invoices)
                </p>
                <p className="text-2xl font-black text-[#0B3C5D] mt-2">
                  GHC {outputVat.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  On GHC {taxableSales.toLocaleString()} gross billed
                </p>
              </div>
              <div className="p-6 bg-amber-50/60 rounded-3xl border border-amber-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Input VAT (Bills)
                </p>
                <p className="text-2xl font-black text-amber-700 mt-2">
                  GHC {inputVat.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  On GHC {taxablePurchases.toLocaleString()} supplier bills
                </p>
              </div>
              <div className="p-6 bg-[#0B3C5D] text-white rounded-3xl shadow-lg">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Net VAT {netVatPayable >= 0 ? 'Payable' : 'Credit'}
                </p>
                <p className="text-2xl font-black mt-2">
                  GHC {Math.abs(netVatPayable).toLocaleString()}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {invoices.length} invoices • {bills.length} vendor bills
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-gray-50 rounded-3xl p-6 border border-gray-100">
              <h4 className="text-sm font-black text-[#0B3C5D] uppercase tracking-widest mb-4">
                Taxed Sales Invoices
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-200">
                    <th className="py-3 text-left">Invoice #</th>
                    <th className="py-3 text-left">Customer</th>
                    <th className="py-3 text-left">Date</th>
                    <th className="py-3 text-right">Total</th>
                    <th className="py-3 text-right">VAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 font-mono font-bold text-[#0B3C5D]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 font-bold uppercase">{inv.customerName}</td>
                      <td className="py-3 text-gray-500">
                        {safeFormatDate(inv.createdAt, 'MMM dd, yyyy')}
                      </td>
                      <td className="py-3 text-right font-bold">
                        GHC {(Number(inv.total) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-black text-blue-700">
                        GHC {(Number(inv.vat) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                        No invoices recorded for tax schedule yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'Aging' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-[#0B3C5D] uppercase tracking-tight">
                Accounts Receivable Aging
              </h3>
              <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 overflow-x-auto">
                <table className="w-full text-xs font-bold uppercase tracking-tight min-w-[420px]">
                  <thead>
                    <tr className="text-gray-400 text-[10px] tracking-widest border-b border-gray-200">
                      <th className="py-2 text-left">Customer</th>
                      <th className="py-2 text-right">0-30</th>
                      <th className="py-2 text-right">31-60</th>
                      <th className="py-2 text-right">60+</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {arAgingRows.map((c) => (
                      <tr key={c.id}>
                        <td className="py-4 font-black">{c.name}</td>
                        <td className="py-4 text-right">GHC {c.bucket0_30.toLocaleString()}</td>
                        <td className="py-4 text-right text-amber-600">
                          GHC {c.bucket31_60.toLocaleString()}
                        </td>
                        <td className="py-4 text-right text-red-600">
                          GHC {c.bucket60Plus.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {arAgingRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 italic">
                          No customer records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">
                Accounts Payable Aging
              </h3>
              <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 overflow-x-auto">
                <table className="w-full text-xs font-bold uppercase tracking-tight min-w-[320px]">
                  <thead>
                    <tr className="text-gray-400 text-[10px] tracking-widest border-b border-gray-200">
                      <th className="py-2 text-left">Supplier</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {suppliers.map((s) => (
                      <tr key={s.id}>
                        <td className="py-4 font-black">{s.name}</td>
                        <td className="py-4 text-right text-red-600">
                          GHC {(Number(s.balance) || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-400 italic">
                          No supplier balances recorded.
                        </td>
                      </tr>
                    )}
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
