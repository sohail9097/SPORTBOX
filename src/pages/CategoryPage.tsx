import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { SportsContent, Category } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import { motion } from 'motion/react';
import { Trophy, Activity, Play, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [content, setContent] = useState<SportsContent[]>([]);
  const [liveNow, setLiveNow] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category) {
      fetchCategoryData();
    }
  }, [category]);

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      // 1. Fetch All Assets
      const allQuery = query(
        collection(db, 'content'),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      
      // 2. Fetch Live for this category
      const liveQuery = query(
        collection(db, 'content'),
        where('category', '==', category),
        where('type', '==', 'live'),
        where('status', '==', 'live'),
        limit(4)
      );

      const [allSnap, liveSnap] = await Promise.all([
        getDocs(allQuery),
        getDocs(liveQuery)
      ]);

      setContent(allSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
      setLiveNow(liveSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
    } catch (error) {
      console.error('Error fetching category data:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryName = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Sports';

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
            className="flex items-center gap-3 text-brand"
          >
            <Activity className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">{categoryName} Network</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none"
          >
            {categoryName} <span className="text-white/10">Universe</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-slate-400 text-lg font-medium"
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

        {loading ? (
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
        <div className="p-1.5 bg-brand/10 rounded-lg">
          <Icon className="w-4 h-4 text-brand" />
        </div>
        <h2 className="text-lg md:text-xl font-display uppercase tracking-wider">{title}</h2>
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
