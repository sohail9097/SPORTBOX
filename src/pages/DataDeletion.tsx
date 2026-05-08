import { motion } from 'motion/react';
import { Mail, Trash2 } from 'lucide-react';

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-bg pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-white/5 p-8 md:p-12 rounded-[32px] relative overflow-hidden"
        >
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center mb-8 border border-brand/20">
              <Trash2 className="w-6 h-6 text-brand" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white mb-8">
              Data Deletion <span className="text-brand">Instructions</span>
            </h1>
            
            <div className="space-y-8 text-text-base leading-relaxed uppercase tracking-widest text-[11px] md:text-xs font-bold">
              <p className="text-white/60">
                If you want your account and all associated data deleted from the SportsBox platform, please follow the steps below:
              </p>
              
              <div className="bg-black/40 p-8 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center gap-4 text-brand">
                  <Mail className="w-5 h-5" />
                  <span className="text-[10px] md:text-xs">Send an email to:</span>
                </div>
                
                <p className="text-2xl md:text-3xl font-black text-white lowercase tracking-tight font-sans">
                  sanowardreamcatchers@gmail.com
                </p>
                
                <div className="pt-6 border-t border-white/5 space-y-2">
                  <p className="text-white/40">Subject Line:</p>
                  <p className="text-white font-black italic text-lg tracking-normal">Data Deletion Request</p>
                </div>
              </div>
              
              <div className="bg-brand/5 border border-brand/20 p-6 rounded-2xl">
                <p className="text-brand font-black italic flex items-center gap-3">
                  <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                  Processing Time: Within 7 Days
                </p>
                <p className="mt-2 text-[10px] lowercase tracking-normal text-brand/70 font-medium">
                  We will permanently remove your account profile, preferences, and all activity data within one week of receiving your request.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
        
        <p className="text-center mt-12 text-[10px] uppercase tracking-[0.3em] text-white/20 font-black italic">
          SportsBox &bull; Privacy Compliance &bull; 2026
        </p>
      </div>
    </div>
  );
}
