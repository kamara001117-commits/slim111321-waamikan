import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  runTransaction,
  increment,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Invoice, Payment, Receipt, PaymentMethod, Product } from '../types';
import { generateAndUploadReceiptPDF } from './documentService';
import { logActivity } from './activity';
import { withRetry } from './firestoreUtils';

export const recordPayment = async (
  invoiceId: string, 
  amount: number, 
  method: PaymentMethod,
  reference?: string,
  chequeNumber?: string
) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Unauthorized");

  return await withRetry(async () => {
    return await runTransaction(db, async (transaction) => {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await transaction.get(invoiceRef);
    
    if (!invoiceSnap.exists()) throw new Error("Invoice not found");
    const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

    const newPaidAmount = (invoice.paidAmount || 0) + amount;
    const newRemainingBalance = invoice.total - newPaidAmount;
    
    // STATUS Logic
    let newStatus = invoice.status;
    if (newRemainingBalance <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    // 1. Get and Increment Receipt Counter
    const counterRef = doc(db, 'counters', 'receipts');
    const counterSnap = await transaction.get(counterRef);
    let nextNum = 1;
    if (counterSnap.exists()) {
      nextNum = (counterSnap.data().lastNumber || 0) + 1;
    }
    
    const receiptNumber = `WAAM-RCPT-${nextNum.toString().padStart(4, '0')}`;
    transaction.set(counterRef, { lastNumber: nextNum }, { merge: true });

    // 2. Create Payment Record
    const paymentCol = collection(db, 'payments');
    const paymentData = {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount,
      method,
      reference: reference || '',
      chequeNumber: chequeNumber || '',
      date: new Date().toISOString(),
      recordedBy: user.uid,
      recordedByName: user.displayName || user.email,
    };
    const paymentRef = doc(paymentCol);
    transaction.set(paymentRef, paymentData);

    // 2b. Create Receipt Record (for the receipts portal)
    const receiptRef = doc(collection(db, 'receipts'));
    transaction.set(receiptRef, {
      receiptNumber,
      paymentId: paymentRef.id,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount,
      method,
      chequeNumber: chequeNumber || '',
      remainingBalance: newRemainingBalance,
      date: paymentData.date,
      pdfUrl: '' // Will be generated on first view/download
    });

    // 3. Update Invoice
    transaction.update(invoiceRef, {
      paidAmount: newPaidAmount,
      remainingBalance: Math.max(0, newRemainingBalance),
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    // 4. Update Stock ONLY if fully paid for the first time AND wasn't already deducted (web orders deduct at source)
    if (newStatus === 'paid' && invoice.status !== 'paid') {
      // For web orders (already starting at 'sent' or 'draft' but processed), 
      // we need to be careful. However, standard workflow is: Proforma -> Payment -> Stock Out.
      // If the invoice was created via Admin 'draft' or 'proforma/sent', we deduct here.
      // If it's a web order, we may have already deducted.
      // Let's assume ONLY Web Orders (marked with userId or originating from checkout) deduct at source.
      // A better way is to skip this if they already went through Checkout logic.
      if (!invoice.userId) { // If it didn't come from a user checkout
        for (const item of invoice.items) {
          const productRef = doc(db, 'products', item.productId);
          transaction.update(productRef, {
            stock: increment(-item.quantity)
          });
        }
      }
      
      // Update Customer Total Spending (always increment on payment)
      const customerRef = doc(db, 'customers', invoice.customerId);
      transaction.update(customerRef, {
        totalSpent: increment(invoice.total || 0),
        invoiceCount: increment(1)
      });
    }
    
    return { 
      paymentId: paymentRef.id, 
      receiptId: receiptRef.id,
      receiptNumber, 
      amount, 
      invoice, 
      method, 
      chequeNumber: chequeNumber || '',
      newRemainingBalance,
      date: paymentData.date
    };
  }).then(async (result) => {
    // Generate Receipt PDF outside transaction
    const receiptData: Receipt = {
      id: result.receiptId,
      receiptNumber: result.receiptNumber,
      paymentId: result.paymentId,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      customerId: result.invoice.customerId,
      customerName: result.invoice.customerName,
      amount: result.amount,
      method: result.method as PaymentMethod,
      chequeNumber: result.chequeNumber,
      remainingBalance: result.newRemainingBalance,
      date: result.date,
      pdfUrl: ''
    };

    const pdfUrl = await generateAndUploadReceiptPDF(receiptData);
    
    // Update the existing receipt document with the PDF URL
    await updateDoc(doc(db, 'receipts', result.receiptId), { pdfUrl });
    
    await logActivity('payment', `Recorded payment of GH₵ ${result.amount}`, result.invoice.id, `Invoice: ${result.invoice.invoiceNumber}`);
    
    return { ...result, pdfUrl };
    });
  });
};
