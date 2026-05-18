import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Play, Activity, Trophy, Bell, ShieldCheck, Mail, Lock, User as UserIcon, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import ReCAPTCHA from 'react-google-recaptcha';
import { 
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import BrandLogo from '../components/BrandLogo';
import { SiteConfig } from '../types';

type AuthMode = 'login' | 'signup' | 'social';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBotVerified, setIsBotVerified] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('social');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    logoUrl: ''
  });

  const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'siteConfig'), (snap) => {
      if (snap.exists()) {
        setSiteConfig(snap.data() as SiteConfig);
      }
    }, (err) => {
      console.warn("[Login] Config fetch offline:", err.message);
    });
    return () => unsub();
  }, [navigate]);

  const handleRecaptchaChange = (token: string | null) => {
    setIsBotVerified(!!token);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBotVerified && process.env.NODE_ENV === 'production') {
      setError("Please complete the reCAPTCHA verification first.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (authMode === 'signup') {
        if (!fullName.trim() || !mobileNumber.trim()) {
          throw new Error("Name and Mobile Number are compulsory.");
        }
        if (mobileNumber.length < 10) {
          throw new Error("Please enter a valid mobile number.");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: fullName });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: fullName,
          mobileNumber: mobileNumber,
          subscriptionTier: 'free',
          subscriptionStatus: 'none',
          favorites: [],
          watchLater: [],
          recentlyWatched: [],
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/account');
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerName: 'google' | 'facebook' | 'x') => {
    if (!isBotVerified && process.env.NODE_ENV === 'production') {
      setError("Please complete the reCAPTCHA verification first.");
      return;
    }

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
      await signInWithPopup(auth, provider);
      navigate('/account');
    } catch (err: any) {
      const errorCode = err?.code;
      const errorMessage = err?.message || '';
      
      if (
        errorCode === 'auth/popup-closed-by-user' || 
        errorCode === 'auth/cancelled-popup-request' ||
        errorMessage.includes('popup-closed-by-user') ||
        errorMessage.includes('cancelled-popup-request')
      ) {
        setLoading(false);
        return;
      }

      setError(errorMessage || 'Social login failed');
      setLoading(false);
    }
  };

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
      {/* Left Panel */}
      <div className="flex-1 flex flex-col justify-start pt-2 sm:pt-12 px-5 sm:px-12 md:px-20 lg:px-32 bg-black z-10 relative overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto space-y-6 sm:space-y-8 py-10"
        >
          <BrandLogo logoUrl={siteConfig.logoUrl} size="lg" />

          <div className="space-y-2 sm:space-y-3 text-left">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-[1.1] sm:leading-tight">
              {authMode === 'social' ? 'Unlock the full' : authMode === 'signup' ? 'Join the' : 'Welcome back to the'} <br className="hidden sm:block" />
              <span className="text-brand">Arena Experience.</span>
            </h1>
            <p className="text-text-muted text-[11px] sm:text-sm font-medium leading-relaxed max-w-sm">
              {authMode === 'social' 
                ? 'Sign in with your preferred social account or email to access exclusive broadcasts.' 
                : authMode === 'signup' 
                  ? 'Complete the form below to start your journey.' 
                  : 'Enter your credentials to continue.'}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold">!</div>
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed text-red-500 italic">
                {error}
              </p>
            </motion.div>
          )}

          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-3 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3 h-3 text-brand" />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Security Check</span>
              </div>
              <div className="scale-90 origin-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={handleRecaptchaChange}
                  theme="dark"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'social' ? (
                <motion.div 
                  key="social"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <button 
                    onClick={() => handleSocialLogin('google')}
                    disabled={loading || !isBotVerified}
                    className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-30"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleSocialLogin('facebook')}
                      disabled={loading || !isBotVerified}
                      className="h-14 bg-[#1877F2]/10 border border-[#1877F2]/20 text-[#1877F2] font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30"
                    >
                      <FacebookIcon />
                      Facebook
                    </button>
                    <button 
                      onClick={() => handleSocialLogin('x')}
                      disabled={loading || !isBotVerified}
                      className="h-14 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30"
                    >
                      <XIcon />
                      X (Twitter)
                    </button>
                  </div>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-black px-2 text-text-muted font-black tracking-widest italic">Or</span></div>
                  </div>

                  <button 
                    onClick={(e) => { e.preventDefault(); setAuthMode('signup'); }}
                    className="w-full h-14 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-white/5"
                  >
                    <Mail className="w-4 h-4 text-brand" />
                    Sign up with Email
                  </button>

                  <p className="text-center text-[10px] font-bold text-text-muted">
                    ALREADY HAVE AN ACCOUNT? <button onClick={() => setAuthMode('login')} className="text-brand hover:underline">LOGIN HERE</button>
                  </p>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  onSubmit={handleEmailAuth}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <button 
                    onClick={(e) => { e.preventDefault(); setAuthMode('social'); }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-brand transition-colors mb-4"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to Social
                  </button>

                  <div className="space-y-3">
                    {authMode === 'signup' && (
                      <>
                        <div className="relative group">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                          <input 
                            type="text"
                            placeholder="FULL NAME (COMPULSORY)"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/20 focus:border-brand/50 focus:bg-white/10 transition-all outline-none"
                          />
                        </div>
                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                          <input 
                            type="tel"
                            placeholder="MOBILE NUMBER (COMPULSORY)"
                            required
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/20 focus:border-brand/50 focus:bg-white/10 transition-all outline-none"
                          />
                        </div>
                      </>
                    )}
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                      <input 
                        type="email"
                        placeholder="EMAIL ADDRESS"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/20 focus:border-brand/50 focus:bg-white/10 transition-all outline-none"
                      />
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                      <input 
                        type="password"
                        placeholder="PASSWORD"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/20 focus:border-brand/50 focus:bg-white/10 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || !isBotVerified}
                    className="w-full h-14 bg-brand text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>

                  <p className="text-center text-[10px] font-bold text-text-muted py-2">
                    {authMode === 'signup' ? (
                      <>ALREADY HAVE AN ACCOUNT? <button onClick={(e) => { e.preventDefault(); setAuthMode('login'); }} className="text-brand hover:underline">LOGIN HERE</button></>
                    ) : (
                      <>NEW TO SPORTSBOX? <button onClick={(e) => { e.preventDefault(); setAuthMode('signup'); }} className="text-brand hover:underline">CREATE ACCOUNT</button></>
                    )}
                  </p>
                </motion.form>
              )}
            </AnimatePresence>

            <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-[0.2em]">
              By continuing, you agree to our <Link to="#" className="text-brand hover:underline">Terms of Play</Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex lg:flex-1 bg-brand relative overflow-hidden flex-col items-center justify-center p-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-8"
        >
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
        
        <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-col justify-between p-20 pointer-events-none text-black">
           <div className="flex justify-between items-center text-black">
              <span className="text-9xl font-black italic tracking-tighter uppercase select-none">Sports</span>
           </div>
           <div className="flex justify-between items-center self-end">
              <span className="text-9xl font-black italic tracking-tighter uppercase select-none">Box</span>
           </div>
        </div>
      </div>
    </div>
  );
}



