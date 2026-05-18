import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { SportsContent, Category } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import LoadingScreen from '../components/LoadingScreen';
import { motion } from 'motion/react';
import { Trophy, Activity, Play, ChevronRight, Dribbble, Target, CircleDot, Flag, Zap, Gamepad2, Disc } from 'lucide-react';
import { cn } from '../lib/utils';

const CategoryLabelMap: Record<string, { label: string, color: string, bg: string }> = {
  football: { label: 'FB', color: 'text-[#00ff88]', bg: 'bg-[#00ff88]/10 border-[#00ff88]/20' },
  cricket: { label: 'CK', color: 'text-[#ff9900]', bg: 'bg-[#ff9900]/10 border-[#ff9900]/20' },
  basketball: { label: 'BK', color: 'text-[#3399ff]', bg: 'bg-[#3399ff]/10 border-[#3399ff]/20' },
  tennis: { label: 'TN', color: 'text-[#cc33ff]', bg: 'bg-[#cc33ff]/10 border-[#cc33ff]/20' },
  f1: { label: 'F1', color: 'text-[#ff3333]', bg: 'bg-[#ff3333]/10 border-[#ff3333]/20' },
  boxing: { label: 'BX', color: 'text-[#ffff00]', bg: 'bg-[#ffff00]/10 border-[#ffff00]/20' },
  golf: { label: 'GF', color: 'text-[#00cc66]', bg: 'bg-[#00cc66]/10 border-[#00cc66]/20' },
  esports: { label: 'ES', color: 'text-[#00ffff]', bg: 'bg-[#00ffff]/10 border-[#00ffff]/20' },
};

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [content, setContent] = useState<SportsContent[]>([]);
  const [liveNow, setLiveNow] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) return;
    
    // 1. Sync All Category Assets
    const allQuery = query(
      collection(db, 'content'),
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    const unsubAll = onSnapshot(allQuery, (snap) => {
      setContent(snap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
      setLoading(false);
    }, (err) => {
      console.error("All category sync error:", err);
      setLoading(false);
    });

    // 2. Sync Live Category Content
    const liveQuery = query(
      collection(db, 'content'),
      where('category', '==', category),
      where('status', '==', 'live'),
      limit(4)
    );
    const unsubLive = onSnapshot(liveQuery, (snap) => {
      setLiveNow(snap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
    }, (err) => {
      console.warn("Live category sync offline:", err.message);
    });

    return () => {
      unsubAll();
      unsubLive();
    };
  }, [category]);

  const categoryKey = category?.toLowerCase() || '';
  const categoryName = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Sports';
  const catInfo = CategoryLabelMap[categoryKey];

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Slider Section (Category Specific) */}
      <section className="w-full h-auto max-w-[1600px] mx-auto px-4 pt-4 md:pt-8">
        <HeroSlider page={category as Category} />
      </section>

      <div className="max-w-[1600px] mx-auto px-4 pt-12">
        {/* Header */}
        <header className="mb-12 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("flex items-center gap-3", catInfo?.color || "text-brand")}
          >
            {catInfo ? (
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-black italic tracking-tighter", catInfo.bg, catInfo.color)}>
                {catInfo.label}
              </div>
            ) : (
              <Activity className="w-5 h-5" />
            )}
            <span className="text-xs font-black uppercase tracking-[0.3em]">{categoryName} Network</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-8xl font-black uppercase italic tracking-tighter leading-none"
          >
            {categoryName} <span className="text-white/10">Universe</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-slate-400 text-sm md:text-lg font-medium"
          >
            Explore the best {category} matches, high-octane replays, and exclusive behind-the-scenes content.
          </motion.p>
        </header>

        {/* Live Section */}
        {liveNow.length > 0 && (
          <section key="live-section" className="mb-12">
            <SectionHeader title={`Live ${categoryName}`} icon={Play} link="/live" />
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1">
              {liveNow.map((item, i) => (
                <ContentCard key={`live-${item.id}`} content={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Dynamic Sections (If available for this category) */}
        {category && (
          <div className="mb-12">
            <DynamicSections page={category as any} />
          </div>
        )}

        <div className="mb-6 border-b border-border pb-2">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-text-muted italic">All {categoryName} Assets</h2>
        </div>

        {loading && content.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={`skeleton-archive-${i}`} className="aspect-video bg-white/5 rounded-[2px] animate-pulse" />
            ))}
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1">
            {content.map((item, i) => (
              <ContentCard key={`archive-${item.id}`} content={item} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 glass-card">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white/10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold uppercase tracking-wider">No Content Found</h3>
              <p className="text-white/40 text-sm max-w-xs mx-auto">We're currently scouting for the best {category} events. Check back soon!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon, link }: { title: string, icon: any, link?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-sm">
            <Icon className="w-5 h-5 text-brand" />
          </div>
          <h2 className="text-xl md:text-2xl font-display font-black uppercase italic tracking-tight">{title}</h2>
        </div>
        {link && (
          <Link to={link} className="flex items-center gap-1 text-text-muted hover:text-brand transition-colors group text-[10px] md:text-xs font-black uppercase italic tracking-widest">
            View All
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
    </div>
  );
}
