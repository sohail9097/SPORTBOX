import { SportsContent } from '../types';
import { Play, Eye, Clock, Crown, Lock } from 'lucide-react';
import { cn, formatDate, getVideoAutoThumbnail } from '../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export default function ContentCard({ 
  content, 
  index, 
  featured,
  aspectRatio = 'landscape',
  hideDetails = false
}: { 
  content: SportsContent, 
  index: number, 
  featured?: boolean,
  aspectRatio?: 'landscape' | 'portrait',
  hideDetails?: boolean
}) {
  const { profile, isAdmin, user } = useAuth();
  const isLocked = !isAdmin && (
    !user || 
    (content.isPremium && (!profile || profile.subscriptionTier === 'free' || profile.subscriptionStatus !== 'active'))
  );

  const displayThumbnail = content.thumbnailUrl && content.thumbnailUrl.trim() !== ''
    ? content.thumbnailUrl
    : getVideoAutoThumbnail(content.videoUrl || '', content.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(featured ? "h-full" : "")}
    >
      <Link 
        to={`/watch/${content.id}`}
        className={cn(
          "group relative block glass-card bg-transparent border-0 hover:bg-surface transition-colors h-full",
          featured ? "p-0" : ""
        )}
      >
        <div className={cn(
          "relative overflow-hidden rounded-[10px] border border-border shadow-2xl transition-all duration-300 group-hover:border-brand/30", 
          featured ? "aspect-[21/9]" : (aspectRatio === 'portrait' ? "aspect-[2/3]" : "aspect-video")
        )}>
          {displayThumbnail ? (
            <img 
              src={displayThumbnail} 
              alt={content.title}
              className={cn(
                "w-full h-full object-cover transition-transform duration-500 group-hover:scale-110",
                isLocked && "filter grayscale brightness-50"
              )}
            />
          ) : (
            <div className="w-full h-full bg-surface-hover flex items-center justify-center">
              <Play className="w-12 h-12 text-white/10" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-sm text-[10px] font-bold uppercase tracking-widest border border-white/10">
              {content.category.charAt(0).toUpperCase() + content.category.slice(1)}
            </span>
            {isLocked && (
              <span className="px-2 py-0.5 bg-brand text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                <Lock className="w-2.5 h-2.5" />
                Locked
              </span>
            )}
            {content.isPremium && !isLocked && (
              <span className="premium-badge shadow-lg flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" />
                Premium
              </span>
            )}
          </div>

          {content.type === 'live' && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-red-600 rounded-sm text-[10px] font-bold uppercase tracking-widest animate-pulse">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
              Live
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center transition-all">
            {isLocked ? (
              <div className="flex flex-col items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                  {!user ? "Login Required" : "Subscription Required"}
                </span>
              </div>
            ) : (
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all">
                <Play className="w-6 h-6 text-black fill-black ml-1" />
              </div>
            )}
          </div>
        </div>

        {!hideDetails && (
          <div className="mt-1 md:mt-2 px-1">
            <h3 className="font-display text-[10px] md:text-xs uppercase tracking-wider group-hover:text-brand transition-colors line-clamp-1 leading-tight">
              {content.title}
            </h3>
            <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1 text-[8px] md:text-[9px] text-text-muted font-medium uppercase tracking-widest">
              {content.status !== 'live' && (
                <span className="flex items-center gap-1">
                  <Eye className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  {content.viewCount?.toLocaleString() || 0}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                {formatDate(content.createdAt)}
              </span>
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
}
