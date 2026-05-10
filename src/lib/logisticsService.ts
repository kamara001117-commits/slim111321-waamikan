import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc,
  increment, 
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";

export const createWaybill = async (data: any) => {
  return await runTransaction(db, async (transaction) => {
    const waybillRef = doc(collection(db, 'waybills'));
    const id = waybillRef.id;

    // Optional: Update Delivery Note status
    if (data.deliveryNoteId) {
       const dnRef = doc(db, 'sales_documents', data.deliveryNoteId);
       transaction.update(dnRef, { 
         status: 'In Transit',
         waybillId: id
       });
    }

    transaction.set(waybillRef, {
      ...data,
      id,
      status: 'In Transit',
      createdAt: new Date().toISOString()
    });

    return id;
  });
};

export const updateWaybillStatus = async (waybillId: string, status: string) => {
  const ref = doc(db, 'waybills', waybillId);
  await updateDoc(ref, { 
    status,
    updatedAt: new Date().toISOString()
  });

  // If delivered, update delivery note too
  if (status === 'Delivered') {
     const snap = await getDoc(ref);
     const data = snap.data();
     if (data?.deliveryNoteId) {
        await updateDoc(doc(db, 'sales_documents', data.deliveryNoteId), { status: 'Delivered' });
     }
  }
};
