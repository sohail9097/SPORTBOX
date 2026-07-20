/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, getDoc, getDocs, doc, collection, query, orderBy, limit } from '../lib/firebase';
import { SiteConfig, ContentSection, SliderElement, SubscriptionPlan, SportsContent, VideoPromoSettings } from '../types';
import { FALLBACK_SITE_CONFIG, FALLBACK_SECTIONS, FALLBACK_SLIDER_ITEMS, FALLBACK_SPORTS_CONTENT, FALLBACK_PROMO, FALLBACK_LIVE_STATS } from '../lib/fallbackData';

interface FirestoreContextType {
  siteConfig: SiteConfig;
  videoPromo: VideoPromoSettings;
  liveStats: { totalViews?: number; liveCount?: number };
  sections: ContentSection[];
  slider: SliderElement[];
  plans: SubscriptionPlan[];
  content: SportsContent[];
  sports: any[];
  categories: any[];
  countries: any[];
  navigation: any[];
  loading: boolean;
  isDataLoaded: boolean;
  refetchAll: () => Promise<void>;
  updateSiteConfigState: (config: SiteConfig) => void;
  updateVideoPromoState: (promo: VideoPromoSettings) => void;
  updateLiveStatsState: (stats: { totalViews?: number; liveCount?: number }) => void;
  updatePlansState: (plans: SubscriptionPlan[]) => void;
  updateSectionsState: (sections: ContentSection[]) => void;
  updateSliderState: (slides: SliderElement[]) => void;
  updateContentState: (content: SportsContent[]) => void;
}

const FirestoreContext = createContext<FirestoreContextType | undefined>(undefined);

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Starter Pass',
    price: 0,
    description: 'Get a taste of high-quality sports events with our basic tier.',
    features: [
      'Access to select free live streams',
      'High Definition streaming quality',
      'Watch on mobile, tablet or web'
    ],
    icon: 'Zap',
    popular: false,
    order: 1,
    color: 'from-gray-500 to-gray-700'
  },
  {
    id: 'premium',
    name: 'Premium Season Pass',
    price: 499,
    description: 'Full un-throttled access to every match, tournament, and full replays.',
    features: [
      'Access to all premium live streams',
      'Ultra HD (4K) streaming quality',
      'Ad-free uninterrupted entertainment',
      'Exclusive full match replays & highlights',
      'Multi-view camera support'
    ],
    icon: 'Crown',
    popular: true,
    order: 2,
    color: 'from-yellow-500 to-amber-600',
    offer: {
      isActive: true,
      percentage: 20,
      label: 'Save 20%'
    }
  }
];

// ==========================================
// OPTIMIZATION #2: CLIENT-SIDE CACHING (IN-MEMORY & LOCAL STORAGE)
// Cache structure for persisting across session and page reloads.
// ==========================================
interface CacheData {
  siteConfig: SiteConfig;
  videoPromo: VideoPromoSettings;
  liveStats: { totalViews?: number; liveCount?: number };
  sections: ContentSection[];
  slider: SliderElement[];
  plans: SubscriptionPlan[];
  content: SportsContent[];
  timestamp: number;
}

const CACHE_KEY = 'sportsbox_firestore_cache_v1';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

// Persistent module-level memory cache to avoid ANY Firestore reads on route changes / mounts in same session
let inMemoryCache: CacheData | null = null;

function loadCache(): CacheData | null {
  if (inMemoryCache) {
    // Optimization #5: DEV LOGGING
    console.log("[Firestore Cache] Served successfully from in-memory cache (Same Session).");
    return inMemoryCache;
  }

  try {
    const serialized = localStorage.getItem(CACHE_KEY);
    if (serialized) {
      const parsed = JSON.parse(serialized);
      if (parsed && typeof parsed === 'object' && parsed.timestamp) {
        inMemoryCache = parsed as CacheData;
        console.log("[Firestore Cache] Served successfully from localStorage cache (Page Refresh).");
        return inMemoryCache;
      }
    }
  } catch (err) {
    console.warn("[Firestore Cache] Error reading cache from localStorage:", err);
  }

  return null;
}

