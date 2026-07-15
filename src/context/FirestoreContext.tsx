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

  const hasFetchedRef = useRef(false);

  const fetchAll = async () => {
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
          setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching subscription plans:", err);
          setPlans([]);
        })
      ]);

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
