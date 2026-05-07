import { motion } from 'motion/react';
import { Play } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-16 md:h-16 bg-brand flex items-center justify-center rounded-lg md:rounded-xl skew-x-[-12deg] shadow-[0_0_40px_rgba(255,0,0,0.3)]">
            <Play className="w-6 h-6 md:w-10 md:h-10 text-white fill-white ml-0.5" />
          </div>
          <span className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white font-display">
            Sport<span className="text-brand">Box</span>
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <div className="w-40 md:w-64 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-brand"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-white/30 animate-pulse">Initializing Arena</span>
        </div>
      </motion.div>
    </div>
  );
}
