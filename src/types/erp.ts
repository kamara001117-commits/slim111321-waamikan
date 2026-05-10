import { PaymentMethod } from "./index";

// --- Accounting System ---

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  balance: number;
  isSystem?: boolean; // Accounts like "Accounts Receivable" created by system
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string; // Document ID (Invoice ID, Payment ID, etc.)
  description: string;
  lines: JournalLine[];
  status: 'draft' | 'posted';
  sourceType: 'invoice' | 'payment' | 'purchase' | 'manual' | 'payroll' | 'adjustment';
  createdBy: string;
  createdAt: string;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

// --- Banking & Cash Management ---

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  type: 'Bank' | 'Cash';
  currency: string;
  balance: number;
  status: 'active' | 'inactive';
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  payee?: string;
  reference?: string;
  description: string;
  reconciled: boolean;
  journalEntryId?: string;
}

// --- Accounts Payable & Purchasing ---

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  taxId?: string;
  balance: number; // Amount we owe them
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  expectedDate?: string;
  items: POItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'Draft' | 'Ordered' | 'Received' | 'Closed' | 'Cancelled';
  notes?: string;
}

export interface POItem {
  productId: string;
  name: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  total: number;
}

export interface SupplierBill {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  poId?: string;
  date: string;
  dueDate: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  createdAt: string;
}

export interface BillItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  accountId: string; // Account to debit (e.g., Inventory Asset or Expense account)
}

// --- Inventory & Warehouse ---

export interface InventoryLocation {
  id: string;
  name: string;
  code: string;
  address?: string;
  type: 'Warehouse' | 'Store' | 'Pharmacy';
}

export interface InventoryStock {
  productId: string;
  locationId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  type: 'Transfer' | 'Write-off' | 'Inbound' | 'Outbound';
  reason?: string;
  date: string;
  performedBy: string;
}

// --- HR & Staff ---

export interface Employee {
  id: string;
  uid?: string; // Link to AppUser if they have access
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  joiningDate: string;
  salary: number;
  status: 'active' | 'on_leave' | 'terminated';
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
}

export interface Payroll {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // YYYY-MM
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'draft' | 'paid';
  paymentDate?: string;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  receiptUrl?: string;
}
