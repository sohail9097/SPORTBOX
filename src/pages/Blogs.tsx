import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType, getDocs, collection, query, orderBy, doc, setDoc, updateDoc, increment } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { BlogPost } from '../types';
import { 
  BookOpen, User, Clock, Heart, Eye,
  Calendar, Search, Plus, X, Tag, Loader2, Check, Sparkles, Flame,
  Facebook, Github, Instagram, Linkedin, Twitter, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { FALLBACK_BLOGS } from '../lib/fallbackData';

// Curry fallback array for high-fidelity content when database is empty/offline
const MOCK_BLOGS: BlogPost[] = FALLBACK_BLOGS;

// Suggested presets for adding new cover photos in drafting mode
const SUGGESTED_IMAGES = [
  { name: 'Fitness Studio', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800' },
  { name: 'Soccer Net Sunset', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800' },
  { name: 'Hoop Close-up', url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800' },
  { name: 'Cricket Field Match', url: 'https://images.unsplash.com/photo-1540747737956-37872404a87a?q=80&w=800' },
  { name: 'Analytics Board', url: 'https://images.unsplash.com/photo-1531415080292-7bfc52d9de75?q=80&w=800' }
];

export default function Blogs() {
  const { user, isAdmin } = useAuth();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [localLikedBlogs, setLocalLikedBlogs] = useState<Record<string, boolean>>({});

  // Collapsible Creator portal (restricted to Admin)
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Website Design');
  const [imageUrl, setImageUrl] = useState(SUGGESTED_IMAGES[0].url);
  const [readTime, setReadTime] = useState('5 min read');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync blogs from Firestore (with Mock seed fallback)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const q = query(collection(db, 'blogs'));
    
    getDocs(q, { component: 'Blogs', file: 'Blogs.tsx', reason: 'Fetch articles and blogs for reading dashboard' })
      .then((snapshot) => {
        if (!isMounted) return;
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
        
        // Sort in-memory to prevent missing index errors and missing field exclusions
        items.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        if (items.length === 0) {
          setBlogs(MOCK_BLOGS);
        } else {
          setBlogs(items);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn("[Blogs] Firestore connection issues. Falling back to memory states:", error);
        setBlogs(MOCK_BLOGS);
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, 'blogs');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Live filter matching search term
  useEffect(() => {
    let result = [...blogs];
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      result = result.filter(blog => 
        blog.title.toLowerCase().includes(queryLower) || 
        blog.excerpt.toLowerCase().includes(queryLower) ||
        blog.content.toLowerCase().includes(queryLower) ||
        blog.category.toLowerCase().includes(queryLower) ||
        (blog.tags && blog.tags.some(tag => tag.toLowerCase().includes(queryLower)))
      );
    }
    setFilteredBlogs(result);
  }, [blogs, searchQuery]);

  // Click article opens overview dialog and increases reads
  const handleOpenBlog = async (blog: BlogPost) => {
    setSelectedBlog(blog);
    try {
      const blogRef = doc(db, 'blogs', blog.id);
      await updateDoc(blogRef, { views: increment(1) });
    } catch (e) {
      // safe fallback on networks
    }
  };

  // Like article
  const handleLikeBlog = async (e: React.MouseEvent, blog: BlogPost) => {
    e.stopPropagation();
    if (localLikedBlogs[blog.id]) {
      toast.info("You've already appreciated this article! 👍");
      return;
    }
    try {
      setLocalLikedBlogs(prev => ({ ...prev, [blog.id]: true }));
      const blogRef = doc(db, 'blogs', blog.id);
      await updateDoc(blogRef, { likesCount: increment(1) });
      toast.success("Article appreciated!");
    } catch (err) {
      toast.error("Had a small issue registering appreciation.");
    }
  };

  // Admin writes new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Unauthorized: Only administrators are permitted to publish sports blogs.");
      return;
    }
    if (!title.trim() || !excerpt.trim() || !content.trim()) {
      toast.error("Please fill in article title, excerpt teaser, and markdown content.");
      return;
    }

    setIsSubmitting(true);
    const generatedId = `blog-${Date.now()}`;
    const authorName = user?.displayName || user?.email?.split('@')[0] || "Aigars Silkalns";
    const authorEmailAddress = user?.email || "admin@sportsbox.live";
    const processedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newPost: BlogPost = {
      id: generatedId,
      title: title.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      category: category,
      imageUrl: imageUrl,
      author: authorName,
      authorEmail: authorEmailAddress,
      createdAt: new Date().toISOString(),
      readTime: readTime.trim(),
      likesCount: 0,
      views: 1,
      tags: processedTags.length > 0 ? processedTags : [category.toUpperCase(), 'ATHLETICS']
    };

    try {
      await setDoc(doc(db, 'blogs', generatedId), newPost);
      toast.success("Sport Article published successfully! Live instantly.");
      setTitle('');
      setExcerpt('');
      setContent('');
      setTagsInput('');
      setReadTime('5 min read');
      setIsAdminPanelOpen(false);
    } catch (error) {
      toast.error("Error writing document to Firestore database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Human date formatting
  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-base pt-8 pb-24 px-4 md:px-8 font-sans select-text transition-colors duration-300">
      
      {/* Page Title & Breadcrumbs in Black/Red */}
      <div className="max-w-[1240px] mx-auto mb-8 text-left">
        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2 font-mono uppercase tracking-wider">
          <span>Home</span>
          <span>/</span>
          <span className="text-brand font-bold">Blogs</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-text-base uppercase">
              SportsBox <span className="text-brand">Insights</span>
            </h1>
            <p className="text-sm text-text-muted mt-1.5">
              Curated perspectives on design, analytics, and fitness in the modern digital sporting arena.
            </p>
          </div>

          {/* Visual Admin Activator Button */}
          {isAdmin && (
            <button
              onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
              className="flex items-center gap-2 bg-brand hover:bg-brand-alt text-white px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-brand/10 transform duration-200"
            >
              {isAdminPanelOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isAdminPanelOpen ? "Close Drafting Station" : "Create Blog Entry"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Admin Drafting Portal (Stylish Red/Dark design) */}
      <AnimatePresence>
        {isAdmin && isAdminPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-[1240px] mx-auto overflow-hidden text-left mb-10"
          >
            <div className="bg-surface border border-border rounded-lg p-6 md:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand" />
              <h2 className="text-lg font-bold text-text-base flex items-center gap-2 mb-6 font-display uppercase tracking-widest italic">
                <Sparkles className="w-5 h-5 text-brand animate-pulse" />
                Draft and Publish a SportsBox Article
              </h2>

              <form onSubmit={handleCreatePost} className="space-y-5 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Article Title
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Deconstructing Mbappe's Sprint Velocity"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white placeholder-text-muted/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Estimated Read Duration
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g., 5 min read"
                      value={readTime}
                      onChange={e => setReadTime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Article Category
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Tutorial, Analytics, Website Design"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Keywords (Comma Separated)
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. tactics, athletics, speed"
                      value={tagsInput}
                      onChange={e => setTagsInput(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white placeholder-text-muted/60"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Excerpt Summary Teaser
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Provide a spicy 1-2 sentence preview to engage users on the cards deck..."
                    value={excerpt}
                    onChange={e => setExcerpt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white placeholder-text-muted/60"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Banner Cover Image URL
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Enter image address URL..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none font-mono text-xs text-white/90 transition-all"
                  />
                  
                  {/* Presets Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mr-1">Preset Options:</span>
                    {SUGGESTED_IMAGES.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImageUrl(img.url)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                          imageUrl === img.url 
                            ? 'bg-brand/20 border-brand text-white' 
                            : 'bg-black/30 border-white/10 text-text-muted hover:bg-black/55 hover:text-white'
                        }`}
                      >
                        {img.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted flex justify-between">
                    <span>Full Article Body</span>
                    <span className="text-[10px] text-text-muted font-normal italic lowercase">supports paragraph breaks</span>
                  </label>
                  <textarea 
                    rows={8}
                    required
                    placeholder="Draft complete sports analyses paragraphs..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-brand rounded-md px-4 py-3 outline-none transition-all text-white leading-relaxed font-sans"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-alt text-white px-6 py-3 rounded-md text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-md transform active:scale-95 duration-100 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publishing Post...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Publish Article Live</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Dual Column Layout container */}
      <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column (2 Parts) - Blog Deck catalog (Grid - Minimum 2 blogs per row) */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-surface/50 border border-white/5 rounded-lg overflow-hidden h-[420px] animate-pulse">
                  <div className="w-full h-48 bg-white/5" />
                  <div className="p-6 space-y-4">
                    <div className="h-4 bg-white/5 w-1/4 rounded" />
                    <div className="h-6 bg-white/5 w-3/4 rounded" />
                    <div className="h-3 bg-white/5 w-full rounded" />
                    <div className="h-3 bg-white/5 w-5/6 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBlogs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredBlogs.map((blog) => (
                <article 
                  key={blog.id}
                  id={`article-card-${blog.id}`}
                  className="bg-surface/30 backdrop-blur-md border border-border hover:border-brand/30 rounded-lg overflow-hidden flex flex-col text-left group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5"
                >
                  {/* Card Banner Image */}
                  <div 
                    onClick={() => handleOpenBlog(blog)}
                    className="relative w-full aspect-video overflow-hidden bg-black/40 cursor-pointer"
                  >
                    <img 
                      src={blog.imageUrl} 
                      alt={blog.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" 
                    />
                    
                    {/* Category Label Overlay */}
                    <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest bg-brand text-white px-2.5 py-1 rounded-sm shadow-md">
                      {blog.category}
                    </span>
                  </div>

                  {/* Card Body Information */}
                  <div className="p-5 flex flex-col justify-between flex-grow">
                    <div className="space-y-3">
                      {/* Interactive Headline */}
                      <h3 
                        onClick={() => handleOpenBlog(blog)}
                        className="font-sans font-extrabold text-[19px] leading-snug text-text-base hover:text-brand cursor-pointer transition-colors line-clamp-2 pr-1"
                      >
                        {blog.title}
                      </h3>

                      {/* Custom Meta elements precisely matching black theme style */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-text-muted uppercase tracking-wide select-none">
                        <span className="flex items-center gap-1 leading-none">
                          <Calendar className="w-3 h-3 text-brand" />
                          <span>{formatDate(blog.createdAt)}</span>
                        </span>
                        
                        <span className="flex items-center gap-1 leading-none">
                          <User className="w-3 h-3 text-brand" />
                          <span className="truncate max-w-[100px]">{blog.author}</span>
                        </span>
                      </div>

                      {/* Excerpt Summary Content Block */}
                      <p className="text-text-muted text-[13px] leading-relaxed font-normal line-clamp-3">
                        {blog.excerpt}
                      </p>
                    </div>

                    {/* Bottom Row Actions Button */}
                    <div className="flex justify-between items-center mt-5 pt-4 border-t border-border">
                      <button 
                        onClick={() => handleOpenBlog(blog)}
                        className="text-brand hover:text-text-base text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 group/btn cursor-pointer"
                      >
                        Read Post
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                      </button>

                      <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted select-none">
                        <span className="flex items-center gap-1" title="Estimated reading length">
                          <Clock className="w-3 h-3 text-text-muted/65" />
                          {blog.readTime || "5 min"}
                        </span>

                        <button
                          onClick={(e) => handleLikeBlog(e, blog)}
                          className={`flex items-center gap-1 hover:text-brand transition-colors cursor-pointer ${
                            localLikedBlogs[blog.id] ? 'text-brand scale-105' : 'text-text-muted'
                          }`}
                          title="Like blog article"
                        >
                          <Heart className={`w-3 h-3 ${localLikedBlogs[blog.id] ? 'fill-brand text-brand' : ''}`} />
                          <span>{blog.likesCount + (localLikedBlogs[blog.id] && !(blogs.find(b => b.id === blog.id)?.likesCount === blog.likesCount + 1) ? 1 : 0)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-surface/30 border border-white/5 p-16 rounded-lg text-center shadow-sm">
              <BookOpen className="w-12 h-12 text-brand/60 mx-auto mb-4 animate-bounce" />
              <p className="text-text-muted font-bold text-sm uppercase tracking-widest">No articles found matching terms</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Clear Search Filter
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Beautiful Widgets Sidebar (Black and Red Styles) */}
        <div id="blogs-sidebar-wrapper" className="space-y-8 lg:sticky lg:top-[100px] text-left">
          
          {/* Widget: Search Area */}
          <div className="relative group">
            <input 
              type="text"
              placeholder="Search athletic articles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface/40 hover:bg-surface/60 focus:bg-surface border border-white/5 focus:border-brand rounded-md px-4 py-3 pr-10 outline-none font-sans text-xs text-white placeholder-text-muted/60 shadow-md transition-all duration-200"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-text-muted">
              <Search className="w-4 h-4" />
            </span>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-8 flex items-center pr-1 text-text-muted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Widget: Custom Web Design (Promotional Mockup in Red/Black) */}
          <div className="bg-surface/20 border border-white/5 rounded-lg p-5 space-y-3">
            <h4 className="font-sans font-black text-[12px] uppercase tracking-widest text-white flex items-center gap-1.5 border-b border-white/5 pb-3 leading-none select-none">
              Featured Studio <Flame className="w-3.5 h-3.5 text-brand fill-brand animate-pulse" />
            </h4>
            
            <div className="relative group overflow-hidden rounded-md aspect-[5/4] shadow-lg border border-white/5 bg-black cursor-pointer transition-transform duration-300 hover:scale-[1.01]">
              {/* Promo Cover photo overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10 z-10 transition-colors duration-300" />
              <img 
                src="https://imagedelivery.net/aPW-WJR2InBqr5gX4RRkcg/5f88c738-c974-48ae-8e85-5a9bec52bf00/public" 
                alt="Web mockups designer" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
              />
              
              {/* Inner details overlays */}
              <div className="absolute inset-0 z-20 p-5 flex flex-col justify-between text-white font-sans">
                {/* Domain Badge */}
                <div className="flex justify-between items-center select-none">
                  <span className="text-[9px] font-black font-mono tracking-wider border border-brand/40 bg-brand/10 text-brand px-2 py-0.5 rounded">
                    Creative Athletics Design
                  </span>
                </div>

                {/* Promotional Slogans */}
                <div className="space-y-1.5 mt-auto">
                  <h5 className="font-extrabold text-[14px] leading-snug uppercase tracking-wider text-white">
                    Winning Athletic Portals – Tailored to Stand Out.
                  </h5>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-brand select-none animate-pulse">
                    Let's Build A Site! →
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Widget: Follow Us Social Block */}
          <div className="bg-surface/20 border border-white/5 rounded-lg p-5 space-y-4">
            <h4 className="font-sans font-black text-[12px] uppercase tracking-widest text-white border-b border-white/5 pb-3 leading-none select-none">
              Connect With Us
            </h4>
            
            <div className="grid grid-cols-5 gap-2">
              {/* Facebook Box */}
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noreferrer"
                id="social-fb"
                className="h-10 bg-surface hover:bg-[#3b5998] text-text-muted hover:text-white rounded border border-white/5 flex items-center justify-center transition-all duration-200"
              >
                <Facebook className="w-4 h-4 fill-current" />
              </a>

              {/* Github Box */}
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noreferrer"
                id="social-github"
                className="h-10 bg-surface hover:bg-[#181717] text-text-muted hover:text-white rounded border border-white/5 flex items-center justify-center transition-all duration-200"
              >
                <Github className="w-4 h-4 fill-current" />
              </a>

              {/* Instagram Box */}
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noreferrer"
                id="social-ig"
                className="h-10 bg-surface hover:bg-gradient-to-tr hover:from-[#f9ce34] hover:via-[#ee2a7b] hover:to-[#6228d7] text-text-muted hover:text-white rounded border border-white/5 flex items-center justify-center transition-all duration-200"
              >
                <Instagram className="w-4 h-4" />
              </a>

              {/* LinkedIn Box */}
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noreferrer"
                id="social-linkedin"
                className="h-10 bg-surface hover:bg-[#0a66c2] text-text-muted hover:text-white rounded border border-white/5 flex items-center justify-center transition-all duration-200"
              >
                <Linkedin className="w-4 h-4 fill-current" />
              </a>

              {/* Twitter Box */}
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noreferrer"
                id="social-x"
                className="h-10 bg-surface hover:bg-brand text-text-muted hover:text-white rounded border border-white/5 flex items-center justify-center transition-all duration-200"
              >
                <Twitter className="w-4 h-4 fill-current" />
              </a>
            </div>
          </div>

          {/* Widget: Popular Posts Horizontal Small Cards Deck */}
          <div className="bg-surface/20 border border-white/5 rounded-lg p-5 space-y-4">
            <h4 className="font-sans font-black text-[12px] uppercase tracking-widest text-white border-b border-white/5 pb-3 leading-none select-none">
              Popular Insights
            </h4>

            <div className="divide-y divide-white/5 select-none">
              {blogs.slice(0, 4).map((blog) => (
                <div 
                  key={`popular-tr-${blog.id}`} 
                  onClick={() => handleOpenBlog(blog)}
                  className="flex gap-3 py-3 items-center cursor-pointer hover:bg-white/5 transition-colors group first:pt-0 last:pb-0"
                >
                  {/* Miniature Thumbnail */}
                  <div className="w-[60px] h-[45px] rounded overflow-hidden flex-shrink-0 bg-black/45 border border-white/5">
                    <img 
                      src={blog.imageUrl} 
                      alt={blog.title} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100" 
                    />
                  </div>
                  
                  {/* Vertical mini metadata title */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[12px] font-bold text-white group-hover:text-brand leading-snug truncate pr-1">
                      {blog.title}
                    </h5>
                    <p className="text-[9px] text-brand/80 mt-1 select-text uppercase tracking-wider font-extrabold font-mono">
                      {blog.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Detail Full Article Dialog Reader (Beautiful Dark expand reader modal) */}
      <AnimatePresence>
        {selectedBlog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4 md:p-6 overflow-y-auto"
          >
            <div className="absolute inset-0" onClick={() => setSelectedBlog(null)} />
            
            <motion.div
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              className="relative bg-surface border border-border rounded-lg overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl z-20 text-left text-text-base"
            >
              {/* Close Button overlay */}
              <button
                onClick={() => setSelectedBlog(null)}
                className="absolute top-4 right-4 text-white/70 bg-black/80 p-2 rounded-full hover:text-white transition-all border border-white/10 z-30 transform hover:scale-110 duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cover Banner Header photo */}
              <div className="relative w-full h-[200px] md:h-[280px] bg-black flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-black/30 z-10" />
                <img
                  src={selectedBlog.imageUrl}
                  alt={selectedBlog.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80"
                />
                
                <div className="absolute bottom-6 left-6 md:left-8 z-20 space-y-2 pr-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc] border border-[#00ffcc]/30 bg-[#00ffcc]/10 px-2.5 py-1 rounded-sm">
                    {selectedBlog.category}
                  </span>
                  
                  <h2 className="text-xl md:text-3xl font-sans font-black tracking-tight text-white leading-tight">
                    {selectedBlog.title}
                  </h2>
                </div>
              </div>

              {/* Body article details content */}
              <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6">
                {/* Author row line */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 text-xs font-semibold text-text-muted uppercase tracking-wider select-none">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-brand" />
                    </div>
                    <div>
                      <div className="text-text-base font-extrabold">{selectedBlog.author}</div>
                      <div className="text-[10px] font-medium text-text-muted/70 font-mono mt-0.5 lowercase">{selectedBlog.authorEmail || "Verified SportsBox Analyst"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-brand" />
                      {formatDate(selectedBlog.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-brand" />
                      {selectedBlog.readTime || "5 min read"}
                    </span>
                  </div>
                </div>

                {/* Subtitle description */}
                <p className="text-text-base/80 font-medium italic text-sm leading-relaxed border-l-2 border-brand pl-4 py-0.5 bg-brand/5 rounded-r">
                  {selectedBlog.excerpt}
                </p>

                {/* Scrollable multi paragraphs body text content */}
                <div className="text-text-base/90 text-sm md:text-[15px] leading-relaxed space-y-5 whitespace-pre-wrap select-text font-normal font-sans">
                  {selectedBlog.content.split('\n\n').map((paragraph, index) => {
                    // Headline headers markup format inside markdown parser
                    if (paragraph.startsWith('###')) {
                      return (
                        <h4 key={index} className="text-[17px] font-bold text-text-base pt-3 tracking-tight border-b border-border pb-2">
                          {paragraph.replace('###', '').trim()}
                        </h4>
                      );
                    }
                    return <p key={index} className="text-text-base/90">{paragraph}</p>;
                  })}
                </div>

                {/* Interactive bottom row like values */}
                <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-4 mt-8 select-none">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => selectedBlog && handleLikeBlog(e, selectedBlog)}
                      className={`flex items-center gap-1.5 px-4 py-2 border rounded-md transition-all text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        localLikedBlogs[selectedBlog.id]
                          ? 'bg-brand/10 border-brand text-brand scale-100' 
                          : 'bg-surface hover:bg-brand-alt hover:text-white border-white/10 text-text-muted hover:scale-[1.01]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${localLikedBlogs[selectedBlog.id] ? 'fill-brand text-brand' : ''}`} />
                      <span>{localLikedBlogs[selectedBlog.id] ? "Appreciated" : "Like Article"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-wider">
                    <Eye className="w-4 h-4 text-brand" />
                    <span>{(selectedBlog.views || 0) + 1} reads</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
