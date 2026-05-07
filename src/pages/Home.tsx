import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, doc, onSnapshot } from 'firebase/firestore';
import { SportsContent, VideoPromoSettings } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import VideoPromoBanner from '../components/VideoPromoBanner';
import { Play, TrendingUp, Trophy, ChevronRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Home() {
  const [liveNow, setLiveNow] = useState<SportsContent[]>([]);
  const [trending, setTrending] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoPromo, setVideoPromo] = useState<VideoPromoSettings | null>(null);

  useEffect(() => {
    // Fetch video promo settings
    const unsubPromo = onSnapshot(doc(db, 'settings', 'videoPromo'), (snap) => {
      if (snap.exists()) {
        setVideoPromo(snap.data() as VideoPromoSettings);
      }
    });

    const fetchData = async () => {
      try {
        const liveQuery = query(
          collection(db, 'content'), 
          where('type', '==', 'live'),
          where('status', '==', 'live'),
          limit(6)
        );

        const [liveSnap] = await Promise.all([
          getDocs(liveQuery)
        ]);

        setLiveNow(liveSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));

        // Check for manual "Trending Replays" section to avoid duplication
        const manualTrendingQuery = query(
          collection(db, 'sections'), 
          where('page', '==', 'home'), 
          where('title', '==', 'Trending Replays'),
          where('isActive', '==', true)
        );
        const manualTrendingSnap = await getDocs(manualTrendingQuery);

        if (manualTrendingSnap.empty) {
          const trendingQuery = query(
            collection(db, 'content'), 
            orderBy('viewCount', 'desc'), 
            limit(6)
          );
          const trendingSnap = await getDocs(trendingQuery);
          setTrending(trendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
        } else {
          setTrending([]); // Let DynamicSections handle it
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => unsubPromo();
  }, []);

  return (
    <div className="pb-20 text-text-base">
      {/* Hero Slider Section */}
      <section className="w-full h-auto max-w-[1600px] mx-auto pt-4 md:pt-8">
        <HeroSlider />
      </section>

      {/* Categories Bar */}
      <section className="mt-4 relative z-10 max-w-[1600px] mx-auto px-4">
        <div className="flex md:flex-wrap items-center gap-4 md:justify-between overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
          {[
            { name: 'Football', color: 'bg-green-500/10 text-green-500', short: 'FB' },
            { name: 'Cricket', color: 'bg-orange-500/10 text-orange-500', short: 'CK' },
            { name: 'Basketball', color: 'bg-blue-500/10 text-blue-500', short: 'BK' },
            { name: 'Tennis', color: 'bg-purple-500/10 text-purple-500', short: 'TN' },
            { name: 'F1', color: 'bg-red-500/10 text-red-500', short: 'F1' },
            { name: 'Boxing', color: 'bg-yellow-500/10 text-yellow-500', short: 'BX' },
            { name: 'Golf', color: 'bg-emerald-500/10 text-emerald-500', short: 'GF' },
            { name: 'Esports', color: 'bg-cyan-500/10 text-cyan-500', short: 'ES' },
          ].map((cat) => (
            <Link
              key={cat.name}
              to={`/category/${cat.name.toLowerCase()}`}
              className="flex flex-col items-center gap-2 transition-all cursor-pointer group py-2 h-full min-w-[70px] md:min-w-0"
            >
              <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center font-black text-sm md:text-base italic group-hover:scale-110 transition-transform", cat.color)}>
                {cat.short}
              </div>
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-text-muted group-hover:text-text-base text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Dynamic Admin-Managed Sections */}
      <div className="max-w-[1600px] mx-auto px-4 mt-4">
        <DynamicSections page="home" />
      </div>

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
