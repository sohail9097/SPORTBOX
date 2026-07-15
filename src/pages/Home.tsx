import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, doc, onSnapshot, getDoc, documentId } from 'firebase/firestore';
import { SportsContent, VideoPromoSettings, ContentSection } from '../types';
import { FALLBACK_SPORTS_CONTENT, FALLBACK_PROMO } from '../lib/fallbackData';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import LoadingScreen from '../components/LoadingScreen';
import VideoPromoBanner from '../components/VideoPromoBanner';
import { Play, TrendingUp, Trophy, ChevronRight, Bell, Activity, Dribbble, Target, Flag, Zap, Gamepad2, CircleDot, Disc } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Home() {
  const [liveNow, setLiveNow] = useState<SportsContent[]>([]);
  const [trending, setTrending] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoPromo, setVideoPromo] = useState<VideoPromoSettings | null>(null);

  useEffect(() => {
    // Safety timeout: stop loading after 2.5 seconds regardless of sync state
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // 1. Video Promo sync
    const unsubPromo = onSnapshot(doc(db, 'settings', 'videoPromo'), (snap) => {
      if (snap.exists()) {
        setVideoPromo(snap.data() as VideoPromoSettings);
      } else {
        setVideoPromo(FALLBACK_PROMO);
      }
    }, (err) => {
      console.warn("[Home] Promo sync offline:", err.message);
      setVideoPromo(FALLBACK_PROMO);
      handleFirestoreError(err, OperationType.GET, 'settings/videoPromo');
    });

    // 2. Live Content sync
    const liveQuery = query(collection(db, 'content'), where('type', '==', 'live'), limit(20));
    const unsubLive = onSnapshot(liveQuery, (snap) => {
      // Filter status in-memory to avoid complex index requirements
      const liveItems = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as SportsContent))
        .filter(item => item.status === 'live')
        .slice(0, 6);
      
      setLiveNow(liveItems);
      setLoading(false);
    }, (err) => {
      console.error("[Home] Live sync error:", err);
      setLiveNow([]);
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'content');
    });

    // 3. Dynamic Sections sync (including the one intended for Trending)
    const sectionsQuery = query(collection(db, 'sections'), where('page', '==', 'home'));

    const unsubSections = onSnapshot(sectionsQuery, async (snap) => {
      const sectionsList = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ContentSection))
        .filter(s => s.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Find a section that might be the "Trending" one
      const trendingSection = sectionsList.find(s => s.title.toLowerCase().includes('trending'));
      
      if (trendingSection && trendingSection.contentIds && trendingSection.contentIds.length > 0) {
        try {
          // Optimization: Batch fetch instead of multiple getDoc calls
          const targetIds = trendingSection.contentIds.slice(0, 10);
          const qContent = query(collection(db, 'content'), where(documentId(), 'in', targetIds));
          const contentSnap = await getDocs(qContent);
          const results = contentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
          
          // Maintain sequence
          const orderMap = new Map(targetIds.map((id, idx) => [id, idx]));
          results.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

          if (results.length === 0) {
            setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
          } else {
            setTrending(results);
          }
        } catch (e) {
          console.error("[Home] Error batch fetching manual trending, trying fallback:", e);
          try {
            const results = await Promise.all(
              trendingSection.contentIds.slice(0, 10).map(id => getDoc(doc(db, 'content', id)).then(s => 
                s.exists() ? ({ ...s.data(), id: s.id } as SportsContent) : null
              ))
            );
            const filteredResults = results.filter((i): i is SportsContent => i !== null);
            if (filteredResults.length === 0) {
              setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
            } else {
              setTrending(filteredResults);
            }
          } catch (errFallback) {
            console.error("[Home] Fallback also failed:", errFallback);
            setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
          }
        }
      } else {
        // Fallback: Just fetch recent content if no trending section identified
        const fallbackQuery = query(collection(db, 'content'), limit(20));
        getDocs(fallbackQuery).then(s => {
          const items = s.docs
            .map(d => ({ id: d.id, ...d.data() } as SportsContent))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (items.length === 0) {
            setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
          } else {
            setTrending(items.slice(0, 6));
          }
        }).catch(err => {
          setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
          handleFirestoreError(err, OperationType.GET, 'content');
        });
      }
      
      setLoading(false);
    }, (err) => {
       console.error("[Home] Sections sync error:", err);
       setTrending(FALLBACK_SPORTS_CONTENT.slice(0, 6));
       setLoading(false);
       handleFirestoreError(err, OperationType.GET, 'sections');
    });

    return () => {
      clearTimeout(timer);
      unsubPromo();
      unsubLive();
      unsubSections();
    };
  }, []);

  // Use skeletons or partial loading instead of total block if possible
  // Restore loading screen for initial load as requested
  if (loading && liveNow.length === 0) return <LoadingScreen />;
  
  return (
    <div className="pb-20 text-text-base">
      {/* Hero Slider Section */}
      <section className="w-full h-auto max-w-[1600px] mx-auto pt-4 md:pt-8">
        <HeroSlider />
      </section>

      {/* Categories Bar */}
      <section className="mt-4 relative z-10 max-w-[1600px] mx-auto px-4">
        <div className="flex md:flex-wrap items-center gap-4 md:justify-between overflow-x-auto pb-4 md:pb-0 hide-scrollbar px-2">
          {[
            { id: 'cricket', name: 'Cricket', label: 'CK', color: 'text-[#ff9900]', bg: 'bg-[#ff9900]/10' },
            { id: 'kabaddi', name: 'Kabaddi', label: 'KB', color: 'text-[#ff6600]', bg: 'bg-[#ff6600]/10' },
            { id: 'boxing', name: 'Boxing', label: 'BX', color: 'text-[#ffff00]', bg: 'bg-[#ffff00]/10' },
            { id: 'football', name: 'Football', label: 'FB', color: 'text-[#00ff88]', bg: 'bg-[#00ff88]/10' },
            { id: 'wrestling', name: 'Wrestling', label: 'WR', color: 'text-[#ff1a40]', bg: 'bg-[#ff1a40]/10' },
            { id: 'watersports', name: 'Water Sport', label: 'WS', color: 'text-[#00ccff]', bg: 'bg-[#00ccff]/10' },
            { id: 'stunts', name: 'Stunt', label: 'ST', color: 'text-[#ff1aff]', bg: 'bg-[#ff1aff]/10' },
            { id: 'polo', name: 'Polo', label: 'PL', color: 'text-[#d4af37]', bg: 'bg-[#d4af37]/10' },
          ].map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.id}`}
              className="flex flex-col items-center gap-2 transition-all cursor-pointer group py-2 h-full min-w-[70px] md:min-w-0"
            >
              <div className={cn(
                "w-12 h-12 md:w-16 md:h-16 rounded-[22%] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-opacity-20", 
                cat.bg,
                cat.color
              )}>
                <span className="text-sm md:text-2xl font-black italic tracking-tighter">{cat.label}</span>
              </div>
              <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.25em] text-text-muted group-hover:text-text-base transition-colors text-center mt-1">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Section */}
      {liveNow.length > 0 && (
        <section key="home-live-section" className="max-w-[1600px] mx-auto px-4 mt-2 md:mt-4">
          <SectionHeader title="Live Today" icon={Play} link="/live" />
          <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-1 md:gap-1 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar snap-x">
            {liveNow.map((item, i) => (
              <div key={`home-live-${item.id}`} className="flex-shrink-0 w-[115px] md:w-auto snap-start">
                <ContentCard content={item} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Admin-Managed Sections */}
      <div className="max-w-[1600px] mx-auto px-4 mt-4">
        <DynamicSections page="home" />
      </div>

      {/* Video Promo Banner (Dynamic) */}
      {videoPromo?.isActive && (
        <VideoPromoBanner 
          title={videoPromo.title}
          description={videoPromo.description}
          videoUrl={videoPromo.videoUrl}
          embedCode={videoPromo.embedCode}
          buttonText={videoPromo.buttonText}
          buttonUrl={videoPromo.buttonUrl}
          backgroundColor={videoPromo.backgroundColor}
        />
      )}

      {/* Trending Section */}
      {trending.length > 0 && (
        <section key="home-trending-section" className="max-w-[1600px] mx-auto px-4 mt-2 md:mt-4">
          <SectionHeader title="Trending Replays" icon={TrendingUp} />
          <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-1 md:gap-1 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar snap-x">
            {trending.map((item, i) => (
              <div key={`home-trending-${item.id}`} className="flex-shrink-0 w-[115px] md:w-auto snap-start">
                <ContentCard key={`home-trending-${item.id}`} content={item} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, link }: { title: string, icon: any, link?: string }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-brand/10 rounded-sm">
          <Icon className="w-5 h-5 text-brand" />
        </div>
        <h2 className="text-xl md:text-2xl font-display font-black uppercase italic tracking-tight">{title}</h2>
      </div>
      {link && (
        <Link to={link} className="flex items-center gap-1 text-text-muted hover:text-brand transition-colors group text-[10px] font-black uppercase italic tracking-widest">
          View All
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </div>
  );
}
