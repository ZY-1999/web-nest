import type { ThemeTokens } from './types';

export * from './types';
export * from './presets';

export function themeTokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--bg': tokens.bg,
    '--surface': tokens.surface,
    '--surface-2': tokens.surface2,
    '--border': tokens.border,
    '--text': tokens.text,
    '--text-muted': tokens.textMuted,
    '--primary': tokens.primary,
    '--primary-hover': tokens.primaryHover,
    '--primary-foreground': tokens.primaryForeground,
    '--destructive': tokens.destructive,
    '--destructive-foreground': tokens.destructiveForeground,
    '--ring': tokens.ring,
  };
}

export function applyThemeToRoot(tokens: ThemeTokens): void {
  const vars = themeTokensToCssVars(tokens);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
