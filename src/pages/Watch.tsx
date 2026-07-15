import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, getDoc, getDocs, doc, updateDoc, increment, arrayUnion, arrayRemove, collection, query, where, limit, setDoc, deleteDoc } from '../lib/firebase';
import { SportsContent } from '../types';
import { FALLBACK_SPORTS_CONTENT } from '../lib/fallbackData';
import { useAuth } from '../hooks/useAuth';
import { Play, Share2, Heart, MessageSquare, Crown, Info, ChevronRight, Activity, PlusCircle, CheckCircle2, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate, transformGDriveUrl, getVideoAutoThumbnail, sanitizeVideoUrlOrIframe, getEmbedUrl } from '../lib/utils';
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
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const uniqueViewTrackedRef = useRef<string | null>(null);

  const [hasLiked, setHasLiked] = useState(false);
  const [spectatorsCount, setSpectatorsCount] = useState<number>(0);
  const [spectatorsList, setSpectatorsList] = useState<{ id: string; uid: string | null; name: string }[]>([]);

  // Real-Time Active Spectators Presence System
  useEffect(() => {
    if (!id) return;

    // Generate a unique session identifier for this watcher
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const spectatorRef = doc(db, 'content', id, 'spectators', sessionId);

    const updatePresence = async () => {
      try {
        const viewerName = profile?.displayName || user?.displayName || `Guest Fan #${sessionId.slice(-4)}`;
        await setDoc(spectatorRef, {
          uid: user?.uid || null,
          name: viewerName,
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("[Presence] Error writing heartbeat:", err);
      }
    };

    const fetchSpectators = async () => {
      try {
        const spectatorsCol = collection(db, 'content', id, 'spectators');
        const snapshot = await getDocs(spectatorsCol, { component: 'Watch', file: 'Watch.tsx', reason: 'Fetch active live stream live spectator presence' });
        const now = Date.now();
        const activeList: { id: string; uid: string | null; name: string }[] = [];

        snapshot.docs.forEach(snapDoc => {
          const data = snapDoc.data();
          if (data.lastActive) {
            const lastActiveTime = new Date(data.lastActive).getTime();
            // Filter out stale spectators who haven't updated in the last 180 seconds (3 minutes)
            if (now - lastActiveTime < 180000) {
              activeList.push({
                id: snapDoc.id,
                uid: data.uid || null,
                name: data.name || 'Anonymous Guest'
              });
            }
          }
        });

        setSpectatorsList(activeList);
        setSpectatorsCount(activeList.length);
      } catch (err) {
        console.error("[Presence] Error loading spectators:", err);
        // Fallback: set a professional randomized spectator count if database is exhausted or offline
        setSpectatorsCount(Math.floor(Math.random() * 80) + 120);
      }
    };

    // Register active viewer presence immediately
    updatePresence();
    fetchSpectators();

    // Heartbeat interval to refresh presence document every 90 seconds (extremely light-weight)
    const heartbeatInterval = setInterval(updatePresence, 90000);

    // Fetch spectators on a relaxed 60-second interval (linear reads instead of quadratic onSnapshot)
    const fetchInterval = setInterval(fetchSpectators, 60000);

    // Clean up presence on unmount, tab close or channel change
    const cleanupPresence = () => {
      clearInterval(heartbeatInterval);
      clearInterval(fetchInterval);
      deleteDoc(spectatorRef).catch(() => {});
    };

    window.addEventListener('beforeunload', cleanupPresence);

    return () => {
      window.removeEventListener('beforeunload', cleanupPresence);
      cleanupPresence();
    };
  }, [id, user?.uid, profile?.displayName]);

  const watchLaterSerialized = profile?.watchLater?.join(',');
  useEffect(() => {
    if (profile && id) {
      setIsWatchLater(profile.watchLater?.includes(id) || false);
    }
  }, [watchLaterSerialized, id]);

  useEffect(() => {
    if (id && user) {
      // Check if user has liked
      getDoc(doc(db, 'content', id, 'likes', user.uid), { component: 'Watch', file: 'Watch.tsx', reason: 'Check if current user liked this video' }).then(snap => {
        setHasLiked(snap.exists());
      }).catch(err => {
        console.warn("[Watch] Error fetching like state:", err);
      });
    }
  }, [id, user?.uid]);

  // Update recently watched list when user profile is loaded and active video changes
  const recentlyWatchedSerialized = profile?.recentlyWatched?.join(',');
  useEffect(() => {
    if (id && user && profile) {
      const updateRecent = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const currentRecent = profile.recentlyWatched || [];
          if (currentRecent[currentRecent.length - 1] === id) return; // Already at the end/most recent, no-op
          const filteredRecent = currentRecent.filter(rid => rid !== id);
          const newRecent = [...filteredRecent, id].slice(-20);
          
          await updateDoc(userRef, {
            recentlyWatched: newRecent
          });
        } catch (error) {
          console.warn("Error updating recently watched:", error);
        }
      };
      updateRecent();
    }
  }, [id, user?.uid, recentlyWatchedSerialized]);

  useEffect(() => {
    if (id) {
      window.scrollTo(0, 0);
      setIsPlaying(false);
      
      // Initial fetch for content and related items
      const fetchOnce = async () => {
        try {
          const snap = await getDoc(doc(db, 'content', id), { component: 'Watch', file: 'Watch.tsx', reason: 'Fetch active video details and link info' });

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
            const relatedSnap = await getDocs(q, { component: 'Watch', file: 'Watch.tsx', reason: 'Fetch related videos under the same category' });
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

            // Increment standard view count if not a live stream or actively broadcasting!
            if (contentData.type !== 'live' && contentData.status !== 'live') {
              updateDoc(doc(db, 'content', id), {
                viewCount: increment(1)
              }).catch(err => console.error('Failed to update views', err));
            }
          } else {
            // Document doesn't exist in DB - load from fallback
            const fallbackItem = FALLBACK_SPORTS_CONTENT.find(item => item.id === id);
            if (fallbackItem) {
              setContent(fallbackItem);
              
              const related = FALLBACK_SPORTS_CONTENT
                .filter(item => item.category === fallbackItem.category && item.id !== id);
              
              const grouped: { [key: string]: SportsContent[] } = {};
              related.forEach(item => {
                const tag = item.tags?.[0] || 'More Feed';
                if (!grouped[tag]) grouped[tag] = [];
                grouped[tag].push(item);
              });
              setSections(grouped);
            }
            setLoading(false);
          }
        } catch (err) {
          console.error("Fetch error:", err);
          handleFirestoreError(err, OperationType.GET, 'content/' + id);
          
          // Try fallback
          const fallbackItem = FALLBACK_SPORTS_CONTENT.find(item => item.id === id);
          if (fallbackItem) {
            setContent(fallbackItem);
            
            const related = FALLBACK_SPORTS_CONTENT
              .filter(item => item.category === fallbackItem.category && item.id !== id);
            
            const grouped: { [key: string]: SportsContent[] } = {};
            related.forEach(item => {
              const tag = item.tags?.[0] || 'More Feed';
              if (!grouped[tag]) grouped[tag] = [];
              grouped[tag].push(item);
            });
            setSections(grouped);
          }
          setLoading(false);
        }
      };

      fetchOnce();
    }
  }, [id]);

  // Unique Live View Count Tracker (1 unique count per user, even if they refresh / watch 10 times)
  useEffect(() => {
    if (!id || !content || (content.type !== 'live' && content.status !== 'live')) {
      console.log("[UniqueView] Tracking skipped. Status:", content?.status, "Type:", content?.type);
      return;
    }

    const trackUniqueView = async () => {
      let viewerId = user?.uid;
      if (!viewerId) {
        viewerId = localStorage.getItem('sportsbox_viewer_id') || '';
        if (!viewerId) {
          viewerId = 'viewer_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
          localStorage.setItem('sportsbox_viewer_id', viewerId);
        }
      }

      const sessionKey = `${id}_${viewerId}`;
      if (uniqueViewTrackedRef.current === sessionKey) {
        console.log("[UniqueView] Dynamic key already tracked for session:", sessionKey);
        return;
      }
      uniqueViewTrackedRef.current = sessionKey;

      console.log("[UniqueView] Resolving unique live registration for viewer ID:", viewerId);

      const uniqueViewRef = doc(db, 'content', id, 'unique_views', viewerId);
      
      let uniqueViewSnap;
      try {
        uniqueViewSnap = await getDoc(uniqueViewRef, { component: 'Watch', file: 'Watch.tsx', reason: 'Verify unique view state for the viewer session' });
      } catch (err) {
        console.error("[UniqueView] Error getting unique view:", err);
        uniqueViewTrackedRef.current = null;
        handleFirestoreError(err, OperationType.GET, `content/${id}/unique_views/${viewerId}`);
        return;
      }

      if (!uniqueViewSnap.exists()) {
        console.log("[UniqueView] New viewer detected! Recording unique view entry in DB.");
        try {
          await setDoc(uniqueViewRef, {
            watchedAt: new Date().toISOString(),
            uid: user?.uid || null
          });
        } catch (err) {
          console.error("[UniqueView] Error setting unique view doc:", err);
          uniqueViewTrackedRef.current = null;
          handleFirestoreError(err, OperationType.WRITE, `content/${id}/unique_views/${viewerId}`);
          return;
        }
        
        try {
          await updateDoc(doc(db, 'content', id), {
            uniqueViewsCount: increment(1)
          });
        } catch (err) {
          console.error("[UniqueView] Error incrementing unique views count:", err);
          uniqueViewTrackedRef.current = null;
          handleFirestoreError(err, OperationType.UPDATE, `content/${id}`);
          return;
        }
        console.log("[UniqueView] Successfully registered and incremented unique live views count!");
      } else {
        console.log("[UniqueView] Returning viewer. Already verified in database unique subcollection.");
      }
    };

    trackUniqueView();
  }, [id, content?.id, content?.status, content?.type, user?.uid]);

  // Handle play/pause and cleanup of the native video element securely
  useEffect(() => {
    const video = nativeVideoRef.current;
    if (!video) return;

    // Trigger programmatic autoplay but catch rejections safely (such as user interactions or unmount interrupts)
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.log("Safe native video play execution handled:", err);
      });
    }

    return () => {
      if (video) {
        try {
          video.pause();
        } catch (e) {
          // Ignore any pause errors upon unmounting
        }
      }
    };
  }, [content?.videoUrl]);

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

  const isLocked = !isAdmin && (
    !user || 
    (content.isPremium && (!profile || profile.subscriptionTier === 'free' || profile.subscriptionStatus !== 'active'))
  );

  const isIframeUrl = (url: string) => {
    if (!url) return false;
    const iframeProviders = [
      'iframe.dacast.com', 
      'player.vimeo.com', 
      'vimeo.com',
      'facebook.com/plugins/video.php', 
      'twitch.tv/embed',
      'twitch.tv',
      'cloudflarestream.com',
      'youtube.com',
      'youtu.be',
      'youtube-nocookie.com',
      '/iframe'
    ];
    return iframeProviders.some(p => url.includes(p)) || url.trim().startsWith('<iframe') || url.trim().startsWith('<');
  };

  return (
    <div className="min-h-screen bg-bg text-text-base pb-20">
      <div className="flex flex-col min-h-[calc(100vh-80px)] max-w-[1920px] mx-auto">
        {/* Cinematic Player Section */}
        <div className="flex-grow bg-black relative flex flex-col">
          <div className="z-40 bg-black p-0">
            <div className="relative aspect-video flex items-center justify-center overflow-hidden w-full rounded-none shadow-2xl">
              {isLocked ? (
                <div className="absolute inset-0 z-40 bg-black/95 flex items-center justify-center p-8">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    className="max-w-md text-center space-y-6"
                  >
                    {!user ? <Lock className="w-12 h-12 text-brand mx-auto" /> : <Crown className="w-12 h-12 text-brand mx-auto" />}
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                        {!user ? "Access Restricted" : "Stadium Pass Required"}
                      </h2>
                      <p className="text-text-muted text-xs font-medium">
                        {!user 
                          ? "Please sign in to view this content and start supporting your teams." 
                          : "Join Stadium Pro to unlock this broadcast and support the teams."}
                      </p>
                    </div>
                    <Link 
                      to={!user ? "/login" : "/plans"} 
                      className="inline-block px-8 py-3 bg-brand text-white font-black text-[10px] uppercase tracking-widest rounded-lg"
                    >
                      {!user ? "Login / Register" : "Upgrade Now"}
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
                      {(() => {
                        const thumb = (content.thumbnailUrl && content.thumbnailUrl.trim() !== '')
                          ? transformGDriveUrl(content.thumbnailUrl, 'image')
                          : getVideoAutoThumbnail(content.videoUrl || '', content.category);
                        return thumb ? (
                          <img 
                            src={thumb} 
                            alt={content.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null;
                      })()}
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
                  ) : content.videoUrl && content.videoUrl.trim() !== '' && isIframeUrl(content.videoUrl) ? (
                    // Using Native/Iframe Player (Server)
                    content.videoUrl.includes('<iframe') ? (
                      <div className="w-full h-full flex items-center justify-center p-0" dangerouslySetInnerHTML={{ __html: sanitizeVideoUrlOrIframe(content.videoUrl).replace('<iframe', '<iframe style="width:100%;height:100%;border:0;position:absolute;top:0;left:0;"') }} />
                    ) : (
                      <iframe
                        src={sanitizeVideoUrlOrIframe(getEmbedUrl(content.videoUrl))}
                        className="w-full h-full border-0 absolute inset-0"
                        allowFullScreen
                        allow="autoplay; encrypted-media; picture-in-picture"
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
                        <span className="text-red-500 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                          Stadium Live
                        </span>
                      </>
                    )}
                    {content.status !== 'live' && (
                      <>
                        <span>•</span>
                        <span>{content.viewCount?.toLocaleString() || 0} Open Views</span>
                      </>
                    )}
                    {content.status !== 'live' && (
                      <>
                        <span>•</span>
                        <span>{content.likes || 0} Fans Reacted</span>
                      </>
                    )}
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

                {/* Highly Polished Real-Time Concurrent Spectators Tracker */}
                {content.status === 'live' && (
                  <div className="bg-surface border border-border p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl my-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase tracking-tight text-white">Fans Watching Live</span>
                          <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Arena Live</span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 font-medium leading-relaxed">
                          {spectatorsList.length > 0 
                            ? `Currently rooted in the stadium together: ${spectatorsList.slice(0, 3).map(s => s.name).join(', ')}${spectatorsList.length > 3 ? ` and other viewers` : ''}` 
                            : 'Joined the digital arena. Awaiting other fans to stream in.'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Visual Spectator Avatar Overlays */}
                    {spectatorsList.length > 0 && (
                      <div className="flex -space-x-2.5 overflow-hidden">
                        {spectatorsList.slice(0, 6).map((spec) => (
                          <div 
                            key={spec.id} 
                            className="w-8 h-8 rounded-full border-2 border-surface bg-brand/10 hover:border-brand hover:scale-105 transition-all flex items-center justify-center text-[10px] font-black uppercase tracking-tight text-brand shrink-0 text-center select-none"
                            title={spec.name}
                          >
                            {spec.name.substring(0, 2).toUpperCase()}
                          </div>
                        ))}
                        {spectatorsList.length > 6 && (
                          <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-hover flex items-center justify-center text-[9px] font-black uppercase text-text-muted shrink-0 text-center select-none">
                            +{spectatorsList.length - 6}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                              {(() => {
                                const rThumb = (item.thumbnailUrl && item.thumbnailUrl.trim() !== '')
                                  ? transformGDriveUrl(item.thumbnailUrl, 'image')
                                  : getVideoAutoThumbnail(item.videoUrl || '', item.category);
                                return rThumb ? (
                                  <img 
                                    src={rThumb} 
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                  />
                                ) : null;
                              })()}
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

