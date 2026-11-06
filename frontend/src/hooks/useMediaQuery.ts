import { useSyncExternalStore } from 'react';

/** Assina uma media query. `useMediaQuery('(min-width: 1024px)')` */
export function useConsultaMidia(consulta: string): boolean {
  return useSyncExternalStore(
    (aoMudar) => {
      const mql = window.matchMedia(consulta);
      mql.addEventListener('change', aoMudar);
      return () => mql.removeEventListener('change', aoMudar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** Breakpoints alinhados ao Tailwind (sm 640, md 768, lg 1024, xl 1280). */
export const useEhDesktop = () => useConsultaMidia('(min-width: 1024px)');
