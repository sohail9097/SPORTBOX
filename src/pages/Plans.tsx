import { useState, useEffect } from 'react';
import { Check, Crown, Zap, ShieldCheck, X, Loader2, CreditCard, Phone, Mail, Star, Activity, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../lib/firebase';
import { doc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { SubscriptionPlan } from '../types';

const IconMap: Record<string, any> = {
  Zap,
  Crown,
  ShieldCheck,
  Star,
  Activity
};

export default function Plans() {
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const q = query(collection(db, 'subscription_plans'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
    } catch (err) {
      console.error("Fetch plans error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-24 px-4 max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
        <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">
          Choose Your <span className="text-brand">League</span>
        </h1>
        <p className="text-slate-400 text-lg font-medium">
          Select a plan that fits your passion. Upgrade or cancel anytime. No hidden fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4">
             <Loader2 className="w-8 h-8 animate-spin text-brand" />
             <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Loading Leagues...</p>
          </div>
        ) : plans.map((plan, i) => {
          const Icon = IconMap[plan.icon] || Zap;
          const discount = plan.offer?.isActive ? plan.offer.percentage : 0;
          const finalPrice = Math.max(0, plan.price * (1 - discount / 100)).toFixed(2);

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={cn(
                "relative rounded-[40px] p-12 flex flex-col border bg-gradient-to-br transition-all hover:scale-[1.03] group shadow-2xl overflow-hidden",
                plan.color
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 right-12 -translate-y-1/2 bg-white text-brand px-6 py-1.5 font-black text-[10px] uppercase tracking-[0.3em] rounded-full shadow-xl">
                  Most Popular
                </div>
              )}

              {plan.offer?.isActive && (
                <div className="absolute top-8 -right-12 rotate-45 bg-yellow-400 text-black px-12 py-1 font-black text-[10px] uppercase tracking-widest shadow-xl">
                  {plan.offer.percentage}% OFF
                </div>
              )}

              <div className="flex items-center gap-5 mb-10">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                  <Icon className={cn("w-8 h-8", (plan.id === 'pro' || plan.id === 'medium' || plan.popular) ? "text-white" : "text-brand")} />
                </div>
                <div>
                  <h3 className="font-black text-2xl uppercase italic tracking-tight">{plan.name}</h3>
                  {profile?.subscriptionTier === plan.id && (
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-full">Active Plan</span>
                  )}
                </div>
              </div>

              <div className="mb-10 space-y-1">
                <div className="flex items-baseline gap-3">
                  {plan.offer?.isActive && (
                    <span className="text-2xl line-through text-white/20 font-black italic">₹{plan.price}</span>
                  )}
                  <span className="text-6xl font-black uppercase italic tracking-tighter">₹{Math.round(parseFloat(finalPrice))}</span>
                  <span className="text-white/40 uppercase text-xs font-black tracking-widest">/ Month</span>
                </div>
              </div>

              <p className="text-sm text-white/50 mb-12 font-medium leading-relaxed">
                {plan.description}
              </p>

              <div className="space-y-4 mb-12 flex-grow">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-4 text-sm font-bold tracking-tight">
                    <div className="w-6 h-6 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                      <Check className={cn("w-3.5 h-3.5", (plan.id === 'pro' || plan.id === 'medium' || plan.popular) ? "text-white" : "text-brand")} />
                    </div>
                    {feature}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSelectedPlan(plan)}
                disabled={profile?.subscriptionTier === plan.id}
                className={cn(
                  "w-full py-5 font-black text-sm uppercase tracking-[0.3em] transition-all rounded-3xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
                  plan.id === 'pro' 
                    ? "bg-white text-red-600 hover:scale-105" 
                    : "bg-brand text-white hover:bg-brand-alt"
                )}
              >
                {profile?.subscriptionTier === plan.id ? 'Current Plan' : (plan.price === 0 ? 'Start Free' : 'Subscribe Now')}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Comparison Table Link */}
      {/* Payment Wall Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
              onClick={() => !isProcessing && setSelectedPlan(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-surface w-full max-w-lg rounded-[40px] border border-white/10 overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {step === 'success' ? (
                  <div className="p-12 text-center space-y-8">
                    <div className="w-24 h-24 bg-green-500/20 rounded-[2.5rem] mx-auto flex items-center justify-center">
                      <Check className="w-12 h-12 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Welcome to the Stadium</h2>
                      <p className="text-text-muted font-medium">Your {selectedPlan.name} is now active. Enjoy high-priority sports streaming.</p>
                    </div>
                    <button 
                      onClick={() => setSelectedPlan(null)}
                      className="w-full py-5 bg-brand text-white font-black uppercase tracking-[0.3em] rounded-2xl"
                    >
                      Start Watching
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button 
                      onClick={() => setSelectedPlan(null)}
                      className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>

                    <div className="p-12 space-y-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center">
                            {(() => {
                              const Icon = IconMap[selectedPlan.icon] || Zap;
                              return <Icon className="w-6 h-6 text-brand" />;
                            })()}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Subscription Upgrade</p>
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter">{selectedPlan.name}</h3>
                          </div>
                        </div>

                      {!user ? (
                        <div className="space-y-6">
                           <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                              <p className="text-sm font-medium text-text-muted">You need to be signed in to subscribe.</p>
                              <button 
                                onClick={() => signInWithGoogle()}
                                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2"
                              >
                                Sign in with Google
                              </button>
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {step === 'details' ? (
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                  <Phone className="w-3 h-3" />
                                  Mobile Number
                                </label>
                                <input 
                                  type="tel"
                                  placeholder="+1 234 567 890"
                                  value={mobileNumber}
                                  onChange={e => setMobileNumber(e.target.value)}
                                  className="w-full bg-bg border border-white/10 p-5 rounded-2xl focus:border-brand outline-none text-sm font-bold"
                                />
                              </div>
                              <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                  <Mail className="w-3 h-3" />
                                  Confirm Email
                                </label>
                                <input 
                                  type="email"
                                  value={user.email || ''}
                                  readOnly
                                  className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-sm font-bold text-text-muted"
                                />
                              </div>
                              <button 
                                onClick={() => mobileNumber ? setStep('payment') : alert('Please enter your mobile number')}
                                className="w-full py-5 bg-brand text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-brand/20"
                              >
                                Continue To Payment
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Total Due</span>
                                  <div className="text-right">
                                     {selectedPlan.offer?.isActive && (
                                       <span className="text-xs line-through text-white/40 block">₹{selectedPlan.price}</span>
                                     )}
                                     <span className="text-2xl font-black">
                                       ₹{Math.round(selectedPlan.price * (1 - (selectedPlan.offer?.isActive ? selectedPlan.offer.percentage : 0) / 100))}
                                     </span>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="relative">
                                    <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                                    <input 
                                      type="text"
                                      placeholder="Card Number"
                                      value="4242 4242 4242 4242"
                                      readOnly
                                      className="w-full bg-bg border border-white/10 p-5 pl-14 rounded-2xl focus:border-brand outline-none text-sm font-bold"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="MM/YY" value="12/26" readOnly className="w-full bg-bg border border-white/10 p-5 rounded-2xl focus:border-brand outline-none text-sm font-bold" />
                                    <input type="text" placeholder="CVC" value="123" readOnly className="w-full bg-bg border border-white/10 p-5 rounded-2xl focus:border-brand outline-none text-sm font-bold" />
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={async () => {
                                  setIsProcessing(true);
                                  try {
                                    // Simulate payment processing
                                    await new Promise(r => setTimeout(r, 2000));
                                    
                                    const userRef = doc(db, 'users', user.uid);
                                    await updateDoc(userRef, {
                                      subscriptionTier: selectedPlan.id,
                                      subscriptionStatus: 'active',
                                      mobileNumber: mobileNumber,
                                      lastPaymentDate: new Date().toISOString()
                                    });
                                    
                                    setStep('success');
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                                  } finally {
                                    setIsProcessing(false);
                                  }
                                }}
                                disabled={isProcessing}
                                className="w-full py-5 bg-brand text-white font-black uppercase tracking-[0.2em] rounded-full flex items-center justify-center gap-3 disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  `Confirm Payment`
                                )}
                              </button>
                              <button 
                                onClick={() => setStep('details')}
                                disabled={isProcessing}
                                className="w-full text-xs font-black uppercase tracking-widest text-text-muted hover:text-white transition-colors"
                              >
                                Back to details
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="mt-20 text-center">
        <p className="text-white/20 text-xs font-bold uppercase tracking-widest mb-4">Trusted by over 2 Million sports fans worldwide</p>
        <div className="flex flex-wrap items-center justify-center gap-12 opacity-20 grayscale invert">
          <img src="https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/1200px-Premier_League_Logo.svg.png" className="h-8 object-contain" alt="" />
          <img src="https://upload.wikimedia.org/wikipedia/en/thumb/4/41/NBA_logo.svg/1200px-NBA_logo.svg.png" className="h-8 object-contain" alt="" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/0f/ICC_Logo.svg" className="h-8 object-contain" alt="" />
          <img src="https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/La_Liga_Logo.svg/1200px-La_Liga_Logo.svg.png" className="h-8 object-contain" alt="" />
        </div>
      </div>
    </div>
  );
}
