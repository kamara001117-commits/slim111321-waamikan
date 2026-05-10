import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  increment, 
  query, 
  where, 
  getDocs,
  runTransaction 
} from "firebase/firestore";
import { db } from "./firebase";
import { Account, JournalEntry, JournalLine, AccountType } from "../types/erp";

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

  for (const acc of systemAccounts) {
    const q = query(collection(db, ACCOUNTS_COLLECTION), where('code', '==', acc.code));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      const newAccRef = doc(collection(db, ACCOUNTS_COLLECTION));
      await setDoc(newAccRef, {
        ...acc,
        id: newAccRef.id,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }
};

/**
 * Record a double-entry journal entry
 */
export const recordJournalEntry = async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Verify balances (Debits must equal Credits)
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error("Journal entry must be balanced (Debits = Credits)");
    }

    const journalRef = doc(collection(db, JOURNAL_COLLECTION));
    const newEntry = {
      ...entry,
      id: journalRef.id,
      createdAt: new Date().toISOString()
    };

    // 2. Update account balances
    for (const line of entry.lines) {
      const accountRef = doc(db, ACCOUNTS_COLLECTION, line.accountId);
      const balanceChange = line.debit - line.credit;
      
      // Note: In accounting, Assets/Expenses increase with Debit (+)
      // Liabilities/Equity/Revenue increase with Credit (-)
      // We'll store balance such that positive means Debit balance for A/E and Credit balance for L/Eq/R
      // BUT for simplicity, let's just stick to absolute math relative to account type
      
      transaction.update(accountRef, {
        balance: increment(balanceChange),
        updatedAt: new Date().toISOString()
      });
    }

    transaction.set(journalRef, newEntry);
    return journalRef.id;
  });
};

/**
 * Get account by its unique code (e.g., '1100' for Accounts Receivable)
 */
export const getAccountByCode = async (code: string): Promise<Account | null> => {
  const q = query(collection(db, ACCOUNTS_COLLECTION), where('code', '==', code));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Account;
};

/**
 * Specific ERP events that trigger accounting
 */

export const recordInvoiceAccounting = async (invoiceId: string, amount: number) => {
  const arAccount = await getAccountByCode('1100'); // Accounts Receivable
  const revenueAccount = await getAccountByCode('4000'); // Sales Revenue

  if (!arAccount || !revenueAccount) throw new Error("Accounting system not initialized");

  await recordJournalEntry({
    date: new Date().toISOString(),
    reference: invoiceId,
    description: `Service/Product Sale - Invoice ${invoiceId}`,
    sourceType: 'invoice',
    status: 'posted',
    createdBy: 'system',
    lines: [
      { accountId: arAccount.id, accountName: arAccount.name, debit: amount, credit: 0 },
      { accountId: revenueAccount.id, accountName: revenueAccount.name, debit: 0, credit: amount }
    ]
  });
};

export const recordPaymentAccounting = async (paymentId: string, invoiceId: string, amount: number, method: string) => {
  const arAccount = await getAccountByCode('1100'); // Accounts Receivable
  const cashAccount = await getAccountByCode('1000'); // Cash on Hand

  if (!arAccount || !cashAccount) throw new Error("Accounting system not initialized");

  await recordJournalEntry({
    date: new Date().toISOString(),
    reference: paymentId,
    description: `Payment Received - Inv ${invoiceId} via ${method}`,
    sourceType: 'payment',
    status: 'posted',
    createdBy: 'system',
    lines: [
      { accountId: cashAccount.id, accountName: cashAccount.name, debit: amount, credit: 0 },
      { accountId: arAccount.id, accountName: arAccount.name, debit: 0, credit: amount }
    ]
  });
};
