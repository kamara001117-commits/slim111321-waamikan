import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { BankAccount, BankTransaction } from '@/src/types/erp';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { safeFormatDate } from '@/src/lib/dateUtils';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { suggestMatches, reconcileTransaction, TransactionMatch } from '@/src/lib/bankingService';

const Banking = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingTx, setMatchingTx] = useState<BankTransaction | null>(null);
  const [suggestions, setSuggestions] = useState<TransactionMatch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    type: 'Savings',
    balance: 0,
  });

  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({
    bankAccountId: '',
    type: 'deposit' as 'deposit' | 'withdrawal' | 'transfer',
    amount: 0,
    description: '',
    payee: '',
    reference: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleAddAccount = async () => {
    if (!newAccount.name.trim() || !newAccount.bankName.trim()) return;
    try {
      const ref = doc(collection(db, 'bank_accounts'));
      const now = new Date().toISOString();
      await setDoc(ref, {
        id: ref.id,
        name: newAccount.name.trim(),
        bankName: newAccount.bankName.trim(),
        accountNumber: newAccount.accountNumber.trim(),
        currency: 'GHC',
        balance: Number(newAccount.balance) || 0,
        type: newAccount.type,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      setShowAddAccount(false);
      setNewAccount({ name: '', bankName: '', accountNumber: '', type: 'Savings', balance: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bank_accounts');
    }
  };

  const handleAddTransaction = async () => {
    const amount = Number(newTx.amount) || 0;
    if (!newTx.bankAccountId || !newTx.description.trim() || amount <= 0) return;
    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(collection(db, 'bank_transactions'));
        const accRef = doc(db, 'bank_accounts', newTx.bankAccountId);
        const now = new Date().toISOString();
        const delta = newTx.type === 'deposit' ? amount : -amount;

        transaction.update(accRef, {
          balance: increment(delta),
          updatedAt: now,
        });

        transaction.set(txRef, {
          id: txRef.id,
          bankAccountId: newTx.bankAccountId,
          amount,
          type: newTx.type,
          description: newTx.description.trim(),
          payee: newTx.payee.trim(),
          reference: newTx.reference.trim(),
          date: newTx.date || now,
          reconciled: false,
          createdAt: now,
        });
      });

      setShowAddTx(false);
      setNewTx({
        bankAccountId: '',
        type: 'deposit',
        amount: 0,
        description: '',
        payee: '',
        reference: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bank_transactions');
    }
  };

  useEffect(() => {
    if (!currentUserRole) return;

    const unsubAccounts = onSnapshot(
      collection(db, 'bank_accounts'),
      (snap) => {
        setBankAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankAccount)));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'bank_accounts');
      }
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'bank_transactions'), orderBy('date', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankTransaction)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'bank_transactions')
    );

    return () => {
      unsubAccounts();
      unsubTransactions();
    };
  }, [currentUserRole]);

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(term) ||
      tx.payee?.toLowerCase().includes(term) ||
      tx.reference?.toLowerCase().includes(term)
    );
  });

  const canManageBankAccounts = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B3C5D] tracking-tight">
            BANKING &amp; CASH
          </h2>
          <p className="text-sm font-medium text-gray-500 italic mt-1">
            Manage liquid assets and institutional reconciliations
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {bankAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAddTx(true)}
              className="flex items-center gap-2 px-5 py-3.5 bg-[#EAB308] text-[#0B3C5D] rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
            >
              <Plus size={18} />
              RECORD TRANSACTION
            </button>
          )}
          {canManageBankAccounts && (
            <button
              type="button"
              onClick={() => setShowAddAccount(true)}
              className="flex items-center gap-2 px-5 py-3.5 bg-[#0B3C5D] text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-all text-xs uppercase tracking-widest"
            >
              <Plus size={18} />
              ADD ACCOUNT
            </button>
          )}
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {bankAccounts.map((account) => (
          <div
            key={account.id}
            className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative group overflow-hidden"
          >
            <div className="flex justify-between items-start mb-10 relative z-10">
              <div className="p-4 bg-gray-50 rounded-2xl text-[#0B3C5D]">
                <Building2 size={24} />
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {account.bankName}
              </span>
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {account.name}
              </p>
              <h3 className="text-3xl font-black text-[#0B3C5D]">
                {account.currency || 'GHC'} {(Number(account.balance) || 0).toLocaleString()}
              </h3>
              <p className="font-mono text-xs text-gray-400 mt-4 tracking-tighter">
                **** **** {(account.accountNumber || '0000').slice(-4)}
              </p>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-gray-50 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-700" />
          </div>
        ))}
        {!loading && bankAccounts.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 font-medium text-center px-4">
            <Wallet size={48} className="mb-4 opacity-20" />
            <p>No active bank accounts found. Initialize institutional mapping.</p>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-20">
        <div className="p-6 sm:p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-sm font-black text-[#0B3C5D] uppercase tracking-[0.2em]">
            Live Transactions
          </h3>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-full sm:w-72">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:outline-none w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Date
                </th>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Description
                </th>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Type
                </th>
                <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Amount
                </th>
                <th className="px-6 sm:px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 sm:px-8 py-5 text-sm font-bold text-gray-500 italic">
                    {safeFormatDate(tx.date, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 sm:px-8 py-5">
                    <p className="font-black text-gray-800 uppercase tracking-tight">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {tx.payee || 'Direct Entry'}
                    </p>
                  </td>
                  <td className="px-6 sm:px-8 py-5">
                    <div className="flex items-center gap-2">
                      {tx.type === 'deposit' ? (
                        <ArrowDownLeft size={16} className="text-green-500" />
                      ) : (
                        <ArrowUpRight size={16} className="text-red-500" />
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {tx.type}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-6 sm:px-8 py-5 text-right font-black ${
                      tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {tx.type === 'deposit' ? '+' : '-'} GHC {(Number(tx.amount) || 0).toLocaleString()}
                  </td>
                  <td className="px-6 sm:px-8 py-5">
                    <div className="flex justify-center">
                      {tx.reconciled ? (
                        <span className="flex items-center gap-1 text-[9px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest border border-green-100">
                          <CheckCircle2 size={12} /> RECONCILED
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            setMatchingTx(tx);
                            const matches = await suggestMatches(tx.amount, tx.date, tx.description);
                            setSuggestions(matches);
                          }}
                          className="flex items-center gap-1 text-[9px] font-black bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full uppercase tracking-widest border border-yellow-100 hover:bg-yellow-100 transition-colors"
                        >
                          <Clock size={12} /> RECONCILE
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-400 italic">
                    No bank transactions recorded matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matching Slide-over */}
      {matchingTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-white p-6 sm:p-12 shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-[#0B3C5D] uppercase tracking-tight">
                Reconciliation Wizard
              </h3>
              <button
                type="button"
                onClick={() => setMatchingTx(null)}
                className="text-gray-400 hover:text-black font-black text-xs uppercase"
              >
                Close
              </button>
            </div>

            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                Transaction Detail
              </p>
              <h4 className="text-xl font-black text-[#0B3C5D]">{matchingTx.description}</h4>
              <p className="text-2xl font-black text-[#1F7A8C] mt-2">
                GHC {(Number(matchingTx.amount) || 0).toLocaleString()}
              </p>
              <p className="text-xs font-bold text-gray-400 mt-1 italic">
                {safeFormatDate(matchingTx.date, 'MMMM dd, yyyy')}
              </p>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-black text-[#0B3C5D] uppercase tracking-widest">
                Suggested Matches
              </h5>
              {suggestions.length === 0 && (
                <p className="text-sm text-gray-400 italic">
                  No exact invoice or supplier bill matches found for this amount.
                </p>
              )}
              {suggestions.map((match, i) => (
                <div key={i} className="p-6 rounded-3xl border-2 border-[#1F7A8C] bg-white relative group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] font-black bg-[#1F7A8C] text-white px-3 py-1 rounded-full uppercase tracking-widest">
                      {Math.round(match.confidence * 100)}% Match
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {match.type}
                    </span>
                  </div>
                  <h6 className="font-black text-[#0B3C5D] uppercase">{match.reason}</h6>
                  <p className="text-[#1F7A8C] font-black text-xl mt-2">
                    GHC {match.amount.toLocaleString()}
                  </p>

                  <button
                    type="button"
                    onClick={async () => {
                      await reconcileTransaction(matchingTx.id, match.docId, match.type as any);
                      setMatchingTx(null);
                    }}
                    className="w-full mt-6 py-4 bg-[#0B3C5D] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all"
                  >
                    Accept &amp; Reconcile
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddAccount(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">ADD BANK ACCOUNT</h3>
              <button type="button" onClick={() => setShowAddAccount(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Internal Name (e.g. Main Operations)"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Bank Name"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newAccount.bankName}
                onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Account Number"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newAccount.accountNumber}
                onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
              />
              <select
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newAccount.type}
                onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
              >
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
              <input
                type="number"
                placeholder="Opening Balance (GHC)"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newAccount.balance || ''}
                onChange={(e) => setNewAccount({ ...newAccount, balance: Number(e.target.value) })}
              />
            </div>
            <button
              type="button"
              onClick={handleAddAccount}
              className="w-full py-5 bg-[#0B3C5D] text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20"
            >
              Initialize Mapping
            </button>
          </div>
        </div>
      )}

      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddTx(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-[#0B3C5D]">RECORD TRANSACTION</h3>
              <button type="button" onClick={() => setShowAddTx(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.bankAccountId}
                onChange={(e) => setNewTx({ ...newTx, bankAccountId: e.target.value })}
              >
                <option value="">Select Bank Account</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.bankName})
                  </option>
                ))}
              </select>
              <select
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.type}
                onChange={(e) => setNewTx({ ...newTx, type: e.target.value as any })}
              >
                <option value="deposit">Deposit (Inflow)</option>
                <option value="withdrawal">Withdrawal (Outflow)</option>
                <option value="transfer">Transfer</option>
              </select>
              <input
                type="number"
                min={0.01}
                step="0.01"
                placeholder="Amount (GHC)"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.amount || ''}
                onChange={(e) => setNewTx({ ...newTx, amount: Number(e.target.value) })}
              />
              <input
                type="text"
                placeholder="Description"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.description}
                onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
              />
              <input
                type="text"
                placeholder="Payee / Payer"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.payee}
                onChange={(e) => setNewTx({ ...newTx, payee: e.target.value })}
              />
              <input
                type="date"
                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                value={newTx.date}
                onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={handleAddTransaction}
              className="w-full py-5 bg-[#0B3C5D] text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20"
            >
              Save Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banking;
