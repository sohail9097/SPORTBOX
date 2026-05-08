import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../lib/ThemeContext';
import { auth, db } from '../lib/firebase';
import { 
  LayoutDashboard, Play, LogOut, User, Crown, 
  Search, Menu, X, Sun, Moon, Home, Tv, 
  Calendar, UserCircle, Bell, Clock
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SiteConfig } from '../types';

import BrandLogo from './BrandLogo';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    founderImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop',
    logoUrl: ''
  });
  const location = useLocation();

  useEffect(() => {
    // Sync site configuration
    const unsubscribe = onSnapshot(doc(db, 'settings', 'siteConfig'), (snapshot) => {
      if (snapshot.exists()) {
        setSiteConfig(prev => ({ ...prev, ...snapshot.data() }));
      }
    });

    return () => unsubscribe();
  }, []);

  const navLinks = [
    { name: 'Live', path: '/live', icon: Play },
    { name: 'Football', path: '/category/football' },
    { name: 'Cricket', path: '/category/cricket' },
    { name: 'Plans', path: '/plans', icon: Crown },
  ];

  const mobileNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'List', path: '/account', icon: Clock },
    { name: 'Live', path: '/live', icon: Tv },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/5">
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

                <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                  2,402 Active Streams
                </div>
                
                {user ? (
                  <div className="flex items-center gap-4">
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700"
                      >
                        Admin
                      </Link>
                    )}
                    <Link to="/account" className="flex items-center gap-2 p-1 pl-4 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-colors">
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

      <main className="flex-grow pb-20 md:pb-0">
        {children}
      </main>

      {/* Floating Category Menu */}
      <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="bg-surface/80 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest shadow-2xl"
        >
          <span>All</span>
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex items-center justify-around h-16">
          {mobileNavLinks.map((link, i) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={`mobile-nav-${link.name}-${i}`}
                to={link.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
                  isActive ? "text-brand" : "text-text-muted"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "fill-brand/20")} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{link.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="w-full max-sm:max-w-xs max-w-sm bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl pointer-events-auto">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-display text-xl uppercase tracking-widest">Browse</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="p-4 bg-white/5 rounded-2xl flex flex-col items-center gap-2 hover:bg-brand/10 hover:text-brand transition-all border border-transparent hover:border-brand/20"
                  >
                    <span className="text-xs font-black uppercase tracking-widest">{link.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="bg-surface border-t border-white/5 py-8 md:py-20 pb-24 md:pb-20">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-start">
            <div className="md:col-span-12 lg:col-span-5 flex flex-col gap-4 md:gap-6 items-center md:items-start text-center md:text-left">
              <div className="flex flex-col gap-3 md:gap-4">
                <BrandLogo logoUrl={siteConfig.logoUrl} size="lg" />
                <p className="text-white/40 text-[11px] md:text-sm max-w-sm leading-relaxed">
                  The ultimate destination for sports enthusiasts. Experience live matches, 
                  exclusive highlights, and immersive coverage of your favorite sports.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
                   <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white py-1 px-3 md:py-1.5 md:px-4 bg-white/5 rounded-full border border-white/5">
                     Stadium Feed
                   </div>
                   <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-brand py-1 px-3 md:py-1.5 md:px-4 bg-brand/10 rounded-full border border-brand/20">
                     Ultra HD 4K
                   </div>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-12 lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 pt-6 md:pt-0 border-t md:border-t-0 border-white/5">
              <div>
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-white">Categories</h4>
                <ul className="space-y-2 md:space-y-3 text-[10px] md:text-sm text-white/40 font-bold uppercase tracking-widest">
                  <li><Link to="/category/football" className="hover:text-brand transition-colors">Football</Link></li>
                  <li><Link to="/category/cricket" className="hover:text-brand transition-colors">Cricket</Link></li>
                  <li><Link to="/category/basketball" className="hover:text-brand transition-colors">Basketball</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-white">Company</h4>
                <ul className="space-y-2 md:space-y-3 text-[10px] md:text-sm text-white/40 font-bold uppercase tracking-widest">
                  <li><Link to="/plans" className="hover:text-brand transition-colors">Plans</Link></li>
                  <li><Link to="/legal/privacy" className="hover:text-brand transition-colors">Privacy</Link></li>
                  <li><Link to="/legal/terms" className="hover:text-brand transition-colors">Terms</Link></li>
                  <li><Link to="/legal/cookies" className="hover:text-brand transition-colors">Cookies</Link></li>
                  <li><Link to="/data-deletion" className="hover:text-brand transition-colors text-brand/60">Data Deletion</Link></li>
                </ul>
              </div>
              <div className="col-span-2 md:col-span-1">
                <h4 className="font-display text-[10px] md:text-sm uppercase tracking-widest mb-4 md:mb-6 text-white">Support</h4>
                <p className="text-[10px] md:text-sm text-white/40 leading-loose uppercase tracking-widest font-bold">
                  24/7 Support:
                  <span className="text-white block mt-1 text-[11px] md:text-sm lowercase font-sans font-medium tracking-normal">support@sportsbox.com</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 mt-8 md:mt-24 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <div className="text-[8px] md:text-[10px] text-white/20 uppercase tracking-[0.2em] md:tracking-[0.3em] text-center md:text-left leading-relaxed max-w-md">
            © 2024 SportsBox Media Group. All rights reserved.
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 opacity-30 grayscale brightness-200">
             {/* Text elements removed as requested */}
          </div>
        </div>
      </footer>
    </div>
  );
}
