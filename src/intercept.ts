// Intercept console logging early to suppress third-party spam
const originalConsoleError = console.error;
console.error = function (...args) {
  const msg = args.map(arg => typeof arg === 'object' ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(' ');
  if (
    msg.includes('[Firebase]') || 
    msg.includes('[Firestore]')
  ) {
    originalConsoleError.apply(console, args);
  } else if (
    msg.includes('Quota exceeded') ||
    msg.includes('quota-exhausted') ||
    msg.includes('resource-exhausted')
  ) {
    // Only suppress quota errors in console, still handle them in code
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
  const msg = args.map(arg => typeof arg === 'object' ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(' ');
  if (
    msg.includes('Quota exceeded') ||
    msg.includes('quota-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Using maximum backoff delay')
  ) {
    // Suppress only quota-related warnings
    return;
  }
  originalConsoleWarn.apply(console, args);
};
