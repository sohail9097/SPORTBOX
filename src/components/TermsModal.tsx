import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, FileText } from 'lucide-react';
import { TERMS_AND_CONDITIONS } from '../config/termsConfig';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function TermsModal({ isOpen, onClose, title }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-zinc-950 border border-white/10 p-6 md:p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-white">
                  {title || TERMS_AND_CONDITIONS.title}
                </h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                  Version {TERMS_AND_CONDITIONS.version} &bull; Last Updated: {TERMS_AND_CONDITIONS.lastUpdated}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-grow overflow-y-auto space-y-5 pr-2 custom-scrollbar text-xs text-text-muted leading-relaxed font-medium">
            <div className="p-3 bg-brand/5 border border-brand/15 rounded-xl flex items-center gap-2.5 text-brand font-bold text-[11px]">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Please review our official terms before accepting.</span>
            </div>

            {TERMS_AND_CONDITIONS.sections.map((section, idx) => (
              <div key={idx} className="space-y-1.5 bg-white/5 p-4 rounded-xl border border-white/5">
                <h4 className="text-white font-black uppercase tracking-wider text-[11px] italic">
                  {section.heading}
                </h4>
                <p className="text-text-muted text-[11px] leading-relaxed">
                  {section.text}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 mt-4 flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all"
            >
              I Understand & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
