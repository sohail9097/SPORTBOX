import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  getDoc as firestoreGetDoc,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  addDoc as firestoreAddDoc,
  deleteDoc as firestoreDeleteDoc,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot
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
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
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

// Export direct standard Firestore functions
export { 
  doc,
  collection,
  query,
  where,
  limit,
  orderBy,
  increment, 
  arrayUnion, 
  arrayRemove, 
  documentId,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

// --- OPTIMIZED IN-MEMORY CACHE FOR FIRESTORE READS ---
const getDocCache = new Map<string, { snapshot: DocumentSnapshot<any>; timestamp: number }>();
const getDocsCache = new Map<string, { snapshot: QuerySnapshot<any>; timestamp: number }>();

// Increased Cache TTL to 5 minutes (300,000 ms) to aggressively reduce repetitive reads
const DEFAULT_TTL = 300000;

function stringifyQuery(q: any): string {
  if (!q) return '';
  try {
    if (typeof q.path === 'string') {
      return q.path;
    }
    if (q._query) {
      const parts: string[] = [];
      if (q._query.path) {
        parts.push(q._query.path.toString());
      }
      if (q._query.filters) {
        parts.push(JSON.stringify(q._query.filters.map((f: any) => ({
          field: f.field?.toString(),
          op: f.op,
          val: f.value?._value?.toString() || f.value?.toString()
        }))));
      }
      if (q._query.limit) {
        parts.push(`limit:${q._query.limit}`);
      }
      if (q._query.explicitOrderBy) {
        parts.push(JSON.stringify(q._query.explicitOrderBy.map((o: any) => ({
          field: o.field?.toString(),
          dir: o.dir
        }))));
      }
      return parts.join('|');
    }
    return q.converter ? 'converted-query' : 'standard-query';
  } catch (e) {
    return 'fallback-query-key';
  }
}

// Smart Invalidation: Only clear the specific changed document cache. 
// Never delete global layout or section data when a user updates their session/profile!
export function invalidateCache(docPath?: string) {
  if (docPath) {
    getDocCache.delete(docPath);
    
    // If a user profile/session writes data, only invalidate user-related queries
    if (docPath.startsWith('users/')) {
      for (const key of getDocsCache.keys()) {
        if (key.includes('users')) {
          getDocsCache.delete(key);
        }
      }
    }
    console.log(`[Cache Invalidation] Smart cleared cached doc for path: ${docPath}`);
  }
}

// Wrapped Mutation Operations to automatically handle Smart Cache Invalidation
export async function setDoc(ref: any, data: any, options?: any) {
  invalidateCache(ref?.path);
  return firestoreSetDoc(ref, data, options);
}

export async function updateDoc(ref: any, data: any) {
  invalidateCache(ref?.path);
  return firestoreUpdateDoc(ref, data);
}

export async function addDoc(colRef: any, data: any) {
  invalidateCache(colRef?.path);
  return firestoreAddDoc(colRef, data);
}

export async function deleteDoc(ref: any) {
  invalidateCache(ref?.path);
  return firestoreDeleteDoc(ref);
}

interface CacheOptions {
  component?: string;
  file?: string;
  reason?: string;
  maxAge?: number;
  bypassCache?: boolean;
}

// Caching getDoc wrapper
export async function getDoc(
  docRef: DocumentReference<any>,
  options?: CacheOptions
): Promise<DocumentSnapshot<any>> {
  const path = docRef.path;
  const maxAge = options?.maxAge ?? DEFAULT_TTL;
  const bypass = options?.bypassCache ?? false;

  if (!bypass) {
    const cached = getDocCache.get(path);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      console.log(`[Cache Hit] Serving cached doc for path: ${path}`);
      return cached.snapshot;
    }
  }

  const snapshot = await firestoreGetDoc(docRef);
  getDocCache.set(path, { snapshot, timestamp: Date.now() });
  return snapshot;
}

// Caching getDocs wrapper
export async function getDocs(
  q: Query<any>,
  options?: CacheOptions
): Promise<QuerySnapshot<any>> {
  const key = stringifyQuery(q);
  const maxAge = options?.maxAge ?? DEFAULT_TTL;
  const bypass = options?.bypassCache ?? false;

  if (!bypass) {
    const cached = getDocsCache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.snapshot;
    }
  }

  const snapshot = await firestoreGetDocs(q);
  getDocsCache.set(key, { snapshot, timestamp: Date.now() });
  return snapshot;
}

export async function signInWithGoogle(useRedirectFallback = true) {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    try {
      localStorage.setItem('sportsbox_auth_trigger', Date.now().toString());
    } catch (_) {}
    toast.success(`Welcome, ${result.user.displayName || 'User'}!`);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' && useRedirectFallback) {
      await signInWithRedirect(auth, googleProvider);
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
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  if (errMessage.includes('offline') || errMessage.includes('connection')) {
    console.warn(`[Firebase] Sync warning (${operationType}): ${errMessage}`);
    return;
  }

  throw new Error(errMessage);
}

export function isDbOffline() { return false; }
export async function forceGoOnline() { return true; }
export async function clearOfflineCache() { return true; }
export async function withTimeout<T>(promise: Promise<T>): Promise<T> { return promise; }