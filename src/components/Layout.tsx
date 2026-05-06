import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../lib/ThemeContext';
import { signInWithGoogle, auth, db } from '../lib/firebase';
import { 
  LayoutDashboard, Play, LogOut, User, Crown, 
  Search, Menu, X, Sun, Moon, Home, Tv, 
  Calendar, UserCircle, Bell
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SiteConfig } from '../types';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    founderImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop'
  });
  const location = useLocation();

  useEffect(() => {
    // Sync site configuration
    const unsubscribe = onSnapshot(doc(db, 'settings', 'siteConfig'), (snapshot) => {
      if (snapshot.exists()) {
        setSiteConfig(snapshot.data());
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
    { name: 'Search', path: '/live', icon: Search }, // Temporary using /live for search context
    { name: 'Live', path: '/live', icon: Tv },
    { name: 'Plans', path: '/plans', icon: Crown },
    { name: 'Profile', path: user ? '/account' : '/plans', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-4 md:gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-brand rounded-sm flex items-center justify-center font-black text-lg md:text-xl italic group-hover:scale-110 transition-transform">
                  S
                </div>
                <span className="font-display font-black text-lg md:text-xl tracking-tighter uppercase italic hidden sm:inline">
                  Sport<span className="text-brand">Box</span>
                </span>
              </Link>
              
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

            <div className="flex items-center gap-2 md:gap-6">
              <button 
                className="p-2 text-text-muted hover:text-text-base md:hidden"
              >
                <Search className="w-5 h-5" />
              </button>
              
              <button 
                className="p-2 text-text-muted hover:text-text-base md:hidden"
              >
                <Bell className="w-5 h-5" />
              </button>

              <div className="hidden md:flex items-center gap-6">
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
                    onClick={signInWithGoogle}
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

      <footer className="hidden md:block bg-surface border-t border-white/5 py-12">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
              <div className="flex-shrink-0 relative group">
                <div className="absolute -inset-2 bg-brand/20 rounded-full blur-2xl group-hover:bg-brand/30 transition-all duration-700"></div>
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-brand via-brand/50 to-transparent rounded-full opacity-40 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img 
                  src={siteConfig.founderImageUrl} 
                  alt="Founder" 
                  className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover grayscale brightness-110 hover:grayscale-0 transition-all duration-700 border-2 border-white/10 shadow-2xl shadow-brand/20"
                />
              </div>
              <div className="flex-grow space-y-4">
                <Link to="/" className="flex items-center justify-center md:justify-start gap-2">
                  <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center">
                    <Play className="w-5 h-5 text-black fill-black" />
                  </div>
                  <span className="font-display text-xl tracking-tighter uppercase italic">
                    Sport<span className="text-brand">Box</span>
                  </span>
                </Link>
                <p className="text-white/40 text-sm max-w-sm leading-relaxed">
                  The ultimate destination for sports enthusiasts. Experience live matches, 
                  exclusive highlights, and immersive coverage of your favorite sports. 
                  Curated with passion by our dedicated team.
                </p>
                <div className="flex items-center justify-center md:justify-start gap-4">
                   <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white py-1 px-3 bg-white/5 rounded-full border border-white/5">
                     Official Broadcast Partner
                   </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Categories</h4>
                <ul className="space-y-2 text-sm text-white/40">
                  <li><Link to="/category/football" className="hover:text-white">Football</Link></li>
                  <li><Link to="/category/cricket" className="hover:text-white">Cricket</Link></li>
                  <li><Link to="/category/basketball" className="hover:text-white">Basketball</Link></li>
                  <li><Link to="/category/tennis" className="hover:text-white">Tennis</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-white/40">
                  <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                  <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
                </ul>
              </div>
              <div className="hidden md:block">
                <h4 className="font-display text-sm uppercase tracking-widest mb-4">Support</h4>
                <p className="text-xs text-white/40 leading-loose">
                  Need help with your subscription? Contact our 24/7 support team at 
                  <span className="text-white block mt-1">support@sportbox.com</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-white/20 uppercase tracking-[0.3em]">
            © 2024 SportBox. Built with passion for high-performance sports.
          </div>
          <div className="flex items-center gap-6 opacity-30 grayscale brightness-200">
             <div className="text-[10px] font-black">STADIUM-FEED</div>
             <div className="text-[10px] font-black">ULTRA-HD</div>
             <div className="text-[10px] font-black">LOW-LATENCY</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
