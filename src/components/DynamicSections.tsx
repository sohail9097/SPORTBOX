import { useState, useEffect, useMemo } from 'react';
import { ContentSection, SportsContent, Category } from '../types';
import { FALLBACK_SECTIONS, FALLBACK_SPORTS_CONTENT } from '../lib/fallbackData';
import ContentCard from './ContentCard';
import { Layers, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import AutoScrollingRow from './AutoScrollingRow';
import { useFirestoreCache } from '../context/FirestoreContext';
import { db, getDoc, doc } from '../lib/firebase';

interface DynamicSectionsProps {
  page: 'home' | Category;
}

export default function DynamicSections({ page }: DynamicSectionsProps) {
  const { sections: cachedSections, content: cachedContent, loading: cacheLoading } = useFirestoreCache();
  const [sectionData, setSectionData] = useState<Record<string, SportsContent[]>>({});
  const [loading, setLoading] = useState(true);

  const sections = useMemo(() => {
    return cachedSections
      .filter(s => s.page === page && s.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [cachedSections, page]);

  useEffect(() => {
    let isMounted = true;
    
    if (cacheLoading) {
      setLoading(true);
      return;
    }

    const fetchContentForSections = async (list: ContentSection[]) => {
      const data: Record<string, SportsContent[]> = {};
      const contentMap = new Map(cachedContent.map(item => [item.id, item]));

      // Identify any missing document IDs across all sections
      const missingIdsSet = new Set<string>();
      list.forEach(section => {
        (section.contentIds || []).forEach(id => {
          if (!contentMap.has(id)) {
            missingIdsSet.add(id);
          }
        });
      });

      const missingIds = Array.from(missingIdsSet);
      if (missingIds.length > 0) {
        try {
          console.log(`[DynamicSections] Fetching ${missingIds.length} missing content items from Firestore:`, missingIds);
          const snaps = await Promise.all(
            missingIds.map(id => getDoc(doc(db, 'content', id)).catch(() => null))
          );
          snaps.forEach(snap => {
            if (snap && snap.exists()) {
              const item = { id: snap.id, ...snap.data() } as SportsContent;
              contentMap.set(item.id, item);
            }
          });
        } catch (err) {
          console.error('[DynamicSections] Failed to fetch missing section content:', err);
        }
      }

      // Map data for each section
      list.forEach(section => {
        const sectionItems = (section.contentIds || [])
          .map(id => contentMap.get(id))
          .filter((item): item is SportsContent => !!item);
        data[section.id] = sectionItems;
      });

      if (isMounted) {
        setSectionData(data);
        setLoading(false);
      }
    };

    if (sections.length === 0) {
      if (cachedContent.length > 0) {
        setSectionData({});
        setLoading(false);
        return;
      }

      const fallbacks = FALLBACK_SECTIONS.filter(s => s.page === page || (page !== 'home' && s.page === 'home'));
      const data: Record<string, SportsContent[]> = {};
      
      fallbacks.forEach(section => {
        let items = FALLBACK_SPORTS_CONTENT;
        if (page !== 'home') {
          items = FALLBACK_SPORTS_CONTENT.filter(item => item.category === page);
        }
        data[section.id] = items.slice(0, 6);
      });
      setSectionData(data);
      setLoading(false);
    } else {
      fetchContentForSections(sections);
    }

    return () => {
      isMounted = false;
    };
  }, [page, sections, cachedContent, cacheLoading]);

  if (loading || cacheLoading) {
    return (
      <div className="space-y-12">
        {[1, 2].map((i) => (
          <div key={`section-row-skeleton-${i}`} className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-white/5 rounded-sm" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((j) => (
                <div key={`section-item-skeleton-${i}-${j}`} className="aspect-video bg-white/5 rounded-sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {sections.map((section) => {
        const contents = sectionData[section.id] || [];
        if (contents.length === 0) return null;

        return (
          <section key={section.id} className="relative">
            <div className="flex items-center justify-between mb-2 md:mb-4 mt-2 md:mt-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand/10 rounded-sm">
                  {(section.type === 'top10' || section.type === 'tournament') ? <Trophy className="w-5 h-5 text-brand" /> : <Layers className="w-5 h-5 text-brand" />}
                </div>
                <h2 className="text-xl md:text-2xl font-display font-black uppercase italic tracking-tight">{section.title}</h2>
              </div>
            </div>

            {section.type === 'top10' ? (
              <div className="flex gap-1 overflow-x-auto pb-4 hide-scrollbar scroll-smooth snap-x">
                {contents.slice(0, 10).map((item, i) => (
                  <div key={`${i}-${item.id}`} className="relative flex-none w-[130px] md:w-[180px] group snap-start">
                    <div className="relative z-10 pl-3 md:pl-10 h-full">
                      <ContentCard content={item} aspectRatio="portrait" hideDetails index={i} />
                    </div>
                    <div className="absolute left-0 bottom-[-10px] z-20 flex items-center justify-center">
                      <span className="text-6xl md:text-[9rem] font-black text-white/20 drop-shadow-[0_4px_12px_rgba(255,255,255,0.1)] italic leading-none select-none" style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.5)' }}>
                        {i + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : section.type === 'single-row' ? (
              <AutoScrollingRow contents={contents} aspectRatio={section.aspectRatio || 'landscape'} />
            ) : section.type === 'featured' ? (
              <div className="flex md:grid md:grid-cols-2 gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar snap-x">
                {contents.map((item, i) => (
                   <div key={`${i}-${item.id}`} className={cn(
                     "flex-shrink-0 md:flex-shrink snap-start",
                     i === 0 ? "w-[220px] md:w-auto md:col-span-2" : "w-[115px] md:w-auto"
                   )}>
                      <ContentCard content={item} index={i} featured={i === 0} />
                   </div>
                ))}
              </div>
            ) : (
              <div className={cn(
                "flex md:grid gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar snap-x",
                section.aspectRatio === 'portrait' 
                  ? "md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7" 
                  : "md:grid-cols-3 lg:grid-cols-6"
              )}>
                {contents.map((item, i) => (
                  <div 
                    key={`${i}-${item.id}`} 
                    className={cn(
                      "flex-shrink-0 snap-start",
                      section.aspectRatio === 'portrait' ? "w-[130px] md:w-auto" : "w-[115px] md:w-auto"
                    )}
                  >
                    <ContentCard 
                      content={item} 
                      index={i} 
                      aspectRatio={section.aspectRatio || 'landscape'} 
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
