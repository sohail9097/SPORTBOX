import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  initializeFirestore, 
  persistentLocalCache 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';

const app = initializeApp(firebaseConfig);

// Improved database initialization with local persistent cache
let dbInstance;
try {
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;
  
  console.log(`[Firebase] Initializing Firestore for Project: ${firebaseConfig.projectId}, Database ID: ${dbId || '(default)'}`);
  
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({})
  }, dbId);
} catch (e) {
  console.error("[Firebase] Failed to initialize Firestore with persistent cache:", e);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    toast.success(`Welcome, ${result.user.displayName || 'User'}!`);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      toast.error("Popups blocked! Please enable popups to sign in.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      // User closed the popup
    } else if (error.code === 'auth/unauthorized-domain') {
       toast.error("Auth domain not authorized. Check Firebase settings.");
    } else {
      console.error('Login failed:', error);
      toast.error(`Login Error: ${error.message || 'Unknown error'}`);
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
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
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

  console.error('Firestore Error: ', errInfo);

  // If it's an offline error, don't throw an alert-triggering error
  if (errMessage.includes('offline') || errMessage.includes('connection')) {
    console.warn(`[Firebase] Sync warning (${operationType}): ${errMessage}`);
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}
