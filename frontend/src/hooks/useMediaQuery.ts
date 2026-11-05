import { useSyncExternalStore } from 'react';

/** Assina uma media query. `useMediaQuery('(min-width: 1024px)')` */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Breakpoints alinhados ao Tailwind (sm 640, md 768, lg 1024, xl 1280). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
