import { initializeApp } from 'firebase/app';
import { useEffect, useRef } from 'react';
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

// ==========================================
// OPTIMIZATION #3: FIRESTORE OFFLINE PERSISTENCE
// Enable built-in offline persistence using persistentLocalCache and persistentMultipleTabManager
// (modern modular Firestore SDK) so repeat visits are served from IndexedDB cache.
// Handles multi-tab scenarios and unsupported browsers gracefully by falling back.
// ==========================================
let dbInstance;
try {
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
    ? firebaseConfig.firestoreDatabaseId 
    : undefined;
  
  console.log(`[Firebase] Initializing Firestore with Offline Persistence for Project: ${firebaseConfig.projectId}, Database ID: ${dbId || '(default)'}`);
  
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, dbId);
} catch (e) {
  console.warn("[Firebase] Failed to initialize Firestore with persistent offline cache. Falling back gracefully:", e);
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

const inFlightGetDoc = new Map<string, Promise<DocumentSnapshot<any>>>();
const inFlightGetDocs = new Map<string, Promise<QuerySnapshot<any>>>();

// Increased Cache TTL to 5 minutes (300,000 ms) to aggressively reduce repetitive reads
const DEFAULT_TTL = 300000;

function extractPathFromFirestoreRef(ref: any): string {
  if (!ref) return 'unknown';
  
  // 1. If it has a direct path property (CollectionReference, DocumentReference)
  if (typeof ref.path === 'string') return ref.path;
  if (ref.path && typeof ref.path.toString === 'function') {
    const pathStr = ref.path.toString();
    if (pathStr && pathStr !== '[object Object]') return pathStr;
  }
  
  // 2. Check standard V9/V10 internal properties
  const q = ref._query || ref.query || ref;
  if (q) {
    if (q.path && typeof q.path.toString === 'function') {
      const pathStr = q.path.toString();
      if (pathStr && pathStr !== '[object Object]') return pathStr;
    }
  }

  // 3. Traverse ref properties to find any CollectionReference or path-like object
  try {
    for (const key of Object.keys(ref)) {
      const val = ref[key];
      if (val && typeof val === 'object') {
        // If nested object has path
        if (typeof val.path === 'string' && val.path) {
          return val.path;
        }
        if (val.path && typeof val.path.toString === 'function') {
          const p = val.path.toString();
          if (p && p !== '[object Object]') return p;
        }
        // If nested object is _query
        if (val._query && val._query.path && typeof val._query.path.toString === 'function') {
          return val._query.path.toString();
        }
        if (val.query && val.query.path && typeof val.query.path.toString === 'function') {
          return val.query.path.toString();
        }
      }
    }
  } catch (e) {
    // Ignore traversal errors
  }
  
  return 'unknown-path';
}

function stringifyQuery(q: any): string {
  if (!q) return '';
  try {
    const path = extractPathFromFirestoreRef(q);
    const queryObj = q._query || q.query;
    
    const parts: string[] = [path];
    
    if (queryObj) {
      const filters = queryObj.filters || queryObj.filters_;
      if (filters && Array.isArray(filters)) {
        parts.push(JSON.stringify(filters.map((f: any) => ({
          field: (f.field || f.field_ || f.property)?.toString() || '',
          op: f.op || f.op_ || '',
          val: f.value?._value?.toString() || f.value?.toString() || f.val?.toString() || ''
        }))));
      }
      const limit = queryObj.limit || queryObj.limit_;
      if (limit !== undefined && limit !== null) {
        parts.push(`limit:${limit}`);
      }
      const orderBy = queryObj.explicitOrderBy || queryObj.orderBy || queryObj.explicitOrderBy_;
      if (orderBy && Array.isArray(orderBy)) {
        parts.push(JSON.stringify(orderBy.map((o: any) => ({
          field: (o.field || o.field_ || o.property)?.toString() || '',
          dir: o.dir || o.direction || ''
        }))));
      }
    }
    
    return parts.join('|');
  } catch (e) {
    return 'fallback-query-key';
  }
}

// Smart Invalidation: Only clear the specific changed document cache. 
// Never delete unrelated global layout or section data when a user updates their session/profile!
export function invalidateCache(docPath?: string) {
  if (docPath) {
    getDocCache.delete(docPath);
    try {
      localStorage.removeItem(`sportsbox_doc_cache_${docPath}`);
    } catch (_) {}
    
    // Extract the primary collection name (e.g., "users" from "users/123", or "blogs" from "blogs/456")
    const parts = docPath.split('/');
    const collectionName = parts[0];
    
    if (collectionName) {
      for (const key of getDocsCache.keys()) {
        if (key.includes(collectionName)) {
          getDocsCache.delete(key);
        }
      }

      // Invalidate query caches in localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sportsbox_query_cache_') && key.includes(collectionName)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
    console.log(`[Cache Invalidation] Smart cleared cached doc and related collection queries for: ${docPath}`);
  }
}

// --- DETAILED AUDIT INSTRUMENTATION & COUNTERS ---
export const APP_START_TIME = typeof window !== 'undefined' ? ((window as any).__app_start_time || Date.now()) : Date.now();
if (typeof window !== 'undefined' && !(window as any).__app_start_time) {
  (window as any).__app_start_time = APP_START_TIME;
}

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
  (window as any).__firestore_reads_log = (window as any).__firestore_reads_log || [];
  (window as any).__firestore_active_listeners = (window as any).__firestore_active_listeners || {};
  (window as any).__firestore_listeners_history = (window as any).__firestore_listeners_history || [];
  (window as any).__firestore_renders = (window as any).__firestore_renders || {};
  
  // Monkeypatch routing history to record route transitions for navigation timeline tracking
  if (!(window as any).__firestore_route_patched) {
    (window as any).__firestore_route_patched = true;
    (window as any).__firestore_navigation_count = 0;
    
    const handleRouteTransition = (type: string) => {
      (window as any).__firestore_navigation_count++;
      console.log(`[Firestore Profiler] Route Transition [${type}] #${(window as any).__firestore_navigation_count} to: ${window.location.pathname}`);
    };
    
    window.addEventListener('popstate', () => handleRouteTransition('POPSTATE'));
    
    const originalPush = window.history.pushState;
    window.history.pushState = function (...args: any[]) {
      const res = originalPush.apply(this, args);
      handleRouteTransition('PUSHSTATE');
      return res;
    };
    
    const originalReplace = window.history.replaceState;
    window.history.replaceState = function (...args: any[]) {
      const res = originalReplace.apply(this, args);
      handleRouteTransition('REPLACESTATE');
      return res;
    };
  }
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
    // Skip frames that belong to the wrapper itself or tracing functions
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
    // Regex matches common stack line forms e.g. "at componentName (http://.../src/pages/Watch.tsx?t=123:45:6)"
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
  return extractPathFromFirestoreRef(ref);
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

let listenerSeq = 0;
export function onSnapshot(ref: any, ...args: any[]) {
  const listenerId = `listener_${++listenerSeq}`;
  const caller = getCallerDetails();
  const path = getPath(ref);
  const startTime = Date.now();
  const startMs = startTime - APP_START_TIME;
  
  incrementCounter('onSnapshot', true);
  logOperation('onSnapshot', path, false, true, caller);
  
  // Extract and intercept the listener callback
  const originalCallback = typeof args[0] === 'function' ? args[0] : args[1];
  const callbackIndex = typeof args[0] === 'function' ? 0 : 1;
  
  const listenerInfo = {
    id: listenerId,
    path,
    created: new Date().toISOString(),
    createdMs: startMs,
    caller,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    active: true,
    snapshotsCount: 0,
    destroyed: null as string | null,
    destroyedMs: null as number | null,
    lifetime: null as number | null,
  };
  
  if (typeof window !== 'undefined') {
    (window as any).__firestore_active_listeners[listenerId] = listenerInfo;
    (window as any).__firestore_listeners_history.push(listenerInfo);
  }
  
  const wrappedCallback = (snapshot: any, error?: any) => {
    const elapsed = Date.now() - startTime;
    listenerInfo.snapshotsCount++;
    
    // Log each snapshot trigger as a Firestore read event
    const docCount = snapshot ? (snapshot.docs ? snapshot.docs.length : (snapshot.exists && snapshot.exists() ? 1 : 0)) : 0;
    const isCache = snapshot?.metadata?.fromCache ?? false;
    
    const readLog = {
      id: `read_onSnapshot_${listenerId}_snap_${listenerInfo.snapshotsCount}`,
      timestamp: new Date().toISOString(),
      msSinceStartup: Date.now() - APP_START_TIME,
      api: 'onSnapshot_snapshot',
      path,
      isListener: true,
      listenerId,
      isCacheHit: isCache,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      caller,
      uid: auth.currentUser?.uid || null,
      duration: elapsed,
      docCount,
      stack: caller.stack
    };
    
    if (typeof window !== 'undefined') {
      (window as any).__firestore_reads_log.push(readLog);
    }
    
    if (originalCallback) {
      originalCallback(snapshot, error);
    }
  };
  
  const newArgs = [...args];
  newArgs[callbackIndex] = wrappedCallback;
  
  const unsub = (firestoreOnSnapshot as any)(ref, ...newArgs);
  
  return () => {
    const destroyTime = Date.now();
    listenerInfo.active = false;
    listenerInfo.destroyed = new Date().toISOString();
    listenerInfo.destroyedMs = destroyTime - APP_START_TIME;
    listenerInfo.lifetime = destroyTime - startTime;
    
    if (typeof window !== 'undefined') {
      delete (window as any).__firestore_active_listeners[listenerId];
    }
    
    console.log(`[Firestore Profiler] Unsubscribed listener ${listenerId} on path ${path}. Lifetime: ${listenerInfo.lifetime}ms`);
    unsub();
  };
}

interface CacheOptions {
  component?: string;
  file?: string;
  reason?: string;
  maxAge?: number;
  bypassCache?: boolean;
}

// Caching getDoc wrapper with promise-level simultaneous request deduplication
export async function getDoc(
  docRef: DocumentReference<any>,
  options?: CacheOptions
): Promise<DocumentSnapshot<any>> {
  const path = docRef.path;
  const collectionName = path.split('/')[0] || 'unknown';
  const maxAge = options?.maxAge ?? DEFAULT_TTL;
  const bypass = options?.bypassCache ?? false;
  const caller = getCallerDetails();
  const startTime = Date.now();
  const startMs = startTime - APP_START_TIME;

  incrementCounter('getDoc', false);

  let cachedSnapshot: any = null;
  let cacheReason = '';

  if (!bypass) {
    // 1. Check in-memory Map first
    const cached = getDocCache.get(path);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      cachedSnapshot = cached.snapshot;
      cacheReason = 'Served from in-memory cache';
      console.log(`CACHE CHECK for ${collectionName} [${path}]: HIT - reason: ${cacheReason}`);
    } else {
      // 2. Check persistent localStorage cache
      try {
        const localCachedStr = typeof window !== 'undefined' ? localStorage.getItem(`sportsbox_doc_cache_${path}`) : null;
        if (localCachedStr) {
          const localCached = JSON.parse(localCachedStr);
          const age = Date.now() - (localCached?.timestamp || 0);
          if (localCached && age < maxAge) {
            // Reconstruct a functional mock DocumentSnapshot
            const mockSnap = {
              exists: () => localCached.exists,
              data: () => localCached.data,
              id: localCached.id,
              ref: docRef,
              metadata: { fromCache: true }
            } as any;
            
            // Populate in-memory cache to speed up subsequent reads in the same session
            getDocCache.set(path, { snapshot: mockSnap, timestamp: localCached.timestamp });
            cachedSnapshot = mockSnap;
            cacheReason = 'Served from persistent local storage cache';
            console.log(`CACHE CHECK for ${collectionName} [${path}]: HIT - reason: ${cacheReason}`);
          } else if (localCached) {
            cacheReason = `Persistent cache expired (${Math.round(age / 1000)}s old, max ${Math.round(maxAge / 1000)}s)`;
            console.log(`CACHE CHECK for ${collectionName} [${path}]: MISS - reason: ${cacheReason}`);
          } else {
            cacheReason = 'Persistent cache corrupted';
            console.log(`CACHE CHECK for ${collectionName} [${path}]: MISS - reason: ${cacheReason}`);
          }
        } else {
          cacheReason = 'No cached entry found in local storage or memory';
          console.log(`CACHE CHECK for ${collectionName} [${path}]: MISS - reason: ${cacheReason}`);
        }
      } catch (err) {
        cacheReason = `Error reading localStorage: ${(err as Error).message}`;
        console.log(`CACHE CHECK for ${collectionName} [${path}]: MISS - reason: ${cacheReason}`);
      }
    }
  } else {
    cacheReason = 'Explicit cache bypass';
    console.log(`CACHE CHECK for ${collectionName} [${path}]: BYPASS - reason: ${cacheReason}`);
  }

  let isCacheHit = !!cachedSnapshot;
  
  let snapshot: DocumentSnapshot<any>;
  if (isCacheHit) {
    snapshot = cachedSnapshot;
  } else {
    // Check if there is an in-flight promise for this exact path to prevent parallel stampedes
    let inFlight = inFlightGetDoc.get(path);
    if (!inFlight) {
      incrementCounter('getDoc', true);
      inFlight = firestoreGetDoc(docRef).then((snap) => {
        // Store in memory cache
        getDocCache.set(path, { snapshot: snap, timestamp: Date.now() });
        
        // Store in localStorage (if it exists)
        try {
          if (typeof window !== 'undefined') {
            const serializedData = {
              id: snap.id,
              exists: snap.exists(),
              data: snap.exists() ? snap.data() : null,
              timestamp: Date.now()
            };
            localStorage.setItem(`sportsbox_doc_cache_${path}`, JSON.stringify(serializedData));
          }
        } catch (err) {
          console.warn(`[Firestore Cache] Error writing getDoc to localStorage [${path}]:`, err);
        }

        inFlightGetDoc.delete(path);
        return snap;
      }).catch((err) => {
        inFlightGetDoc.delete(path);
        throw err;
      });
      inFlightGetDoc.set(path, inFlight);
    } else {
      console.log(`[Firestore Profiler] Reusing in-flight getDoc for path: ${path}`);
      isCacheHit = true;
    }
    snapshot = await inFlight;
  }

  const elapsed = Date.now() - startTime;
  
  const readLog = {
    id: `read_getDoc_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    msSinceStartup: startMs,
    api: 'getDoc',
    path,
    isListener: false,
    isCacheHit,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    caller,
    uid: auth.currentUser?.uid || null,
    duration: elapsed,
    docCount: snapshot?.exists() ? 1 : 0,
    stack: caller.stack
  };

  if (typeof window !== 'undefined') {
    (window as any).__firestore_reads_log.push(readLog);
  }

  return snapshot;
}

// Caching getDocs wrapper with promise-level simultaneous request deduplication
export async function getDocs(
  q: Query<any>,
  options?: CacheOptions
): Promise<QuerySnapshot<any>> {
  const key = stringifyQuery(q);
  const path = getPath(q);
  const collectionName = path || 'unknown';
  const maxAge = options?.maxAge ?? DEFAULT_TTL;
  const bypass = options?.bypassCache ?? false;
  const caller = getCallerDetails();
  const startTime = Date.now();
  const startMs = startTime - APP_START_TIME;

  incrementCounter('getDocs', false);

  let cachedSnapshot: any = null;
  let cacheReason = '';

  if (!bypass) {
    // 1. Check in-memory Map first
    const cached = getDocsCache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      cachedSnapshot = cached.snapshot;
      cacheReason = 'Served from in-memory cache';
      console.log(`CACHE CHECK for ${collectionName}: HIT - reason: ${cacheReason}`);
    } else {
      // 2. Check persistent localStorage cache
      try {
        const localCachedStr = typeof window !== 'undefined' ? localStorage.getItem(`sportsbox_query_cache_${key}`) : null;
        if (localCachedStr) {
          const localCached = JSON.parse(localCachedStr);
          const age = Date.now() - (localCached?.timestamp || 0);
          if (localCached && age < maxAge) {
            // Reconstruct functional mock DocumentSnapshots
            const mockDocs = (localCached.docs || []).map((d: any) => ({
              id: d.id,
              exists: () => true,
              data: () => d.data,
              ref: { path: `${path}/${d.id}` } as any,
              metadata: { fromCache: true }
            }));
            
            // Reconstruct a functional mock QuerySnapshot
            const mockSnap = {
              empty: localCached.empty,
              size: localCached.size,
              docs: mockDocs,
              metadata: { fromCache: true },
              forEach: (callback: any) => mockDocs.forEach(callback)
            } as any;
            
            // Populate in-memory cache to speed up subsequent reads in the same session
            getDocsCache.set(key, { snapshot: mockSnap, timestamp: localCached.timestamp });
            cachedSnapshot = mockSnap;
            cacheReason = 'Served from persistent local storage cache';
            console.log(`CACHE CHECK for ${collectionName}: HIT - reason: ${cacheReason}`);
          } else if (localCached) {
            cacheReason = `Persistent cache expired (${Math.round(age / 1000)}s old, max ${Math.round(maxAge / 1000)}s)`;
            console.log(`CACHE CHECK for ${collectionName}: MISS - reason: ${cacheReason}`);
          } else {
            cacheReason = 'Persistent cache corrupted';
            console.log(`CACHE CHECK for ${collectionName}: MISS - reason: ${cacheReason}`);
          }
        } else {
          cacheReason = 'No cached entry found in local storage or memory';
          console.log(`CACHE CHECK for ${collectionName}: MISS - reason: ${cacheReason}`);
        }
      } catch (err) {
        cacheReason = `Error reading localStorage: ${(err as Error).message}`;
        console.log(`CACHE CHECK for ${collectionName}: MISS - reason: ${cacheReason}`);
      }
    }
  } else {
    cacheReason = 'Explicit cache bypass';
    console.log(`CACHE CHECK for ${collectionName}: BYPASS - reason: ${cacheReason}`);
  }

  let isCacheHit = !!cachedSnapshot;
  
  let snapshot: QuerySnapshot<any>;
  if (isCacheHit) {
    snapshot = cachedSnapshot;
  } else {
    // Check if there is an in-flight promise for this exact query key to prevent parallel stampedes
    let inFlight = inFlightGetDocs.get(key);
    if (!inFlight) {
      incrementCounter('getDocs', true);
      inFlight = firestoreGetDocs(q).then((snap) => {
        // Store in memory cache
        getDocsCache.set(key, { snapshot: snap, timestamp: Date.now() });
        
        // Store in localStorage
        try {
          if (typeof window !== 'undefined') {
            const serializedDocs = snap.docs.map(d => ({
              id: d.id,
              data: d.data()
            }));
            const serializedData = {
              docs: serializedDocs,
              empty: snap.empty,
              size: snap.size,
              timestamp: Date.now()
            };
            localStorage.setItem(`sportsbox_query_cache_${key}`, JSON.stringify(serializedData));
          }
        } catch (err) {
          console.warn(`[Firestore Cache] Error writing getDocs to localStorage [${path}]:`, err);
        }

        inFlightGetDocs.delete(key);
        return snap;
      }).catch((err) => {
        inFlightGetDocs.delete(key);
        throw err;
      });
      inFlightGetDocs.set(key, inFlight);
    } else {
      console.log(`[Firestore Profiler] Reusing in-flight getDocs for key: ${key}`);
      isCacheHit = true;
    }
    snapshot = await inFlight;
  }

  const elapsed = Date.now() - startTime;

  const readLog = {
    id: `read_getDocs_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    msSinceStartup: startMs,
    api: 'getDocs',
    path,
    isListener: false,
    isCacheHit,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    caller,
    uid: auth.currentUser?.uid || null,
    duration: elapsed,
    docCount: snapshot?.size || 0,
    stack: caller.stack
  };

  if (typeof window !== 'undefined') {
    (window as any).__firestore_reads_log.push(readLog);
  }

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

export function useRenderProfiler(componentName: string, props?: any) {
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  const prevPropsRef = useRef<any>(props);
  
  useEffect(() => {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - APP_START_TIME;
    
    if (typeof window !== 'undefined') {
      const renders = (window as any).__firestore_renders = (window as any).__firestore_renders || {};
      const componentRenders = renders[componentName] || {
        count: 0,
        history: []
      };
      
      componentRenders.count = renderCountRef.current;
      
      const propChanges: string[] = [];
      if (props && prevPropsRef.current) {
        for (const key of Object.keys({ ...props, ...prevPropsRef.current })) {
          if (props[key] !== prevPropsRef.current[key]) {
            propChanges.push(key);
          }
        }
      }
      
      componentRenders.history.push({
        renderNumber: renderCountRef.current,
        timestamp,
        msSinceStartup: elapsed,
        changedProps: propChanges,
        route: window.location.pathname
      });
      
      renders[componentName] = componentRenders;
      
      console.log(`[Render Profiler] "${componentName}" render #${renderCountRef.current} (elapsed: ${elapsed}ms). Changes: ${propChanges.length ? propChanges.join(', ') : 'none/initial'}`);
    }
    
    prevPropsRef.current = props;
  });
}
