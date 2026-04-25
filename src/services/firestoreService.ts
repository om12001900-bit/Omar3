import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

type Collection = 'goals' | 'hieas' | 'projects' | 'conferences' | 'users' | 'calendar_events';

export const firestoreService = {
  add: async (collName: Collection, data: any) => {
    try {
      const docRef = await addDoc(collection(db, collName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collName);
    }
  },

  update: async (collName: Collection, id: string, data: any) => {
    try {
      const docRef = doc(db, collName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collName}/${id}`);
    }
  },

  delete: async (collName: Collection, id: string) => {
    try {
      const docRef = doc(db, collName, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collName}/${id}`);
    }
  },

  getAll: async (collName: Collection, ownerId: string) => {
    try {
      const q = query(collection(db, collName), where('ownerId', '==', ownerId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, collName);
    }
  }
};
