import { SportsContent, SliderElement, ContentSection, BlogPost, SiteConfig, VideoPromoSettings } from '../types';

// Robust, high-fidelity sample MP4 streams
const VIDEO_LINKS = {
  cricket: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  football: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  wrestling: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  kabaddi: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  boxing: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  watersports: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  stunts: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  polo: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  olympics: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
};

export const FALLBACK_SPORTS_CONTENT: SportsContent[] = [
  // Live Streams
  {
    id: 'live_football_1',
    title: 'La Liga Live: Real Madrid vs Barcelona',
    description: 'Experience the El Clásico live with multi-cam angles, ultra HD stream, and live pitch-side audio. Watch the biggest football rivalry unfold in real-time.',
    category: 'football',
    type: 'live',
    videoUrl: VIDEO_LINKS.football,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
    isPremium: true,
    viewCount: 14820,
    likes: 2450,
    createdAt: new Date().toISOString(),
    status: 'live',
    tags: ['El Clásico', 'Live', 'La Liga', 'LaLiga'],
    scheduledTime: new Date().toISOString()
  },
  {
    id: 'live_cricket_1',
    title: 'World Championship Finals: India vs Australia',
    description: 'The ultimate cricket showdown of the season. Catch every over, boundary, and wicket live in spectacular HDR quality with expert English and Hindi commentary.',
    category: 'cricket',
    type: 'live',
    videoUrl: VIDEO_LINKS.cricket,
    thumbnailUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=800',
    isPremium: false,
    viewCount: 28910,
    likes: 5630,
    createdAt: new Date().toISOString(),
    status: 'live',
    tags: ['World Cup', 'Live', 'IND vs AUS', 'Finals'],
    scheduledTime: new Date().toISOString()
  },
  {
    id: 'live_kabaddi_1',
    title: 'Pro Kabaddi Cup: Patna Pirates vs Bengal Warriors',
    description: 'High-octane kabaddi raid and defense clashes live. Watch top raiders clash in this nail-biting encounter of the elite championship.',
    category: 'kabaddi',
    type: 'live',
    videoUrl: VIDEO_LINKS.kabaddi,
    thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800',
    isPremium: false,
    viewCount: 8430,
    likes: 1290,
    createdAt: new Date().toISOString(),
    status: 'live',
    tags: ['Pro Kabaddi', 'Live', 'Raiders', 'Championship']
  },

  // Highlights & Replays - Cricket
  {
    id: 'cricket_highlights_1',
    title: 'IND vs PAK Final T20: Last Over Thriller Highlights',
    description: 'Relive the heart-stopping last over of the final match as India defends 12 runs to lift the historic T20 Championship trophy.',
    category: 'cricket',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.cricket,
    thumbnailUrl: 'https://images.unsplash.com/photo-1540747737956-37872404a87a?q=80&w=800',
    isPremium: false,
    viewCount: 45290,
    likes: 8120,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'ended',
    tags: ['Thriller', 'Highlights', 'IND vs PAK', 'Classic']
  },
  {
    id: 'cricket_replay_1',
    title: 'Full Match Replay: Ashes Series 5th Test Day 5',
    description: 'The complete uninterrupted Day 5 replay of the iconic Ashes Test. Watch every session of this legendary battle of endurance and skill.',
    category: 'cricket',
    type: 'replay',
    videoUrl: VIDEO_LINKS.cricket,
    thumbnailUrl: 'https://images.unsplash.com/photo-1607962837359-5e7e89f866ad?q=80&w=800',
    isPremium: true,
    viewCount: 12050,
    likes: 980,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    status: 'ended',
    tags: ['Ashes', 'Replay', 'Test Cricket', 'Full Match']
  },

  // Football Highlights
  {
    id: 'football_highlights_1',
    title: 'Champions Cup Semis: Manchester Derby Highlights',
    description: 'A 5-goal thriller at the Etihad! Catch all goals, assists, controversial VAR calls, and post-match reactions from this spectacular derby.',
    category: 'football',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.football,
    thumbnailUrl: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=800',
    isPremium: false,
    viewCount: 38400,
    likes: 4720,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    status: 'ended',
    tags: ['Derby', 'Goals', 'Champions League', 'Highlights']
  },

  // Wrestling & Boxing
  {
    id: 'wrestling_highlights_1',
    title: 'Championship Bout: Heavyweight Gold Medal Match',
    description: 'Relive the epic wrestling match that went down to the final seconds. See the masterclass of pins, reversals, and sheer technical dominance.',
    category: 'wrestling',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.wrestling,
    thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800',
    isPremium: true,
    viewCount: 9540,
    likes: 810,
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    status: 'ended',
    tags: ['Heavyweight', 'Gold Medal', 'Wrestling', 'Highlights']
  },
  {
    id: 'boxing_replay_1',
    title: 'Full Fight: World Boxing Title Defending Match',
    description: 'The complete, uncut 12-round battle for the World Heavyweight Title belt. Experience the technical sparring, powerful knockdowns, and dramatic split-decision.',
    category: 'boxing',
    type: 'replay',
    videoUrl: VIDEO_LINKS.boxing,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800',
    isPremium: true,
    viewCount: 22010,
    likes: 3100,
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    status: 'ended',
    tags: ['Heavyweight', 'Title Fight', 'Boxing', 'Full Replay']
  },

  // Others & Extreme Sports
  {
    id: 'watersports_highlights_1',
    title: 'Surf Masters: Riding the Giant Mavericks Waves',
    description: 'Watch elite surfers conquer 50-foot monster waves at Mavericks. Spectacular high-definition camera angles showing pure adrenaline and courage.',
    category: 'watersports',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.watersports,
    thumbnailUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=800',
    isPremium: false,
    viewCount: 18450,
    likes: 2710,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'ended',
    tags: ['Surfing', 'Mavericks', 'Extreme Sports', 'Giant Waves']
  },
  {
    id: 'stunts_highlights_1',
    title: 'MTB Downhill Madness: Extreme Forest Trail Decent',
    description: 'Helmet-cam perspective of an insane, high-speed mountain bike descent down steep cliffs and tight woodland tracks.',
    category: 'stunts',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.stunts,
    thumbnailUrl: 'https://images.unsplash.com/photo-1568285519808-115fef54e8ab?q=80&w=800',
    isPremium: false,
    viewCount: 29840,
    likes: 4120,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    status: 'ended',
    tags: ['MTB', 'Downhill', 'Extreme Sports', 'Helmet Cam']
  },
  {
    id: 'polo_highlights_1',
    title: 'The Royal Polo Cup: Golden Trophy Finals',
    description: 'The elegant and fierce clash of the top polo clubs in the Royal Tournament. Highlighting key defensive plays and spectacular equestrian control.',
    category: 'polo',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.polo,
    thumbnailUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800',
    isPremium: true,
    viewCount: 5410,
    likes: 490,
    createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    status: 'ended',
    tags: ['Polo', 'Royal Cup', 'Championship', 'Equestrian']
  },

  // Olympics content
  {
    id: 'olympics_highlights_1',
    title: 'Historic Gold: Javelin Throw Finals & Podium Ceremony',
    description: 'Watch the historic record-breaking 89.94m javelin throw that secured the Gold Medal. Includes the complete national anthem and emotional podium ceremony.',
    category: 'olympics',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.olympics,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
    isPremium: false,
    viewCount: 55900,
    likes: 12900,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'ended',
    tags: ['Javelin', 'Gold Medal', 'Podium', 'Olympics']
  },
  {
    id: 'olympics_highlights_2',
    title: 'Athletics: 100m Sprint Finals - Photo Finish',
    description: 'The fastest 10 seconds in sport. Watch the super slow-motion review of the spectacular photo finish separating the top three world-class sprinters.',
    category: 'olympics',
    type: 'highlight',
    videoUrl: VIDEO_LINKS.olympics,
    thumbnailUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=800',
    isPremium: false,
    viewCount: 42090,
    likes: 8300,
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    status: 'ended',
    tags: ['Athletics', '100m Sprint', 'Photo Finish', 'Olympics']
  }
];

