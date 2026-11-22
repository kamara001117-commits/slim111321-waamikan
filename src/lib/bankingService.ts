import {
  collection,
  doc,
  query,
  where,
  getDocs,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getAccountByCode } from './accountingService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export interface TransactionMatch {
  docId: string;
  type: 'invoice' | 'bill' | 'expense';
  amount: number;
  date: string;
  confidence: number;
  reason: string;
}

export const suggestMatches = async (amount: number, _date: string, _description: string) => {
  try {
    const matches: TransactionMatch[] = [];

    const invoicesSnap = await getDocs(
      query(collection(db, 'invoices'), where('status', 'in', ['sent', 'partial', 'overdue']))
    );
    invoicesSnap.forEach((snap) => {
      const data = snap.data();
      if (Math.abs((data.remainingBalance ?? data.total) - amount) < 0.01 || Math.abs(data.total - amount) < 0.01) {
        matches.push({
          docId: snap.id,
          type: 'invoice',
          amount: data.total,
          date: data.createdAt,
          confidence: 0.95,
          reason: `Invoice ${data.invoiceNumber} exact amount match`,
        });
      }
    });

    const billsSnap = await getDocs(query(collection(db, 'supplier_bills'), where('status', '==', 'Unpaid')));
    billsSnap.forEach((snap) => {
      const data = snap.data();
      if (Math.abs(data.total - Math.abs(amount)) < 0.01) {
        matches.push({
          docId: snap.id,
          type: 'bill',
          amount: data.total,
          date: data.date,
          confidence: 0.95,
          reason: `Bill ${data.billNumber} exact amount match`,
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'invoices');
    return [];
  }
};

export const reconcileTransaction = async (bankTxId: string, matchDocId: string, type: 'invoice' | 'bill') => {
  try {
    const cashAccount = await getAccountByCode('1000');
    const targetAccount =
      type === 'invoice' ? await getAccountByCode('1100') : await getAccountByCode('2100');

    if (!cashAccount || !targetAccount) throw new Error('Accounts not found');

    return await runTransaction(db, async (transaction) => {
      const bankTxRef = doc(db, 'bank_transactions', bankTxId);
      const matchRef = doc(db, type === 'invoice' ? 'invoices' : 'supplier_bills', matchDocId);

      const matchSnap = await transaction.get(matchRef);
      const matchData = matchSnap.data();
      if (!matchData) throw new Error('Match document not found');

      const amount = Number(matchData.total || 0);
      const now = new Date().toISOString();

      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: now,
        reference: bankTxId,
        description: `Reconciliation: ${type} ${matchDocId}`,
        sourceType: 'payment',
        status: 'posted',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
        lines: [
          {
            accountId: cashAccount.id,
            accountName: cashAccount.name,
            debit: type === 'invoice' ? amount : 0,
            credit: type === 'invoice' ? 0 : amount,
          },
          {
            accountId: targetAccount.id,
            accountName: targetAccount.name,
            debit: type === 'invoice' ? 0 : amount,
            credit: type === 'invoice' ? amount : 0,
          },
        ],
      });

      if (type === 'invoice') {
        transaction.update(matchRef, {
          status: 'paid',
          paidAmount: amount,
          remainingBalance: 0,
          updatedAt: now,
        });
      } else {
        transaction.update(matchRef, {
          status: 'Paid',
          paidAmount: amount,
          paidAt: now,
        });
      }

      transaction.update(bankTxRef, { reconciled: true, matchedId: matchDocId });
      // Cash increases on invoice collection, decreases on bill payment
      transaction.update(doc(db, 'accounts', cashAccount.id), {
        balance: increment(type === 'invoice' ? amount : -amount),
        updatedAt: now,
      });
      // Both AR (invoice receipt) and AP (bill payment) decrease when settled
      transaction.update(doc(db, 'accounts', targetAccount.id), {
        balance: increment(-amount),
        updatedAt: now,
      });

      return true;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bank_transactions/${bankTxId}`);
    throw error;
  }
};
