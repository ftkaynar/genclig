"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect } from "react";

export type Theme = "light" | "dark";

/** localStorage anahtarı. theme-script.ts içindeki değerle aynı olmak zorunda. */
export const THEME_STORAGE_KEY = "genclig-theme";

/**
 * Segment varsayılanları: kullanıcı PWA'sı koyu, yönetim yüzleri açık.
 * Neden yol üzerinden: (user) route group URL'e yansımadığı için segment
 * bilgisi ancak pathname'den okunabiliyor.
 */
export function defaultThemeFor(pathname: string): Theme {
  return pathname.startsWith("/panel") || pathname.startsWith("/admin")
    ? "light"
    : "dark";
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Gizli sekme veya site verisi engelliyse okuma hata fırlatabilir.
    return null;
  }
}

/** Aktif temayı DOM'dan okur. Tek doğru kaynak html[data-theme]. */
export function getCurrentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

type ThemeContextValue = {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/*
  Temanın tek doğru kaynağı html[data-theme] özniteliği; React state'i bilerek
  tutulmuyor.

  Neden: tema yalnızca CSS'i etkiliyor (globals.css'teki token'lar ve
  when-dark / when-light sınıfları). Değeri ayrıca state'te tutmak, effect
  içinden setState çağırmayı ve her tema değişiminde ağacı yeniden render
  etmeyi gerektiriyordu; görünüm zaten CSS ile güncellendiği için bu render
  boşa gidiyordu.

  Temayı okuması gereken bir bileşen çıkarsa getCurrentTheme() kullanır;
  değişime tepki vermesi gerekiyorsa useSyncExternalStore ile MutationObserver
  üzerinden abone olmalı, state'i buraya geri taşımamalı.
*/
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  /*
    Yol değiştiğinde temayı yeniden karara bağlar.
    Kullanıcının açık tercihi her zaman kazanır; tercih yoksa segment
    varsayılanı uygulanır. Bu efekt client tarafı gezinmede de gerekli,
    çünkü inline script yalnızca ilk yüklemede koşar.
  */
  useEffect(() => {
    document.documentElement.dataset.theme =
      readStoredTheme() ?? defaultThemeFor(pathname);
  }, [pathname]);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Kalıcılık yoksa tema yalnızca bu sekme için geçerli olur; akış bozulmaz.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getCurrentTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme yalnızca ThemeProvider içinde kullanılabilir.");
  }
  return context;
}
