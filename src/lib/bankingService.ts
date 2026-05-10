import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs,
  runTransaction,
  increment
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getAccountByCode } from "./accountingService";

export interface TransactionMatch {
  docId: string;
  type: 'invoice' | 'bill' | 'expense';
  amount: number;
  date: string;
  confidence: number;
  reason: string;
}

/**
 * AI/Logic based matching for bank transactions
 */
export const suggestMatches = async (amount: number, date: string, description: string) => {
  const matches: TransactionMatch[] = [];

  // 1. Search Unpaid Invoices (Income)
  const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('status', 'in', ['sent', 'partial'])));
  invoicesSnap.forEach(snap => {
    const data = snap.data();
    if (Math.abs(data.total - amount) < 0.01) {
       matches.push({
         docId: snap.id,
         type: 'invoice',
         amount: data.total,
         date: data.createdAt,
         confidence: 0.95,
         reason: 'Exact amount match'
       });
    }
  });

  // 2. Search Unpaid Bills (Outcome)
  const billsSnap = await getDocs(query(collection(db, 'supplier_bills'), where('status', '==', 'Unpaid')));
  billsSnap.forEach(snap => {
    const data = snap.data();
    if (Math.abs(data.total - Math.abs(amount)) < 0.01) {
       matches.push({
         docId: snap.id,
         type: 'bill',
         amount: data.total,
         date: data.date,
         confidence: 0.95,
         reason: 'Exact amount match'
       });
    }
  });

  return matches.sort((a,b) => b.confidence - a.confidence);
};

export const reconcileTransaction = async (bankTxId: string, matchDocId: string, type: 'invoice' | 'bill') => {
  return await runTransaction(db, async (transaction) => {
    const bankTxRef = doc(db, 'bank_transactions', bankTxId);
    const matchRef = doc(db, type === 'invoice' ? 'invoices' : 'supplier_bills', matchDocId);
    
    // 1. Accounting: record the payment
    const cashAccount = await getAccountByCode('1000');
    const targetAccount = type === 'invoice' 
      ? await getAccountByCode('1100') // AR
      : await getAccountByCode('2100'); // AP

    if (!cashAccount || !targetAccount) throw new Error("Accounts not found");

    const matchSnap = await transaction.get(matchRef);
    const matchData = matchSnap.data();
    if (!matchData) throw new Error("Match document not found");

    const amount = matchData.total;

    const journalRef = doc(collection(db, 'journal_entries'));
    transaction.set(journalRef, {
      id: journalRef.id,
      date: new Date().toISOString(),
      reference: bankTxId,
      description: `Reconciliation: ${type} ${matchDocId}`,
      sourceType: 'payment',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: cashAccount.id, accountName: cashAccount.name, debit: type === 'invoice' ? amount : 0, credit: type === 'invoice' ? 0 : amount },
        { accountId: targetAccount.id, accountName: targetAccount.name, debit: type === 'invoice' ? 0 : amount, credit: type === 'invoice' ? amount : 0 }
      ]
    });

    // 2. Update status and balances
    transaction.update(matchRef, { status: 'Paid' });
    transaction.update(bankTxRef, { reconciled: true, matchedId: matchDocId });
    transaction.update(doc(db, 'accounts', cashAccount.id), { balance: increment(type === 'invoice' ? amount : -amount) });
    transaction.update(doc(db, 'accounts', targetAccount.id), { balance: increment(type === 'invoice' ? -amount : amount) });

    return true;
  });
};