function saveCache(data: Omit<CacheData, 'timestamp'>) {
  const cacheWithTime: CacheData = {
    ...data,
    timestamp: Date.now()
  };
  inMemoryCache = cacheWithTime;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheWithTime));
    console.log("[Firestore Cache] Cache successfully saved locally.");
  } catch (err) {
    console.warn("[Firestore Cache] Error saving cache to localStorage:", err);
  }
}

function isCacheValid(cache: CacheData | null): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.timestamp;
  return age < CACHE_TTL;
}

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(FALLBACK_SITE_CONFIG);
  const [videoPromo, setVideoPromo] = useState<VideoPromoSettings>(FALLBACK_PROMO);
  const [liveStats, setLiveStats] = useState<{ totalViews?: number; liveCount?: number }>(FALLBACK_LIVE_STATS);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [slider, setSlider] = useState<SliderElement[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [content, setContent] = useState<SportsContent[]>([]);
  const [sports, setSports] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [navigation, setNavigation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const hasFetchedRef = useRef(false);
  const fetchAllPromiseRef = useRef<Promise<void> | null>(null);

  const fetchAll = async (force = false) => {
    // If there is already an active parallel fetch, reuse its promise directly to prevent cache stampedes
    if (fetchAllPromiseRef.current) {
      console.log("[FirestoreProvider] Reusing in-flight fetchAll Promise lock.");
      return fetchAllPromiseRef.current;
    }

    // Optimization #2 & #4: Serves from cache immediately (SWR Pattern)
    const cached = loadCache();
    const hasValidCache = isCacheValid(cached);

    // ==========================================
    // OPTIMIZATION #4: AVOID REDUNDANT RE-FETCHES
    // If data is already in state and cache is still valid, completely short-circuit to avoid any DB calls.
    // ==========================================
    if (isDataLoaded && !force && hasValidCache) {
      console.log("[FirestoreProvider] fetchAll call short-circuited. App has valid cached data.");
      return;
    }

    // If cache is present (even if expired/stale), load it immediately to keep UI instantaneous
    if (cached && !isDataLoaded) {
      console.log("[FirestoreProvider] Instantly populating UI from local cache (Stale-While-Revalidate).");
      setSiteConfig(cached.siteConfig);
      setVideoPromo(cached.videoPromo);
      setLiveStats(cached.liveStats);
      setSections(cached.sections);
      setSlider(cached.slider);
      setPlans(cached.plans);
      setContent(cached.content);

      // Static collections are set directly
      setSports([{ id: 'cricket', name: 'Cricket' }, { id: 'football', name: 'Football' }]);
      setCategories([]);
      setCountries([]);
      setNavigation([]);

      setIsDataLoaded(true);
      setLoading(false);

      // If the cache is valid and not forced, we do not need to fetch from Firestore again
      if (hasValidCache && !force) {
        console.log("[FirestoreProvider] Cache is valid and fresh. Short-circuiting network request.");
        return;
      }
    }

    setLoading(true);
    const start = Date.now();
    
    if (cached && !hasValidCache) {
      console.log("[FirestoreProvider] Cache is expired. Revalidating in background from Firestore...");
    } else {
      console.log("[FirestoreProvider] Starting fresh Firestore collection network fetch...");
    }

    const promise = (async () => {
      try {
        // ==========================================
        // OPTIMIZATION #1: QUERY LIMITS
        // Cap queries with limit() to fetch only the documents actually needed.
        // slider -> limit(10) (HeroSlider carousel only renders up to 10 active slides)
        // content -> limit(100) (Covers dynamic sections, search page and category views without fetching entire DB)
        // sections -> limit(20) (Limits content section configurations)
        // subscription_plans -> limit(10) (Limits plans rendered on pricing grids)
        // ==========================================
        const [
          contentSnapResult,
          sectionsSnapResult,
          sliderSnapResult,
          plansSnapResult,
          siteConfigResult,
          videoPromoResult,
          liveStatsResult
        ] = await Promise.allSettled([
          getDocs(query(collection(db, 'content'), limit(100))),
          getDocs(query(collection(db, 'sections'), limit(20))),
          getDocs(query(collection(db, 'slider'), limit(10))),
          getDocs(query(collection(db, 'subscription_plans'), limit(10))),
          getDoc(doc(db, 'settings', 'siteConfig')),
          getDoc(doc(db, 'settings', 'videoPromo')),
          getDoc(doc(db, 'settings', 'liveStats'))
        ]);

        let freshContent: SportsContent[] = FALLBACK_SPORTS_CONTENT;
        let freshSections: ContentSection[] = FALLBACK_SECTIONS as any[];
        let freshSlider: SliderElement[] = FALLBACK_SLIDER_ITEMS as any[];
        let freshPlans: SubscriptionPlan[] = FALLBACK_PLANS;
        let freshSiteConfig: SiteConfig = FALLBACK_SITE_CONFIG;
        let freshVideoPromo: VideoPromoSettings = FALLBACK_PROMO;
        let freshLiveStats: { totalViews?: number; liveCount?: number } = FALLBACK_LIVE_STATS;

        // Optimization #5: DEV LOGGING
        console.log("[FirestoreProvider] Received responses from Firestore server / offline IndexedDB cache.");

        // 1. Content
        if (contentSnapResult.status === 'fulfilled' && !contentSnapResult.value.empty) {
          freshContent = contentSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent));
          setContent(freshContent);
          console.log(`[FirestoreProvider] Optimization #1 - Loaded ${freshContent.length} content items (Capped at 100).`);
        } else {
          if (contentSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Content query failed, using fallbacks:", contentSnapResult.reason);
          }
          setContent(FALLBACK_SPORTS_CONTENT);
        }

        // 2. Sections
        if (sectionsSnapResult.status === 'fulfilled' && !sectionsSnapResult.value.empty) {
          freshSections = sectionsSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as ContentSection));
          freshSections.sort((a, b) => (a.order || 0) - (b.order || 0));
          setSections(freshSections);
          console.log(`[FirestoreProvider] Optimization #1 - Loaded ${freshSections.length} sections (Capped at 20).`);
        } else {
          if (sectionsSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Sections query failed, using fallbacks:", sectionsSnapResult.reason);
          }
          setSections(FALLBACK_SECTIONS as any);
        }

        // 3. Slider
        if (sliderSnapResult.status === 'fulfilled' && !sliderSnapResult.value.empty) {
          freshSlider = sliderSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SliderElement));
          freshSlider.sort((a, b) => (a.order || 0) - (b.order || 0));
          setSlider(freshSlider);
          console.log(`[FirestoreProvider] Optimization #1 - Loaded ${freshSlider.length} slides (Capped at 10).`);
        } else {
          if (sliderSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Slider query failed, using fallbacks:", sliderSnapResult.reason);
          }
          setSlider(FALLBACK_SLIDER_ITEMS as any);
        }

        // 4. Plans
        if (plansSnapResult.status === 'fulfilled' && !plansSnapResult.value.empty) {
          freshPlans = plansSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
          freshPlans.sort((a, b) => (a.order || 0) - (b.order || 0));
          setPlans(freshPlans);
          console.log(`[FirestoreProvider] Optimization #1 - Loaded ${freshPlans.length} subscription plans (Capped at 10).`);
        } else {
          if (plansSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Plans query failed, using fallbacks:", plansSnapResult.reason);
          }
          setPlans(FALLBACK_PLANS);
        }

        // 5. Site Config
        if (siteConfigResult.status === 'fulfilled' && siteConfigResult.value.exists()) {
          freshSiteConfig = siteConfigResult.value.data() as SiteConfig;
          setSiteConfig(freshSiteConfig);
        } else {
          if (siteConfigResult.status === 'rejected') {
            console.warn("[FirestoreProvider] SiteConfig query failed, using fallbacks:", siteConfigResult.reason);
          }
          setSiteConfig(FALLBACK_SITE_CONFIG);
        }

        // 6. Video Promo Config
        if (videoPromoResult.status === 'fulfilled' && videoPromoResult.value.exists()) {
          freshVideoPromo = videoPromoResult.value.data() as VideoPromoSettings;
          setVideoPromo(freshVideoPromo);
        } else {
          if (videoPromoResult.status === 'rejected') {
            console.warn("[FirestoreProvider] VideoPromo query failed, using fallbacks:", videoPromoResult.reason);
          }
          setVideoPromo(FALLBACK_PROMO);
        }

        // 7. Live Stats
        if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value.exists()) {
          freshLiveStats = liveStatsResult.value.data() as { totalViews?: number; liveCount?: number };
          setLiveStats(freshLiveStats);
        } else {
          if (liveStatsResult.status === 'rejected') {
            console.warn("[FirestoreProvider] LiveStats query failed, using fallbacks:", liveStatsResult.reason);
          }
          setLiveStats(FALLBACK_LIVE_STATS);
        }

        // Save fresh fetched data to client caches (Optimization #2)
        saveCache({
          siteConfig: freshSiteConfig,
          videoPromo: freshVideoPromo,
          liveStats: freshLiveStats,
          sections: freshSections,
          slider: freshSlider,
          plans: freshPlans,
          content: freshContent
        });

        // Flip the loaded flag to true
        setIsDataLoaded(true);
        setIsConfigLoaded(true);

        // Static helper lists
        setSports([{ id: 'cricket', name: 'Cricket' }, { id: 'football', name: 'Football' }]);
        setCategories([]);
        setCountries([]);
        setNavigation([]);

      } catch (e) {
        console.error("[FirestoreProvider] Error pre-fetching, attempting cache fallback:", e);
        // Fallback to cached data even if expired if we encounter severe network errors
        const fallbackCached = loadCache();
        if (fallbackCached) {
          setContent(fallbackCached.content);
          setSections(fallbackCached.sections);
          setSlider(fallbackCached.slider);
          setPlans(fallbackCached.plans);
          setSiteConfig(fallbackCached.siteConfig);
          setVideoPromo(fallbackCached.videoPromo);
          setLiveStats(fallbackCached.liveStats);
        } else {
          setContent(FALLBACK_SPORTS_CONTENT);
          setSections(FALLBACK_SECTIONS as any);
          setSlider(FALLBACK_SLIDER_ITEMS as any);
          setPlans(FALLBACK_PLANS);
          setSiteConfig(FALLBACK_SITE_CONFIG);
          setVideoPromo(FALLBACK_PROMO);
          setLiveStats(FALLBACK_LIVE_STATS);
        }
      } finally {
        setLoading(false);
        fetchAllPromiseRef.current = null;
        console.log(`[FirestoreProvider] Pre-fetch finalized. Net time: ${Date.now() - start}ms`);
      }
    })();

    fetchAllPromiseRef.current = promise;
    return promise;
  };

  const fetchConfigOnly = async (force = false) => {
    // Optimization #2 & #4: Serves from cache immediately (SWR Pattern)
    const cached = loadCache();
    const hasValidCache = isCacheValid(cached);

    if (isConfigLoaded && !force && hasValidCache) {
      console.log("[FirestoreProvider] fetchConfigOnly call short-circuited. Config is valid.");
      return;
    }

    if (cached && !isConfigLoaded) {
      console.log("[FirestoreProvider] Instantly populating Site Config from local cache.");
      setSiteConfig(cached.siteConfig);
      setLiveStats(cached.liveStats);
      setVideoPromo(cached.videoPromo || FALLBACK_PROMO);
      setIsConfigLoaded(true);
      setLoading(false);

      if (hasValidCache && !force) {
        return;
      }
    }

    setLoading(true);
    try {
      console.log("[FirestoreProvider] Fetching minimal layout config only...");
      const [siteConfigResult, liveStatsResult] = await Promise.allSettled([
        getDoc(doc(db, 'settings', 'siteConfig')),
        getDoc(doc(db, 'settings', 'liveStats'))
      ]);

      let freshSiteConfig = siteConfig ? siteConfig : FALLBACK_SITE_CONFIG;
      let freshLiveStats = liveStats ? liveStats : FALLBACK_LIVE_STATS;

      if (siteConfigResult.status === 'fulfilled' && siteConfigResult.value.exists()) {
        freshSiteConfig = siteConfigResult.value.data() as SiteConfig;
        setSiteConfig(freshSiteConfig);
      }
      if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value.exists()) {
        freshLiveStats = liveStatsResult.value.data() as { totalViews?: number; liveCount?: number };
        setLiveStats(freshLiveStats);
      }

      setIsConfigLoaded(true);

      const existingCache = cached || {
        siteConfig: FALLBACK_SITE_CONFIG,
        videoPromo: FALLBACK_PROMO,
        liveStats: FALLBACK_LIVE_STATS,
        sections: [],
        slider: [],
        plans: [],
        content: []
      };

      saveCache({
        ...existingCache,
        siteConfig: freshSiteConfig,
        liveStats: freshLiveStats
      });
    } catch (err) {
      console.error("[FirestoreProvider] Error fetching config only:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Optimization #4: Avoid redundant execution on re-mounts
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const isWatchPage = window.location.pathname.startsWith('/watch/');
    if (isWatchPage) {
      console.log("[FirestoreProvider] Initial mount on Watch page. Loading config only.");
      fetchConfigOnly();
    } else {
      console.log("[FirestoreProvider] Initial mount on standard page. Loading full fetchAll.");
      fetchAll();
    }
  }, []);

  const updateSiteConfigState = (config: SiteConfig) => setSiteConfig(config);
  const updateVideoPromoState = (promo: VideoPromoSettings) => setVideoPromo(promo);
  const updateLiveStatsState = (stats: { totalViews?: number; liveCount?: number }) => setLiveStats(stats);
  const updatePlansState = (newPlans: SubscriptionPlan[]) => setPlans(newPlans);
  const updateSectionsState = (newSections: ContentSection[]) => setSections(newSections);
  const updateSliderState = (newSlides: SliderElement[]) => setSlider(newSlides);
  const updateContentState = (newContent: SportsContent[]) => setContent(newContent);

  return (
    <FirestoreContext.Provider value={{
      siteConfig,
      videoPromo,
      liveStats,
      sections,
      slider,
      plans,
      content,
      sports,
      categories,
      countries,
      navigation,
      loading,
      isDataLoaded,
      refetchAll: () => fetchAll(true),
      updateSiteConfigState,
      updateVideoPromoState,
      updateLiveStatsState,
      updatePlansState,
      updateSectionsState,
      updateSliderState,
      updateContentState
    }}>
      {children}
    </FirestoreContext.Provider>
  );
}

export function useFirestoreCache() {
  const context = useContext(FirestoreContext);
  if (context === undefined) {
    throw new Error('useFirestoreCache must be used within a FirestoreProvider');
  }

  useEffect(() => {
    const isWatchPage = window.location.pathname.startsWith('/watch/');
    if (!isWatchPage && !context.isDataLoaded && !context.loading) {
      console.log("[useFirestoreCache] Non-watch page requires full data. Triggering fetchAll...");
      context.refetchAll();
    }
  }, [context.isDataLoaded, context.loading, context.refetchAll]);

  return context;
}
