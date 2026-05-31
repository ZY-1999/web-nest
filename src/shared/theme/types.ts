export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  destructive: string;
  destructiveForeground: string;
  ring: string;
}

export type ThemeMode = 'light' | 'dark';

export interface ThemePreset {
  mode: ThemeMode;
  tokens: ThemeTokens;
}
