import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, getRedirectResult } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

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

  useEffect(() => {
    // 🌟 Variable Initialization ko top par rakhein (Reference Error se bachne ke liye)
    let unsubscribeProfile: (() => void) | null = null;
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
      
      // 🚀 optimization: Prevent redundant profile snaps on focus, storage sync, or visibility changes
      if (currentUser?.uid === user?.uid && unsubscribeProfile) {
        console.log("[AuthSync] User is already synchronized and profile snapshot is active. Skipping redundant initialization.");
        return;
      }
      
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        const authTimeout = setTimeout(() => {
          if (loading) {
            console.warn("[AuthSync] Profile fetch timed out, displaying app with limited profile.");
            setLoading(false);
          }
        }, 3000);

        unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          clearTimeout(authTimeout);
          if (doc.exists()) {
            setProfile(doc.data());
          } else {
            initializeProfile(currentUser);
          }
          setLoading(false);
        }, (error) => {
          clearTimeout(authTimeout);
          console.error("[AuthSync] Firestore profile snapshot error:", error);
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
      if (currentUser?.uid !== user?.uid) {
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
            if (freshUser?.uid !== user?.uid) {
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
      if (unsubscribeProfile) unsubscribeProfile();
      if (authChannel) {
        try {
          authChannel.close();
        } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid]);

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
