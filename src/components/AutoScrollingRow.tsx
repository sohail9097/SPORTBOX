import { useState, useEffect, useRef } from 'react';
import { SportsContent } from '../types';
import ContentCard from './ContentCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface AutoScrollingRowProps {
  contents: SportsContent[];
  aspectRatio?: 'landscape' | 'portrait';
}

export default function AutoScrollingRow({ contents, aspectRatio = 'landscape' }: AutoScrollingRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Item width based on aspect ratio
  const itemWidth = aspectRatio === 'portrait' ? 180 : 300;
  const gap = 12; // gap-3 (12px)

  useEffect(() => {
    if (isPaused || contents.length === 0) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const maxScroll = scrollWidth - clientWidth;
        
        // Calculate scroll amount
        const scrollAmount = itemWidth + gap;

        if (scrollLeft >= maxScroll - 10) {
          // Reset to start if at the end
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }
    }, 4000); // Same as hero slider

    return () => clearInterval(interval);
  }, [contents.length, isPaused, itemWidth]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = itemWidth + gap;
      scrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div 
      className="relative group/row"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar scroll-smooth snap-x"
      >
        {contents.map((item, i) => (
          <div 
            key={`${item.id}-${i}`} 
            className={cn(
              "flex-shrink-0 snap-start",
              aspectRatio === 'portrait' ? "w-[160px] md:w-[180px]" : "w-72 md:w-80"
            )}
          >
            <ContentCard content={item} index={i} aspectRatio={aspectRatio} />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-full -translate-x-4 p-3 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 opacity-0 group-hover/row:opacity-100 transition-all hover:bg-brand hover:scale-110 z-20"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      
      {showRightArrow && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-full translate-x-4 p-3 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 opacity-0 group-hover/row:opacity-100 transition-all hover:bg-brand hover:scale-110 z-20"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
