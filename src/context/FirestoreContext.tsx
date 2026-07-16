import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, getDoc, getDocs, doc, collection, query, orderBy } from '../lib/firebase';
import { SiteConfig, ContentSection, SliderElement, SubscriptionPlan } from '../types';
import { FALLBACK_SITE_CONFIG, FALLBACK_SECTIONS, FALLBACK_SLIDER_ITEMS } from '../lib/fallbackData';

interface FirestoreContextType {
  siteConfig: SiteConfig;
  sections: ContentSection[];
  slider: SliderElement[];
  plans: SubscriptionPlan[];
  sports: any[];
  categories: any[];
  countries: any[];
  navigation: any[];
  loading: boolean;
  refetchAll: () => Promise<void>;
  updateSiteConfigState: (config: SiteConfig) => void;
  updatePlansState: (plans: SubscriptionPlan[]) => void;
  updateSectionsState: (sections: ContentSection[]) => void;
  updateSliderState: (slides: SliderElement[]) => void;
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
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [slider, setSlider] = useState<SliderElement[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [sports, setSports] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [navigation, setNavigation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const hasFetchedRef = useRef(false);

  const fetchAll = async () => {
    // Preventive guard clause: If already loaded, completely short-circuit to block redundant network reads
    if (isDataLoaded) {
      console.log("[FirestoreProvider] fetchAll call short-circuited. Data is locked and loaded.");
      return;
    }

    setLoading(true);
    const start = Date.now();
    console.log("[FirestoreProvider] Starting optimized pre-fetch...");

    try {
      // 🚀 Optimization: Only fetch essential dynamic configs from network, rely on fallbacks or cache
      await Promise.all([
        // 1. Site Config (Single Doc - Safe)
        getDoc(doc(db, 'settings', 'siteConfig')).then(snap => {
          if (snap.exists()) {
            setSiteConfig(prev => ({ ...prev, ...snap.data() }));
          } else {
            setSiteConfig(FALLBACK_SITE_CONFIG);
          }
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching settings/siteConfig, using fallback:", err);
          setSiteConfig(FALLBACK_SITE_CONFIG);
        }),

        // 2. Sections (Optimized Fallback Integration)
        getDocs(collection(db, 'sections')).then(snap => {
          if (snap.empty) {
            setSections(FALLBACK_SECTIONS as any);
          } else {
            setSections(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentSection)));
          }
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching sections, using fallback:", err);
          setSections(FALLBACK_SECTIONS as any);
        }),

        // 3. Slider
        getDocs(collection(db, 'slider')).then(snap => {
          if (snap.empty) {
            setSlider(FALLBACK_SLIDER_ITEMS as any);
          } else {
            setSlider(snap.docs.map(d => ({ id: d.id, ...d.data() } as SliderElement)));
          }
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching slider, using fallback:", err);
          setSlider(FALLBACK_SLIDER_ITEMS as any);
        }),

        // 4. Subscription Plans
        getDocs(query(collection(db, 'subscription_plans'), orderBy('order', 'asc'))).then(snap => {
          if (snap.empty) {
            setPlans(FALLBACK_PLANS);
          } else {
            setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
          }
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching subscription plans, using fallback:", err);
          setPlans(FALLBACK_PLANS);
        })
      ]);

      // Flip the flag to true only after a successful Promise.all resolution
      setIsDataLoaded(true);

      // 5. Static collections are set directly to avoid extra queries on navigation
      setSports([{ id: 'cricket', name: 'Cricket' }, { id: 'football', name: 'Football' }]);
      setCategories([]);
      setCountries([]);
      setNavigation([]);

    } catch (e) {
      console.error("[FirestoreProvider] Critical error pre-fetching:", e);
    } finally {
      setLoading(false);
      console.log(`[FirestoreProvider] Pre-fetch complete. Duration: ${Date.now() - start}ms`);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchAll();
  }, []);

  const updateSiteConfigState = (config: SiteConfig) => setSiteConfig(config);
  const updatePlansState = (newPlans: SubscriptionPlan[]) => setPlans(newPlans);
  const updateSectionsState = (newSections: ContentSection[]) => setSections(newSections);
  const updateSliderState = (newSlides: SliderElement[]) => setSlider(newSlides);

  return (
    <FirestoreContext.Provider value={{
      siteConfig,
      sections,
      slider,
      plans,
      sports,
      categories,
      countries,
      navigation,
      loading,
      refetchAll: fetchAll,
      updateSiteConfigState,
      updatePlansState,
      updateSectionsState,
      updateSliderState
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
