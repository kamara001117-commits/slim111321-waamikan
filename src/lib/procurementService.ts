import {
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { SupplierBill } from '../types/erp';
import { getAccountByCode } from './accountingService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export const recordSupplierBill = async (
  billData: Omit<SupplierBill, 'id' | 'createdAt' | 'paidAmount' | 'status'>
) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const billRef = doc(collection(db, 'supplier_bills'));
      const billId = billRef.id;
      const now = new Date().toISOString();

      const fullBill: SupplierBill = {
        ...billData,
        id: billId,
        paidAmount: 0,
        status: 'Unpaid',
        createdAt: now,
      };

      const apAccount = await getAccountByCode('2100');
      const inventoryAssetAccount = await getAccountByCode('1200');

      if (!apAccount || !inventoryAssetAccount) {
        throw new Error('Accounting system not properly initialized (Accounts Payable or Inventory Asset missing)');
      }

      // Read referenced accounts & products BEFORE writes
      const supplierRef = doc(db, 'suppliers', fullBill.supplierId);
      const supplierSnap = await transaction.get(supplierRef);

      const customAccNames = new Map<string, string>();
      for (const item of fullBill.items) {
        if (item.accountId && !customAccNames.has(item.accountId)) {
          const accSnap = await transaction.get(doc(db, 'accounts', item.accountId));
          if (accSnap.exists()) {
            customAccNames.set(item.accountId, accSnap.data().name);
          }
        }
      }

      const productRefsToUpdate: { ref: ReturnType<typeof doc>; qty: number }[] = [];
      for (const item of fullBill.items) {
        if (item.productId) {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists()) {
            productRefsToUpdate.push({ ref: pRef, qty: Number(item.quantity || 0) });
          }
        }
      }

      const journalLines: any[] = [
        {
          accountId: apAccount.id,
          accountName: apAccount.name,
          debit: 0,
          credit: fullBill.total,
          memo: `Bill ${fullBill.billNumber} from ${fullBill.supplierName}`,
        },
      ];

      for (const item of fullBill.items) {
        const debitAccountId = item.accountId || inventoryAssetAccount.id;
        const accountName = item.accountId ? customAccNames.get(item.accountId) || 'Inventory Asset' : 'Inventory Asset';
        journalLines.push({
          accountId: debitAccountId,
          accountName,
          debit: item.total,
          credit: 0,
          memo: item.description,
        });
      }

      // Perform all writes
      for (const p of productRefsToUpdate) {
        transaction.update(p.ref, {
          stock: increment(p.qty),
          updatedAt: now,
        });
      }

      for (const item of fullBill.items) {
        if (item.productId) {
          const moveRef = doc(collection(db, 'inventory_movements'));
          transaction.set(moveRef, {
            id: moveRef.id,
            productId: item.productId,
            quantity: item.quantity,
            type: 'Inbound',
            reason: `Supplier Bill: ${fullBill.billNumber}`,
            date: now,
            performedBy: auth.currentUser?.uid || 'system',
          });
        }
      }

      if (supplierSnap.exists()) {
        transaction.update(supplierRef, {
          balance: increment(fullBill.total),
        });
      }

      transaction.update(doc(db, 'accounts', apAccount.id), {
        balance: increment(fullBill.total),
        updatedAt: now,
      });

      const debitDeltas = new Map<string, number>();
      journalLines.forEach((line) => {
        if (line.debit > 0) {
          debitDeltas.set(line.accountId, (debitDeltas.get(line.accountId) || 0) + line.debit);
        }
      });
      debitDeltas.forEach((amt, accId) => {
        transaction.update(doc(db, 'accounts', accId), {
          balance: increment(amt),
          updatedAt: now,
        });
      });

      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: fullBill.date,
        reference: billId,
        description: `Vendor Bill ${fullBill.billNumber} - ${fullBill.supplierName}`,
        lines: journalLines,
        status: 'posted',
        sourceType: 'purchase',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
      });

      transaction.set(billRef, fullBill);

      const logRef = doc(collection(db, 'logs'));
      transaction.set(logRef, {
        id: logRef.id,
        userId: auth.currentUser?.uid || 'system',
        userName: auth.currentUser?.displayName || 'System',
        action: `Recorded Supplier Bill ${fullBill.billNumber}`,
        type: 'purchase',
        targetId: billId,
        timestamp: now,
        details: `Total: GHC ${fullBill.total.toLocaleString()}`,
      });

      return billId;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'supplier_bills');
    throw error;
  }
};

