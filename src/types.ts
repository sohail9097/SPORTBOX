export type Category = 'football' | 'cricket' | 'basketball' | 'tennis' | 'others';
export type ContentType = 'live' | 'replay' | 'highlight';
export type Status = 'scheduled' | 'live' | 'ended';

export interface SportsContent {
  id: string;
  title: string;
  description: string;
  category: Category;
  type: ContentType;
  videoUrl: string;
  thumbnailUrl?: string;
  isPremium: boolean;
  viewCount: number;
  createdAt: string;
  status: Status;
  tags?: string[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  icon: string; // Icon name from lucide
  popular: boolean;
  order: number;
  color: string;
  offer?: {
    isActive: boolean;
    percentage: number; // 0 to 100
    label?: string; // e.g. "Limited Time"
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  mobileNumber?: string;
  isMobileVerified?: boolean;
  subscriptionTier: string;
  subscriptionStatus: 'active' | 'expired' | 'none';
  lastPaymentDate?: string;
  favorites: string[];
  watchLater?: string[];
  recentlyWatched?: string[];
  createdAt: string;
}

export interface ContentSection {
  id: string;
  title: string;
  page: 'home' | Category;
  contentIds: string[];
  type: 'normal' | 'top10' | 'single-row' | 'featured' | 'tournament' | 'hero';
  order: number;
  isActive: boolean;
  createdAt: string;
  aspectRatio?: 'landscape' | 'portrait';
}

export interface SliderElement {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  actionUrl: string;
  isLive: boolean;
  order: number;
  isActive: boolean;
  animationType?: 'fade' | 'slide';
  page?: 'home' | Category; // Added for per-page sliders
}

export interface VideoPromoSettings {
  isActive: boolean;
  title: string;
  description: string;
  videoUrl: string;
  embedCode?: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor: string;
}

export interface PlayerSettings {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  showControls: boolean;
  primaryColor: string;
  playbackRates: number[];
}

export interface SiteConfig {
  founderImageUrl?: string;
}
