import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, getDoc, getDocs, doc, collection, query, orderBy } from '../lib/firebase';
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

  const hasFetchedRef = useRef(false);
  const fetchAllPromiseRef = useRef<Promise<void> | null>(null);

  const fetchAll = async (force = false) => {
    // If there is already an active parallel fetch, reuse its promise directly to prevent cache stampedes
    if (fetchAllPromiseRef.current) {
      console.log("[FirestoreProvider] Reusing in-flight fetchAll Promise lock.");
      return fetchAllPromiseRef.current;
    }

    // Preventive guard clause: If already loaded, completely short-circuit to block redundant network reads
    if (isDataLoaded && !force) {
      console.log("[FirestoreProvider] fetchAll call short-circuited. Data is locked and loaded.");
      return;
    }

    setLoading(true);
    const start = Date.now();
    console.log("[FirestoreProvider] Starting optimized parallel pre-fetch...");

    const promise = (async () => {
      try {
        const [
          contentSnapResult,
          sectionsSnapResult,
          sliderSnapResult,
          plansSnapResult,
          siteConfigResult,
          videoPromoResult,
          liveStatsResult
        ] = await Promise.allSettled([
          getDocs(collection(db, 'content')),
          getDocs(collection(db, 'sections')),
          getDocs(collection(db, 'slider')),
          getDocs(collection(db, 'subscription_plans')),
          getDoc(doc(db, 'settings', 'siteConfig')),
          getDoc(doc(db, 'settings', 'videoPromo')),
          getDoc(doc(db, 'settings', 'liveStats'))
        ]);

        // 1. Content
        if (contentSnapResult.status === 'fulfilled' && !contentSnapResult.value.empty) {
          setContent(contentSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
        } else {
          if (contentSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Content query failed, using fallbacks:", contentSnapResult.reason);
          }
          setContent(FALLBACK_SPORTS_CONTENT);
        }

        // 2. Sections
        if (sectionsSnapResult.status === 'fulfilled' && !sectionsSnapResult.value.empty) {
          const fetchedSections = sectionsSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as ContentSection));
          fetchedSections.sort((a, b) => (a.order || 0) - (b.order || 0));
          setSections(fetchedSections);
        } else {
          if (sectionsSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Sections query failed, using fallbacks:", sectionsSnapResult.reason);
          }
          setSections(FALLBACK_SECTIONS as any);
        }

        // 3. Slider
        if (sliderSnapResult.status === 'fulfilled' && !sliderSnapResult.value.empty) {
          const fetchedSlider = sliderSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SliderElement));
          fetchedSlider.sort((a, b) => (a.order || 0) - (b.order || 0));
          setSlider(fetchedSlider);
        } else {
          if (sliderSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Slider query failed, using fallbacks:", sliderSnapResult.reason);
          }
          setSlider(FALLBACK_SLIDER_ITEMS as any);
        }

        // 4. Plans
        if (plansSnapResult.status === 'fulfilled' && !plansSnapResult.value.empty) {
          const fetchedPlans = plansSnapResult.value.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
          fetchedPlans.sort((a, b) => (a.order || 0) - (b.order || 0));
          setPlans(fetchedPlans);
        } else {
          if (plansSnapResult.status === 'rejected') {
            console.warn("[FirestoreProvider] Plans query failed, using fallbacks:", plansSnapResult.reason);
          }
          setPlans(FALLBACK_PLANS);
        }

        // 5. Site Config
        if (siteConfigResult.status === 'fulfilled' && siteConfigResult.value.exists()) {
          setSiteConfig(siteConfigResult.value.data() as SiteConfig);
        } else {
          if (siteConfigResult.status === 'rejected') {
            console.warn("[FirestoreProvider] SiteConfig query failed, using fallbacks:", siteConfigResult.reason);
          }
          setSiteConfig(FALLBACK_SITE_CONFIG);
        }

        // 6. Video Promo Config
        if (videoPromoResult.status === 'fulfilled' && videoPromoResult.value.exists()) {
          setVideoPromo(videoPromoResult.value.data() as VideoPromoSettings);
        } else {
          if (videoPromoResult.status === 'rejected') {
            console.warn("[FirestoreProvider] VideoPromo query failed, using fallbacks:", videoPromoResult.reason);
          }
          setVideoPromo(FALLBACK_PROMO);
        }

        // 7. Live Stats
        if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value.exists()) {
          setLiveStats(liveStatsResult.value.data() as { totalViews?: number; liveCount?: number });
        } else {
          if (liveStatsResult.status === 'rejected') {
            console.warn("[FirestoreProvider] LiveStats query failed, using fallbacks:", liveStatsResult.reason);
          }
          setLiveStats(FALLBACK_LIVE_STATS);
        }

        // Flip the flag to true only after successful resolution
        setIsDataLoaded(true);

        // Static collections are set directly to avoid extra queries on navigation
        setSports([{ id: 'cricket', name: 'Cricket' }, { id: 'football', name: 'Football' }]);
        setCategories([]);
        setCountries([]);
        setNavigation([]);

      } catch (e) {
        console.error("[FirestoreProvider] Critical error pre-fetching, using fallback:", e);
        setContent(FALLBACK_SPORTS_CONTENT);
        setSections(FALLBACK_SECTIONS as any);
        setSlider(FALLBACK_SLIDER_ITEMS as any);
        setPlans(FALLBACK_PLANS);
        setSiteConfig(FALLBACK_SITE_CONFIG);
        setVideoPromo(FALLBACK_PROMO);
        setLiveStats(FALLBACK_LIVE_STATS);
      } finally {
        setLoading(false);
        fetchAllPromiseRef.current = null;
        console.log(`[FirestoreProvider] Pre-fetch complete. Duration: ${Date.now() - start}ms`);
      }
    })();

    fetchAllPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchAll();
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
  return context;
}
