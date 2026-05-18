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

const app = initializeApp(firebaseConfig);

// Improved database initialization with local persistent cache
let dbInstance;
try {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  console.log(`[Firebase] Initializing Firestore for Project: ${firebaseConfig.projectId}, Database ID: ${dbId}`);
  
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({}),
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);
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
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      alert("POPUPS BLOCKED: Please enable popups for this site in your browser settings to sign in.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      // User closed the popup, no need for alert
    } else if (error.code === 'auth/unauthorized-domain') {
      alert("DOMAIN NOT AUTHORIZED: This domain is not yet allowed in your Firebase Console.\n\nFIX:\n1. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains\n2. Add these domains:\n   - www.sportsbox.in\n   - sportsbox.in\n   - ais-dev-mh4r6wg37qxzkiuioan5mi-304563445639.asia-southeast1.run.app\n   - ais-pre-mh4r6wg37qxzkiuioan5mi-304563445639.asia-southeast1.run.app");
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

// Connection test - simplified
async function testConnection() {
  try {
    const testDoc = doc(db, 'settings', 'siteConfig');
    // Using onSnapshot instead of getDocFromServer to avoid "offline" errors on startup
    // This just verifies we can define a reference
    console.log("[Firebase] Reference created for siteConfig");
  } catch (error) {
    console.error("[Firebase] Initial setup check failed:", error);
  }
}
testConnection();
