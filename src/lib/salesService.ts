import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  increment, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  addDoc,
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Invoice, Product } from "../types";
import { recordInvoiceAccounting, getAccountByCode } from "./accountingService";
import { generateAndUploadInvoicePDF } from "./documentService";
import { logActivity } from "./activity";

import { createInvoice } from "./invoiceService";

export type SalesDocType = 'Quotation' | 'SalesOrder' | 'DeliveryNote' | 'CreditNote';

export interface SalesDocument {
  id: string;
  docNumber: string;
  type: SalesDocType;
  customerId: string;
  customerName: string;
  items: any[];
  total: number;
  status: string;
  date: string;
  validUntil?: string;
  linkedInvoiceId?: string;
  linkedOrderId?: string;
  createdAt: string;
}

export const createSalesDocument = async (docData: Omit<SalesDocument, 'id' | 'docNumber' | 'createdAt'>) => {
  const prefix = docData.type === 'Quotation' ? 'QT' : docData.type === 'SalesOrder' ? 'SO' : docData.type === 'DeliveryNote' ? 'DN' : 'CN';
  
  // Use a simpler query that doesn't requires a composite index
  const q = query(collection(db, 'sales_documents'), where('type', '==', docData.type));
  const snap = await getDocs(q);
  
  const nextNum = snap.size + 1;
  const docNumber = `${prefix}-${nextNum.toString().padStart(5, '0')}`;
  const ref = doc(collection(db, 'sales_documents'));

  if (docData.type === 'CreditNote') {
    const arAccount = await getAccountByCode('1100'); // Accounts Receivable
    const returnsAccount = await getAccountByCode('4100'); // Sales Returns
    
    if (!arAccount || !returnsAccount) throw new Error("Accounting not initialized for Credit Notes");

    await runTransaction(db, async (transaction) => {
      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: new Date().toISOString(),
        reference: docNumber,
        description: `Credit Note for ${docData.customerName}`,
        createdAt: new Date().toISOString(),
        lines: [
          { accountId: returnsAccount.id, accountName: returnsAccount.name, debit: docData.total, credit: 0 },
          { accountId: arAccount.id, accountName: arAccount.name, debit: 0, credit: docData.total }
        ]
      });

      transaction.update(doc(db, 'accounts', arAccount.id), { balance: increment(-docData.total) });
      transaction.update(doc(db, 'accounts', returnsAccount.id), { balance: increment(docData.total) });

      const newDoc: SalesDocument = {
        ...docData,
        id: ref.id,
        docNumber,
        createdAt: new Date().toISOString()
      };
      
      transaction.set(ref, newDoc);
    });
    
    return { id: ref.id, docNumber }; // Return minimal info as it's within transaction
  } else {
    const newDoc: SalesDocument = {
      ...docData,
      id: ref.id,
      docNumber,
      createdAt: new Date().toISOString()
    };
    
    await setDoc(ref, newDoc);
    return newDoc;
  }
};

/**
 * The "Operational Master Switch": Converts a Sales Order to an Invoice and updates Inventory
 */
export const fulfillOrder = async (orderId: string) => {
  return await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'sales_documents', orderId);
    const orderSnap = await transaction.get(orderRef);
    
    if (!orderSnap.exists()) throw new Error("Order not found");
    const orderData = orderSnap.data() as SalesDocument;
    
    if (orderData.status === 'Fulfilled') throw new Error("Order already fulfilled");

    // 1. Update Inventory for each item
    for (const item of orderData.items) {
      if (item.productId) {
        const productRef = doc(db, 'products', item.productId);
        transaction.update(productRef, {
          stock: increment(-item.quantity)
        });
        
        // Log movement
        const moveRef = doc(collection(db, 'inventory_movements'));
        transaction.set(moveRef, {
          id: moveRef.id,
          productId: item.productId,
          quantity: item.quantity,
          type: 'Outbound',
          reason: `Sale Fulfillment: ${orderData.docNumber}`,
          date: new Date().toISOString(),
          performedBy: auth.currentUser?.uid || 'system'
        });
      }
    }

    // 2. Mark order as fulfilled
    transaction.update(orderRef, { status: 'Fulfilled' });

    return orderData;
  });
};

/**
 * Converts a Quotation to a Sales Order
 */
export const convertToSalesOrder = async (quotationId: string) => {
  const quoteRef = doc(db, 'sales_documents', quotationId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error("Quotation not found");
  const quoteData = quoteSnap.data() as SalesDocument;
  
  if (quoteData.type !== 'Quotation') throw new Error("Document is not a quotation");

  return await createSalesDocument({
    type: 'SalesOrder',
    customerId: quoteData.customerId,
    customerName: quoteData.customerName,
    items: quoteData.items,
    total: quoteData.total,
    status: 'Pending',
    date: new Date().toISOString(),
    linkedOrderId: quotationId
  });
};

/**
 * Generates an Invoice from a Sales Order
 */
export const convertToInvoice = async (orderId: string) => {
  const orderRef = doc(db, 'sales_documents', orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error("Order not found");
  const orderData = orderSnap.data() as SalesDocument;

  const invoice = await createInvoice({
    customerId: orderData.customerId,
    customerName: orderData.customerName,
    items: orderData.items,
    status: 'sent',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await updateDoc(orderRef, { linkedInvoiceId: invoice.id });
  return invoice;
};
