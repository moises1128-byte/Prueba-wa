import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia — sonner's <Toaster /> calls it
// unconditionally (dark-mode detection) and crashes without this polyfill.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
