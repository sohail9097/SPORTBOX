import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { SportsContent } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import { motion } from 'motion/react';
import { Trophy, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [content, setContent] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category) {
      fetchCategoryContent();
    }
  }, [category]);

  const fetchCategoryContent = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'content'),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setContent(snap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
    } catch (error) {
      console.error('Error fetching category content:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryName = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Sports';

  return (
    <div className="min-h-screen pb-20 pt-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <header className="mb-12 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 text-brand"
          >
            <Activity className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Category Archive</span>
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

        {/* Dynamic Sections (If available for this category) */}
        {(category === 'cricket' || category === 'football') && (
          <div className="mb-24">
            <DynamicSections page={category as 'cricket' | 'football'} />
          </div>
        )}

        <div className="mb-12 border-b border-border pb-4">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-text-muted italic">All {categoryName} Assets</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {content.map((item, i) => (
              <ContentCard key={item.id} content={item} index={i} />
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
