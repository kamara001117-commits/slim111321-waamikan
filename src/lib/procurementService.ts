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
  addDoc,
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Supplier, PurchaseOrder, SupplierBill } from "../types/erp";
import { getAccountByCode, recordJournalEntry } from "./accountingService";

const SUPPLIERS_COLLECTION = 'suppliers';
const PO_COLLECTION = 'purchase_orders';
const QUOTES_COLLECTION = 'purchase_quotes';
const RECEIPTS_COLLECTION = 'goods_receipts';
const DEBIT_NOTES_COLLECTION = 'debit_notes';
const BILLS_COLLECTION = 'supplier_bills';

export const createSupplier = async (supplier: Omit<Supplier, 'id' | 'balance' | 'createdAt'>) => {
  const ref = doc(collection(db, SUPPLIERS_COLLECTION));
  const newSupplier: Supplier = {
    ...supplier,
    id: ref.id,
    balance: 0,
    createdAt: new Date().toISOString()
  };
  await setDoc(ref, newSupplier);
  return ref.id;
};

export const createPurchaseQuote = async (quote: any) => {
  const countSnapshot = await getDocs(collection(db, QUOTES_COLLECTION));
  const quoteNumber = `PQ-${(countSnapshot.size + 1).toString().padStart(5, '0')}`;
  
  const ref = doc(collection(db, QUOTES_COLLECTION));
  const newQuote = {
    ...quote,
    id: ref.id,
    quoteNumber,
    createdAt: new Date().toISOString()
  };
  await setDoc(ref, newQuote);
  return ref.id;
};

export const createPurchaseOrder = async (po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'status'>) => {
  const countSnapshot = await getDocs(collection(db, PO_COLLECTION));
  const poNumber = `PO-${(countSnapshot.size + 1).toString().padStart(5, '0')}`;
  
  const ref = doc(collection(db, PO_COLLECTION));
  const newPO: PurchaseOrder = {
    ...po,
    id: ref.id,
    poNumber,
    status: 'Draft'
  };
  await setDoc(ref, newPO);
  return ref.id;
};

/**
 * Goods Receipt: Records physical arrival and updates inventory
 */
export const recordGoodsReceipt = async (receipt: any) => {
  const countSnapshot = await getDocs(collection(db, RECEIPTS_COLLECTION));
  const receiptNumber = `GR-${(countSnapshot.size + 1).toString().padStart(5, '0')}`;

  return await runTransaction(db, async (transaction) => {
    const receiptRef = doc(collection(db, RECEIPTS_COLLECTION));

    const newReceipt = {
      ...receipt,
      id: receiptRef.id,
      receiptNumber,
      createdAt: new Date().toISOString()
    };

    // Update Inventory for each item
    for (const item of receipt.items) {
      if (item.productId) {
        const productRef = doc(db, 'products', item.productId);
        transaction.update(productRef, {
          stock: increment(item.quantity)
        });

        // Log movement
        const moveRef = doc(collection(db, 'inventory_movements'));
        transaction.set(moveRef, {
          id: moveRef.id,
          productId: item.productId,
          quantity: item.quantity,
          type: 'Inbound',
          reason: `Goods Receipt: ${receiptNumber}`,
          date: new Date().toISOString(),
          performedBy: auth.currentUser?.uid || 'system'
        });
      }
    }

    // Link to PO if applicable
    if (receipt.poId) {
      const poRef = doc(db, PO_COLLECTION, receipt.poId);
      transaction.update(poRef, { status: 'Received' });
    }

    transaction.set(receiptRef, newReceipt);
    return receiptRef.id;
  });
};

/**
 * Debit Note: Supplier adjustment / Return
 */
