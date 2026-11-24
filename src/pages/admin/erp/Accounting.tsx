import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db, auth } from '@/src/lib/firebase';
import { Account, JournalEntry } from '@/src/types/erp';
import { recordJournalEntry } from '@/src/lib/accountingService';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeFormatDate } from '@/src/lib/dateUtils';
import { COMPANY_INFO } from '@/src/constants/auth';
import Logo from '@/src/components/ui/Logo';
import {
  Calculator,
  Plus,
  ArrowRightLeft,
  FileText,
  TrendingUp,
  PieChart,
  BookOpen,
  Filter,
  Printer,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const Accounting = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [activeTab, setActiveTab] = useState<'accounts' | 'journal' | 'ledger'>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newEntry, setNewEntry] = useState({
    description: '',
    reference: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    lines: [
      { accountId: '', accountName: '', debit: 0, credit: 0 },
      { accountId: '', accountName: '', debit: 0, credit: 0 },
    ],
  });

  const handleAddLine = () => {
    setNewEntry((prev) => ({
      ...prev,
      lines: [...prev.lines, { accountId: '', accountName: '', debit: 0, credit: 0 }],
    }));
  };

  const handleRemoveLine = (index: number) => {
    if (newEntry.lines.length <= 2) return;
    setNewEntry((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updatedLines = [...newEntry.lines];
    if (field === 'accountId') {
      const acc = accounts.find((a) => a.id === value);
      updatedLines[index] = { ...updatedLines[index], accountId: value, accountName: acc?.name || '' };
    } else {
      updatedLines[index] = { ...updatedLines[index], [field]: value };
    }
    setNewEntry({ ...newEntry, lines: updatedLines });
  };

  const handlePostEntry = async () => {
    setFormError(null);
    if (!newEntry.description.trim()) {
      setFormError('Please enter a description for this journal entry.');
      return;
    }

    setSubmitting(true);
    try {
      await recordJournalEntry({
        ...newEntry,
        sourceType: 'manual',
        status: 'posted',
        createdBy: auth.currentUser?.email || 'unknown',
      });
      setIsModalOpen(false);
      setNewEntry({
        description: '',
        reference: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        lines: [
          { accountId: '', accountName: '', debit: 0, credit: 0 },
          { accountId: '', accountName: '', debit: 0, credit: 0 },
        ],
      });
    } catch (error: any) {
      setFormError(error?.message || 'Failed to post journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubAccounts = onSnapshot(
      collection(db, 'accounts'),
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account)));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'accounts');
      }
    );

    const unsubJournal = onSnapshot(
      query(collection(db, 'journal_entries'), orderBy('date', 'desc')),
      (snap) => {
        setJournalEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JournalEntry)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'journal_entries')
    );

    return () => {
      unsubAccounts();
      unsubJournal();
    };
  }, [currentUserRole]);

  const totalAssets = accounts
    .filter((a) => a.type === 'Asset')
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === 'Liability')
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const sortedAccounts = [...accounts].sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const trialBalanceRows = sortedAccounts.map((acc) => {
    const bal = Number(acc.balance) || 0;
    const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
    const debit = isDebitNormal ? (bal >= 0 ? bal : 0) : bal < 0 ? Math.abs(bal) : 0;
    const credit = !isDebitNormal ? (bal >= 0 ? bal : 0) : bal < 0 ? Math.abs(bal) : 0;
    return { ...acc, debit, credit };
  });

  const totalTrialDebit = trialBalanceRows.reduce((s, r) => s + r.debit, 0);
  const totalTrialCredit = trialBalanceRows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="hidden print:flex items-center justify-between border-b-2 border-[#0B3C5D] pb-4 mb-6">
        <Logo className="h-14" />
        <div className="text-right text-xs text-gray-600">
          <p className="font-black text-[#0B3C5D] uppercase">{COMPANY_INFO.name}</p>
          <p>{COMPANY_INFO.address}</p>
          <p>{COMPANY_INFO.phonesDisplay} | {COMPANY_INFO.email}</p>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Assets
            </span>
          </div>
          <h3 className="text-2xl font-black text-[#0B3C5D]">
            GHC {totalAssets.toLocaleString()}
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-medium">Total Resource Value</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600">
              <ArrowRightLeft size={24} />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Liabilities
            </span>
          </div>
          <h3 className="text-2xl font-black text-[#0B3C5D]">
            GHC {totalLiabilities.toLocaleString()}
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-medium">Total Obligations</p>
        </div>

        <div className="bg-[#0B3C5D] p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl text-white">
                <Calculator size={24} />
              </div>
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                Net Worth
              </span>
            </div>
            <h3 className="text-2xl font-black">GHC {netWorth.toLocaleString()}</h3>
            <p className="text-xs text-white/50 mt-1 font-medium">Equity / Capital</p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center gap-3">
          <button
            type="button"
            className="w-full py-4 bg-[#EAB308] text-[#0B3C5D] rounded-2xl font-black shadow-lg shadow-yellow-200/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm"
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={20} />
            NEW JOURNAL ENTRY
          </button>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
          {[
            { id: 'accounts', name: 'Chart of Accounts', icon: <PieChart size={18} /> },
            { id: 'journal', name: 'Journal Entries', icon: <BookOpen size={18} /> },
            { id: 'ledger', name: 'Trial Balance', icon: <Filter size={18} /> },
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

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-[#0B3C5D] hover:bg-gray-50 transition-all shadow-sm"
        >
          <Printer size={18} />
          Print Ledger
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
        {loading ? (
          <div className="p-16 text-center text-gray-400 font-bold">Loading accounting records...</div>
        ) : (
          <>
            {activeTab === 'accounts' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Code
                      </th>
                      <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Account Name
                      </th>
                      <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Category
                      </th>
                      <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Current Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 sm:px-8 py-5">
                          <span className="font-mono text-sm font-bold text-[#1F7A8C] bg-cyan-50 px-3 py-1 rounded-lg italic">
                            {account.code}
                          </span>
                        </td>
                        <td className="px-6 sm:px-8 py-5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                account.isSystem ? 'bg-orange-400' : 'bg-blue-400'
                              }`}
                            />
                            <p className="font-black text-gray-800 uppercase tracking-tight">
                              {account.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 sm:px-8 py-5">
                          <span
                            className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                              account.type === 'Asset'
                                ? 'bg-blue-50 text-blue-600'
                                : account.type === 'Liability'
                                ? 'bg-red-50 text-red-600'
                                : account.type === 'Revenue'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-orange-50 text-orange-600'
                            }`}
                          >
                            {account.type}
                          </span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 text-right font-black text-gray-800">
                          GHC {(Number(account.balance) || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {sortedAccounts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-16 text-center text-gray-400 italic">
                          No chart of accounts records initialized yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'journal' && (
              <div className="p-6 sm:p-8 space-y-6">
                {journalEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-gray-100 rounded-3xl p-6 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-6 pb-4 border-b border-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-50 rounded-2xl text-[#0B3C5D]">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-800 uppercase tracking-tight">
                            {entry.description}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp size={12} /> {entry.sourceType || 'manual'} •{' '}
                            {safeFormatDate(entry.date || entry.createdAt, 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-gray-400">REF: {entry.reference || entry.id.slice(0, 8)}</p>
                    </div>
                    <div className="space-y-3">
                      {(entry.lines || []).map((line, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm gap-4">
                          <p className="font-bold text-gray-600 uppercase tracking-tight w-1/2">
                            {line.accountName}
                          </p>
                          <div className="flex gap-6 sm:gap-12 w-1/2 justify-end">
                            {line.debit > 0 && (
                              <span className="text-green-600 font-black">
                                DR GHC {Number(line.debit).toLocaleString()}
                              </span>
                            )}
                            {line.credit > 0 && (
                              <span className="text-blue-600 font-black text-right min-w-[100px]">
                                CR GHC {Number(line.credit).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {journalEntries.length === 0 && (
                  <div className="py-16 text-center text-gray-400 italic">
                    No journal entries posted yet.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ledger' && (
              <div className="overflow-x-auto">
                <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-black text-[#0B3C5D] uppercase">Trial Balance</h3>
                    <p className="text-xs text-gray-400">
                      Summary of all general ledger debit and credit balances as of{' '}
                      {format(new Date(), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                      Math.abs(totalTrialDebit - totalTrialCredit) < 0.01
                        ? 'bg-green-50 text-green-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {Math.abs(totalTrialDebit - totalTrialCredit) < 0.01 ? 'Balanced' : 'Review Difference'}
                  </span>
                </div>
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 sm:px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Code
                      </th>
                      <th className="px-6 sm:px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Account
                      </th>
                      <th className="px-6 sm:px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Type
                      </th>
                      <th className="px-6 sm:px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Debit (GHC)
                      </th>
                      <th className="px-6 sm:px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Credit (GHC)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trialBalanceRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50">
                        <td className="px-6 sm:px-8 py-4 font-mono text-xs font-bold text-[#1F7A8C]">
                          {row.code}
                        </td>
                        <td className="px-6 sm:px-8 py-4 font-bold text-gray-800 uppercase text-sm">
                          {row.name}
                        </td>
                        <td className="px-6 sm:px-8 py-4 text-xs text-gray-500 font-bold uppercase">
                          {row.type}
                        </td>
                        <td className="px-6 sm:px-8 py-4 text-right font-mono font-bold text-gray-800">
                          {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                        </td>
                        <td className="px-6 sm:px-8 py-4 text-right font-mono font-bold text-gray-800">
                          {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0B3C5D] text-white font-black">
                      <td colSpan={3} className="px-6 sm:px-8 py-5 uppercase tracking-widest text-xs">
                        Trial Balance Totals
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right font-mono">
                        GHC {totalTrialDebit.toLocaleString()}
                      </td>
                      <td className="px-6 sm:px-8 py-5 text-right font-mono">
                        GHC {totalTrialCredit.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-6 sm:p-10 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                    New Journal Entry
                  </h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                    Manual Ledger Adjustment
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-black"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              {formError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                    Description
                  </label>
                  <input
                    type="text"
                    className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                    placeholder="Purpose of entry"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                    Reference
                  </label>
                  <input
                    type="text"
                    className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                    placeholder="Invoice # or Doc ID"
                    value={newEntry.reference}
                    onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-[#0B3C5D] uppercase tracking-widest px-2">
                    Ledger Lines
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-[10px] font-black text-blue-600 hover:underline"
                  >
                    + ADD LINE
                  </button>
                </div>
                <div className="space-y-3">
                  {newEntry.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        className="col-span-5 px-3 py-3 bg-gray-50 rounded-xl outline-none text-xs font-bold uppercase tracking-tight"
                        value={line.accountId}
                        onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                      >
                        <option value="">Select Account</option>
                        {sortedAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            ({acc.code}) {acc.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        placeholder="Debit"
                        className="col-span-3 px-3 py-3 bg-gray-50 rounded-xl outline-none text-xs font-bold"
                        value={line.debit || ''}
                        onChange={(e) => handleLineChange(idx, 'debit', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Credit"
                        className="col-span-3 px-3 py-3 bg-gray-50 rounded-xl outline-none text-xs font-bold"
                        value={line.credit || ''}
                        onChange={(e) => handleLineChange(idx, 'credit', Number(e.target.value))}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={newEntry.lines.length <= 2}
                        className="col-span-1 flex justify-center text-gray-300 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50 flex flex-wrap justify-between items-center gap-4">
                <div className="text-[10px] font-black uppercase tracking-widest">
                  <p className="text-gray-400">
                    Total Debit:{' '}
                    <span className="text-green-600">
                      GHC {newEntry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-gray-400">
                    Total Credit:{' '}
                    <span className="text-blue-600">
                      GHC {newEntry.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0).toLocaleString()}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePostEntry}
                  className="px-8 py-4 bg-[#0B3C5D] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all disabled:opacity-60"
                >
                  {submitting ? 'POSTING...' : 'POST TO LEDGER'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Accounting;
