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
import { transformGDriveUrl, getVideoAutoThumbnail, sanitizeVideoUrlOrIframe } from '../lib/utils';
import { FALLBACK_SHORTS } from '../lib/fallbackData';

// Fallback list of high-fidelity shorts when Firestore is empty/exhausted
const MOCK_SHORTS: SportsContent[] = FALLBACK_SHORTS;

// Helper to return a premium, deterministic profile picture based on username
const getCommentAvatar = (username: string) => {
  const avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop', // Woman 1
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop', // Man 1
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop', // Woman 2
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop', // Man 2
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop', // Woman 3
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop', // Man 3
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop', // Woman 4
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop'  // Man 4
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatars.length;
  return avatars[index];
};

export default function Shots() {
  const { user } = useAuth();
  const [shorts, setShorts] = useState<SportsContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likesState, setLikesState] = useState<{ [id: string]: { liked: boolean, count: number } }>({});
  const [videoErrors, setVideoErrors] = useState<{ [id: string]: boolean }>({});
  
  // Floating comment drawer & load state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; user: string; text: string; time: string; createdAt?: string }[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLikes, setCommentLikes] = useState<{ [commId: string]: { liked: boolean; count: number } }>({});

  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggleCommentLike = (commentId: string) => {
    setCommentLikes(prev => {
      const current = prev[commentId] || { liked: false, count: 0 };
      return {
        ...prev,
        [commentId]: {
          liked: !current.liked,
          count: current.liked ? Math.max(0, current.count - 1) : current.count + 1
        }
      };
    });
  };

  const handleReplyClick = (commUser: string) => {
    const formattedUser = commUser.toLowerCase().replace(/\s+/g, '_');
    setNewComment(`@${formattedUser} `);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Mobile viewport and Advanced Social Sharing options
  const [isMobile, setIsMobile] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; title: string; short: SportsContent } | null>(null);

  const activeShort = shorts[currentIndex];

  // Video and iframe references for play/pause control
  const videoRefs = useRef<{ [index: number]: HTMLVideoElement | null }>({});
  const iframeRefs = useRef<{ [index: number]: HTMLIFrameElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const cloudflarePlayers = useRef<{ [index: number]: any }>({});

  // Helper to extract YouTube ID
  const getYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const target = url.trim();
    let youtubeId = '';
    if (target.includes('youtube.com') || target.includes('youtu.be')) {
      if (target.includes('youtube.com/embed/')) {
        const parts = target.split('/embed/');
        if (parts[1]) youtubeId = parts[1].split(/[?#]/)[0];
      } else if (target.includes('youtube.com/watch')) {
        const match = target.match(/[?&]v=([^&#]+)/);
        if (match) youtubeId = match[1];
      } else if (target.includes('youtu.be/')) {
        const parts = target.split('youtu.be/');
        if (parts[1]) youtubeId = parts[1].split(/[?#]/)[0];
      }
    }
    return youtubeId || null;
  };

  // Helper to extract Google Drive ID
  const getGoogleDriveId = (url: string): string | null => {
    if (!url) return null;
    const target = url.trim();
    if (!target.includes('drive.google.com')) return null;
    
    // Handle /file/d/ID/view or /d/ID
    const dMatch = target.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (dMatch) return dMatch[1];
    
    // Handle uc?id=ID or open?id=ID
    const idMatch = target.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    
    return null;
  };

  // Helper to detect/convert Cloudflare Stream video URL to an iframe embed URL
  const getCloudflareStreamIframeUrl = (url: string): string | null => {
    if (!url) return null;
    const target = url.trim();
    
    if (target.includes('cloudflarestream.com') && target.includes('/iframe')) {
      return target;
    }
    
    if (target.includes('cloudflarestream.com') || target.includes('videodelivery.net')) {
      const hexIdMatch = target.match(/([a-fA-F0-9]{32})/);
      if (hexIdMatch) {
        const videoId = hexIdMatch[1];
        const customerMatch = target.match(/customer-([a-zA-Z0-9]+)\.cloudflarestream\.com/);
        if (customerMatch) {
          const customerId = customerMatch[1];
          return `https://customer-${customerId}.cloudflarestream.com/${videoId}/iframe`;
        }
        return `https://iframe.videodelivery.net/${videoId}/iframe`;
      }
    }
    return null;
  };

  // Load Shorts
  const fetchShorts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'content'), where('type', '==', 'short'));
      const snap = await getDocs(q);
      let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
      
      if (items.length === 0) {
        items = MOCK_SHORTS;
      } else {
        // Sort items by createdAt if present
        items.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
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

      // Fetch user's individual likes lazily on scroll to optimize Firestore reads

    } catch (err) {
      console.error("Error loading sport shorts:", err);
      // Fallback
      setShorts(MOCK_SHORTS as unknown as SportsContent[]);
      
      const initialLikes: typeof likesState = {};
      MOCK_SHORTS.forEach(item => {
        initialLikes[item.id] = {
          liked: false,
          count: item.likes || 0
        };
      });
      setLikesState(initialLikes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShorts();
  }, [user?.uid]);

  // Lazy-load like status for the active and adjacent shorts to optimize Firestore reads
  const fetchedLikesRef = useRef<Set<string>>(new Set());
  const prevUserUidRef = useRef<string | undefined>(user?.uid);

  useEffect(() => {
    if (prevUserUidRef.current !== user?.uid) {
      fetchedLikesRef.current.clear();
      prevUserUidRef.current = user?.uid;
    }

    if (!user || shorts.length === 0) return;

    const indicesToFetch = [currentIndex, currentIndex + 1, currentIndex - 1].filter(
      idx => idx >= 0 && idx < shorts.length
    );

    indicesToFetch.forEach(async (idx) => {
      const item = shorts[idx];
      if (!item || fetchedLikesRef.current.has(item.id)) return;
      
      fetchedLikesRef.current.add(item.id);
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
  }, [currentIndex, shorts, user?.uid]);

  // Detect mobile viewports
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamically load Cloudflare Stream player SDK for completely robust player integrations
  useEffect(() => {
    if (!(window as any).Stream) {
      const script = document.createElement('script');
      script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      script.async = true;
      document.body.appendChild(script);
    }
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

          // Seed fallback dynamic like values
          const newLikes: typeof commentLikes = {};
          defaultComments.forEach((c, idx) => {
            newLikes[c.id] = { liked: false, count: Math.floor((idx + 3) * 7.4) % 12 + 1 };
          });
          setCommentLikes(prev => ({ ...prev, ...newLikes }));
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

          // Seed Firestore comments dynamic like values
          const newLikes: typeof commentLikes = {};
          formatted.forEach((c, idx) => {
            newLikes[c.id] = { liked: false, count: Math.floor((idx + c.text.length) % 19) };
          });
          setCommentLikes(prev => ({ ...prev, ...newLikes }));
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

  // Handle current video play/pause and mute/unmute state based on active short index
  useEffect(() => {
    if (shorts.length === 0) return;

    // Direct video element playback check
    Object.keys(videoRefs.current).forEach((key) => {
      const idx = parseInt(key, 10);
      const video = videoRefs.current[idx];
      if (video) {
        if (idx === currentIndex) {
          video.muted = isMuted;
          if (isPlaying) {
            video.play().catch(e => {
              console.log("Video auto play prevented:", e);
              // If browser blocked autoplay, show manual play button overlay by updating state!
              setIsPlaying(false);
            });
          } else {
            video.pause();
          }
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    // YouTube & Cloudflare Iframe element playback and mute status synchronization
    Object.keys(iframeRefs.current).forEach((key) => {
      const idx = parseInt(key, 10);
      const iframe = iframeRefs.current[idx];
      if (iframe && iframe.contentWindow) {
        try {
          const src = iframe.getAttribute('src') || '';
          const isYouTube = src.includes('youtube.com');
          const isCloudflare = src.includes('cloudflarestream.com');

          if (idx === currentIndex) {
            if (isYouTube) {
              if (isPlaying) {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*');
              } else {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
              }
              // Control volume/mute
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: '' }), '*');
            } else if (isCloudflare) {
              let player = cloudflarePlayers.current[idx];
              if (!player && (window as any).Stream) {
                try {
                  player = (window as any).Stream(iframe);
                  cloudflarePlayers.current[idx] = player;
                } catch (e) {
                  console.warn("Failed to initialize Cloudflare Stream wrapper:", e);
                }
              }

              // Send direct postMessages immediately for instant speed
              try {
                if (isPlaying) {
                  iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
                } else {
                  iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
                }
                iframe.contentWindow.postMessage(JSON.stringify({ method: 'muted', value: isMuted }), '*');
                if (!isMuted) {
                  iframe.contentWindow.postMessage(JSON.stringify({ method: 'volume', value: 1.0 }), '*');
                }
              } catch (err) {
                console.warn("Error posting directly to Cloudflare iframe:", err);
              }

              if (player) {
                try {
                  if (isPlaying) {
                    player.play();
                  } else {
                    player.pause();
                  }
                  player.muted = isMuted;
                  if (!isMuted) {
                    player.volume = 1.0;
                  }
                } catch (err) {
                  console.warn("Error calling Cloudflare SDK play/pause:", err);
                }
              }
            }
          } else {
            if (isYouTube) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
            } else if (isCloudflare) {
              try {
                iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
              } catch (err) {}
              const player = cloudflarePlayers.current[idx];
              if (player) {
                try {
                  player.pause();
                } catch (e) {
                  // silent catch
                }
              }
            }
          }
        } catch (e) {
          console.warn("Error calling iframe postMessage:", e);
        }
      }
    });

    // Increase view count in firestore asynchronously
    if (activeShort) {
      updateDoc(doc(db, 'content', activeShort.id), {
        viewCount: increment(1)
      }).catch(err => console.log('Silent view count error:', err));
    }

    return () => {
      Object.keys(videoRefs.current).forEach((key) => {
        const idx = parseInt(key, 10);
        const video = videoRefs.current[idx];
        if (video) {
          try {
            video.pause();
          } catch (e) {
            // silent catch
          }
        }
      });
    };
  }, [currentIndex, isPlaying, isMuted, shorts]);

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
    setCommentLikes(prev => ({
      ...prev,
      [optId]: { liked: false, count: 0 }
    }));
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
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white py-0 md:py-10 px-0 md:px-4 flex items-center justify-center select-none overflow-hidden pb-0 md:pb-10 relative">
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
          className="relative aspect-[9/16] w-full max-w-[420px] h-[calc(100vh-8.5rem)] md:h-[82vh] bg-neutral-900 rounded-none md:rounded-none overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group"
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
                const youtubeId = getYouTubeId(short.videoUrl);
                const cloudflareIframeUrl = getCloudflareStreamIframeUrl(short.videoUrl);
                const gdriveId = getGoogleDriveId(short.videoUrl);
                const transformedVideoUrl = transformGDriveUrl(short.videoUrl, 'video');
                const transformedPosterUrl = (short.thumbnailUrl && short.thumbnailUrl.trim() !== '') 
                  ? transformGDriveUrl(short.thumbnailUrl, 'image') 
                  : getVideoAutoThumbnail(short.videoUrl || '', short.category);
                
                const hasLoadError = videoErrors[short.id];
                
                return (
                  <div 
                    key={short.id} 
                    className="w-full h-full snap-start snap-always relative flex-shrink-0 flex items-center justify-center bg-black overflow-hidden"
                  >
                    {isCurrent ? (
                      youtubeId ? (
                        <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                          <iframe
                            ref={(el) => { iframeRefs.current[idx] = el; }}
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&origin=${window.location.origin}`}
                            className={`${short.cropCenter !== false ? 'w-[316.05%] h-full max-w-none absolute left-1/2 -translate-x-1/2' : 'w-full h-full absolute inset-0'} border-0 select-none pointer-events-none`}
                            allow="autoplay; encrypted-media; picture-in-picture"
                          />
                          {/* Overlay to intercept click and allow interactive play/pause */}
                          <div 
                            className="absolute inset-0 cursor-pointer z-10"
                            onClick={() => setIsPlaying(prev => !prev)}
                          />
                        </div>
                      ) : cloudflareIframeUrl ? (
                        <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                          <iframe
                            ref={(el) => { iframeRefs.current[idx] = el; }}
                            src={sanitizeVideoUrlOrIframe(`${cloudflareIframeUrl}${cloudflareIframeUrl.includes('?') ? '&' : '?'}autoplay=${isPlaying ? 'true' : 'false'}&muted=${isMuted ? 'true' : 'false'}&loop=true&controls=false&api=true`)}
                            className={`${short.cropCenter !== false ? 'w-[316.05%] h-full max-w-none absolute left-1/2 -translate-x-1/2' : 'w-full h-full absolute inset-0'} border-0 select-none pointer-events-none scale-[1.01]`}
                            allow="autoplay; encrypted-media; picture-in-picture"
                          />
                          {/* Overlay to intercept click and allow interactive play/pause */}
                          <div 
                            className="absolute inset-0 cursor-pointer z-10"
                            onClick={() => setIsPlaying(prev => !prev)}
                          />
                        </div>
                      ) : hasLoadError ? (
                        <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center bg-neutral-950 space-y-4">
                          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                            <X className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-sans font-bold text-sm text-white">Stream Loading Offline</h4>
                            <p className="text-white/40 text-[10px] leading-relaxed max-w-[280px] mt-1.5 uppercase tracking-wide">
                              Blocked by CORS/provider limits. Open directly to play or upload a direct stream link.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 w-full max-w-[200px]">
                            <a
                              href={short.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 bg-brand hover:bg-brand/90 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer text-center"
                            >
                              Open Video Link
                            </a>
                            <button
                              onClick={() => {
                                setVideoErrors(prev => ({ ...prev, [short.id]: false }));
                                setIsPlaying(true);
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                            >
                              Retry Stream
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Vertical Video Element - rendered only for active short to prevent parallel media request spamming */
                        <video
                          ref={(el) => { 
                            videoRefs.current[idx] = el; 
                            if (el) {
                              el.muted = isMuted;
                              if (isPlaying && el.paused) {
                                el.play().catch(e => {
                                  console.log("Ref active play prevented:", e);
                                  setIsPlaying(false);
                                });
                              }
                            }
                          }}
                          src={transformedVideoUrl}
                          poster={transformedPosterUrl}
                          muted={isMuted}
                          autoPlay={isPlaying}
                          preload="auto"
                          loop={true}
                          playsInline
                          onClick={() => setIsPlaying(prev => !prev)}
                          onError={() => {
                            console.warn("Video stream failed to load:", short.videoUrl);
                            setVideoErrors(prev => ({ ...prev, [short.id]: true }));
                          }}
                          onCanPlay={(e) => {
                            if (isPlaying && e.currentTarget.paused) {
                              e.currentTarget.play().catch(err => {
                                console.log("video element onCanPlay play prevented:", err);
                                setIsPlaying(false);
                              });
                            }
                          }}
                          onLoadedData={(e) => {
                            if (isPlaying && e.currentTarget.paused) {
                              e.currentTarget.play().catch(err => {
                                console.log("video element onLoadedData play prevented:", err);
                                setIsPlaying(false);
                              });
                            }
                          }}
                          onEnded={() => {
                            handleNext();
                          }}
                          className="w-full h-full cursor-pointer bg-neutral-950 object-cover object-center scale-100"
                        />
                      )
                    ) : (
                      /* High-Quality Poster Image with Blur and Play icon for beautiful landscape transition list-loading */
                      <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
                        <img 
                          src={transformedPosterUrl} 
                          alt={short.title} 
                          className="w-full h-full object-cover object-center select-none opacity-85 blur-sm scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 transition-all cursor-pointer">
                            <Play className="w-6 h-6 fill-white text-white ml-0.5 opacity-80" />
                          </div>
                        </div>
                      </div>
                    )}

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-stretch md:justify-end"
          >
            {/* Click backdrop to exit */}
            <div className="absolute inset-0" onClick={() => setIsCommentsOpen(false)} />
 
            <motion.div 
              initial={isMobile ? { y: '100%', x: 0 } : { x: '100%', y: 0 }}
              animate={isMobile ? { y: 0, x: 0 } : { x: 0, y: 0 }}
              exit={isMobile ? { y: '100%', x: 0 } : { x: '100%', y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full md:max-w-md h-[80vh] md:h-full bg-[#121212] border-t md:border-t-0 md:border-l border-white/10 flex flex-col shadow-2xl z-10 rounded-t-[24px] md:rounded-none overflow-hidden"
            >
              {/* Grab handle for bottom sheet on mobile */}
              <div className="md:hidden flex justify-center py-3 bg-[#121212] cursor-pointer" onClick={() => setIsCommentsOpen(false)}>
                <div className="w-9 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 pt-1 md:pt-4 border-b border-white/10 bg-[#121212]">
                <div className="text-left">
                  <h4 className="font-sans font-extrabold text-[13px] tracking-wide text-white flex items-center gap-1.5">
                    <span>Comments</span>
                    <span className="text-[11px] font-medium text-white/50">({comments.length})</span>
                    {commentsLoading && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />}
                  </h4>
                </div>
                <button 
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
 
              {/* Feed of comments */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#121212]">
                {comments.length > 0 ? (
                  comments.map((comm) => {
                    const cleanUsername = comm.user.toLowerCase().replace(/\s+/g, '_');
                    const isLiked = commentLikes[comm.id]?.liked || false;
                    const countLikes = commentLikes[comm.id]?.count || 0;
                    
                    return (
                      <div key={comm.id} className="bg-white/[0.03] border border-white/[0.04] p-4.5 rounded-[20px] transition-all duration-150 hover:bg-white/[0.06] hover:border-brand/20 flex items-start gap-3">
                        {/* Avatar Column */}
                        <div className="relative group flex-shrink-0 cursor-pointer">
                          <div className="absolute -inset-[1px] bg-gradient-to-tr from-[#ff3366] to-[#ff9900] rounded-full opacity-90" />
                          <img 
                            src={getCommentAvatar(comm.user)} 
                            alt={comm.user} 
                            referrerPolicy="no-referrer"
                            className="relative w-9 h-9 rounded-full object-cover border-[1.5px] border-black bg-zinc-800" 
                          />
                        </div>

                        {/* Comment Content Column */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center flex-wrap gap-1.5 text-xs text-white">
                            <span className="font-extrabold text-white text-[12px] hover:underline cursor-pointer">
                              @{cleanUsername}
                            </span>
                            <span className="text-white/40 text-[10px]">• {comm.time}</span>
                            {comm.user === 'David' && (
                              <span className="text-[8px] font-black text-black bg-[#00ffcc] px-1.5 py-0.5 rounded uppercase select-none font-mono">
                                Author
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-zinc-100 mt-1 leading-relaxed break-all select-text pr-1 font-medium font-sans">
                            {comm.text}
                          </p>

                          {/* Controls (Reply & Like detail) */}
                          <div className="flex items-center gap-4 mt-2.5 text-[10px] font-black uppercase tracking-widest select-none text-white/50">
                            <button 
                              type="button" 
                              onClick={() => handleReplyClick(comm.user)}
                              className="hover:text-brand transition-colors cursor-pointer"
                            >
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCommentLike(comm.id)}
                              className="hover:text-red-400 transition-colors cursor-pointer"
                            >
                              {isLiked ? 'Liked' : 'Like'}
                            </button>
                          </div>
                        </div>

                        {/* Like interaction side panel */}
                        <div className="flex flex-col items-center justify-center pl-1 min-w-[30px] self-start mt-1">
                          <button 
                            type="button"
                            onClick={() => handleToggleCommentLike(comm.id)}
                            className="text-white/40 hover:text-red-500 hover:scale-110 active:scale-90 transition-all p-0.5"
                          >
                            <Heart 
                              className={`w-3.5 h-3.5 transition-colors ${
                                isLiked ? 'fill-red-500 text-red-500' : 'text-white/40'
                              }`} 
                            />
                          </button>
                          {countLikes > 0 && (
                            <span className="text-[10px] text-zinc-400 font-extrabold font-mono mt-0.5">
                              {countLikes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-24 text-white/40">
                    <MessageCircle className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs uppercase tracking-wider font-extrabold">No comments yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              {/* Bottom Quick-Reaction Emoji Row (Instagram style) */}
              <div className="flex items-center justify-around px-4 py-2.5 bg-[#16161c] border-t border-white/5 select-none z-10 w-full shrink-0">
                {['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewComment(prev => prev + emoji);
                      setTimeout(() => {
                        inputRef.current?.focus();
                      }, 40);
                    }}
                    className="text-xl hover:scale-125 transition-transform duration-200 active:scale-95 focus:outline-none py-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
 
              {/* Comment Input pill and current user Avatar */}
              <div className="p-4 border-t border-white/10 bg-[#16161c] shrink-0 pb-10 md:pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] z-20">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc] mb-2 px-1 flex justify-between items-center select-none font-sans">
                  <span>Write a response</span>
                  <span className="opacity-40 text-white font-sans text-[9px] font-normal lowercase">Press enter to post</span>
                </div>
                
                <form onSubmit={handlePostComment} className="flex items-center gap-3">
                  {/* Current User Avatar */}
                  <img 
                    src={user ? getCommentAvatar(user.displayName || user.email || 'guest') : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt="My profile" 
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border-2 border-brand/40 bg-zinc-800 flex-shrink-0" 
                  />

                  {/* High contrast, prominent comment input field */}
                  <div className="flex-1 bg-zinc-950 border-2 border-white/20 focus-within:border-brand rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 overflow-hidden shadow-inner transition-all duration-200">
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Share your thoughts about this clip..."
                      className="flex-1 bg-transparent border-none outline-none focus:outline-none text-[13px] tracking-wide text-white placeholder-white/50 p-0 focus:ring-0 w-full font-medium"
                    />
                    
                    {/* GIF Trigger Badge (Instagram aesthetic) */}
                    <span className="text-[9px] font-black tracking-widest text-[#00ffcc] border border-[#00ffcc]/30 rounded px-1.5 py-0.5 select-none cursor-pointer hover:bg-[#00ffcc]/10 transition-colors shrink-0 font-mono">
                      GIF
                    </span>
                  </div>

                  {/* Send Button */}
                  <button 
                    type="submit" 
                    disabled={!newComment.trim()}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                      newComment.trim() 
                        ? 'bg-brand text-white scale-100 hover:opacity-95 hover:scale-105 active:scale-95 shadow-lg shadow-brand/20' 
                        : 'bg-white/5 text-white/20 cursor-not-allowed scale-90'
                    }`}
                    title="Send comment"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              </div>
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
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
