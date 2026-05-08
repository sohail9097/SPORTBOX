import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  logoUrl?: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  showIcon?: boolean;
}

export default function BrandLogo({ 
  logoUrl, 
  className, 
  imageClassName, 
  textClassName,
  size = 'md',
  showText = true,
  showIcon = true
}: BrandLogoProps) {
  
  const sizeClasses = {
    sm: 'w-5 h-5 text-sm',
    md: 'w-8 h-8 text-xl',
    lg: 'w-10 h-10 text-2xl',
    xl: 'w-12 h-12 text-3xl',
    '2xl': 'w-16 h-16 text-4xl'
  };

  const iconSize = {
    sm: 'text-xs',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-4xl'
  };

  const logoContent = showIcon && (
    <div className={cn(
      "bg-[#ee3e38] rounded-[22%] flex items-center justify-center transition-transform", 
      sizeClasses[size].split(' ')[0], 
      sizeClasses[size].split(' ')[1],
      imageClassName
    )}>
      <span className={cn(
        "text-white leading-none font-black italic", 
        iconSize[size]
      )}>S</span>
    </div>
  );

  return (
    <Link to="/" className={cn("flex items-center gap-2 group inline-flex", className)}>
      {logoContent}
      {showText && (
        <span className={cn(
          "font-black italic uppercase tracking-tighter text-white select-none whitespace-nowrap", 
          sizeClasses[size].split(' ')[2],
          textClassName
        )}>
          SPORTS<span className="text-[#ee3e38]">BOX</span>
        </span>
      )}
    </Link>
  );
}
