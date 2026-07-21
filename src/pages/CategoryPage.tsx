import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SportsContent, Category } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import { motion } from 'motion/react';
import { Trophy, Activity, Play, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFirestoreCache } from '../context/FirestoreContext';
import { db, getDocs, collection, query, where, limit } from '../lib/firebase';

const CategoryLabelMap: Record<string, { label: string, color: string, bg: string }> = {
  football: { label: 'FB', color: 'text-[#00ff88]', bg: 'bg-[#00ff88]/10 border-[#00ff88]/20' },
  cricket: { label: 'CK', color: 'text-[#ff9900]', bg: 'bg-[#ff9900]/10 border-[#ff9900]/20' },
  wrestling: { label: 'WR', color: 'text-[#ff1a40]', bg: 'bg-[#ff1a40]/10 border-[#ff1a40]/20' },
  boxing: { label: 'BX', color: 'text-[#ffff00]', bg: 'bg-[#ffff00]/10 border-[#ffff00]/20' },
  kabaddi: { label: 'KB', color: 'text-[#ff6600]', bg: 'bg-[#ff6600]/10 border-[#ff6600]/20' },
  watersports: { label: 'WS', color: 'text-[#00ccff]', bg: 'bg-[#00ccff]/10 border-[#00ccff]/20' },
  stunts: { label: 'ST', color: 'text-[#ff1aff]', bg: 'bg-[#ff1aff]/10 border-[#ff1aff]/20' },
  polo: { label: 'PL', color: 'text-[#d4af37]', bg: 'bg-[#d4af37]/10 border-[#d4af37]/20' },
  olympics: { label: 'OL', color: 'text-[#00ffff]', bg: 'bg-[#00ffff]/10 border-[#00ffff]/20' },
};

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const { content: cachedContent, loading: cacheLoading } = useFirestoreCache();
  const [dbContent, setDbContent] = useState<SportsContent[] | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);

  useEffect(() => {
    if (!category) return;
    
    setLoadingDb(true);
    const q = query(
      collection(db, 'content'),
      where('category', '==', category),
      limit(30)
    );

    getDocs(q)
      .then((snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
        setDbContent(items);
      })
      .catch((err) => {
        console.error('[CategoryPage] Failed to fetch category content from Firestore:', err);
        setDbContent(null);
      })
      .finally(() => {
        setLoadingDb(false);
      });
  }, [category]);

  const content = useMemo(() => {
    if (!category) return [];
    const items = dbContent !== null 
      ? dbContent 
      : cachedContent.filter(item => item.category === category);
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cachedContent, category, dbContent]);

  const liveNow = useMemo(() => {
    return content.filter(item => item.status === 'live').slice(0, 4);
  }, [content]);

  const loading = cacheLoading || loadingDb;

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

        {/* Category Library & Archives */}
        {content.length > 0 && (
          <section key="archive-section" className="mb-12">
            <SectionHeader title={`${categoryName} Library & Highlights`} icon={Trophy} />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3.5 pt-2">
              {content.map((item, i) => (
                <ContentCard key={`archive-${item.id}`} content={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {loading && content.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-1 mb-12">
            {[...Array(4)].map((_, i) => (
              <div key={`skeleton-archive-${i}`} className="aspect-video bg-white/5 rounded-[2px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && content.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-xl border border-dashed border-border bg-surface/20 mb-12">
            <Trophy className="w-12 h-12 text-text-muted opacity-30" />
            <div className="space-y-1">
              <h3 className="font-bold text-base uppercase tracking-wider">No Cataloged Content</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto font-medium">There are currently no active broadcasts or recorded replays cataloged for the {categoryName} arena.</p>
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
