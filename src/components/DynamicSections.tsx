import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ContentSection, SportsContent, Category } from '../types';
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
    const fetchSectionsAndContent = async () => {
      setLoading(true);
      try {
        // Fetch all sections and filter/sort in memory to avoid needing composite indexes
        const q = query(collection(db, 'sections'));
        const querySnapshot = await getDocs(q);
        const sectionsList = querySnapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as ContentSection))
          .filter(s => s.page === page && s.isActive)
          .sort((a, b) => a.order - b.order);
        
        setSections(sectionsList);

        // 2. Fetch content for each section
        const data: Record<string, SportsContent[]> = {};
        
        for (const section of sectionsList) {
          if (section.contentIds.length === 0) continue;

          // Note: In a production environment with many items, 
          // we might want to handle this with a more complex query or denormalization.
          // For now, we fetch the individual documents associated with the section.
          const contentPromises = section.contentIds.map(async (contentId) => {
            const contentDoc = await getDoc(doc(db, 'content', contentId));
            if (contentDoc.exists()) {
              return { ...contentDoc.data(), id: contentDoc.id } as SportsContent;
            }
            return null;
          });

          const results = await Promise.all(contentPromises);
          data[section.id] = results.filter((item): item is SportsContent => item !== null);
        }
        
        setSectionData(data);
      } catch (error) {
        console.error('Error fetching dynamic sections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectionsAndContent();
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
    <div className="space-y-6 md:space-y-12">
      {sections.map((section) => {
        const contents = sectionData[section.id] || [];
        if (contents.length === 0) return null;

        return (
          <section key={section.id} className="relative">
            <div className="flex items-center justify-between mb-2 md:mb-4 mt-4 md:mt-8">
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
                  <div key={`${i}-${item.id}`} className="relative flex-none w-[110px] md:w-[180px] group snap-start">
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
                     i === 0 ? "w-[220px] md:w-auto md:col-span-2" : "w-[125px] md:w-auto"
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
                      section.aspectRatio === 'portrait' ? "w-[110px] md:w-auto" : "w-[125px] md:w-auto"
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
