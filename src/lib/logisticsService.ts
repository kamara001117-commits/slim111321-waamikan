import {
  collection,
  doc,
  updateDoc,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export const createWaybill = async (data: any) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, 'counters', 'waybills');
      const counterSnap = await transaction.get(counterRef);

      let dnSnap = null;
      const dnRef = data.deliveryNoteId ? doc(db, 'sales_documents', data.deliveryNoteId) : null;
      if (dnRef) {
        dnSnap = await transaction.get(dnRef);
      }

      const nextNum = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) + 1 : 1;
      const waybillNumber = `WAAM-WB-${nextNum.toString().padStart(4, '0')}`;
      transaction.set(counterRef, { lastNumber: nextNum }, { merge: true });

      const waybillRef = doc(collection(db, 'waybills'));
      const id = waybillRef.id;
      const now = new Date().toISOString();

      if (dnRef && dnSnap?.exists()) {
        transaction.update(dnRef, {
          status: 'In Transit',
          waybillId: id,
          updatedAt: now,
        });
      }

      transaction.set(waybillRef, {
        ...data,
        id,
        waybillNumber,
        status: 'In Transit',
        createdAt: now,
      });

      return id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'waybills');
    throw error;
  }
};

export const updateWaybillStatus = async (waybillId: string, status: string) => {
  try {
    const ref = doc(db, 'waybills', waybillId);
    const now = new Date().toISOString();
    await updateDoc(ref, {
      status,
      updatedAt: now,
    });

    if (status === 'Delivered') {
      const snap = await getDoc(ref);
      const data = snap.data();
      if (data?.deliveryNoteId) {
        const dnRef = doc(db, 'sales_documents', data.deliveryNoteId);
        const dnSnap = await getDoc(dnRef);
        if (dnSnap.exists()) {
          await updateDoc(dnRef, { status: 'Delivered', updatedAt: now });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `waybills/${waybillId}`);
    throw error;
  }
};
