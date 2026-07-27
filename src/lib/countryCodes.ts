export interface CountryCodeOption {
  code: string;        // ISO 2-letter country code (e.g. "IN")
  name: string;        // Country name (e.g. "India")
  dialCode: string;    // Calling code (e.g. "+91")
  flag: string;        // Flag emoji (e.g. "🇮🇳")
  digitLength: number; // Standard local mobile number digit length (e.g. 10)
}

export const DEFAULT_COUNTRY: CountryCodeOption = {
  code: 'IN',
  name: 'India',
  dialCode: '+91',
  flag: '🇮🇳',
  digitLength: 10
};

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', digitLength: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', digitLength: 10 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', digitLength: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', digitLength: 10 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', digitLength: 9 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', digitLength: 9 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', digitLength: 9 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', digitLength: 8 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', digitLength: 10 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', digitLength: 9 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', digitLength: 10 },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', digitLength: 10 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', digitLength: 10 },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', digitLength: 10 },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', digitLength: 9 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', digitLength: 8 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', digitLength: 8 },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', digitLength: 8 },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', digitLength: 8 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', digitLength: 9 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', digitLength: 9 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', digitLength: 9 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', digitLength: 11 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', digitLength: 10 },
];

/**
  Helper function to parse an existing saved phone string (e.g. "+919876543210")
  into a matching CountryCodeOption and local digit string.
 */
export function parsePhoneNumber(savedPhone?: string): { country: CountryCodeOption; localDigits: string } {
  if (!savedPhone) {
    return { country: DEFAULT_COUNTRY, localDigits: '' };
  }

  const clean = savedPhone.trim();
  if (clean.startsWith('+')) {
    // Try matching longest dial code first
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (clean.startsWith(c.dialCode)) {
        const digits = clean.slice(c.dialCode.length).replace(/\D/g, '');
        return { country: c, localDigits: digits.slice(0, c.digitLength) };
      }
    }
  }

  // Fallback: raw digits
  const rawDigits = clean.replace(/\D/g, '');
  const localDigits = rawDigits.length >= DEFAULT_COUNTRY.digitLength
    ? rawDigits.slice(-DEFAULT_COUNTRY.digitLength)
    : rawDigits;

  return { country: DEFAULT_COUNTRY, localDigits };
}
