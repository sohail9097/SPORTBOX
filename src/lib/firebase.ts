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
  onSnapshot as firestoreOnSnapshot,
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
  serverTimestamp
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

// --- DETAILED AUDIT INSTRUMENTATION & COUNTERS ---
if (typeof window !== 'undefined') {
  (window as any).__firestore_counters = (window as any).__firestore_counters || {
    getDoc: 0,
    getDocs: 0,
    onSnapshot: 0,
    setDoc: 0,
    updateDoc: 0,
    addDoc: 0,
    deleteDoc: 0,
    realReads: 0,
    realWrites: 0,
    byRoute: {}
  };
}

function getCallerDetails() {
  const err = new Error();
  const stack = err.stack || '';
  const lines = stack.split('\n');
  
  let callerFrame = '';
  const fullStack: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    fullStack.push(line);
    // Skip frames that belong to the wrapper itself
    if (!callerFrame && 
        !line.includes('firebase.ts') && 
        !line.includes('getCallerDetails') && 
        !line.includes('getDoc') && 
        !line.includes('getDocs') && 
        !line.includes('onSnapshot') && 
        !line.includes('setDoc') && 
        !line.includes('updateDoc') && 
        !line.includes('addDoc') && 
        !line.includes('deleteDoc')) {
      callerFrame = line;
    }
  }
  
  let fileName = 'Unknown File';
  let functionName = 'Anonymous';
  
  if (callerFrame) {
    const matchWithFunc = callerFrame.match(/at\s+([^\s(]+)\s+\(([^)]+)\)/);
    if (matchWithFunc) {
      functionName = matchWithFunc[1];
      const urlPath = matchWithFunc[2];
      const urlParts = urlPath.split('/');
      fileName = urlParts[urlParts.length - 1] || urlPath;
    } else {
      const matchNoFunc = callerFrame.match(/at\s+(.+)/);
      if (matchNoFunc) {
        const urlPath = matchNoFunc[1];
        const urlParts = urlPath.split('/');
        fileName = urlParts[urlParts.length - 1] || urlPath;
      } else {
        fileName = callerFrame;
      }
    }
  }
  
  if (fileName.includes('?')) {
    fileName = fileName.split('?')[0];
  }
  
  return {
    fileName,
    functionName,
    stack: fullStack.join('\n')
  };
}

function getPath(ref: any): string {
  if (!ref) return 'unknown';
  if (typeof ref.path === 'string') return ref.path;
  if (ref._query && ref._query.path) return ref._query.path.toString();
  return stringifyQuery(ref);
}

function incrementCounter(
  operation: 'getDoc' | 'getDocs' | 'onSnapshot' | 'setDoc' | 'updateDoc' | 'addDoc' | 'deleteDoc',
  isRealDbCall = false
) {
  if (typeof window !== 'undefined') {
    const counters = (window as any).__firestore_counters;
    if (counters) {
      counters[operation] = (counters[operation] || 0) + 1;
      if (isRealDbCall) {
        if (['getDoc', 'getDocs', 'onSnapshot'].includes(operation)) {
          counters.realReads = (counters.realReads || 0) + 1;
        } else if (['setDoc', 'updateDoc', 'addDoc', 'deleteDoc'].includes(operation)) {
          counters.realWrites = (counters.realWrites || 0) + 1;
        }
      }
      
      const route = window.location.pathname;
      if (!counters.byRoute[route]) {
        counters.byRoute[route] = {
          getDoc: 0,
          getDocs: 0,
          onSnapshot: 0,
          setDoc: 0,
          updateDoc: 0,
          addDoc: 0,
          deleteDoc: 0,
          realReads: 0,
          realWrites: 0
        };
      }
      counters.byRoute[route][operation]++;
      if (isRealDbCall) {
        if (['getDoc', 'getDocs', 'onSnapshot'].includes(operation)) {
          counters.byRoute[route].realReads = (counters.byRoute[route].realReads || 0) + 1;
        } else if (['setDoc', 'updateDoc', 'addDoc', 'deleteDoc'].includes(operation)) {
          counters.byRoute[route].realWrites = (counters.byRoute[route].realWrites || 0) + 1;
        }
      }
    }
  }
}

