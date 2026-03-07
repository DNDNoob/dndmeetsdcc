// Production-safe logger — only logs when VITE_DEBUG is set or in development mode
const isDev = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args);
  },
};
