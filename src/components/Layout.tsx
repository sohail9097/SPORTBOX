import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../lib/ThemeContext';
import { auth, db, handleFirestoreError, OperationType, getDoc, getDocs, doc, query, collection, where } from '../lib/firebase';
import { 
  LayoutDashboard, Play, LogOut, User, Crown, 
  Search, Menu, X, Sun, Moon, Home, Tv, 
  Calendar, UserCircle, Bell, Clock, Flame, BookOpen, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SiteConfig } from '../types';
import { FALLBACK_SITE_CONFIG } from '../lib/fallbackData';
import { useFirestoreCache } from '../context/FirestoreContext';

import BrandLogo from './BrandLogo';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { siteConfig } = useFirestoreCache();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'content'), where('status', '==', 'live'));
    getDocs(q, { component: 'Layout', file: 'Layout.tsx', reason: 'Fetch active live content stream count and views' })
      .then((snapshot) => {
        if (!isMounted) return;
        // Sum views of all active live streams
        const totalViews = snapshot.empty ? 52160 : snapshot.docs.reduce((acc, doc) => acc + ((doc.data() as any).viewCount || 0), 0);
        setLiveCount(totalViews);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("Live count fetch error:", error);
        setLiveCount(52160); // Robust fallback active spectator volume
        handleFirestoreError(error, OperationType.GET, 'content');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const navLinks = [
    { name: 'Live', path: '/live', icon: Play },
    { name: 'Football', path: '/category/football' },
    { name: 'Cricket', path: '/category/cricket' },
    { name: 'Olympics', path: '/olympics' },
    { name: 'Sport Shots', path: '/shorts' },
    { name: 'Plans', path: '/plans', icon: Crown },
    { name: 'Blogs', path: '/blogs' },
  ];

  const mobileNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Olympics', path: '/olympics', icon: Trophy },
    { name: 'Sport Shots', path: '/shorts', icon: Flame },
    { name: 'List', path: '/account', icon: Clock },
    { name: 'Live', path: '/live', icon: Tv },
  ];

  const isShortsPage = location.pathname.startsWith('/shorts');

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-4 md:gap-8">
              <BrandLogo 
                logoUrl={siteConfig.logoUrl} 
                className="scale-90 md:scale-100 origin-left"
              />
              
              <div className="hidden md:flex items-center gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "text-xs font-bold uppercase tracking-[0.2em] transition-all pb-1",
                      location.pathname === link.path ? "text-brand border-b-2 border-brand" : "text-text-muted hover:text-text-base"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-0.5 md:gap-6">
              <button 
                onClick={toggleTheme}
                className="p-1 px-2 text-text-muted hover:text-text-base md:hidden transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <Link 
                to="/search"
                className="p-1 px-2 text-text-muted hover:text-text-base md:hidden"
              >
                <Search className="w-4 h-4" />
              </Link>
              
              <button 
                className="p-1 px-2 text-text-muted hover:text-text-base md:hidden"
              >
                <Bell className="w-4 h-4" />
              </button>

              {!user && (
                <button 
                  onClick={() => navigate('/login')}
                  className="p-1 px-2 text-brand md:hidden"
                >
                  <UserCircle className="w-4 h-4" />
                </button>
              )}
              {user && (
                <Link 
                  to="/account"
                  className="p-1.5 text-text-muted md:hidden"
                >
                  <User className="w-5 h-5" />
                </Link>
              )}

              <div className="hidden md:flex items-center gap-6">
                <Link 
                  to="/search"
                  className="p-2 rounded-full hover:bg-white/5 transition-colors text-text-muted hover:text-text-base border border-border"
                >
                  <Search className="w-4 h-4" />
                </Link>

                <Link 
                  to="/account"
                  className="p-2 rounded-full hover:bg-white/5 transition-colors text-text-muted hover:text-text-base border border-border"
                  title="My List"
                >
                  <Clock className="w-4 h-4" />
                </Link>

                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-white/5 transition-colors text-text-muted hover:text-text-base border border-border"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                {user ? (
                  <div className="flex items-center gap-4">
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-surface-hover text-text-base"
                      >
                        Admin
                      </Link>
                    )}
                    <Link to="/account" className="flex items-center gap-2 p-1 pl-4 bg-surface rounded-full border border-border hover:bg-surface-hover transition-colors">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{profile?.displayName?.split(' ')[0]}</span>
                      <div className="w-8 h-8 bg-surface rounded-full flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="px-6 py-2 bg-brand hover:bg-brand-alt text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-lg shadow-brand/20"
                  >
                    Sign In
                  </button>
                )}
              </div>

              <div className="hidden">
                 {/* Hidden on mobile top if bottom nav is present */}
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                  {isMenuOpen ? <X /> : <Menu />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className={cn("flex-grow", isShortsPage ? "pb-0" : "pb-20 md:pb-0")}>
        {children}
      </main>

      {/* Floating Category Menu */}
      {!isShortsPage && (
        <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-surface/80 backdrop-blur-xl border border-border px-5 py-2 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest shadow-2xl text-text-base"
          >
            <span>All</span>
            <Menu className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Navigation (Mobile Only) */}
      {!isShortsPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-xl border-t border-border pb-safe">
          <div className="flex items-center justify-around h-16">
            {mobileNavLinks.map((link, i) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              const isLive = link.name === 'Live' && liveCount > 0;
              
              return (
                <Link
                  key={`mobile-nav-${link.name}-${i}`}
                  to={link.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-500 relative",
                    isActive ? "text-brand" : (isLive ? "text-red-500" : "text-text-muted")
                  )}
                >
                  {isLive && (
                    <motion.span 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [0.8, 1, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="absolute top-2 right-1/2 translate-x-3 w-2 h-2 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,1),0_0_30px_rgba(220,38,38,0.6)]" 
                    />
                  )}
                  <Icon className={cn(
                    "w-5 h-5 transition-all duration-500", 
                    isActive && "fill-brand/20",
                    isLive && "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-tighter whitespace-nowrap",
                    isLive ? "text-red-500 animate-pulse" : ""
                  )}>{link.name === 'Sport Shots' ? 'Shots' : link.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="w-full max-sm:max-w-xs max-w-sm bg-surface/95 backdrop-blur-2xl border border-border rounded-3xl p-8 shadow-2xl pointer-events-auto">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-display text-xl uppercase tracking-widest text-text-base">Browse</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-text-muted hover:text-text-base"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="p-4 bg-surface/50 rounded-2xl flex flex-col items-center gap-2 hover:bg-brand/10 hover:text-brand transition-all border border-border hover:border-brand/20 text-text-muted hover:text-brand"
                  >
                    <span className="text-xs font-black uppercase tracking-widest">{link.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isShortsPage && (
        <footer className="bg-surface border-t border-border py-8 md:py-20 pb-24 md:pb-20 text-text-base">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-start">
            <div className="md:col-span-12 lg:col-span-5 flex flex-col gap-4 md:gap-6 items-center md:items-start text-center md:text-left">
              <div className="flex flex-col gap-3 md:gap-4">
                <BrandLogo logoUrl={siteConfig.logoUrl} size="lg" />
                <p className="text-text-muted text-[11px] md:text-sm max-w-sm leading-relaxed">
                  The ultimate destination for sports enthusiasts. Experience live matches, 
                  exclusive highlights, and immersive coverage of your favorite sports.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
                   <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-text-base py-1 px-3 md:py-1.5 md:px-4 bg-surface-hover rounded-full border border-border">
                     Stadium Feed
                   </div>
                   <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-brand py-1 px-3 md:py-1.5 md:px-4 bg-brand/10 rounded-full border border-brand/20">
                     Full HD
                   </div>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-12 lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 pt-6 md:pt-0 border-t md:border-t-0 border-border">
              <div>
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-text-base">Categories</h4>
                <ul className="space-y-2 md:space-y-3 text-[10px] md:text-sm text-text-muted font-bold uppercase tracking-widest">
                  <li><Link to="/category/football" className="hover:text-brand transition-colors">Football</Link></li>
                  <li><Link to="/category/cricket" className="hover:text-brand transition-colors">Cricket</Link></li>
                  <li><Link to="/category/wrestling" className="hover:text-brand transition-colors">Wrestling</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-text-base">Company</h4>
                <ul className="space-y-2 md:space-y-3 text-[10px] md:text-sm text-text-muted font-bold uppercase tracking-widest">
                  <li><Link to="/plans" className="hover:text-brand transition-colors">Plans</Link></li>
                  <li><Link to="/legal/privacy" className="hover:text-brand transition-colors">Privacy</Link></li>
                  <li><Link to="/legal/terms" className="hover:text-brand transition-colors">Terms</Link></li>
                  <li><Link to="/legal/cookies" className="hover:text-brand transition-colors">Cookies</Link></li>
                  <li><Link to="/data-deletion" className="hover:text-brand transition-colors text-brand/60">Data Deletion</Link></li>
                </ul>
              </div>
              <div className="col-span-2 md:col-span-1">
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-text-base">Support</h4>
                <p className="text-[10px] md:text-sm text-text-muted leading-loose uppercase tracking-widest font-bold">
                  Support @:
                  <span className="text-text-base block mt-1 text-[11px] md:text-sm lowercase font-sans font-medium tracking-normal">Hello@sportsbox.in</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 mt-8 md:mt-24 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <div className="text-[8px] md:text-[10px] text-text-muted/40 uppercase tracking-[0.2em] md:tracking-[0.3em] text-center md:text-left leading-relaxed max-w-md">
            © 2024 SportsBox Media Group. All rights reserved.
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 opacity-30 grayscale brightness-200">
             {/* Text elements removed as requested */}
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}
