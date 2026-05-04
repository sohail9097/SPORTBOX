import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, doc, onSnapshot } from 'firebase/firestore';
import { SportsContent, VideoPromoSettings } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import VideoPromoBanner from '../components/VideoPromoBanner';
import { Play, TrendingUp, Trophy, ChevronRight } from 'lucide-react';
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
          limit(4)
        );
        const trendingQuery = query(
          collection(db, 'content'), 
          orderBy('viewCount', 'desc'), 
          limit(8)
        );

        const [liveSnap, trendingSnap] = await Promise.all([
          getDocs(liveQuery),
          getDocs(trendingQuery)
        ]);

        setLiveNow(liveSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
        setTrending(trendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
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
    <div className="pb-20">
      {/* Hero Slider Section */}
      <section className="w-full h-auto max-w-7xl mx-auto px-4 pt-8">
        <HeroSlider />
      </section>

      {/* Categories Bar */}
      <section className="mt-8 relative z-10 max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 overflow-x-auto pb-4 hide-scrollbar">
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
              className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-slate-800 transition-all cursor-pointer group"
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl italic group-hover:scale-110 transition-transform", cat.color)}>
                {cat.short}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted group-hover:text-text-base">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Dynamic Admin-Managed Sections */}
      <div className="max-w-7xl mx-auto px-4 mt-24">
        <DynamicSections page="home" />
      </div>

      {/* Live Section */}
      {liveNow.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-24">
          <SectionHeader title="Live Events" icon={Play} link="/live" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {liveNow.map((item, i) => (
              <ContentCard key={item.id} content={item} index={i} />
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
      <section className="max-w-7xl mx-auto px-4 mt-24">
        <SectionHeader title="Trending Replays" icon={TrendingUp} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {trending.map((item, i) => (
            <ContentCard key={item.id} content={item} index={i} />
          ))}
        </div>
      </section>

      {/* Featured Trophy Section (Static/Original) */}
      <section className="max-w-7xl mx-auto px-4 mt-32">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-alt rounded-[40px] p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 group shadow-2xl shadow-brand/20">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white leading-none">Go Unlimited</h2>
            <p className="text-white/80 max-w-sm font-semibold text-lg">Experience every match live in 4K with multi-view and no interruptions.</p>
            <Link to="/plans" className="mt-4 px-12 py-5 bg-white text-brand font-black uppercase tracking-[0.2em] w-fit hover:scale-105 transition-transform rounded-2xl shadow-2xl text-sm">
              Subscribe Now
            </Link>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-6">
            <div className="p-8 bg-black/20 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center gap-3 border border-white/10">
              <span className="text-4xl font-black text-white italic">14.99</span>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">USD / Month</span>
            </div>
            <div className="p-8 bg-black/20 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center gap-3 border border-white/10">
              <span className="text-4xl font-black text-white italic">4K</span>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">Ultra HD</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, icon: Icon, link }: { title: string, icon: any, link?: string }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand/10 rounded-lg">
          <Icon className="w-5 h-5 text-brand" />
        </div>
        <h2 className="text-2xl font-display uppercase tracking-wider">{title}</h2>
      </div>
      {link && (
        <Link to={link} className="flex items-center gap-1 text-text-muted hover:text-brand transition-colors group text-xs font-bold uppercase tracking-widest">
          View All
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </div>
  );
}
