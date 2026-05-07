import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { SportsContent } from '../types';
import ContentCard from '../components/ContentCard';
import LoadingScreen from '../components/LoadingScreen';
import { motion } from 'motion/react';
import { Radio, Play } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Live() {
  const [content, setContent] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveContent();
  }, []);

  const fetchLiveContent = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'content'),
        where('status', '==', 'live'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setContent(snap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
    } catch (error) {
      console.error('Error fetching live content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-20 pt-12">
      <div className="max-w-[1600px] mx-auto px-4">
        <header className="mb-10 space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-red-600"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Direct from Stadium</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-8xl font-black uppercase italic tracking-tighter leading-none"
          >
            Live <span className="text-red-600">Now</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-text-muted text-sm md:text-lg font-medium"
          >
            Don't miss a second of the action. Real-time streams from every major league.
          </motion.p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={`skeleton-live-${i}`} className="aspect-video bg-surface rounded-sm animate-pulse" />
            ))}
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {content.map((item, i) => (
              <ContentCard key={item.id} content={item} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 glass-card">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-text-muted opacity-20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold uppercase tracking-wider">No Active Streams</h3>
              <p className="text-text-muted text-sm max-w-xs mx-auto">The stadiums are quiet right now. Check our schedules for upcoming matches.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
