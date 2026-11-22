import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getAccountByCode } from './accountingService';
import { createInvoice } from './invoiceService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export type SalesDocType =
  | 'Quotation'
  | 'SalesOrder'
  | 'DeliveryNote'
  | 'CreditNote'
  | 'ProformaInvoice'
  | 'SalesQuote';

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
  try {
    const prefixes: Record<string, string> = {
      Quotation: 'QT',
      SalesQuote: 'SQ',
      SalesOrder: 'SO',
      DeliveryNote: 'DN',
      CreditNote: 'CN',
      ProformaInvoice: 'PI',
    };
    const prefix = prefixes[docData.type] || 'DOC';

    const q = query(collection(db, 'sales_documents'), where('type', '==', docData.type));
    const snap = await getDocs(q);

    const nextNum = snap.size + 1;
    const docNumber = `${prefix}-${nextNum.toString().padStart(5, '0')}`;
    const ref = doc(collection(db, 'sales_documents'));
    const now = new Date().toISOString();

    if (docData.type === 'CreditNote') {
      const arAccount = await getAccountByCode('1100');
      const returnsAccount = await getAccountByCode('4100');

      if (!arAccount || !returnsAccount) throw new Error('Accounting not initialized for Credit Notes');

      await runTransaction(db, async (transaction) => {
        const arRef = doc(db, 'accounts', arAccount.id);
        const retRef = doc(db, 'accounts', returnsAccount.id);
        const arSnap = await transaction.get(arRef);
        const retSnap = await transaction.get(retRef);

        const journalRef = doc(collection(db, 'journal_entries'));
        transaction.set(journalRef, {
          id: journalRef.id,
          date: now,
          reference: docNumber,
          description: `Credit Note for ${docData.customerName}`,
          sourceType: 'credit_note',
          status: 'posted',
          createdBy: auth.currentUser?.uid || 'system',
          createdAt: now,
          lines: [
            { accountId: returnsAccount.id, accountName: returnsAccount.name, debit: docData.total, credit: 0 },
            { accountId: arAccount.id, accountName: arAccount.name, debit: 0, credit: docData.total },
          ],
        });

        transaction.update(arRef, { balance: (arSnap.data()?.balance || 0) - docData.total, updatedAt: now });
        transaction.update(retRef, { balance: (retSnap.data()?.balance || 0) - docData.total, updatedAt: now });

        const newDoc: SalesDocument = {
          ...docData,
          id: ref.id,
          docNumber,
          createdAt: now,
        };

        transaction.set(ref, newDoc);
      });

      return { id: ref.id, docNumber };
    } else {
      const newDoc: SalesDocument = {
        ...docData,
        id: ref.id,
        docNumber,
        createdAt: now,
      };

      await setDoc(ref, newDoc);
      return newDoc;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'sales_documents');
    throw error;
  }
};

export const fulfillOrder = async (orderId: string) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, 'sales_documents', orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists()) throw new Error('Order not found');
      const orderData = orderSnap.data() as SalesDocument;

      if (orderData.status === 'Fulfilled') throw new Error('Order already fulfilled');

      // Read all products first before writes
      const productReads: { ref: ReturnType<typeof doc>; currentStock: number; qty: number }[] = [];
      for (const item of orderData.items || []) {
        if (item.productId) {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists()) {
            productReads.push({
              ref: pRef,
              currentStock: Number(pSnap.data()?.stock || 0),
              qty: Number(item.quantity || 0),
            });
          }
        }
      }

      const now = new Date().toISOString();

      for (const p of productReads) {
        transaction.update(p.ref, {
          stock: Math.max(0, p.currentStock - p.qty),
          updatedAt: now,
        });

        const moveRef = doc(collection(db, 'inventory_movements'));
        transaction.set(moveRef, {
          id: moveRef.id,
          productId: p.ref.id,
          quantity: p.qty,
          type: 'Outbound',
          reason: `Sale Fulfillment: ${orderData.docNumber}`,
          date: now,
          performedBy: auth.currentUser?.uid || 'system',
        });
      }

      transaction.update(orderRef, { status: 'Fulfilled', updatedAt: now });
      return orderData;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sales_documents/${orderId}`);
    throw error;
  }
};

export const convertToSalesOrder = async (quotationId: string) => {
  try {
    const quoteRef = doc(db, 'sales_documents', quotationId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error('Quotation not found');
    const quoteData = quoteSnap.data() as SalesDocument;

    if (quoteData.type !== 'Quotation' && quoteData.type !== 'SalesQuote' && quoteData.type !== 'ProformaInvoice') {
      throw new Error('Document is not a convertable quote or proforma');
    }

    return await createSalesDocument({
      type: 'SalesOrder',
      customerId: quoteData.customerId,
      customerName: quoteData.customerName,
      items: quoteData.items,
      total: quoteData.total,
      status: 'Pending',
      date: new Date().toISOString(),
      linkedOrderId: quotationId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sales_documents/${quotationId}`);
    throw error;
  }
};

export const convertToInvoice = async (orderId: string) => {
  try {
    const orderRef = doc(db, 'sales_documents', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found');
    const orderData = orderSnap.data() as SalesDocument;

    const invoice = await createInvoice({
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      items: orderData.items,
      status: 'sent',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await updateDoc(orderRef, { linkedInvoiceId: invoice.id, updatedAt: new Date().toISOString() });
    return invoice;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sales_documents/${orderId}`);
    throw error;
  }
};
