import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { ContentSection, SportsContent } from '../types';
import ContentCard from './ContentCard';
import { ChevronRight, Layers, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface DynamicSectionsProps {
  page: 'home' | 'cricket' | 'football';
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
          <div key={i} className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-white/5 rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="aspect-video bg-white/5 rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {sections.map((section) => {
        const contents = sectionData[section.id] || [];
        if (contents.length === 0) return null;

        return (
          <section key={section.id} className="relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand/10 rounded-lg">
                  {section.type === 'top10' ? <Trophy className="w-5 h-5 text-brand" /> : <Layers className="w-5 h-5 text-brand" />}
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">{section.title}</h2>
              </div>
            </div>

            {section.type === 'top10' ? (
              <div className="flex gap-8 overflow-x-auto pb-8 hide-scrollbar scroll-smooth snap-x">
                {contents.map((item, i) => (
                  <div key={item.id} className="relative flex-shrink-0 w-80 group snap-start">
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-[180px] font-black italic leading-none text-white/5 select-none pointer-events-none group-hover:text-brand/10 transition-colors z-0">
                      {i + 1}
                    </div>
                    <div className="relative z-10 pl-12">
                       <ContentCard content={item} index={i} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {contents.map((item, i) => (
                  <ContentCard key={item.id} content={item} index={i} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
