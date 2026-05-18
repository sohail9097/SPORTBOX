import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, CheckCircle2, ShieldCheck, Mail, LogOut, ChevronRight, Loader2, Key, Settings, Clock, Crown, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { SportsContent } from '../types';
import ContentCard from '../components/ContentCard';
import LoadingScreen from '../components/LoadingScreen';
import { toast } from 'sonner';

export default function Account() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(profile?.mobileNumber || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  
  const [watchLaterContent, setWatchLaterContent] = useState<SportsContent[]>([]);
  const [loadingWatchLater, setLoadingWatchLater] = useState(false);
  
  const [recentContent, setRecentContent] = useState<SportsContent[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    if (profile?.mobileNumber) setMobileNumber(profile.mobileNumber);
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile]);

  useEffect(() => {
    const fetchWatchLater = async () => {
      if (!profile?.watchLater || profile.watchLater.length === 0) {
        setWatchLaterContent([]);
        return;
      }

      setLoadingWatchLater(true);
      try {
        const contentRef = collection(db, 'content');
        const q = query(contentRef, where(documentId(), 'in', profile.watchLater.slice(0, 10)));
        const snapshot = await getDocs(q);
        const fetchedContent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
        setWatchLaterContent(fetchedContent);
      } catch (error) {
        console.error("Error fetching watch later:", error);
      } finally {
        setLoadingWatchLater(false);
      }
    };

    fetchWatchLater();
  }, [profile?.watchLater]);

  useEffect(() => {
    const fetchRecent = async () => {
      if (!profile?.recentlyWatched || profile.recentlyWatched.length === 0) {
        setRecentContent([]);
        return;
      }

      setLoadingRecent(true);
      try {
        const contentRef = collection(db, 'content');
        // Get last 10 recently watched
        const recentIds = [...profile.recentlyWatched].reverse().slice(0, 10);
        const q = query(contentRef, where(documentId(), 'in', recentIds));
        const snapshot = await getDocs(q);
        const fetchedContent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
        
        // Restore order based on recentIds
        const orderedContent = recentIds.map(id => fetchedContent.find(c => c.id === id)).filter(Boolean) as SportsContent[];
        setRecentContent(orderedContent);
      } catch (error) {
        console.error("Error fetching recent content:", error);
      } finally {
        setLoadingRecent(false);
      }
    };

    fetchRecent();
  }, [profile?.recentlyWatched]);

  const handleUpdateProfile = async () => {
    // Basic validation
    if (!displayName || displayName.trim().length < 3) {
      toast.error("Please enter your name (min 3 characters).");
      return;
    }

    if (!mobileNumber || mobileNumber.trim().length < 10) {
      toast.error("Please enter a valid mobile number (min 10 digits).");
      return;
    }

    setLoading(true);
    try {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName,
        mobileNumber: mobileNumber
      });
      toast.success("Profile Updated!");
      setVerificationSuccess(true);
      setTimeout(() => setVerificationSuccess(false), 3000);
    } catch (error: any) {
      console.error("Update Error:", error);
      toast.error("Error updating profile.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-black uppercase italic mb-8">Access Denied</h1>
        <p className="text-text-muted text-sm mb-8">Please sign in to view your profile and watchlist.</p>
        <button onClick={() => navigate('/login')} className="px-8 py-4 bg-brand text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-brand/20">
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* Top Profile Section */}
      <div className="max-w-[1600px] mx-auto px-4 pt-12 md:pt-20">
        <div className="flex flex-col items-center justify-center space-y-4 mb-12">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="group relative"
          >
            <div className="w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-full border-4 border-brand p-1 transition-transform group-hover:scale-105">
              <div className="w-full h-full rounded-full bg-brand/20 overflow-hidden flex items-center justify-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 md:w-16 md:h-16 text-brand" />
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 right-2 bg-brand text-white p-2 rounded-full shadow-lg">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </button>
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">
              {profile?.displayName || 'Set Name'}
            </h1>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-text-muted mt-1">
              Member ID: {user.uid.substring(0, 8)}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="max-w-2xl mx-auto glass-card p-6 md:p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <DetailItem icon={Mail} label="Email Address" value={user.email || ''} />
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Display Name</label>
                       <input 
                         type="text" 
                         value={displayName}
                         onChange={e => setDisplayName(e.target.value)}
                         className="w-full bg-bg border border-white/10 p-3 rounded-lg outline-none focus:border-brand text-xs font-bold"
                       />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <DetailItem icon={Crown} label="Subscription" value={profile?.subscriptionTier || 'Free'} highlight />
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Mobile Number</label>
                       <input 
                         type="tel" 
                         value={mobileNumber}
                         onChange={e => setMobileNumber(e.target.value)}
                         className="w-full bg-bg border border-white/10 p-3 rounded-lg outline-none focus:border-brand text-xs font-bold"
                       />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-white/5">
                  <button 
                    onClick={handleUpdateProfile}
                    className="flex-grow py-4 bg-brand text-white font-black uppercase tracking-widest text-[10px] rounded-lg shadow-lg hover:bg-brand-alt transition-colors"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Changes'}
                  </button>
                  <button 
                    onClick={() => {auth.signOut(); navigate('/');}}
                    className="flex-grow py-4 bg-white/5 text-red-500 font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Logout Account
                  </button>
                  {isAdmin && (
                    <Link to="/admin" className="flex-grow py-4 bg-white/5 text-brand font-black uppercase tracking-widest text-[10px] rounded-lg text-center hover:bg-brand/10 transition-colors">
                      Admin Panel
                    </Link>
                  )}
                </div>
                {verificationSuccess && <p className="text-center text-green-500 text-[10px] font-bold uppercase">Profile Updated!</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watchlist Section */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter">Watchlist</h3>
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase text-brand tracking-widest">
              {watchLaterContent.length} Titles
            </span>
          </div>
          
          <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar snap-x">
            {loadingWatchLater ? (
              <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>
            ) : watchLaterContent.length > 0 ? (
              watchLaterContent.map((item, i) => (
                <div key={item.id} className="flex-shrink-0 w-[140px] md:w-auto snap-start">
                  <ContentCard content={item} index={i} />
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center glass-card">
                <p className="text-text-muted text-xs font-bold uppercase tracking-widest italic leading-relaxed">
                  Your watchlist is feeling a bit lonely.<br />
                  <Link to="/" className="text-brand hover:underline">Explore content to add some action!</Link>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Continue Watching Section */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter">Continue Watching for {profile?.displayName || 'User'}</h3>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </div>
          
          <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
            {loadingRecent ? (
              <div className="flex justify-center py-12 w-full"><Loader2 className="animate-spin text-brand" /></div>
            ) : recentContent.length > 0 ? (
              recentContent.map((item, i) => (
                <div key={item.id} className="flex-shrink-0 w-[240px] md:w-[320px] snap-start relative">
                  <ContentCard content={item} index={i} featured />
                  <div className="absolute bottom-4 right-4 z-20">
                    <div className="p-2 bg-brand rounded-full shadow-lg">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full py-12 text-center glass-card">
                <p className="text-text-muted text-xs font-bold uppercase tracking-widest italic leading-relaxed">
                  Start watching some content to see them here!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, highlight }: { icon: any, label: string, value: string, highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={cn("text-sm font-bold truncate", highlight ? "text-brand" : "text-white/80")}>{value}</p>
    </div>
  );
}

