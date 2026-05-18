import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { SliderElement, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, X, Info, Calendar, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any;

interface HeroSliderProps {
  page?: 'home' | Category;
}

export default function HeroSlider({ page = 'home' }: HeroSliderProps) {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<SliderElement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [videoModal, setVideoModal] = useState<string | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Faster fetching with onSnapshot
    setLoading(true);
    const q = query(
      collection(db, 'slider'),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as SliderElement))
        .filter(slide => (slide.page || 'home') === page);
      
      setSlides(items);
      setLoading(false);
    }, (error) => {
      console.error('Slider sync error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [page]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (slides.length > 0 && !videoModal) {
      autoPlayRef.current = setInterval(nextSlide, 4000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [slides, videoModal, currentIndex]);

  if (loading) {
    return <div className="w-full aspect-[21/9] bg-surface/50 animate-pulse rounded-xl" />;
  }

  if (slides.length === 0) {
    return null;
  }

  const currentSlide = slides[currentIndex];

  const variants = {
    fade: {
      initial: { opacity: 0, scale: 1.05 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { duration: 0.8, ease: "easeOut" } as any
    },
    slide: {
      initial: { opacity: 0, x: 200 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -200 },
      transition: { duration: 0.6, ease: [0.32, 0.72, 0, 1] } as any
    }
  };

  const anim = currentSlide.animationType === 'slide' ? variants.slide : variants.fade;

  const handleWatchNow = () => {
    if (currentSlide.videoUrl) {
      setVideoModal(currentSlide.videoUrl);
    } else {
      if (currentSlide.actionUrl.startsWith('/')) {
        navigate(currentSlide.actionUrl);
      } else {
        window.location.href = currentSlide.actionUrl;
      }
    }
  };

  const isIframeUrl = (url: string) => {
    if (!url) return false;
    const iframeProviders = [
      'iframe.dacast.com', 
      'player.vimeo.com', 
      'facebook.com', 
      'twitch.tv/embed',
      'cloudflarestream.com',
      '/iframe'
    ];
    return iframeProviders.some(p => url.includes(p));
  };

  return (
    <div className="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden rounded-xl group shadow-2xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          initial={anim.initial}
          animate={anim.animate}
          exit={anim.exit}
          transition={anim.transition}
          className="absolute inset-0"
        >
          {currentSlide.imageUrl && currentSlide.imageUrl.trim() !== '' ? (
            <img 
              src={currentSlide.imageUrl} 
              className="w-full h-full object-cover" 
              alt={currentSlide.title}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-surface-hover flex items-center justify-center">
              <Play className="w-20 h-20 text-white/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-black/20 to-transparent md:bg-gradient-to-r md:from-black md:via-black/60 md:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent hidden md:block" />
          
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-16 flex flex-col justify-end md:justify-center max-w-3xl space-y-4 md:space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center md:items-start space-y-2 md:space-y-4 text-center md:text-left"
            >
              <div className="flex items-center gap-3">
                {currentSlide.isLive && (
                  <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-red-600 rounded-sm w-fit">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white">Live</span>
                  </div>
                )}
              </div>
              <h1 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none decoration-brand drop-shadow-2xl">
                {currentSlide.title}
              </h1>
              <p className="hidden md:block text-xs md:text-lg text-white/70 font-medium line-clamp-2 md:line-clamp-3 leading-relaxed">
                {currentSlide.description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center md:justify-start gap-3 pt-2 md:pt-4"
            >
              <button 
                onClick={handleWatchNow}
                className="flex-1 md:flex-none px-8 md:px-12 py-3.5 md:py-4 bg-amber-400 text-black font-black text-[11px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-full flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-xl"
              >
                <Play className="w-4 h-4 fill-black" />
                Play
              </button>
              <Link 
                to={currentSlide.actionUrl}
                className="flex-1 md:flex-none px-8 md:px-12 py-3.5 md:py-4 bg-white/20 backdrop-blur-xl text-white font-black text-[11px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-full flex items-center justify-center gap-2 hover:bg-white/30 transition-all border border-white/10"
              >
                <Plus className="w-4 h-4" />
                List
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button 
        onClick={prevSlide}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/20 hover:bg-black/80 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-all border border-white/5"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button 
        onClick={nextSlide}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/20 hover:bg-black/80 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-all border border-white/5"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 flex gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={`hero-dot-${slide.id || i}`}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "h-1 transition-all duration-500 rounded-full",
              i === currentIndex ? "w-6 md:w-8 bg-amber-400" : "w-1.5 md:w-2 bg-white/20"
            )}
          />
        ))}
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {videoModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVideoModal(null)}
              className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 md:p-12"
            >
              <button 
                onClick={() => setVideoModal(null)}
                className="absolute top-8 right-8 p-4 text-white hover:text-brand transition-colors z-[110]"
              >
                <X className="w-10 h-10" />
              </button>
              
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                {isIframeUrl(videoModal) ? (
                  <iframe 
                    src={videoModal}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture"
                  />
                ) : (
                  <Player
                    url={videoModal}
                    width="100%"
                    height="100%"
                    controls
                    playing
                    playsinline
                    config={{
                      file: {
                        forceHLS: true,
                      }
                    } as any}
                  />
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
