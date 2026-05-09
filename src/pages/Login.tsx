import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Play, Activity, Trophy, Bell } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import BrandLogo from '../components/BrandLogo';
import { SiteConfig } from '../types';
import { useEffect } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    logoUrl: ''
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'siteConfig'));
        if (snap.exists()) {
          setSiteConfig(snap.data());
        }
      } catch (err) {
        console.error("Config fetch error:", err);
      }
    };
    fetchConfig();

    // Check for redirect result
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          navigate('/account');
        }
      } catch (err: any) {
        console.error("Redirect auth error:", err);
        if (err.code === 'auth/account-exists-with-different-credential') {
          setError("An account already exists with the same email address but different sign-in credentials. Try signing in using another provider.");
        } else {
          setError(err.message || "Authentication failed");
        }
      }
    };
    checkRedirect();
  }, [navigate]);

  const handleSocialLogin = async (providerName: 'google' | 'facebook' | 'x') => {
    setLoading(true);
    setError('');
    let provider;
    
    switch (providerName) {
      case 'google':
        provider = new GoogleAuthProvider();
        break;
      case 'facebook':
        provider = new FacebookAuthProvider();
        break;
      case 'x':
        provider = new TwitterAuthProvider();
        break;
      default:
        return;
    }

    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
        navigate('/account');
      }
    } catch (err: any) {
      console.error("Login component error object:", err);
      const errorCode = err?.code;
      const errorMessage = err?.message || '';
      
      // Silently handle user cancellation
      if (
        errorCode === 'auth/popup-closed-by-user' || 
        errorCode === 'auth/cancelled-popup-request' ||
        errorMessage.includes('popup-closed-by-user') ||
        errorMessage.includes('cancelled-popup-request')
      ) {
        setLoading(false);
        return;
      }

      if (errorCode === 'auth/operation-not-allowed') {
        setError(`${providerName.charAt(0).toUpperCase() + providerName.slice(1)} login is not enabled. Please enable it in your Firebase console.`);
      } else if (errorCode === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with the same email but different sign-in credentials.");
      } else {
        setError(errorMessage || 'Social login failed');
      }
      setLoading(false);
    }
  };

  // SVGs for Logos
  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const FacebookIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#1877F2]">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.248h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );

  const XIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-stretch overflow-hidden bg-bg">
      {/* Left Panel: Form Section (Black Background) */}
      <div className="flex-1 flex flex-col justify-start pt-2 sm:pt-12 px-5 sm:px-12 md:px-20 lg:px-32 bg-black z-10 relative">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto space-y-6 sm:space-y-8"
        >
          {/* Logo */}
          <BrandLogo logoUrl={siteConfig.logoUrl} size="lg" />

          {/* Header Text */}
          <div className="space-y-2 sm:space-y-3 text-left">
            <div className="flex items-center gap-2">
              <div className="px-2 py-0.5 bg-brand/10 border border-brand/20 rounded text-[9px] font-black uppercase tracking-widest text-brand">
                Instant Access
              </div>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-[1.1] sm:leading-tight">
              Unlock the full <br className="hidden sm:block" />
              <span className="text-brand">Arena Experience.</span>
            </h1>
            <p className="text-text-muted text-[11px] sm:text-sm font-medium leading-relaxed max-w-sm">
              Sign in with your preferred social account to access exclusive broadcasts and real-time stats.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold">!</div>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-relaxed">
                {error}
              </p>
            </motion.div>
          )}

          {/* Social Logins */}
          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleSocialLogin('google')}
                disabled={loading}
                className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={loading}
                  className="h-14 bg-[#1877F2]/10 border border-[#1877F2]/20 text-[#1877F2] font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-[#1877F2]/15 active:scale-[0.98] disabled:opacity-50"
                >
                  <FacebookIcon />
                  Facebook
                </button>
                <button 
                  onClick={() => handleSocialLogin('x')}
                  disabled={loading}
                  className="h-14 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
                >
                  <XIcon />
                  X (Twitter)
                </button>
              </div>
            </div>

            <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-[0.2em]">
              By continuing, you agree to our <Link to="#" className="text-brand hover:underline">Terms of Play</Link>
            </p>
          </div>
        </motion.div>

        {/* Decorative subtle gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Right Panel: Feature Section (Red Background) */}
      <div className="hidden lg:flex lg:flex-1 bg-brand relative overflow-hidden flex-col items-center justify-center p-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-8"
        >
          {/* Main Visual Component - Simplified illustration feel from image */}
          <div className="relative">
            <div className="w-40 h-[280px] bg-zinc-900 rounded-[20px] border-[4px] border-black shadow-2xl relative overflow-hidden flex flex-col">
               <div className="h-1.5 bg-black w-14 mx-auto rounded-b-lg mb-2"></div>
               <div className="flex-grow p-1.5 space-y-1.5">
                  <div className="aspect-[4/5] bg-surface rounded-md overflow-hidden relative group">
                     <img 
                      src="https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000&auto=format&fit=crop" 
                      className="w-full h-full object-cover opacity-80" 
                      alt="Stadium" 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center shadow-2xl">
                           <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                     </div>
                  </div>
                  <div className="space-y-0.5">
                     <div className="h-1 w-3/4 bg-white/20 rounded-full"></div>
                     <div className="h-1 w-1/2 bg-white/10 rounded-full"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-0.5">
                     <div className="h-4 bg-white/5 rounded-sm border border-white/5"></div>
                     <div className="h-4 bg-white/5 rounded-sm border border-white/5"></div>
                  </div>
               </div>
               <div className="h-0.5 bg-white/10 w-10 mx-auto mb-2 rounded-full"></div>
            </div>

            {/* Floating UI Elements matching the image concept */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-6 top-12 bg-white p-2 rounded-lg shadow-xl flex items-center gap-2 border border-black/5"
            >
              <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center shadow-lg shadow-green-500/20">
                <Trophy className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="text-[6px] font-black uppercase text-black/40 tracking-wider">Top Scorer</p>
                <p className="text-[8px] font-black text-black">MVP SECURED</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -left-6 bottom-24 bg-zinc-900 border border-white/10 p-2 rounded-lg shadow-2xl flex items-center gap-2"
            >
              <div className="w-6 h-6 bg-brand rounded-md flex items-center justify-center shadow-lg shadow-brand/20">
                <Activity className="w-3 h-3 text-white" />
              </div>
              <div className="text-left">
                <p className="text-[6px] font-black uppercase text-white/40 tracking-wider">Live Momentum</p>
                <p className="text-[8px] font-black text-white italic">+85%</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 bottom-12 bg-white p-2 rounded-full shadow-2xl"
            >
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                 <Bell className="w-3 h-3 text-brand" />
              </div>
            </motion.div>
          </div>

          <div className="space-y-3">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">The Stadium in your pocket.</h3>
            <p className="text-white/70 text-xs font-medium max-w-[280px] mx-auto">
              Broadcast, analyze, and immerse yourself in the world's greatest spectacles in stunning 4K.
            </p>
          </div>
        </motion.div>

        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-col justify-between p-20 pointer-events-none">
           <div className="flex justify-between items-center">
              <span className="text-9xl font-black italic tracking-tighter uppercase select-none">Sports</span>
           </div>
           <div className="flex justify-between items-center self-end">
              <span className="text-9xl font-black italic tracking-tighter uppercase select-none">Box</span>
           </div>
        </div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-black/10 blur-[120px] rounded-full"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}


