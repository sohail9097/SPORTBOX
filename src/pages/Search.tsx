import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, getDocs, collection, query, where, limit } from '../lib/firebase';
import { SportsContent } from '../types';
import { Search as SearchIcon, Play, Filter, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContentCard from '../components/ContentCard';
import LoadingScreen from '../components/LoadingScreen';
import { cn } from '../lib/utils';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SportsContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [allContent, setAllContent] = useState<SportsContent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load initial content for searching
  useEffect(() => {
    fetchAllContent();
  }, []);

  const fetchAllContent = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'content'), limit(100));
      const snap = await getDocs(q, { component: 'Search', file: 'Search.tsx', reason: 'Pre-fetch content items for local full-text search index' });
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportsContent));
      setAllContent(data);
      setResults(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filterResults = () => {
      let filtered = allContent;

      if (searchTerm.trim() !== '') {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
          item.title.toLowerCase().includes(lowerTerm) || 
          item.description.toLowerCase().includes(lowerTerm) ||
          item.category.toLowerCase().includes(lowerTerm) ||
          item.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))
        );
      }

      if (selectedCategory !== 'all') {
        filtered = filtered.filter(item => item.category === selectedCategory);
      }

      setResults(filtered);
    };

    filterResults();
  }, [searchTerm, selectedCategory, allContent]);

  const categories = ['all', 'football', 'cricket', 'wrestling', 'boxing', 'kabaddi', 'watersports', 'stunts', 'polo', 'olympics', 'others'];

  if (loading && allContent.length === 0) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-bg">
      {/* Search Header */}
      <div className="sticky top-14 md:top-16 z-30 bg-bg/95 backdrop-blur-xl border-b border-white/5 pt-4 pb-6 px-4 md:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-brand transition-colors" />
            <input 
              type="text"
              placeholder="Search matches, players, or tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full bg-surface border border-white/10 p-4 pl-14 rounded-2xl md:rounded-3xl outline-none focus:border-brand/50 transition-all text-sm md:text-base font-bold shadow-2xl"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-text-muted">
              <Filter className="w-3 h-3" />
              Filter
            </div>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "flex-shrink-0 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                  selectedCategory === cat 
                    ? "bg-brand text-white border-brand shadow-lg shadow-brand/20" 
                    : "bg-surface text-text-muted border-white/5 hover:border-white/20"
                )}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="max-w-[1600px] mx-auto px-4 py-8 md:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Scanning Library...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {results.map((item, i) => (
              <ContentCard key={item.id} content={item} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="w-8 h-8 text-white/10" />
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight">No Matches Found</h3>
            <p className="text-text-muted text-sm max-w-xs font-medium">
              We couldn't find anything matching "{searchTerm}". Try checking your spelling or use different keywords.
            </p>
            <button 
              onClick={() => {setSearchTerm(''); setSelectedCategory('all');}}
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