export const FALLBACK_SHORTS: SportsContent[] = [
  {
    id: 'short_1',
    title: 'Incredible Backheel Goal!',
    description: 'An absolute wizard move in front of the goalkeeper. Sensational reflexes and control.',
    category: 'football',
    type: 'short',
    videoUrl: VIDEO_LINKS.football,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
    isPremium: false,
    viewCount: 154300,
    likes: 12400,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Goal', 'Skill', 'Football', 'Shorts']
  },
  {
    id: 'short_2',
    title: 'Insane One-Handed Catch in Slips!',
    description: 'Unbelievable diving catch that stunned the entire stadium! Catch of the decade!',
    category: 'cricket',
    type: 'short',
    videoUrl: VIDEO_LINKS.cricket,
    thumbnailUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=800',
    isPremium: false,
    viewCount: 245000,
    likes: 19800,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Catch', 'Cricket', 'Amazing', 'Shorts']
  },
  {
    id: 'short_3',
    title: 'Double Pin Reversal Move!',
    description: 'Fierce technique and power displayed in this wrestling reversal. Watch till the end!',
    category: 'wrestling',
    type: 'short',
    videoUrl: VIDEO_LINKS.wrestling,
    thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800',
    isPremium: false,
    viewCount: 89000,
    likes: 4300,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Wrestling', 'Reversal', 'Power', 'Shorts']
  },
  {
    id: 'short_4',
    title: 'Spectacular Raider Escape!',
    description: 'Diving over the defensive wall to score 3 points in a critical Pro Kabaddi raid!',
    category: 'kabaddi',
    type: 'short',
    videoUrl: VIDEO_LINKS.kabaddi,
    thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800',
    isPremium: false,
    viewCount: 112000,
    likes: 9100,
    createdAt: new Date().toISOString(),
    status: 'ended',
    tags: ['Kabaddi', 'Raid', 'Escape', 'Shorts']
  }
];

