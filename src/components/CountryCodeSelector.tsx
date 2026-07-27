import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { COUNTRY_CODES, CountryCodeOption } from '../lib/countryCodes';
import { cn } from '../lib/utils';

interface CountryCodeSelectorProps {
  selectedCountry: CountryCodeOption;
  onSelect: (country: CountryCodeOption) => void;
  className?: string;
  triggerClassName?: string;
  dropdownWidth?: string; // e.g. "w-72" or "w-80"
}

export default function CountryCodeSelector({
  selectedCountry,
  onSelect,
  className = '',
  triggerClassName = '',
  dropdownWidth = 'w-72 sm:w-80'
}: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter countries based on search query
  const query = searchQuery.trim().toLowerCase();
  const filteredCountries = COUNTRY_CODES.filter((c) => {
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.dialCode.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query)
    );
  });

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 bg-bg border border-white/10 hover:border-white/20 focus:border-brand/60 px-3.5 py-3.5 md:px-4 md:py-4 rounded-xl md:rounded-2xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer h-full select-none",
          isOpen && "border-brand ring-1 ring-brand/30",
          triggerClassName
        )}
      >
        <span className="text-base sm:text-lg leading-none">{selectedCountry.flag}</span>
        <span className="font-mono font-bold tracking-tight text-white">{selectedCountry.dialCode}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-white/50 transition-transform duration-200 ml-0.5",
            isOpen && "rotate-180 text-brand"
          )}
        />
      </button>

      {/* Popover / Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              "absolute left-0 top-full mt-2 z-[9999] bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col",
              dropdownWidth
            )}
            style={{ maxHeight: '360px' }}
          >
            {/* Sticky Search Header */}
            <div className="p-2.5 border-b border-white/10 bg-zinc-900/80 sticky top-0 z-10 flex items-center gap-2">
              <Search className="w-4 h-4 text-white/40 ml-2 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-white placeholder:text-white/30 outline-none pr-2 py-1"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable Country List */}
            <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-72 custom-scrollbar divide-y divide-white/[0.03]">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => {
                  const isSelected = country.code === selectedCountry.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        onSelect(country);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm transition-all cursor-pointer group",
                        isSelected
                          ? "bg-brand/20 text-brand font-bold"
                          : "text-zinc-200 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-base sm:text-lg flex-shrink-0">{country.flag}</span>
                        <span className="font-mono text-xs font-bold text-brand-light flex-shrink-0">
                          {country.dialCode}
                        </span>
                        <span className="truncate text-xs font-medium text-white/90 group-hover:text-white">
                          {country.name}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-brand flex-shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-white/40 font-medium">
                  No country found matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Total Footer Status */}
            <div className="px-3 py-1.5 border-t border-white/10 bg-zinc-900/50 text-[10px] text-white/40 font-mono flex justify-between items-center">
              <span>{filteredCountries.length} countries available</span>
              {selectedCountry.code === 'IN' && (
                <span className="text-brand font-bold uppercase tracking-wider">Default</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