function logOperation(
  operation: string,
  path: string,
  isCacheHit: boolean,
  isRealDbCall: boolean,
  caller: ReturnType<typeof getCallerDetails>
) {
  const timestamp = new Date().toISOString();
  const title = `[Firestore Audit] ${operation.toUpperCase()} - ${isCacheHit ? 'CACHE HIT' : isRealDbCall ? 'REAL DB CALL' : 'WRAPPER CALL'}`;
  const color = isCacheHit ? 'color: #4caf50; font-weight: bold;' : isRealDbCall ? 'color: #ff3333; font-weight: bold;' : 'color: #2196f3; font-weight: bold;';
  
  console.groupCollapsed(`%c${title} on path: ${path}`, color);
  console.log(`%cTimestamp: %c${timestamp}`, 'color: #888;', 'color: #fff;');
  console.log(`%cOperation: %c${operation}`, 'color: #888;', 'color: #fff; font-weight: bold;');
  console.log(`%cPath: %c${path}`, 'color: #888;', 'color: #00ffff; font-weight: bold;');
  console.log(`%cCaller File: %c${caller.fileName}`, 'color: #888;', 'color: #fff; font-weight: bold;');
  console.log(`%cCaller Function: %c${caller.functionName}`, 'color: #888;', 'color: #fff;');
  if (typeof window !== 'undefined' && (window as any).__firestore_counters) {
    console.log(`%cGlobal Counter Status:`, 'color: #888;', (window as any).__firestore_counters);
  }
  console.log(`%cStack Trace:`, 'color: #888;');
  console.log(caller.stack);
  console.groupEnd();
}

// Wrapped Mutation Operations to automatically handle Smart Cache Invalidation
export async function setDoc(ref: any, data: any, options?: any) {
  const caller = getCallerDetails();
  const path = getPath(ref);
  incrementCounter('setDoc', true);
  logOperation('setDoc', path, false, true, caller);
  
  invalidateCache(ref?.path);
  return firestoreSetDoc(ref, data, options);
}

export async function updateDoc(ref: any, data: any) {
  const caller = getCallerDetails();
  const path = getPath(ref);
  incrementCounter('updateDoc', true);
  logOperation('updateDoc', path, false, true, caller);
  
  invalidateCache(ref?.path);
  return firestoreUpdateDoc(ref, data);
}

export async function addDoc(colRef: any, data: any) {
  const caller = getCallerDetails();
  const path = getPath(colRef);
  incrementCounter('addDoc', true);
  logOperation('addDoc', path, false, true, caller);
  
  invalidateCache(colRef?.path);
  return firestoreAddDoc(colRef, data);
}

export async function deleteDoc(ref: any) {
  const caller = getCallerDetails();
  const path = getPath(ref);
  incrementCounter('deleteDoc', true);
  logOperation('deleteDoc', path, false, true, caller);
  
  invalidateCache(ref?.path);
  return firestoreDeleteDoc(ref);
}

export function onSnapshot(ref: any, ...args: any[]) {
  const caller = getCallerDetails();
  const path = getPath(ref);
  incrementCounter('onSnapshot', true);
  logOperation('onSnapshot', path, false, true, caller);
  
  return (firestoreOnSnapshot as any)(ref, ...args);
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
  const caller = getCallerDetails();

  incrementCounter('getDoc', false);

  if (!bypass) {
    const cached = getDocCache.get(path);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      logOperation('getDoc', path, true, false, caller);
      return cached.snapshot;
    }
  }

  incrementCounter('getDoc', true);
  logOperation('getDoc', path, false, true, caller);

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
  const path = getPath(q);
  const maxAge = options?.maxAge ?? DEFAULT_TTL;
  const bypass = options?.bypassCache ?? false;
  const caller = getCallerDetails();

  incrementCounter('getDocs', false);

  if (!bypass) {
    const cached = getDocsCache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      logOperation('getDocs', path, true, false, caller);
      return cached.snapshot;
    }
  }

  incrementCounter('getDocs', true);
  logOperation('getDocs', path, false, true, caller);

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