export const FALLBACK_SLIDER_ITEMS: SliderElement[] = [
  {
    id: 'slide_1',
    title: 'T20 Championship Finals',
    description: 'Watch the ultimate battle between the world giants. Live coverage, multi-cam analysis, and real-time statistics.',
    imageUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1600',
    videoUrl: VIDEO_LINKS.cricket,
    actionUrl: '/watch/live_cricket_1',
    isLive: true,
    order: 1,
    isActive: true,
    animationType: 'fade',
    page: 'home'
  },
  {
    id: 'slide_2',
    title: 'El Clásico: Real Madrid vs Barcelona',
    description: 'The world stands still for the most intense rivalry. Subscribe now to access the premium 4K HDR live stream.',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600',
    videoUrl: VIDEO_LINKS.football,
    actionUrl: '/watch/live_football_1',
    isLive: true,
    order: 2,
    isActive: true,
    animationType: 'slide',
    page: 'home'
  },
  {
    id: 'slide_3',
    title: 'Extreme Mountain Biking Downhill',
    description: 'Hold your breath as riders descend steep canyon trails. Uncut highlights and incredible POV camera action.',
    imageUrl: 'https://images.unsplash.com/photo-1568285519808-115fef54e8ab?q=80&w=1600',
    videoUrl: VIDEO_LINKS.stunts,
    actionUrl: '/watch/stunts_highlights_1',
    isLive: false,
    order: 3,
    isActive: true,
    animationType: 'fade',
    page: 'home'
  }
];

export const FALLBACK_SECTIONS: ContentSection[] = [
  {
    id: 'sec_live',
    title: 'Live Streams',
    page: 'home',
    contentIds: ['live_football_1', 'live_cricket_1', 'live_kabaddi_1'],
    type: 'featured',
    order: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    aspectRatio: 'landscape'
  },
  {
    id: 'sec_trending',
    title: 'Trending Highlights',
    page: 'home',
    contentIds: ['cricket_highlights_1', 'football_highlights_1', 'olympics_highlights_1', 'watersports_highlights_1'],
    type: 'normal',
    order: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    aspectRatio: 'landscape'
  },
  {
    id: 'sec_replays',
    title: 'Full Match Replays',
    page: 'home',
    contentIds: ['cricket_replay_1', 'boxing_replay_1'],
    type: 'single-row',
    order: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    aspectRatio: 'landscape'
  }
];

