import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getAccountByCode } from "./accountingService";

export const approveExpenseClaim = async (claimId: string, amount: number, employeeName: string) => {
  const expenseAccount = await getAccountByCode('6500'); // Miscellaneous/General Expense
  const apAccount = await getAccountByCode('2100'); // Accounts Payable
  
  if (!expenseAccount || !apAccount) throw new Error("Accounting for expenses not initialized");

  return await runTransaction(db, async (transaction) => {
    const claimRef = doc(db, 'expense_claims', claimId);
    const journalRef = doc(collection(db, 'journal_entries'));
    transaction.set(journalRef, {
      id: journalRef.id,
      date: new Date().toISOString(),
      reference: claimId,
      description: `Expense Claim Approved: ${employeeName}`,
      sourceType: 'expense',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: expenseAccount.id, accountName: expenseAccount.name, debit: amount, credit: 0 },
        { accountId: apAccount.id, accountName: apAccount.name, debit: 0, credit: amount }
      ]
    });

    // Update balances
    transaction.update(doc(db, 'accounts', expenseAccount.id), { balance: increment(amount) });
    transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(amount) });

    // Update claim status
    transaction.update(claimRef, { 
      status: 'Approved',
      approvedBy: auth.currentUser?.uid,
      approvedAt: new Date().toISOString()
    });

    return journalRef.id;
  });
};

export const payExpenseClaim = async (claimId: string, amount: number, bankAccountId: string) => {
  const apAccount = await getAccountByCode('2100');
  const cashAccount = await getAccountByCode('1000');
  
  if (!apAccount || !cashAccount) throw new Error("Cash/Payable accounts not found");

  return await runTransaction(db, async (transaction) => {
    const claimRef = doc(db, 'expense_claims', claimId);
    const journalRef = doc(collection(db, 'journal_entries'));
    transaction.set(journalRef, {
      id: journalRef.id,
      date: new Date().toISOString(),
      reference: claimId,
      description: `Expense Claim Paid`,
      sourceType: 'payment',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: apAccount.id, accountName: apAccount.name, debit: amount, credit: 0 },
        { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: amount }
      ]
    });

    // Update balances
    transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(-amount) });
    transaction.update(doc(db, 'accounts', cashAccount.id), { balance: increment(-amount) });

    // Update claim status
    transaction.update(claimRef, { 
      status: 'Paid',
      paidAt: new Date().toISOString(),
      bankAccountId
    });
  });
};

export const createExpenseClaim = async (claim: any) => {
  const ref = doc(collection(db, 'expense_claims'));
  await setDoc(ref, {
    ...claim,
    id: ref.id,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.email || 'system'
  });
  return ref.id;
};
