import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Clear previous profile listener
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        
        // Determistic auth state is sets as soon as user is found
        // Loading continues for profile but UI can start showing header
        
        const authTimeout = setTimeout(() => {
          if (loading) {
            console.warn("[Auth] Profile fetch timed out, showing app with limited profile info.");
            setLoading(false);
          }
        }, 3000); // Reduced to 3s for better perceived speed

        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          clearTimeout(authTimeout);
          if (doc.exists()) {
            setProfile(doc.data());
          } else {
            initializeProfile(user);
          }
          setLoading(false);
        }, (error) => {
          clearTimeout(authTimeout);
          console.error("[Auth] Firestore sync error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

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
        role: ADMIN_EMAILS.includes(authenticatedUser.email || '') ? 'admin' : 'user',
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

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;

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
