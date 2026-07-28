import { useEffect, useState, useMemo } from 'react';
import { SportsContent } from '../types';
import ContentCard from '../components/ContentCard';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Play, Clock, Calendar, ChevronRight, Bell, BellOff, Volume2 } from 'lucide-react';
import { cn, getVideoAutoThumbnail, isTestOrPlaceholderContent } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useFirestoreCache } from '../context/FirestoreContext';
import { db, getDocs, collection, query, where, limit, deleteDoc, doc } from '../lib/firebase';

export default function Live() {
  const { profile, isAdmin } = useAuth();
  const isSubscribed = Boolean(
    isAdmin || (
      profile && (
        profile.subscriptionStatus?.toLowerCase() === 'active' ||
        profile.isSubscribed === true ||
        (profile.subscriptionTier && 
         profile.subscriptionTier.toLowerCase() !== 'none' && 
         profile.subscriptionTier.toLowerCase() !== 'free')
      )
    )
  );

  const { content: cachedContent, loading: cacheLoading } = useFirestoreCache();
  const [dbContent, setDbContent] = useState<SportsContent[] | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [reminders, setReminders] = useState<{ [id: string]: boolean }>({});

  const [bannerMatchData, setBannerMatchData] = useState<SportsContent | null>(null);
  const [bannerImageSrc, setBannerImageSrc] = useState<string>('');

  useEffect(() => {
    setLoadingDb(true);
    const q = query(
      collection(db, 'content'),
      where('type', '==', 'live'),
      limit(30)
    );

    getDocs(q)
      .then((snap) => {
        const items: SportsContent[] = [];
        snap.docs.forEach(d => {
          const item = { id: d.id, ...d.data() } as SportsContent;
          if (isTestOrPlaceholderContent(item)) {
            deleteDoc(doc(db, 'content', d.id)).catch(() => {});
          } else {
            items.push(item);
          }
        });
        setDbContent(items);
      })
      .catch((err) => {
        console.error('[Live] Failed to fetch live content from Firestore:', err);
        setDbContent(null);
      })
      .finally(() => {
        setLoadingDb(false);
      });
  }, []);

  const loading = cacheLoading || loadingDb;

  useEffect(() => {
    // Sync reminders from localStorage
    const saved = localStorage.getItem('sportsbox_match_reminders');
    if (saved) {
      try {
        setReminders(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleReminder = (matchId: string, eventTitle: string) => {
    const updated = { ...reminders, [matchId]: !reminders[matchId] };
    setReminders(updated);
    localStorage.setItem('sportsbox_match_reminders', JSON.stringify(updated));
    
    if (updated[matchId]) {
      toast.success(`Reminder set! We will notify you when "${eventTitle}" starts.`, {
        icon: '🔔',
        style: { background: '#1c1c1e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      });
    } else {
      toast.info(`Reminder cancelled for "${eventTitle}".`, {
        icon: '🔕',
        style: { background: '#1c1c1e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      });
    }
  };

  const content = useMemo(() => {
    const rawItems = dbContent !== null 
      ? dbContent 
      : cachedContent.filter(item => item.type === 'live');
    
    return rawItems
      .filter(item => !isTestOrPlaceholderContent(item))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cachedContent, dbContent]);

  const liveMatches = useMemo(() => {
    return content.filter(item => item.status === 'live');
  }, [content]);

  const upcomingMatches = useMemo(() => {
    return content.filter(item => item.status === 'scheduled');
  }, [content]);

  // Items to feature on the live banner
  // Prefer upcoming matches for the banner to create build-up/hype, as requested.
  // Fallback to currently live matches if there are no upcoming ones.
  const bannerItems = useMemo(() => {
    return upcomingMatches.length > 0 ? upcomingMatches : liveMatches;
  }, [upcomingMatches, liveMatches]);

  useEffect(() => {
    if (bannerItems.length > 0) {
      const match = bannerItems[activeBannerIndex];
      setBannerMatchData(match || null);
      if (match) {
        const src = match.thumbnailUrl && match.thumbnailUrl.trim() !== ''
          ? match.thumbnailUrl
          : getVideoAutoThumbnail(match.videoUrl || '', match.category);
        setBannerImageSrc(src || '');
      }
    } else {
      setBannerMatchData(null);
      setBannerImageSrc('');
    }
  }, [bannerItems, activeBannerIndex]);

  // Auto cycle banner items if there are multiple
  useEffect(() => {
    if (bannerItems.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % bannerItems.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [bannerItems.length]);

  const getInitials = (name: string) => {
    if (!name) return 'VS';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen pb-24 pt-12 bg-bg text-white">
      <div className="max-w-[1600px] mx-auto px-4 space-y-12">
        
        {/* Page Header */}
        <header className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-brand"
          >
            <Radio className="w-4 h-4 animate-pulse text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Stadium Broadcast Feed</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-8xl font-black uppercase italic tracking-tighter leading-none"
          >
            Stadium <span className="text-red-500">Live</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-text-muted text-sm md:text-lg font-medium uppercase tracking-wide"
          >
            Live arenas, instant telemetry, and upcoming high-intensity scheduled bouts.
          </motion.p>
        </header>

        {/* Content Lists */}
        {loading && content.length === 0 ? (
          <div className="space-y-12">
            <div className="space-y-4">
              <div className="w-48 h-6 bg-surface rounded-sm animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={`skeleton-live-${i}`} className="aspect-video bg-surface rounded-sm animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-16">
            
            {/* 1. Live Now Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 bg-red-600 rounded-full animate-bounce shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
                  <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter">
                    Active Streams <span className="text-red-500">Live Now</span>
                  </h2>
                </div>
                <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {liveMatches.length} Feeds
                </span>
              </div>

              {liveMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {liveMatches.map((item, i) => (
                    <ContentCard key={item.id} content={item} index={i} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 glass-card bg-white/[0.01] border-dashed">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <Radio className="w-8 h-8 text-white/20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold uppercase tracking-wider">No active broadcasts</h3>
                    <p className="text-text-muted text-xs max-w-xs mx-auto">No stadiums are currently transmitting live. Explore scheduling below for upcoming high-intensity bouts.</p>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Upcoming Live Matches Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Clock className="w-5 h-5" />
                  <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-white">
                    Upcoming <span className="text-yellow-500">Scheduled Bouts</span>
                  </h2>
                </div>
                <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {upcomingMatches.length} Matches Scheduled
                </span>
              </div>

              {upcomingMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {upcomingMatches.map((item, i) => (
                    <div key={item.id} className="relative group">
                      <ContentCard content={item} index={i} />
                      
                      {/* Interactive fast reminder bar below card */}
                      <div className="absolute top-2.5 right-20 z-20">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleReminder(item.id, item.title);
                          }}
                          className={cn(
                            "p-1.5 rounded-sm backdrop-blur-md shadow-md text-[10px] font-bold uppercase transition-all active:scale-95 flex items-center gap-1",
                            reminders[item.id]
                              ? "bg-green-500 hover:bg-green-400 text-black"
                              : "bg-black/60 hover:bg-yellow-500 hover:text-black text-white/90 border border-white/10"
                          )}
                          title={reminders[item.id] ? "Reminder active. Click to remove." : "Set reminder alert"}
                        >
                          {reminders[item.id] ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 glass-card bg-white/[0.01] border-dashed">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-white/20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold uppercase tracking-wider">No matches scheduled</h3>
                    <p className="text-text-muted text-xs max-w-xs mx-auto">No upcoming events are scheduled for broadcast currently. Check back later as our roster updates.</p>
                  </div>
                </div>
              )}
            </section>

          </div>
        )}

      </div>
    </div>
  );
}
