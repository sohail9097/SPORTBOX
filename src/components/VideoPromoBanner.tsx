import { useEffect, useRef } from 'react';
import { useInView } from 'motion/react';
import { Play, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VideoPromoProps {
  title: string;
  description: string;
  videoUrl?: string;
  embedCode?: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor?: string;
}

export default function VideoPromoBanner({ title, description, videoUrl, embedCode, buttonText, buttonUrl, backgroundColor }: VideoPromoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.3 });

  // Autoplay Logic for Direct MP4
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      if (isInView) {
        videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView, videoUrl]);

  // Function to process embed code to add autoplay/mute if it's a URL-based iframe
  const processEmbedCode = (code: string) => {
    if (!code) return '';
    // If it's a YouTube link, ensure autoplay and mute are on
    if (code.includes('youtube.com/embed') && !code.includes('autoplay=1')) {
      const separator = code.includes('?') ? '&' : '?';
      return code.replace(/src="([^"]+)"/, `src="$1${separator}autoplay=1&mute=1&controls=0&loop=1"`);
    }
    return code;
  };

  return (
    <section ref={containerRef} className="max-w-7xl mx-auto px-4 mt-32">
        <div 
          className="relative overflow-hidden rounded-[40px] p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 group shadow-2xl transition-all duration-700 min-h-[400px]"
          style={{ backgroundColor: backgroundColor || '#ff0000' }}
        >
          {/* Video Background */}
          {embedCode ? (
            <div 
              className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none scale-110"
              dangerouslySetInnerHTML={{ __html: processEmbedCode(embedCode) }}
            />
          ) : videoUrl ? (
            <div className="absolute inset-0 z-0">
              <video 
                ref={videoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                className="w-full h-full object-cover opacity-40 mix-blend-overlay"
              />
            </div>
          ) : null}
          
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[1]" />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Play className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter text-white leading-none">{title}</h2>
            <p className="text-white/80 max-w-sm font-semibold text-lg">{description}</p>
            <Link to={buttonUrl} className="mt-4 px-12 py-5 bg-white text-brand font-black uppercase tracking-[0.2em] w-fit hover:scale-105 transition-transform rounded-2xl shadow-2xl text-sm">
              {buttonText}
            </Link>
          </div>
          
          <div className="relative z-10 hidden lg:block">
             <div className="w-48 h-48 md:w-64 md:h-64 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20 animate-pulse-slow">
                <Trophy className="w-24 h-24 md:w-32 md:h-32 text-white/50" />
             </div>
          </div>
        </div>
    </section>
  );
}
