import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, CheckCircle2, ShieldCheck, Mail, LogOut, ChevronRight, Loader2, Key } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { RecaptchaVerifier, linkWithPhoneNumber, PhoneAuthProvider } from 'firebase/auth';

import { Link, useNavigate } from 'react-router-dom';

export default function Account() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(profile?.mobileNumber || '');
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.mobileNumber) {
      setMobileNumber(profile.mobileNumber);
    }
  }, [profile]);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier && auth) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          console.log('reCAPTCHA resolved');
        }
      });
    }
  };

  const handleSendOTP = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      alert("Please enter a valid mobile number with country code (e.g., +919999999999)");
      return;
    }
    
    setLoading(true);
    try {
      setupRecaptcha();
      const verifier = (window as any).recaptchaVerifier;
      
      if (!user) return;
      
      const result = await linkWithPhoneNumber(user, mobileNumber, verifier);
      setConfirmationResult(result);
      setOtpMode(true);
      alert("OTP Sent! Please check your mobile.");
    } catch (error: any) {
      console.error("OTP Error:", error);
      if (error.code === 'auth/invalid-phone-number') {
        alert("Invalid phone number. Please include country code (e.g., +91)");
      } else if (error.code === 'auth/captcha-check-failed') {
        alert("reCAPTCHA check failed. Please refresh and try again.");
      } else {
        alert("Error sending OTP. Make sure Phone Auth is enabled in Firebase Console.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      alert("Please enter a 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      if (!confirmationResult || !user) return;
      
      await confirmationResult.confirm(otpCode);
      
      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        mobileNumber: mobileNumber,
        isMobileVerified: true
      });
      
      setVerificationSuccess(true);
      setOtpMode(false);
      setTimeout(() => setVerificationSuccess(false), 3000);
    } catch (error: any) {
      console.error("Verification Error:", error);
      alert("Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8">
           <User className="w-10 h-10 text-white/20" />
        </div>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Authentication Required</h1>
        <p className="text-text-muted max-w-xs mb-8 font-medium">Please sign in to access your account settings and manage your profile.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-12">Return Home</button>
      </div>
    );
  }

  return (
    <div className="py-24 px-4 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none mb-4">
          Your <span className="text-brand">Account</span>
        </h1>
        <p className="text-slate-400 text-lg font-medium">Manage your subscription, security, and personal preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="p-8 bg-surface border border-white/10 rounded-[32px] text-center space-y-4 shadow-2xl">
            <div className="w-24 h-24 mx-auto bg-brand/10 rounded-[2.5rem] flex items-center justify-center border-2 border-brand/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-20 h-20 rounded-[2rem] object-cover" />
              ) : (
                <User className="w-10 h-10 text-brand" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic">{profile?.displayName || 'Sports Fan'}</h2>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{user.email}</p>
            </div>
            <div className={cn(
              "inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]",
              profile?.subscriptionTier === 'free' ? "bg-white/5 text-white/40" : "bg-brand text-white shadow-lg shadow-brand/20"
            )}>
              {profile?.subscriptionTier || 'Free'} Member
            </div>
            <button 
              onClick={() => {
                auth.signOut();
                navigate('/');
              }}
              className="w-full flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors mt-4"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Security Section */}
          <div className="bg-surface border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-brand" />
                <h3 className="font-black uppercase italic text-lg">Security & Verification</h3>
              </div>
            </div>
            <div className="p-8 space-y-8">
              {/* Mobile Verification */}
              <div className="space-y-4">
                <div id="recaptcha-container"></div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Phone className="w-3 h-3" />
                    Mobile Number
                  </label>
                  {profile?.isMobileVerified && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-500 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                
                <AnimatePresence mode="wait">
                  {!otpMode ? (
                    <motion.div 
                      key="input"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex gap-4"
                    >
                      <input 
                        type="tel"
                        placeholder="+1 234 567 890"
                        value={mobileNumber}
                        onChange={e => setMobileNumber(e.target.value)}
                        disabled={profile?.isMobileVerified && !verificationSuccess}
                        className="flex-grow bg-bg border border-white/10 p-5 rounded-2xl focus:border-brand outline-none text-sm font-bold disabled:opacity-50"
                      />
                      <button 
                        onClick={handleSendOTP}
                        disabled={loading || (profile?.isMobileVerified && mobileNumber === profile.mobileNumber)}
                        className="px-8 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl disabled:opacity-50 hover:bg-slate-200 transition-colors"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="otp"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-4"
                    >
                      <div className="flex gap-4">
                        <div className="relative flex-grow">
                          <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand" />
                          <input 
                            type="text"
                            placeholder="6-digit OTP"
                            maxLength={6}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value)}
                            className="w-full bg-bg border border-brand/50 p-5 pl-14 rounded-2xl focus:border-brand outline-none text-sm font-bold tracking-[0.5em]"
                          />
                        </div>
                        <button 
                          onClick={handleVerifyOTP}
                          disabled={loading || otpCode.length < 6}
                          className="px-8 bg-brand text-white font-black uppercase tracking-widest text-[10px] rounded-2xl disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </button>
                      </div>
                      <button 
                        onClick={() => setOtpMode(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-white underline"
                      >
                        Change Number
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {verificationSuccess && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-green-500 font-bold text-xs"
                  >
                    Mobile number verified successfully!
                  </motion.p>
                )}
              </div>

              {/* Email Profile Info */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  Primary Email
                </label>
                <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-sm font-bold text-white/60">{user.email}</span>
                  <span className="text-[10px] font-black text-brand uppercase tracking-widest">Linked</span>
                </div>
              </div>
            </div>
          </div>

          <Link to="/plans" className="bg-surface border border-white/10 rounded-[32px] p-8 flex items-center justify-between group cursor-pointer hover:border-brand/30 transition-all shadow-xl">
             <div>
               <h4 className="font-black uppercase italic text-lg">Billing & Plans</h4>
               <p className="text-text-muted text-xs font-medium">Manage your {profile?.subscriptionTier || 'Free'} subscription and view history.</p>
             </div>
             <ChevronRight className="w-6 h-6 text-text-muted group-hover:text-brand transition-all group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

