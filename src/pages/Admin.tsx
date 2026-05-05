import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc } from 'firebase/firestore';
import { SportsContent, Category, ContentType, ContentSection, SliderElement, VideoPromoSettings, SiteConfig, PlayerSettings, SubscriptionPlan } from '../types';
import { Plus, Trash2, Edit2, Play, LayoutDashboard, Film, Users, Settings, Save, X, Eye, Radio, Crown, Layers, MoveUp, MoveDown, CheckSquare, Square, Image as ImageIcon, Upload, Library, ShieldCheck, Zap, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, transformGDriveUrl } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import MediaManager from '../components/MediaManager';
import StadiumPlayer from '../components/StadiumPlayer';

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'live' | 'sections' | 'slider' | 'users' | 'settings' | 'media' | 'plans'>('dashboard');
  const [content, setContent] = useState<SportsContent[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [slider, setSlider] = useState<SliderElement[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    founderImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop'
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
    viewCount: 0
  });

  // Section Form state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState<Partial<ContentSection>>({
    title: '',
    page: 'home',
    contentIds: [],
    type: 'normal',
    order: 0,
    isActive: true
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
    animationType: 'fade'
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

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchContent();
      fetchSections();
      fetchSlider();
      fetchSubscribers();
      fetchSiteConfig();
      fetchVideoPromo();
      fetchMediaItems();
      fetchPlayerConfig();
      fetchSubscriptionPlans();
    }
  }, [isAdmin]);

  const fetchSubscriptionPlans = async () => {
    try {
      const q = query(collection(db, 'subscription_plans'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      if (snap.empty) {
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
        setSubscriptionPlans(defaultPlans as SubscriptionPlan[]);
      } else {
        setSubscriptionPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
      }
    } catch (err) {
      console.error("Fetch plans error:", err);
    }
  };

  const fetchPlayerConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'playerConfig');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPlayerConfig(snap.data() as PlayerSettings);
      }
    } catch (err) {
      console.error("Player config fetch error:", err);
    }
  };

  const handlePlayerConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'settings', 'playerConfig');
      await setDoc(docRef, playerConfig);
      alert("Player configuration updated!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/playerConfig');
    }
  };

  const fetchMediaItems = async () => {
    try {
      const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Fetch media error:", err);
    }
  };

  const deleteMedia = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media?")) return;
    try {
      await deleteDoc(doc(db, 'library', id));
      setMediaItems(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error("Delete media error:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("URL copied to clipboard!");
  };

  const fetchVideoPromo = async () => {
    try {
      const docRef = doc(db, 'settings', 'videoPromo');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setVideoPromo(prev => ({ ...prev, ...docSnap.data() }));
      }
    } catch (error) {
      console.error("Video promo fetch error:", error);
    }
  };

  const [previewContent, setPreviewContent] = useState<{url: string, title: string, isLive: boolean} | null>(null);

  const handleVideoPromoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transformedUrl = transformGDriveUrl(videoPromo.videoUrl, 'video');
      const finalPromo = { ...videoPromo, videoUrl: transformedUrl };
      
      const docRef = doc(db, 'settings', 'videoPromo');
      await setDoc(docRef, finalPromo);
      setVideoPromo(finalPromo);
      alert("Video Promo Banner updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/videoPromo');
    }
  };

  const fetchSiteConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'siteConfig');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSiteConfig(docSnap.data());
      }
    } catch (error) {
      console.error("Config fetch error:", error);
    }
  };

  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transformedUrl = transformGDriveUrl(siteConfig.founderImageUrl || '', 'image');
      const finalConfig = { ...siteConfig, founderImageUrl: transformedUrl };

      const docRef = doc(db, 'settings', 'siteConfig');
      await updateDoc(docRef, finalConfig).catch(async (err) => {
        if (err.code === 'not-found') {
          await setDoc(docRef, finalConfig);
        } else {
          throw err;
        }
      });
      setSiteConfig(finalConfig);
      alert("Settings updated successfully! Links were optimized for display.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/siteConfig');
    }
  };

  const fetchSubscribers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      setSubscribers(items.filter(u => u.subscriptionTier !== 'free' || u.mobileNumber));
    } catch (error) {
      console.error(error);
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
      const finalForm = { ...form, videoUrl: transformedVideoUrl, thumbnailUrl: transformedThumbUrl };

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
      setIsAdding(false);
      setEditingId(null);
      fetchContent();
      setForm({ title: '', description: '', category: 'football', type: 'replay', videoUrl: '', isPremium: false, status: 'scheduled' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'content');
    }
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.contentIds || sectionForm.contentIds.length === 0) {
      alert("Please select at least one piece of content for this section.");
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
      setSectionForm({ title: '', page: 'home', contentIds: [], type: 'normal', order: 0, isActive: true });
    } catch (error) {
      console.error("Section save error:", error);
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
      setSliderForm({ title: '', description: '', imageUrl: '', videoUrl: '', actionUrl: '', isLive: false, order: 0, isActive: true, animationType: 'fade' });
    } catch (error) {
      handleFirestoreError(error, editingSliderId ? OperationType.UPDATE : OperationType.CREATE, 'slider');
    }
  };

  const handleEdit = (item: SportsContent) => {
    setForm(item);
    setEditingId(item.id);
    setIsAdding(true);
  };

  const handleSectionEdit = (section: ContentSection) => {
    setSectionForm(section);
    setEditingSectionId(section.id);
    setIsAddingSection(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    try {
      await deleteDoc(doc(db, 'content', id));
      fetchContent();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `content/${id}`);
    }
  };

  const handleSliderDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    try {
      await deleteDoc(doc(db, 'slider', id));
      fetchSlider();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `slider/${id}`);
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
      await fetchSubscriptionPlans();
      alert("Plan saved successfully!");
    } catch (error) {
      console.error("Plan save error:", error);
      alert("Failed to save plan. Check console for details.");
      handleFirestoreError(error, editingPlanId ? OperationType.UPDATE : OperationType.CREATE, 'subscription_plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await deleteDoc(doc(db, 'subscription_plans', id));
      fetchSubscriptionPlans();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `subscription_plans/${id}`);
    }
  };

  const handleSectionDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    try {
      await deleteDoc(doc(db, 'sections', id));
      fetchSections();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sections/${id}`);
    }
  };

  const liveItems = content.filter(c => c.status === 'live');

  if (authLoading) return <div className="h-screen flex items-center justify-center font-black uppercase tracking-widest italic animate-pulse">Initializing System...</div>;
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
          <SidebarLink icon={Layers} label="Sections" active={activeTab === 'sections'} onClick={() => setActiveTab('sections')} />
          <SidebarLink icon={ImageIcon} label="Hero Slider" active={activeTab === 'slider'} onClick={() => setActiveTab('slider')} />
          <SidebarLink icon={Radio} label="Live Center" active={activeTab === 'live'} onClick={() => setActiveTab('live')} />
          <SidebarLink icon={Users} label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <SidebarLink icon={Crown} label="Subscription Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
          <SidebarLink icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <SidebarLink icon={Library} label="Media Uploads" active={activeTab === 'media'} onClick={() => setActiveTab('media')} />
        </div>
      </div>

      <div className="flex-grow p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-12">
               <div className="space-y-2">
                <h1 className="text-5xl font-black uppercase italic tracking-tighter">Command Center</h1>
                <p className="text-text-muted font-medium">Real-time statistics and quick actions for SportBox.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatsCard label="Total Media" value={content.length} icon={Film} color="text-red-600" />
                <StatsCard label="Broadcasting" value={liveItems.length} icon={Radio} color="text-red-500" />
                <StatsCard label="Total Impressions" value={(content.reduce((acc, c) => acc + (c.viewCount || 0), 0) / 1000000).toFixed(1) + 'M'} icon={Eye} color="text-blue-500" />
                <StatsCard label="Premium Ratio" value={content.length > 0 ? Math.round((content.filter(c => c.isPremium).length / content.length) * 100) + '%' : '0%'} icon={Crown} color="text-yellow-500" />
              </div>

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
                        alert("Video 'test1234' added successfully to Football!");
                        fetchContent();
                      } catch (err) {
                        alert("Error adding video. Check console.");
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
                      <tr key={item.id} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-20 rounded-lg overflow-hidden bg-bg border border-border">
                              {item.thumbnailUrl && <img src={item.thumbnailUrl} className="w-full h-full object-cover" alt="" />}
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
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setPreviewContent({ 
                                url: transformGDriveUrl(item.videoUrl, 'video'), 
                                title: item.title, 
                                isLive: item.status === 'live' 
                              })} 
                              className="p-2 hover:text-brand transition-colors"
                              title="Preview Video"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleEdit(item)} className="p-2 hover:text-brand transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

           {activeTab === 'sections' && (
             <motion.div key="sections" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter">Page Sections</h1>
                    <p className="text-text-muted font-medium">Curate custom rows for your Home and Sports pages.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingSectionId(null);
                      setSectionForm({ title: '', page: 'home', contentIds: [], type: 'normal', order: (sections.length > 0 ? Math.max(...sections.map(s => s.order)) + 1 : 0), isActive: true });
                      setIsAddingSection(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Section
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {sections.map(section => (
                    <div key={section.id} className="glass-card p-6 flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-surface flex items-center justify-center rounded-lg border border-border">
                          <Layers className="w-5 h-5 text-brand" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg uppercase italic">{section.title}</h3>
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-muted">
                            <span className="text-brand">{section.type}</span>
                            <span>•</span>
                            <span>Page: {section.page}</span>
                            <span>•</span>
                            <span>{section.contentIds.length} Assets</span>
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
                </div>
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
                        {slide.imageUrl && <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />}
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
                <div className="space-y-2">
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter">Live Control Center</h2>
                  <p className="text-text-muted font-medium">Quickly manage broadcasting events and their status.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {content.filter(c => c.type === 'live' || c.status === 'live').map(item => (
                    <div key={item.id} className="glass-card p-6 border-l-4 border-l-brand">
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-16 bg-bg border border-border rounded overflow-hidden">
                          {item.thumbnailUrl && <img src={item.thumbnailUrl} className="w-full h-full object-cover" alt="" />}
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
                            onClick={async () => {
                              const docRef = doc(db, 'content', item.id);
                              await updateDoc(docRef, { status: 'ended' });
                              fetchContent();
                            }}
                            className="flex-grow py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                          >
                            Stop Stream
                          </button>
                        ) : (
                          <button 
                            onClick={async () => {
                              const docRef = doc(db, 'content', item.id);
                              await updateDoc(docRef, { status: 'live' });
                              fetchContent();
                            }}
                            className="flex-grow py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                          >
                            Go Live
                          </button>
                        )}
                        <button onClick={() => handleEdit(item)} className="p-2 border border-border rounded-lg hover:bg-surface transition-colors"><Edit2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {content.filter(c => c.type === 'live' || c.status === 'live').length === 0 && (
                    <div className="col-span-full py-12 text-center glass-card text-text-muted italic">
                      No live events scheduled. Go to Library to add a "Live Stream".
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-surface-hover/30 transition-colors">
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
                      </tr>
                    ))}
                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic">No active subscribers found.</td>
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
                          {plan.features.slice(0, 3).map(f => (
                            <div key={f} className="flex items-center gap-2 text-xs font-medium">
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
                            value={siteConfig.founderImageUrl} 
                            onChange={e => setSiteConfig({...siteConfig, founderImageUrl: e.target.value})} 
                            className="flex-grow bg-bg border border-white/10 p-4 rounded-xl focus:border-brand outline-none transition-all" 
                            placeholder="Paste direct image link (Drive, Pinterest, Vimeo thumbnail, etc.)"
                          />
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand/20 bg-bg shrink-0">
                            <img src={siteConfig.founderImageUrl} alt="Preview" className="w-full h-full object-cover grayscale" />
                          </div>
                        </div>
                        <p className="text-[10px] text-text-muted mt-2 italic">Pro-Tip: Use high-quality portrait shots (transparent or solid backgrounds work best).</p>
                      </div>
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                      <Save className="w-5 h-5" />
                      Save Global Configurations
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
                        <input type="text" value={videoPromo.title} onChange={e => setVideoPromo({...videoPromo, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                        <textarea rows={2} value={videoPromo.description} onChange={e => setVideoPromo({...videoPromo, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Direct Video URL (.mp4)</label>
                        <div className="flex gap-2">
                          <input type="url" value={videoPromo.videoUrl} onChange={e => setVideoPromo({...videoPromo, videoUrl: e.target.value})} className="flex-grow bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="https://..." />
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
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Button Text</label>
                          <input type="text" value={videoPromo.buttonText} onChange={e => setVideoPromo({...videoPromo, buttonText: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Button URL</label>
                          <input type="text" value={videoPromo.buttonUrl} onChange={e => setVideoPromo({...videoPromo, buttonUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Background Accent Color</label>
                        <div className="flex gap-4">
                          <input type="color" value={videoPromo.backgroundColor} onChange={e => setVideoPromo({...videoPromo, backgroundColor: e.target.value})} className="h-10 w-20 bg-bg border border-white/10 rounded cursor-pointer" />
                          <input type="text" value={videoPromo.backgroundColor} onChange={e => setVideoPromo({...videoPromo, backgroundColor: e.target.value})} className="flex-grow bg-bg border border-white/10 p-2 rounded focus:border-brand outline-none uppercase font-mono text-xs" />
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                      <Save className="w-5 h-5" />
                      Save Banner Configuration
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
                        <input type="color" value={playerConfig.primaryColor} onChange={e => setPlayerConfig({...playerConfig, primaryColor: e.target.value})} className="h-10 w-20 bg-bg border border-white/10 rounded cursor-pointer" />
                        <input type="text" value={playerConfig.primaryColor} onChange={e => setPlayerConfig({...playerConfig, primaryColor: e.target.value})} className="flex-grow bg-bg border border-white/10 p-2 rounded focus:border-brand outline-none uppercase font-mono text-xs" />
                      </div>
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                      <Save className="w-5 h-5" />
                      Update Player Config
                    </button>
                  </form>
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
          {activeTab === 'media' && (
            <motion.div key="media" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter">Media Assets</h1>
                  <p className="text-text-muted font-medium">Direct video uploads to Firebase Storage.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <MediaManager onUploadComplete={fetchMediaItems} />
                </div>
                
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
                    {mediaItems.length === 0 ? (
                      <div className="col-span-full py-20 bg-surface/30 rounded-[32px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                        <Film className="w-12 h-12 text-white/10 mb-4" />
                        <p className="text-text-muted font-bold uppercase tracking-widest text-xs">No media uploaded yet</p>
                      </div>
                    ) : (
                      mediaItems.map(item => (
                        <div key={item.id} className="glass-card p-4 group flex gap-4 items-center">
                          <div className="w-20 h-20 bg-bg rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative">
                            <video src={item.url} className="w-full h-full object-cover opacity-50" />
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
                      <option value="home">Home</option>
                      <option value="football">Football Page</option>
                      <option value="cricket">Cricket Page</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Display Type</label>
                    <select value={sectionForm.type} onChange={e => setSectionForm({...sectionForm, type: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="normal">Standard Grid</option>
                      <option value="single-row">Single Row (Scrollable)</option>
                      <option value="featured">Featured Large</option>
                      <option value="top10">Top 10 Style</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Content (Click to toggle)</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-2 bg-bg border border-white/10 rounded-md">
                    {content.map(item => (
                      <div 
                        key={item.id} 
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Slide Title</label>
                  <input type="text" required value={sliderForm.title} onChange={e => setSliderForm({...sliderForm, title: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea rows={2} value={sliderForm.description} onChange={e => setSliderForm({...sliderForm, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Hero Image URL</label>
                    <input type="url" required value={sliderForm.imageUrl} onChange={e => setSliderForm({...sliderForm, imageUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Background Video URL (Optional)</label>
                    <div className="flex gap-2">
                      <input type="url" value={sliderForm.videoUrl || ''} onChange={e => setSliderForm({...sliderForm, videoUrl: e.target.value})} className="flex-grow bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="https://..." />
                      <button type="button" onClick={() => setActiveTab('media')} className="px-4 bg-surface hover:bg-brand/10 border border-white/10 rounded-md text-[10px] font-bold uppercase"><Upload className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Action URL</label>
                    <input type="text" value={sliderForm.actionUrl} onChange={e => setSliderForm({...sliderForm, actionUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="/watch/id" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Animation Type</label>
                    <select value={sliderForm.animationType} onChange={e => setSliderForm({...sliderForm, animationType: e.target.value as any})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none">
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
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
        <AnimatePresence>
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
                  <input type="text" required value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" placeholder="e.g. Pro Stadium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Price (Monthly INR)</label>
                  <input type="number" step="1" required value={planForm.price} onChange={e => setPlanForm({...planForm, price: parseFloat(e.target.value)})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea rows={2} value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
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

function StatsCard({ label, value, icon: Icon, color }: { label: string, value: any, icon: any, color: string }) {
  return (
    <div className="glass-card p-8 flex items-start justify-between bg-surface/30">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">{label}</div>
        <div className="text-4xl font-black uppercase italic tracking-tighter">{value}</div>
      </div>
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
