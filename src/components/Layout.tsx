import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../lib/ThemeContext';
import { signInWithGoogle, auth } from '../lib/firebase';
import { LayoutDashboard, Play, LogOut, User, Crown, Search, Menu, X, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Live', path: '/live', icon: Play },
    { name: 'Football', path: '/category/football' },
    { name: 'Cricket', path: '/category/cricket' },
    { name: 'Plans', path: '/plans', icon: Crown },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-black text-xl italic group-hover:scale-110 transition-transform">
                  S
                </div>
                <span className="font-display font-black text-xl tracking-tighter uppercase italic">
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
                  <div className="flex items-center gap-2 p-1 pl-4 bg-white/5 rounded-full border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{profile?.displayName?.split(' ')[0]}</span>
                    <button 
                      onClick={() => auth.signOut()}
                      className="w-8 h-8 bg-surface rounded-full flex items-center justify-center hover:bg-brand transition-colors group"
                    >
                      <LogOut className="w-3.5 h-3.5 group-hover:text-white" />
                    </button>
                  </div>
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

            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 bg-bg pt-20 px-4"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-2xl font-display uppercase tracking-widest border-b border-white/10 pb-4"
                >
                  {link.name}
                </Link>
              ))}
              {!user && (
                <button
                  onClick={() => {
                    signInWithGoogle();
                    setIsMenuOpen(false);
                  }}
                  className="btn-primary w-full"
                >
                  Sign In
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-surface border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-black fill-black" />
              </div>
              <span className="font-display text-xl tracking-tighter uppercase italic">
                Sport<span className="text-brand">Box</span>
              </span>
            </Link>
            <p className="text-white/40 text-sm max-w-sm">
              The ultimate destination for sports enthusiasts. Experience live matches, 
              exclusive highlights, and immersive coverage of your favorite sports.
            </p>
          </div>
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
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/5 text-center text-xs text-white/20 uppercase tracking-widest">
          © 2024 SportBox. No rights reserved. Built with passion for sports.
        </div>
      </footer>
    </div>
  );
}
