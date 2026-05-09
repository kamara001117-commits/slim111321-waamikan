import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export type ActivityType = 'invoice' | 'payment' | 'product' | 'user' | 'crm';

export const logActivity = async (
  type: ActivityType,
  action: string,
  targetId: string,
  details: string
) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'logs'), {
      userId: user.uid,
      userName: user.displayName || user.email,
      type,
      action,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
