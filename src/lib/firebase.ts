import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork,
  setLogLevel,
  terminate,
  clearIndexedDbPersistence,
  getDoc as firestoreGetDoc,
  getDocs as firestoreGetDocs,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';

// Disable internal Firebase/Firestore logging to suppress quota errors completely
setLogLevel('silent');

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

  // If we previously detected quota exhaustion, boot immediately in offline mode to avoid console errors and blockages
  try {
    // Clear legacy localStorage lock to repair any blocked clients
    localStorage.removeItem('firestore_quota_exhausted');

    if (sessionStorage.getItem('firestore_quota_exhausted') === 'true') {
      console.warn("[Firebase] Booting Firestore in offline cache mode due to previously detected quota exhaustion in this session.");
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

// --- FIRESTORE CACHE, DEDUPLICATION & LOGGING ENGINE ---

class MockDocumentSnapshot {
  id: string;
  ref: any;
  private _data: any;
  private _exists: boolean;

  constructor(id: string, data: any, exists: boolean) {
    this.id = id;
    this._data = data;
    this._exists = exists;
    this.ref = { id };
  }

  exists() {
    return this._exists;
  }

  data() {
    return this._data;
  }
}

class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  empty: boolean;
  size: number;

  constructor(docs: MockDocumentSnapshot[]) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(callback: (doc: any) => void) {
    this.docs.forEach(callback);
  }
}

// In-memory cache for fast deduplication and short-term caching
const inMemoryCache = new Map<string, { data: any; expiry: number }>();
// In-flight promises to eliminate simultaneous duplicate requests (deduplication)
const inFlightPromises = new Map<string, Promise<any>>();

// Helper to check if a collection path should be cached for the entire session
function isSessionCacheCollection(path: string): boolean {
  if (!path) return false;
  const normalized = path.toLowerCase();
  return (
    normalized.includes('settings') ||
    normalized.includes('sections') ||
    normalized.includes('slider') ||
    normalized.includes('subscription_plans') ||
    normalized.includes('olympic_medalists') ||
    normalized.includes('navigation') ||
    normalized.includes('categories') ||
    normalized.includes('sports') ||
    normalized.includes('countries')
  );
}

// Helper to get session storage cache
function getSessionCache(key: string): any {
  try {
    const cached = sessionStorage.getItem(`firestore_cache:${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.type === 'doc') {
        return new MockDocumentSnapshot(parsed.id, parsed.data, parsed.exists);
      } else if (parsed.type === 'query') {
        const docs = parsed.docs.map((d: any) => new MockDocumentSnapshot(d.id, d.data, d.exists));
        return new MockQuerySnapshot(docs);
      }
    }
  } catch (e) {
    console.warn("[Cache] Error reading from sessionStorage cache:", e);
  }
  return null;
}

// Helper to set session storage cache
function setSessionCache(key: string, type: 'doc' | 'query', snap: any) {
  try {
    let serialized: any;
    if (type === 'doc') {
      serialized = {
        type: 'doc',
        id: snap.id,
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null
      };
    } else {
      serialized = {
        type: 'query',
        docs: snap.docs.map((d: any) => ({
          id: d.id,
          exists: d.exists(),
          data: d.exists() ? d.data() : null
        }))
      };
    }
    sessionStorage.setItem(`firestore_cache:${key}`, JSON.stringify(serialized));
  } catch (e) {
    console.warn("[Cache] Error writing to sessionStorage cache:", e);
  }
}

// Helper to get precise serialization of query filters & orders
function getQueryCacheKey(q: any): string {
  if (!q) return '';
  if (typeof q.path === 'string') {
    return `doc:${q.path}`;
  }
  if (q.path && typeof q.path.toString === 'function') {
    return `doc:${q.path.toString()}`;
  }
  
  try {
    const path = q._query?.path?.segments?.join('/') || q.path || 'unknown';
    const limitVal = q._query?.limit || '';
    const filters = q._query?.filters?.map((f: any) => {
      const field = f.field?.segments?.join('.') || '';
      const op = f.op || '';
      const val = f.value?.internalValue || f.value || '';
      return `${field}:${op}:${val}`;
    }).join(',') || '';
    const orders = q._query?.explicitOrderBy?.map((o: any) => {
      const field = o.field?.segments?.join('.') || '';
      const dir = o.dir || '';
      return `${field}:${dir}`;
    }).join(',') || '';
    
    return `query:${path}|filters:${filters}|orders:${orders}|limit:${limitVal}`;
  } catch (err) {
    return `query-fallback:${q.toString ? q.toString() : 'unknown'}`;
  }
}

interface CacheOptions {
  component?: string;
  file?: string;
  reason?: string;
  maxAge?: number; // in ms
  bypassCache?: boolean;
}

// Custom wrapper for getDoc with global caching, deduplication, and developer logging
export async function getDoc<T = any>(
  docRef: DocumentReference<T>,
  options: CacheOptions = {}
): Promise<DocumentSnapshot<T>> {
  const path = docRef.path;
  const collectionName = docRef.parent.path;
  const cacheKey = `doc:${path}`;
  const timestamp = new Date().toISOString();
  
  const component = options.component || 'unknown';
  const file = options.file || 'unknown';
  const reason = options.reason || 'General fetch';
  const bypassCache = options.bypassCache || false;
  const isStatic = isSessionCacheCollection(collectionName);
  
  // 1. Session Storage Cache hit check (once per session for static lists/config)
  if (!bypassCache && isStatic) {
    const sessionHit = getSessionCache(cacheKey);
    if (sessionHit) {
      console.log(
        `%c[Firestore Request]\n` +
        `Component: ${component}\n` +
        `File: ${file}\n` +
        `Collection: ${collectionName}\n` +
        `Query: getDoc(${path})\n` +
        `Timestamp: ${timestamp}\n` +
        `Cache hit or miss: HIT (SessionStorage)\n` +
        `Reason for fetch: ${reason}`,
        'color: #10B981; font-weight: bold;'
      );
      return sessionHit;
    }
  }

  // 2. In-Memory Cache hit check
  if (!bypassCache) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() < memoryHit.expiry) {
      console.log(
        `%c[Firestore Request]\n` +
        `Component: ${component}\n` +
        `File: ${file}\n` +
        `Collection: ${collectionName}\n` +
        `Query: getDoc(${path})\n` +
        `Timestamp: ${timestamp}\n` +
        `Cache hit or miss: HIT (Memory)\n` +
        `Reason for fetch: ${reason}`,
        'color: #3B82F6; font-weight: bold;'
      );
      return memoryHit.data;
    }
  }

  // 3. Deduplicate active parallel requests
  let activePromise = inFlightPromises.get(cacheKey);
  if (activePromise) {
    console.log(`[Firestore Deduplication] Simultaneous request merged for path: ${cacheKey}`);
    return activePromise;
  }

  // 4. Cache MISS - Fetch from firestore
  console.log(
    `%c[Firestore Request]\n` +
    `Component: ${component}\n` +
    `File: ${file}\n` +
    `Collection: ${collectionName}\n` +
    `Query: getDoc(${path})\n` +
    `Timestamp: ${timestamp}\n` +
    `Cache hit or miss: MISS\n` +
    `Reason for fetch: ${reason}`,
    'color: #F59E0B; font-weight: bold;'
  );

  const fetchPromise = (async () => {
    try {
      const snap = await firestoreGetDoc(docRef);
      
      // Cache the result
      const maxAge = options.maxAge || (isStatic ? 24 * 60 * 60 * 1000 : 30 * 1000); // 24 hours for static, 30s for dynamic
      inMemoryCache.set(cacheKey, {
        data: snap,
        expiry: Date.now() + maxAge
      });

      // Save to Session Storage if static collection
      if (isStatic) {
        setSessionCache(cacheKey, 'doc', snap);
      }

      return snap;
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// Custom wrapper for getDocs with global caching, deduplication, and developer logging
export async function getDocs<T = any>(
  q: Query<T>,
  options: CacheOptions = {}
): Promise<QuerySnapshot<T>> {
  const cacheKey = getQueryCacheKey(q);
  const timestamp = new Date().toISOString();
  
  // Extract collection name safely
  let collectionName = 'unknown';
  try {
    collectionName = (q as any)._query?.path?.segments?.join('/') || 'unknown';
  } catch (_) {}
  
  const component = options.component || 'unknown';
  const file = options.file || 'unknown';
  const reason = options.reason || 'General fetch';
  const bypassCache = options.bypassCache || false;
  const isStatic = isSessionCacheCollection(collectionName);
  
  // 1. Session Storage Cache check
  if (!bypassCache && isStatic) {
    const sessionHit = getSessionCache(cacheKey);
    if (sessionHit) {
      console.log(
        `%c[Firestore Request]\n` +
        `Component: ${component}\n` +
        `File: ${file}\n` +
        `Collection: ${collectionName}\n` +
        `Query: ${cacheKey}\n` +
        `Timestamp: ${timestamp}\n` +
        `Cache hit or miss: HIT (SessionStorage)\n` +
        `Reason for fetch: ${reason}`,
        'color: #10B981; font-weight: bold;'
      );
      return sessionHit;
    }
  }

  // 2. In-Memory Cache check
  if (!bypassCache) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() < memoryHit.expiry) {
      console.log(
        `%c[Firestore Request]\n` +
        `Component: ${component}\n` +
        `File: ${file}\n` +
        `Collection: ${collectionName}\n` +
        `Query: ${cacheKey}\n` +
        `Timestamp: ${timestamp}\n` +
        `Cache hit or miss: HIT (Memory)\n` +
        `Reason for fetch: ${reason}`,
        'color: #3B82F6; font-weight: bold;'
      );
      return memoryHit.data;
    }
  }

  // 3. Deduplicate active parallel requests
  let activePromise = inFlightPromises.get(cacheKey);
  if (activePromise) {
    console.log(`[Firestore Deduplication] Simultaneous query merged for: ${cacheKey}`);
    return activePromise;
  }

  // 4. Cache MISS - Fetch from firestore
  console.log(
    `%c[Firestore Request]\n` +
    `Component: ${component}\n` +
    `File: ${file}\n` +
    `Collection: ${collectionName}\n` +
    `Query: ${cacheKey}\n` +
    `Timestamp: ${timestamp}\n` +
    `Cache hit or miss: MISS\n` +
    `Reason for fetch: ${reason}`,
    'color: #F59E0B; font-weight: bold;'
  );

  const fetchPromise = (async () => {
    try {
      const snap = await firestoreGetDocs(q);
      
      // Cache the result
      const maxAge = options.maxAge || (isStatic ? 24 * 60 * 60 * 1000 : 30 * 1000); // 24 hours for static, 30s for dynamic
      inMemoryCache.set(cacheKey, {
        data: snap,
        expiry: Date.now() + maxAge
      });

      // Save to Session Storage if static collection
      if (isStatic) {
        setSessionCache(cacheKey, 'query', snap);
      }

      return snap;
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

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
  
  // 1. If it's an offline error, don't throw or log an error
  if (errMessage.includes('offline') || errMessage.includes('connection')) {
    console.warn(`[Firebase] Sync warning (${operationType}): ${errMessage}`);
    return;
  }

  // 2. Gracefully handle resource exhaustion / quota limits to prevent application crashes and logs
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
            sessionStorage.setItem('firestore_quota_exhausted', 'true');
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
  throw new Error(JSON.stringify(errInfo));
}

export async function forceGoOnline() {
  try {
    sessionStorage.removeItem('firestore_quota_exhausted');
    localStorage.removeItem('firestore_quota_exhausted');
    if (db) {
      await enableNetwork(db);
    }
    console.log("[Firebase] Reconnected to Firestore successfully.");
    toast.success("Successfully reconnected to database! Syncing pending operations...");
    return true;
  } catch (e: any) {
    console.error("[Firebase] Reconnection failed:", e);
    toast.error(`Reconnection failed: ${e.message}`);
    return false;
  }
}

export function isDbOffline() {
  try {
    return sessionStorage.getItem('firestore_quota_exhausted') === 'true';
  } catch (_) {
    return false;
  }
}

export async function clearOfflineCache() {
  try {
    sessionStorage.removeItem('firestore_quota_exhausted');
    localStorage.removeItem('firestore_quota_exhausted');
    if (db) {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    }
    toast.success("Local offline cache cleared successfully! Reloading page...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    return true;
  } catch (e: any) {
    console.error("[Firebase] Failed to clear offline cache:", e);
    toast.error(`Failed to clear cache: ${e.message}`);
    return false;
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 7000,
  errorMsg: string = "Operation timed out. The database is currently unresponsive (this usually happens if the daily free-tier quota has been reached)."
): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