export const FALLBACK_BLOGS: BlogPost[] = [
  {
    id: 'blog_1',
    title: 'The Rise of Modern Kabaddi: From Rural Dust to Global Glitz',
    excerpt: 'An in-depth analysis of how a simple rural game was transformed into one of the most-watched professional sport leagues in Asia.',
    content: `Kabaddi is no longer just a playground sport played in local villages of South Asia. Over the last decade, it has witnessed a massive commercial explosion, primarily driven by the inception of the Pro Kabaddi League. 

    Combining athletic agility, swift decision making, and tremendous stamina, Kabaddi is uniquely spectator-friendly. Each raid lasts exactly 30 seconds, keeping viewers on the edge of their seats. With modern, colorful mats, bright stadium lights, multi-language broadcasts, and massive corporate backings, the sport has found an entirely new audience of millions. Let's delve into the metrics behind this phenomenal growth.`,
    category: 'Kabaddi',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800',
    author: 'Sunil Sharma',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    readTime: '4 min read',
    likesCount: 1420,
    views: 8900,
    tags: ['Kabaddi', 'Pro Kabaddi', 'Sports Growth']
  },
  {
    id: 'blog_2',
    title: 'Tactical Review: How Real Madrid Outplayed Barcelona in the El Clásico',
    excerpt: 'Dissecting the midfield shape, pressing triggers, and critical transitional plays that decided the clash of the titans.',
    content: `The latest El Clásico delivered tactical brilliance as Real Madrid dominated the midfield battleground to secure a crucial 3-1 victory at home. 

    Real Madrid deployed a compact 4-4-2 diamond structure in possession, which effectively squeezed Barcelona's creative playmakers in the central channels. By triggering their aggressive high-press only when the ball went to Barcelona's fullbacks, Madrid forced long clearances and dominated second-ball recoveries. In this breakdown, we examine heatmaps, player positions, and tactical decisions of the managers in detail.`,
    category: 'Football',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800',
    author: 'Elena Rostova',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    readTime: '6 min read',
    likesCount: 2310,
    views: 12400,
    tags: ['Tactics', 'Football', 'La Liga', 'Analysis']
  },
  {
    id: 'blog_3',
    title: 'Mental Grit: The Psychological Training of Olympic Champions',
    excerpt: 'What goes through the mind of an athlete during the high-pressure finals? Sports psychologists share the routine of gold medalists.',
    content: `Physical training is only half the battle. At the Olympic level, where the margin between first and fifth place can be a hundredth of a second, the mind is the ultimate differentiator. 

    Elite athletes spend hours practicing visualization, diaphragmatic breathing loops, and cognitive reframing to control their cortisol levels during high-stress matches. Discover the three fundamental mental exercises that any sports enthusiast can adopt to dramatically improve their focus and performance under pressure.`,
    category: 'Olympics',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=800',
    author: 'Dr. Marcus Vance',
    createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    readTime: '5 min read',
    likesCount: 940,
    views: 4500,
    tags: ['Psychology', 'Olympics', 'Fitness', 'Mindset']
  }
];

export const FALLBACK_PROMO: VideoPromoSettings = {
  isActive: true,
  title: 'Premium Season Pass',
  description: 'Unlock direct access to all matches, custom full HD player interfaces, multi-view feeds, and live interactive match statistics for just $4.99/mo.',
  videoUrl: VIDEO_LINKS.olympics,
  buttonText: 'Get Premium Pass',
  buttonUrl: '/plans',
  backgroundColor: '#111827'
};

export const FALLBACK_SITE_CONFIG: SiteConfig = {
  founderImageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
  logoUrl: ''
};
