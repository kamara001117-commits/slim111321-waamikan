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
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Invoice, Receipt, PaymentMethod, WebOrder, Customer } from '../types';
export type { WebOrder };
import { generateAndUploadReceiptPDF, generateAndUploadInvoicePDF } from './documentService';
import { logActivity } from './activity';
import { withRetry, handleFirestoreError, OperationType } from './firestoreUtils';
import { recordInvoiceAccounting, recordPaymentAccounting } from './accountingService';

export const createInvoice = async (
  invoiceData: Omit<
    Invoice,
    'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'total' | 'subtotal' | 'vat' | 'remainingBalance' | 'paidAmount'
  > & { vat?: number; webOrderId?: string },
  isWebOrder: boolean = false
) => {
  if (!auth.currentUser) throw new Error('Unauthorized');

  const subtotal = invoiceData.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const vat = Number(invoiceData.vat || 0);
  const total = subtotal + vat;

  try {
    // 1. Get next invoice number
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    let nextNum = 1;
    if (!snap.empty) {
      const lastNum = String(snap.docs[0].data().invoiceNumber || '');
      const match = lastNum.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const prefix = isWebOrder ? 'WAAM-WEB' : 'WAAM-INV';
    const invoiceNumber = `${prefix}-${nextNum.toString().padStart(4, '0')}`;
    const now = new Date().toISOString();

    const payload: Omit<Invoice, 'id'> & { webOrderId?: string } = {
      ...invoiceData,
      invoiceNumber,
      subtotal,
      vat,
      total,
      paidAmount: 0,
      remainingBalance: total,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, 'invoices'), payload);
    const finalInvoice = { id: docRef.id, ...payload } as Invoice;

    // 2. Accounting logic
    try {
      await recordInvoiceAccounting(docRef.id, total);
    } catch (accErr) {
      console.warn('Invoice accounting entry skipped:', accErr);
    }

    // 3. Update Inventory for web orders (safely clamped >= 0)
    if (isWebOrder) {
      for (const item of invoiceData.items) {
        if (!item.productId) continue;
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = Number(productSnap.data()?.stock || 0);
          await updateDoc(productRef, {
            stock: Math.max(0, currentStock - Number(item.quantity || 0)),
            updatedAt: now,
          });
        }
      }
    }

    // 4. Generate PDF (non-fatal if Storage upload fails)
    const pdfUrl = await generateAndUploadInvoicePDF(finalInvoice);
    if (pdfUrl) {
      await updateDoc(doc(db, 'invoices', docRef.id), { pdfUrl, updatedAt: new Date().toISOString() });
      finalInvoice.pdfUrl = pdfUrl;
    }

    await logActivity(
      'invoice',
      `Created ${isWebOrder ? 'web order invoice' : 'invoice'} ${invoiceNumber}`,
      docRef.id,
      `Total: GHC ${total}`
    );

    return finalInvoice;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'invoices');
    throw error;
  }
};

export const convertWebOrderToInvoice = async (webOrder: WebOrder) => {
  if (!auth.currentUser) throw new Error('Unauthorized');

  try {
    // 1. Find or create Customer by email
    const emailLower = webOrder.email.trim().toLowerCase();
    const custSnap = await getDocs(query(collection(db, 'customers'), where('email', '==', emailLower)));
    let customerId = '';

    if (!custSnap.empty) {
      customerId = custSnap.docs[0].id;
    } else {
      const custFallback = await getDocs(query(collection(db, 'customers'), where('email', '==', webOrder.email)));
      if (!custFallback.empty) {
        customerId = custFallback.docs[0].id;
      } else {
        const now = new Date().toISOString();
        const newCustomer: Omit<Customer, 'id'> = {
          name: webOrder.customerName,
          contactPerson: webOrder.contactName,
          email: emailLower,
          phone: webOrder.phone,
          address: webOrder.address,
          type: 'private',
          totalSpent: 0,
          invoiceCount: 0,
          createdAt: now,
        };
        const createdCust = await addDoc(collection(db, 'customers'), newCustomer);
        customerId = createdCust.id;
      }
    }

    // 2. Create official invoice (isWebOrder = true deducts stock safely)
    const invoice = await createInvoice(
      {
        customerId,
        customerName: webOrder.customerName,
        userId: webOrder.userId || null,
        items: webOrder.items,
        vat: webOrder.vat || 0,
        status: 'sent',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        webOrderId: webOrder.id,
      },
      true
    );

    // 3. Increment customer invoiceCount & mark web_order as invoiced
    await updateDoc(doc(db, 'customers', customerId), {
      invoiceCount: increment(1),
      updatedAt: new Date().toISOString(),
    });

    await updateDoc(doc(db, 'web_orders', webOrder.id), {
      status: 'invoiced',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      updatedAt: new Date().toISOString(),
    });

    await logActivity('order', `Converted web order ${webOrder.orderNumber} to invoice ${invoice.invoiceNumber}`, webOrder.id, `Customer: ${webOrder.customerName}`);
    return invoice;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'web_orders');
    throw error;
  }
};

