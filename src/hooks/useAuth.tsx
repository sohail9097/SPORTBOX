import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, getRedirectResult } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, getDoc, doc, setDoc, onSnapshot } from '../lib/firebase';
import { toast } from 'sonner';
import { getDeviceId, getSessionDocId, removeCurrentSession, verifyOrCreateSession } from '../lib/sessionManager';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  profile: any | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUserRef = useRef<User | null>(null);
  const currentProfileRef = useRef<any | null>(null);
  const profileFetchInProgressRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    currentProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    // 🌟 Variable Initialization ko top par rakhein (Reference Error se bachne ke liye)
    let isCleanedUp = false;
    const authChannel = typeof window !== 'undefined' ? new BroadcastChannel('sportsbox_auth_session_sync') : null;

    // Handle redirect results from signInWithRedirect / Popup Custom Handshake
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user && !isCleanedUp) {
          console.log("[AuthSync] Redirect sign-in success:", result.user.uid);
          // 🚀 FIX: State update karna zaroori hai taaki blank screen turant refresh ho jaye
          setUser(result.user);
          toast.success(`Welcome back, ${result.user.displayName || 'User'}!`);
        }
      })
      .catch((error) => {
        console.error("[AuthSync] Redirect result processing error:", error);
      });

    // Setup active observers for state transitions
    const handleUserTransition = async (currentUser: User | null) => {
      if (isCleanedUp) return;
      
      const prevUser = currentUserRef.current;
      const prevProfile = currentProfileRef.current;

      // 🚀 optimization: Prevent redundant profile fetches or state updates on focus, storage sync, or visibility changes
      if (currentUser?.uid === prevUser?.uid && (prevProfile || !currentUser)) {
        console.log("[AuthSync] User is already synchronized and profile state is current. Skipping redundant initialization.");
        return;
      }
      
      setUser(currentUser);

      if (currentUser) {
        if (profileFetchInProgressRef.current === currentUser.uid) {
          console.log("[AuthSync] Profile fetch already in progress for uid:", currentUser.uid);
          return;
        }
        profileFetchInProgressRef.current = currentUser.uid;

        const userDocRef = doc(db, 'users', currentUser.uid);
        
        const authTimeout = setTimeout(() => {
          if (loading) {
            console.warn("[AuthSync] Profile fetch timed out, displaying app with limited profile.");
            setLoading(false);
          }
        }, 3000);

        getDoc(userDocRef, { component: 'AuthProvider', file: 'useAuth.tsx', reason: 'Fetch user profile doc on auth state change' })
          .then((docSnap) => {
            clearTimeout(authTimeout);
            profileFetchInProgressRef.current = null;
            if (isCleanedUp) return;
            if (docSnap.exists()) {
              setProfile(docSnap.data());
            } else {
              initializeProfile(currentUser);
            }
            setLoading(false);
          })
          .catch((error) => {
            clearTimeout(authTimeout);
            profileFetchInProgressRef.current = null;
            if (isCleanedUp) return;
            console.error("[AuthSync] Firestore profile fetch error:", error);
            setLoading(false);
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          });

        // Broadcast to other tabs that login was successful
        if (authChannel && !isCleanedUp) {
          try {
            authChannel.postMessage({ type: 'SYNC_AUTH_STATE', uid: currentUser.uid });
          } catch (err) {
            console.warn("[AuthSync] Failed to postMessage (active channels may have closed):", err);
          }
        }
      } else {
        setProfile(null);
        setLoading(false);
        
        // Broadcast to other tabs that logout occurred
        if (authChannel && !isCleanedUp) {
          try {
            authChannel.postMessage({ type: 'SYNC_AUTH_STATE', uid: null });
          } catch (err) {
            console.warn("[AuthSync] Failed to postMessage (active channels may have closed):", err);
          }
        }
      }
    };

    // Firebase state listener
    const unsubscribeAuth = onAuthStateChanged(auth, handleUserTransition);

    // Modern ID Token changed listener for real-time validation and custom domain handshake updates
    const unsubscribeToken = onIdTokenChanged(auth, (currentUser) => {
      console.log("[AuthSync] ID Token verification updated:", currentUser?.uid || 'anonymous');
      // If user state is different from what we hold, sync it
      if (currentUser?.uid !== currentUserRef.current?.uid) {
        handleUserTransition(currentUser);
      }
    });

    if (authChannel) {
      authChannel.onmessage = async (event) => {
        if (event.data?.type === 'SYNC_AUTH_STATE') {
          console.log("[AuthSync] Auth sync request received from another tab/popup. Checking...");
          // Let Firebase SDK process local storage state then update
          setTimeout(() => {
            const freshUser = auth.currentUser;
            if (freshUser?.uid !== currentUserRef.current?.uid) {
              handleUserTransition(freshUser);
            }
          }, 400);
        }
      };
    }

    // Storage Event Listener - triggers instantly when same-origin cookies or local storage is synced
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && (event.key.startsWith('firebase:authUser:') || event.key.includes('sportsbox_auth_trigger'))) {
        console.log("[AuthSync] LocalStorage auth state change caught. Fetching newest user state...");
        setTimeout(() => {
          handleUserTransition(auth.currentUser);
        }, 300);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Focus & Visibility refetching - handles the cross-origin transition when user focuses the tab back
    const handleWindowFocus = async () => {
      console.log("[AuthSync] Parent window focused. Checking for newly synchronized session...");
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Verify cached token to keep context active, avoid forcing network refresh (true)
          await currentUser.getIdToken(false);
          handleUserTransition(auth.currentUser);
        } catch (e) {
          console.warn("[AuthSync] Quiet validation failed on window focus:", e);
        }
      } else {
        // Fallback checks
        handleUserTransition(auth.currentUser);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup functions
    return () => {
      isCleanedUp = true;
      unsubscribeAuth();
      unsubscribeToken();
      if (authChannel) {
        try {
          authChannel.close();
        } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Verify device limit and attach real-time session listener whenever user is authenticated (fresh login OR auto-login)
  useEffect(() => {
    if (!user || !user.email) return;

    let isSubscribed = true;
    const email = user.email.toLowerCase().trim();
    const deviceId = getDeviceId();
    const docId = getSessionDocId(email, deviceId);
    const sessionRef = doc(db, 'sessions', docId);

    console.log(`[AuthProvider] Session Verification starting on app load for user "${email}" (deviceId: "${deviceId}", docId: "${docId}")`);

    // Verify session limit on every app load / state restore
    verifyOrCreateSession(email, user.uid).then((res) => {
      if (!isSubscribed) return;
      if (!res.allowed) {
        console.warn(`[AuthProvider] Device limit EXCEEDED for user "${email}" on auto-login/restore. Forcing logout...`);
        toast.error("Your account has reached the 2-device limit. Signing out on this device...", { duration: 6000 });
        auth.signOut();
      } else {
        console.log(`[AuthProvider] Session verification PASSED for user "${email}" on docId "${docId}".`);
      }
    }).catch((err) => {
      console.error("[AuthProvider] Session verification check error:", err);
    });

    let sessionWasActive = false;

    // Real-time listener: triggers if session doc is removed remotely from another device
    console.log(`[AuthProvider] Attaching real-time session onSnapshot listener for docId: "${docId}"`);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      console.log(`[AuthProvider SessionWatcher] onSnapshot fired for docId "${docId}": exists = ${docSnap.exists()}`);
      if (docSnap.exists()) {
        sessionWasActive = true;
      } else {
        if (sessionWasActive) {
          console.warn(`[AuthProvider SessionWatcher] Session doc "${docId}" was removed remotely. Forcing logout...`);
          toast.error("You have been logged out because this device session was closed from another device.", { duration: 5000 });
          auth.signOut();
        } else {
          console.warn(`[AuthProvider SessionWatcher] Session doc "${docId}" does NOT exist on initial listener check.`);
        }
      }
    }, (err) => {
      console.warn(`[AuthProvider SessionWatcher] Error listening to session "${docId}":`, err?.message || err);
    });

    return () => {
      isSubscribed = false;
      unsubscribeSession();
    };
  }, [user?.uid, user?.email]);

  const initializeProfile = async (authenticatedUser: User) => {
    const userDocRef = doc(db, 'users', authenticatedUser.uid);
    try {
      // Direct setDoc with merge: true is more resilient to offline errors than getDoc + setDoc
      // It will create the document if it doesn't exist, or update/merge if it does.
      const initialProfile = {
        uid: authenticatedUser.uid,
        email: authenticatedUser.email,
        displayName: authenticatedUser.displayName,
        subscriptionTier: 'free',
        subscriptionStatus: 'none',
        role: ADMIN_EMAILS.includes((authenticatedUser.email || '').toLowerCase()) ? 'admin' : 'user',
        favorites: [],
        watchLater: [],
        recentlyWatched: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(userDocRef, initialProfile, { merge: true });
      setProfile(initialProfile);
      console.log("[Auth] Profile sync requested for user:", authenticatedUser.uid);
    } catch (error: any) {
      // If it's an offline error, don't break the UI
      if (error?.message?.includes('offline')) {
        console.warn("[Auth] Persistence sync queued (offline).");
        return;
      }
      handleFirestoreError(error, OperationType.CREATE, `users/${authenticatedUser.uid}`);
    }
  };

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, profile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
