// Intercept console logging early to suppress third-party Firestore quota/exhausted log spam
const originalConsoleError = console.error;
console.error = function (...args) {
  const msg = args.map(arg => typeof arg === 'object' ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(' ');
  if (
    msg.includes('Quota exceeded') ||
    msg.includes('quota-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Firestore fetch failed') ||
    msg.includes('Using maximum backoff delay')
  ) {
    // Suppress the error message so it does not flag as a fatal applet error
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
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Using maximum backoff delay')
  ) {
    // Suppress warning spam
    return;
  }
  originalConsoleWarn.apply(console, args);
};

const originalConsoleLog = console.log;
console.log = function (...args) {
  const msg = args.map(arg => typeof arg === 'object' ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(' ');
  if (
    msg.includes('Quota exceeded') ||
    msg.includes('quota-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Using maximum backoff delay')
  ) {
    // Suppress log spam
    return;
  }
  originalConsoleLog.apply(console, args);
};

// Register window error and unhandled rejection interceptors
if (typeof window !== 'undefined') {
  const isQuotaError = (msg: string) => {
    return (
      msg.includes('Quota exceeded') ||
      msg.includes('quota-exhausted') ||
      msg.includes('resource-exhausted') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('Firestore fetch failed') ||
      msg.includes('Using maximum backoff delay')
    );
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const errorMsg = event.error ? (event.error.message || String(event.error)) : '';
    if (isQuotaError(msg) || isQuotaError(errorMsg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'object' ? (reason?.message || JSON.stringify(reason)) : String(reason);
    if (isQuotaError(msg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}
