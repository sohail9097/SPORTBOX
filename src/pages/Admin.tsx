import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, onSnapshot } from 'firebase/firestore';
import { SportsContent, Category, ContentType, ContentSection, SliderElement, VideoPromoSettings, SiteConfig, PlayerSettings, SubscriptionPlan } from '../types';
import { Plus, Trash2, Edit2, Play, LayoutDashboard, Film, Users, Settings, Save, X, Eye, Radio, Crown, Layers, MoveUp, MoveDown, CheckSquare, Square, Image as ImageIcon, Upload, Library, ShieldCheck, ShieldAlert, Zap, Percent, Trophy, ChevronRight, Activity, Heart, Dribbble, CircleDot, Target, Disc, Flag, Gamepad2, Folder, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, transformGDriveUrl } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import MediaManager from '../components/MediaManager';
import StadiumPlayer from '../components/StadiumPlayer';
import { toast } from 'sonner';

import LoadingScreen from '../components/LoadingScreen';

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'live' | 'sections' | 'categories' | 'slider' | 'users' | 'settings' | 'media' | 'plans' | 'trending' | 'likes' | 'domain_setup'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [content, setContent] = useState<SportsContent[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [slider, setSlider] = useState<SliderElement[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [allUsersCount, setAllUsersCount] = useState(0);
  const [premiumUsersCount, setPremiumUsersCount] = useState(0);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedContentLikes, setSelectedContentLikes] = useState<{ id: string, title: string, likers: any[] } | null>(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    founderImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop',
    logoUrl: ''
  });
  const [videoPromo, setVideoPromo] = useState<VideoPromoSettings>({
    isActive: false,
    title: 'Experience The Game',
    description: 'Pure adrenaline, live in 4K.',
    videoUrl: '',
    embedCode: '',
    buttonText: 'Join Now',
    buttonUrl: '/plans',
    backgroundColor: '#ff0000'
  });
  const [playerConfig, setPlayerConfig] = useState<PlayerSettings>({
    useCustomPlayer: true,
    autoplay: true,
    muted: false,
    loop: false,
    showControls: true,
    primaryColor: '#ff0000',
    playbackRates: [0.5, 1, 1.5, 2]
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isAddingSlider, setIsAddingSlider] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [loading, setLoading] = useState(true);

  // Content Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SportsContent>>({
    title: '',
    description: '',
    category: 'football',
    type: 'replay',
    videoUrl: '',
    thumbnailUrl: '',
    isPremium: false,
    status: 'scheduled',
    viewCount: 0,
    tags: []
  });
  const [tagsInput, setTagsInput] = useState('');

  // Section Form state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState<Partial<ContentSection>>({
    title: '',
    page: 'home',
    contentIds: [],
    type: 'normal',
    order: 0,
    isActive: true,
    aspectRatio: 'landscape'
  });

  // Slider Form state
  const [editingSliderId, setEditingSliderId] = useState<string | null>(null);
  const [sliderForm, setSliderForm] = useState<Partial<SliderElement>>({
    title: '',
    description: '',
    imageUrl: '',
    videoUrl: '',
    actionUrl: '',
    isLive: false,
    order: 0,
    isActive: true,
    animationType: 'fade',
    page: 'home'
  });

  // Plan Form state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<Partial<SubscriptionPlan>>({
    name: '',
    price: 0,
    description: '',
    features: [],
    icon: 'Zap',
    popular: false,
    order: 0,
    color: 'from-slate-800 to-slate-900 border-white/5',
    offer: {
      isActive: false,
      percentage: 0,
      label: 'Limited Offer'
    }
  });

  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const generateBulkDummyContent = async () => {
    if (!confirm("This will add 10 sample videos to EVERY category (80+ items total). This might take a minute. Continue?")) return;
    
    setIsBulkLoading(true);
    try {
      const categories = ['football', 'cricket', 'basketball', 'tennis', 'f1', 'boxing', 'golf', 'esports'];
      const types: ContentType[] = ['highlight', 'replay', 'live'];
      
      const images: Record<string, string[]> = {
        football: [
          'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
          'https://images.unsplash.com/photo-1508098682722-e99c43a406b2',
          'https://images.unsplash.com/photo-1517466787929-bc90951d0974',
          'https://images.unsplash.com/photo-1551958219-acbc608c6377',
          'https://images.unsplash.com/photo-1575361394739-df13b10ae45d'
        ],
        cricket: [
          'https://images.unsplash.com/photo-1531415074968-036ba1b575da',
          'https://images.unsplash.com/photo-1533721387277-22d2c673fa0b',
          'https://images.unsplash.com/photo-1589487391730-58f20eb2c308',
          'https://images.unsplash.com/photo-1593341646782-e0b495cff86d',
          'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e'
        ],
        basketball: [
          'https://images.unsplash.com/photo-1546519638-68e109498ffc',
          'https://images.unsplash.com/photo-1519861531158-2863f7c5c1b3',
          'https://images.unsplash.com/photo-1504450758481-7338eba7524a',
          'https://images.unsplash.com/photo-1518063311540-00445b84293f',
          'https://images.unsplash.com/photo-1515444744559-7be63e1600de'
        ],
        tennis: [
          'https://images.unsplash.com/photo-1592211633519-7922d5111956',
          'https://images.unsplash.com/photo-1595435066359-e18e6c466986',
          'https://images.unsplash.com/photo-1554068865-24cecd4e34b8',
          'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd1d',
          'https://images.unsplash.com/photo-1587329310686-dc4a4bd1d7a8'
        ],
        f1: [
          'https://images.unsplash.com/photo-1533139502658-0198f920d8e8',
          'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2',
          'https://images.unsplash.com/photo-1552519519-72dcd9b6e587',
          'https://images.unsplash.com/photo-1537248161962-041a3194090b',
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c'
        ],
        boxing: [
          'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed',
          'https://images.unsplash.com/photo-1509190159492-75ca49124a9e',
          'https://images.unsplash.com/photo-1552072805-2a9039d00e57',
          'https://images.unsplash.com/photo-1544117518-2b041560c05a',
          'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e'
        ],
        golf: [
          'https://images.unsplash.com/photo-1535131749006-b7f58c99034b',
          'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa',
          'https://images.unsplash.com/photo-1592919010304-4298157796d1',
          'https://images.unsplash.com/photo-1591491640784-3232eb748d4b',
          'https://images.unsplash.com/photo-1605342416972-04877708577d'
        ],
        esports: [
          'https://images.unsplash.com/photo-1542751371-adc38448a05e',
          'https://images.unsplash.com/photo-1511512578047-dfb367046420',
          'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8',
          'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd',
          'https://images.unsplash.com/photo-1552820728-8b83bb6b773f'
        ]
      };

      for (const cat of categories) {
        console.log(`Generating items for ${cat}...`);
        const catImages = images[cat] || images.football;
        
        for (let i = 1; i <= 10; i++) {
          const type = types[Math.floor(Math.random() * types.length)];
          const isPremium = i > 5; // Half premium
          
          await addDoc(collection(db, 'content'), {
            title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Championship Series #${i}`,
            description: `Exclusive coverage of the ${cat} season. Professional commentary and high-definition multi-angle views.`,
            category: cat,
            type: type,
            status: type === 'live' ? 'live' : 'ended',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnailUrl: `${catImages[i % catImages.length]}?q=80&w=800&auto=format&fit=crop`,
            isPremium: isPremium,
            viewCount: Math.floor(Math.random() * 10000) + 500,
            createdAt: new Date().toISOString(),
            tags: [cat.toUpperCase(), 'Season 2024', type.toUpperCase()]
          });
        }
        
        // Also ensure a section exists for this category on its specific page
        const q = query(collection(db, 'sections'));
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => d.data().page === cat);
        
        if (!existing) {
          await addDoc(collection(db, 'sections'), {
            title: `Featured ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
            page: cat,
            contentIds: [], // Home and Category pages will fetch by category anyway or we can populate
            type: 'normal',
            order: 1,
            isActive: true
          });
        }
      }

      toast.success("Successfully added 80 dummy items across all categories!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add bulk content.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const [isInitializing, setIsInitializing] = useState(false);

  const restoreSampleContent = async () => {
    if (!confirm("This will add some sample matches and highlights to your library. Continue?")) return;
    setIsInitializing(true);
    try {
      const contentList = [
        {
          title: 'Champions League Final Highlights',
          description: 'A classic battle between the giants of European football.',
          category: 'football',
          type: 'highlight',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
          isPremium: false,
          viewCount: 1540,
          createdAt: new Date().toISOString(),
          status: 'ended',
          tags: ['Highlights', 'Final']
        },
        {
          title: 'Cricket World Cup: Best of 2023',
          description: 'Incredible catches and massive sixes from the pinnacle tournament.',
          category: 'cricket',
          type: 'replay',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da',
          isPremium: true,
          viewCount: 890,
          createdAt: new Date().toISOString(),
          status: 'ended',
          tags: ['Cricket', 'World Cup']
        },
        {
          title: 'F1: Monaco Grand Prix Highlights',
          description: 'High speed drama in the streets of Monte Carlo.',
          category: 'f1',
          type: 'highlight',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8',
          isPremium: false,
          viewCount: 2200,
          createdAt: new Date().toISOString(),
          status: 'ended',
          tags: ['F1', 'Speed']
        }
      ];

      const createdIds = [];
      for (const item of contentList) {
        const docRef = await addDoc(collection(db, 'content'), item);
        createdIds.push(docRef.id);
      }

      // Automatically create sections if they are missing
      const sectionsSnap = await getDocs(collection(db, 'sections'));
      const existingSections = sectionsSnap.docs.map(d => d.data().title);
      
      const defaultSections = [
        { title: 'Trending Hub', page: 'home', contentIds: createdIds, type: 'normal', order: 1, isActive: true },
        { title: 'Tournament Replays', page: 'home', contentIds: [createdIds[1]], type: 'top10', order: 2, isActive: true }
      ];

      for (const sec of defaultSections) {
        if (!existingSections.includes(sec.title)) {
          await addDoc(collection(db, 'sections'), sec);
        }
      }

      toast.success("Sample library restored! Sections and content are now visible on the home page.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore content.");
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeSampleData = async () => {
    if (!confirm("This will create sample sections and settings if the database is empty. Continue?")) return;
    
    setIsInitializing(true);
    try {
      // 1. Check if sections are empty
      const sectionsSnap = await getDocs(collection(db, 'sections'));
      if (sectionsSnap.empty) {
        const defaultSections = [
          { title: 'Live Events', page: 'home', contentIds: [], type: 'normal', order: 1, isActive: true },
          { title: 'Trending Replays', page: 'home', contentIds: [], type: 'normal', order: 2, isActive: true },
          { title: 'Tournament Highlights', page: 'home', contentIds: [], type: 'top10', order: 3, isActive: true }
        ];
        for (const sec of defaultSections) {
          await addDoc(collection(db, 'sections'), sec);
        }
      }

      // 2. Initialize Settings if empty
      const videoPromoRef = doc(db, 'settings', 'videoPromo');
      const promoSnap = await getDoc(videoPromoRef);
      if (!promoSnap.exists()) {
        await setDoc(videoPromoRef, {
          isActive: true,
          title: 'Welcome to Sportsbox',
          description: 'The ultimate destination for sports enthusiasts.',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          buttonText: 'Join Premium',
          buttonUrl: '/plans',
          backgroundColor: '#ff0000'
        });
      }

      const siteConfigRef = doc(db, 'settings', 'siteConfig');
      const configSnap = await getDoc(siteConfigRef);
      if (!configSnap.exists()) {
        await setDoc(siteConfigRef, {
          founderImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
          logoUrl: ''
        });
      }

      toast.success("Sample sections and settings initialized. Now add some content in the Content tab!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to initialize sample data. Check console for details.");
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      // Admin API Health Check
      fetch('/api/admin/health')
        .then(async res => {
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Health check failed: ${res.status}. ${text.substring(0, 100)}`);
          }
          const contentType = res.headers.get("content-type");
          const isFallback = res.headers.get("X-SPA-Fallback") === "true";
          if (!contentType || !contentType.includes("application/json") || isFallback) {
             throw new Error(`Health check returned non-JSON/Fallback. Type: ${contentType}, Fallback: ${isFallback}`);
          }
          return res.json();
        })
        .then(data => console.log("[Admin API Health]", data))
        .catch(err => {
          console.warn("[Admin API Health Error]", err.message);
          // Don't show toast for health check to avoid annoying user, just log it
        });

      fetchContent();
      fetchSections();
      fetchSlider();
      fetchSubscribers();
      fetchMediaItems();
      fetchFolders();
      
      // Use onSnapshot for live settings updates
      const unsubConfig = onSnapshot(doc(db, 'settings', 'siteConfig'), (snap) => {
        if (snap.exists()) setSiteConfig(snap.data() as SiteConfig);
      }, (err) => console.warn("[Admin] Config sync offline:", err.message));

      const unsubPromo = onSnapshot(doc(db, 'settings', 'videoPromo'), (snap) => {
        if (snap.exists()) setVideoPromo(prev => ({ ...prev, ...snap.data() }));
      }, (err) => console.warn("[Admin] Promo sync offline:", err.message));

      const unsubPlayer = onSnapshot(doc(db, 'settings', 'playerConfig'), (snap) => {
        if (snap.exists()) setPlayerConfig(prev => ({ ...prev, ...snap.data() }));
      }, (err) => console.warn("[Admin] Player sync offline:", err.message));

      const unsubPlans = onSnapshot(query(collection(db, 'subscription_plans'), orderBy('order', 'asc')), (snap) => {
        if (!snap.empty) {
          setSubscriptionPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
        } else if (isAdmin) {
          // If empty, suggest initializing
          console.warn("[Admin] No subscription plans found. Use 'Initialize' if this is a new setup.");
        }
      }, (err) => console.warn("[Admin] Plans sync offline:", err.message));

      return () => {
        unsubConfig();
        unsubPromo();
        unsubPlayer();
        unsubPlans();
      };
    }
  }, [isAdmin]);

  const resetAllViews = async () => {
    if (!confirm("Are you sure you want to reset all impressions to zero? This will clear all view data from every media item in the database.")) return;
    
    setIsResetting(true);
    try {
      const q = query(collection(db, 'content'));
      const querySnapshot = await getDocs(q);
      
      const promises = querySnapshot.docs.map(docSnap => 
        updateDoc(doc(db, 'content', docSnap.id), { viewCount: 0 })
      );
      
      await Promise.all(promises);
      await fetchContent();
      toast.success("All impressions have been reset to zero successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reset impressions.");
    } finally {
      setIsResetting(false);
    }
  };

  const initializeSubscriptionPlans = async () => {
    try {
      const q = query(collection(db, 'subscription_plans'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      if (!snap.empty) return;

      // Initialize default plans if none exist in Firestore
      const defaultPlans = [
        {
          id: 'basic',
          name: 'Basic Plan',
          price: 49,
          description: 'Essential access for every sports fan.',
          features: ['Live Matches (SD)', 'Match Highlights', 'Ad Supported', 'Single Screen'],
          icon: 'Zap',
          popular: false,
          order: 1,
          color: 'from-slate-800 to-slate-900 border-white/5'
        },
        {
          id: 'medium',
          name: 'Medium Plan',
          price: 199,
          description: 'The sweet spot for high-quality entertainment.',
          features: ['Live Matches (HD)', 'No Ads', 'Multi-Device Support', 'Exclusive Interviews'],
          icon: 'Activity',
          popular: true,
          order: 2,
          color: 'from-red-600 to-red-900 border-red-500/50 shadow-red-600/10'
        },
        {
          id: 'pro',
          name: 'Pro Plan',
          price: 499,
          description: 'The ultimate VIP stadium experience.',
          features: ['Live Matches (4K)', 'Multi-Angle Views', 'Priority Support', 'No Ads Forever', '5 Screens'],
          icon: 'Crown',
          popular: false,
          order: 3,
          color: 'from-slate-900 to-black border-brand-alt/50 shadow-brand-alt/10'
        }
      ];
      
      for (const plan of defaultPlans) {
        await setDoc(doc(db, 'subscription_plans', plan.id), plan);
      }
      toast.success("Subscription plans initialized.");
    } catch (err) {
      console.error("Init plans error:", err);
    }
  };

  const initializeDefaultContent = async () => {
    if (!confirm("This will add sample Football and Cricket content to your app. Continue?")) return;
    setIsSaving(true);
    try {
      const samples: Partial<SportsContent>[] = [
        {
          title: "Premier League: City vs United",
          description: "Full match replay of the Manchester Derby.",
          type: "replay",
          category: "football",
          status: "ended",
          thumbnailUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          tags: ["Highlight", "Derby"],
          viewCount: 120502,
          likes: 4500,
          createdAt: new Date().toISOString()
        },
        {
          title: "Champions League Final 2024",
          description: "Experience the magic of Europes biggest night.",
          type: "replay",
          category: "football",
          status: "ended",
          thumbnailUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          tags: ["Climax", "Big Game"],
          viewCount: 340200,
          likes: 12900,
          createdAt: new Date().toISOString()
        },
        {
          title: "IPL 2024 Highlights",
          description: "Breathtaking moments from the Indian Premier League.",
          type: "replay",
          category: "cricket",
          status: "ended",
          thumbnailUrl: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          tags: ["T20", "India"],
          viewCount: 456700,
          likes: 25000,
          createdAt: new Date().toISOString()
        }
      ];

      for (const sample of samples) {
        await addDoc(collection(db, 'content'), sample);
      }
      toast.success("Sample content added successfully!");
    } catch (err) {
      console.error("Init content error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // fetchPlayerConfig, fetchVideoPromo, fetchSiteConfig are handled by onSnapshot in useEffect

  const handlePlayerConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'playerConfig');
      await setDoc(docRef, playerConfig);
      toast.success("Player configuration updated!");
    } catch (error) {
      console.error("Player Config Save Error:", error);
      toast.error("Failed to update player configuration. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, OperationType.UPDATE, 'settings/playerConfig');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchMediaItems = async () => {
    try {
      const q = query(
        collection(db, 'library'), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter by folder client-side if needed, or update query
      if (currentFolder) {
        setMediaItems(items.filter((item: any) => item.folderId === currentFolder));
      } else {
        setMediaItems(items.filter((item: any) => !item.folderId));
      }
    } catch (err) {
      console.error("Fetch media error:", err);
    }
  };

  const fetchFolders = async () => {
    try {
      const q = query(collection(db, 'library_folders'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const folderList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (folderList.length === 0) {
        // Initial setup for default folders if they don't exist
        const defaultFolders = [
          'Ads', 'Banner', 'Cast & Crew', 'Constant', 'Genres', 
          'Live TV', 'Logos', 'Movie', 'Onboarding', 'TV Show', 
          'Users', 'Video', 'Cricket', 'Football', 'Basketball', 
          'Tennis', 'Kabaddi', 'Hockey', 'Combat Sports'
        ];
        
        const createdFolders = [];
        for (const name of defaultFolders) {
          const docRef = await addDoc(collection(db, 'library_folders'), {
            name,
            createdAt: new Date().toISOString(),
            parentId: null
          });
          createdFolders.push({ id: docRef.id, name, parentId: null });
        }
        setFolders(createdFolders);
        return createdFolders;
      } else {
        setFolders(folderList);
        return folderList;
      }
    } catch (err) {
      console.error("Fetch folders error:", err);
      return [];
    }
  };

  useEffect(() => {
    if (activeTab === 'media') {
      fetchMediaItems();
    }
  }, [currentFolder, activeTab]);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    try {
      await addDoc(collection(db, 'library_folders'), {
        name: newFolderName,
        createdAt: new Date().toISOString(),
        parentId: currentFolder
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      fetchFolders();
    } catch (err) {
      console.error("Create folder error:", err);
    }
  };

  const deleteFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${name}"? Items inside may become orphaned.`)) return;
    try {
      await deleteDoc(doc(db, 'library_folders', id));
      toast.success("Folder deleted successfully!");
      fetchFolders();
    } catch (err) {
      console.error("Delete folder error:", err);
      toast.error("Failed to delete folder.");
      handleFirestoreError(err, OperationType.DELETE, `library_folders/${id}`);
    }
  };

  const deleteMedia = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media?")) return;
    try {
      await deleteDoc(doc(db, 'library', id));
      setMediaItems(prev => prev.filter(m => m.id !== id));
      toast.success("Media deleted successfully!");
    } catch (err) {
      console.error("Delete media error:", err);
      toast.error("Failed to delete media.");
      handleFirestoreError(err, OperationType.DELETE, `library/${id}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copied to clipboard!");
  };

  const [previewContent, setPreviewContent] = useState<{url: string, title: string, isLive: boolean} | null>(null);

  const handleVideoPromoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const transformedUrl = transformGDriveUrl(videoPromo.videoUrl, 'video');
      const finalPromo = { ...videoPromo, videoUrl: transformedUrl };
      
      const docRef = doc(db, 'settings', 'videoPromo');
      await setDoc(docRef, finalPromo);
      setVideoPromo(finalPromo);
      toast.success("Video Promo Banner updated successfully!");
    } catch (error) {
      console.error("Video Promo Update Error:", error);
      toast.error("Failed to update banner. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, OperationType.UPDATE, 'settings/videoPromo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const transformedFounderUrl = transformGDriveUrl(siteConfig.founderImageUrl || '', 'image');
      const transformedLogoUrl = transformGDriveUrl(siteConfig.logoUrl || '', 'image');
      const finalConfig = { ...siteConfig, founderImageUrl: transformedFounderUrl, logoUrl: transformedLogoUrl };

      const docRef = doc(db, 'settings', 'siteConfig');
      await updateDoc(docRef, finalConfig).catch(async (err) => {
        if (err.code === 'not-found') {
          await setDoc(docRef, finalConfig);
        } else {
          throw err;
        }
      });
      setSiteConfig(finalConfig);
      toast.success("Settings updated successfully! Links were optimized for display.");
    } catch (error) {
      console.error("Config Update Error:", error);
      toast.error("Failed to update general settings. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, OperationType.UPDATE, 'settings/siteConfig');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const idToken = await currentUser.getIdToken();
      // Helper for fetching with retries
      const fetchWithRetry = async (url: string, options: any, retries = 2): Promise<Response> => {
        try {
          const res = await fetch(url, options);
          return res;
        } catch (err) {
          if (retries > 0) {
            console.log(`[Admin] Fetch failed, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, options, retries - 1);
          }
          throw err;
        }
      };

      const response = await fetchWithRetry(`/api/admin/list-users?v=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        let errorMessage = "Failed to fetch users";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            if (errorData.details?.auth) {
              errorMessage += ` (Auth: ${errorData.details.auth})`;
            }
          } else {
            const text = await response.text();
            console.error("Non-JSON Error Response:", text.substring(0, 500));
            errorMessage = `Communication Error (${response.status}): The server returned an invalid response. Please try refreshing the page or check the server status.`;
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      const contentType = response.headers.get("content-type");
      const isFallback = response.headers.get("X-SPA-Fallback") === "true";
      
      // If we got HTML (fallback) instead of JSON for an API call, it's a routing error
      if (!contentType || !contentType.includes("application/json") || isFallback) {
        const text = await response.text();
        console.error("API returned non-JSON despite 200 OK. Fallback header:", isFallback, "Content:", text.substring(0, 100));
        
        // This is the most common error - the API route is caught by the React App's wildcard route
        throw new Error("System Error: API Routing Failure. The application could not reach the administrative backend. Please contact support or ensure your /api routes are correctly configured.");
      }

      const data = await response.json();
      
      // Handle both old array format and new object format
      const items = Array.isArray(data) ? data : (data.users || []);
      const diag = Array.isArray(data) ? null : data.diag;

      if (diag) {
        console.log("[Admin Debug] Backend Diagnosis:", diag);
        if (diag.authError) {
          toast.error(`Auth System Error: ${diag.authError}`, { 
            duration: 8000,
            id: 'auth-error' 
          });
        }
        if (!diag.hasServiceAccount) {
          toast.warning("Service Account is missing in Production. Users may not load.", {
             duration: 10000,
             id: 'sa-missing'
          });
        }
      }

      setAllUsersCount(items.length);
      const premiumUsers = items.filter((u: any) => u.subscriptionTier && u.subscriptionTier !== 'free' && u.subscriptionStatus === 'active');
      setPremiumUsersCount(premiumUsers.length);
      setSubscribers(items);
    } catch (error) {
      console.error("Fetch Subscribers Error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load subscribers. Check your Firebase API settings.");
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${name}? This action will remove them from both the database and Authentication (login access). This cannot be undone.`)) return;
    
    const toastId = toast.loading(`Deleting user ${name}...`);
    try {
      // 1. Delete from Firebase Auth (via server-side Admin SDK)
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No authenticated admin user found");
      
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: id, idToken })
      });

      if (!response.ok) {
        let errorMessage = "Failed to sync deletion with Auth server";
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // 2. Local Cleanup (Already should be handled by server, but we do it here too for redundancy)
      await deleteDoc(doc(db, 'users', id));
      
      toast.success("User removed successfully.", { id: toastId });
      fetchSubscribers();
    } catch (error) {
      console.error("Delete user error:", error);
      toast.error("Failed to delete user: " + (error as Error).message, { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const fetchContent = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'content'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SportsContent));
      setContent(items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const q = query(collection(db, 'sections'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ContentSection));
      setSections(items);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSlider = async () => {
    try {
      const q = query(collection(db, 'slider'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SliderElement));
      setSlider(items);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transformedVideoUrl = transformGDriveUrl(form.videoUrl || '', 'video');
      const transformedThumbUrl = transformGDriveUrl(form.thumbnailUrl || '', 'image');
      const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
      const finalForm = { ...form, videoUrl: transformedVideoUrl, thumbnailUrl: transformedThumbUrl, tags: tagsArray };

      if (editingId) {
        const docRef = doc(db, 'content', editingId);
        await updateDoc(docRef, finalForm);
      } else {
        const payload = {
          ...finalForm,
          createdAt: new Date().toISOString(),
          viewCount: Math.floor(Math.random() * 100)
        };
        await addDoc(collection(db, 'content'), payload);
    }
    toast.success("Content saved successfully!");
    // setIsAdding(false); // USER REQUEST: Keep modal open for next content
    setEditingId(null);
    fetchContent();
    // Reset form for next entry
    setForm({ 
      title: '', 
      description: '', 
      category: 'football', 
      type: 'replay', 
      videoUrl: '', 
      thumbnailUrl: '',
      isPremium: false, 
      status: 'scheduled', 
      tags: [],
      viewCount: 0
    });
    setTagsInput('');
    } catch (error) {
      console.error("Content Save Error:", error);
      toast.error("Failed to save content. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'content');
    }
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.contentIds || sectionForm.contentIds.length === 0) {
      toast.error("Please select at least one piece of content for this section.");
      return;
    }
    
    try {
      if (editingSectionId) {
        const docRef = doc(db, 'sections', editingSectionId);
        await updateDoc(docRef, { ...sectionForm });
      } else {
        const payload = {
          ...sectionForm,
          createdAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'sections'), payload);
      }
      setIsAddingSection(false);
      setEditingSectionId(null);
      await fetchSections();
      toast.success("Section saved successfully!");
      setSectionForm({ title: '', page: 'home', contentIds: [], type: 'normal', order: 0, isActive: true, aspectRatio: 'landscape' });
    } catch (error) {
      console.error("Section save error:", error);
      toast.error("Failed to save section. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, editingSectionId ? OperationType.UPDATE : OperationType.CREATE, 'sections');
    }
  };

  const handleSliderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transformedImgUrl = transformGDriveUrl(sliderForm.imageUrl || '', 'image');
      const transformedVidUrl = transformGDriveUrl(sliderForm.videoUrl || '', 'video');
      const finalSliderForm = { ...sliderForm, imageUrl: transformedImgUrl, videoUrl: transformedVidUrl };

      if (editingSliderId) {
        const docRef = doc(db, 'slider', editingSliderId);
        await updateDoc(docRef, finalSliderForm);
      } else {
        await addDoc(collection(db, 'slider'), {
          ...finalSliderForm,
          createdAt: new Date().toISOString(),
        });
      }
      setIsAddingSlider(false);
      setEditingSliderId(null);
      fetchSlider();
      toast.success("Slide saved successfully!");
      setSliderForm({ title: '', description: '', imageUrl: '', videoUrl: '', actionUrl: '', isLive: false, order: 0, isActive: true, animationType: 'fade', page: 'home' });
    } catch (error) {
      console.error("Slider save error:", error);
      toast.error("Failed to save slide. " + (error instanceof Error ? error.message : ""));
      handleFirestoreError(error, editingSliderId ? OperationType.UPDATE : OperationType.CREATE, 'slider');
    }
  };

  const handleEdit = (item: SportsContent) => {
    setForm(item);
    setTagsInput(item.tags ? item.tags.join(', ') : '');
    setEditingId(item.id);
    setIsAdding(true);
  };

  const handleSectionEdit = (section: ContentSection) => {
    setSectionForm(section);
    setEditingSectionId(section.id);
    setIsAddingSection(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this content item? This action is permanent.')) return;
    
    const toastId = toast.loading("Deleting content...");
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'content', id));
      await fetchContent();
      toast.success("Content removed successfully from library.", { id: toastId });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete content. Check your permissions.", { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `content/${id}`);
    } finally {
      setLoading(true); // Keep loading state until fetch finishes
      await fetchContent();
      setLoading(false);
    }
  };

  const handleSliderDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this slide?')) return;
    const tId = toast.loading("Deleting slide...");
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'slider', id));
      await fetchSlider();
      toast.success("Slide deleted successfully!", { id: tId });
    } catch (error) {
      console.error("Slider delete error:", error);
      toast.error("Failed to delete slide.", { id: tId });
      handleFirestoreError(error, OperationType.DELETE, `slider/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const planId = editingPlanId || planForm.id || planForm.name?.toLowerCase().replace(/\s+/g, '-') || 'plan-' + Date.now();
      const docRef = doc(db, 'subscription_plans', planId);
      
      // Ensure we have a valid offer object if it's active
      const finalPlan = {
        ...planForm,
        id: planId,
        offer: planForm.offer?.isActive ? planForm.offer : { isActive: false, percentage: 0, label: '' }
      };

      await setDoc(docRef, finalPlan);
      
      setIsAddingPlan(false);
      setEditingPlanId(null);
      toast.success("Plan saved successfully!");
    } catch (error) {
      console.error("Plan save error:", error);
      toast.error("Failed to save plan. Check console for details.");
      handleFirestoreError(error, editingPlanId ? OperationType.UPDATE : OperationType.CREATE, 'subscription_plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await deleteDoc(doc(db, 'subscription_plans', id));
      toast.success("Plan deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete plan.");
      handleFirestoreError(error, OperationType.DELETE, `subscription_plans/${id}`);
    }
  };

  const handleSectionDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    const tId = toast.loading("Deleting section...");
    try {
      await deleteDoc(doc(db, 'sections', id));
      await fetchSections();
      toast.success("Section deleted successfully!", { id: tId });
    } catch (error) {
      toast.error("Failed to delete section.", { id: tId });
      handleFirestoreError(error, OperationType.DELETE, `sections/${id}`);
    }
  };

  const fetchContentLikes = async (contentId: string, title: string) => {
    setLikesLoading(true);
    try {
      const snap = await getDocs(collection(db, 'content', contentId, 'likes'));
      const likersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSelectedContentLikes({ id: contentId, title, likers: likersList });
    } catch (error) {
      console.error("Error fetching likes:", error);
    } finally {
      setLikesLoading(false);
    }
  };

  const liveItems = content.filter(c => c.status === 'live');

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-bg flex text-text-base transition-colors">
      <div className="w-64 border-r border-border p-6 flex flex-col gap-8 bg-surface/30">
        <div className="flex items-center gap-2 px-2">
          <Settings className="w-6 h-6 text-brand" />
          <span className="font-display uppercase tracking-widest text-lg">Control Panel</span>
        </div>
        
        <div className="flex flex-col gap-2">
          <SidebarLink icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={Film} label="Library" active={activeTab === 'content'} onClick={() => setActiveTab('content')} />
          <SidebarLink icon={Trophy} label="Categories" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
          <SidebarLink icon={ImageIcon} label="Hero Slider" active={activeTab === 'slider'} onClick={() => setActiveTab('slider')} />
          <SidebarLink icon={Radio} label="Live Center" active={activeTab === 'live'} onClick={() => setActiveTab('live')} />
          <SidebarLink icon={Users} label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <SidebarLink icon={Activity} label="Trending Editor" active={activeTab === 'trending'} onClick={() => setActiveTab('trending')} />
          <SidebarLink icon={Crown} label="Subscription Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
          <SidebarLink icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <SidebarLink icon={ShieldCheck} label="Domain Setup" active={activeTab === 'domain_setup'} onClick={() => setActiveTab('domain_setup')} />
          <SidebarLink icon={Heart} label="Likes Insight" active={activeTab === 'likes'} onClick={() => setActiveTab('likes')} />
          <SidebarLink icon={Library} label="Media Uploads" active={activeTab === 'media'} onClick={() => setActiveTab('media')} />
        </div>
      </div>

      <div className="flex-grow p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-12">
               <div className="space-y-2">
                <h1 className="text-5xl font-black uppercase italic tracking-tighter">Command Center</h1>
                <p className="text-text-muted font-medium">Real-time statistics and quick actions for SportsBox.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatsCard 
                  label="Total Media" 
                  value={content.length} 
                  icon={Film} 
                  color="text-red-600" 
                />
                <StatsCard 
                  label="Broadcasting" 
                  value={liveItems.length > 0 ? liveItems.length : "None"} 
                  icon={Radio} 
                  color={liveItems.length > 0 ? "text-red-500 animate-pulse" : "text-white/20"} 
                />
                <StatsCard 
                  label="Total Impressions" 
                  value={
                    content.reduce((acc, c) => acc + (c.viewCount || 0), 0) >= 1000000
                      ? (content.reduce((acc, c) => acc + (c.viewCount || 0), 0) / 1000000).toFixed(1) + 'M'
                      : (content.reduce((acc, c) => acc + (c.viewCount || 0), 0) >= 1000)
                        ? (content.reduce((acc, c) => acc + (c.viewCount || 0), 0) / 1000).toFixed(1) + 'K'
                        : content.reduce((acc, c) => acc + (c.viewCount || 0), 0)
                  } 
                  icon={Eye} 
                  color="text-blue-500" 
                />
                <StatsCard 
                  label="Premium Ratio" 
                  value={allUsersCount > 0 ? Math.round((premiumUsersCount / allUsersCount) * 100) + '%' : '0%'} 
                  icon={Crown} 
                  color="text-yellow-500" 
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={async () => {
                    const pass = window.prompt("DANGER: Type 'RESET' to delete ALL site data (Content, Library, Sections, Sliders). This is permanent.");
                    if (pass?.toUpperCase() === 'RESET') {
                      setIsResetting(true);
                      const tId = toast.loading("Performing full system reset...");
                      try {
                        const collections = ['content', 'library', 'sections', 'slider', 'library_folders'];
                        for (const colName of collections) {
                          const q = query(collection(db, colName));
                          const snap = await getDocs(q);
                          const promises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
                          await Promise.all(promises);
                        }
                        
                        await fetchContent();
                        await fetchSections();
                        await fetchSlider();
                        await fetchMediaItems();
                        
                        toast.success("System completely wiped. You can start fresh now.", { id: tId });
                        window.location.reload();
                      } catch (err: any) {
                        console.error("Reset error:", err);
                        toast.error("Wipe failed: " + err.message, { id: tId });
                      } finally {
                        setIsResetting(false);
                      }
                    }
                  }}
                  disabled={isResetting}
                  className="px-6 py-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-black uppercase italic hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isResetting ? "Wiping..." : "Full System Reset (Clear All Data)"}
                </button>

                <div className="flex-grow glass-card px-6 py-3 border border-white/5 bg-white/5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="text-[8px] font-black uppercase text-text-muted">Connected Project / DB</p>
                      <p className="text-[10px] font-mono text-white/60 truncate max-w-[200px]">
                        {(db as any)._databaseId?.projectId || 'SportsBox-1'} | {(db as any)._databaseId?.databaseId || '(default)'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-text-muted">Environment</p>
                    <p className="text-[10px] font-bold text-brand uppercase">{window.location.hostname.includes('ais-') ? 'Development (AI Studio)' : 'Published (Production)'}</p>
                  </div>
                </div>
              </div>

              {liveItems.length > 0 ? (
                <div className="glass-card p-8 border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-600 text-white rounded-xl animate-pulse">
                        <Radio className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-black uppercase italic tracking-widest text-white">Active Streamers</h2>
                        <p className="text-[10px] text-red-500 uppercase font-bold tracking-tighter">Real-time broadcast monitoring</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('live')} className="text-[10px] font-black uppercase italic text-text-muted hover:text-white transition-colors flex items-center gap-2 group">
                      Live Center <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveItems.map(stream => (
                      <div key={`stream-stat-${stream.id}`} className="flex items-center gap-4 p-4 bg-surface/50 border border-white/5 rounded-2xl">
                        <div className="w-16 h-10 rounded-lg overflow-hidden border border-border bg-black">
                          {stream.thumbnailUrl && <img src={stream.thumbnailUrl} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="flex-grow">
                          <p className="text-xs font-bold text-white truncate max-w-[150px]">{stream.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            <p className="text-[9px] text-text-muted uppercase font-black">{stream.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-brand">{stream.viewCount?.toLocaleString() || 0}</p>
                          <p className="text-[8px] text-text-muted uppercase font-bold">Views</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-8 border border-white/5 bg-surface/30 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <Radio className="w-8 h-8 text-white/10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black uppercase italic tracking-tighter text-white/40">No live streaming is active</p>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Connect to a stadium to start broadcasting</p>
                  </div>
                </div>
              )}

              <div className="glass-card p-8 border border-brand/20 bg-brand/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-brand text-white rounded-xl">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest">Quick Deployment</h2>
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">One-click content population</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={async () => {
                      const url = "https://drive.google.com/file/d/1JcLejOC3-fSHWhGThh5xUISMrJAFdMdH/view?usp=drive_link";
                      const transformed = transformGDriveUrl(url, 'video');
                      try {
                        await addDoc(collection(db, 'content'), {
                          title: 'test1234',
                          description: 'User requested test video from Google Drive.',
                          category: 'football',
                          type: 'replay',
                          status: 'ended',
                          videoUrl: transformed,
                          thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=600&auto=format&fit=crop',
                          isPremium: false,
                          createdAt: new Date().toISOString(),
                          viewCount: 0
                        });
                        toast.success("Video 'test1234' added successfully to Football!");
                        fetchContent();
                      } catch (err) {
                        toast.error("Error adding video. Check console.");
                      }
                    }}
                    className="flex items-center gap-4 p-4 bg-surface hover:bg-brand/10 border border-white/5 rounded-2xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-bg rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Film className="w-6 h-6 text-brand" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black uppercase italic tracking-widest">Add "test1234" Video</p>
                      <p className="text-[9px] text-text-muted">Football • Replay • GDrive</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Playback Debugger Section */}
              <div className="glass-card p-8 border border-white/5 bg-surface mt-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-blue-500/20 text-blue-500 rounded-xl">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest">Playback Debugger</h2>
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Fix Google Drive or External Link issues</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-bg rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold uppercase text-white/40 mb-2">Test any Video URL</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Paste your link here..."
                        className="flex-grow bg-surface border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-brand"
                        id="debug-url"
                      />
                      <button 
                        onClick={() => {
                          const val = (document.getElementById('debug-url') as HTMLInputElement).value;
                          setPreviewContent({ url: transformGDriveUrl(val, 'video'), title: 'Debug Test', isLive: false });
                        }}
                        className="px-6 bg-brand text-white rounded-xl text-[10px] font-black uppercase italic h-[46px]"
                      >
                        Launch Tester
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <h4 className="text-[10px] font-black uppercase italic text-brand mb-2">1. Check Permissions</h4>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        In Google Drive, you MUST click <span className="text-white">Share</span> → <span className="text-white">General Access</span> → change to <span className="text-white">"Anyone with the link"</span>.
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <h4 className="text-[10px] font-black uppercase italic text-blue-400 mb-2">2. Direct Play Optimizer</h4>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        The system automatically transforms your GDrive links into high-speed stream URLs for the best performance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'content' && (
            <motion.div key="content" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter">Media Library</h1>
                  <p className="text-text-muted font-medium">Manage your entire video collection in one place.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingId(null);
                    setForm({ title: '', description: '', category: 'football', type: 'replay', videoUrl: '', thumbnailUrl: '', isPremium: false, status: 'scheduled' });
                    setIsAdding(true);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Content
                </button>
              </div>

              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-surface/50 border-b border-border">
                    <tr className="uppercase text-[10px] font-black tracking-widest text-text-muted">
                      <th className="px-6 py-5">Asset</th>
                      <th className="px-6 py-5">Category</th>
                      <th className="px-6 py-5">Type</th>
                      <th className="px-6 py-5">Metrics</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {content.map((item) => (
                      <tr key={`asset-${item.id}`} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-20 rounded-lg overflow-hidden bg-bg border border-border">
                              {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' && <img src={item.thumbnailUrl} className="w-full h-full object-cover" alt="" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold truncate max-w-[200px]">{item.title}</p>
                              <p className={cn("text-[10px] font-black uppercase tracking-widest", item.status === 'live' ? "text-red-500" : "text-text-muted")}>{item.status}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-text-muted">{item.category}</td>
                        <td className="px-6 py-4">
                          <span className={cn("px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border", item.type === 'live' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-bg text-text-muted border-border")}>{item.type}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2 text-text-muted">
                            <Eye className="w-3 h-3" />
                            <span className="text-xs font-mono">{item.viewCount?.toLocaleString() || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => setPreviewContent({ 
                                url: transformGDriveUrl(item.videoUrl, 'video'), 
                                title: item.title, 
                                isLive: item.status === 'live' 
                              })} 
                              className="p-2 hover:text-brand transition-colors text-text-muted"
                              title="Preview Video"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleEdit(item)} className="p-2 hover:text-brand transition-colors text-text-muted" title="Edit Item"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:text-red-500 transition-colors text-red-500/80" title="Delete Item"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subscribers.length === 0 && (
                  <div className="py-20 text-center border-t border-border">
                    <p className="text-text-muted font-black uppercase italic tracking-widest">No active subscribers found.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

           {activeTab === 'categories' && (
             <motion.div key="categories" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-12">
                {!selectedCategory ? (
                  <>
                    <div className="space-y-2">
                      <h1 className="text-5xl font-black uppercase italic tracking-tighter">Sports Network</h1>
                      <p className="text-text-muted font-medium">Select a category to manage its dynamic sections and tournament content.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <button
                        onClick={() => setSelectedCategory('home' as any)}
                        className="p-8 group hover:border-brand/40 transition-all text-left relative overflow-hidden bg-surface/30 border border-white/5 rounded-3xl"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <LayoutDashboard className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 space-y-4">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                            <LayoutDashboard className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-display font-black uppercase italic tracking-wider">Home Page</h3>
                            <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">
                              {sections.filter(s => s.page === 'home').length} Dynamic Sections
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-brand text-[10px] font-black uppercase italic tracking-widest group-hover:gap-3 transition-all">
                            Manage Content <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </button>

                      {['cricket', 'football', 'basketball', 'tennis', 'others'].map((cat) => {
                        const Icon = cat === 'football' ? Dribbble : 
                                     cat === 'cricket' ? Trophy : 
                                     cat === 'basketball' ? CircleDot : 
                                     cat === 'tennis' ? Disc : Activity;
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat as Category)}
                            className="p-8 group hover:border-brand/40 transition-all text-left relative overflow-hidden bg-surface/30 border border-white/5 rounded-3xl"
                          >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Icon className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 space-y-4">
                              <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                                <Icon className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-display font-black uppercase italic tracking-wider">{cat}</h3>
                                <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">
                                  {sections.filter(s => s.page === cat).length} Dynamic Sections
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-brand text-[10px] font-black uppercase italic tracking-widest group-hover:gap-3 transition-all">
                                Manage Content <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedCategory(null)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                      >
                        <Plus className="w-6 h-6 rotate-45" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2 text-brand mb-1">
                          <Activity className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {String(selectedCategory) === 'home' ? 'Home Main' : `${selectedCategory} Category`}
                          </span>
                        </div>
                        <h2 className="text-4xl font-black uppercase italic tracking-tighter">Section Management</h2>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button 
                          onClick={() => {
                            setEditingSliderId(null);
                            setSliderForm({ 
                              title: '', 
                              description: '', 
                              imageUrl: '', 
                              videoUrl: '', 
                              actionUrl: '', 
                              isLive: false, 
                              order: (slider.length > 0 ? Math.max(...slider.map(s => s.order)) + 1 : 0), 
                              isActive: true, 
                              animationType: 'fade',
                              page: selectedCategory 
                            });
                            setIsAddingSlider(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-widest flex items-center gap-2"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Add Hero Content
                        </button>
                        <button 
                          onClick={() => {
                            setEditingSectionId(null);
                            setSectionForm({ 
                              title: '', 
                              page: selectedCategory, 
                              contentIds: [], 
                              type: 'normal', 
                              order: (sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 0), 
                              isActive: true 
                            });
                            setIsAddingSection(true);
                          }}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Tournament Section
                        </button>
                      </div>
                    </div>

                    {/* Category Hero Slides */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase italic tracking-widest text-brand">Hero Banners</h3>
                      {slider.filter(s => s.page === selectedCategory).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {slider.filter(s => s.page === selectedCategory).map(slide => (
                            <div key={`cat-slide-${slide.id}`} className="glass-card overflow-hidden group border-white/5">
                              <div className="aspect-video relative bg-bg">
                                {slide.imageUrl && slide.imageUrl.trim() !== '' && <img src={slide.imageUrl} className="w-full h-full object-cover opacity-60" alt="" />}
                                <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-black/80 to-transparent">
                                  <div>
                                    <p className="text-xs font-black uppercase italic">{slide.title}</p>
                                    <p className="text-[10px] text-white/40 line-clamp-1">{slide.description}</p>
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <button onClick={() => { setSliderForm(slide); setEditingSliderId(slide.id); setIsAddingSlider(true); }} className="p-2 bg-black/60 rounded-lg hover:text-brand transition-colors"><Edit2 className="w-3 h-3" /></button>
                                  <button onClick={() => handleSliderDelete(slide.id)} className="p-2 bg-black/60 rounded-lg hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center glass-card border-dashed border-white/10 opacity-60 mb-8">
                           <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-3" />
                           <p className="text-[10px] font-black uppercase italic tracking-widest">No Hero Content for {selectedCategory}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase italic tracking-widest text-brand">Tournament Sections</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {sections.filter(s => s.page === selectedCategory).map(section => (
                        <div key={section.id} className="glass-card p-6 flex items-center justify-between group">
                          <div className="flex items-center gap-6">
                            <div className="w-10 h-10 bg-surface flex items-center justify-center rounded-lg border border-border">
                              <Layers className="w-5 h-5 text-brand" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-1.5 py-0.5 bg-brand/10 text-brand text-[8px] font-black uppercase tracking-tighter rounded border border-brand/20">
                                  Order: {section.order}
                                </span>
                                <h3 className="font-bold text-lg uppercase italic">{section.title}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-muted">
                                <span className="text-brand">{section.type}</span>
                                <span>•</span>
                                <span>{section.contentIds.length} Assets Attached</span>
                                <span>•</span>
                                <span className={section.isActive ? "text-green-500" : "text-red-500"}>{section.isActive ? 'Active' : 'Inactive'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleSectionEdit(section)} className="p-3 hover:text-brand transition-colors"><Edit2 className="w-5 h-5" /></button>
                            <button onClick={() => handleSectionDelete(section.id)} className="p-3 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                      ))}
                      {sections.filter(s => s.page === selectedCategory).length === 0 && (
                        <div className="py-20 text-center glass-card border-dashed border-white/10 opacity-60">
                           <Layers className="w-12 h-12 text-text-muted mx-auto mb-4" />
                           <p className="font-black uppercase italic tracking-widest">No sections in {selectedCategory} yet</p>
                           <p className="text-xs text-text-muted mt-2">Add your first tournament or highlight row above.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

           {activeTab === 'slider' && (
             <motion.div key="slider" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter">Hero Slider</h1>
                    <p className="text-text-muted font-medium">Manage the cinematic hero banners on the homepage.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingSliderId(null);
                      setSliderForm({ title: '', description: '', imageUrl: '', videoUrl: '', actionUrl: '', isLive: false, order: (slider.length > 0 ? Math.max(...slider.map(s => s.order)) + 1 : 0), isActive: true, animationType: 'fade' });
                      setIsAddingSlider(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Slide
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {slider.map(slide => (
                    <div key={slide.id} className="glass-card overflow-hidden group">
                      <div className="aspect-video relative bg-bg border-b border-border">
                        {slide.imageUrl && slide.imageUrl.trim() !== '' && <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                          <div>
                            <h3 className="text-xl font-black uppercase italic leading-none">{slide.title}</h3>
                            <p className="text-xs text-white/60 line-clamp-1">{slide.description}</p>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={() => { setSliderForm(slide); setEditingSliderId(slide.id); setIsAddingSlider(true); }} className="p-2 bg-black/60 backdrop-blur-md rounded-lg hover:text-brand transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleSliderDelete(slide.id)} className="p-2 bg-black/60 backdrop-blur-md rounded-lg hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {slide.isLive && (
                          <div className="absolute top-4 left-4 bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">Live</div>
                        )}
                      </div>
                      <div className="p-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                        <div className="flex items-center gap-4">
                          <span>Order: {slide.order}</span>
                          <span className={slide.isActive ? "text-green-500" : "text-red-500"}>{slide.isActive ? 'Active' : 'Inactive'}</span>
                          <span className="text-brand">Page: {slide.page}</span>
                        </div>
                        <span>{slide.animationType} effect</span>
                      </div>
                    </div>
                  ))}
                </div>
             </motion.div>
           )}

           {activeTab === 'live' && (
             <motion.div key="live" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter">Live Control Center</h2>
                    <p className="text-text-muted font-medium">Quickly manage broadcasting events and their status.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingId(null);
                      setForm({ 
                        title: '', 
                        description: '', 
                        category: 'football', 
                        type: 'live', 
                        videoUrl: '', 
                        thumbnailUrl: '', 
                        isPremium: false, 
                        status: 'scheduled' 
                      });
                      setIsAdding(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Radio className="w-4 h-4" />
                    New Live Event
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {content.filter(c => c.type === 'live' || c.status === 'live').map(item => (
                    <div key={`live-center-${item.id}`} className="glass-card p-6 border-l-4 border-l-brand">
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-16 bg-bg border border-border rounded overflow-hidden">
                          {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' && <img src={item.thumbnailUrl} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                          item.status === 'live' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-bg text-text-muted border-border"
                        )}>
                          {item.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm mb-1 line-clamp-1">{item.title}</h3>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest font-black mb-4">{item.category}</p>
                      
                      <div className="flex gap-2">
                        {item.status === 'live' ? (
                          <button 
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const docRef = doc(db, 'content', item.id);
                                await updateDoc(docRef, { status: 'ended' });
                                await fetchContent();
                                toast.success("Stream ended successfully.");
                              } catch (err) {
                                console.error(err);
                                toast.error("Failed to stop stream.");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="flex-grow py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                          >
                            Stop Stream
                          </button>
                        ) : (
                          <button 
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const docRef = doc(db, 'content', item.id);
                                await updateDoc(docRef, { status: 'live' });
                                await fetchContent();
                                toast.success("Stream is now LIVE!");
                              } catch (err) {
                                console.error(err);
                                toast.error("Failed to start stream.");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="flex-grow py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                          >
                            Go Live
                          </button>
                        )}
                        <button disabled={loading} onClick={() => handleEdit(item)} className="p-2 border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50" title="Edit Event"><Edit2 className="w-4 h-4" /></button>
                        <button disabled={loading} onClick={() => handleDelete(item.id)} className="p-2 border border-border rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50" title="Delete Event"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {content.filter(c => c.type === 'live' || c.status === 'live').length === 0 && (
                    <div className="col-span-full py-20 text-center glass-card border-dashed border-white/10 bg-white/5 space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                        <Radio className="w-8 h-8 text-white/20" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-white font-bold text-lg uppercase italic tracking-tighter">No live streaming is active</p>
                        <p className="text-text-muted text-xs uppercase tracking-widest">Go to Library to add a "Live Stream" or update status</p>
                      </div>
                    </div>
                  )}
                </div>
             </motion.div>
           )}

          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="space-y-2">
                <h1 className="text-5xl font-black uppercase italic tracking-tighter">Subscribers Log</h1>
                <p className="text-text-muted font-medium">Track your paid members, their mobile numbers, and subscription status.</p>
              </div>

              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-surface/50 border-b border-border">
                    <tr className="uppercase text-[10px] font-black tracking-widest text-text-muted">
                      <th className="px-6 py-5">Subscriber</th>
                      <th className="px-6 py-5">Contact</th>
                      <th className="px-6 py-5">Plan</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">Member Since</th>
                      <th className="px-6 py-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subscribers.map((sub) => (
                      <tr key={`sub-${sub.id}`} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-bold">{sub.displayName}</p>
                            <p className="text-[10px] text-text-muted">{sub.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col gap-1">
                              <span className="text-xs font-mono text-brand">{sub.mobileNumber || 'N/A'}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            sub.subscriptionTier === 'premium' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                            sub.subscriptionTier === 'pro' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-bg text-text-muted border-border"
                          )}>
                            {sub.subscriptionTier}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn("text-[10px] font-black uppercase italic", sub.subscriptionStatus === 'active' ? "text-green-500" : "text-text-muted")}>
                             {sub.subscriptionStatus || 'Inactive'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-text-muted font-mono">{formatDate(sub.createdAt)}</td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleDeleteUser(sub.id, sub.displayName || sub.email)}
                            className="p-2 hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded-lg transition-colors group"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted italic">No active subscribers found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'plans' && (
            <motion.div key="plans" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter">Subscription Plans</h1>
                  <p className="text-text-muted font-medium">Manage pricing, features, and special offers for your users.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanForm({ name: '', price: 0, description: '', features: [], icon: 'Zap', popular: false, color: 'from-slate-800 to-slate-900 border-white/5', offer: { isActive: false, percentage: 0, label: 'Limited Offer' } });
                    setIsAddingPlan(true);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Plan
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {subscriptionPlans.map((plan) => (
                  <div key={plan.id} className={cn("glass-card overflow-hidden group border", plan.popular ? "border-brand/40" : "border-white/5")}>
                    <div className={cn("p-8 bg-gradient-to-br", plan.color)}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                          <Crown className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setPlanForm(plan); setEditingPlanId(plan.id); setIsAddingPlan(true); }} className="p-2 bg-black/20 backdrop-blur-md rounded-lg hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handlePlanDelete(plan.id)} className="p-2 bg-black/20 backdrop-blur-md rounded-lg hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">{plan.name}</h3>
                      <div className="flex flex-col mb-4">
                        {plan.offer?.isActive && (
                          <span className="text-sm line-through text-white/30 font-bold italic">₹{plan.price}</span>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black">
                            ₹{plan.offer?.isActive 
                              ? Math.round(plan.price * (1 - plan.offer.percentage / 100)) 
                              : plan.price}
                          </span>
                          <span className="text-white/40 uppercase text-[10px] font-black tracking-widest">/ Month</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 space-y-6">
                      {plan.offer?.isActive && (
                        <div className="bg-brand/10 border border-brand/20 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand">{plan.offer.label}</p>
                            <p className="text-sm font-bold">{plan.offer.percentage}% Instant Discount</p>
                          </div>
                          <Percent className="w-5 h-5 text-brand" />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Active Features</p>
                        <div className="space-y-1">
                          {plan.features.slice(0, 3).map((f, i) => (
                            <div key={`${f}-${i}`} className="flex items-center gap-2 text-xs font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                              {f}
                            </div>
                          ))}
                          {plan.features.length > 3 && <p className="text-[10px] text-text-muted italic">+{plan.features.length - 3} more features</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="space-y-2">
                <h1 className="text-5xl font-black uppercase italic tracking-tighter">Global Settings</h1>
                <p className="text-text-muted font-medium">Customize your platform identity and integration URLs.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-8 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-brand/10 rounded-xl text-brand">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest">Brand Assets</h2>
                  </div>

                  <form onSubmit={handleConfigUpdate} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Founder Profile Image URL</label>
                        <div className="flex gap-4 items-start">
                          <input 
                            type="url" 
                            value={siteConfig.founderImageUrl || ''} 
                            onChange={e => setSiteConfig({...siteConfig, founderImageUrl: e.target.value})} 
                            className="flex-grow bg-bg border border-white/10 p-4 rounded-xl focus:border-brand outline-none transition-all" 
                            placeholder="Paste direct image link (Drive, Pinterest, Vimeo thumbnail, etc.)"
                          />
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand/20 bg-bg shrink-0">
                            {siteConfig.founderImageUrl && siteConfig.founderImageUrl.trim() !== '' && (
                              <img src={siteConfig.founderImageUrl} alt="Preview" className="w-full h-full object-cover grayscale" />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-text-muted mt-2 italic">Pro-Tip: Use high-quality portrait shots (transparent or solid backgrounds work best).</p>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-4 disabled:opacity-50"
                    >
                      {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {isSaving ? "Saving..." : "Save Global Configurations"}
                    </button>
                  </form>
                </div>

                <div className="glass-card p-8 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-brand/10 rounded-xl text-brand">
                      <Film className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest">Video Promo Banner</h2>
                  </div>

                  <form onSubmit={handleVideoPromoUpdate} className="space-y-6">
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                      <div className="space-y-1">
                        <p className="text-sm font-bold uppercase italic">Enable Promo Banner</p>
                        <p className="text-[10px] text-text-muted">Display the large video banner on homepage</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setVideoPromo({...videoPromo, isActive: !videoPromo.isActive})}
                        className={cn("w-12 h-6 rounded-full transition-all relative", videoPromo.isActive ? "bg-brand" : "bg-surface")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", videoPromo.isActive ? "right-1" : "left-1")} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Banner Title</label>
                        <input type="text" value={videoPromo.title || ''} onChange={e => setVideoPromo({...videoPromo, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                        <textarea rows={2} value={videoPromo.description || ''} onChange={e => setVideoPromo({...videoPromo, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Direct Video URL (.mp4)</label>
                        <div className="flex gap-2">
                          <input type="url" value={videoPromo.videoUrl || ''} onChange={e => setVideoPromo({...videoPromo, videoUrl: e.target.value})} className="flex-grow bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="https://..." />
                          <button 
                            type="button"
                            onClick={() => setActiveTab('media')}
                            className="px-4 bg-surface hover:bg-brand/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                          >
                            <Upload className="w-3 h-3" />
                            Upload
                          </button>
                        </div>
                        <p className="text-[9px] text-text-muted mt-1 italic">Use the "Upload" button to add your own video file for 100% reliability.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">OR Video Embed Code (YouTube/Vimeo)</label>
                        <textarea rows={3} value={videoPromo.embedCode || ''} onChange={e => setVideoPromo({...videoPromo, embedCode: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none font-mono text-xs" placeholder="<iframe ...></iframe>" />
                        <p className="text-[9px] text-text-muted mt-1 italic">Note: Google Drive links work best if you upload the file to the "Media Uploads" tab first.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px) font-bold uppercase tracking-widest text-white/40">Button Text</label>
                          <input type="text" value={videoPromo.buttonText || ''} onChange={e => setVideoPromo({...videoPromo, buttonText: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Button URL</label>
                          <input type="text" value={videoPromo.buttonUrl || ''} onChange={e => setVideoPromo({...videoPromo, buttonUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Background Accent Color</label>
                        <div className="flex gap-4">
                          <input type="color" value={videoPromo.backgroundColor || '#ff0000'} onChange={e => setVideoPromo({...videoPromo, backgroundColor: e.target.value})} className="h-10 w-20 bg-bg border border-white/10 rounded cursor-pointer" />
                          <input type="text" value={videoPromo.backgroundColor || '#ff0000'} onChange={e => setVideoPromo({...videoPromo, backgroundColor: e.target.value})} className="flex-grow bg-bg border border-white/10 p-2 rounded focus:border-brand outline-none uppercase font-mono text-xs" />
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-4 disabled:opacity-50"
                    >
                      {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {isSaving ? "Saving..." : "Save Banner Configuration"}
                    </button>
                  </form>
                </div>

                <div className="glass-card p-8 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-brand/10 rounded-xl text-brand">
                      <Play className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest">Global Player Configuration</h2>
                  </div>

                  <form onSubmit={handlePlayerConfigUpdate} className="space-y-6">
                    <div className="p-4 bg-brand/5 border border-brand/20 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase italic text-brand">Player Engine</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                            {playerConfig.useCustomPlayer ? "Using SportsBox Custom Player" : "Using Server Native/Iframe Player"}
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPlayerConfig({...playerConfig, useCustomPlayer: !playerConfig.useCustomPlayer})}
                          className={cn("w-14 h-7 rounded-full transition-all relative border border-white/10", playerConfig.useCustomPlayer ? "bg-brand" : "bg-surface")}
                        >
                          <div className={cn("absolute top-1 w-5 h-5 rounded-full bg-white shadow-xl transition-all", playerConfig.useCustomPlayer ? "right-1" : "left-1")} />
                        </button>
                      </div>
                      <p className="text-[9px] text-text-muted italic uppercase leading-tight">
                        {playerConfig.useCustomPlayer 
                          ? "Our custom player provides cinematic controls, gestures, and premium UI. Recommended for MP4 files." 
                          : "Native player uses raw iframes or browser defaults. Recommended for Bunny Stream, external hosts, and better mobile compatibility."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                        <span className="text-xs font-bold uppercase italic">Autoplay</span>
                        <button 
                          type="button"
                          onClick={() => setPlayerConfig({...playerConfig, autoplay: !playerConfig.autoplay})}
                          className={cn("w-10 h-5 rounded-full transition-all relative", playerConfig.autoplay ? "bg-brand" : "bg-surface")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", playerConfig.autoplay ? "right-1" : "left-1")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                        <span className="text-xs font-bold uppercase italic">Muted Default</span>
                        <button 
                          type="button"
                          onClick={() => setPlayerConfig({...playerConfig, muted: !playerConfig.muted})}
                          className={cn("w-10 h-5 rounded-full transition-all relative", playerConfig.muted ? "bg-brand" : "bg-surface")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", playerConfig.muted ? "right-1" : "left-1")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                        <span className="text-xs font-bold uppercase italic">Loop Video</span>
                        <button 
                          type="button"
                          onClick={() => setPlayerConfig({...playerConfig, loop: !playerConfig.loop})}
                          className={cn("w-10 h-5 rounded-full transition-all relative", playerConfig.loop ? "bg-brand" : "bg-surface")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", playerConfig.loop ? "right-1" : "left-1")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                        <span className="text-xs font-bold uppercase italic">Show Custom Controls</span>
                        <button 
                          type="button"
                          onClick={() => setPlayerConfig({...playerConfig, showControls: !playerConfig.showControls})}
                          className={cn("w-10 h-5 rounded-full transition-all relative", playerConfig.showControls ? "bg-brand" : "bg-surface")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all", playerConfig.showControls ? "right-1" : "left-1")} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Player Accent Color</label>
                      <div className="flex gap-4">
                        <input type="color" value={playerConfig.primaryColor || '#ff0000'} onChange={e => setPlayerConfig({...playerConfig, primaryColor: e.target.value})} className="h-10 w-20 bg-bg border border-white/10 rounded cursor-pointer" />
                        <input type="text" value={playerConfig.primaryColor || '#ff0000'} onChange={e => setPlayerConfig({...playerConfig, primaryColor: e.target.value})} className="flex-grow bg-bg border border-white/10 p-2 rounded focus:border-brand outline-none uppercase font-mono text-xs" />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-4 disabled:opacity-50"
                    >
                      {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {isSaving ? "Updating..." : "Update Player Config"}
                    </button>
                  </form>
                </div>

                <div className="glass-card p-8 border border-brand/20 bg-brand/5 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-brand/10 rounded-xl text-brand">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest text-white">Database Recovery & Setup</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                       <h4 className="font-bold text-brand uppercase text-xs tracking-widest italic">Recover Missing Content</h4>
                       <p className="text-xs text-text-muted leading-relaxed">
                         If you accidentally deleted your content or just switched to a new project, use this to populate your database with high-quality sample content for <b>Football</b> and <b>Cricket</b>.
                       </p>
                       <button 
                         onClick={initializeDefaultContent}
                         disabled={isSaving}
                         className="px-6 py-4 bg-brand text-white rounded-xl text-[10px] font-black uppercase italic tracking-[0.2em] shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50"
                       >
                         {isSaving ? <Activity className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                         Recover/Add Sample Content
                       </button>
                     </div>
                     <div className="space-y-4">
                        <h4 className="font-bold text-blue-400 uppercase text-xs tracking-widest italic">Initialize Subscription Plans</h4>
                        <p className="text-xs text-text-muted leading-relaxed">
                          Reset or create the default pricing plans (Basic, Medium, Pro) to enable paid access on your platform.
                        </p>
                        <button 
                          onClick={initializeSubscriptionPlans}
                          className="px-6 py-4 bg-surface border border-white/10 text-white rounded-xl text-[10px] font-black uppercase italic tracking-[0.2em] hover:bg-white/5 transition-all flex items-center gap-2"
                        >
                          <Crown className="w-4 h-4 text-amber-400" />
                          Initialize Pricing Plans
                        </button>
                     </div>
                  </div>
                </div>

                <div className="glass-card p-8 border-dashed border-white/5 opacity-50 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                     <Settings className="w-8 h-8 text-text-muted" />
                   </div>
                   <h3 className="font-bold uppercase tracking-widest text-xs mb-2">More Settings Coming Soon</h3>
                   <p className="text-[10px] text-text-muted max-w-[200px]">We're building more customization options for SEO, SMTP, and Payment Gateways.</p>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'trending' && (
             <motion.div key="trending" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="space-y-2">
                 <h1 className="text-5xl font-black uppercase italic tracking-tighter">Trending Center</h1>
                 <p className="text-text-muted font-medium">Manually curate the trending section or let the algorithm handle it.</p>
               </div>

               <div className="glass-card p-4 md:p-8 bg-surface/30 border border-white/5 rounded-3xl">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-amber-400/10 text-amber-400 rounded-2xl">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-black uppercase italic tracking-wider">Trending Management</h3>
                      <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Configuration & Best Practices</p>
                    </div>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="p-6 bg-brand/5 border border-brand/20 rounded-2xl">
                      <h4 className="font-bold text-brand mb-2 uppercase text-xs tracking-widest">How to edit Trending Section?</h4>
                      <p className="text-sm text-text-muted leading-relaxed mb-4">
                        The "Trending Replays" section on the Home page can be manually managed by creating a Dynamic Section.
                      </p>
                      <ul className="text-xs text-text-muted space-y-2 mb-6 list-disc pl-4">
                        <li>Go to <span className="text-white">"Sections"</span> tab (via Categories &rarr; Home Page).</li>
                        <li>Create or edit a section with the title <span className="text-white">"Trending Replays"</span>.</li>
                        <li>Include the specific videos you want to feature as trending.</li>
                        <li>This manual section will override the automatic "most viewed" list.</li>
                      </ul>
                      <button 
                        onClick={() => {
                          setSelectedCategory('home' as any);
                          setActiveTab('categories');
                        }}
                        className="w-full py-4 bg-brand text-white rounded-xl text-[10px] font-black uppercase italic tracking-[0.2em] shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all"
                      >
                        Manage Home Row Sections
                      </button>
                    </div>
                 </div>
               </div>
             </motion.div>
          )}
          {activeTab === 'domain_setup' && (
            <motion.div key="domain_setup" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-12">
               <div className="space-y-2">
                <h1 className="text-5xl font-black uppercase italic tracking-tighter text-brand">Project Identity</h1>
                <p className="text-text-muted font-medium">Configure domains and branding for Google Sign-in.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-8 border border-amber-500/20 bg-amber-500/5 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest text-white">1. Authorized Domains</h2>
                  </div>
                  
                  <p className="text-xs text-text-muted leading-relaxed">
                    To prevent <b>"Unauthorized Domain"</b> errors during login, you MUST add these URLs to your Firebase Console.
                  </p>

                  <div className="space-y-3">
                    <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                      <p className="text-[10px] font-bold uppercase text-white/40">Domains to Add:</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                           <code className="flex-1 text-[10px] bg-bg p-2 rounded border border-white/5 text-amber-400 select-all">{window.location.hostname}</code>
                           <button onClick={() => navigator.clipboard.writeText(window.location.hostname)} className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20 uppercase font-black">Copy</button>
                        </div>
                        <div className="flex items-center gap-2">
                           <code className="flex-1 text-[10px] bg-bg p-2 rounded border border-white/5 text-white/30 select-all">localhost</code>
                           <button onClick={() => navigator.clipboard.writeText('localhost')} className="text-[8px] bg-white/5 text-white/40 px-2 py-1 rounded border border-white/10 uppercase font-black">Copy</button>
                        </div>
                      </div>
                    </div>
                    
                    <a 
                      href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/authentication/settings`} 
                      target="_blank" 
                      className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl group transition-all"
                    >
                      <span className="text-[10px] font-black uppercase italic">Open Firebase Authentication Settings</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>

                <div className="glass-card p-8 border border-blue-500/20 bg-blue-500/5 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                      <Zap className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest text-white">2. Sign-in Branding</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-3">
                      <p className="text-xs font-black text-blue-400 uppercase italic">Fixing "Sign in to sportsbox-1..."</p>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        To replace the technical ID with <b>"Sign in to Sportsbox-1"</b>, you must set an "App Name" in your Google Cloud Dashboard.
                      </p>
                      
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                        <p className="text-[10px] font-black text-red-400 uppercase flex items-center gap-2">
                           <ShieldAlert className="w-3 h-3" />
                           Are you getting a "Need Access" Error?
                        </p>
                        <p className="text-[10px] text-red-500/80 leading-relaxed font-bold">
                           This happens when you have multiple Gmail accounts logged in.
                        </p>
                        <div className="pt-2 flex flex-col gap-2">
                           <p className="text-[9px] text-white/60">1. Open an <span className="text-white font-bold uppercase underline">Incognito/Private Window</span></p>
                           <p className="text-[9px] text-white/60">2. Log in with your owner account: <code className="bg-black/40 px-1 py-0.5 rounded text-red-400">{user?.email}</code></p>
                           <p className="text-[9px] text-white/60">3. Paste the <b>App Branding Link</b> found below.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-blue-400 flex items-center gap-2">
                             <span className="w-4 h-4 bg-blue-500/20 rounded flex items-center justify-center text-blue-400">A</span>
                             Project Name (Firebase)
                          </p>
                          <p className="text-[10px] text-text-muted italic">Click link #1: Set "Project name" to <b>Sportsbox</b>.</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-blue-400 flex items-center gap-2">
                             <span className="w-4 h-4 bg-blue-500/20 rounded flex items-center justify-center text-blue-400">B</span>
                             App Name (Most Important)
                          </p>
                          <p className="text-[10px] text-text-muted italic underline">Click link #2: Set "App name" to <b>Sportsbox</b>, set "Support email" to yours, and click <b>SAVE</b>.</p>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck className="w-3 h-3 text-amber-500" />
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Fixing "Additional Access" Error:</p>
                        </div>
                        <p className="text-[9px] text-text-muted leading-relaxed">
                          If you see an error saying you need access, it means you are logged into multiple Google accounts. 
                          <b> Copy the link below and open it in an Incognito/Private window</b>, then log in with your Firebase owner account.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <a 
                            href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/settings/general`} 
                            target="_blank" 
                            className="flex-grow flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl group transition-all"
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase italic">1. Firebase Settings</span>
                              <span className="text-[8px] text-text-muted">Changes the project display name</span>
                            </div>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </a>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`https://console.firebase.google.com/project/${auth.app.options.projectId}/settings/general`);
                              toast.success("Link copied. Open this in an Incognito window!");
                            }}
                            className="px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[8px] font-black uppercase italic text-text-muted"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <a 
                            href={`https://console.cloud.google.com/apis/credentials/consent?project=${auth.app.options.projectId}`} 
                            target="_blank" 
                            className="flex-grow flex items-center justify-between p-4 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl group transition-all border border-blue-500/40 shadow-lg shadow-blue-500/5 animate-pulse-slow"
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase italic text-blue-400">2. Google Cloud OAuth Consent (MOST IMPORTANT)</span>
                              <span className="text-[8px] text-blue-400/60 uppercase font-bold">Changes the Popup Text</span>
                            </div>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-blue-400" />
                          </a>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`https://console.cloud.google.com/apis/credentials/consent?project=${auth.app.options.projectId}`);
                              toast.success("Most important link copied. Open this in Incognito!");
                            }}
                            className="px-4 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 text-[8px] font-black uppercase italic text-blue-400"
                          >
                            Copy
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <a 
                            href={`https://console.cloud.google.com/apis/credentials?project=${auth.app.options.projectId}`} 
                            target="_blank" 
                            className="flex-grow flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl group transition-all"
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase italic">3. Google Cloud Credentials</span>
                              <span className="text-[8px] text-text-muted">Add "Authorized JavaScript origins" here</span>
                            </div>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </a>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`https://console.cloud.google.com/apis/credentials?project=${auth.app.options.projectId}`);
                              toast.success("Credentials link copied.");
                            }}
                            className="px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[8px] font-black uppercase italic text-text-muted"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-8 border border-red-500/20 bg-red-500/5 space-y-6 md:col-span-2">
                   <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-display font-black uppercase italic tracking-widest text-white">Troubleshooting "Internal Errors"</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <p className="text-xs font-bold text-red-500 uppercase italic">Error: An internal error occurred</p>
                       <p className="text-xs text-text-muted leading-relaxed">
                         If you see this error when fetching data, it usually means the <b>Named Database</b> is not yet created or provisioned in your Firebase Project.
                       </p>
                    </div>
                    <div className="space-y-3">
                       <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                          <p className="text-[10px] font-bold uppercase text-white/40 mb-2">Current Database ID:</p>
                          <code className="text-[10px] bg-bg p-2 rounded border border-white/5 text-red-400 block truncate">{(auth.app.options as any).databaseId || '(default)'}</code>
                       </div>
                       <p className="text-[9px] text-text-muted italic">Ensure this database ID exists in your Firestore console under "Databases".</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'likes' && (
            <motion.div key="likes" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter">Likes Insight</h1>
                  <p className="text-text-muted font-medium">Analyze fan engagement and identify your most popular broadcasts.</p>
                </div>
                <button 
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to reset ALL likes and liker data for all content? This cannot be undone.')) {
                      setLikesLoading(true);
                      try {
                        const contentSnap = await getDocs(collection(db, 'content'));
                        for (const contentDoc of contentSnap.docs) {
                          // Reset counter
                          await updateDoc(doc(db, 'content', contentDoc.id), { likes: 0 });
                          
                          // Optional: Clear subcollection (Note: This only deletes the first 500 to stay safe)
                          const likesSnap = await getDocs(collection(db, 'content', contentDoc.id, 'likes'));
                          for (const likeDoc of likesSnap.docs) {
                            await deleteDoc(doc(db, 'content', contentDoc.id, 'likes', likeDoc.id));
                          }
                        }
                        // Refresh content list to show 0 likes
                        const updatedContentSnap = await getDocs(collection(db, 'content'));
                        setContent(updatedContentSnap.docs.map(d => ({ id: d.id, ...d.data() } as SportsContent)));
                        toast.success('All likes have been reset to zero.');
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to reset likes.');
                      } finally {
                        setLikesLoading(false);
                      }
                    }
                  }}
                  className="px-6 py-3 bg-red-600/10 border border-red-600/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                  disabled={likesLoading}
                >
                  <Trash2 className="w-4 h-4" />
                  {likesLoading ? 'Resetting...' : 'Reset All System Likes'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-surface/50 border-b border-border">
                        <tr className="uppercase text-[10px] font-black tracking-widest text-text-muted">
                          <th className="px-6 py-5">Broadcast</th>
                          <th className="px-6 py-5">Likes</th>
                          <th className="px-6 py-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {content.filter(item => (item.likes || 0) > 0).sort((a, b) => (b.likes || 0) - (a.likes || 0)).map((item) => (
                          <tr key={`like-insight-${item.id}`} className={cn("hover:bg-surface-hover/30 transition-colors cursor-pointer", selectedContentLikes?.id === item.id && "bg-brand/5 border-l-2 border-l-brand")}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-8 rounded bg-surface overflow-hidden">
                                  {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' && (
                                    <img src={transformGDriveUrl(item.thumbnailUrl, 'image')} className="w-full h-full object-cover" alt="" />
                                  )}
                                </div>
                                <span className="text-sm font-bold truncate max-w-[200px]">{item.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-brand">
                                <Heart className="w-3 h-3 fill-brand" />
                                <span className="text-xs font-black">{item.likes || 0}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => fetchContentLikes(item.id, item.title)}
                                className={cn(
                                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  selectedContentLikes?.id === item.id ? "bg-brand text-white" : "bg-surface border border-border hover:border-brand/40"
                                )}
                              >
                                {likesLoading && selectedContentLikes?.id === item.id ? 'Loading...' : 'View Likers'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedContentLikes ? (
                    <div className="glass-card p-6 border border-brand/20 bg-brand/5 space-y-6 sticky top-8">
                       <div className="flex items-center justify-between">
                         <div className="space-y-1">
                           <h3 className="text-sm font-black uppercase italic tracking-widest">Likers Details</h3>
                           <p className="text-[10px] text-text-muted truncate max-w-[150px]">{selectedContentLikes.title}</p>
                         </div>
                         <button onClick={() => setSelectedContentLikes(null)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                           <X className="w-4 h-4" />
                         </button>
                       </div>

                       <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                         {selectedContentLikes.likers.length > 0 ? (
                            selectedContentLikes.likers.map((liker, idx) => (
                              <div key={idx} className="p-3 bg-black/20 rounded-xl border border-white/5 space-y-1">
                                <p className="text-xs font-bold text-white">{liker.displayName || 'Anonymous'}</p>
                                <p className="text-[9px] text-text-muted font-medium">{liker.email || 'No Email provided'}</p>
                                <p className="text-[8px] text-white/20 font-mono mt-1 uppercase tracking-tighter">ID: {liker.id}</p>
                              </div>
                            ))
                         ) : (
                           <p className="text-center py-12 text-text-muted text-[10px] font-bold uppercase tracking-widest">No details recorded for older likes</p>
                         )}
                       </div>
                    </div>
                  ) : (
                    <div className="glass-card p-12 border border-white/5 bg-surface/30 flex flex-col items-center justify-center text-center space-y-4">
                      <Heart className="w-12 h-12 text-white/5" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Select a broadcast</p>
                        <p className="text-[9px] text-text-muted mt-1 px-4">Click "View Likers" to see details about the fans who reacted to the content.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'media' && (
            <motion.div key="media" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter">Media Assets</h1>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button 
                      onClick={() => { setCurrentFolder(null); setCurrentFolderName(null); }}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
                        !currentFolder ? "bg-brand text-white" : "bg-surface hover:bg-brand/20 text-text-muted"
                      )}
                    >
                      Library
                    </button>
                    {currentFolderName && (
                      <>
                        <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-brand text-white rounded-lg whitespace-nowrap">
                          {currentFolderName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsCreatingFolder(true)}
                    className="px-6 py-3 bg-surface border border-white/5 text-xs font-black uppercase italic hover:bg-brand hover:text-white transition-all flex items-center gap-2 rounded-2xl"
                  >
                    <Plus className="w-4 h-4" />
                    New Folder
                  </button>
                </div>
              </div>

              {isCreatingFolder && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border-brand/50 bg-brand/5 flex items-center gap-4">
                  <Folder className="w-8 h-8 text-brand" />
                  <form onSubmit={createFolder} className="flex-grow flex gap-4">
                    <input 
                      autoFocus
                      type="text" 
                      value={newFolderName} 
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder Name..."
                      className="flex-grow bg-bg border border-white/10 p-3 rounded-xl focus:border-brand outline-none"
                    />
                    <button type="submit" className="px-6 bg-brand text-white rounded-xl font-bold uppercase text-[10px]">Create</button>
                    <button type="button" onClick={() => setIsCreatingFolder(false)} className="px-6 bg-surface text-text-muted rounded-xl font-bold uppercase text-[10px]">Cancel</button>
                  </form>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                  <MediaManager onUploadComplete={fetchMediaItems} folderId={currentFolder} />
                </div>
                
                <div className="lg:col-span-3 space-y-8">
                  {/* Folders Selection (Only shown at root or can be nested if parentId implemented) */}
                  {!currentFolder && (
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                      {folders.filter(f => !f.parentId).map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => { setCurrentFolder(folder.id); setCurrentFolderName(folder.name); }}
                          className="bg-[#0a0c10] border border-white/5 p-8 group flex flex-col items-center justify-center text-center gap-5 hover:border-brand/40 hover:bg-brand/5 transition-all aspect-square rounded-[32px] relative"
                        >
                          <div className="w-20 h-20 flex items-center justify-center transition-all group-hover:scale-110">
                            <Folder className="w-12 h-12 text-brand fill-brand/10" strokeWidth={1.5} />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-xs uppercase tracking-widest text-white/90">{folder.name}</p>
                          </div>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id, folder.name); }}
                              className="p-2 text-white/10 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {currentFolder && (
                      <button 
                        onClick={() => { setCurrentFolder(null); setCurrentFolderName(null); }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-brand transition-colors mb-4"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Library
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {mediaItems.length === 0 ? (
                        <div className="col-span-full py-20 bg-surface/30 rounded-[32px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                          <Film className="w-12 h-12 text-white/10 mb-4" />
                          <p className="text-text-muted font-bold uppercase tracking-widest text-xs">No media in this directory</p>
                        </div>
                      ) : (
                        mediaItems.map(item => (
                          <div key={`library-${item.id}`} className="glass-card p-4 group flex gap-4 items-center">
                            <div className="w-20 h-20 bg-bg rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative">
                              {item.url && item.url.trim() !== '' && <video src={item.url} className="w-full h-full object-cover opacity-50" />}
                              <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/20 transition-all">
                                <Play className="w-6 h-6 text-white/50 group-hover:text-brand transition-colors" />
                              </div>
                            </div>
                            <div className="flex-grow min-w-0">
                              <h4 className="font-bold text-xs truncate uppercase tracking-wider">{item.name}</h4>
                              <p className="text-[10px] text-text-muted mb-2">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => copyToClipboard(item.url)}
                                  className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline"
                                >
                                  Copy URL
                                </button>
                                <button 
                                  onClick={() => deleteMedia(item.id)}
                                  className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

       <AnimatePresence>
        {isAdding && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-xl bg-surface border-l border-white/10 z-[70] p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display uppercase font-black tracking-widest italic">{editingId ? 'Edit Content' : 'New Content'}</h2>
                <button onClick={() => setIsAdding(false)}><X className="w-6 h-6 hover:text-brand" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Title</label>
                  <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Category</label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value as Category})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="football">Football</option>
                      <option value="cricket">Cricket</option>
                      <option value="basketball">Basketball</option>
                      <option value="tennis">Tennis</option>
                      <option value="others">Others</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Type</label>
                     <select value={form.type} onChange={e => setForm({...form, type: e.target.value as ContentType})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                        <option value="replay">Replay</option>
                        <option value="highlight">Highlight</option>
                        <option value="live">Live Stream</option>
                     </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Broadcasting Status</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live Now</option>
                      <option value="ended">Ended</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Video URL (m3u8/mp4/Youtube)</label>
                  <div className="flex gap-2">
                    <input type="text" required value={form.videoUrl} onChange={e => setForm({...form, videoUrl: e.target.value})} className="flex-grow bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                    <button 
                      type="button" 
                      onClick={() => setPreviewContent({ 
                        url: transformGDriveUrl(form.videoUrl, 'video'), 
                        title: form.title || 'Preview', 
                        isLive: form.status === 'live' 
                      })}
                      className="px-4 bg-surface hover:bg-brand/10 border border-white/10 rounded-md text-[10px] font-bold uppercase"
                      title="Preview Current URL"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setActiveTab('media')} className="px-4 bg-surface hover:bg-brand/10 border border-white/10 rounded-md text-[10px] font-bold uppercase"><Upload className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Search tags (comma separated)</label>
                  <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="e.g. final, world cup, ronaldo, highlights" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Thumbnail URL</label>
                  <input type="url" value={form.thumbnailUrl} onChange={e => setForm({...form, thumbnailUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-md">
                   <input type="checkbox" id="isPremium" checked={form.isPremium} onChange={e => setForm({...form, isPremium: e.target.checked})} className="w-4 h-4 accent-brand" />
                   <label htmlFor="isPremium" className="text-sm font-bold uppercase cursor-pointer">Premium Content</label>
                </div>
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Content
                </button>
              </form>
            </motion.div>
          </>
        )}

        {isAddingSection && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingSection(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-xl bg-surface border-l border-white/10 z-[70] p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display uppercase font-black tracking-widest italic">{editingSectionId ? 'Edit Section' : 'New Section'}</h2>
                <button onClick={() => setIsAddingSection(false)}><X className="w-6 h-6 hover:text-brand" /></button>
              </div>
              <form onSubmit={handleSectionSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Section Title</label>
                  <input type="text" required value={sectionForm.title} onChange={e => setSectionForm({...sectionForm, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Page</label>
                    <select value={sectionForm.page} onChange={e => setSectionForm({...sectionForm, page: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="home">Home Page</option>
                      <option value="football">Football Category</option>
                      <option value="cricket">Cricket Category</option>
                      <option value="basketball">Basketball Category</option>
                      <option value="tennis">Tennis Category</option>
                      <option value="others">Others Category</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Display Type</label>
                    <select value={sectionForm.type} onChange={e => setSectionForm({...sectionForm, type: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="normal">Standard Grid</option>
                      <option value="tournament">Tournament (Grid)</option>
                      <option value="single-row">Single Row (Scrollable)</option>
                      <option value="featured">Featured Large</option>
                      <option value="top10">Top 10 Style</option>
                      <option value="hero">Hero Section Type</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Display Order (Numbering)</label>
                  <input 
                    type="number" 
                    value={sectionForm.order} 
                    onChange={e => setSectionForm({...sectionForm, order: parseInt(e.target.value) || 0})} 
                    className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none"
                    placeholder="e.g. 1 (Top), 2, 3..."
                  />
                  <p className="text-[9px] text-text-muted italic">Lower numbers appear first. Use 1, 2, 3 etc. to rank sections.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Frame Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSectionForm({ ...sectionForm, aspectRatio: 'landscape' })}
                      className={cn(
                        "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                        sectionForm.aspectRatio === 'landscape' ? "bg-brand/10 border-brand text-brand" : "bg-surface border-white/5 text-text-muted"
                      )}
                    >
                      <div className="w-16 h-9 rounded bg-current opacity-20 border border-current" />
                      <span className="text-[10px] font-black uppercase">Landscape (16:9)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectionForm({ ...sectionForm, aspectRatio: 'portrait' })}
                      className={cn(
                        "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                        sectionForm.aspectRatio === 'portrait' ? "bg-brand/10 border-brand text-brand" : "bg-surface border-white/5 text-text-muted"
                      )}
                    >
                      <div className="w-10 h-14 rounded bg-current opacity-20 border border-current" />
                      <span className="text-[10px] font-black uppercase">Vertical (2:3)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Content (Click to toggle)</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-2 bg-bg border border-white/10 rounded-md">
                    {content
                      .filter(item => sectionForm.page === 'home' || item.category === sectionForm.page)
                      .map(item => (
                      <div 
                        key={`section-picker-${item.id}`} 
                        onClick={() => {
                          const ids = [...(sectionForm.contentIds || [])];
                          if (ids.includes(item.id)) {
                            setSectionForm({...sectionForm, contentIds: ids.filter(id => id !== item.id)});
                          } else {
                            setSectionForm({...sectionForm, contentIds: [...ids, item.id]});
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          sectionForm.contentIds?.includes(item.id) ? "bg-brand/10 border-brand" : "bg-surface border-transparent"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center", sectionForm.contentIds?.includes(item.id) ? "bg-brand border-brand" : "border-white/20")}>
                          {sectionForm.contentIds?.includes(item.id) && <Plus className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-bold">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-md">
                   <input type="checkbox" id="isActiveSection" checked={sectionForm.isActive} onChange={e => setSectionForm({...sectionForm, isActive: e.target.checked})} className="w-4 h-4 accent-brand" />
                   <label htmlFor="isActiveSection" className="text-sm font-bold uppercase cursor-pointer">Active Section</label>
                </div>
                
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Section
                </button>
              </form>
            </motion.div>
          </>
        )}

        {isAddingSlider && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingSlider(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-xl bg-surface border-l border-white/10 z-[70] p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display uppercase font-black tracking-widest italic">{editingSliderId ? 'Edit Slide' : 'New Slide'}</h2>
                <button onClick={() => setIsAddingSlider(false)}><X className="w-6 h-6 hover:text-brand" /></button>
              </div>
              <form onSubmit={handleSliderSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Quick Import from Library</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto p-2 bg-bg border border-white/10 rounded-md">
                    {content
                      .filter(item => sliderForm.page === 'home' || item.category === sliderForm.page)
                      .map(item => (
                        <button
                          key={`slider-picker-${item.id}`}
                          type="button"
                          onClick={() => {
                            setSliderForm({
                              ...sliderForm,
                              title: item.title,
                              description: item.description,
                              imageUrl: item.thumbnailUrl || '',
                              videoUrl: item.videoUrl,
                              actionUrl: `/watch/${item.id}`,
                            });
                          }}
                          className="flex items-center gap-3 p-2 rounded-lg bg-surface hover:bg-brand/10 border border-transparent hover:border-brand/50 transition-all text-left w-full"
                        >
                          <div className="w-10 h-6 rounded bg-bg overflow-hidden shrink-0 border border-border">
                            {item.thumbnailUrl && item.thumbnailUrl.trim() !== '' && <img src={item.thumbnailUrl} className="w-full h-full object-cover" />}
                          </div>
                          <span className="text-[10px] font-bold truncate">{item.title}</span>
                        </button>
                      ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Slide Title</label>
                  <input type="text" required value={sliderForm.title || ''} onChange={e => setSliderForm({...sliderForm, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea rows={2} value={sliderForm.description || ''} onChange={e => setSliderForm({...sliderForm, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Hero Image URL</label>
                    <input type="url" required value={sliderForm.imageUrl || ''} onChange={e => setSliderForm({...sliderForm, imageUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Background Video URL (Optional)</label>
                    <div className="flex gap-2">
                      <input type="url" value={sliderForm.videoUrl || ''} onChange={e => setSliderForm({...sliderForm, videoUrl: e.target.value})} className="flex-grow bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="https://..." />
                      <button type="button" onClick={() => setActiveTab('media')} className="px-4 bg-surface hover:bg-brand/10 border border-white/10 rounded-md text-[10px] font-bold uppercase"><Upload className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Action URL</label>
                    <input type="text" value={sliderForm.actionUrl || ''} onChange={e => setSliderForm({...sliderForm, actionUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="/watch/id" />
                   </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Animation Type</label>
                    <select value={sliderForm.animationType || 'fade'} onChange={e => setSliderForm({...sliderForm, animationType: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Slide Order</label>
                    <input type="number" value={sliderForm.order ?? 0} onChange={e => setSliderForm({...sliderForm, order: parseInt(e.target.value) || 0})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Page / Category</label>
                  <select value={sliderForm.page} onChange={e => setSliderForm({...sliderForm, page: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                    <option value="home">Home Page</option>
                    <option value="football">Football Category</option>
                    <option value="cricket">Cricket Category</option>
                    <option value="basketball">Basketball Category</option>
                    <option value="tennis">Tennis Category</option>
                    <option value="others">Others Category</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-grow flex items-center gap-3 bg-white/5 p-4 rounded-md">
                     <input type="checkbox" id="isLiveSlide" checked={sliderForm.isLive} onChange={e => setSliderForm({...sliderForm, isLive: e.target.checked})} className="w-4 h-4 accent-brand" />
                     <label htmlFor="isLiveSlide" className="text-sm font-bold uppercase cursor-pointer">Live Badge</label>
                  </div>
                  <div className="flex-grow flex items-center gap-3 bg-white/5 p-4 rounded-md">
                     <input type="checkbox" id="isActiveSlide" checked={sliderForm.isActive} onChange={e => setSliderForm({...sliderForm, isActive: e.target.checked})} className="w-4 h-4 accent-brand" />
                     <label htmlFor="isActiveSlide" className="text-sm font-bold uppercase cursor-pointer">Active</label>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Slide
                </button>
              </form>
            </motion.div>
          </>
        )}

        {/* Video Preview Modal */}
        {isAddingPlan && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingPlan(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-xl bg-surface border-l border-white/10 z-[70] p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display uppercase font-black tracking-widest italic">{editingPlanId ? 'Edit Plan' : 'New Plan'}</h2>
                <button onClick={() => setIsAddingPlan(false)}><X className="w-6 h-6 hover:text-brand" /></button>
              </div>
              <form onSubmit={handlePlanSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Plan Name</label>
                  <input type="text" required value={planForm.name || ''} onChange={e => setPlanForm({...planForm, name: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="e.g. Pro Stadium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Price (Monthly INR)</label>
                  <input type="number" step="1" required value={planForm.price ?? 0} onChange={e => setPlanForm({...planForm, price: parseFloat(e.target.value) || 0})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea rows={2} value={planForm.description || ''} onChange={e => setPlanForm({...planForm, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Features (One per line)</label>
                  <textarea 
                    rows={4} 
                    value={planForm.features?.join('\n')} 
                    onChange={e => setPlanForm({...planForm, features: e.target.value.split('\n').filter(f => f.trim())})} 
                    className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none"
                    placeholder="All Live Matches&#10;No Ads&#10;Full HD"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Lucide Icon Name</label>
                    <select value={planForm.icon} onChange={e => setPlanForm({...planForm, icon: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="Zap">Zap (Basic)</option>
                      <option value="Crown">Crown (Pro)</option>
                      <option value="ShieldCheck">ShieldCheck (Premium)</option>
                      <option value="Star">Star</option>
                      <option value="Activity">Activity</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Is Popular Plan?</label>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-md h-[46px]">
                       <input type="checkbox" id="isPopularPlan" checked={planForm.popular} onChange={e => setPlanForm({...planForm, popular: e.target.checked})} className="w-4 h-4 accent-brand" />
                       <label htmlFor="isPopularPlan" className="text-xs font-bold uppercase cursor-pointer">Yes, Highlight it</label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Display Order</label>
                    <input type="number" value={planForm.order} onChange={e => setPlanForm({...planForm, order: parseInt(e.target.value)})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-brand">Special Offer / Promotion</h3>
                    <button 
                      type="button"
                      onClick={() => setPlanForm({
                        ...planForm, 
                        offer: { 
                          isActive: !planForm.offer?.isActive, 
                          percentage: planForm.offer?.percentage || 0,
                          label: planForm.offer?.label || 'Limited Offer'
                        }
                      })}
                      className={cn("w-12 h-6 rounded-full transition-all relative", planForm.offer?.isActive ? "bg-brand" : "bg-surface")}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", planForm.offer?.isActive ? "right-1" : "left-1")} />
                    </button>
                  </div>

                  {planForm.offer?.isActive && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-white/5 p-4 rounded-xl">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Discount Percentage (0-100%)</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={planForm.offer?.percentage || 0} 
                            onChange={e => setPlanForm({
                              ...planForm, 
                              offer: { 
                                isActive: true,
                                label: planForm.offer?.label || 'Limited Offer',
                                percentage: parseInt(e.target.value) 
                              }
                            })} 
                            className="flex-grow accent-brand" 
                          />
                          <span className="text-lg font-black font-mono w-12">{planForm.offer?.percentage || 0}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Offer Label (Badge)</label>
                        <input 
                          type="text" 
                          value={planForm.offer?.label || ''} 
                          onChange={e => setPlanForm({
                            ...planForm, 
                            offer: { 
                              isActive: true,
                              percentage: planForm.offer?.percentage || 0,
                              label: e.target.value 
                            }
                          })} 
                          className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" 
                          placeholder="e.g. 50% Ramadan Special" 
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                  <Save className="w-5 h-5" />
                  Save Subscription Plan
                </button>
              </form>
            </motion.div>
          </>
        )}

        {previewContent && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            >
              <div className="w-full max-w-5xl aspect-video bg-black rounded-[32px] overflow-hidden shadow-2xl relative border border-white/10">
                <StadiumPlayer 
                  url={previewContent.url}
                  isLive={previewContent.isLive}
                />
                <button 
                  onClick={() => setPreviewContent(null)}
                  className="absolute top-6 right-6 z-50 w-12 h-12 bg-white/10 hover:bg-red-500/20 hover:text-red-500 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 transition-all text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all", active ? "bg-brand text-white" : "text-text-muted hover:bg-surface/50 border border-transparent")}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatsCard({ label, value, icon: Icon, color, subtitle }: { label: string, value: any, icon: any, color: string, subtitle?: string }) {
  return (
    <div className="glass-card p-8 flex items-start justify-between bg-surface/30">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">{label}</div>
        <div className="text-4xl font-black uppercase italic tracking-tighter">{value}</div>
        {subtitle && <div className="text-[8px] font-bold text-white/20 mt-2 uppercase tracking-widest">{subtitle}</div>}
      </div>
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
