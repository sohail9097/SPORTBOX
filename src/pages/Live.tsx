import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { SportsContent } from '../types';
import { FALLBACK_SPORTS_CONTENT } from '../lib/fallbackData';
import ContentCard from '../components/ContentCard';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Play, Clock, Calendar, ChevronRight, Bell, BellOff, Volume2 } from 'lucide-react';
import { cn, getVideoAutoThumbnail } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

export default function Live() {
  const { profile, isAdmin } = useAuth();
  const isSubscribed = isAdmin || (profile && profile.subscriptionTier !== 'free' && profile.subscriptionStatus === 'active');

  const [content, setContent] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [reminders, setReminders] = useState<{ [id: string]: boolean }>({});

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

    const q = query(
      collection(db, 'content'),
      where('type', '==', 'live'),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as SportsContent))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (items.length === 0) {
        setContent(FALLBACK_SPORTS_CONTENT.filter(c => c.type === 'live'));
      } else {
        setContent(items);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching live content:', error);
      setContent(FALLBACK_SPORTS_CONTENT.filter(c => c.type === 'live'));
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'content');
    });

    return () => unsubscribe();
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

  const liveMatches = content.filter(item => item.status === 'live');
  const upcomingMatches = content.filter(item => item.status === 'scheduled');

  // Items to feature on the live banner
  // Prefer upcoming matches for the banner to create build-up/hype, as requested.
  // Fallback to currently live matches if there are no upcoming ones.
  const bannerItems = upcomingMatches.length > 0 ? upcomingMatches : liveMatches;

  const currentBannerMatch = bannerItems[activeBannerIndex];

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

        {/* Dynamic Premium Upcoming / Featured Live Banner */}
        {bannerItems.length > 0 && currentBannerMatch && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 50 }}
            className="relative w-full rounded-2xl overflow-hidden min-h-[380px] md:min-h-[460px] bg-slate-900/50 border border-white/5 shadow-[0_24px_50px_rgba(0,0,0,0.8)] flex flex-col justify-end p-6 md:p-12"
          >
            {/* Visual Background Poster / Video Thumbnail with high-contrast darkening */}
            <div className="absolute inset-0 z-0">
              {(() => {
                const thumb = currentBannerMatch.thumbnailUrl && currentBannerMatch.thumbnailUrl.trim() !== ''
                  ? currentBannerMatch.thumbnailUrl
                  : getVideoAutoThumbnail(currentBannerMatch.videoUrl || '', currentBannerMatch.category);
                return thumb ? (
                  <img src={thumb} className="w-full h-full object-cover filter brightness-40 contrast-125 object-center animate-fade-in" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface to-bg" />
                );
              })()}
              {/* Radial gradient to focus center */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.8)_80%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
            </div>

            {/* Banner Main Content */}
            <div className="relative z-10 max-w-3xl space-y-4 text-left w-full">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-1.5 text-white">
                  {currentBannerMatch.category}
                </span>
                {currentBannerMatch.status === 'live' ? (
                  <span className="px-3 py-1 bg-red-600 text-white font-bold rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse shadow-md">
                    <Radio className="w-3 h-3" />
                    Live Now
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-500 text-black font-bold rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md">
                    <Clock className="w-3 h-3" />
                    Upcoming Live
                  </span>
                )}
                {currentBannerMatch.isPremium && !isSubscribed && (
                  <span className="px-3 py-1 bg-amber-500 text-black font-black rounded-full text-[10px] uppercase tracking-widest">
                    Premium Pass
                  </span>
                )}
              </div>

              <h2 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter leading-none text-white drop-shadow-md">
                {currentBannerMatch.title}
              </h2>

              <p className="text-text-muted text-xs md:text-base font-medium max-w-xl line-clamp-2 uppercase tracking-wide drop-shadow-sm leading-relaxed">
                {currentBannerMatch.description || "The ultimate test of precision and endurance live from the arena limits."}
              </p>

              {/* Banner Event Timing / Status Details */}
              <div className="flex flex-wrap items-center gap-4 py-2">
                {currentBannerMatch.scheduledTime ? (
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/5">
                    <Calendar className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Broadcast Date</p>
                      <p className="text-xs font-black uppercase text-yellow-500">{currentBannerMatch.scheduledTime}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/5">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Broadcast State</p>
                      <p className="text-xs font-black uppercase text-red-500">Live & Uninterrupted</p>
                    </div>
                  </div>
                )}

                {/* Active/Scheduled Indicators */}
                {currentBannerMatch.status !== 'live' && (
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/5">
                    <Bell className="w-4 h-4 text-brand" />
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Hype Factor</p>
                      <p className="text-xs font-black uppercase text-white">Highly Anticipated</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Banner Interactions */}
              <div className="flex flex-wrap gap-3 pt-2">
                {currentBannerMatch.status === 'live' ? (
                  <a 
                    href={`/watch/${currentBannerMatch.id}`} 
                    className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-2 shrink-0 transition-all shadow-lg hover:shadow-red-600/20 active:scale-95"
                  >
                    <Play className="w-4 h-4 text-white fill-white" />
                    Tune In Now (Live)
                  </a>
                ) : (
                  <button 
                    onClick={() => toggleReminder(currentBannerMatch.id, currentBannerMatch.title)}
                    className={cn(
                      "px-8 py-4 rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-2 shrink-0 transition-all shadow-lg active:scale-95",
                      reminders[currentBannerMatch.id] 
                        ? "bg-slate-800 text-green-400 hover:bg-slate-700 hover:text-green-300 border border-green-500/20" 
                        : "bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/10"
                    )}
                  >
                    {reminders[currentBannerMatch.id] ? (
                      <>
                        <BellOff className="w-4 h-4" />
                        Reminder Saved
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        Set Reminder
                      </>
                    )}
                  </button>
                )}
                <a 
                  href={`/watch/${currentBannerMatch.id}`}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 rounded-lg font-black uppercase tracking-widest text-xs flex items-center justify-center transition-all active:scale-95"
                >
                  Event Details
                </a>
              </div>
            </div>

            {/* Slider Dots indicators */}
            {bannerItems.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {bannerItems.map((_, dotIdx) => (
                  <button
                    key={`dot-${dotIdx}`}
                    onClick={() => setActiveBannerIndex(dotIdx)}
                    className={cn(
                      "w-8 h-1.5 rounded-full transition-all duration-300",
                      activeBannerIndex === dotIdx ? "bg-red-500 w-12" : "bg-white/20 hover:bg-white/40"
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

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
