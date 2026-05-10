import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { SupplierBill, BillItem } from "../types/erp";
import { getAccountByCode } from "./accountingService";
import { handleFirestoreError, OperationType } from "./firestoreUtils";

export const recordSupplierBill = async (billData: Omit<SupplierBill, 'id' | 'createdAt' | 'paidAmount' | 'status'>) => {
  return await runTransaction(db, async (transaction) => {
    // 1. Prepare Bill Data
    const billRef = doc(collection(db, 'supplier_bills'));
    const billId = billRef.id;
    const now = new Date().toISOString();
    
    const fullBill: SupplierBill = {
      ...billData,
      id: billId,
      paidAmount: 0,
      status: 'Unpaid',
      createdAt: now
    };

    // 2. Find necessary accounts
    const apAccount = await getAccountByCode('2100'); // Accounts Payable
    const inventoryAssetAccount = await getAccountByCode('1200'); // Inventory Asset
    
    if (!apAccount || !inventoryAssetAccount) {
        throw new Error("Accounting system not properly initialized (Accounts Payable or Inventory Asset missing)");
    }

    // 3. Update Inventory Stock and prepare Journal Lines
    const journalLines: any[] = [];
    
    // Credit Accounts Payable for the total bill amount
    journalLines.push({
      accountId: apAccount.id,
      accountName: apAccount.name,
      debit: 0,
      credit: fullBill.total,
      memo: `Bill ${fullBill.billNumber} from ${fullBill.supplierName}`
    });

    for (const item of fullBill.items) {
      if (item.productId) {
        // Update product stock
        const productRef = doc(db, 'products', item.productId);
        transaction.update(productRef, {
          stock: increment(item.quantity),
          updatedAt: now
        });

        // Log movement
        const moveRef = doc(collection(db, 'inventory_movements'));
        transaction.set(moveRef, {
          id: moveRef.id,
          productId: item.productId,
          quantity: item.quantity,
          type: 'Inbound',
          reason: `Supplier Bill: ${fullBill.billNumber}`,
          date: now,
          performedBy: auth.currentUser?.uid || 'system'
        });
      }

      // Debit the corresponding account (Inventory Asset or Expense)
      // If none specified, default to Inventory Asset
      const debitAccountId = item.accountId || inventoryAssetAccount.id;
      
      // We need to fetch account name if it's not the default one
      let accountName = "Inventory Asset";
      if (item.accountId) {
          const accSnap = await transaction.get(doc(db, 'accounts', item.accountId));
          if (accSnap.exists()) {
              accountName = accSnap.data().name;
          }
      }

      journalLines.push({
        accountId: debitAccountId,
        accountName: accountName,
        debit: item.total,
        credit: 0,
        memo: item.description
      });
    }

    // 4. Update Supplier Balance
    const supplierRef = doc(db, 'suppliers', fullBill.supplierId);
    transaction.update(supplierRef, {
      balance: increment(fullBill.total)
    });

    // 5. Update Account Balances in Transactions
    // AP increases with Credit
    transaction.update(doc(db, 'accounts', apAccount.id), {
        balance: increment(fullBill.total),
        updatedAt: now
    });

    // Inventory Asset / Expenses increase with Debit
    for (const line of journalLines) {
        if (line.debit > 0) {
            transaction.update(doc(db, 'accounts', line.accountId), {
                balance: increment(line.debit),
                updatedAt: now
            });
        }
    }

    // 6. Record Journal Entry
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
      createdAt: now
    });

    // 7. Save the Bill
    transaction.set(billRef, fullBill);

    // 8. Log Activity
    const logRef = doc(collection(db, 'logs'));
    transaction.set(logRef, {
      id: logRef.id,
      userId: auth.currentUser?.uid || 'system',
      userName: auth.currentUser?.displayName || 'System',
      action: `Recorded Supplier Bill ${fullBill.billNumber}`,
      type: 'purchase',
      targetId: billId,
      timestamp: now,
      details: `Total: GHC ${fullBill.total.toLocaleString()}`
    });

    return billId;
  }).catch(error => {
    handleFirestoreError(error, OperationType.CREATE, 'supplier_bills');
  });
};

export const createSupplier = async (data: any) => {
  const ref = doc(collection(db, 'suppliers'));
  await setDoc(ref, {
    ...data,
    id: ref.id,
    balance: 0,
    createdAt: new Date().toISOString()
  });
  return ref.id;
};

export const createPurchaseQuote = async (data: any) => {
  const ref = doc(collection(db, 'purchase_quotes'));
  const quoteNumber = `PQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  await setDoc(ref, {
    ...data,
    id: ref.id,
    quoteNumber,
    status: 'Draft',
    createdAt: new Date().toISOString()
  });
  return ref.id;
};

export const createPurchaseOrder = async (data: any) => {
  const ref = doc(collection(db, 'purchase_orders'));
  const poNumber = `PO-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  await setDoc(ref, {
    ...data,
    id: ref.id,
    poNumber,
    date: new Date().toISOString(),
    status: 'Ordered',
    createdAt: new Date().toISOString()
  });
  return ref.id;
};

export const recordGoodsReceipt = async (data: any) => {
  return await runTransaction(db, async (transaction) => {
    const ref = doc(collection(db, 'goods_receipts'));
    const receiptNumber = `GRN-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Update PO status if linked
    if (data.poId) {
      transaction.update(doc(db, 'purchase_orders', data.poId), { status: 'Received' });
    }

    // Update product stock
    for (const item of data.items || []) {
      if (item.productId) {
        transaction.update(doc(db, 'products', item.productId), {
          stock: increment(item.quantity)
        });
      }
    }

    transaction.set(ref, {
      ...data,
      id: ref.id,
      receiptNumber,
      createdAt: new Date().toISOString()
    });
    return ref.id;
  });
};

export const convertQuoteToPO = async (quoteId: string) => {
  const quoteSnap = await getDoc(doc(db, 'purchase_quotes', quoteId));
  if (!quoteSnap.exists()) throw new Error("Quote not found");
  
  const quoteData = quoteSnap.data();
  const poId = await createPurchaseOrder({
    supplierId: quoteData.supplierId,
    supplierName: quoteData.supplierName,
    items: quoteData.items || [],
    total: quoteData.total,
  });

  await updateDoc(doc(db, 'purchase_quotes', quoteId), { status: 'Converted' });
  return poId;
};

export const createDebitNote = async (data: any) => {
  const ref = doc(collection(db, 'debit_notes'));
  const noteNumber = `DN-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // Update supplier balance (Debit note reduces what we owe)
  await updateDoc(doc(db, 'suppliers', data.supplierId), {
    balance: increment(-data.amount)
  });

  await setDoc(ref, {
    ...data,
    id: ref.id,
    noteNumber,
    createdAt: new Date().toISOString()
  });
  return ref.id;
};
