export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: 'Consumables' | 'Imaging' | 'Equipment' | 'Furniture' | 'Life Support';
  description: string;
  price: number;
  stock: number;
  sku: string;
  image?: string;
  specs?: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  type: 'public' | 'private';
  totalSpent: number;
  invoiceCount: number;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  userId?: string;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  total: number;
  paidAmount: number;
  remainingBalance: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  pdfUrl?: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Cheque';

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  chequeNumber?: string;
  date: string;
  recordedBy: string;
  recordedByName: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  chequeNumber?: string;
  remainingBalance: number;
  date: string;
  pdfUrl: string;
}

export interface CRMRequest {
  id: string;
  name: string;
  email: string;
  hospital: string;
  message: string;
  status: 'new' | 'in_progress' | 'responded' | 'closed';
  createdAt: string;
  updatedAt: string;
  notes?: RequestNote[];
  assignedTo?: string;
}

export interface RequestNote {
  id: string;
  content: string;
  adminName: string;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  type: 'invoice' | 'payment' | 'product' | 'user' | 'crm';
  targetId: string;
  timestamp: string;
  details: string;
}
