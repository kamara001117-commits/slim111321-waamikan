import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Account, JournalEntry, AccountType } from '../types/erp';
import { handleFirestoreError, OperationType } from './firestoreUtils';

const ACCOUNTS_COLLECTION = 'accounts';
const JOURNAL_COLLECTION = 'journal_entries';

/**
 * Ensures system accounts exist (Accounts Receivable, Accounts Payable, etc.)
 */
export const initializeSystemAccounts = async () => {
  const systemAccounts = [
    { code: '1100', name: 'Accounts Receivable', type: 'Asset' as AccountType, isSystem: true },
    { code: '2100', name: 'Accounts Payable', type: 'Liability' as AccountType, isSystem: true },
    { code: '1000', name: 'Cash on Hand', type: 'Asset' as AccountType, isSystem: true },
    { code: '4000', name: 'Sales Revenue', type: 'Revenue' as AccountType, isSystem: true },
    { code: '4100', name: 'Sales Returns', type: 'Revenue' as AccountType, isSystem: true },
    { code: '5000', name: 'Cost of Goods Sold', type: 'Expense' as AccountType, isSystem: true },
    { code: '1200', name: 'Inventory Asset', type: 'Asset' as AccountType, isSystem: true },
    { code: '6000', name: 'Salary Expense', type: 'Expense' as AccountType, isSystem: true },
    { code: '6500', name: 'General Expense', type: 'Expense' as AccountType, isSystem: true },
    { code: '5100', name: 'Purchase Returns', type: 'Revenue' as AccountType, isSystem: true },
  ];

  try {
    for (const acc of systemAccounts) {
      const q = query(collection(db, ACCOUNTS_COLLECTION), where('code', '==', acc.code));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        const newAccRef = doc(collection(db, ACCOUNTS_COLLECTION));
        const now = new Date().toISOString();
        await setDoc(newAccRef, {
          ...acc,
          id: newAccRef.id,
          balance: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ACCOUNTS_COLLECTION);
  }
};

/**
 * Record a double-entry journal entry with normal-balance rules per account type
 */
export const recordJournalEntry = async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
  const totalDebit = entry.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = entry.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

  if (entry.lines.length === 0) {
    throw new Error('Journal entry must contain at least one line.');
  }
  if (entry.lines.some((l) => !l.accountId)) {
    throw new Error('All journal lines must have a selected account.');
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Journal entry must be balanced (Debits = Credits)');
  }

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Read all unique referenced accounts FIRST before any writes
      const uniqueAccountIds = Array.from(new Set(entry.lines.map((l) => l.accountId)));
      const accountSnaps = await Promise.all(
        uniqueAccountIds.map((id) => transaction.get(doc(db, ACCOUNTS_COLLECTION, id)))
      );

      const accountMap = new Map<string, Account>();
      accountSnaps.forEach((snap) => {
        if (snap.exists()) {
          accountMap.set(snap.id, { id: snap.id, ...snap.data() } as Account);
        }
      });

      // Aggregate net balance deltas per account according to normal balance
      const deltaMap = new Map<string, number>();
      for (const line of entry.lines) {
        const acc = accountMap.get(line.accountId);
        if (!acc) {
          throw new Error(`Account ${line.accountId} not found.`);
        }
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        // Asset & Expense increase on Debit; Liability, Equity, & Revenue increase on Credit
        const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
        const delta = isDebitNormal ? debit - credit : credit - debit;
        deltaMap.set(line.accountId, (deltaMap.get(line.accountId) || 0) + delta);
      }

      const now = new Date().toISOString();
      const journalRef = doc(collection(db, JOURNAL_COLLECTION));
      const newEntry = {
        ...entry,
        id: journalRef.id,
        createdAt: now,
      };

      // 2. Perform all writes AFTER all reads
      deltaMap.forEach((delta, accountId) => {
        const acc = accountMap.get(accountId)!;
        const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
        transaction.update(accountRef, {
          balance: (acc.balance || 0) + delta,
          updatedAt: now,
        });
      });

      transaction.set(journalRef, newEntry);
      return journalRef.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, JOURNAL_COLLECTION);
  }
};

/**
 * Get account by its unique code (e.g., '1100' for Accounts Receivable)
 */
export const getAccountByCode = async (code: string): Promise<Account | null> => {
  try {
    const q = query(collection(db, ACCOUNTS_COLLECTION), where('code', '==', code));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as Account;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, ACCOUNTS_COLLECTION);
    return null;
  }
};

export const recordInvoiceAccounting = async (invoiceId: string, amount: number) => {
  const arAccount = await getAccountByCode('1100');
  const revenueAccount = await getAccountByCode('4000');

  if (!arAccount || !revenueAccount) throw new Error('Accounting system not initialized');

  await recordJournalEntry({
    date: new Date().toISOString(),
    reference: invoiceId,
    description: `Service/Product Sale - Invoice ${invoiceId}`,
    sourceType: 'invoice',
    status: 'posted',
    createdBy: 'system',
    lines: [
      { accountId: arAccount.id, accountName: arAccount.name, debit: amount, credit: 0 },
      { accountId: revenueAccount.id, accountName: revenueAccount.name, debit: 0, credit: amount },
    ],
  });
};

export const recordPaymentAccounting = async (
  paymentId: string,
  invoiceId: string,
  amount: number,
  method: string
) => {
  const arAccount = await getAccountByCode('1100');
  const cashAccount = await getAccountByCode('1000');

  if (!arAccount || !cashAccount) throw new Error('Accounting system not initialized');

  await recordJournalEntry({
    date: new Date().toISOString(),
    reference: paymentId,
    description: `Payment Received - Inv ${invoiceId} via ${method}`,
    sourceType: 'payment',
    status: 'posted',
    createdBy: 'system',
    lines: [
      { accountId: cashAccount.id, accountName: cashAccount.name, debit: amount, credit: 0 },
      { accountId: arAccount.id, accountName: arAccount.name, debit: 0, credit: amount },
    ],
  });
};
