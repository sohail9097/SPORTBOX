import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { SportsContent, Category, ContentType, ContentSection, SliderElement } from '../types';
import { Plus, Trash2, Edit2, Play, LayoutDashboard, Film, Users, Settings, Save, X, Eye, Radio, Crown, Layers, MoveUp, MoveDown, CheckSquare, Square, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'live' | 'sections' | 'slider' | 'users' | 'settings'>('dashboard');
  const [content, setContent] = useState<SportsContent[]>([]);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [slider, setSlider] = useState<SliderElement[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isAddingSlider, setIsAddingSlider] = useState(false);
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
    }
  }, [isAdmin]);

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
      if (editingId) {
        const docRef = doc(db, 'content', editingId);
        await updateDoc(docRef, { ...form });
      } else {
        const payload = {
          ...form,
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
      if (editingSliderId) {
        const docRef = doc(db, 'slider', editingSliderId);
        await updateDoc(docRef, { ...sliderForm });
      } else {
        await addDoc(collection(db, 'slider'), {
          ...sliderForm,
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
          <SidebarLink icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Video URL</label>
                  <input type="text" required value={form.videoUrl} onChange={e => setForm({...form, videoUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Thumbnail URL</label>
                  <input type="url" value={form.thumbnailUrl} onChange={e => setForm({...form, thumbnailUrl: e.target.value})} className="w-full bg-bg border border-white/10 p-3 rounded-md focus:border-brand outline-none" />
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-md">
                   <input type="checkbox" checked={form.isPremium} onChange={e => setForm({...form, isPremium: e.target.checked})} className="w-4 h-4 accent-brand" />
                   <span className="text-sm font-bold uppercase">Premium Content</span>
                </div>
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Content
                </button>
              </form>
            </motion.div>
          </>
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