export const createDebitNote = async (note: any) => {
  const countSnapshot = await getDocs(collection(db, DEBIT_NOTES_COLLECTION));
  const noteNumber = `DN-${(countSnapshot.size + 1).toString().padStart(5, '0')}`;

  return await runTransaction(db, async (transaction) => {
    const noteRef = doc(collection(db, DEBIT_NOTES_COLLECTION));

    const newNote = {
      ...note,
      id: noteRef.id,
      noteNumber,
      createdAt: new Date().toISOString()
    };

    // 1. Accounting: Decrease Accounts Payable
    const apAccount = await getAccountByCode('2100');
    const returnAccount = await getAccountByCode('5100');
    if (!apAccount || !returnAccount) throw new Error("Accounting not initialized");

    const journalRef = doc(collection(db, 'journal_entries'));
    transaction.set(journalRef, {
      id: journalRef.id,
      date: new Date().toISOString(),
      reference: noteRef.id,
      description: `Debit Note: ${noteNumber}`,
      sourceType: 'purchase',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: apAccount.id, accountName: apAccount.name, debit: note.amount, credit: 0 },
        { accountId: returnAccount.id, accountName: returnAccount.name, debit: 0, credit: note.amount }
      ]
    });

    transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(-note.amount) });
    transaction.update(doc(db, 'accounts', returnAccount.id), { balance: increment(-note.amount) });
    
    // 2. Update Supplier Balance
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, note.supplierId);
    transaction.update(supplierRef, { balance: increment(-note.amount) });

    transaction.set(noteRef, newNote);
    return noteRef.id;
  });
};

export const convertQuoteToPO = async (quoteId: string) => {
  return await runTransaction(db, async (transaction) => {
    const quoteRef = doc(db, QUOTES_COLLECTION, quoteId);
    const quoteSnap = await transaction.get(quoteRef);
    const quoteData = quoteSnap.data();
    if (!quoteData) throw new Error("Quote not found");

    const poId = await createPurchaseOrder({
      supplierId: quoteData.supplierId,
      supplierName: quoteData.supplierName,
      items: quoteData.items,
      subtotal: quoteData.subtotal || quoteData.total,
      tax: quoteData.tax || 0,
      total: quoteData.total,
      date: new Date().toISOString(),
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    transaction.update(quoteRef, { status: 'Converted', poId });
    return poId;
  });
};

export const recordSupplierBill = async (bill: Omit<SupplierBill, 'id' | 'paidAmount' | 'status'> & { updateStock?: boolean }) => {
  return await runTransaction(db, async (transaction) => {
    const billRef = doc(collection(db, BILLS_COLLECTION));
    const newBill: SupplierBill = {
      ...bill,
      id: billRef.id,
      paidAmount: 0,
      status: 'Unpaid'
    };

    // 1. Accounting: Update Accounts Payable
    const apAccount = await getAccountByCode('2100'); // Accounts Payable
    const inventoryAccount = await getAccountByCode('1200'); // Inventory Asset
    
    if (!apAccount || !inventoryAccount) throw new Error("Accounting not initialized");

    // Journal Entry for purchase
    const journalRef = doc(collection(db, 'journal_entries'));
    transaction.set(journalRef, {
      id: journalRef.id,
      date: bill.date,
      reference: billRef.id,
      description: `Supplier Bill Received: ${bill.billNumber}`,
      sourceType: 'purchase',
      status: 'posted',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: new Date().toISOString(),
      lines: [
        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: bill.total, credit: 0 },
        { accountId: apAccount.id, accountName: apAccount.name, debit: 0, credit: bill.total }
      ]
    });

    // 2. Update Inventory stock (only if requested, e.g. if no GRN was recorded)
    if (bill.updateStock && bill.items) {
      for (const item of (bill as any).items) {
        if (item.productId) {
          const productRef = doc(db, 'products', item.productId);
          transaction.update(productRef, { stock: increment(item.quantity) });
        }
      }
    }

    // 3. Update account balances
    transaction.update(doc(db, 'accounts', apAccount.id), { balance: increment(bill.total) });
    transaction.update(doc(db, 'accounts', inventoryAccount.id), { balance: increment(bill.total) });

    // 4. Update Supplier Balance
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, bill.supplierId);
    transaction.update(supplierRef, { balance: increment(bill.total) });

    transaction.set(billRef, newBill);
    return billRef.id;
  });
};
