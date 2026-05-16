import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      alert("POPUPS BLOCKED: Please enable popups for this site in your browser settings to sign in.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      // User closed the popup, no need for alert
    } else if (error.code === 'auth/unauthorized-domain') {
      alert("DOMAIN NOT AUTHORIZED: This URL is not yet allowed in your Firebase Console.\n\nFIX:\n1. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains\n2. Add these two domains:\n   - ais-dev-mh4r6wg37qxzkiuioan5mi-304563445639.asia-southeast1.run.app\n   - ais-pre-mh4r6wg37qxzkiuioan5mi-304563445639.asia-southeast1.run.app");
    } else {
      console.error('Login failed:', error);
      alert(`Login Error [${error.code}]: ${error.message || 'Unknown error'}.`);
    }
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    const testDoc = doc(db, 'settings', 'siteConfig');
    await getDocFromServer(testDoc);
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.error("Firebase is offline. Please check your internet connection.");
      } else if (error.message.includes('internal')) {
        console.error("Firebase Internal Error: This usually means the database is not provisioned or there is a configuration mismatch.");
      } else {
        console.error("Firebase Connection Error:", error.message);
      }
    }
  }
}
testConnection();
