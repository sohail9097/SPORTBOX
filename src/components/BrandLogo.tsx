import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  logoUrl?: string; // Kept for interface backward compatibility
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showIcon?: boolean;
}

export default function BrandLogo({ 
  className, 
  imageClassName, 
  textClassName,
  size = 'md',
  showText = true,
  showIcon = true
}: BrandLogoProps) {
  
  const sizeClasses = {
    sm: {
      container: 'gap-2',
      icon: 'w-6 h-6 rounded-[24%] text-sm',
      text: 'text-sm md:text-base'
    },
    md: {
      container: 'gap-3',
      icon: 'w-9 h-9 md:w-10 md:h-10 rounded-[26%] text-xl md:text-2xl',
      text: 'text-xl md:text-2xl'
    },
    lg: {
      container: 'gap-4',
      icon: 'w-12 h-12 md:w-14 md:h-14 rounded-[28%] text-3xl md:text-4xl',
      text: 'text-3xl md:text-4xl'
    },
    xl: {
      container: 'gap-5',
      icon: 'w-16 h-16 md:w-20 md:h-20 rounded-[28%] text-4xl md:text-5xl',
      text: 'text-4xl md:text-5xl'
    },
    '2xl': {
      container: 'gap-6',
      icon: 'w-24 h-24 md:w-28 md:h-28 rounded-[28%] text-6xl md:text-7xl',
      text: 'text-6xl md:text-7xl'
    }
  };

  const currentSize = sizeClasses[size];

  // Exact Match Brand App Logo Icon: Solid Rounded Red Squircle with white uppercase italic 'S'
  const logoContent = showIcon && (
    <div className={cn(
      "bg-[#ee3e38] flex items-center justify-center transition-all select-none duration-250 active:scale-95 shrink-0 shadow-lg shadow-black/10", 
      currentSize.icon,
      imageClassName
    )}>
      <span 
        className="text-white font-sans leading-none flex items-center justify-center select-none"
        style={{
          fontFamily: '"Impact", "Bebas Neue", "Arial Black", "Inter", sans-serif',
          fontStyle: 'italic',
          fontWeight: 900,
          transform: 'translateX(0.5px)'
        }}
      >
        S
      </span>
    </div>
  );

  return (
    <Link to="/" className={cn("flex items-center group inline-flex select-none leading-none", currentSize.container, className)}>
      {logoContent}
      {showText && (
        <div className="flex flex-col items-start leading-none justify-center">
          {/* Wordmark: "SPORTSBOX" - italic heavy sans-serif where SPORTS is white and BOX is red-orange */}
          <span 
            className={cn(
              "uppercase whitespace-nowrap leading-none flex items-center select-none", 
              currentSize.text,
              textClassName
            )}
            style={{
              fontFamily: '"Impact", "Bebas Neue", "Arial Black", "Inter", sans-serif',
              fontStyle: 'italic',
              fontWeight: 900,
              letterSpacing: '-0.015em'
            }}
          >
            <span className="text-white">SPORTS</span>
            <span className="text-[#ee3e38]">BOX</span>
          </span>
        </div>
      )}
    </Link>
  );
}
