import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';

export interface LivestreamFallbackScreenProps {
  /** Optional custom title; defaults to "Sorry, we're working on it!" */
  title?: string;
  /** Optional custom subheading */
  subheading?: string;
  /** Legacy optional props for backward compatibility */
  reason?: string;
  streamTitle?: string;
  onManualRetry?: () => void;
  onAutoRetry?: () => Promise<boolean | void> | void;
  isReconnecting?: boolean;
  autoRetryIntervalMs?: number;
  /** Class name for custom styling on container */
  className?: string;
}

export default function LivestreamFallbackScreen({
  title = "Sorry, we're working on it!",
  subheading = "The stream will be back shortly. Thanks for your patience.",
  className = ''
}: LivestreamFallbackScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        "absolute inset-0 z-40 bg-[#090a0f]/95 backdrop-blur-md rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none border border-white/10 shadow-2xl",
        className
      )}
    >
      {/* Background Animated Gradient Mesh Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand/10 via-transparent to-red-950/20 pointer-events-none" />
      
      {/* Subtle Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.2) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* ILLUSTRATION ARTWORK: Broadcast Signal Tower + Technician/Wrench Repair Graphic */}
      <div className="relative z-10 my-3 flex items-center justify-center">
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
          
          {/* Animated Pulsing Signal Rings */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border-2 border-brand/40 bg-brand/5"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.08, 0.25, 0.08] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            className="absolute inset-[-12px] rounded-full border border-brand/20"
          />

          {/* Central Satellite / Broadcast Dish Graphic Container */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-zinc-900/90 border border-brand/30 rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/20 group">
            
            {/* SVG Illustration: Satellite Dish + Antenna Tower + WiFi Signal Waves */}
            <svg
              viewBox="0 0 100 100"
              className="w-14 h-14 sm:w-16 sm:h-16 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Signal Dish Tower Base */}
              <path d="M50 85 L50 45" stroke="#ef4444" strokeWidth="3" />
              <path d="M35 85 L50 60 L65 85" stroke="#71717a" strokeWidth="2" />
              <path d="M42 72 L58 72" stroke="#52525b" strokeWidth="1.5" />

              {/* Antenna Dish Bowl */}
              <path
                d="M28 35 C 28 20, 72 20, 72 35 Z"
                fill="rgba(225, 29, 72, 0.15)"
                stroke="#e11d48"
                strokeWidth="2.5"
              />
              
              {/* Central Signal Emitter Node */}
              <circle cx="50" cy="22" r="3.5" fill="#e11d48" className="animate-pulse" />

              {/* Interrupted Signal Wave Arc 1 */}
              <path
                d="M36 14 C 42 10, 58 10, 64 14"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              {/* Interrupted Signal Wave Arc 2 */}
              <path
                d="M28 8 C 38 2, 62 2, 72 8"
                stroke="#fda4af"
                strokeWidth="1.5"
                strokeDasharray="2 4"
              />
            </svg>

            {/* Overlay Technician / Wrench Repair Icon */}
            <motion.div
              animate={{ rotate: [-10, 15, -10], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-2 -right-2 bg-brand text-white p-2 rounded-xl shadow-lg border border-white/20 flex items-center justify-center"
            >
              <Wrench className="w-4 h-4 text-white" />
            </motion.div>

            {/* Glowing Broadcast Sparkle */}
            <div className="absolute -top-2 -left-2 bg-amber-500/20 text-amber-400 p-1.5 rounded-lg border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Message */}
      <div className="relative z-10 space-y-1.5 max-w-md px-2 mt-1">
        <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold uppercase italic tracking-tight text-white drop-shadow-md">
          {title}
        </h3>
        <p className="text-xs sm:text-sm font-medium text-zinc-300 leading-relaxed max-w-sm mx-auto">
          {subheading}
        </p>
      </div>
    </motion.div>
  );
}
