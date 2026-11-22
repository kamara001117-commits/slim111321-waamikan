import {
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getAccountByCode } from './accountingService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export const approveExpenseClaim = async (claimId: string, amount: number, employeeName: string) => {
  try {
    const expenseAccount = await getAccountByCode('6500');
    const apAccount = await getAccountByCode('2100');

    if (!expenseAccount || !apAccount) throw new Error('Accounting for expenses not initialized');

    return await runTransaction(db, async (transaction) => {
      const claimRef = doc(db, 'expense_claims', claimId);
      const now = new Date().toISOString();
      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: now,
        reference: claimId,
        description: `Expense Claim Approved: ${employeeName}`,
        sourceType: 'expense',
        status: 'posted',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
        lines: [
          { accountId: expenseAccount.id, accountName: expenseAccount.name, debit: amount, credit: 0 },
          { accountId: apAccount.id, accountName: apAccount.name, debit: 0, credit: amount },
        ],
      });

      transaction.update(doc(db, 'accounts', expenseAccount.id), { balance: increment(amount), updatedAt: now });
      transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(amount), updatedAt: now });

      transaction.update(claimRef, {
        status: 'Approved',
        approvedBy: auth.currentUser?.uid || 'system',
        approvedAt: now,
      });

      return journalRef.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `expense_claims/${claimId}`);
    throw error;
  }
};

export const rejectExpenseClaim = async (claimId: string) => {
  try {
    const claimRef = doc(db, 'expense_claims', claimId);
    await updateDoc(claimRef, {
      status: 'Rejected',
      rejectedBy: auth.currentUser?.uid || 'system',
      rejectedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `expense_claims/${claimId}`);
    throw error;
  }
};

export const payExpenseClaim = async (claimId: string, amount: number, bankAccountId: string) => {
  try {
    const apAccount = await getAccountByCode('2100');
    const cashAccount = await getAccountByCode('1000');

    if (!apAccount || !cashAccount) throw new Error('Cash/Payable accounts not found');

    return await runTransaction(db, async (transaction) => {
      const claimRef = doc(db, 'expense_claims', claimId);
      const now = new Date().toISOString();
      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: now,
        reference: claimId,
        description: `Expense Claim Paid`,
        sourceType: 'payment',
        status: 'posted',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
        lines: [
          { accountId: apAccount.id, accountName: apAccount.name, debit: amount, credit: 0 },
          { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: amount },
        ],
      });

      transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(-amount), updatedAt: now });
      transaction.update(doc(db, 'accounts', cashAccount.id), { balance: increment(-amount), updatedAt: now });

      transaction.update(claimRef, {
        status: 'Paid',
        paidAt: now,
        bankAccountId,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `expense_claims/${claimId}`);
    throw error;
  }
};

export const createExpenseClaim = async (claim: any) => {
  try {
    const ref = doc(collection(db, 'expense_claims'));
    await setDoc(ref, {
      ...claim,
      id: ref.id,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'system',
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'expense_claims');
    throw error;
  }
};
