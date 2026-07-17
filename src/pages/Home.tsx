import { useMemo } from 'react';
import { SportsContent } from '../types';
import ContentCard from '../components/ContentCard';
import DynamicSections from '../components/DynamicSections';
import HeroSlider from '../components/HeroSlider';
import LoadingScreen from '../components/LoadingScreen';
import VideoPromoBanner from '../components/VideoPromoBanner';
import { Play, TrendingUp, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useFirestoreCache } from '../context/FirestoreContext';
import { useRenderProfiler } from '../lib/firebase';

export default function Home() {
  useRenderProfiler('Home');
  const { content, sections: cachedSections, videoPromo, loading } = useFirestoreCache();

  const homeSections = useMemo(() => {
    return cachedSections
      .filter(s => s.page === 'home' && s.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [cachedSections]);

  const liveNow = useMemo(() => {
    return content
      .filter(item => item.status === 'live')
      .slice(0, 6);
  }, [content]);

  const trending = useMemo(() => {
    const trendingSection = homeSections.find(s => s.title.toLowerCase().includes('trending'));
    
    if (trendingSection && trendingSection.contentIds && trendingSection.contentIds.length > 0) {
      const targetIds = trendingSection.contentIds.slice(0, 10);
      const results = content.filter(item => targetIds.includes(item.id));
      const orderMap = new Map(targetIds.map((id, idx) => [id, idx]));
      return results
        .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
        .slice(0, 6);
    }
    
    // Fallback: sort by createdAt descending
    return [...content]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [content, homeSections]);

  // Generate featured content in-memory
  const featured = useMemo(() => {
    return content
      .filter(item => (item.type as string) === 'featured' || item.isPremium)
      .slice(0, 6);
  }, [content]);

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
