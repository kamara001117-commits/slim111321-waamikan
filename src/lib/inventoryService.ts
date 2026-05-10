import { 
  collection, 
  doc, 
  updateDoc, 
  increment, 
  runTransaction,
  setDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getAccountByCode } from "./accountingService";

export const adjustStock = async (productId: string, quantity: number, reason: string) => {
  return await runTransaction(db, async (transaction) => {
    const productRef = doc(db, 'products', productId);
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error("Product not found");
    
    // 1. Update Product Stock
    transaction.update(productRef, {
      stock: increment(quantity)
    });

    // 2. Accounting logic (if deduction, it's an expense or COGS adjustment)
    if (quantity < 0) {
      const inventoryAccount = await getAccountByCode('1200'); // Inventory Asset
      const adjustmentExpenseAccount = await getAccountByCode('5000'); // COGS / Expense
      
      if (inventoryAccount && adjustmentExpenseAccount) {
        // Calculate cost (simplified: using total value of adjustment)
        // In a real ERP, we'd use FIFO/LIFO or Average Cost
        const unitPrice = productSnap.data().price || 0;
        const totalValue = Math.abs(quantity) * unitPrice;
        
        const journalRef = doc(collection(db, 'journal_entries'));
        transaction.set(journalRef, {
          id: journalRef.id,
          date: new Date().toISOString(),
          description: `Inventory Adjustment: ${reason} (${productSnap.data().name})`,
          sourceType: 'adjustment',
          status: 'posted',
          createdBy: auth.currentUser?.uid || 'system',
          createdAt: new Date().toISOString(),
          lines: [
            { accountId: adjustmentExpenseAccount.id, accountName: adjustmentExpenseAccount.name, debit: totalValue, credit: 0 },
            { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: 0, credit: totalValue }
          ]
        });

        // Update Account Balances
        transaction.update(doc(db, 'accounts', inventoryAccount.id), { balance: increment(-totalValue) });
        transaction.update(doc(db, 'accounts', adjustmentExpenseAccount.id), { balance: increment(totalValue) });
      }
    }

    // 3. Log movement
    const moveRef = doc(collection(db, 'inventory_movements'));
    transaction.set(moveRef, {
      id: moveRef.id,
      productId,
      quantity,
      type: quantity > 0 ? 'Inbound' : 'Outbound',
      reason: `Manual Adjustment: ${reason}`,
      date: new Date().toISOString(),
      performedBy: auth.currentUser?.uid || 'system'
    });
  });
};

export const createInventoryLocation = async (data: any) => {
  const ref = doc(collection(db, 'inventory_locations'));
  await setDoc(ref, {
     ...data,
     id: ref.id,
     status: 'active',
     createdAt: new Date().toISOString()
  });
};

export const recordInternalTransfer = async (data: { productId: string, fromLoc: string, toLoc: string, quantity: number }) => {
   return await runTransaction(db, async (transaction) => {
      const moveRef = doc(collection(db, 'inventory_movements'));
      transaction.set(moveRef, {
         id: moveRef.id,
         ...data,
         type: 'Transfer',
         reason: `Internal Transfer from ${data.fromLoc} to ${data.toLoc}`,
         date: new Date().toISOString(),
         performedBy: auth.currentUser?.email || 'system'
      });
   });
};
