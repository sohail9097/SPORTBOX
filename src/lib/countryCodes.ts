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

// Full list of 195+ countries worldwide
const RAW_COUNTRIES: CountryCodeOption[] = [
  { code: 'AF', name: 'Afghanistan', dialCode: '+93', flag: '🇦🇫', digitLength: 9 },
  { code: 'AL', name: 'Albania', dialCode: '+355', flag: '🇦🇱', digitLength: 9 },
  { code: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿', digitLength: 9 },
  { code: 'AD', name: 'Andorra', dialCode: '+376', flag: '🇦🇩', digitLength: 6 },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', digitLength: 9 },
  { code: 'AG', name: 'Antigua and Barbuda', dialCode: '+1268', flag: '🇦🇬', digitLength: 7 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', digitLength: 10 },
  { code: 'AM', name: 'Armenia', dialCode: '+374', flag: '🇦🇲', digitLength: 8 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', digitLength: 9 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', digitLength: 10 },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '+994', flag: '🇦🇿', digitLength: 9 },
  { code: 'BS', name: 'Bahamas', dialCode: '+1242', flag: '🇧🇸', digitLength: 7 },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', digitLength: 8 },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', digitLength: 10 },
  { code: 'BB', name: 'Barbados', dialCode: '+1246', flag: '🇧🇧', digitLength: 7 },
  { code: 'BY', name: 'Belarus', dialCode: '+375', flag: '🇧🇾', digitLength: 9 },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', digitLength: 9 },
  { code: 'BZ', name: 'Belize', dialCode: '+501', flag: '🇧🇿', digitLength: 7 },
  { code: 'BJ', name: 'Benin', dialCode: '+229', flag: '🇧🇯', digitLength: 8 },
  { code: 'BT', name: 'Bhutan', dialCode: '+975', flag: '🇧🇹', digitLength: 8 },
  { code: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴', digitLength: 8 },
  { code: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387', flag: '🇧🇦', digitLength: 8 },
  { code: 'BW', name: 'Botswana', dialCode: '+267', flag: '🇧🇼', digitLength: 8 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', digitLength: 11 },
  { code: 'BN', name: 'Brunei', dialCode: '+673', flag: '🇧🇳', digitLength: 7 },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359', flag: '🇧🇬', digitLength: 9 },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', digitLength: 8 },
  { code: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮', digitLength: 8 },
  { code: 'KH', name: 'Cambodia', dialCode: '+855', flag: '🇰🇭', digitLength: 9 },
  { code: 'CM', name: 'Cameroon', dialCode: '+237', flag: '🇨🇲', digitLength: 9 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', digitLength: 10 },
  { code: 'CV', name: 'Cape Verde', dialCode: '+238', flag: '🇨🇻', digitLength: 7 },
  { code: 'CF', name: 'Central African Republic', dialCode: '+236', flag: '🇨🇫', digitLength: 8 },
  { code: 'TD', name: 'Chad', dialCode: '+235', flag: '🇹🇩', digitLength: 8 },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', digitLength: 9 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', digitLength: 11 },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', digitLength: 10 },
  { code: 'KM', name: 'Comoros', dialCode: '+269', flag: '🇰🇲', digitLength: 7 },
  { code: 'CG', name: 'Congo', dialCode: '+242', flag: '🇨🇬', digitLength: 9 },
  { code: 'CD', name: 'Congo (DRC)', dialCode: '+243', flag: '🇨🇩', digitLength: 9 },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷', digitLength: 8 },
  { code: 'HR', name: 'Croatia', dialCode: '+385', flag: '🇭🇷', digitLength: 9 },
  { code: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺', digitLength: 8 },
  { code: 'CY', name: 'Cyprus', dialCode: '+357', flag: '🇨🇾', digitLength: 8 },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', digitLength: 9 },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', digitLength: 8 },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯', digitLength: 8 },
  { code: 'DM', name: 'Dominica', dialCode: '+1767', flag: '🇩🇲', digitLength: 7 },
  { code: 'DO', name: 'Dominican Republic', dialCode: '+1809', flag: '🇩🇴', digitLength: 10 },
  { code: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨', digitLength: 9 },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', digitLength: 10 },
  { code: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻', digitLength: 8 },
  { code: 'GQ', name: 'Equatorial Guinea', dialCode: '+240', flag: '🇬🇶', digitLength: 9 },
  { code: 'ER', name: 'Eritrea', dialCode: '+291', flag: '🇪🇷', digitLength: 7 },
  { code: 'EE', name: 'Estonia', dialCode: '+372', flag: '🇪🇪', digitLength: 8 },
  { code: 'SZ', name: 'Eswatini', dialCode: '+268', flag: '🇸🇿', digitLength: 8 },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹', digitLength: 9 },
  { code: 'FJ', name: 'Fiji', dialCode: '+679', flag: '🇫🇯', digitLength: 7 },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', digitLength: 10 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', digitLength: 9 },
  { code: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦', digitLength: 8 },
  { code: 'GM', name: 'Gambia', dialCode: '+220', flag: '🇬🇲', digitLength: 7 },
  { code: 'GE', name: 'Georgia', dialCode: '+995', flag: '🇬🇪', digitLength: 9 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', digitLength: 10 },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', digitLength: 9 },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', digitLength: 10 },
  { code: 'GD', name: 'Grenada', dialCode: '+1473', flag: '🇬🇩', digitLength: 7 },
  { code: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹', digitLength: 8 },
  { code: 'GN', name: 'Guinea', dialCode: '+224', flag: '🇬🇳', digitLength: 9 },
  { code: 'GW', name: 'Guinea-Bissau', dialCode: '+245', flag: '🇬🇼', digitLength: 7 },
  { code: 'GY', name: 'Guyana', dialCode: '+592', flag: '🇬🇾', digitLength: 7 },
  { code: 'HT', name: 'Haiti', dialCode: '+509', flag: '🇭🇹', digitLength: 8 },
  { code: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳', digitLength: 8 },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', digitLength: 8 },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺', digitLength: 9 },
  { code: 'IS', name: 'Iceland', dialCode: '+354', flag: '🇮🇸', digitLength: 7 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', digitLength: 10 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', digitLength: 10 },
  { code: 'IR', name: 'Iran', dialCode: '+98', flag: '🇮🇷', digitLength: 10 },
  { code: 'IQ', name: 'Iraq', dialCode: '+964', flag: '🇮🇶', digitLength: 10 },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', digitLength: 9 },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱', digitLength: 9 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', digitLength: 10 },
  { code: 'CI', name: 'Ivory Coast', dialCode: '+225', flag: '🇨🇮', digitLength: 10 },
  { code: 'JM', name: 'Jamaica', dialCode: '+1876', flag: '🇯🇲', digitLength: 7 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', digitLength: 10 },
  { code: 'JO', name: 'Jordan', dialCode: '+962', flag: '🇯🇴', digitLength: 9 },
  { code: 'KZ', name: 'Kazakhstan', dialCode: '+7', flag: '🇰🇿', digitLength: 10 },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', digitLength: 9 },
  { code: 'KI', name: 'Kiribati', dialCode: '+686', flag: '🇰🇮', digitLength: 8 },
  { code: 'KP', name: 'North Korea', dialCode: '+850', flag: '🇰🇵', digitLength: 10 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', digitLength: 10 },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', digitLength: 8 },
  { code: 'KG', name: 'Kyrgyzstan', dialCode: '+996', flag: '🇰🇬', digitLength: 9 },
  { code: 'LA', name: 'Laos', dialCode: '+856', flag: '🇱🇦', digitLength: 9 },
  { code: 'LV', name: 'Latvia', dialCode: '+371', flag: '🇱🇻', digitLength: 8 },
  { code: 'LB', name: 'Lebanon', dialCode: '+961', flag: '🇱🇧', digitLength: 8 },
  { code: 'LS', name: 'Lesotho', dialCode: '+266', flag: '🇱🇸', digitLength: 8 },
  { code: 'LR', name: 'Liberia', dialCode: '+231', flag: '🇱🇷', digitLength: 8 },
  { code: 'LY', name: 'Libya', dialCode: '+218', flag: '🇱🇾', digitLength: 9 },
  { code: 'LI', name: 'Liechtenstein', dialCode: '+423', flag: '🇱🇮', digitLength: 7 },
  { code: 'LT', name: 'Lithuania', dialCode: '+370', flag: '🇱🇹', digitLength: 8 },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺', digitLength: 9 },
  { code: 'MO', name: 'Macau', dialCode: '+853', flag: '🇲🇴', digitLength: 8 },
  { code: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', digitLength: 9 },
  { code: 'MW', name: 'Malawi', dialCode: '+265', flag: '🇲🇼', digitLength: 9 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', digitLength: 9 },
  { code: 'MV', name: 'Maldives', dialCode: '+960', flag: '🇲🇻', digitLength: 7 },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', digitLength: 8 },
  { code: 'MT', name: 'Malta', dialCode: '+356', flag: '🇲🇹', digitLength: 8 },
  { code: 'MH', name: 'Marshall Islands', dialCode: '+692', flag: '🇲🇭', digitLength: 7 },
  { code: 'MR', name: 'Mauritania', dialCode: '+222', flag: '🇲🇷', digitLength: 8 },
  { code: 'MU', name: 'Mauritius', dialCode: '+230', flag: '🇲🇺', digitLength: 8 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', digitLength: 10 },
  { code: 'FM', name: 'Micronesia', dialCode: '+691', flag: '🇫🇲', digitLength: 7 },
  { code: 'MD', name: 'Moldova', dialCode: '+373', flag: '🇲🇩', digitLength: 8 },
  { code: 'MC', name: 'Monaco', dialCode: '+377', flag: '🇲🇨', digitLength: 8 },
  { code: 'MN', name: 'Mongolia', dialCode: '+976', flag: '🇲🇳', digitLength: 8 },
  { code: 'ME', name: 'Montenegro', dialCode: '+382', flag: '🇲🇪', digitLength: 8 },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', digitLength: 9 },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', digitLength: 9 },
  { code: 'MM', name: 'Myanmar', dialCode: '+95', flag: '🇲🇲', digitLength: 9 },
  { code: 'NA', name: 'Namibia', dialCode: '+264', flag: '🇳🇦', digitLength: 9 },
  { code: 'NR', name: 'Nauru', dialCode: '+674', flag: '🇳🇷', digitLength: 7 },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', digitLength: 10 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', digitLength: 9 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', digitLength: 9 },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮', digitLength: 8 },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', digitLength: 8 },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', digitLength: 10 },
  { code: 'MK', name: 'North Macedonia', dialCode: '+389', flag: '🇲🇰', digitLength: 8 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', digitLength: 8 },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', digitLength: 8 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', digitLength: 10 },
  { code: 'PW', name: 'Palau', dialCode: '+680', flag: '🇵🇼', digitLength: 7 },
  { code: 'PS', name: 'Palestine', dialCode: '+970', flag: '🇵🇸', digitLength: 9 },
  { code: 'PA', name: 'Panama', dialCode: '+507', flag: '🇵🇦', digitLength: 8 },
  { code: 'PG', name: 'Papua New Guinea', dialCode: '+675', flag: '🇵🇬', digitLength: 8 },
  { code: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾', digitLength: 9 },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', digitLength: 9 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', digitLength: 10 },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', digitLength: 9 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', digitLength: 9 },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', digitLength: 8 },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴', digitLength: 9 },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', digitLength: 10 },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', digitLength: 9 },
  { code: 'KN', name: 'Saint Kitts and Nevis', dialCode: '+1869', flag: '🇰🇳', digitLength: 7 },
  { code: 'LC', name: 'Saint Lucia', dialCode: '+1758', flag: '🇱🇨', digitLength: 7 },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', dialCode: '+1784', flag: '🇻🇨', digitLength: 7 },
  { code: 'WS', name: 'Samoa', dialCode: '+685', flag: '🇼🇸', digitLength: 7 },
  { code: 'SM', name: 'San Marino', dialCode: '+378', flag: '🇸🇲', digitLength: 10 },
  { code: 'ST', name: 'Sao Tome and Principe', dialCode: '+239', flag: '🇸🇹', digitLength: 7 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', digitLength: 9 },
  { code: 'SN', name: 'Senegal', dialCode: '+221', flag: '🇸🇳', digitLength: 9 },
  { code: 'RS', name: 'Serbia', dialCode: '+381', flag: '🇷🇸', digitLength: 9 },
  { code: 'SC', name: 'Seychelles', dialCode: '+248', flag: '🇸🇨', digitLength: 7 },
  { code: 'SL', name: 'Sierra Leone', dialCode: '+232', flag: '🇸🇱', digitLength: 8 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', digitLength: 8 },
  { code: 'SK', name: 'Slovakia', dialCode: '+421', flag: '🇸🇰', digitLength: 9 },
  { code: 'SI', name: 'Slovenia', dialCode: '+386', flag: '🇸🇮', digitLength: 8 },
  { code: 'SB', name: 'Solomon Islands', dialCode: '+677', flag: '🇸🇧', digitLength: 7 },
  { code: 'SO', name: 'Somalia', dialCode: '+252', flag: '🇸🇴', digitLength: 8 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', digitLength: 9 },
  { code: 'SS', name: 'South Sudan', dialCode: '+211', flag: '🇸🇸', digitLength: 9 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', digitLength: 9 },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', digitLength: 9 },
  { code: 'SD', name: 'Sudan', dialCode: '+249', flag: '🇸🇩', digitLength: 9 },
  { code: 'SR', name: 'Suriname', dialCode: '+597', flag: '🇸🇷', digitLength: 7 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', digitLength: 9 },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', digitLength: 9 },
  { code: 'SY', name: 'Syria', dialCode: '+963', flag: '🇸🇾', digitLength: 9 },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', digitLength: 9 },
  { code: 'TJ', name: 'Tajikistan', dialCode: '+992', flag: '🇹🇯', digitLength: 9 },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', digitLength: 9 },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', digitLength: 9 },
  { code: 'TL', name: 'Timor-Leste', dialCode: '+670', flag: '🇹🇱', digitLength: 8 },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', digitLength: 8 },
  { code: 'TO', name: 'Tonga', dialCode: '+676', flag: '🇹🇴', digitLength: 7 },
  { code: 'TT', name: 'Trinidad and Tobago', dialCode: '+1868', flag: '🇹🇹', digitLength: 7 },
  { code: 'TN', name: 'Tunisia', dialCode: '+216', flag: '🇹🇳', digitLength: 8 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', digitLength: 10 },
  { code: 'TM', name: 'Turkmenistan', dialCode: '+993', flag: '🇹🇲', digitLength: 8 },
  { code: 'TV', name: 'Tuvalu', dialCode: '+688', flag: '🇹🇻', digitLength: 6 },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', digitLength: 9 },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦', digitLength: 9 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', digitLength: 9 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', digitLength: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', digitLength: 10 },
  { code: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾', digitLength: 8 },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '+998', flag: '🇺🇿', digitLength: 9 },
  { code: 'VU', name: 'Vanuatu', dialCode: '+678', flag: '🇻🇺', digitLength: 7 },
  { code: 'VA', name: 'Vatican City', dialCode: '+379', flag: '🇻🇦', digitLength: 10 },
  { code: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪', digitLength: 10 },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', digitLength: 9 },
  { code: 'YE', name: 'Yemen', dialCode: '+967', flag: '🇾🇪', digitLength: 9 },
  { code: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲', digitLength: 9 },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼', digitLength: 9 },
];

// Sort alphabetically by country name, but PIN India (+91) at the top!
export const COUNTRY_CODES: CountryCodeOption[] = (() => {
  const india = RAW_COUNTRIES.find(c => c.code === 'IN') || DEFAULT_COUNTRY;
  const others = RAW_COUNTRIES.filter(c => c.code !== 'IN').sort((a, b) => a.name.localeCompare(b.name));
  return [india, ...others];
})();

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
    // Match longest dial code first to avoid +1 matching +1242 incorrectly
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
