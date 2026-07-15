import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, getDoc, getDocs } from '../lib/firebase';
import { collection, query, where, orderBy, doc, documentId } from 'firebase/firestore';
import { ContentSection, SportsContent, Category } from '../types';
import { FALLBACK_SECTIONS, FALLBACK_SPORTS_CONTENT } from '../lib/fallbackData';
import ContentCard from './ContentCard';
import { ChevronRight, Layers, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import AutoScrollingRow from './AutoScrollingRow';

interface DynamicSectionsProps {
  page: 'home' | Category;
}

export default function DynamicSections({ page }: DynamicSectionsProps) {
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [sectionData, setSectionData] = useState<Record<string, SportsContent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    // 1. Fetch sections (one-time)
    const q = query(collection(db, 'sections'), where('page', '==', page));
    getDocs(q, { component: 'DynamicSections', file: 'DynamicSections.tsx', reason: `Fetch page content sections configuration for ${page}` }).then((snap) => {
      if (!isMounted) return;
      const sectionsList = snap.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as ContentSection))
        .filter(s => s.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      if (sectionsList.length === 0) {
        // Find default sections for this page or default to home fallbacks
        const fallbacks = FALLBACK_SECTIONS.filter(s => s.page === page || (page !== 'home' && s.page === 'home'));
        // Remap page field to match the current page
        const remappedFallbacks = fallbacks.map(f => ({ ...f, page }));
        setSections(remappedFallbacks);
        
        const data: Record<string, SportsContent[]> = {};
        remappedFallbacks.forEach(section => {
          // Filter content to match category or type
          let items = FALLBACK_SPORTS_CONTENT;
          if (page !== 'home') {
            items = FALLBACK_SPORTS_CONTENT.filter(item => item.category === page);
          }
          
          if (section.id === 'sec_live') {
            data[section.id] = items.filter(item => item.status === 'live');
          } else if (section.id === 'sec_trending') {
            data[section.id] = items.filter(item => item.type !== 'live');
          } else {
            data[section.id] = items.filter(item => section.contentIds.includes(item.id));
          }
          
          // If empty, just give some items
          if (data[section.id].length === 0) {
            data[section.id] = items.slice(0, 4);
          }
        });
        setSectionData(data);
        setLoading(false);
      } else {
        setSections(sectionsList);
        setLoading(false);
        // 2. Fetch content for each section
        fetchContentForSections(sectionsList);
      }
    }).catch((err) => {
      if (!isMounted) return;
      console.error("[Dynamic] Sections fetch error:", err);
      
      const fallbacks = FALLBACK_SECTIONS.filter(s => s.page === page || (page !== 'home' && s.page === 'home'));
      const remappedFallbacks = fallbacks.map(f => ({ ...f, page }));
      setSections(remappedFallbacks);
      
      const data: Record<string, SportsContent[]> = {};
      remappedFallbacks.forEach(section => {
        let items = FALLBACK_SPORTS_CONTENT;
        if (page !== 'home') {
          items = FALLBACK_SPORTS_CONTENT.filter(item => item.category === page);
        }
        
        if (section.id === 'sec_live') {
          data[section.id] = items.filter(item => item.status === 'live');
        } else if (section.id === 'sec_trending') {
          data[section.id] = items.filter(item => item.type !== 'live');
        } else {
          data[section.id] = items.filter(item => section.contentIds.includes(item.id));
        }
        
        if (data[section.id].length === 0) {
          data[section.id] = items.slice(0, 4);
        }
      });
      setSectionData(data);
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'sections');
    });

    const fetchContentForSections = async (list: ContentSection[]) => {
      const data: Record<string, SportsContent[]> = {};
      
      for (const section of list) {
        if (!section.contentIds || section.contentIds.length === 0) {
          data[section.id] = [];
          continue;
        }
        
        try {
          // Firestore 'in' queries allow up to 30 elements in a chunk.
          // This is a massive optimization over Promise.all(getDoc(...)) as it reduces connection overhead
          const chunkedIds = [];
          const idsToFetch = section.contentIds;
          for (let i = 0; i < idsToFetch.length; i += 30) {
            chunkedIds.push(idsToFetch.slice(i, i + 30));
          }

          let results: SportsContent[] = [];
          for (const chunk of chunkedIds) {
            const qContent = query(collection(db, 'content'), where(documentId(), 'in', chunk));
            const contentSnap = await getDocs(qContent, { component: 'DynamicSections', file: 'DynamicSections.tsx', reason: `Fetch batch content IDs for section ${section.title}` });
            results = results.concat(contentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent)));
          }

          // Maintain the original order defined in contentIds
          const orderMap = new Map(section.contentIds.map((id, idx) => [id, idx]));
          results.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

          data[section.id] = results;
        } catch (e) {
          console.warn(`[Dynamic] Error batch fetching content for section ${section.id}, falling back to sequential:`, e);
          try {
            const results = await Promise.all(
              section.contentIds.map(id => 
                getDoc(doc(db, 'content', id), { component: 'DynamicSections', file: 'DynamicSections.tsx', reason: `Sequential fallback fetch for content ID ${id}` }).then(s => 
                  s.exists() ? ({ ...s.data(), id: s.id } as SportsContent) : null
                )
              )
            );
            data[section.id] = results.filter((i): i is SportsContent => i !== null);
          } catch (errFallback) {
            console.error(`[Dynamic] Fallback also failed for section ${section.id}:`, errFallback);
          }
        }
      }
      if (isMounted) {
        setSectionData(data);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [page]);

  if (loading) {
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
