import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  increment, 
  runTransaction,
  query,
  where
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getAccountByCode } from "./accountingService";

export const generateMonthlyPayroll = async (month: string) => {
  // Check if payroll already exists for this month
  const q = query(collection(db, 'payroll'), where('month', '==', month));
  const exists = await getDocs(q);
  if (!exists.empty) {
     throw new Error(`Payroll for ${month} has already been generated.`);
  }

  const employeesSnap = await getDocs(collection(db, 'employees'));
  const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const emp of employees) {
    const data = {
      employeeId: emp.id,
      employeeName: `${(emp as any).firstName} ${(emp as any).lastName}`,
      month: month,
      baseSalary: (emp as any).salary || 0,
      allowances: 0,
      deductions: 0,
      netPay: (emp as any).salary || 0,
      status: 'paid'
    };

    await generatePayslip(data);
    
    // Also save to global payroll collection for tracking
    const payrollRef = doc(collection(db, 'payroll'));
    await setDoc(payrollRef, {
       ...data,
       id: payrollRef.id,
       createdAt: new Date().toISOString()
    });
  }
};

export const generatePayslip = async (data: any) => {
  // 1. Accounting: look up accounts before the transaction
  const salaryExpenseAccount = await getAccountByCode('6000'); // Salary Expense
  const cashAccount = await getAccountByCode('1000'); // Main Cash/Bank
  
  if (!salaryExpenseAccount || !cashAccount) throw new Error("Accounting for payroll not initialized. Please ensure accounts 6000 and 1000 exist.");

  return await runTransaction(db, async (transaction) => {
    const payslipRef = doc(collection(db, 'payslips'));
    const journalRef = doc(collection(db, 'journal_entries'));
    const entryId = journalRef.id;

    transaction.set(journalRef, {
      id: entryId,
      date: new Date().toISOString(),
      reference: payslipRef.id,
      description: `Monthly Payroll: ${data.employeeName} - ${data.month}`,
      sourceType: 'payroll',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: salaryExpenseAccount.id, accountName: salaryExpenseAccount.name, debit: data.netPay, credit: 0 },
        { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: data.netPay }
      ]
    });

    // Update account balances
    transaction.update(doc(db, 'accounts', salaryExpenseAccount.id), { balance: increment(data.netPay) });
    transaction.update(doc(db, 'accounts', cashAccount.id), { balance: increment(-data.netPay) });

    // Save payslip
    transaction.set(payslipRef, {
      ...data,
      id: payslipRef.id,
      journalEntryId: entryId,
      createdAt: new Date().toISOString()
    });

    return payslipRef.id;
  });
};
