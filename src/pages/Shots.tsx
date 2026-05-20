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
  
  // Floating comment drawer
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; user: string; text: string; time: string }[]>([]);
  const [newComment, setNewComment] = useState('');

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

    // Populate random support comments for active short
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
    
    const randomComments = Array.from({ length: 4 }).map((_, i) => ({
      id: `comm-${i}`,
      user: firstNames[(currentIndex + i) % firstNames.length],
      text: textOptions[(currentIndex + i) % textOptions.length],
      time: `${i + 1}m ago`
    }));
    setComments(randomComments);

    // Increase view count in firestore asynchronously
    const activeShort = shorts[currentIndex];
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

  // Share current playing short URL
  const handleShare = (short: SportsContent) => {
    const shareUrl = `${window.location.origin}/watch/${short.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Share link successfully copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy link.');
    });
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const commentItem = {
      id: `custom-comm-${Date.now()}`,
      user: user?.displayName || 'Sports Enthusiast',
      text: newComment,
      time: 'Just now'
    };
    setComments(prev => [commentItem, ...prev]);
    setNewComment('');
    toast.success('Comment posted successfully!');
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

  const activeShort = shorts[currentIndex];

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
          >
            {/* Click backdrop to exit */}
            <div className="absolute inset-0" onClick={() => setIsCommentsOpen(false)} />

            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-zinc-950 border-l border-white/10 flex flex-col shadow-2xl z-10"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                  <h4 className="font-display font-black text-xs uppercase tracking-widest">Shots Feed Comments</h4>
                  <p className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5">Interact in real-time</p>
                </div>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1 px-2.5 rounded-full border border-white/10 hover:bg-white/15 hover:text-brand/90 transition-all text-xs font-bold uppercase tracking-wider"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Feed of comments */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {comments.length > 0 ? (
                  comments.map((comm) => (
                    <div key={comm.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-brand/80">{comm.user}</span>
                        <span className="text-[9px] text-white/30">{comm.time}</span>
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
              <form onSubmit={handlePostComment} className="p-5 border-t border-white/10 bg-zinc-900/60 flex gap-2">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="flex-1 bg-black border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-brand text-xs uppercase tracking-wider"
                />
                <button 
                  type="submit" 
                  className="bg-brand hover:bg-brand-alt text-white p-3 rounded-xl flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
