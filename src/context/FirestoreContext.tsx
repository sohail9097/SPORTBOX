import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, getDoc, getDocs, doc, collection, query, orderBy, where, limit } from '../lib/firebase';
import { SiteConfig, ContentSection, SliderElement, SubscriptionPlan } from '../types';
import { FALLBACK_SITE_CONFIG } from '../lib/fallbackData';

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
    console.log("[FirestoreProvider] Starting parallel pre-fetch of global static configs...");

    try {
      await Promise.all([
        // 1. Site Config
        getDoc(doc(db, 'settings', 'siteConfig'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch global site config'
        }).then(snap => {
          if (snap.exists()) {
            setSiteConfig(prev => ({ ...prev, ...snap.data() }));
            console.log("[FirestoreProvider] Cache pre-fetched settings/siteConfig successfully.");
          } else {
            setSiteConfig(FALLBACK_SITE_CONFIG);
          }
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching settings/siteConfig:", err);
          setSiteConfig(FALLBACK_SITE_CONFIG);
        }),

        // 2. Sections
        getDocs(collection(db, 'sections'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch content sections list'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentSection));
          setSections(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} content sections successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching sections:", err);
          setSections([]);
        }),

        // 3. Slider Elements
        getDocs(collection(db, 'slider'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch hero promotion slider elements'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SliderElement));
          setSlider(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} hero slider elements successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching slider elements:", err);
          setSlider([]);
        }),

        // 4. Subscription Plans
        getDocs(query(collection(db, 'subscription_plans'), orderBy('order', 'asc')), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch subscription plans'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
          setPlans(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} subscription plans successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching subscription plans:", err);
          setPlans([]);
        }),

        // 5. Sports
        getDocs(collection(db, 'sports'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch sports list'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setSports(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} sports successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching sports:", err);
        }),

        // 6. Categories
        getDocs(collection(db, 'categories'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch categories list'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setCategories(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} categories successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching categories:", err);
        }),

        // 7. Countries
        getDocs(collection(db, 'countries'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch countries list'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setCountries(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} countries successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching countries:", err);
        }),

        // 8. Navigation
        getDocs(collection(db, 'navigation'), {
          component: 'FirestoreProvider',
          file: 'FirestoreContext.tsx',
          reason: 'Pre-fetch navigation list'
        }).then(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setNavigation(list);
          console.log(`[FirestoreProvider] Cache pre-fetched ${list.length} navigation successfully.`);
        }).catch(err => {
          console.warn("[FirestoreProvider] Error pre-fetching navigation (collection may not exist):", err.message);
        })
      ]);
    } catch (e) {
      console.error("[FirestoreProvider] Critical error pre-fetching global configuration:", e);
    } finally {
      setLoading(false);
      console.log(`[FirestoreProvider] Pre-fetch complete. Duration: ${Date.now() - start}ms`);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) {
      console.log("[FirestoreProvider] Skipping mount pre-fetch due to StrictMode prevention");
      return;
    }
    hasFetchedRef.current = true;
    fetchAll();
  }, []);

  const updateSiteConfigState = (config: SiteConfig) => {
    setSiteConfig(config);
  };

  const updatePlansState = (newPlans: SubscriptionPlan[]) => {
    setPlans(newPlans);
  };

  const updateSectionsState = (newSections: ContentSection[]) => {
    setSections(newSections);
  };

  const updateSliderState = (newSlides: SliderElement[]) => {
    setSlider(newSlides);
  };

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
