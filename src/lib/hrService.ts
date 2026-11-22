import {
  collection,
  doc,
  setDoc,
  getDocs,
  increment,
  runTransaction,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getAccountByCode } from './accountingService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export const generateMonthlyPayroll = async (month: string) => {
  try {
    const q = query(collection(db, 'payroll'), where('month', '==', month));
    const exists = await getDocs(q);
    if (!exists.empty) {
      throw new Error(`Payroll for ${month} has already been generated.`);
    }

    const employeesSnap = await getDocs(collection(db, 'employees'));
    const employees = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (employees.length === 0) {
      throw new Error('No employees found to process payroll.');
    }

    for (const emp of employees) {
      const data = {
        employeeId: emp.id,
        employeeName: `${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.trim(),
        month,
        baseSalary: Number((emp as any).salary || 0),
        allowances: 0,
        deductions: 0,
        netPay: Number((emp as any).salary || 0),
        status: 'paid',
      };

      const { journalEntryId } = await generatePayslip(data);

      const payrollRef = doc(collection(db, 'payroll'));
      await setDoc(payrollRef, {
        ...data,
        id: payrollRef.id,
        journalEntryId,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already been generated') || error.message.includes('No employees found'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, 'payroll');
    throw error;
  }
};

export const generatePayslip = async (data: any) => {
  try {
    const salaryExpenseAccount = await getAccountByCode('6000');
    const cashAccount = await getAccountByCode('1000');

    if (!salaryExpenseAccount || !cashAccount) {
      throw new Error('Accounting for payroll not initialized. Please ensure accounts 6000 and 1000 exist.');
    }

    return await runTransaction(db, async (transaction) => {
      const payslipRef = doc(collection(db, 'payslips'));
      const journalRef = doc(collection(db, 'journal_entries'));
      const entryId = journalRef.id;
      const now = new Date().toISOString();

      transaction.set(journalRef, {
        id: entryId,
        date: now,
        reference: payslipRef.id,
        description: `Monthly Payroll: ${data.employeeName} - ${data.month}`,
        sourceType: 'payroll',
        status: 'posted',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
        lines: [
          { accountId: salaryExpenseAccount.id, accountName: salaryExpenseAccount.name, debit: data.netPay, credit: 0 },
          { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: data.netPay },
        ],
      });

      transaction.update(doc(db, 'accounts', salaryExpenseAccount.id), { balance: increment(data.netPay), updatedAt: now });
      transaction.update(doc(db, 'accounts', cashAccount.id), { balance: increment(-data.netPay), updatedAt: now });

      transaction.set(payslipRef, {
        ...data,
        id: payslipRef.id,
        journalEntryId: entryId,
        createdAt: now,
      });

      return { payslipId: payslipRef.id, journalEntryId: entryId };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'payslips');
    throw error;
  }
};
