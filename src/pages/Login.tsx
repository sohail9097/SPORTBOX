import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Mail, Lock, Bell, ChevronRight, Activity, Trophy } from 'lucide-react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { cn } from '../lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/account');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

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
      await signInWithPopup(auth, provider);
      navigate('/account');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(`${providerName.charAt(0).toUpperCase() + providerName.slice(1)} login is not enabled in your Firebase console. Please enable it in Authentication > Sign-in method.`);
      } else {
        setError(err.message || 'Social login failed');
      }
    } finally {
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
      <div className="flex-1 flex flex-col justify-center px-8 md:px-20 lg:px-32 bg-black z-10 relative">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto space-y-10"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group inline-flex">
            <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center font-black text-xl italic skew-x-[-12deg] shadow-[0_0_30px_rgba(255,0,0,0.3)] group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
            <span className="font-display font-black text-2xl tracking-tighter uppercase italic text-white">
              Sport<span className="text-brand">Box</span>
            </span>
          </Link>

          {/* Header Text */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-tight">
              {isLogin ? 'Unlock the full' : 'Join the'} <br />
              <span className="text-brand">Arena Experience.</span>
            </h1>
            <p className="text-text-muted text-sm font-medium leading-relaxed max-w-sm">
              {isLogin 
                ? 'Access exclusive broadcasts, real-time stats, and your personalized sports hub.' 
                : 'Create your account and never miss a momentum-shifting moment again.'
              }
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                <input 
                  type="email" 
                  placeholder="E-mail Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:border-brand focus:bg-white/[0.07] transition-all text-white placeholder:text-text-muted"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" />
                <input 
                  type="password" 
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:border-brand focus:bg-white/[0.07] transition-all text-white placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="flex-[2] py-4 bg-brand hover:bg-brand-alt text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-brand/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : isLogin ? 'Login Now' : 'Join Now'}
              </button>
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="flex-1 py-4 bg-white/5 border border-white/10 hover:border-brand/40 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
              >
                {isLogin ? 'Create Account' : 'Back to Login'}
              </button>
            </div>
          </form>

          {/* Social Logins */}
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4 text-text-muted">
              <div className="h-[1px] flex-grow bg-white/10"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Or login with</span>
              <div className="h-[1px] flex-grow bg-white/10"></div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <SocialButton icon={GoogleIcon} onClick={() => handleSocialLogin('google')} />
              <SocialButton icon={FacebookIcon} onClick={() => handleSocialLogin('facebook')} />
              <SocialButton icon={XIcon} onClick={() => handleSocialLogin('x')} />
            </div>
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
          className="relative z-10 text-center space-y-12"
        >
          {/* Main Visual Component - Simplified illustration feel from image */}
          <div className="relative">
            <div className="w-80 h-[500px] bg-black rounded-[40px] border-8 border-black shadow-2xl relative overflow-hidden flex flex-col">
               <div className="h-4 bg-black w-32 mx-auto rounded-b-2xl mb-4"></div>
               <div className="flex-grow p-4 space-y-4">
                  <div className="aspect-[4/5] bg-surface rounded-2xl overflow-hidden relative group">
                     <img 
                      src="https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000&auto=format&fit=crop" 
                      className="w-full h-full object-cover opacity-80" 
                      alt="Stadium" 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center shadow-2xl">
                           <Play className="w-8 h-8 text-white fill-white ml-1" />
                        </div>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <div className="h-3 w-3/4 bg-white/20 rounded"></div>
                     <div className="h-3 w-1/2 bg-white/10 rounded"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                     <div className="h-10 bg-white/5 rounded-xl border border-white/5"></div>
                     <div className="h-10 bg-white/5 rounded-xl border border-white/5"></div>
                  </div>
               </div>
               <div className="h-2 bg-white/10 w-24 mx-auto mb-6 rounded-full"></div>
            </div>

            {/* Floating UI Elements matching the image concept */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-12 top-20 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-black/5"
            >
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-black/40 tracking-wider">Top Scorer</p>
                <p className="text-sm font-black text-black">MVP SECURED</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -left-12 bottom-40 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-white/40 tracking-wider">Live Momentum</p>
                <p className="text-sm font-black text-white italic">+85% INTENSITY</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-8 bottom-20 bg-white p-3 rounded-full shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                 <Bell className="w-5 h-5 text-brand" />
              </div>
            </motion.div>
          </div>

          <div className="space-y-4">
            <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white">The Stadium in your pocket.</h3>
            <p className="text-white/70 text-sm font-medium max-w-sm mx-auto">
              Broadcast, analyze, and immerse yourself in the world's greatest spectacles in stunning 4K.
            </p>
          </div>
        </motion.div>

        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-col justify-between p-20 pointer-events-none">
           <div className="flex justify-between items-center">
              <span className="text-9xl font-black italic tracking-tighter uppercase select-none">Sport</span>
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

function SocialButton({ icon: Icon, onClick }: { icon: any, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center transition-all hover:bg-white/10 hover:border-white/20 active:scale-90 group"
    >
      <Icon />
    </button>
  );
}

