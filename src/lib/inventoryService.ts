import {
  collection,
  doc,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getAccountByCode } from './accountingService';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export const adjustStock = async (productId: string, quantity: number, reason: string) => {
  try {
    const inventoryAccount = quantity < 0 ? await getAccountByCode('1200') : null;
    const adjustmentExpenseAccount = quantity < 0 ? await getAccountByCode('5000') : null;

    return await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('Product not found');

      const invSnap = inventoryAccount ? await transaction.get(doc(db, 'accounts', inventoryAccount.id)) : null;
      const expSnap = adjustmentExpenseAccount ? await transaction.get(doc(db, 'accounts', adjustmentExpenseAccount.id)) : null;

      const currentStock = Number(productSnap.data().stock || 0);
      const newStock = Math.max(0, currentStock + quantity);
      const now = new Date().toISOString();

      transaction.update(productRef, {
        stock: newStock,
        updatedAt: now,
      });

      if (quantity < 0 && inventoryAccount && adjustmentExpenseAccount) {
        const unitPrice = Number(productSnap.data().price || 0);
        const totalValue = Math.abs(quantity) * unitPrice;

        const journalRef = doc(collection(db, 'journal_entries'));
        transaction.set(journalRef, {
          id: journalRef.id,
          date: now,
          description: `Inventory Adjustment: ${reason} (${productSnap.data().name})`,
          sourceType: 'adjustment',
          status: 'posted',
          createdBy: auth.currentUser?.uid || 'system',
          createdAt: now,
          lines: [
            { accountId: adjustmentExpenseAccount.id, accountName: adjustmentExpenseAccount.name, debit: totalValue, credit: 0 },
            { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: 0, credit: totalValue },
          ],
        });

        transaction.update(doc(db, 'accounts', inventoryAccount.id), {
          balance: (invSnap?.data()?.balance || 0) - totalValue,
          updatedAt: now,
        });
        transaction.update(doc(db, 'accounts', adjustmentExpenseAccount.id), {
          balance: (expSnap?.data()?.balance || 0) + totalValue,
          updatedAt: now,
        });
      }

      const moveRef = doc(collection(db, 'inventory_movements'));
      transaction.set(moveRef, {
        id: moveRef.id,
        productId,
        quantity,
        type: quantity > 0 ? 'Inbound' : 'Outbound',
        reason: `Manual Adjustment: ${reason}`,
        date: now,
        performedBy: auth.currentUser?.uid || 'system',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    throw error;
  }
};

export const createInventoryLocation = async (data: any) => {
  try {
    const ref = doc(collection(db, 'inventory_locations'));
    await setDoc(ref, {
      ...data,
      id: ref.id,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'inventory_locations');
    throw error;
  }
};

export const recordInternalTransfer = async (data: {
  productId: string;
  fromLoc: string;
  toLoc: string;
  quantity: number;
}) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const moveRef = doc(collection(db, 'inventory_movements'));
      transaction.set(moveRef, {
        id: moveRef.id,
        ...data,
        type: 'Transfer',
        reason: `Internal Transfer from ${data.fromLoc} to ${data.toLoc}`,
        date: new Date().toISOString(),
        performedBy: auth.currentUser?.email || 'system',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'inventory_movements');
    throw error;
  }
};
