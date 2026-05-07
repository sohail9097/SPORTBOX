import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { SportsContent } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Play, Share2, Heart, MessageSquare, Crown, Info, ChevronRight, Activity, PlusCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate, transformGDriveUrl } from '../lib/utils';
import StadiumPlayer from '../components/StadiumPlayer';
import ReactMarkdown from 'react-markdown';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const { profile, isAdmin, loading: authLoading, user } = useAuth();
  const [content, setContent] = useState<SportsContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWatchLater, setIsWatchLater] = useState(false);

  useEffect(() => {
    if (profile && id) {
      setIsWatchLater(profile.watchLater?.includes(id) || false);
    }
  }, [profile, id]);

  useEffect(() => {
    if (id && user) {
      // Update recently watched list
      const updateRecent = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            recentlyWatched: arrayUnion(id)
          });
        } catch (error) {
          console.error("Error updating recently watched:", error);
        }
      };
      updateRecent();
    }
    
    if (id) {
      window.scrollTo(0, 0);
      fetchContent();
      // Increment view count
      updateDoc(doc(db, 'content', id), {
        viewCount: increment(1)
      }).catch(err => console.error('Failed to update views', err));
    }
  }, [id]);

  const toggleWatchLater = async () => {
    if (!user || !id) return;
    
    const newStatus = !isWatchLater;
    setIsWatchLater(newStatus);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        watchLater: newStatus ? arrayUnion(id) : arrayRemove(id)
      });
    } catch (error) {
      setIsWatchLater(!newStatus);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const fetchContent = async () => {
    try {
      const snap = await getDoc(doc(db, 'content', id!));
      if (snap.exists()) {
        setContent({ id: snap.id, ...snap.data() } as SportsContent);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `content/${id}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!content) return <div className="h-screen flex flex-col items-center justify-center">Content not found. <Link to="/" className="text-brand mt-4">Back Home</Link></div>;

  const isLocked = (!profile || profile.subscriptionTier === 'free') && !isAdmin;

  const isIframeUrl = (url: string) => {
    if (!url) return false;
    const iframeProviders = ['iframe.dacast.com', 'player.vimeo.com', 'facebook.com/plugins/video.php', 'twitch.tv/embed'];
    return iframeProviders.some(p => url.includes(p));
  };

  return (
    <div className="min-h-screen bg-bg text-text-base">
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)]">
        {/* Cinematic Player Section */}
        <div className="flex-grow bg-black relative flex flex-col">
          <div className="relative flex-grow min-h-[50vh] lg:min-h-0 aspect-video lg:aspect-auto flex items-center justify-center overflow-hidden">
            {isLocked ? (
              <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  className="max-w-md text-center space-y-8"
                >
                  <div className="w-24 h-24 bg-brand/10 border border-brand/20 rounded-xl mx-auto flex items-center justify-center shadow-2xl shadow-brand/20">
                    <Crown className="w-12 h-12 text-brand" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter">Stadium Pass Required</h2>
                    <p className="text-text-muted font-medium">All video content is restricted to Pro members. Upgrade your subscription to join the broadcast and support your favorite teams.</p>
                  </div>
                  <Link 
                    to="/plans" 
                    className="inline-block px-12 py-5 bg-brand text-white font-black text-xs uppercase tracking-[0.3em] rounded-lg hover:scale-105 transition-transform"
                  >
                    Get Pro Access
                  </Link>
                </motion.div>
              </div>
            ) : content.videoUrl ? (
              <div className="absolute inset-0 w-full h-full">
                {content.videoUrl && content.videoUrl.trim() !== '' && isIframeUrl(content.videoUrl) ? (
                  <iframe
                    src={content.videoUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture"
                  />
                ) : !isLocked && content.videoUrl && content.videoUrl.trim() !== '' ? (
                  <StadiumPlayer 
                    url={transformGDriveUrl(content.videoUrl, 'video')} 
                    isLive={content.status === 'live'} 
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface/90 backdrop-blur-3xl">
                    <Play className="w-12 h-12 text-white/10 mb-4" />
                    <p className="text-text-muted font-medium">Video feed currently unavailable.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface/90 backdrop-blur-3xl">
                <Play className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-text-muted font-medium">Video feed currently unavailable.</p>
              </div>
            )}

            {/* In-Player Critical HUD */}
            <div className="absolute top-8 left-8 z-30 flex items-center gap-4">
              {content.status === 'live' && (
                <div className="flex items-center gap-3 px-4 py-2 bg-red-600 rounded-md shadow-2xl shadow-red-600/40">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Now</span>
                </div>
              )}
              <div className="px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-md text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                {content.category} • {content.viewCount?.toLocaleString()} Spectators
              </div>
            </div>
          </div>

          {/* Info HUD below player */}
          <div className="p-8 lg:p-12 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">
                  <span>Direct Feed</span>
                  <span>/</span>
                  <span>4K Resolution</span>
                  <span>/</span>
                  <span>{formatDate(content.createdAt)}</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
                  {content.title}
                </h1>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={toggleWatchLater}
                  className="flex flex-col items-center justify-center gap-1 px-4 py-2 bg-surface border border-border hover:border-brand/40 rounded-lg transition-all group min-w-[70px]"
                >
                  {isWatchLater ? (
                    <CheckCircle2 className="w-4 h-4 text-brand" />
                  ) : (
                    <PlusCircle className="w-4 h-4 text-text-muted group-hover:text-brand transition-colors" />
                  )}
                  <span className={cn("text-[8px] font-black uppercase tracking-tight", isWatchLater ? "text-brand" : "text-text-muted")}>
                    {isWatchLater ? 'Saved' : 'Watch Later'}
                  </span>
                </button>
                <ActionButton icon={Heart} label="14k" />
                <ActionButton icon={Share2} label="Share" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-8 border-t border-border">
              <div className="lg:col-span-2 prose prose-invert prose-red">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-muted mb-4">Event Overview</h3>
                <div className="markdown-body">
                  <ReactMarkdown>{content.description}</ReactMarkdown>
                </div>
              </div>
              <div className="space-y-6">
                 <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Momentum</h3>
                 <div className="space-y-4">
                   <MomentumTracker label="Offensive Pressure" value="82%" width="w-[82%]" />
                   <MomentumTracker label="Fan Sentiment" value="94%" width="w-[94%]" />
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Stadium Chat Sidebar */}
        <div className="w-full lg:w-[400px] bg-bg border-l border-border flex flex-col h-[500px] lg:h-auto">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-brand" />
              <h3 className="font-black uppercase tracking-[0.2em] text-xs italic">Stadium Live Chat</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-text-muted">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               Connected
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-grow p-6 overflow-y-auto space-y-6 custom-scrollbar">
            <ChatMessage user="Aria_99" message="LETS GOOO! Incredible strike!" color="text-red-500" />
            <ChatMessage user="GlobalFan" message="Anyone watching from Spain? 🇪🇸" color="text-blue-400" />
            <ChatMessage user="SportPro_X" message="The goalkeeper is having a nightmare today..." color="text-yellow-500" />
            <ChatMessage user="VipMember" message="Premium feed quality is insane in 4K" color="text-brand" isPro />
            <ChatMessage user="Admin" message="Welcome to the SportBox Live Center. Please keep it respectful." color="text-white bg-brand/20 p-2 rounded-sm" />
            
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-10">
              <Play className="w-12 h-12 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">End of feed</p>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-6 border-t border-border bg-surface/30">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Join the discussion..." 
                disabled
                className="w-full bg-bg border border-border p-4 pr-16 rounded-lg text-xs font-medium outline-none focus:border-brand transition-all cursor-not-allowed"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-surface border border-border rounded text-[8px] font-black uppercase tracking-tighter text-text-muted">
                ENTER
              </div>
            </div>
            <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-text-muted text-center italic">
               Chat connection restricted to Pro Members
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ user, message, color, isPro }: { user: string, message: string, color: string, isPro?: boolean }) {
  return (
    <div className="space-y-1 group hover:translate-x-1 transition-transform">
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-widest", color)}>{user}</span>
        {isPro && <Crown className="w-3 h-3 text-brand" />}
      </div>
      <p className="text-xs font-medium opacity-70 leading-relaxed">{message}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="flex items-center gap-2 px-6 py-3 bg-surface border border-border hover:border-brand/40 rounded-lg transition-all text-xs font-black uppercase tracking-[0.2em] group">
      <Icon className="w-4 h-4 text-text-muted group-hover:text-brand transition-colors" />
      <span>{label}</span>
    </button>
  );
}

function MomentumTracker({ label, value, width }: { label: string, value: string, width: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-white/40">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full bg-brand", width)} />
      </div>
    </div>
  );
}
