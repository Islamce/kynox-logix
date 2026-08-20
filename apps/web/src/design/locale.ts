import { useCallback, useEffect, useState } from 'react';

/**
 * Locale/direction engine, mirroring `theme.ts`'s pattern:
 *   - persists the choice, stamps `dir`/`lang` on <html>, and exposes a hook.
 * Scope: UI chrome only (nav, headers, buttons, empty/error states). Data
 * values (material codes, numbers, dataset content) are never translated —
 * this is presentation, not a content localisation system. The import
 * mapping layer already accepts Arabic column headers server-side
 * (see docs/ARCHITECTURE.md); this module adds the missing frontend half.
 */

export type Locale = 'en' | 'ar';

const STORAGE_KEY = 'kynox.locale';

export function getStoredLocale(): Locale {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'ar' ? 'ar' : 'en';
}

export function applyLocale(locale: Locale): void {
  const root = document.documentElement;
  root.setAttribute('lang', locale);
  root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  localStorage.setItem(STORAGE_KEY, locale);
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(() =>
    typeof window === 'undefined' ? 'en' : getStoredLocale(),
  );

  const setAppLocale = useCallback((next: Locale) => {
    applyLocale(next);
    setLocale(next);
  }, []);

  // Apply on mount in case main.tsx bootstrap ran before React mounted.
  useEffect(() => { applyLocale(locale); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { locale, dir: locale === 'ar' ? 'rtl' as const : 'ltr' as const, setAppLocale };
}

/** Minimal chrome-level dictionary. Data/content strings are not covered. */
const STRINGS = {
  en: {
    'nav.overview': 'Overview',
    'nav.analysis': 'Analysis',
    'nav.governance': 'Governance',
    'menu.theme': 'Theme',
    'menu.language': 'Language',
    'menu.signout': 'Sign out',
    'search.placeholder': 'Search…',
  },
  ar: {
    'nav.overview': 'نظرة عامة',
    'nav.analysis': 'التحليل',
    'nav.governance': 'الحوكمة',
    'menu.theme': 'المظهر',
    'menu.language': 'اللغة',
    'menu.signout': 'تسجيل الخروج',
    'search.placeholder': 'بحث…',
  },
} satisfies Record<Locale, Record<string, string>>;

export function t(locale: Locale, key: keyof typeof STRINGS['en']): string {
  return STRINGS[locale][key] ?? STRINGS.en[key];
}