export const recordPayment = async (
  invoiceId: string,
  amount: number,
  method: PaymentMethod,
  reference?: string,
  chequeNumber?: string
) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');

  try {
    const result = await withRetry(async () => {
      return await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const invoiceSnap = await transaction.get(invoiceRef);

        if (!invoiceSnap.exists()) throw new Error('Invoice not found');
        const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

        const newPaidAmount = (invoice.paidAmount || 0) + amount;
        const newRemainingBalance = invoice.total - newPaidAmount;

        let newStatus = invoice.status;
        if (newRemainingBalance <= 0) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partial';
        }

        const counterRef = doc(db, 'counters', 'receipts');
        const counterSnap = await transaction.get(counterRef);

        const shouldDeductStockAndCustomer = newStatus === 'paid' && invoice.status !== 'paid';
        const customerRef = doc(db, 'customers', invoice.customerId);
        const customerSnap = shouldDeductStockAndCustomer ? await transaction.get(customerRef) : null;

        const productSnaps: { ref: ReturnType<typeof doc>; currentStock: number; qty: number }[] = [];
        if (shouldDeductStockAndCustomer && !invoice.userId) {
          for (const item of invoice.items) {
            if (!item.productId) continue;
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await transaction.get(pRef);
            if (pSnap.exists()) {
              productSnaps.push({
                ref: pRef,
                currentStock: Number(pSnap.data()?.stock || 0),
                qty: Number(item.quantity || 0),
              });
            }
          }
        }

        // --- ALL WRITES AFTER READS ---
        let nextNum = 1;
        if (counterSnap.exists()) {
          nextNum = (counterSnap.data().lastNumber || 0) + 1;
        }
        const receiptNumber = `WAAM-RCPT-${nextNum.toString().padStart(4, '0')}`;
        transaction.set(counterRef, { lastNumber: nextNum }, { merge: true });

        const now = new Date().toISOString();
        const paymentRef = doc(collection(db, 'payments'));
        const paymentData = {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          method,
          reference: reference || '',
          chequeNumber: chequeNumber || '',
          date: now,
          recordedBy: user.uid,
          recordedByName: user.displayName || user.email || 'Staff',
        };
        transaction.set(paymentRef, paymentData);

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
          remainingBalance: Math.max(0, newRemainingBalance),
          date: now,
          pdfUrl: '',
        });

        transaction.update(invoiceRef, {
          paidAmount: newPaidAmount,
          remainingBalance: Math.max(0, newRemainingBalance),
          status: newStatus,
          updatedAt: now,
        });

        if (shouldDeductStockAndCustomer) {
          for (const p of productSnaps) {
            transaction.update(p.ref, {
              stock: Math.max(0, p.currentStock - p.qty),
              updatedAt: now,
            });
          }

          if (customerSnap?.exists()) {
            transaction.update(customerRef, {
              totalSpent: increment(invoice.total || 0),
              invoiceCount: increment(1),
              updatedAt: now,
            });
          }
        }

        return {
          paymentId: paymentRef.id,
          receiptId: receiptRef.id,
          receiptNumber,
          amount,
          invoice,
          method,
          chequeNumber: chequeNumber || '',
          newRemainingBalance: Math.max(0, newRemainingBalance),
          date: now,
        };
      });
    });

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
      pdfUrl: '',
    };

    const pdfUrl = await generateAndUploadReceiptPDF(receiptData);
    if (pdfUrl) {
      await updateDoc(doc(db, 'receipts', result.receiptId), { pdfUrl });
    }

    await logActivity('payment', `Recorded payment of GHC ${result.amount}`, result.invoice.id, `Invoice: ${result.invoice.invoiceNumber}`);

    try {
      await recordPaymentAccounting(result.paymentId, result.invoice.id, result.amount, result.method);
    } catch (accErr) {
      console.warn('Payment accounting entry skipped:', accErr);
    }

    return { ...result, pdfUrl };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments');
    throw error;
  }
};
