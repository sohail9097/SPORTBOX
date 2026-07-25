import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, onAuthStateChanged, onIdTokenChanged, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';
import { getDeviceId, getSessionDocId, removeCurrentSession, verifyOrCreateSession, DeviceSession, removeSession, forceCreateSession } from '../lib/sessionManager';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Smartphone, Laptop, Monitor, LogOut, Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  profile: any | null;
  refreshProfile: () => Promise<any>;
  updateProfileState: (newData: Partial<any>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['sohailgaji9097@gmail.com', 'tavish@dreamcatchers.tv'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Device Limit Modal State
  const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false);
  const [deviceLimitSessions, setDeviceLimitSessions] = useState<DeviceSession[]>([]);
  const [loggingOutDeviceId, setLoggingOutDeviceId] = useState<string | null>(null);

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

        getDoc(userDocRef)
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
        console.warn(`[AuthProvider] Device limit EXCEEDED for user "${email}". Opening Device Limit modal...`);
        setDeviceLimitSessions(res.activeSessions || []);
        setShowDeviceLimitModal(true);
      } else {
        console.log(`[AuthProvider] Session verification PASSED for user "${email}" on docId "${docId}".`);
        setShowDeviceLimitModal(false);
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

  // Real-time Firestore user profile listener
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    console.log(`[AuthProvider] Attaching real-time profile snapshot listener for uid: "${user.uid}"`);

    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`[AuthProvider Realtime Profile] Data updated: tier=${data?.subscriptionTier}, status=${data?.subscriptionStatus}, mobile=${data?.mobileNumber}`);
        setProfile(data);
        currentProfileRef.current = data;
      } else {
        console.log(`[AuthProvider Realtime Profile] User doc does not exist yet. Initializing profile...`);
        initializeProfile(user);
      }
      setLoading(false);
    }, (error) => {
      console.warn("[AuthProvider Realtime Profile] Snapshot error:", error?.message || error);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
    };
  }, [user?.uid]);

  const updateProfileState = (newData: Partial<any>) => {
    setProfile((prev: any) => {
      const updated = { ...(prev || {}), ...newData };
      currentProfileRef.current = updated;
      return updated;
    });
  };

  const refreshProfile = async () => {
    if (!user) return null;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        currentProfileRef.current = data;
        return data;
      }
    } catch (err) {
      console.error("[AuthProvider] Manual refreshProfile error:", err);
    }
    return null;
  };

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

  const handleLogoutRemoteDevice = async (sessionToLogout: DeviceSession) => {
    if (!user || !user.email) return;
    setLoggingOutDeviceId(sessionToLogout.id);
    try {
      console.log(`[AuthProvider] Removing session ${sessionToLogout.id} for user ${user.email}`);
      await removeSession(sessionToLogout.id);

      const remaining = deviceLimitSessions.filter(s => s.id !== sessionToLogout.id);
      setDeviceLimitSessions(remaining);

      if (remaining.length < 2) {
        await forceCreateSession(user.email);
        toast.success(`Logged out from ${sessionToLogout.deviceName}. Login completed!`);
        setShowDeviceLimitModal(false);
        if (refreshProfile) {
          try {
            await refreshProfile();
          } catch (_) {}
        }
      } else {
        toast.success(`Logged out from ${sessionToLogout.deviceName}. Select another device if needed.`);
      }
    } catch (err) {
      console.error("[AuthProvider] Failed to logout remote device:", err);
      toast.error("Failed to logout remote device. Please try again.");
    } finally {
      setLoggingOutDeviceId(null);
    }
  };

  const handleCancelDeviceLimit = async () => {
    setShowDeviceLimitModal(false);
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, profile, refreshProfile, updateProfileState }}>
      {children}

      {/* Global Device Limit Modal */}
      <AnimatePresence>
        {showDeviceLimitModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-white/10 p-6 md:p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden text-left"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">
                    Device Limit Reached
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed font-medium">
                    Your account (<span className="text-white font-bold">{user?.email}</span>) is already logged in on <span className="text-brand font-bold">2 active devices</span> (maximum allowed).
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">
                  Active Logged-In Devices:
                </p>
                {deviceLimitSessions.map((session) => (
                  <div 
                    key={session.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand flex-shrink-0">
                        {session.deviceName.toLowerCase().includes('mobile') || session.deviceName.toLowerCase().includes('ios') || session.deviceName.toLowerCase().includes('android') ? (
                          <Smartphone className="w-5 h-5" />
                        ) : session.deviceName.toLowerCase().includes('mac') || session.deviceName.toLowerCase().includes('windows') ? (
                          <Laptop className="w-5 h-5" />
                        ) : (
                          <Monitor className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{session.deviceName}</h4>
                        <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                          Logged in: {new Date(session.loginTime).toLocaleDateString()} {new Date(session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLogoutRemoteDevice(session)}
                      disabled={loggingOutDeviceId === session.id}
                      className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0 cursor-pointer"
                    >
                      {loggingOutDeviceId === session.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5" />
                      )}
                      Logout
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  Select a device above to logout and proceed.
                </p>
                <button
                  onClick={handleCancelDeviceLimit}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
