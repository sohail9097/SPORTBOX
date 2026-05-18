import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, collection, query, where, limit, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { SportsContent, PlayerSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Play, Share2, Heart, MessageSquare, Crown, Info, ChevronRight, Activity, PlusCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate, transformGDriveUrl } from '../lib/utils';
import StadiumPlayer from '../components/StadiumPlayer';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

import LoadingScreen from '../components/LoadingScreen';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const { profile, isAdmin, loading: authLoading, user } = useAuth();
  const [content, setContent] = useState<SportsContent | null>(null);
  const [sections, setSections] = useState<{ [key: string]: SportsContent[] }>({});
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [playerConfig, setPlayerConfig] = useState<PlayerSettings | null>(null);

  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    if (profile && id) {
      setIsWatchLater(profile.watchLater?.includes(id) || false);
    }
  }, [profile, id]);

  useEffect(() => {
    if (id && user) {
      // Check if user has liked
      getDoc(doc(db, 'content', id, 'likes', user.uid)).then(snap => {
        setHasLiked(snap.exists());
      });
    }
  }, [id, user]);

  useEffect(() => {
    if (id && user) {
      // Update recently watched list
      const updateRecent = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          // To move to front in our reverse logic, we remove then add to the end
          const currentRecent = profile?.recentlyWatched || [];
          const filteredRecent = currentRecent.filter(rid => rid !== id);
          const newRecent = [...filteredRecent, id].slice(-20); // Keep last 20
          
          await updateDoc(userRef, {
            recentlyWatched: newRecent
          });
        } catch (error) {
          console.error("Error updating recently watched:", error);
        }
      };
      updateRecent();
    }
    
    if (id) {
      window.scrollTo(0, 0);
      setIsPlaying(false);
      
      // Initial fetch for content and related items
      const fetchOnce = async () => {
        try {
          const snap = await getDoc(doc(db, 'content', id));
          if (snap.exists()) {
            const contentData = { id: snap.id, ...snap.data() } as SportsContent;
            setContent(contentData);
            setLoading(false);
            
            // Related content depends on category
            const q = query(
              collection(db, 'content'),
              where('category', '==', contentData.category),
              limit(12)
            );
            const relatedSnap = await getDocs(q);
            const related = relatedSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as SportsContent))
              .filter(item => item.id !== id);
            
            const grouped: { [key: string]: SportsContent[] } = {};
            related.forEach(item => {
              const tag = item.tags?.[0] || 'More Feed';
              if (!grouped[tag]) grouped[tag] = [];
              grouped[tag].push(item);
            });
            setSections(grouped);
          }
        } catch (err) {
          console.error("Fetch error:", err);
          setLoading(false);
        }
      };

      fetchOnce();
      
      // Live metadata updates only (doesn't trigger related fetch again)
      const unsubContent = onSnapshot(doc(db, 'content', id), (snap) => {
        if (snap.exists()) {
          setContent({ id: snap.id, ...snap.data() } as SportsContent);
        }
      });

      const unsubPlayer = onSnapshot(doc(db, 'settings', 'playerConfig'), (snap) => {
        if (snap.exists()) setPlayerConfig(snap.data() as PlayerSettings);
      });

      // Increment view count
      updateDoc(doc(db, 'content', id), {
        viewCount: increment(1)
      }).catch(err => console.error('Failed to update views', err));

      return () => {
        unsubContent();
        unsubPlayer();
      };
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

  const handleLike = async () => {
    if (!id || !user) return;
    try {
      const contentRef = doc(db, 'content', id);
      const likeRef = doc(db, 'content', id, 'likes', user.uid);
      
      if (hasLiked) {
        // Unlike Logic
        await deleteDoc(likeRef);
        await updateDoc(contentRef, {
          likes: increment(-1)
        });
        setHasLiked(false);
        setContent(prev => prev ? { ...prev, likes: Math.max(0, (prev.likes || 1) - 1) } : null);
      } else {
        // Like Logic
        await setDoc(likeRef, {
          timestamp: new Date().toISOString(),
          displayName: profile?.displayName || user.displayName || 'Anonymous',
          email: user.email
        });

        await updateDoc(contentRef, {
          likes: increment(1)
        });

        setHasLiked(true);
        setContent(prev => prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleShare = async () => {
    if (!content) return;
    const shareData = {
      title: content.title,
      text: `Check out this broadcast on SportsBox: ${content.title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled the share, ignore this error
        return;
      }
      console.error('Error sharing:', error);
    }
  };

  // Removing redundant fetch functions - now using onSnapshot in useEffect

  if (authLoading) return <LoadingScreen />;
  if (loading && !content) return <LoadingScreen />;
  if (!content) return <div className="h-screen flex flex-col items-center justify-center">Content not found. <Link to="/" className="text-brand mt-4">Back Home</Link></div>;

  const isLocked = (!profile || profile.subscriptionTier === 'free') && !isAdmin;

  const isIframeUrl = (url: string) => {
    if (!url) return false;
    const iframeProviders = [
      'iframe.dacast.com', 
      'player.vimeo.com', 
      'facebook.com/plugins/video.php', 
      'twitch.tv/embed',
      'cloudflarestream.com',
      '/iframe'
    ];
    return iframeProviders.some(p => url.includes(p));
  };

  return (
    <div className="min-h-screen bg-bg text-text-base pb-20">
      <div className="flex flex-col min-h-[calc(100vh-80px)] max-w-[1920px] mx-auto">
        {/* Cinematic Player Section */}
        <div className="flex-grow bg-black relative flex flex-col">
          <div className="z-40 bg-black pt-2 md:pt-8 px-3 md:px-12">
            <div className="relative aspect-video flex items-center justify-center overflow-hidden max-w-7xl mx-auto w-full rounded-2xl md:rounded-3xl shadow-2xl">
              {isLocked ? (
                <div className="absolute inset-0 z-40 bg-black/95 flex items-center justify-center p-8">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    className="max-w-md text-center space-y-6"
                  >
                    <Crown className="w-12 h-12 text-brand mx-auto" />
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">Stadium Pass Required</h2>
                      <p className="text-text-muted text-xs font-medium">Join Stadium Pro to unlock this broadcast and support the teams.</p>
                    </div>
                    <Link 
                      to="/plans" 
                      className="inline-block px-8 py-3 bg-brand text-white font-black text-[10px] uppercase tracking-widest rounded-lg"
                    >
                      Upgrade Now
                    </Link>
                  </motion.div>
                </div>
              ) : (
                <div className="absolute inset-0 w-full h-full">
                  {!isPlaying ? (
                    <div 
                      className="absolute inset-0 z-10 cursor-pointer group"
                      onClick={() => setIsPlaying(true)}
                    >
                      {content.thumbnailUrl && content.thumbnailUrl.trim() !== '' && (
                        <img 
                          src={transformGDriveUrl(content.thumbnailUrl, 'image')} 
                          alt={content.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-brand/90 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform duration-500">
                          <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-white ml-1" />
                        </div>
                        <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 text-left">
                          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-brand mb-1">Ready to Broadcast</p>
                          <h3 className="text-lg md:text-3xl font-black uppercase italic tracking-tighter text-white">{content.title}</h3>
                        </div>
                      </div>
                    </div>
                  ) : content.videoUrl && content.videoUrl.trim() !== '' && (isIframeUrl(content.videoUrl) || (playerConfig && !playerConfig.useCustomPlayer)) ? (
                    // Using Native/Iframe Player (Server)
                    content.videoUrl.includes('<iframe') ? (
                      <div className="w-full h-full flex items-center justify-center p-0" dangerouslySetInnerHTML={{ __html: content.videoUrl.replace('<iframe', '<iframe style="width:100%;height:100%;border:0;position:absolute;top:0;left:0;"') }} />
                    ) : isIframeUrl(content.videoUrl) ? (
                      <iframe
                        src={`${content.videoUrl}${content.videoUrl.includes('?') ? '&' : '?'}autoplay=1`}
                        className="w-full h-full border-0 absolute inset-0"
                        allowFullScreen
                        allow="autoplay; encrypted-media; picture-in-picture"
                      />
                    ) : (
                      <video 
                        src={transformGDriveUrl(content.videoUrl, 'video')}
                        autoPlay
                        controls
                        className="w-full h-full bg-black object-contain"
                        poster={content.thumbnailUrl && content.thumbnailUrl.trim() !== '' ? transformGDriveUrl(content.thumbnailUrl, 'image') : undefined}
                      />
                    )
                  ) : content.videoUrl && content.videoUrl.trim() !== '' ? (
                    <StadiumPlayer 
                      url={transformGDriveUrl(content.videoUrl, 'video')} 
                      isLive={content.status === 'live'} 
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface/90">
                      <Play className="w-12 h-12 text-white/10 mb-4" />
                      <p className="text-text-muted font-medium">Video feed offline.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Live Badge */}
              {content.status === 'live' && (
                <div className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Live</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-grow max-w-7xl mx-auto w-full">
            {/* Info Section */}
            <div className="p-4 lg:p-8 space-y-4 mt-2 lg:mt-0">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <h1 className="text-xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight">
                    {content.title}
                  </h1>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-muted">
                    <span className="text-brand">{content.category}</span>
                    {content.status === 'live' && (
                      <>
                        <span>•</span>
                        <span>{content.viewCount?.toLocaleString()} Spectators</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{content.likes || 0} Fans Reacted</span>
                  </div>
                </div>

                {/* Description positioned directly below title metadata */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] md:text-sm text-text-muted/90 leading-relaxed font-medium markdown-body prose prose-invert prose-red max-w-4xl">
                    <ReactMarkdown>{content.description}</ReactMarkdown>
                  </div>
                </div>
                
                <div className="flex gap-4 py-4 border-y border-white/5">
                  <button 
                    onClick={toggleWatchLater}
                    className="flex flex-col items-center justify-center gap-1.5 w-14 h-14 md:w-auto md:h-auto md:px-6 md:py-2.5 transition-all group min-w-[56px] md:min-w-[100px]"
                  >
                    {isWatchLater ? (
                      <CheckCircle2 className="w-5 h-5 text-brand" />
                    ) : (
                      <PlusCircle className="w-5 h-5 text-text-muted group-hover:text-brand transition-colors" />
                    )}
                    <span className={cn("text-[8px] md:text-[9px] font-black uppercase tracking-tight", isWatchLater ? "text-brand" : "text-text-muted")}>
                      {isWatchLater ? 'Saved' : 'Save'}
                    </span>
                  </button>
                  <ActionButton 
                    icon={Heart} 
                    label={hasLiked ? "Liked" : "Like"} 
                    onClick={handleLike} 
                    circle 
                    isActive={hasLiked}
                  />
                  <ActionButton icon={Share2} label="Share" onClick={handleShare} circle />
                </div>
              </div>


              {/* Related/More Content Sections - Horizontal Sliders */}
              <div className="space-y-8 pt-4">
                {Object.entries(sections).map(([title, items]) => (
                  <div key={title} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm md:text-xl font-black uppercase italic tracking-tighter capitalize text-white flex items-center gap-3">
                        <span className="w-1 h-5 bg-brand" />
                        {title}
                      </h3>
                      <Link to="/discover" className="text-[10px] font-bold uppercase tracking-widest text-brand">Explore Series</Link>
                    </div>
                    
                    <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide snap-x">
                      {/* Grid with 2 rows for the slider */}
                      <div className="grid grid-rows-2 grid-flow-col gap-4 md:gap-6 min-w-full">
                        {items.map((item) => (
                          <Link 
                            key={item.id} 
                            to={`/watch/${item.id}`}
                            className="group block space-y-1.5 flex-shrink-0 w-[42vw] md:w-[240px] snap-start"
                          >
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-surface shadow-2xl">
                              {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' && (
                                <img 
                                  src={transformGDriveUrl(item.thumbnailUrl, 'image')} 
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-6 h-6 text-white fill-white" />
                              </div>
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <h4 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-2 group-hover:text-brand transition-colors">
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-white/30 mt-0.5">
                                <span>{item.category}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, circle, isActive }: { icon: any, label: string, onClick?: () => void, circle?: boolean, isActive?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 transition-all group lg:min-w-[100px]",
        circle ? "w-14 h-14 md:w-auto md:h-auto md:px-6 md:py-3 min-w-[56px]" : "px-6 py-3 min-w-[100px]",
        isActive && "text-brand"
      )}
    >
      <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-brand fill-brand" : "text-text-muted group-hover:text-brand")} />
      <span className={cn("text-[8px] md:text-[9px] font-black uppercase tracking-tight", isActive ? "text-brand" : "text-text-muted")}>
        {label}
      </span>
    </button>
  );
}

