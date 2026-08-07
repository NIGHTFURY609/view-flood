import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "./dictionaries/en.json";
import ml from "./dictionaries/ml.json";

export type Locale = "en" | "ml";

/**
 * The English dictionary is the schema. Every key used anywhere in the app must
 * exist here, which makes `t()` calls type-checked rather than stringly-typed —
 * a typo is a build error, not a silent fallback to the raw key.
 */
export type DictKey = keyof typeof en;

type Dict = Record<string, string>;

const DICTIONARIES: Record<Locale, Dict> = { en, ml };

const STORAGE_KEY = "kcc.locale";

export type TranslateVars = Readonly<Record<string, string | number>>;

interface I18nContextValue {
  readonly locale: Locale;
  readonly setLocale: (next: Locale) => void;
  readonly toggle: () => void;
  readonly t: (key: DictKey, vars?: TranslateVars) => string;
  /**
   * Count-aware lookup. Uses the `<key>.one` sibling when count is 1 and one
   * exists, else `<key>`, and always passes {count} through.
   */
  readonly tp: (key: DictKey, count: number, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ml") return stored;
  } catch {
    // Storage unavailable — fall through to the browser hint.
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ml")) {
    return "ml";
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice simply does not survive the session.
    }
  }, []);

  const toggle = useCallback(() => {
    setLocaleState((current) => {
      const next: Locale = current === "en" ? "ml" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Non-fatal.
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: TranslateVars): string => {
      const table = DICTIONARIES[locale];
      const template = table[key] ?? en[key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [locale],
  );

  const tp = useCallback(
    (key: DictKey, count: number, vars?: TranslateVars): string =>
      t(pluralKey(key, count), { count, ...vars }),
    [t],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggle, t, tp }),
    [locale, setLocale, toggle, t, tp],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/**
 * Pluralisation convention: a count-bearing key may have a `.one` sibling used
 * when count === 1, e.g. "some.key" / "some.key.one".
 * Malayalam needs only one/other here, so ICU MessageFormat would be overkill.
 * Add new plural pairs with this same `.one` suffix.
 */
function pluralKey(base: DictKey, count: number): DictKey {
  const singular = `${base}.one` as DictKey;
  return count === 1 && singular in en ? singular : base;
}
