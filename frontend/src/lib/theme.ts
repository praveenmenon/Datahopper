export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'themeMode';

export function getStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return null;
}

export function getSystemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const isDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');
}

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  applyTheme(mode);
}

export function initThemeEarly() {
  let stored = getStoredTheme();
  if (!stored) {
    // Migrate from legacy key 'theme'
    try {
      const legacy = localStorage.getItem('theme');
      if (legacy === 'dark' || legacy === 'light') {
        stored = legacy as ThemeMode;
        localStorage.setItem('themeMode', stored);
      }
    } catch {}
  }
  applyTheme(stored ?? 'system');
}