export const paySupplierBill = async (billId: string) => {
  try {
    const apAccount = await getAccountByCode('2100');
    const cashAccount = await getAccountByCode('1000');
    if (!apAccount || !cashAccount) {
      throw new Error('Accounting accounts (Accounts Payable / Cash on Hand) not initialized.');
    }

    return await runTransaction(db, async (transaction) => {
      const billRef = doc(db, 'supplier_bills', billId);
      const billSnap = await transaction.get(billRef);
      if (!billSnap.exists()) throw new Error('Supplier bill not found');

      const bill = billSnap.data() as SupplierBill;
      if (bill.status === 'Paid') throw new Error('Bill is already paid');

      const remaining = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
      const supplierRef = doc(db, 'suppliers', bill.supplierId);
      const supplierSnap = await transaction.get(supplierRef);
      const now = new Date().toISOString();

      transaction.update(billRef, {
        paidAmount: bill.total,
        status: 'Paid',
        paidAt: now,
      });

      if (supplierSnap.exists()) {
        transaction.update(supplierRef, {
          balance: increment(-remaining),
        });
      }

      transaction.update(doc(db, 'accounts', apAccount.id), {
        balance: increment(-remaining),
        updatedAt: now,
      });
      transaction.update(doc(db, 'accounts', cashAccount.id), {
        balance: increment(-remaining),
        updatedAt: now,
      });

      const journalRef = doc(collection(db, 'journal_entries'));
      transaction.set(journalRef, {
        id: journalRef.id,
        date: now,
        reference: billId,
        description: `Paid Supplier Bill ${bill.billNumber} (${bill.supplierName})`,
        sourceType: 'payment',
        status: 'posted',
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
        lines: [
          { accountId: apAccount.id, accountName: apAccount.name, debit: remaining, credit: 0 },
          { accountId: cashAccount.id, accountName: cashAccount.name, debit: 0, credit: remaining },
        ],
      });

      const logRef = doc(collection(db, 'logs'));
      transaction.set(logRef, {
        id: logRef.id,
        userId: auth.currentUser?.uid || 'system',
        userName: auth.currentUser?.displayName || auth.currentUser?.email || 'System',
        action: `Paid Supplier Bill ${bill.billNumber}`,
        type: 'purchase',
        targetId: billId,
        timestamp: now,
        details: `Paid: GHC ${remaining.toLocaleString()}`,
      });

      return true;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `supplier_bills/${billId}`);
    throw error;
  }
};

export const createSupplier = async (data: any) => {
  try {
    const ref = doc(collection(db, 'suppliers'));
    await setDoc(ref, {
      ...data,
      id: ref.id,
      balance: 0,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    throw error;
  }
};

export const createPurchaseQuote = async (data: any) => {
  try {
    const ref = doc(collection(db, 'purchase_quotes'));
    const quoteNumber = `PQ-${Math.floor(1000 + Math.random() * 9000)}`;
    await setDoc(ref, {
      ...data,
      id: ref.id,
      quoteNumber,
      status: 'Draft',
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'purchase_quotes');
    throw error;
  }
};

export const createPurchaseOrder = async (data: any) => {
  try {
    const ref = doc(collection(db, 'purchase_orders'));
    const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    await setDoc(ref, {
      ...data,
      id: ref.id,
      poNumber,
      date: now,
      status: 'Ordered',
      createdAt: now,
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'purchase_orders');
    throw error;
  }
};

export const recordGoodsReceipt = async (data: any) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const poRef = data.poId ? doc(db, 'purchase_orders', data.poId) : null;
      const poSnap = poRef ? await transaction.get(poRef) : null;

      const productUpdates: { ref: ReturnType<typeof doc>; qty: number }[] = [];
      for (const item of data.items || []) {
        if (item.productId) {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists()) {
            productUpdates.push({ ref: pRef, qty: Number(item.quantity || 0) });
          }
        }
      }

      const ref = doc(collection(db, 'goods_receipts'));
      const receiptNumber = `GRN-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      if (poRef && poSnap?.exists()) {
        transaction.update(poRef, { status: 'Received' });
      }

      for (const p of productUpdates) {
        transaction.update(p.ref, {
          stock: increment(p.qty),
          updatedAt: now,
        });
      }

      transaction.set(ref, {
        ...data,
        id: ref.id,
        receiptNumber,
        createdAt: now,
      });
      return ref.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'goods_receipts');
    throw error;
  }
};

export const convertQuoteToPO = async (quoteId: string) => {
  try {
    const quoteSnap = await getDoc(doc(db, 'purchase_quotes', quoteId));
    if (!quoteSnap.exists()) throw new Error('Quote not found');

    const quoteData = quoteSnap.data();
    const poId = await createPurchaseOrder({
      supplierId: quoteData.supplierId,
      supplierName: quoteData.supplierName,
      items: quoteData.items || [],
      total: quoteData.total || 0,
    });

    await updateDoc(doc(db, 'purchase_quotes', quoteId), { status: 'Converted' });
    return poId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `purchase_quotes/${quoteId}`);
    throw error;
  }
};

export const createDebitNote = async (data: any) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const supplierRef = doc(db, 'suppliers', data.supplierId);
      const supplierSnap = await transaction.get(supplierRef);

      const ref = doc(collection(db, 'debit_notes'));
      const noteNumber = `DN-${Math.floor(1000 + Math.random() * 9000)}`;

      if (supplierSnap.exists()) {
        transaction.update(supplierRef, {
          balance: increment(-Number(data.amount || 0)),
        });
      }

      transaction.set(ref, {
        ...data,
        id: ref.id,
        noteNumber,
        createdAt: new Date().toISOString(),
      });
      return ref.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'debit_notes');
    throw error;
  }
};
