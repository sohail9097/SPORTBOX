import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  initializeFirestore, 
  persistentLocalCache,
  disableNetwork
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

  // If we previously detected quota exhaustion, boot immediately in offline mode to avoid console errors and blockages
  try {
    if (localStorage.getItem('firestore_quota_exhausted') === 'true') {
      console.warn("[Firebase] Booting Firestore in offline cache mode due to previously detected quota exhaustion.");
      disableNetwork(dbInstance).catch(err => {
        console.warn("[Firebase] Failed to disable network on boot:", err);
      });
    }
  } catch (_) {}
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

export async function signInWithGoogle(useRedirectFallback = true) {
  try {
    console.log("[AuthSync] Initiating signInWithPopup with Custom Domain: ", firebaseConfig.authDomain);
    const result = await signInWithPopup(auth, googleProvider);
    
    // Broadcast auth state synchronization trigger via localStorage for instant cross-tab capture
    try {
      localStorage.setItem('sportsbox_auth_trigger', Date.now().toString());
    } catch (_) {}

    toast.success(`Welcome, ${result.user.displayName || 'User'}!`);
    return result.user;
  } catch (error: any) {
    console.warn("[AuthSync] signInWithPopup encountered error:", error.code, error.message);
    
    if (error.code === 'auth/popup-blocked') {
      if (useRedirectFallback) {
        console.log("[AuthSync] Popup blocked. Falling back securely to signInWithRedirect...");
        toast.info("Popups are blocked. Redirecting securely to sign-in page...");
        await signInWithRedirect(auth, googleProvider);
      } else {
        toast.error("Popups blocked! Please enable popups to sign in.");
      }
    } else if (error.code === 'auth/cancelled-popup-request') {
      // User closed the popup manually
      console.log("[AuthSync] Popup request cancelled by user.");
    } else if (error.code === 'auth/unauthorized-domain') {
       toast.error("Auth domain not authorized. Check Firebase console settings.");
    } else if (error.code === 'auth/network-request-failed') {
       toast.error("Network request failed. Please check internet connection.");
    } else {
      // For cross-origin blocked environments during local development or if popup was closed/blocked silently,
      // offer a safe fallback redirection
      if (useRedirectFallback && (error.message?.includes('closed') || error.message?.includes('cross-origin') || error.code === 'auth/popup-closed-by-user')) {
        console.log("[AuthSync] Popup failure or closure. Falling back securely to redirection...");
        toast.info("Signing in via secure redirect...");
        await signInWithRedirect(auth, googleProvider);
        return;
      }
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

  // Gracefully handle resource exhaustion / quota limits to prevent application crashes
  if (
    errMessage.toLowerCase().includes('quota') || 
    errMessage.toLowerCase().includes('exhausted') ||
    errMessage.toLowerCase().includes('resource-exhausted') ||
    errMessage.toLowerCase().includes('resource_exhausted') ||
    (error && typeof error === 'object' && 'code' in (error as any) && (error as any).code === 'resource-exhausted')
  ) {
    console.warn(`[Firebase] Quota limit reached or Resource Exhausted (${operationType}) at ${path}. App is running securely in offline cached mode.`);
    
    // Automatically switch the Firebase SDK to offline mode by disabling the network connection
    if (dbInstance) {
      try {
        disableNetwork(dbInstance).then(() => {
          console.log("[Firebase] Firestore network connection disabled successfully. SDK is now running in local cached mode.");
          try {
            localStorage.setItem('firestore_quota_exhausted', 'true');
          } catch (_) {}
        }).catch(err => {
          console.warn("[Firebase] Failed to disable network connection:", err);
        });
      } catch (e) {
        console.warn("[Firebase] Error calling disableNetwork:", e);
      }
    }

    // Throttled toast to avoid spamming the user
    const now = Date.now();
    const lastToast = (window as any).__lastQuotaToast || 0;
    if (now - lastToast > 30000) {
      (window as any).__lastQuotaToast = now;
      toast.error("Database limit reached. Viewing in offline cached mode.", {
        description: "The app remains fully responsive using locally cached data."
      });
    }
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}
