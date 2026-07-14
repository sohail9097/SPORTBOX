import { useState, useEffect } from 'react';
import { Check, Crown, Zap, ShieldCheck, X, Loader2, CreditCard, Phone, Mail, Star, Activity, Percent, CheckCircle2, Key, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType, signInWithGoogle, auth } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { SubscriptionPlan } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import { toast } from 'sonner';

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
  const [displayName, setDisplayName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSubscribe = async () => {
    // Support any international phone number format
    let cleanInput = mobileNumber.trim();
    let normalizedPhone = "";
    if (cleanInput.startsWith("+")) {
      const digits = cleanInput.replace(/\D/g, "");
      normalizedPhone = "+" + digits;
    } else {
      const digits = cleanInput.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) {
        normalizedPhone = "+" + digits;
      } else if (digits.length === 11 && digits.startsWith("0")) {
        normalizedPhone = "+91" + digits.substring(1);
      } else if (digits.length === 10) {
        normalizedPhone = "+91" + digits;
      } else {
        if (digits.length >= 7) {
          normalizedPhone = "+" + digits;
        } else {
          normalizedPhone = digits;
        }
      }
    }

    const digitsCount = normalizedPhone.replace(/\D/g, "").length;
    if (digitsCount < 7 || digitsCount > 15) {
      toast.error("Please enter a valid international mobile number (7 to 15 digits).");
      return;
    }

    if (!displayName || displayName.trim().length < 3) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!user || !selectedPlan) return;

    const discount = selectedPlan.offer?.isActive ? selectedPlan.offer.percentage : 0;
    const finalPrice = Math.round(selectedPlan.price * (1 - discount / 100));

    setIsProcessing(true);

    try {
      // 1. FREE PLAN OR 100% DISCOUNT BYPASS FLOW
      if (finalPrice === 0) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          subscriptionTier: selectedPlan.id,
          subscriptionStatus: 'active',
          mobileNumber: normalizedPhone,
          isMobileVerified: true,
          lastPaymentDate: new Date().toISOString(),
          createdAt: profile?.createdAt || new Date().toISOString()
        }, { merge: true });
        setStep('success');
        return;
      }

      // 2. PAID PLAN WITH RAZORPAY INTEGRATION
      const response = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          amount: finalPrice
        })
      });

      const orderData = await response.json();
      if (!response.ok || !orderData.success) {
        throw new Error(orderData.error || "Could not spin purchase session");
      }

      const rzKey = orderData.keyId;
      if (!rzKey) {
        throw new Error("Razorpay Credentials are not loaded or incomplete on the server side.");
      }

      // 3. LAUNCH RAZORPAY MODAL POPUP CHECKOUT
      const options = {
        key: rzKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SportsBox Stadium",
        description: `Upgrade to ${selectedPlan.name} Subscription`,
        order_id: orderData.orderId,
        handler: async function (paymentResponse: any) {
          setIsProcessing(true);
          try {
            const verificationPayload = {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              uid: user.uid,
              planId: selectedPlan.id,
              displayName: displayName,
              mobileNumber: normalizedPhone
            };

            const verificationResp = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(verificationPayload)
            });

            const verifyResult = await verificationResp.json();
            if (verificationResp.ok && verifyResult.success) {
              toast.success("Payment Received! Subscription is now active.");
              setStep('success');
            } else {
              toast.error(verifyResult.error || "Payment verification declined by processor.");
            }
          } catch (verifyErr: any) {
            console.error("Signature Validation Error", verifyErr);
            toast.error("Encountered security errors verifying response.");
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: displayName,
          email: user.email,
          contact: normalizedPhone
        },
        theme: {
          color: "#E20613"
        },
        modal: {
          ondismiss: function() {
            toast.info("Payment session dismissed.");
            setIsProcessing(false);
          }
        }
      };

      const razorpayGateway = new (window as any).Razorpay(options);
      razorpayGateway.open();

    } catch (error: any) {
      console.error("Payment flow initialization failure:", error);
      toast.error(error.message || "Failed to initialize payment gateway. Verify your keys are set.");
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (profile?.mobileNumber) {
      setMobileNumber(profile.mobileNumber);
    }
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    }
  }, [profile?.mobileNumber, profile?.displayName]);

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

  if (loading) return <LoadingScreen />;

  return (
    <div className="py-12 md:py-24 px-4 max-w-[1600px] mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-8 md:mb-20 space-y-2">
        <h1 className="text-3xl md:text-8xl font-black uppercase italic tracking-tighter leading-none">
          Choose Your <span className="text-brand">League</span>
        </h1>
        <p className="text-slate-400 text-xs md:text-lg font-medium">
          Select a plan that fits your passion. Upgrade or cancel anytime.
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
                "relative rounded-xl md:rounded-2xl p-8 md:p-12 flex flex-col border bg-gradient-to-br transition-all hover:scale-[1.03] group shadow-2xl overflow-hidden",
                plan.color
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 right-8 md:right-12 -translate-y-1/2 bg-white text-brand px-4 md:px-6 py-1 md:py-1.5 font-black text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-full shadow-xl">
                  Most Popular
                </div>
              )}

              {plan.offer?.isActive && (
                <div className="absolute top-8 -right-12 rotate-45 bg-yellow-400 text-black px-12 py-1 font-black text-[10px] uppercase tracking-widest shadow-xl">
                  {plan.offer.percentage}% OFF
                </div>
              )}

              <div className="flex items-center gap-3 md:gap-5 mb-4 md:mb-10">
                <div className="w-10 h-10 md:w-16 md:h-16 bg-white/10 rounded-md md:rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                  <Icon className={cn("w-5 h-5 md:w-8 md:h-8", (plan.id === 'pro' || plan.id === 'medium' || plan.popular) ? "text-white" : "text-brand")} />
                </div>
                <div>
                  <h3 className="font-black text-lg md:text-2xl uppercase italic tracking-tight">{plan.name}</h3>
                  {profile?.subscriptionTier === plan.id && (
                    <span className="text-[7px] md:text-[10px] font-black text-white/60 uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-full">Active Plan</span>
                  )}
                </div>
              </div>

              <div className="mb-4 md:mb-10 space-y-1">
                <div className="flex items-baseline gap-2 md:gap-3">
                  {plan.offer?.isActive && (
                    <span className="text-base md:text-2xl line-through text-white/20 font-black italic">₹{plan.price}</span>
                  )}
                  <span className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter">₹{Math.round(parseFloat(finalPrice))}</span>
                  <span className="text-white/40 uppercase text-[8px] md:text-xs font-black tracking-widest">/ Month</span>
                </div>
              </div>

              <p className="text-[11px] md:text-sm text-white/50 mb-6 md:mb-12 font-medium leading-relaxed">
                {plan.description}
              </p>

              <div className="space-y-2 md:space-y-4 mb-6 md:mb-12 flex-grow">
                {(plan.features || [])
                  .flatMap(f => f.split(/[\n,]/))
                  .map(item => item.trim())
                  .filter(Boolean)
                  .map((feature, idx) => (
                    <div key={`${feature}-${idx}`} className="flex items-center gap-2 md:gap-4 text-[10px] md:text-sm font-bold tracking-tight text-white/90">
                      <div className="w-4 h-4 md:w-6 md:h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                        <Check className={cn("w-2.5 md:w-3.5 h-2.5 md:h-3.5", (plan.id === 'pro' || plan.id === 'medium' || plan.popular) ? "text-white" : "text-brand")} />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
              </div>

              <button 
                onClick={() => setSelectedPlan(plan)}
                disabled={profile?.subscriptionTier === plan.id}
                className={cn(
                  "w-full py-4 md:py-5 font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all rounded-lg md:rounded-xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
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
                  className="bg-surface w-full max-w-lg rounded-xl md:rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  {step === 'success' ? (
                    <div className="p-6 md:p-12 text-center space-y-4 md:space-y-8">
                      <div className="w-16 h-16 md:w-24 md:h-24 bg-green-500/20 rounded-xl md:rounded-2xl mx-auto flex items-center justify-center">
                        <Check className="w-8 h-8 md:w-12 md:h-12 text-green-500" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter">Welcome to the Stadium</h2>
                        <p className="text-xs md:text-text-muted font-medium">Your {selectedPlan.name} is now active. Enjoy high-priority sports streaming.</p>
                      </div>
                      <button 
                        onClick={() => setSelectedPlan(null)}
                        className="w-full py-4 md:py-5 bg-brand text-white font-black uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-lg md:rounded-xl"
                      >
                        Start Watching
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <button 
                        onClick={() => setSelectedPlan(null)}
                        className="absolute top-6 right-6 md:top-8 md:right-8 text-white/20 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                      </button>

                      <div className="p-6 md:p-12 space-y-6 md:space-y-8">
                          <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-brand/10 rounded-lg md:rounded-xl flex items-center justify-center">
                              {(() => {
                                const Icon = IconMap[selectedPlan.icon] || Zap;
                                return <Icon className="w-5 h-5 md:w-6 md:h-6 text-brand" />;
                              })()}
                            </div>
                            <div>
                              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-muted">Subscription Upgrade</p>
                              <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{selectedPlan.name}</h3>
                            </div>
                          </div>

                      {!user ? (
                        <div className="space-y-4 md:space-y-6">
                           <div className="p-5 md:p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                              <p className="text-xs md:text-sm font-medium text-text-muted">You need to be signed in to subscribe.</p>
                              <button 
                                onClick={() => signInWithGoogle()}
                                className="w-full py-3.5 md:py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl flex items-center justify-center gap-2"
                              >
                                Sign in with Google
                              </button>
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-4 md:space-y-6">
                            <div className="space-y-4 md:space-y-6">
                              <div className="space-y-4 md:space-y-5">
                                <div className="space-y-2">
                                  <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                    <Mail className="w-3 h-3" />
                                    Email Address
                                  </label>
                                  <input 
                                    type="email"
                                    value={user.email || ''}
                                    disabled
                                    className="w-full bg-white/5 border border-white/5 p-3.5 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium text-white/50 cursor-not-allowed"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                    <User className="w-3 h-3" />
                                    Full Name
                                  </label>
                                  <input 
                                    type="text"
                                    placeholder="Enter your name"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    className="w-full bg-bg border border-white/10 p-4 md:p-5 rounded-xl md:rounded-2xl focus:border-brand outline-none text-xs md:text-sm font-bold"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                    <Phone className="w-3 h-3" />
                                    Mobile Number
                                  </label>
                                  <div className="flex gap-3">
                                    <input 
                                      type="tel"
                                      placeholder="Enter 10-digit number"
                                      value={mobileNumber}
                                      onChange={e => setMobileNumber(e.target.value)}
                                      className="flex-grow bg-bg border border-white/10 p-4 md:p-5 rounded-xl md:rounded-2xl focus:border-brand outline-none text-xs md:text-sm font-bold"
                                    />
                                  </div>
                                  <p className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-wider">India (+91) format supported</p>
                                </div>
                              </div>

                              {(() => {
                                const discount = selectedPlan.offer?.isActive ? selectedPlan.offer.percentage : 0;
                                const finalPrice = Math.round(selectedPlan.price * (1 - discount / 100));
                                return (
                                  <>
                                    <div className="p-4 md:p-6 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 space-y-3 md:space-y-4">
                                      <div className="flex justify-between items-center text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-muted">
                                        <span>Subscription Fee</span>
                                        <span className={cn("text-white", discount > 0 && "line-through")}>₹{selectedPlan.price}</span>
                                      </div>
                                      {discount > 0 && (
                                        <div className="flex justify-between items-center text-[10px] md:text-xs">
                                          <span className="font-bold uppercase tracking-widest text-green-500">Special Discount</span>
                                          <span className="text-green-500 font-black">-{discount}% OFF</span>
                                        </div>
                                      )}
                                      <div className="pt-3 md:pt-4 border-t border-white/5 flex justify-between items-center">
                                        <span className="text-xs md:text-sm font-black uppercase italic">Total Due</span>
                                        <span className="text-xl md:text-2xl font-black text-brand">₹{finalPrice}</span>
                                      </div>
                                    </div>

                                    <button 
                                      onClick={handleSubscribe}
                                      disabled={isProcessing || !mobileNumber || !displayName}
                                      className="w-full py-4 md:py-5 bg-brand text-white font-black uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-xl md:rounded-2xl shadow-xl shadow-brand/20 disabled:opacity-50 text-xs md:text-sm cursor-pointer"
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                      ) : finalPrice === 0 ? (
                                        'Join for Free'
                                      ) : (
                                        `Pay ₹${finalPrice} securely`
                                      )}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
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
