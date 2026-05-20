import { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment, addDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { SportsContent } from '../types';
import { useAuth } from '../hooks/useAuth';
import { 
  Heart, Share2, Volume2, VolumeX, Play, Pause, 
  ChevronUp, ChevronDown, Award, Send, MessageCircle, X, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Sample sport vertical video reels to load as beautiful fallbacks/defaults
const MOCK_SHORTS = [
  {
    id: 'short-bkey-1',
    title: 'Steph Curry Pregame Shooting routine',
    description: 'Witness the pure excellence of Curry as he warms up for the big game with non-stop swishes!',
    category: 'basketball',
    type: 'short',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-basketball-player-dribbling-the-ball-34444-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800',
    isPremium: false,
    viewCount: 14500,
    likes: 1243,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Basketball', 'Curry', 'Routine', 'WarmUp']
  },
  {
    id: 'short-soccer-2',
    title: 'Top Bin Practice Goal of the Week',
    description: 'Perfect curled shot into the absolute top corner of the net during sunset practice.',
    category: 'football',
    type: 'short',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-ball-in-stadium-1549-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
    isPremium: false,
    viewCount: 22400,
    likes: 3105,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Football', 'Goals', 'Unbelievable', 'Skills']
  },
  {
    id: 'short-boxing-3',
    title: 'Rapid Fire Punch Combos',
    description: 'Unbelievable speed and precision combos training session under intense coaches directions.',
    category: 'boxing',
    type: 'short',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-boxing-glove-hitting-air-4876-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800',
    isPremium: true,
    viewCount: 8900,
    likes: 721,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Boxing', 'Training', 'Combos', 'Speed']
  },
  {
    id: 'short-tennis-4',
    title: 'Perfect Forehand Stroke Slow-Mo',
    description: 'Deconstruct the flawless forehand technique under advanced high-speed action camera.',
    category: 'tennis',
    type: 'short',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tennis-player-hitting-ball-with-racket-1550-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd1d?q=80&w=800',
    isPremium: false,
    viewCount: 12000,
    likes: 914,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Tennis', 'Forehand', 'SlowMotion', 'Masterclass']
  }
];

export default function Shots() {
  const { user } = useAuth();
  const [shorts, setShorts] = useState<SportsContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likesState, setLikesState] = useState<{ [id: string]: { liked: boolean, count: number } }>({});
  
  // Floating comment drawer & load state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; user: string; text: string; time: string; createdAt?: string }[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Mobile viewport and Advanced Social Sharing options
  const [isMobile, setIsMobile] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; short: SportsContent } | null>(null);

  const activeShort = shorts[currentIndex];

  // Video references for play/pause control
  const videoRefs = useRef<{ [index: number]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Shorts
  const fetchShorts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'content'), where('type', '==', 'short'));
      const snap = await getDocs(q);
      let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
      
      // If Firestore contains zero shots, we present MOCK_SHORTS as beautiful initial list and seed them automatically so it's persisted!
      if (items.length === 0) {
        items = MOCK_SHORTS as unknown as SportsContent[];
        // Try to automatically seed them so the user is ready to go
        for (const mock of MOCK_SHORTS) {
          try {
            await setDoc(doc(db, 'content', mock.id), mock);
          } catch (e) {
            console.warn("Auto-seed of short failed:", e);
          }
        }
      } else {
        // Sort by createdAt descending
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      setShorts(items);
      
      // Initialize likes state
      const initialLikes: typeof likesState = {};
      items.forEach(item => {
        initialLikes[item.id] = {
          liked: false,
          count: item.likes || 0
        };
      });
      setLikesState(initialLikes);

      // Fetch user's individual likes
      if (user) {
        items.forEach(async (item) => {
          try {
            const likeSnap = await getDoc(doc(db, 'content', item.id, 'likes', user.uid));
            if (likeSnap.exists()) {
              setLikesState(prev => ({
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  liked: true
                }
              }));
            }
          } catch (e) {
            console.error("Error reading like status:", e);
          }
        });
      }

    } catch (err) {
      console.error("Error loading sport shorts:", err);
      // Fallback
      setShorts(MOCK_SHORTS as unknown as SportsContent[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShorts();
  }, [user]);

  // Detect mobile viewports
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch comments persistently from Firestore for the current activeShort
  useEffect(() => {
    if (!activeShort) return;
    let isMounted = true;

    const fetchCommentsForActiveShort = async () => {
      setCommentsLoading(true);
      try {
        const commentsRef = collection(db, 'content', activeShort.id, 'comments');
        const snap = await getDocs(commentsRef);
        if (!isMounted) return;

        let items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any));

        // Sort comments: newest first
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        if (items.length === 0) {
          // Beautiful fallback to support initial interaction
          const firstNames = ['David', 'Alex', 'Sarah', 'Kev', 'Carlos', 'Meghan', 'Rahul', 'Nate'];
          const textOptions = [
            'This stroke play is clean! 🔥⚽',
            'OMG! Can we analyze this slow-mo technique?',
            'Pure perfection right there.',
            'Absolute madness! Legendary clip!',
            'Gonna practice this combo starting tomorrow',
            'Incredible! Love the camera angle on this shot.',
            'Great work editing this!',
            'Unbelievable control and precision!!'
          ];

          const defaultComments = Array.from({ length: 4 }).map((_, i) => ({
            id: `comm-${i}`,
            user: firstNames[(currentIndex + i) % firstNames.length],
            text: textOptions[(currentIndex + i) % textOptions.length],
            time: `${i + 1}m ago`,
            createdAt: new Date(Date.now() - (i + 1) * 60 * 1000).toISOString()
          }));
          setComments(defaultComments);
        } else {
          const formatted = items.map(item => {
            let timeStr = 'Just now';
            if (item.createdAt) {
              const diffMs = Date.now() - new Date(item.createdAt).getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const diffHrs = Math.floor(diffMin / 60);
              const diffDays = Math.floor(diffHrs / 24);
              if (diffDays > 0) timeStr = `${diffDays}d ago`;
              else if (diffHrs > 0) timeStr = `${diffHrs}h ago`;
              else if (diffMin > 0) timeStr = `${diffMin}m ago`;
            }
            return {
              id: item.id,
              user: item.user || 'Sports Enthusiast',
              text: item.text || '',
              time: item.time || timeStr,
              createdAt: item.createdAt
            };
          });
          setComments(formatted);
        }
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        if (isMounted) setCommentsLoading(false);
      }
    };

    fetchCommentsForActiveShort();
    return () => {
      isMounted = false;
    };
  }, [currentIndex, activeShort]);

  // Handle current video play state based on active short index
  useEffect(() => {
    if (shorts.length === 0) return;

    // Play current video, pause others
    Object.keys(videoRefs.current).forEach((key) => {
      const idx = parseInt(key, 10);
      const video = videoRefs.current[idx];
      if (video) {
        if (idx === currentIndex) {
          if (isPlaying) {
            video.play().catch(e => console.log("Video auto play prevented:", e));
          } else {
            video.pause();
          }
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    // Increase view count in firestore asynchronously
    if (activeShort) {
      updateDoc(doc(db, 'content', activeShort.id), {
        viewCount: increment(1)
      }).catch(err => console.log('Silent view count error:', err));
    }

  }, [currentIndex, isPlaying, shorts]);

  // Navigate to next short
  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      toast.info("You've watched all available Sport Shots! Upload more in the Admin Dashboard.");
    }
  };

  // Navigate to previous short
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  };

  // Toggle Like on currently active short
  const handleLike = async (id: string) => {
    if (!user) {
      toast.error('Please sign in to like this video.');
      return;
    }

    const currentLikeObject = likesState[id] || { liked: false, count: 0 };
    const willBeLiked = !currentLikeObject.liked;
    const updateCount = willBeLiked ? 1 : -1;

    // Optimistic UI Update
    setLikesState(prev => ({
      ...prev,
      [id]: {
        liked: willBeLiked,
        count: Math.max(0, currentLikeObject.count + updateCount)
      }
    }));

    try {
      const contentRef = doc(db, 'content', id);
      const userLikeRef = doc(db, 'content', id, 'likes', user.uid);

      if (willBeLiked) {
        await setDoc(userLikeRef, { timestamp: new Date().toISOString() });
        await updateDoc(contentRef, { likes: increment(1) });
      } else {
        await deleteDoc(userLikeRef);
        await updateDoc(contentRef, { likes: increment(-1) });
      }
    } catch (err) {
      console.error("Like Firestore error:", err);
      // Revert state
      setLikesState(prev => ({
        ...prev,
        [id]: currentLikeObject
      }));
    }
  };

  // Toggle Mute on all shorts
  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  // Share current playing short URL using Native dialog or clean custom share modal
  const handleShare = async (short: SportsContent) => {
    const shareUrl = `${window.location.origin}/watch/${short.id}`;
    const shareTitle = short.title;
    const shareText = `Check out this amazing Sport Shot on SportsBox: "${short.title}"!`;

    // Try Native sharing first (fantastic on mobile devices, safari, chrome mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        toast.success('Shared successfully!');
        return; // Success!
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn("Native share cancelled or failed, using custom sheet fallback:", err);
        } else {
          return; // User cancelled native share, do not trigger fallback modal
        }
      }
    }

    // Fallback or Desktop view: opens custom beautiful share drawer/modal
    setShareData({ url: shareUrl, title: shareTitle, short });
    setIsShareModalOpen(true);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!activeShort) return;

    const userName = user?.displayName || user?.email?.split('@')[0] || 'Sports Enthusiast';
    const commentItem = {
      user: userName,
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      userId: user?.uid || 'anonymous'
    };

    // Optimistic state refresh
    const optId = `custom-comm-${Date.now()}`;
    const localComment = {
      id: optId,
      user: userName,
      text: newComment.trim(),
      time: 'Just now'
    };

    setComments(prev => [localComment, ...prev]);
    setNewComment('');

    try {
      const commentsRef = collection(db, 'content', activeShort.id, 'comments');
      await addDoc(commentsRef, commentItem);
      toast.success('Comment posted successfully!');
    } catch (err) {
      console.error("Firestore comment post error:", err);
      handleFirestoreError(err, OperationType.WRITE, `content/${activeShort.id}/comments`);
      toast.error('Failed to save comment to servers.');
    }
  };

  // Programmatically scroll the container when manual controls or keyboard buttons update currentIndex
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const targetScrollTop = currentIndex * container.clientHeight;
      if (Math.abs(container.scrollTop - targetScrollTop) > 10) {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    if (clientHeight === 0) return;
    
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < shorts.length) {
      setCurrentIndex(newIndex);
      setIsPlaying(true);
    }
  };

  // Handle Keyboard Navigation (ArrowUp and ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shorts]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black uppercase tracking-widest text-text-muted">Loading Sport Shots...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white py-4 md:py-10 px-2 sm:px-4 flex items-center justify-center select-none overflow-hidden pb-16 md:pb-10 relative">
      <div className="absolute top-6 left-6 hidden xl:flex flex-col gap-2 max-w-[280px] text-left pointer-events-none">
        <div className="flex items-center gap-2 text-brand">
          <Compass className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Controls Guide</span>
        </div>
        <p className="text-[10px] text-white/50 leading-relaxed uppercase tracking-wider mt-1">
          • <span className="font-bold text-white">Spacebar / Tap</span>: Play / Pause<br />
          • <span className="font-bold text-white">Arrow Down / Up</span>: Next / Prev Shots<br />
          • <span className="font-bold text-white">Swipe or Mouse Scroll</span>: Scroll vertical reels
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 max-w-6xl w-full justify-center">
        {/* Main Video Frame */}
        <div 
          className="relative aspect-[9/16] w-full max-w-[420px] h-[72vh] md:h-[78vh] bg-neutral-900 rounded-2xl md:rounded-[32px] overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group"
          id="shorts-stage"
        >
          {shorts.length > 0 ? (
            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
              style={{ contentVisibility: 'auto' }}
            >
              <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .no-scrollbar {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
              `}} />
              
              {shorts.map((short, idx) => {
                const isCurrent = idx === currentIndex;
                const likedObj = likesState[short.id] || { liked: false, count: 0 };
                
                return (
                  <div 
                    key={short.id} 
                    className="w-full h-full snap-start snap-always relative flex-shrink-0 flex items-center justify-center bg-black"
                  >
                    {/* Vertical Video Element */}
                    <video
                      ref={(el) => { videoRefs.current[idx] = el; }}
                      src={short.videoUrl}
                      poster={short.thumbnailUrl}
                      muted={isMuted}
                      loop={false}
                      playsInline
                      onClick={() => setIsPlaying(prev => !prev)}
                      onEnded={() => {
                        if (idx === currentIndex) {
                          handleNext();
                        }
                      }}
                      className="w-full h-full object-cover cursor-pointer bg-neutral-950"
                    />

                    {/* Play / Pause overlay flash indicator */}
                    <AnimatePresence>
                      {!isPlaying && isCurrent && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-all cursor-pointer z-10"
                          onClick={() => setIsPlaying(true)}
                        >
                          <div className="w-16 h-16 bg-brand/90 hover:bg-brand rounded-full flex items-center justify-center shadow-xl transform scale-110 transition-all">
                            <Play className="w-8 h-8 fill-white ml-1" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Top Mute/Volume Icon Overlay */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>

                    {/* Bottom Details Overlay */}
                    <div className="absolute bottom-0 left-0 right-16 bg-gradient-to-t from-black/95 via-black/45 to-transparent p-5 pt-16 flex flex-col justify-end pointer-events-none z-10 text-left">
                      <span className="self-start mb-2 text-[10px] font-black uppercase tracking-widest text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/20 px-2 py-0.5 rounded-full">
                        {short.category}
                      </span>
                      
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white line-clamp-1">
                        {short.title}
                      </h3>
                      
                      <p className="text-[10px] sm:text-xs text-white/75 mt-1 leading-relaxed line-clamp-2 uppercase tracking-wide">
                        {short.description}
                      </p>

                      {short.tags && short.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {short.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[9px] font-mono text-zinc-400">
                              #{tag.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions overlaid directly on the right of the video (Insta Reels Style) */}
                    <div className="absolute right-3 bottom-8 flex flex-col items-center gap-4 z-20">
                      {/* Like Action */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleLike(short.id); }}
                        className="group flex flex-col items-center hover:scale-105 transition-transform"
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all bg-black/50 backdrop-blur-md border border-white/10 ${
                          likedObj.liked 
                            ? 'bg-brand/20 border-brand/40 text-brand scale-110' 
                            : 'text-white'
                        }`}>
                          <Heart className={`w-5 h-5 ${likedObj.liked ? 'fill-brand text-brand' : 'group-hover:text-brand'}`} />
                        </div>
                        <span className="text-[10px] font-sans font-black tracking-wider text-white mt-1 shadow-sm">
                          {likedObj.count}
                        </span>
                      </button>

                      {/* Comments Action */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}
                        className="group flex flex-col items-center hover:scale-105 transition-transform"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
                          <MessageCircle className="w-5 h-5 group-hover:text-brand" />
                        </div>
                        <span className="text-[10px] font-sans font-black tracking-wider text-white mt-1 shadow-sm">
                          Chat
                        </span>
                      </button>

                      {/* Share Action */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleShare(short); }}
                        className="group flex flex-col items-center hover:scale-105 transition-transform"
                        title="Copy link to clipboard"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
                          <Share2 className="w-5 h-5 group-hover:text-brand" />
                        </div>
                        <span className="text-[10px] font-sans font-black tracking-wider text-white mt-1 shadow-sm">
                          Share
                        </span>
                      </button>

                      {/* Spinning Music/Category disk for perfect Reels realism */}
                      <div className="relative w-10 h-10 mt-1 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-600 overflow-hidden flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
                          <span className="text-[9px] font-black uppercase text-zinc-400 select-none">SB</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Slider Bar bottom of active video */}
                    {isCurrent && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20 pointer-events-none">
                        <motion.div 
                          className="h-full bg-brand" 
                          initial={{ width: '0%' }}
                          animate={{ width: isPlaying ? '100%' : '0%' }}
                          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center space-y-4">
              <Award className="w-12 h-12 mx-auto text-white/20 animate-bounce" />
              <p className="text-xs uppercase tracking-widest text-white/50">No vertical Sport Shots loaded yet.</p>
            </div>
          )}
        </div>

        {/* Action Controls Panel (Right Side list on Desktop, bottom on Mobile) */}
        {activeShort && (
          <div className="flex xl:flex-col lg:flex-col flex-row gap-5 items-center justify-center p-2 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xl lg:bg-transparent lg:border-none">
            {/* Desktop Navigation Helper Arrows */}
            <div className="hidden lg:flex flex-col gap-3">
              <button 
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-brand/20 hover:text-brand active:scale-95 disabled:opacity-20 flex items-center justify-center transition-all"
                title="Previous Sport Shot"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNext}
                disabled={currentIndex === shorts.length - 1}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-brand/20 hover:text-brand active:scale-95 disabled:opacity-20 flex items-center justify-center transition-all"
                title="Next Sport Shot"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Comments Panel Drawer */}
      <AnimatePresence>
        {isCommentsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-stretch md:justify-end"
          >
            {/* Click backdrop to exit */}
            <div className="absolute inset-0" onClick={() => setIsCommentsOpen(false)} />

            <motion.div 
              initial={isMobile ? { y: '100%', x: 0 } : { x: '100%', y: 0 }}
              animate={isMobile ? { y: 0, x: 0 } : { x: 0, y: 0 }}
              exit={isMobile ? { y: '100%', x: 0 } : { x: '100%', y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full md:max-w-md h-[78vh] md:h-full bg-zinc-950 border-t md:border-t-0 md:border-l border-white/10 flex flex-col shadow-2xl z-10 rounded-t-[32px] md:rounded-none overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                  <h4 className="font-display font-black text-xs uppercase tracking-widest text-[#00ffcc] flex items-center gap-2">
                    <span>Shots Feed Comments</span>
                    {commentsLoading && <span className="w-2 h-2 rounded-full bg-brand animate-ping" />}
                  </h4>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5">Interact in real-time</p>
                </div>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-[#00ffcc]/15 hover:text-[#00ffcc] transition-all text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Feed of comments */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {comments.length > 0 ? (
                  comments.map((comm) => (
                    <div key={comm.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-left transition-all hover:bg-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-brand/80">{comm.user}</span>
                        <span className="text-[9px] text-white/30 font-mono">{comm.time}</span>
                      </div>
                      <p className="text-xs text-white/80 mt-1 uppercase tracking-wide leading-relaxed">
                        {comm.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-24 text-white/40">
                    <MessageCircle className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs uppercase tracking-wider">No comments yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Box to Post Comments */}
              <form onSubmit={handlePostComment} className="p-5 border-t border-white/10 bg-zinc-900/60 flex gap-2 pb-8 md:pb-5">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="flex-1 bg-black border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-brand text-xs uppercase tracking-wider text-white"
                />
                <button 
                  type="submit" 
                  className="bg-brand hover:bg-brand-alt text-black p-3 px-4 rounded-xl flex items-center justify-center transition-colors font-black text-xs uppercase tracking-wider"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Custom Social Sharing Sheet/Modal */}
      <AnimatePresence>
        {isShareModalOpen && shareData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop click dismisses */}
            <div className="absolute inset-0" onClick={() => setIsShareModalOpen(false)} />
            
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center"
            >
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h4 className="font-display font-black text-sm uppercase tracking-widest text-brand mb-1">Share Sport Shot</h4>
              <p className="text-[10px] text-white/60 uppercase tracking-wider mb-6">Choose how to spread the action!</p>
              
              <div className="grid grid-cols-4 gap-2 mb-6">
                {/* WhatsApp button */}
                <a 
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.title + ' - Watch now: ' + shareData.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl group transition-all duration-300 hover:bg-white/5"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black text-emerald-400 transition-all duration-300">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span className="text-[8px] font-sans font-black text-white/50 uppercase tracking-widest leading-none">WhatsApp</span>
                </a>
                
                {/* Twitter / X */}
                <a 
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent('Watch this epic Sport Shot highlight on SportsBox! ' + shareData.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl group transition-all duration-300 hover:bg-white/5"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black text-white transition-all duration-300">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-[8px] font-sans font-black text-white/50 uppercase tracking-widest leading-none">Twitter</span>
                </a>
                
                {/* Facebook */}
                <a 
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl group transition-all duration-300 hover:bg-white/5"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white text-blue-500 transition-all duration-300">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-[8px] font-sans font-black text-white/50 uppercase tracking-widest leading-none">Facebook</span>
                </a>
                
                {/* Copy Link */}
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareData.url).then(() => {
                      toast.success('Link copied beautifully to clipboard!');
                      setIsShareModalOpen(false);
                    }).catch(() => {
                      toast.error('Failed to copy link.');
                    });
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl group transition-all duration-300 hover:bg-white/5"
                >
                  <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center group-hover:bg-brand group-hover:text-black text-brand transition-all duration-300">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <span className="text-[8px] font-sans font-black text-white/50 uppercase tracking-widest leading-none">Copy Link</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 px-3 text-left">
                <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider truncate flex-1 select-all">{shareData.url}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareData.url).then(() => {
                      toast.success('Share link copied!');
                      setIsShareModalOpen(false);
                    });
                  }}
                  className="text-[9px] bg-brand text-black font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl hover:bg-brand-alt transition-colors"
                >
                  Copy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
