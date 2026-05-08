import { motion } from 'motion/react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-20 md:h-20 bg-[#ee3e38] flex items-center justify-center rounded-[22%] transition-transform shadow-[0_0_50px_rgba(238,62,56,0.25)]">
            <span className="text-2xl md:text-5xl font-black italic text-white leading-none">S</span>
          </div>
          <span className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white font-display">
            SPORTS<span className="text-[#ee3e38]">BOX</span>
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
